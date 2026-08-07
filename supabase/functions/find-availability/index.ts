// find-availability — read-only computation across EVERY connected calendar
// the caller can see, not just the scoped org. Cross-org availability is the
// whole point: six Google accounts cannot see each other's free/busy.
//
// This function never books anything. Selecting a slot creates a proposal.
import {
  corsHeaders, jsonResponse, admin, authedUser, googleToken, gcal,
} from "../_shared/calendar.ts";

interface Slot { start: string; end: string; score: number; note: string }

const DEFAULT_HOURS = { start: 9, end: 17, days: [1, 2, 3, 4, 5] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await authedUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const durationMin: number = Math.max(15, Math.min(480, Number(body?.duration_minutes ?? 45)));
    const bufferMin: number = Math.max(0, Math.min(120, Number(body?.buffer_minutes ?? 10)));
    const participants: string[] = Array.isArray(body?.participants)
      ? body.participants.filter((x: unknown) => typeof x === "string")
      : [];
    const from = body?.from ? new Date(body.from) : new Date();
    const to = body?.to ? new Date(body.to) : new Date(Date.now() + 14 * 86400000);
    const hours = {
      start: Number(body?.working_hours?.start ?? DEFAULT_HOURS.start),
      end: Number(body?.working_hours?.end ?? DEFAULT_HOURS.end),
      days: (body?.working_hours?.days as number[]) ?? DEFAULT_HOURS.days,
    };

    const db = admin();

    // Busy blocks from every calendar the caller is a member of. RLS is
    // bypassed here, so membership is applied explicitly.
    const [{ data: m1 }, { data: m2 }] = await Promise.all([
      db.from("org_memberships").select("org_id").eq("user_id", user.id),
      db.from("org_members").select("org_id").eq("user_id", user.id),
    ]);
    const orgIds = Array.from(new Set([
      ...((m1 ?? []) as { org_id: string }[]).map((r) => r.org_id),
      ...((m2 ?? []) as { org_id: string }[]).map((r) => r.org_id),
    ]));
    if (orgIds.length === 0) return jsonResponse({ slots: [], busy: [], gaps: ["no organisations"] });

    const { data: events } = await db
      .from("calendar_events")
      .select("starts_at,ends_at,org_id,all_day")
      .in("org_id", orgIds)
      .eq("status", "confirmed")
      .eq("transparency", "opaque")
      .eq("all_day", false)
      .neq("self_response", "declined")
      .lt("starts_at", to.toISOString())
      .gt("ends_at", from.toISOString());

    const busy: Array<{ start: number; end: number }> = ((events ?? []) as { starts_at: string; ends_at: string }[])
      .map((e) => ({ start: Date.parse(e.starts_at), end: Date.parse(e.ends_at) }));

    // External participants via Google free/busy, where they publish it.
    const gaps: string[] = [];
    if (participants.length) {
      try {
        const token = await googleToken(user.id);
        const r = await gcal("/freeBusy", token, {
          method: "POST",
          body: JSON.stringify({
            timeMin: from.toISOString(),
            timeMax: to.toISOString(),
            items: participants.map((email) => ({ id: email })),
          }),
        });
        if (r.ok) {
          const fb = await r.json() as { calendars?: Record<string, { busy?: Array<{ start: string; end: string }>; errors?: unknown[] }> };
          for (const [email, cal] of Object.entries(fb.calendars ?? {})) {
            if (cal.errors?.length) { gaps.push(`${email} does not publish free/busy`); continue; }
            for (const b of cal.busy ?? []) busy.push({ start: Date.parse(b.start), end: Date.parse(b.end) });
          }
        } else {
          gaps.push("external free/busy unavailable");
        }
      } catch {
        gaps.push("external free/busy unavailable");
      }
    }

    busy.sort((a, b) => a.start - b.start);
    const need = (durationMin + bufferMin * 2) * 60000;
    const step = 15 * 60000;
    const slots: Slot[] = [];

    for (let t = Math.ceil(Math.max(from.getTime(), Date.now()) / step) * step; t + need <= to.getTime(); t += step) {
      const d = new Date(t);
      if (!hours.days.includes(d.getUTCDay() === 0 ? 0 : d.getDay())) continue;
      const h = d.getHours() + d.getMinutes() / 60;
      if (h < hours.start || h + durationMin / 60 > hours.end) continue;
      const s = t + bufferMin * 60000;
      const e = s + durationMin * 60000;
      const clash = busy.some((b) => b.start < e + bufferMin * 60000 && b.end > s - bufferMin * 60000);
      if (clash) continue;
      // Earlier is better; mid-morning beats late afternoon.
      const score = 100 - Math.floor((t - from.getTime()) / 86400000) * 4 - Math.abs(h - 10);
      slots.push({
        start: new Date(s).toISOString(),
        end: new Date(e).toISOString(),
        score,
        note: gaps.length ? "some attendees do not publish free/busy" : "clear across every connected calendar",
      });
      if (slots.length >= 200) break;
    }

    slots.sort((a, b) => b.score - a.score);
    return jsonResponse({ slots: slots.slice(0, 12), busy_count: busy.length, gaps });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
