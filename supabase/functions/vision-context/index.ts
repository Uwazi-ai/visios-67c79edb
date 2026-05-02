// Vision Context Engine — fetches all relevant data sources in parallel
// and returns a structured snapshot the Vision system prompt can render.
import { corsHeaders, jsonResponse, getAuthedUserFromReq, adminClient, getFreshGoogleAccessToken } from "../_shared/google.ts";

interface Intent {
  needsEmails: boolean;
  needsCalendar: boolean;
  needsDrive: boolean;
  needsSlack: boolean;
  mentionedPerson: string | null;
  mentionedCompany: string | null;
  timeframe: "today" | "week" | "month" | "general";
}

const DEFAULT_INTENT: Intent = {
  needsEmails: false, needsCalendar: false, needsDrive: false, needsSlack: false,
  mentionedPerson: null, mentionedCompany: null, timeframe: "general",
};

async function classifyIntent(message: string): Promise<Intent> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return { ...DEFAULT_INTENT, needsEmails: true, needsCalendar: true };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: "You classify what data sources are needed to answer a user's question. Return ONLY via the tool call." },
          { role: "user", content: `Question: "${message}"` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify",
            parameters: {
              type: "object",
              properties: {
                needsEmails: { type: "boolean" },
                needsCalendar: { type: "boolean" },
                needsDrive: { type: "boolean" },
                needsSlack: { type: "boolean" },
                mentionedPerson: { type: ["string", "null"] },
                mentionedCompany: { type: ["string", "null"] },
                timeframe: { type: "string", enum: ["today", "week", "month", "general"] },
              },
              required: ["needsEmails", "needsCalendar", "needsDrive", "needsSlack", "timeframe"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "classify" } },
      }),
    });
    if (!res.ok) return { ...DEFAULT_INTENT, needsEmails: true, needsCalendar: true };
    const j = await res.json();
    const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { ...DEFAULT_INTENT, needsEmails: true, needsCalendar: true };
    return { ...DEFAULT_INTENT, ...JSON.parse(args) };
  } catch {
    return { ...DEFAULT_INTENT, needsEmails: true, needsCalendar: true };
  }
}

function header(msg: any, name: string): string {
  return msg?.payload?.headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function fetchEmails(userId: string, intent: Intent) {
  try {
    const token = await getFreshGoogleAccessToken(userId);
    let q = "newer_than:7d -category:promotions -category:social";
    if (intent.mentionedPerson) q = `(from:${intent.mentionedPerson} OR to:${intent.mentionedPerson}) newer_than:30d`;
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=8&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const data = await r.json();
    const threads = data.threads ?? [];
    const detailed = await Promise.all(threads.slice(0, 6).map(async (t: any) => {
      const tr = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!tr.ok) return null;
      const td = await tr.json();
      const msg = td.messages?.[td.messages.length - 1];
      return {
        id: t.id,
        subject: header(msg, "Subject"),
        from: header(msg, "From"),
        date: header(msg, "Date"),
        snippet: (msg?.snippet ?? "").slice(0, 200),
      };
    }));
    return detailed.filter(Boolean);
  } catch (e) {
    console.warn("fetchEmails failed", e);
    return null;
  }
}

