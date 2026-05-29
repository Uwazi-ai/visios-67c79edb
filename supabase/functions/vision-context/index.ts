// Vision Context Engine — Phase D
// Fetches all relevant data sources in parallel (Gmail, Google Calendar, team
// calendar/events, Drive, Knowledge Base, Tasks, Chat, Contacts) and returns a
// structured snapshot the Vision system prompt can render.
import { corsHeaders, jsonResponse, getAuthedUserFromReq, adminClient, getFreshGoogleAccessToken } from "../_shared/google.ts";

interface Intent {
  needsEmails: boolean;
  needsCalendar: boolean;
  needsDrive: boolean;
  needsKnowledge: boolean;
  needsTasks: boolean;
  needsChat: boolean;
  needsContacts: boolean;
  needsTeamCalendar: boolean;
  isDailyBrief: boolean;
  isSchedulingRequest: boolean;
  mentionedPerson: string | null;
  mentionedCompany: string | null;
  mentionedPeople: string[];
  mentionedOrgs: string[];
  timeframe: "today" | "week" | "month" | "general";
}

const DEFAULT_INTENT: Intent = {
  needsEmails: false, needsCalendar: false, needsDrive: false, needsKnowledge: false,
  needsTasks: false, needsChat: false, needsContacts: false, needsTeamCalendar: false,
  isDailyBrief: false, isSchedulingRequest: false,
  mentionedPerson: null, mentionedCompany: null, mentionedPeople: [], mentionedOrgs: [],
  timeframe: "general",
};

function quickIntent(message: string, isDailyBrief: boolean): Intent {
  const m = (message || "").toLowerCase();
  const briefRe = /\b(brief|morning brief|daily brief|day ahead|whats? on|what'?s on|catch me up|summary of (my )?day)\b/;
  const schedRe = /\b(schedule|book|set up|find (a )?time|free time|availability|reschedul|move (the )?meeting|cancel (the )?meeting|when (are we|do we|am i) meet)\b/;
  const isBrief = isDailyBrief || briefRe.test(m);
  return {
    ...DEFAULT_INTENT,
    isDailyBrief: isBrief,
    isSchedulingRequest: schedRe.test(m),
    needsEmails: isBrief || /\b(email|inbox|gmail|message|reply|sent|unread)\b/.test(m),
    needsCalendar: isBrief || /\b(calendar|meeting|event|schedule|today|tomorrow|week|agenda)\b/.test(m) || schedRe.test(m),
    needsTeamCalendar: isBrief || /\b(team|teammate|everyone|together|with [a-z]+)\b/.test(m) || schedRe.test(m),
    needsDrive: /\b(doc|document|drive|file|spreadsheet|deck|slides|sheet)\b/.test(m),
    needsKnowledge: /\b(know|remember|wiki|playbook|policy|process|kb|knowledge)\b/.test(m) || (m.length > 8 && !schedRe.test(m)),
    needsTasks: isBrief || /\b(task|todo|to-do|priorit|deadline|due|backlog|sprint)\b/.test(m),
    needsChat: isBrief || /\b(chat|slack|channel|dm|thread|message)\b/.test(m),
    needsContacts: /\b(contact|person|people|who is|relationship|client|customer)\b/.test(m),
  };
}

async function classifyIntent(message: string, isDailyBrief: boolean): Promise<Intent> {
  const fallback = quickIntent(message, isDailyBrief);
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey || !message || message.length < 4) return fallback;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: "Classify which data sources are needed to answer the user's question. Be generous — when in doubt include the source." },
          { role: "user", content: `Question: "${message}"\nIs this an automatic morning brief? ${isDailyBrief}` },
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
                needsTeamCalendar: { type: "boolean" },
                needsDrive: { type: "boolean" },
                needsKnowledge: { type: "boolean" },
                needsTasks: { type: "boolean" },
                needsChat: { type: "boolean" },
                needsContacts: { type: "boolean" },
                isSchedulingRequest: { type: "boolean" },
                mentionedPerson: { type: ["string", "null"] },
                mentionedCompany: { type: ["string", "null"] },
                mentionedPeople: { type: "array", items: { type: "string" } },
                mentionedOrgs: { type: "array", items: { type: "string" } },
                timeframe: { type: "string", enum: ["today", "week", "month", "general"] },
              },
              required: ["needsEmails","needsCalendar","needsDrive","needsKnowledge","needsTasks","needsChat","needsContacts","isSchedulingRequest","timeframe"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "classify" } },
      }),
    });
    if (!res.ok) return fallback;
    const j = await res.json();
    const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return fallback;
    const parsed = JSON.parse(args);
    return {
      ...fallback,
      ...parsed,
      isDailyBrief: fallback.isDailyBrief,
      mentionedPeople: parsed.mentionedPeople ?? (parsed.mentionedPerson ? [parsed.mentionedPerson] : []),
      mentionedOrgs: parsed.mentionedOrgs ?? [],
      needsTeamCalendar: parsed.needsTeamCalendar ?? fallback.needsTeamCalendar,
    };
  } catch {
    return fallback;
  }
}

