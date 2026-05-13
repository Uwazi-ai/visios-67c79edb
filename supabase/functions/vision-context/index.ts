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
  timeframe: "today" | "week" | "month" | "general";
}

const DEFAULT_INTENT: Intent = {
  needsEmails: false, needsCalendar: false, needsDrive: false, needsKnowledge: false,
  needsTasks: false, needsChat: false, needsContacts: false, needsTeamCalendar: false,
  isDailyBrief: false, isSchedulingRequest: false,
  mentionedPerson: null, mentionedCompany: null, mentionedPeople: [],
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
      needsTeamCalendar: parsed.needsTeamCalendar ?? fallback.needsTeamCalendar,
    };
  } catch {
    return fallback;
  }
}

function header(msg: any, name: string): string {
  return msg?.payload?.headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function fetchEmails(userId: string, intent: Intent) {
  try {
    const token = await getFreshGoogleAccessToken(userId);
    let q = "newer_than:2d -category:promotions -category:social";
    if (intent.isDailyBrief) q = "newer_than:2d is:unread -category:promotions -category:social";
    if (intent.mentionedPerson) q = `(from:${intent.mentionedPerson} OR to:${intent.mentionedPerson}) newer_than:30d`;
    const max = intent.isDailyBrief ? 12 : 8;
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
      return {
        id: t.id,
        subject: header(msg, "Subject"),
        from: header(msg, "From"),
        date: header(msg, "Date"),
        snippet: (msg?.snippet ?? "").slice(0, 220),
        unread: labels.includes("UNREAD"),
        starred: labels.includes("STARRED"),
      };
    }));
    return detailed.filter(Boolean);
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
    const { data } = await admin.from("events")
      .select("id, title, start_at, end_at, org_id, created_by, visibility, meet_link, attendees")
      .or(`org_id.in.(${orgIds.join(",")}),created_by.eq.${userId},visibility.eq.all_orgs`)
      .gte("start_at", timeMin.toISOString())
      .lte("start_at", timeMax.toISOString())
      .order("start_at", { ascending: true })
      .limit(40);
    return (data ?? []).map((e: any) => ({
      id: e.id,
      title: e.title,
      start: e.start_at,
      end: e.end_at,
      meetLink: e.meet_link,
      org_id: e.org_id,
      created_by: e.created_by,
      visibility: e.visibility,
      attendees: e.attendees ?? [],
      source: "team" as const,
    }));
  } catch (e) {
    console.warn("fetchTeamCalendar failed", e);
    return null;
  }
}

