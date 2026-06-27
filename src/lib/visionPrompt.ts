// Build the Vision system prompt with all live context sources rendered.
import { PERSONA_MAP, type PersonaKey } from "./aiPersonas";

export interface VisionContext {
  intent?: any;
  emails?: { id: string; subject: string; from: string; date: string; snippet: string; unread?: boolean; starred?: boolean }[] | null;
  calendar?: { id: string; title: string; start: string; end?: string; meetLink?: string | null; location?: string | null; description?: string | null; attendees?: { email: string; name?: string; status?: string }[]; source?: "google" | "team"; org_id?: string | null }[] | null;
  team_calendar?: { id: string; title: string; start: string; end?: string; org_id?: string | null; created_by?: string | null }[] | null;
  team_per_member?: { user_id: string; name: string; busy_count: number; busy: { start: string; end?: string; title: string }[] }[];
  team_conflicts?: { start: string; end: string; members: string[]; titles: string[] }[];
  team_open_slots?: { start: string; end: string; minutes: number }[];
  drive?: { id: string; name: string; mimeType: string; webViewLink?: string; modifiedTime?: string; lastModifiedBy?: string | null; contentPreview?: string | null }[] | null;
  contacts?: { id?: string; name: string; email?: string | null; company?: string | null; role?: string | null; last_touched_at?: string | null; engagement_stage?: string | null; linkedin_url?: string | null; notes?: string | null; buckets?: string[] }[];
  tasks?: { id?: string; title: string; status?: string; priority?: string; due_at?: string | null; start_date?: string | null; assignee_id?: string | null; org_id?: string | null; project?: { name?: string; emoji?: string } | null; buckets?: string[] }[];
  chat?: { id: string; channel: string; is_dm?: boolean; user_id?: string | null; thread_id?: string | null; text: string; ts?: string; buckets?: string[] }[] | null;
  slack?: { channel: string; user: string; text: string; ts?: string }[] | null;
  kb?: { id: string; document_id: string; document_title: string; content: string; source_type?: string | null; source_integration?: string | null; source_url?: string | null; category?: string | null; file_type?: string | null; updated_at?: string | null; score?: number | null }[];
  today_busy?: { start: string; end: string; title: string }[];
  today_free?: { start: string; end: string; minutes: number }[];
  sources?: Record<string, boolean>;
}