function header(msg: any, name: string): string {
  return msg?.payload?.headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function fetchEmails(userId: string, intent: Intent, contactEmails: Set<string>, orgDomains: Set<string>) {
  try {
    const token = await getFreshGoogleAccessToken(userId);
    let q = "newer_than:2d -category:promotions -category:social";
    if (intent.isDailyBrief) q = "newer_than:2d is:unread -category:promotions -category:social";
    if (intent.mentionedPerson) q = `(from:${intent.mentionedPerson} OR to:${intent.mentionedPerson}) newer_than:30d`;
    const max = intent.isDailyBrief ? 20 : 10;
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${max}&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const data = await r.json();
    const threads = data.threads ?? [];
    const detailed = await Promise.all(threads.slice(0, max).map(async (t: any) => {
      const tr = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!tr.ok) return null;
      const td = await tr.json();
      const msg = td.messages?.[td.messages.length - 1];
      const labels: string[] = msg?.labelIds ?? [];
      const from = header(msg, "From");
      const fromEmail = (from.match(/<([^>]+)>/)?.[1] ?? from).toLowerCase().trim();
      const fromDomain = fromEmail.split("@")[1] ?? "";
      const unread = labels.includes("UNREAD");
      const starred = labels.includes("STARRED");
      // Importance: starred (3) + known contact (2) + org domain (2) + unread (1)
      let importance = 0;
      if (starred) importance += 3;
      if (contactEmails.has(fromEmail)) importance += 2;
      if (fromDomain && orgDomains.has(fromDomain)) importance += 2;
      if (unread) importance += 1;
      return {
        id: t.id,
        subject: header(msg, "Subject"),
        from,
        date: header(msg, "Date"),
        snippet: (msg?.snippet ?? "").slice(0, 220),
        unread,
        starred,
        importance,
      };
    }));
    const list = detailed.filter(Boolean) as any[];
    if (intent.isDailyBrief) {
      list.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
      return list.slice(0, 12);
    }
    return list;
  } catch (e) {
    console.warn("fetchEmails failed", e);
    return null;
  }
}