async function fetchCalendar(userId: string, intent: Intent) {
  try {
    const token = await getFreshGoogleAccessToken(userId);
    const now = new Date();
    const timeMin = new Date(now); timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date(now);
    if (intent.timeframe === "week") timeMax.setDate(timeMax.getDate() + 7);
    else timeMax.setHours(timeMax.getHours() + 48);
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=10`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const data = await r.json();
    return (data.items ?? []).map((e: any) => ({
      id: e.id,
      title: e.summary ?? "Untitled",
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      meetLink: e.hangoutLink ?? null,
      attendees: (e.attendees ?? []).map((a: any) => ({ email: a.email, name: a.displayName })),
    }));
  } catch (e) {
    console.warn("fetchCalendar failed", e);
    return null;
  }
}

async function fetchDrive(userId: string, query: string, folderIds: string[]) {
  if (folderIds.length === 0) return null;
  try {
    const token = await getFreshGoogleAccessToken(userId);
    const terms = query.replace(/['"\\]/g, "").split(/\s+/).filter((w) => w.length > 3).slice(0, 4).join(" ");
    if (!terms) return null;
    const folderClause = folderIds.map((id) => `'${id}' in parents`).join(" or ");
    const q = `(${folderClause}) and fullText contains '${terms}' and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,modifiedTime,webViewLink)&pageSize=5&orderBy=modifiedTime desc`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const data = await r.json();
    return (data.files ?? []).slice(0, 4);
  } catch (e) {
    console.warn("fetchDrive failed", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const { org_id, message } = await req.json();
    const userMessage = String(message ?? "");

    const admin = adminClient();

    // Load enabled integrations
    const { data: integrations } = await admin
      .from("integrations")
      .select("provider, vision_enabled, metadata")
      .eq("user_id", user.id);
    const integrationMap = new Map<string, any>();
    for (const it of integrations ?? []) integrationMap.set(it.provider, it);
    const visionOn = (p: string) => integrationMap.get(p)?.vision_enabled !== false; // default on

    const googleMeta = integrationMap.get("google")?.metadata ?? {};
    const gmailOn = visionOn("google") && googleMeta.gmail_enabled !== false;
    const calendarOn = visionOn("google") && googleMeta.calendar_enabled !== false;
    const driveOn = visionOn("google") && googleMeta.drive_enabled !== false;
    const driveFolderIds: string[] = Array.isArray(googleMeta.drive_folder_ids) ? googleMeta.drive_folder_ids : [];

    const intent = await classifyIntent(userMessage);

    const [emailsR, calendarR, driveR, contactsR, tasksR, kbR] = await Promise.allSettled([
      gmailOn && intent.needsEmails ? fetchEmails(user.id, intent) : Promise.resolve(null),
      calendarOn && (intent.needsCalendar || intent.timeframe !== "general") ? fetchCalendar(user.id, intent) : Promise.resolve(null),
      driveOn && intent.needsDrive ? fetchDrive(user.id, userMessage, driveFolderIds) : Promise.resolve(null),
      (async () => {
        let q = admin.from("contacts").select("name, email, company, role, last_touched_at, engagement_stage")
          .order("last_touched_at", { ascending: false, nullsFirst: false }).limit(8);
        if (org_id) q = q.eq("org_id", org_id);
        if (intent.mentionedPerson) q = q.ilike("name", `%${intent.mentionedPerson}%`);
        const { data } = await q;
        return data ?? [];
      })(),
      (async () => {
        let q = admin.from("tasks").select("title, status, priority, due_at")
          .neq("status", "done").order("due_at", { ascending: true, nullsFirst: false }).limit(10);
        if (org_id) q = q.eq("org_id", org_id);
        const { data } = await q;
        return data ?? [];
      })(),
      (async () => {
        if (!userMessage || userMessage.length < 4) return [];
        const { data } = await admin.rpc("search_kb_text", {
          query_text: userMessage,
          org_filter: org_id ?? null,
          user_filter: user.id,
          match_count: 4,
        });
        return data ?? [];
      })(),
    ]);

    const pick = <T,>(r: PromiseSettledResult<T>): T | null => r.status === "fulfilled" ? r.value : null;

    return jsonResponse({
      intent,
      emails: pick(emailsR),
      calendar: pick(calendarR),
      drive: pick(driveR),
      contacts: pick(contactsR) ?? [],
      tasks: pick(tasksR) ?? [],
      slack: null,
      kb: pick(kbR) ?? [],
      sources: {
        gmail: gmailOn, calendar: calendarOn, drive: driveOn && driveFolderIds.length > 0,
        slack: false, jira: false, confluence: false, kb: true, contacts: true, tasks: true,
      },
    });
  } catch (e) {
    console.error("vision-context error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
