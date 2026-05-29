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
  contacts?: { name: string; email?: string | null; company?: string | null; role?: string | null; last_touched_at?: string | null }[];
  tasks?: { title: string; status?: string; priority?: string; due_at?: string | null; assignee_id?: string | null }[];
  chat?: { id: string; channel: string; user_id?: string | null; text: string; ts?: string }[] | null;
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
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const lines: string[] = [];
  lines.push(`You are Vision, ${userName}'s AI Chief of Staff, currently in the ${persona.name} ${persona.emoji} role.`);
  lines.push(persona.systemDescription);
  lines.push(`\nToday: ${today}${profile.timezone ? ` (${profile.timezone})` : ""}${profile.active_org_name ? ` | Active org: ${profile.active_org_name}` : ""}`);

  // Role-aware access scope
  if (profile.is_founder) {
    lines.push(
      `\n═══ ACCESS SCOPE ═══\nRole: Founder. You have full access across all connected orgs${
        profile.accessible_orgs?.length ? ` (${profile.accessible_orgs.join(", ")})` : ""
      }, all data, and all integrations.`
    );
  } else if (profile.role_label) {
    const orgList = profile.accessible_orgs?.length ? profile.accessible_orgs.join(", ") : (profile.active_org_name ?? "their org");
    lines.push(
      `\n═══ ACCESS SCOPE ═══\nRole: ${profile.role_label}. You work within: ${orgList}.\n` +
      `You can ONLY see data the user has access to: contacts, tasks, knowledge base, meetings, and events for the orgs above, plus their own connected Gmail/Calendar.\n` +
      `You CANNOT see: data from other orgs the user is not a member of, other team members' private Vision conversations, billing/admin settings, or the founder's personal mailbox.\n` +
      `If asked about restricted data, politely explain it isn't in scope and suggest asking an org owner.`
    );
  }

  lines.push(`\n═══ LIVE DATA ═══`);

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
    lines.push(`\n✅ OPEN TASKS (${ctx.tasks.length}):`);
    for (const t of ctx.tasks.slice(0, 12)) {
      lines.push(`• [${t.priority ?? "normal"}] ${t.title}${t.due_at ? ` (due ${fmtDate(t.due_at)})` : ""}${t.assignee_id ? ` (assigned)` : ""}`);
    }
  }

  // Chat
  if (ctx.chat && ctx.chat.length) {
    lines.push(`\n💬 RECENT CHAT (${ctx.chat.length}):`);
    for (const m of ctx.chat) {
      lines.push(`• #${m.channel} — "${m.text}"`);
    }
  }

  // Contacts
  if (ctx.contacts && ctx.contacts.length) {
    lines.push(`\n👥 CONTACTS:`);
    for (const c of ctx.contacts.slice(0, 6)) {
      const ds = daysSince(c.last_touched_at ?? null);
      lines.push(`• ${c.name}${c.role ? ` (${c.role}` : ""}${c.company ? `${c.role ? " @ " : " ("}${c.company}` : ""}${c.role || c.company ? ")" : ""}${ds !== null ? ` — ${ds}d since contact` : ""}`);
    }
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
    lines.push(`\n📚 KNOWLEDGE BASE:`);
    for (const k of ctx.kb) {
      lines.push(`[kb:${k.document_id}] ${k.document_title}\n${k.content.slice(0, 600)}`);
    }
  }

  lines.push(`\n═══ END LIVE DATA ═══`);

  if (isBrief) {
    lines.push(`\n═══ DAILY BRIEF MODE ═══
Produce a rich, opinionated morning brief in markdown with these sections — skip any section that has zero relevant data:

1. **☀️ Good morning, ${userName}** — one warm opening line tied to today's calendar shape (busy / focus day / light day) and the most important thing on their plate.
2. **📅 Today at a glance** — time-ordered list of meetings (personal + team). Call out conflicts, back-to-backs without buffer, missing prep docs, no lunch window, and the longest free block.
3. **📧 Inbox priorities** — group as **Urgent / needs reply today**, **Waiting on you**, and **FYI**. Sort by the importance score in the data. Cite each [gmail:ID].
4. **✅ Top 3 priorities** — pick from open tasks weighted by due date + priority + meeting prep. Be opinionated about the *order*.
5. **💬 Team pulse** — what teammates said in chat (last 24h) + their key meetings. Surface anything blocking the user.
6. **👥 Relationships** — 1-2 contacts going cold (no touch in 14+ days) worth a ping today.
7. **📚 From your knowledge** — if a relevant KB doc or recent Drive file matches today's meetings or tasks, surface it as a "you may want to re-read" link. Cite [kb:ID] / [drive:ID].
8. **🎯 Suggested next actions** — 2-3 concrete moves (draft this reply, block focus time at X, follow up with Y). Be specific, not generic.

Keep each section scannable. Use bullets, not paragraphs. Never invent data — if a source is empty, omit the section.`);
  }

  if (isScheduling) {
    lines.push(`\n═══ SCHEDULING MODE ═══
The user is asking about scheduling. Combine personal + team calendar data above to:
- Identify free windows in working hours (default 9–17 local) over the requested timeframe.
- Respect existing meetings, lunch (12–13 local), and back-to-back fatigue — suggest 10-min buffers between meetings.
- For "find time with X": flag attendee conflicts explicitly and propose 2-3 specific date+time options ranked best-first.
- For "reschedule / move / cancel": identify the exact event, then propose the action clearly and ask for confirmation before any change is made.
- For "when am I free this week": return a compact list of free windows by day.
Always describe title / attendees / time / duration before you'd create or modify anything — wait for the user to confirm.`);
  }

  lines.push(`\nYou are Vision. Never refer to yourself as Claude, Anthropic, or any underlying model.
Cite sources naturally inline using these tokens (UI renders them as clickable chips):
  [gmail:THREAD_ID|short label]   [drive:FILE_ID|name]   [kb:DOC_ID|title]
  [slack:channel|#channel]        [task:title]
Be specific. Be grounded in the data above. If a source isn't connected, say so — never invent.`);

  return lines.join("\n");
}