async function fetchGoogleCalendar(userId: string, intent: Intent) {
  try {
    const token = await getFreshGoogleAccessToken(userId);
    const now = new Date();
    const timeMin = new Date(now); timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date(now);
    if (intent.timeframe === "week" || intent.isSchedulingRequest) timeMax.setDate(timeMax.getDate() + 7);
    else if (intent.timeframe === "month") timeMax.setDate(timeMax.getDate() + 30);
    else timeMax.setHours(timeMax.getHours() + 48);
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=20`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const data = await r.json();
    return (data.items ?? []).map((e: any) => ({
      id: e.id,
      title: e.summary ?? "Untitled",
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      meetLink: e.hangoutLink ?? null,
      location: e.location ?? null,
      description: (e.description ?? "").replace(/\s+/g, " ").slice(0, 100),
      attendees: (e.attendees ?? []).map((a: any) => ({ email: a.email, name: a.displayName, status: a.responseStatus })),
      source: "google" as const,
    }));
  } catch (e) {
    console.warn("fetchGoogleCalendar failed", e);
    return null;
  }
}

async function fetchTeamCalendar(admin: any, userId: string, orgIds: string[], intent: Intent) {
  if (!orgIds.length) return null;
  try {
    const now = new Date();
    const timeMin = new Date(now); timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date(now);
    if (intent.timeframe === "week" || intent.isSchedulingRequest) timeMax.setDate(timeMax.getDate() + 7);
    else if (intent.timeframe === "month") timeMax.setDate(timeMax.getDate() + 30);
    else timeMax.setHours(timeMax.getHours() + 48);

    const [{ data: events }, { data: members }] = await Promise.all([
      admin.from("events")
        .select("id, title, start_at, end_at, org_id, created_by, visibility, meet_link, attendees, event_attendees(user_id, status)")
        .or(`org_id.in.(${orgIds.join(",")}),created_by.eq.${userId},visibility.eq.all_orgs`)
        .gte("start_at", timeMin.toISOString())
        .lte("start_at", timeMax.toISOString())
        .order("start_at", { ascending: true })
        .limit(60),
      admin.from("org_memberships")
        .select("user_id, profiles:user_id(display_name, email)")
        .in("org_id", orgIds),
    ]);

    const mappedEvents = (events ?? []).map((e: any) => ({
      id: e.id,
      title: e.title,
      start: e.start_at,
      end: e.end_at,
      meetLink: e.meet_link,
      org_id: e.org_id,
      created_by: e.created_by,
      visibility: e.visibility,
      attendees: e.attendees ?? [],
      attendee_user_ids: (e.event_attendees ?? [])
        .filter((a: any) => a.status !== "declined")
        .map((a: any) => a.user_id),
      source: "team" as const,
    }));

    const rosterMap = new Map<string, { user_id: string; name: string }>();
    for (const m of (members ?? []) as any[]) {
      if (!m.user_id || rosterMap.has(m.user_id)) continue;
      rosterMap.set(m.user_id, {
        user_id: m.user_id,
        name: m.profiles?.display_name || m.profiles?.email || "Unknown",
      });
    }
    const roster = Array.from(rosterMap.values());

    const perMember = roster.map((r) => {
      const busy = mappedEvents
        .filter((e) => e.created_by === r.user_id || e.attendee_user_ids.includes(r.user_id))
        .map((e) => ({ start: e.start, end: e.end ?? e.start, title: e.title }));
      return { ...r, busy };
    });

    // Today working window 9-17 for conflict / open-slot analysis
    const dayStart = new Date(); dayStart.setHours(9, 0, 0, 0);
    const dayEnd = new Date(); dayEnd.setHours(17, 0, 0, 0);
    type Iv = { start: Date; end: Date; user_id: string; title: string };
    const ivs: Iv[] = [];
    for (const m of perMember) {
      for (const b of m.busy) {
        if (!b.start || !b.end) continue;
        const a = new Date(b.start), z = new Date(b.end);
        if (z <= dayStart || a >= dayEnd) continue;
        ivs.push({
          start: a < dayStart ? dayStart : a,
          end: z > dayEnd ? dayEnd : z,
          user_id: m.user_id,
          title: b.title,
        });
      }
    }

    // Sweep for conflicts (≥2 distinct members busy at the same moment)
    const evts = ivs.flatMap((iv, idx) => [
      { t: iv.start.getTime(), delta: 1, idx },
      { t: iv.end.getTime(), delta: -1, idx },
    ]).sort((a, b) => a.t - b.t || b.delta - a.delta);
    const active = new Set<number>();
    const conflicts: { start: string; end: string; members: string[]; titles: string[] }[] = [];
    let confStart: number | null = null;
    for (const p of evts) {
      if (p.delta === 1) active.add(p.idx); else active.delete(p.idx);
      const users = new Set(Array.from(active).map((i) => ivs[i].user_id));
      if (users.size >= 2 && confStart === null) confStart = p.t;
      else if (users.size < 2 && confStart !== null) {
        const memberIds = Array.from(new Set(Array.from(active).map((i) => ivs[i].user_id)));
        conflicts.push({
          start: new Date(confStart).toISOString(),
          end: new Date(p.t).toISOString(),
          members: memberIds,
          titles: Array.from(new Set(Array.from(active).map((i) => ivs[i].title))),
        });
        confStart = null;
      }
    }

    // Open slots: windows during 9-17 today where NO member is busy
    const merged: { start: Date; end: Date }[] = [];
    for (const iv of ivs.slice().sort((a, b) => a.start.getTime() - b.start.getTime())) {
      if (!merged.length || iv.start > merged[merged.length - 1].end) merged.push({ start: iv.start, end: iv.end });
      else merged[merged.length - 1].end = new Date(Math.max(merged[merged.length - 1].end.getTime(), iv.end.getTime()));
    }
    const openSlots: { start: string; end: string; minutes: number }[] = [];
    let cur = dayStart;
    for (const m of merged) {
      if (m.start > cur) {
        const mins = Math.round((m.start.getTime() - cur.getTime()) / 60000);
        if (mins >= 15) openSlots.push({ start: cur.toISOString(), end: m.start.toISOString(), minutes: mins });
      }
      if (m.end > cur) cur = m.end;
    }
    if (cur < dayEnd) {
      const mins = Math.round((dayEnd.getTime() - cur.getTime()) / 60000);
      if (mins >= 15) openSlots.push({ start: cur.toISOString(), end: dayEnd.toISOString(), minutes: mins });
    }

    return {
      events: mappedEvents,
      per_member: perMember.map((m) => ({
        user_id: m.user_id,
        name: m.name,
        busy_count: m.busy.length,
        busy: m.busy.slice(0, 8),
      })),
      conflicts,
      open_slots: openSlots,
    };
  } catch (e) {
    console.warn("fetchTeamCalendar failed", e);
    return null;
  }
}

async function exportDriveFile(token: string, fileId: string, mimeType: string): Promise<string | null> {
  try {
    let url: string;
    if (mimeType === "application/vnd.google-apps.document") {
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
    } else if (mimeType === "application/vnd.google-apps.presentation") {
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    } else if (mimeType?.startsWith("text/")) {
      url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    } else {
      return null;
    }
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const text = await r.text();
    return text.replace(/\s+/g, " ").slice(0, 2000);
  } catch { return null; }
}

async function fetchDrive(
  userId: string,
  query: string,
  folderIds: string[],
  orgFolders: { org_id: string; folder_id: string }[],
  orgSharedDrives: { org_id: string; drive_id: string; drive_name: string | null; org_name: string | null }[],
  intent: Intent,
) {
  try {
    const token = await getFreshGoogleAccessToken(userId);
    const allFolders = Array.from(new Set([
      ...folderIds,
      ...orgFolders.map((o) => o.folder_id).filter(Boolean),
    ]));

    const terms = (query || "")
      .replace(/['"\\]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 4)
      .join(" ");

    const scopeClause = allFolders.length
      ? `(${allFolders.map((id) => `'${id}' in parents`).join(" or ")}) and `
      : "";

    const fields = "files(id,name,mimeType,modifiedTime,webViewLink,lastModifyingUser(displayName,emailAddress))";
    const results: any[] = [];

    // 1) Recent files in org folders (last 7d) — always on daily brief, when folders exist
    if (allFolders.length && (intent.isDailyBrief || !terms)) {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const q = `${scopeClause}modifiedTime > '${since}' and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=10&orderBy=modifiedTime desc`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const data = await r.json();
        results.push(...(data.files ?? []));
      }
    }

    // 2) Topic search across legacy folders
    if (terms && allFolders.length) {
      const q = `${scopeClause}fullText contains '${terms}' and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=6&orderBy=modifiedTime desc`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const data = await r.json();
        results.push(...(data.files ?? []));
      }
    }

    // 3) Per-org Shared Drives — recent + topic search
    for (const od of orgSharedDrives) {
      if (!od.drive_id) continue;
      const base = `https://www.googleapis.com/drive/v3/files?corpora=drive&driveId=${encodeURIComponent(od.drive_id)}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=${encodeURIComponent(fields)}&orderBy=modifiedTime desc`;

      if (intent.isDailyBrief || !terms) {
        const since = new Date(Date.now() - 7 * 86400000).toISOString();
        const q = `modifiedTime > '${since}' and trashed = false`;
        const r = await fetch(`${base}&q=${encodeURIComponent(q)}&pageSize=5`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const data = await r.json();
          for (const f of (data.files ?? [])) results.push({ ...f, _orgName: od.org_name, _driveName: od.drive_name, _driveId: od.drive_id });
        }
      }
      if (terms) {
        const q = `(name contains '${terms}' or fullText contains '${terms}') and trashed = false`;
        const r = await fetch(`${base}&q=${encodeURIComponent(q)}&pageSize=6`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const data = await r.json();
          for (const f of (data.files ?? [])) results.push({ ...f, _orgName: od.org_name, _driveName: od.drive_name, _driveId: od.drive_id });
        }
      }
    }

    // De-dupe by id, cap to 12
    const seen = new Set<string>();
    const unique: any[] = [];
    for (const f of results) {
      if (!f?.id || seen.has(f.id)) continue;
      seen.add(f.id);
      unique.push(f);
      if (unique.length >= 12) break;
    }

    // Export content for the top N when intent likely needs it
    const wantsContent = !!terms || intent.mentionedCompany || intent.mentionedPeople.length > 0;
    const exportLimit = wantsContent ? 3 : 0;
    for (let i = 0; i < Math.min(exportLimit, unique.length); i++) {
      const snippet = await exportDriveFile(token, unique[i].id, unique[i].mimeType);
      if (snippet) unique[i].contentPreview = snippet;
    }

    return unique.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
      webViewLink: f.webViewLink,
      lastModifiedBy: f.lastModifyingUser?.displayName ?? f.lastModifyingUser?.emailAddress ?? null,
      contentPreview: f.contentPreview ?? null,
      orgName: f._orgName ?? null,
      driveName: f._driveName ?? null,
      driveId: f._driveId ?? null,
    }));
  } catch (e) {
    console.warn("fetchDrive failed", e);
    return null;
  }
}