async function fetchDrive(userId: string, query: string, folderIds: string[]) {
  if (!folderIds.length) return null;
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

async function fetchTasks(admin: any, userId: string, orgIds: string[], intent: Intent) {
  try {
    let q = admin.from("tasks").select("title, status, priority, due_at, assignee_id, org_id")
      .neq("status", "done")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(intent.isDailyBrief ? 15 : 10);
    if (orgIds.length) q = q.in("org_id", orgIds);
    const { data } = await q;
    return data ?? [];
  } catch (e) { console.warn("fetchTasks failed", e); return []; }
}

async function fetchContacts(admin: any, orgIds: string[], intent: Intent) {
  try {
    let q = admin.from("contacts")
      .select("name, email, company, role, last_touched_at, engagement_stage, org_id")
      .order("last_touched_at", { ascending: false, nullsFirst: false })
      .limit(8);
    if (orgIds.length) q = q.in("org_id", orgIds);
    if (intent.mentionedPerson) q = q.ilike("name", `%${intent.mentionedPerson}%`);
    else if (intent.mentionedCompany) q = q.ilike("company", `%${intent.mentionedCompany}%`);
    const { data } = await q;
    return data ?? [];
  } catch (e) { console.warn("fetchContacts failed", e); return []; }
}

async function fetchKnowledge(admin: any, userId: string, orgIds: string[], query: string) {
  try {
    if (!query || query.length < 4) return [];
    const out: any[] = [];
    for (const oid of orgIds.length ? orgIds : [null]) {
      const { data } = await admin.rpc("search_kb_text", {
        query_text: query,
        org_filter: oid,
        user_filter: userId,
        match_count: 4,
      });
      if (data) out.push(...data);
    }
    return out.slice(0, 6);
  } catch (e) { console.warn("fetchKnowledge failed", e); return []; }
}

async function fetchChat(admin: any, userId: string, orgIds: string[], intent: Intent) {
  if (!orgIds.length && !intent.isDailyBrief) return [];
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let q = admin.from("messages")
      .select("id, channel_id, content, user_id, created_at, org_id, channels(name, is_dm)")
      .gte("created_at", since)
      .neq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(intent.isDailyBrief ? 15 : 8);
    if (orgIds.length) q = q.in("org_id", orgIds);
    const { data } = await q;
    return (data ?? []).map((m: any) => ({
      id: m.id,
      channel: m.channels?.name ?? (m.channels?.is_dm ? "dm" : "channel"),
      user_id: m.user_id,
      text: (m.content ?? "").slice(0, 240),
      ts: m.created_at,
    }));
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
    const wantDrive = driveOn && intent.needsDrive && driveFolderIds.length > 0;
    const wantTasks = intent.needsTasks || intent.isDailyBrief;
    const wantChat = intent.needsChat || intent.isDailyBrief;
    const wantContacts = intent.needsContacts || intent.mentionedPeople.length > 0 || !!intent.mentionedPerson;
    const wantKB = intent.needsKnowledge;

    const [emailsR, calendarR, teamCalR, driveR, tasksR, contactsR, kbR, chatR] = await Promise.allSettled([
      wantEmails ? fetchEmails(user.id, intent) : Promise.resolve(null),
      wantCalendar ? fetchGoogleCalendar(user.id, intent) : Promise.resolve(null),
      wantTeamCal ? fetchTeamCalendar(admin, user.id, orgIds, intent) : Promise.resolve(null),
      wantDrive ? fetchDrive(user.id, userMessage, driveFolderIds) : Promise.resolve(null),
      wantTasks ? fetchTasks(admin, user.id, orgIds, intent) : Promise.resolve([]),
      wantContacts ? fetchContacts(admin, orgIds, intent) : Promise.resolve([]),
      wantKB ? fetchKnowledge(admin, user.id, orgIds, userMessage) : Promise.resolve([]),
      wantChat ? fetchChat(admin, user.id, orgIds, intent) : Promise.resolve([]),
    ]);

    const pick = <T,>(r: PromiseSettledResult<T>): T | null => r.status === "fulfilled" ? r.value : null;
    const calendarVal = pick(calendarR) ?? [];
    const teamCalVal = pick(teamCalR) ?? [];
    // Merge & de-dupe team + google calendar events (by google_event_id when present)
    const seen = new Set<string>();
    const mergedCalendar: any[] = [];
    for (const e of [...(calendarVal as any[]), ...(teamCalVal as any[])]) {
      const k = e?.id ?? "";
      if (k && seen.has(k)) continue;
      seen.add(k);
      mergedCalendar.push(e);
    }
    mergedCalendar.sort((a, b) => String(a.start ?? "").localeCompare(String(b.start ?? "")));

    return jsonResponse({
      intent,
      emails: pick(emailsR),
      calendar: mergedCalendar,
      team_calendar: teamCalVal,
      drive: pick(driveR),
      contacts: pick(contactsR) ?? [],
      tasks: pick(tasksR) ?? [],
      chat: pick(chatR) ?? [],
      kb: pick(kbR) ?? [],
      org_ids: orgIds,
      sources: {
        gmail: gmailOn, calendar: calendarOn, team_calendar: orgIds.length > 0,
        drive: driveOn && driveFolderIds.length > 0, kb: true, contacts: true,
        tasks: true, chat: true,
      },
    });
  } catch (e) {
    console.error("vision-context error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