export interface VisionProfile {
  display_name?: string | null;
  preferred_name?: string | null;
  email?: string | null;
  timezone?: string | null;
  active_org_name?: string | null;
  role_label?: string | null;            // "Founder" | "Org Admin" | "Team Member" | "Read-only"
  is_founder?: boolean;
  accessible_orgs?: string[];            // org names this user can access
  // New VisionAI settings
  vision_display_name?: string | null;   // What the AI calls itself (e.g. "Vision", "Athena")
  vision_persona_description?: string | null; // User-authored persona override
  vision_tone?: string | null;           // direct | formal | friendly | casual | playful
  brief_time?: string | null;            // HH:MM, user's preferred morning brief slot
  brief_to_channel?: boolean;            // Mirror brief into #dailyreports
  brief_to_inbox?: boolean;              // (Reserved) email the brief
}

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  catch { return iso; }
}

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function buildVisionSystemPrompt(personaKey: PersonaKey, ctx: VisionContext, profile: VisionProfile): string {
  const persona = PERSONA_MAP[personaKey];
  const userName = profile.preferred_name || profile.display_name || "the user";
  const firstName = userName.split(" ")[0];
  const now = new Date();
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
  const formattedDate = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const currentTime = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const orgNames = profile.accessible_orgs ?? [];
  const aiName = (profile.vision_display_name || "Vision").trim();
  const toneKey = (profile.vision_tone || "direct").toLowerCase();
  const toneInstruction: Record<string, string> = {
    direct: "Be terse and outcome-driven. Short sentences. No filler.",
    formal: "Use professional, polished phrasing. No slang.",
    friendly: "Warm and conversational, but still concise.",
    casual: "Relaxed, plainspoken, light contractions are fine.",
    playful: "Light wit is welcome; never sacrifice clarity for jokes.",
  };

  const lines: string[] = [];
  lines.push(`You are ${aiName}, the AI chief of staff for ${userName}. You are currently in the ${persona.name} ${persona.emoji} role.`);
  lines.push(persona.systemDescription);
  if (profile.vision_persona_description && profile.vision_persona_description.trim()) {
    lines.push(`\n═══ CUSTOM PERSONA (from ${firstName}'s settings) ═══\n${profile.vision_persona_description.trim()}`);
  }
  lines.push(`\nTone: ${toneInstruction[toneKey] ?? toneInstruction.direct}`);


  if (profile.is_founder) {
    lines.push(`\nYou support ${userName} as the founder of: ${orgNames.length ? orgNames.join(", ") : (profile.active_org_name ?? "their organizations")}.`);
  } else if (profile.role_label) {
    lines.push(`\nYou are the AI assistant for ${userName} at ${profile.active_org_name ?? (orgNames[0] ?? "their org")}. Role: ${profile.role_label}.`);
  }

  lines.push(`\nToday is ${dayOfWeek}, ${formattedDate}. Current time: ${currentTime}${profile.timezone ? ` (${profile.timezone})` : ""}.`);

  // Access scope guardrails for non-founders
  if (!profile.is_founder && profile.role_label) {
    const orgList = orgNames.length ? orgNames.join(", ") : (profile.active_org_name ?? "their org");
    lines.push(
      `\n═══ ACCESS SCOPE ═══\nYou work within: ${orgList}.\n` +
      `You can ONLY see data the user has access to: contacts, tasks, knowledge base, meetings, and events for the orgs above, plus their own connected Gmail/Calendar.\n` +
      `You CANNOT see: data from other orgs the user is not a member of, other team members' private Vision conversations, billing/admin settings, or the founder's personal mailbox.\n` +
      `If asked about restricted data, politely explain it isn't in scope and suggest asking an org owner.`
    );
  }

  lines.push(`\n═══ YOUR LIVE CONTEXT ═══`);

  const isBrief = !!ctx.intent?.isDailyBrief;
  const isScheduling = !!ctx.intent?.isSchedulingRequest;


  // Emails
  if (ctx.emails && ctx.emails.length) {
    const unread = ctx.emails.filter((e) => e.unread).length;
    lines.push(`\n📧 EMAILS (${ctx.emails.length}${unread ? `, ${unread} unread` : ""}):`);
    for (const e of ctx.emails) {
      const flags = [e.unread ? "UNREAD" : "", e.starred ? "★" : ""].filter(Boolean).join(" ");
      lines.push(`• [gmail:${e.id}] ${flags ? flags + " · " : ""}${e.from} — "${e.subject}" (${e.date})\n  ${e.snippet}`);
    }
  }

  // Calendar (merged personal + team)
  if (ctx.calendar && ctx.calendar.length) {
    lines.push(`\n📅 CALENDAR (${ctx.calendar.length}):`);
    for (const ev of ctx.calendar) {
      const att = (ev.attendees ?? []).map((a) => a.name || a.email).filter(Boolean).slice(0, 5).join(", ");
      const tag = ev.source === "team" ? " [team]" : "";
      const loc = ev.location ? ` @ ${ev.location}` : "";
      const desc = ev.description ? `\n  note: ${ev.description}` : "";
      lines.push(`• ${fmtDate(ev.start)}${ev.end ? `–${fmtDate(ev.end)}` : ""}${tag} — ${ev.title}${loc}${att ? ` | with ${att}` : ""}${ev.meetLink ? ` | Meet: ${ev.meetLink}` : ""}${desc}`);
    }
  }

  // Today's free/busy summary (working hours)
  if (ctx.today_busy && ctx.today_busy.length) {
    lines.push(`\n⏱ TODAY BUSY (9–17):`);
    for (const b of ctx.today_busy) lines.push(`• ${fmtDate(b.start)}–${fmtDate(b.end)} — ${b.title}`);
  }
  if (ctx.today_free && ctx.today_free.length) {
    lines.push(`\n🟢 TODAY FREE WINDOWS (9–17, ≥15min):`);
    for (const f of ctx.today_free) lines.push(`• ${fmtDate(f.start)}–${fmtDate(f.end)} (${f.minutes} min)`);
  }

  // Team availability (per-member load, conflicts, open team slots)
  if (ctx.team_per_member && ctx.team_per_member.length) {
    lines.push(`\n👥 TEAM LOAD TODAY:`);
    for (const m of ctx.team_per_member) {
      lines.push(`• ${m.name}: ${m.busy_count} event${m.busy_count === 1 ? "" : "s"}`);
    }
  }
  if (ctx.team_conflicts && ctx.team_conflicts.length) {
    lines.push(`\n⚠️ TEAM CONFLICTS (≥2 members busy):`);
    for (const c of ctx.team_conflicts.slice(0, 8)) {
      lines.push(`• ${fmtDate(c.start)}–${fmtDate(c.end)} — ${c.titles.join(" / ")}`);
    }
  }
  if (ctx.team_open_slots && ctx.team_open_slots.length) {
    lines.push(`\n🟩 TEAM-WIDE OPEN SLOTS TODAY (everyone free, 9–17):`);
    for (const s of ctx.team_open_slots.slice(0, 8)) {
      lines.push(`• ${fmtDate(s.start)}–${fmtDate(s.end)} (${s.minutes} min)`);
    }
  }

  // Tasks
  if (ctx.tasks && ctx.tasks.length) {
    const byBucket = (b: string) => ctx.tasks!.filter((t) => t.buckets?.includes(b));
    const overdue = byBucket("overdue");
    const dueToday = byBucket("due_today");
    const high = byBucket("high_priority").filter((t) => !t.buckets?.includes("overdue") && !t.buckets?.includes("due_today"));
    const mentioned = byBucket("mentioned");
    const sched = byBucket("needs_scheduling");
    const rest = ctx.tasks.filter((t) => !t.buckets || t.buckets.every((b) => !["overdue","due_today","high_priority","mentioned","needs_scheduling"].includes(b)));

    const renderTask = (t: any) => {
      const proj = t.project?.name ? ` ${t.project.emoji ?? ""}${t.project.name}` : "";
      const due = t.due_at ? ` (due ${fmtDate(t.due_at)})` : "";
      const id = t.id ? `[task:${t.id}] ` : "";
      return `• ${id}[${t.priority ?? "normal"}] ${t.title}${proj}${due}`;
    };

    lines.push(`\n✅ TASKS (${ctx.tasks.length}):`);
    if (overdue.length) { lines.push(`  ⏰ Overdue (${overdue.length}):`); overdue.slice(0, 8).forEach((t) => lines.push("  " + renderTask(t))); }
    if (dueToday.length) { lines.push(`  📅 Due today (${dueToday.length}):`); dueToday.slice(0, 8).forEach((t) => lines.push("  " + renderTask(t))); }
    if (high.length) { lines.push(`  🔥 High/urgent priority (${high.length}):`); high.slice(0, 6).forEach((t) => lines.push("  " + renderTask(t))); }
    if (mentioned.length) { lines.push(`  👥 Involving mentioned people (${mentioned.length}):`); mentioned.slice(0, 6).forEach((t) => lines.push("  " + renderTask(t))); }
    if (sched.length) { lines.push(`  🗓 Could be scheduled (${sched.length}):`); sched.slice(0, 6).forEach((t) => lines.push("  " + renderTask(t))); }
    if (rest.length) { lines.push(`  📝 Other open (${rest.length}):`); rest.slice(0, 8).forEach((t) => lines.push("  " + renderTask(t))); }
  }

  // Chat
  if (ctx.chat && ctx.chat.length) {
    const mentions = ctx.chat.filter((m) => m.buckets?.includes("mention"));
    const dms = ctx.chat.filter((m) => m.buckets?.includes("dm") && !m.buckets.includes("mention"));
    const threads = ctx.chat.filter((m) => m.buckets?.includes("thread_reply") && !m.buckets.includes("mention") && !m.buckets.includes("dm"));
    const rest = ctx.chat.filter((m) => !m.buckets?.some((b) => ["mention", "dm", "thread_reply"].includes(b)));
    const render = (m: any) => `  • #${m.channel}${m.thread_id ? " (thread)" : ""} — "${m.text}" (${fmtDate(m.ts)})`;
    lines.push(`\n💬 CHAT (${ctx.chat.length}):`);
    if (mentions.length) { lines.push(`  @ Mentions of you (${mentions.length}):`); mentions.slice(0, 8).forEach((m) => lines.push(render(m))); }
    if (dms.length) { lines.push(`  ✉️ DMs (${dms.length}):`); dms.slice(0, 6).forEach((m) => lines.push(render(m))); }
    if (threads.length) { lines.push(`  🧵 Thread replies (${threads.length}):`); threads.slice(0, 6).forEach((m) => lines.push(render(m))); }
    if (rest.length) { lines.push(`  📨 Other recent (${rest.length}):`); rest.slice(0, 8).forEach((m) => lines.push(render(m))); }
  }

  // Contacts
  if (ctx.contacts && ctx.contacts.length) {
    const mentioned = ctx.contacts.filter((c) => c.buckets?.includes("mentioned"));
    const todayEv = ctx.contacts.filter((c) => c.buckets?.includes("today_event") && !c.buckets.includes("mentioned"));
    const stale = ctx.contacts.filter((c) => c.buckets?.includes("stale") && !c.buckets.includes("mentioned") && !c.buckets.includes("today_event"));
    const rest = ctx.contacts.filter((c) => !c.buckets?.some((b) => ["mentioned","today_event","stale"].includes(b)));
    const renderC = (c: any) => {
      const ds = daysSince(c.last_touched_at ?? null);
      const role = [c.role, c.company].filter(Boolean).join(" @ ");
      const meta = [role, c.engagement_stage, ds !== null ? `${ds}d since touch` : ""].filter(Boolean).join(" · ");
      const notes = c.notes ? `\n    note: ${String(c.notes).slice(0, 120)}` : "";
      return `  • ${c.name}${c.email ? ` <${c.email}>` : ""}${meta ? ` — ${meta}` : ""}${notes}`;
    };
    lines.push(`\n👥 CONTACTS (${ctx.contacts.length}):`);
    if (mentioned.length) { lines.push(`  🎯 Mentioned (${mentioned.length}):`); mentioned.slice(0, 6).forEach((c) => lines.push(renderC(c))); }
    if (todayEv.length) { lines.push(`  📅 On today's calendar (${todayEv.length}):`); todayEv.slice(0, 6).forEach((c) => lines.push(renderC(c))); }
    if (stale.length) { lines.push(`  🧊 Going cold — 30+ days no touch (${stale.length}):`); stale.slice(0, 6).forEach((c) => lines.push(renderC(c))); }
    if (rest.length) { lines.push(`  ↪ Recent (${rest.length}):`); rest.slice(0, 4).forEach((c) => lines.push(renderC(c))); }
  }

  // Drive
  if (ctx.drive && ctx.drive.length) {
    lines.push(`\n📁 DRIVE FILES:`);
    for (const f of ctx.drive) {
      const meta = [f.modifiedTime ? `modified ${fmtDate(f.modifiedTime)}` : "", f.lastModifiedBy ? `by ${f.lastModifiedBy}` : ""].filter(Boolean).join(" ");
      lines.push(`• [drive:${f.id}] ${f.name}${meta ? ` (${meta})` : ""}${f.contentPreview ? `\n  ${f.contentPreview}` : ""}`);
    }
  }

  // Slack (legacy)
  if (ctx.slack && ctx.slack.length) {
    lines.push(`\n💬 SLACK:`);
    for (const m of ctx.slack) lines.push(`• [slack:${m.channel}] #${m.channel} — ${m.user}: "${m.text}"`);
  }

  // KB
  if (ctx.kb && ctx.kb.length) {
    lines.push(`\n📚 KNOWLEDGE BASE (${ctx.kb.length}):`);
    for (const k of ctx.kb) {
      const meta = [
        k.source_integration ?? k.source_type,
        k.category,
        k.file_type,
        k.updated_at ? `updated ${fmtDate(k.updated_at)}` : "",
      ].filter(Boolean).join(" · ");
      const url = k.source_url ? `\n  url: ${k.source_url}` : "";
      lines.push(`• [kb:${k.document_id}] ${k.document_title}${meta ? ` (${meta})` : ""}${url}\n  ${k.content.slice(0, 600)}`);
    }
  }

  lines.push(`\n═══ END LIVE CONTEXT ═══`);

  // YOUR CAPABILITIES — agent actions
  lines.push(`
═══ YOUR CAPABILITIES ═══
You can take real actions when asked. Return the action as a fenced JSON block at the END of your response:
\`\`\`json
{"action": "<name>", "payload": { ... }}
\`\`\`

Available actions:
- 📅 **openAddEvent** — Open the Add Event modal pre-filled. payload: { title, date?, time?, durationMins?, attendees?: string[], suggestedTimes?: string[], location?, notes? }
- ✅ **createTask** — Create a task in the user's task list. payload: { title, description?, due_at?, priority?: "urgent"|"high"|"normal"|"low", project_id?, org_id?, assignee_id? }
- 📧 **draftEmail** — Open Gmail compose pre-filled. payload: { to: string[], cc?: string[], subject, body, threadId? }
- 🔍 **searchDrive** — Search Google Drive for files. payload: { query, mimeType? }
- 📋 **openDriveFile** — Open a specific Drive file. payload: { fileId, name? }
- 👥 **findTime** — Open the Find a Time modal. payload: { attendees: string[], durationMins?, timeframe?: "today"|"this_week"|"next_week" }

Only emit an action when the user explicitly asks for it or your response clearly calls for it. Always describe what you're about to do in plain English BEFORE the JSON block.`);

  // CALENDAR SCHEDULING COMMANDS
  if (isScheduling || isBrief) {
    lines.push(`
═══ CALENDAR SCHEDULING COMMANDS ═══
When the user asks to schedule something:
1. Check the calendar context above for conflicts at the requested time.
2. Check team calendar for attendee availability (TEAM LOAD / TEAM CONFLICTS / TEAM-WIDE OPEN SLOTS).
3. If there is a conflict: suggest the next 3 free slots from TODAY FREE WINDOWS or TEAM-WIDE OPEN SLOTS.
4. Return action: openAddEvent with all known fields pre-filled.

Patterns:
- "Schedule a call with X [day] at [time]" → If both free → openAddEvent. If conflict → "You have [event] at [time]. X is free at [alt1] and [alt2] — which works?"
- "When is X free this week?" → Read team_per_member + team_calendar entries for that person → "X is free Tue 10–12, Wed afternoon after 2pm, Fri all day."
- "Find a time for the whole team" → Read team_open_slots → "Everyone is free: [slots]." Then action: findTime.
- "What's on the team calendar today?" → Filter team_calendar to today, group by person.
- "Reschedule / move / cancel" → Identify the exact event, describe the change, and wait for confirmation before emitting an action.`);
  }

  // DAILY BRIEF FORMAT
  if (isBrief) {
    lines.push(`
═══ DAILY BRIEF MODE ═══
Respond in this EXACT structure (skip any section with zero relevant data):

Good morning, ${firstName}. Here's your ${dayOfWeek} brief.

📅 **Today's Schedule**
- [Time-ordered list of today's events with attendees]
- [Note any team members with relevant events]

📧 **Email Highlights**
- [Top 3–5 emails that need attention, one-line summaries, cite [gmail:ID]]
- [Flag anything urgent or from key contacts]

✅ **Priority Tasks**
- [Overdue items first — be direct about what's late, cite [task:ID]]
- [Due today]
- [Top 3 high-priority items]

💬 **Slack / Chat Catchup**
- [Unread @mentions and important threads]

📁 **Drive Activity**
- [Files modified by team members in last 24h, cite [drive:ID]]
- [Any docs that seem relevant to today's meetings]

👥 **Relationship Nudges**
- [Contacts not touched in 30+ days who are relevant this week]
- [People in today's meetings — quick context]

🎯 **Vision's Take**
[2–3 sentences: the highest-leverage thing to focus on today, based on everything above. Be opinionated.]

Maximum 4 bullets per section. Lead with what matters most. Never invent data — omit empty sections.`);
  }

  // RULES
  lines.push(`
═══ RULES ═══
- Always cite sources inline using these clickable tokens: [gmail:THREAD_ID|label], [📅 event title], [drive:FILE_ID|name], [kb:DOC_ID|title], [task:ID|title], [slack:channel|#channel].
- Never make up information — only reference what is in YOUR LIVE CONTEXT above.
- If a data source isn't connected, say: "I don't have access to [source] yet — connect it in Settings → Connections."
- For scheduling: always check availability BEFORE confirming a time.
- For Drive files: always include the link when referencing a specific doc.
- Be direct and brief — ${firstName} is a founder, not a reader.
- Use org color context: UWAZI (blue), BIN (red), Culture Club (green).
- You are Vision. Never refer to yourself as Claude, Anthropic, GPT, OpenAI, Gemini, Google, or any underlying model.`);

  return lines.join("\n");
}