async function fetchTasks(admin: any, userId: string, orgIds: string[], intent: Intent) {
  try {
    const nowIso = new Date().toISOString();
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
    const eotIso = endOfToday.toISOString();

    const select = "id, title, status, priority, due_at, start_date, assignee_id, org_id, project_id, projects(name, emoji)";

    // Build base scoping: tasks in user's orgs OR assigned to / created by user
    const orgFilter = orgIds.length ? `org_id.in.(${orgIds.join(",")}),` : "";
    const scope = `${orgFilter}assignee_id.eq.${userId},created_by.eq.${userId}`;

    // 1. Overdue (assigned to me)
    const { data: overdue } = await admin.from("tasks").select(select)
      .neq("status", "done")
      .eq("assignee_id", userId)
      .not("due_at", "is", null)
      .lt("due_at", nowIso)
      .order("due_at", { ascending: true })
      .limit(10);

    // 2. Due today (assigned to me)
    const { data: dueToday } = await admin.from("tasks").select(select)
      .neq("status", "done")
      .eq("assignee_id", userId)
      .gte("due_at", nowIso)
      .lte("due_at", eotIso)
      .order("due_at", { ascending: true })
      .limit(10);

    // 3. My open tasks (no/future due)
    const { data: mine } = await admin.from("tasks").select(select)
      .neq("status", "done")
      .eq("assignee_id", userId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(intent.isDailyBrief ? 15 : 10);

    // 4. High/urgent priority across user's orgs (not necessarily assigned to me)
    let highQ = admin.from("tasks").select(select)
      .neq("status", "done")
      .in("priority", ["urgent", "high"])
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(8);
    if (orgIds.length) highQ = highQ.or(scope);
    const { data: high } = await highQ;

    // 5. Mentioned-person filter: tasks assigned to a matching profile
    let mentioned: any[] = [];
    const names = intent.mentionedPeople ?? (intent.mentionedPerson ? [intent.mentionedPerson] : []);
    if (names.length) {
      const orExpr = names.map((n: string) => `display_name.ilike.%${n}%,email.ilike.%${n}%`).join(",");
      const { data: profs } = await admin.from("profiles").select("id").or(orExpr).limit(5);
      const ids = (profs ?? []).map((p: any) => p.id);
      if (ids.length) {
        let mq = admin.from("tasks").select(select)
          .neq("status", "done")
          .in("assignee_id", ids)
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(8);
        if (orgIds.length) mq = mq.in("org_id", orgIds);
        const { data } = await mq;
        mentioned = data ?? [];
      }
    }

    // 6. Scheduling intent: open tasks with start_date or due_at in next 14 days that lack a linked event
    let needsScheduling: any[] = [];
    if (intent.isSchedulingRequest) {
      const in14 = new Date(Date.now() + 14 * 86400000).toISOString();
      const { data } = await admin.from("tasks").select(select)
        .neq("status", "done")
        .eq("assignee_id", userId)
        .or(`due_at.lte.${in14},start_date.lte.${in14}`)
        .limit(10);
      needsScheduling = data ?? [];
    }

    // Merge + dedupe by id, tag each with bucket
    const tag = (rows: any[] | null | undefined, bucket: string) =>
      (rows ?? []).map((r) => ({ ...r, bucket }));
    const all = [
      ...tag(overdue, "overdue"),
      ...tag(dueToday, "due_today"),
      ...tag(high, "high_priority"),
      ...tag(mine, "mine"),
      ...tag(mentioned, "mentioned"),
      ...tag(needsScheduling, "needs_scheduling"),
    ];
    const seen = new Map<string, any>();
    for (const t of all) {
      if (!t.id) continue;
      const existing = seen.get(t.id);
      if (!existing) seen.set(t.id, t);
      else {
        // Keep earliest bucket but merge bucket labels
        existing._buckets = Array.from(new Set([...(existing._buckets ?? [existing.bucket]), t.bucket]));
      }
    }
    return Array.from(seen.values()).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_at: t.due_at,
      start_date: t.start_date,
      assignee_id: t.assignee_id,
      org_id: t.org_id,
      project: t.projects ? { name: t.projects.name, emoji: t.projects.emoji } : null,
      buckets: t._buckets ?? [t.bucket],
    })).slice(0, 25);
  } catch (e) { console.warn("fetchTasks failed", e); return []; }
}

async function fetchContacts(admin: any, orgIds: string[], intent: Intent) {
  try {
    const select = "id, name, email, company, role, last_touched_at, engagement_stage, linkedin_url, notes, org_id";
    const collected = new Map<string, any>();
    const tag = (rows: any[] | null, bucket: string) => {
      for (const r of rows ?? []) {
        const key = r.id ?? `${r.email ?? r.name}`;
        const ex = collected.get(key);
        if (ex) ex.buckets = Array.from(new Set([...(ex.buckets ?? []), bucket]));
        else collected.set(key, { ...r, buckets: [bucket] });
      }
    };

    // 1. Mentioned people / company → full profile
    const names: string[] = intent.mentionedPeople ?? (intent.mentionedPerson ? [intent.mentionedPerson] : []);
    if (names.length) {
      const orExpr = names.map((n) => `name.ilike.%${n}%,email.ilike.%${n}%`).join(",");
      let q = admin.from("contacts").select(select).or(orExpr).limit(10);
      if (orgIds.length) q = q.in("org_id", orgIds);
      const { data } = await q;
      tag(data, "mentioned");
    }
    if (intent.mentionedCompany) {
      let q = admin.from("contacts").select(select).ilike("company", `%${intent.mentionedCompany}%`).limit(8);
      if (orgIds.length) q = q.in("org_id", orgIds);
      const { data } = await q;
      tag(data, "mentioned");
    }

    // 2. Stale contacts (no touch in 30+ days) — daily brief priority
    if (intent.isDailyBrief) {
      const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      let q = admin.from("contacts").select(select)
        .lt("last_touched_at", thirtyAgo)
        .neq("engagement_stage", "archived")
        .order("last_touched_at", { ascending: true, nullsFirst: false })
        .limit(8);
      if (orgIds.length) q = q.in("org_id", orgIds);
      const { data } = await q;
      tag(data, "stale");
    }

    // 3. Recently touched fallback
    if (collected.size < 5) {
      let q = admin.from("contacts").select(select)
        .order("last_touched_at", { ascending: false, nullsFirst: false })
        .limit(8);
      if (orgIds.length) q = q.in("org_id", orgIds);
      const { data } = await q;
      tag(data, "recent");
    }

    return Array.from(collected.values()).slice(0, 20);
  } catch (e) { console.warn("fetchContacts failed", e); return []; }
}

async function enrichContactsWithTodayEvents(admin: any, contacts: any[], calendarEvents: any[]) {
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const attendeeEmails = new Set<string>();
    for (const ev of calendarEvents ?? []) {
      const t = new Date(ev.start ?? 0).getTime();
      if (t < todayStart.getTime() || t > todayEnd.getTime()) continue;
      for (const a of ev.attendees ?? []) if (a.email) attendeeEmails.add(String(a.email).toLowerCase());
    }
    if (!attendeeEmails.size) return contacts;
    return contacts.map((c) => {
      if (c.email && attendeeEmails.has(String(c.email).toLowerCase())) {
        return { ...c, buckets: Array.from(new Set([...(c.buckets ?? []), "today_event"])) };
      }
      return c;
    });
  } catch { return contacts; }
}

async function enrichKbChunks(admin: any, chunks: any[]) {
  if (!chunks.length) return [];
  const docIds = Array.from(new Set(chunks.map((c) => c.document_id).filter(Boolean)));
  let docMap = new Map<string, any>();
  if (docIds.length) {
    const { data } = await admin.from("kb_documents")
      .select("id, title, source_type, source_url, source_integration, updated_at, category, file_type")
      .in("id", docIds);
    (data ?? []).forEach((d: any) => docMap.set(d.id, d));
  }
  return chunks.map((c) => {
    const d = docMap.get(c.document_id) ?? {};
    return {
      id: c.id ?? c.document_id,
      document_id: c.document_id,
      document_title: c.document_title ?? d.title ?? "Untitled",
      content: (c.content ?? "").slice(0, 600),
      source_type: d.source_type ?? null,
      source_integration: d.source_integration ?? null,
      source_url: d.source_url ?? null,
      category: d.category ?? null,
      file_type: d.file_type ?? null,
      updated_at: d.updated_at ?? null,
      score: typeof c.rank === "number" ? c.rank : (typeof c.similarity === "number" ? c.similarity : null),
    };
  });
}

async function fetchKnowledge(admin: any, userId: string, orgIds: string[], query: string, isDailyBrief: boolean) {
  try {
    const results: any[] = [];

    // 1. Semantic / full-text search on the user's message (when meaningful)
    if (query && query.length >= 4) {
      for (const oid of orgIds.length ? orgIds : [null]) {
        const { data } = await admin.rpc("search_kb_text", {
          query_text: query,
          org_filter: oid,
          user_filter: userId,
          match_count: 5,
        });
        if (data) results.push(...data);
      }
    }

    // 2. Daily-brief boost: surface recently updated docs alongside any matches
    if (isDailyBrief) {
      let q = admin.from("kb_documents")
        .select("id, title, description, updated_at, source_type, source_url, source_integration, category, file_type")
        .eq("status", "ready")
        .order("updated_at", { ascending: false })
        .limit(5);
      if (orgIds.length) q = q.or(`user_id.eq.${userId},org_id.in.(${orgIds.join(",")})`);
      else q = q.eq("user_id", userId);
      const { data } = await q;
      for (const d of data ?? []) {
        if (results.some((r) => r.document_id === d.id)) continue;
        results.push({
          document_id: d.id,
          document_title: d.title,
          content: (d.description ?? "").slice(0, 400),
          rank: 0,
        });
      }
    }

    // Dedupe by document_id, keep highest-ranked chunk per doc, cap at 6
    const byDoc = new Map<string, any>();
    for (const r of results) {
      const k = r.document_id;
      if (!k) continue;
      const existing = byDoc.get(k);
      if (!existing || (r.rank ?? 0) > (existing.rank ?? 0)) byDoc.set(k, r);
    }
    const top = Array.from(byDoc.values()).slice(0, 6);
    return await enrichKbChunks(admin, top);
  } catch (e) { console.warn("fetchKnowledge failed", e); return []; }
}

async function fetchChat(admin: any, userId: string, orgIds: string[], intent: Intent) {
  if (!orgIds.length && !intent.isDailyBrief) return [];
  try {
    const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const since48 = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

    // Resolve current user's name handles for @mention detection
    const { data: me } = await admin.from("profiles")
      .select("display_name, email, username").eq("id", userId).maybeSingle();
    const handles = [me?.display_name, me?.username, me?.email?.split("@")[0]]
      .filter(Boolean).map((s: string) => s.toLowerCase());

    const select = "id, channel_id, content, user_id, created_at, org_id, thread_id, channels(name, is_dm, dm_participants)";

    // Recent messages in user's orgs OR DMs they participate in
    let q = admin.from("messages").select(select)
      .gte("created_at", since48)
      .neq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (orgIds.length) q = q.in("org_id", orgIds);
    const { data: recent } = await q;

    // Threads the user has participated in — find their messages, then fetch new replies
    const { data: myThreads } = await admin.from("messages")
      .select("thread_id")
      .eq("user_id", userId)
      .not("thread_id", "is", null)
      .gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString())
      .limit(50);
    const threadIds = Array.from(new Set((myThreads ?? []).map((t: any) => t.thread_id).filter(Boolean)));
    let threadReplies: any[] = [];
    if (threadIds.length) {
      const { data } = await admin.from("messages").select(select)
        .in("thread_id", threadIds)
        .neq("user_id", userId)
        .gte("created_at", since48)
        .order("created_at", { ascending: false })
        .limit(20);
      threadReplies = data ?? [];
    }

    const all = [...(recent ?? []), ...threadReplies];
    const seen = new Map<string, any>();
    for (const m of all) {
      if (seen.has(m.id)) continue;
      const txt = (m.content ?? "").toLowerCase();
      const isDM = !!m.channels?.is_dm;
      const isMention = handles.some((h: string) => h && (txt.includes("@" + h) || txt.includes(h)));
      const inThread = !!m.thread_id && threadIds.includes(m.thread_id);
      const recent24 = m.created_at >= since24;
      const buckets: string[] = [];
      if (isMention) buckets.push("mention");
      if (isDM) buckets.push("dm");
      if (inThread) buckets.push("thread_reply");
      if (recent24 && !buckets.length) buckets.push("recent");
      if (!buckets.length) continue;
      seen.set(m.id, {
        id: m.id,
        channel: m.channels?.name ?? (isDM ? "dm" : "channel"),
        is_dm: isDM,
        user_id: m.user_id,
        thread_id: m.thread_id ?? null,
        text: (m.content ?? "").slice(0, 240),
        ts: m.created_at,
        buckets,
      });
    }

    // Sort: mentions first, then DMs, threads, recent — newest within each
    const order = (b: string[]) =>
      b.includes("mention") ? 0 : b.includes("dm") ? 1 : b.includes("thread_reply") ? 2 : 3;
    return Array.from(seen.values())
      .sort((a, b) => order(a.buckets) - order(b.buckets) || (b.ts > a.ts ? 1 : -1))
      .slice(0, intent.isDailyBrief ? 25 : 15);
  } catch (e) { console.warn("fetchChat failed", e); return []; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const body = await req.json();
    const userMessage = String(body?.message ?? "");
    const isDailyBrief = !!body?.is_daily_brief;
    const explicitOrgIds: string[] = Array.isArray(body?.org_ids) ? body.org_ids : [];
    const singleOrgId: string | null = body?.org_id ?? null;

    const admin = adminClient();

    // Resolve org scope: explicit list, or single, or all memberships
    let orgIds: string[] = explicitOrgIds.length ? explicitOrgIds : (singleOrgId ? [singleOrgId] : []);
    if (!orgIds.length) {
      const { data: mems } = await admin.from("org_memberships").select("org_id").eq("user_id", user.id);
      orgIds = (mems ?? []).map((m: any) => m.org_id);
    }

    // Integrations
    const { data: integrations } = await admin
      .from("integrations").select("provider, vision_enabled, metadata").eq("user_id", user.id);
    const integrationMap = new Map<string, any>();
    for (const it of integrations ?? []) integrationMap.set(it.provider, it);
    const visionOn = (p: string) => integrationMap.get(p)?.vision_enabled !== false;
    const googleMeta = integrationMap.get("google")?.metadata ?? {};
    const gmailOn = visionOn("google") && googleMeta.gmail_enabled !== false;
    const calendarOn = visionOn("google") && googleMeta.calendar_enabled !== false;
    const driveOn = visionOn("google") && googleMeta.drive_enabled !== false;
    const driveFolderIds: string[] = Array.isArray(googleMeta.drive_folder_ids) ? googleMeta.drive_folder_ids : [];

    const intent = await classifyIntent(userMessage, isDailyBrief);

    const wantEmails = gmailOn && (intent.needsEmails || intent.isDailyBrief);
    const wantCalendar = calendarOn && (intent.needsCalendar || intent.isDailyBrief);
    const wantTeamCal = (intent.needsTeamCalendar || intent.isDailyBrief || intent.isSchedulingRequest);
    const wantDrive = driveOn && (intent.needsDrive || intent.isDailyBrief);
    const wantTasks = intent.needsTasks || intent.isDailyBrief;
    const wantChat = intent.needsChat || intent.isDailyBrief;
    const wantContacts = intent.needsContacts || intent.mentionedPeople.length > 0 || !!intent.mentionedPerson || intent.isDailyBrief;
    const wantKB = intent.needsKnowledge || intent.isDailyBrief;

    // Pre-fetch contact/org hints for email importance scoring + per-org drive folders
    const [{ data: contactRows }, { data: orgRows }] = await Promise.all([
      admin.from("contacts").select("email").not("email", "is", null).limit(500),
      orgIds.length
        ? admin.from("orgs").select("id, name, slug, metadata, drive_folder_id, shared_drive_id, shared_drive_name").in("id", orgIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const contactEmails = new Set<string>(
      (contactRows ?? []).map((c: any) => String(c.email ?? "").toLowerCase()).filter(Boolean),
    );
    const orgDomains = new Set<string>();
    const orgFolders: { org_id: string; folder_id: string }[] = [];
    const orgSharedDrives: { org_id: string; drive_id: string; drive_name: string | null; org_name: string | null }[] = [];
    for (const o of (orgRows ?? []) as any[]) {
      const domains: string[] = Array.isArray(o?.metadata?.domains) ? o.metadata.domains : [];
      for (const d of domains) if (d) orgDomains.add(String(d).toLowerCase());
      if (o.drive_folder_id) orgFolders.push({ org_id: o.id, folder_id: o.drive_folder_id });
      if (o.shared_drive_id) orgSharedDrives.push({ org_id: o.id, drive_id: o.shared_drive_id, drive_name: o.shared_drive_name ?? null, org_name: o.name ?? null });
    }

    const [emailsR, calendarR, teamCalR, driveR, tasksR, contactsR, kbR, chatR] = await Promise.allSettled([
      wantEmails ? fetchEmails(user.id, intent, contactEmails, orgDomains) : Promise.resolve(null),
      wantCalendar ? fetchGoogleCalendar(user.id, intent) : Promise.resolve(null),
      wantTeamCal ? fetchTeamCalendar(admin, user.id, orgIds, intent) : Promise.resolve(null),
      wantDrive ? fetchDrive(user.id, userMessage, driveFolderIds, orgFolders, orgSharedDrives, intent) : Promise.resolve(null),
      wantTasks ? fetchTasks(admin, user.id, orgIds, intent) : Promise.resolve([]),
      wantContacts ? fetchContacts(admin, orgIds, intent) : Promise.resolve([]),
      wantKB ? fetchKnowledge(admin, user.id, orgIds, userMessage, intent.isDailyBrief) : Promise.resolve([]),
      wantChat ? fetchChat(admin, user.id, orgIds, intent) : Promise.resolve([]),
    ]);

    const pick = <T,>(r: PromiseSettledResult<T>): T | null => r.status === "fulfilled" ? r.value : null;
    const calendarVal = pick(calendarR) ?? [];
    const teamCalRaw: any = pick(teamCalR);
    const teamCalEvents: any[] = Array.isArray(teamCalRaw) ? teamCalRaw : (teamCalRaw?.events ?? []);
    const teamPerMember = teamCalRaw?.per_member ?? [];
    const teamConflicts = teamCalRaw?.conflicts ?? [];
    const teamOpenSlots = teamCalRaw?.open_slots ?? [];

    // Merge & de-dupe team + google calendar events
    const seen = new Set<string>();
    const mergedCalendar: any[] = [];
    for (const e of [...(calendarVal as any[]), ...teamCalEvents]) {
      const k = e?.id ?? "";
      if (k && seen.has(k)) continue;
      seen.add(k);
      mergedCalendar.push(e);
    }
    mergedCalendar.sort((a, b) => String(a.start ?? "").localeCompare(String(b.start ?? "")));

    // Compute today's busy/free blocks (working hours 9–17 local of server; client renders TZ-aware)
    const todayStart = new Date(); todayStart.setHours(9, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(17, 0, 0, 0);
    const busy: { start: string; end: string; title: string }[] = [];
    for (const ev of mergedCalendar) {
      const s = ev.start ? new Date(ev.start) : null;
      const e = ev.end ? new Date(ev.end) : null;
      if (!s || !e) continue;
      if (e <= todayStart || s >= todayEnd) continue;
      busy.push({
        start: (s < todayStart ? todayStart : s).toISOString(),
        end: (e > todayEnd ? todayEnd : e).toISOString(),
        title: ev.title ?? "Busy",
      });
    }
    busy.sort((a, b) => a.start.localeCompare(b.start));
    const free: { start: string; end: string; minutes: number }[] = [];
    let cursor = todayStart;
    for (const b of busy) {
      const bs = new Date(b.start);
      if (bs > cursor) {
        const mins = Math.round((bs.getTime() - cursor.getTime()) / 60000);
        if (mins >= 15) free.push({ start: cursor.toISOString(), end: bs.toISOString(), minutes: mins });
      }
      const be = new Date(b.end);
      if (be > cursor) cursor = be;
    }
    if (cursor < todayEnd) {
      const mins = Math.round((todayEnd.getTime() - cursor.getTime()) / 60000);
      if (mins >= 15) free.push({ start: cursor.toISOString(), end: todayEnd.toISOString(), minutes: mins });
    }

    return jsonResponse({
      intent,
      emails: pick(emailsR),
      calendar: mergedCalendar,
      team_calendar: teamCalEvents,
      team_per_member: teamPerMember,
      team_conflicts: teamConflicts,
      team_open_slots: teamOpenSlots,
      today_busy: busy,
      today_free: free,
      drive: pick(driveR),
      contacts: await enrichContactsWithTodayEvents(admin, pick(contactsR) ?? [], mergedCalendar),
      tasks: pick(tasksR) ?? [],
      chat: pick(chatR) ?? [],
      kb: pick(kbR) ?? [],
      org_ids: orgIds,
      sources: {
        gmail: gmailOn, calendar: calendarOn, team_calendar: orgIds.length > 0,
        drive: driveOn, kb: true, contacts: true,
        tasks: true, chat: true,
      },
    });
  } catch (e) {
    console.error("vision-context error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
