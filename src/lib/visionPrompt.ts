// Build the Vision system prompt with all live context sources rendered.
import { PERSONA_MAP, type PersonaKey } from "./aiPersonas";

export interface VisionContext {
  intent?: any;
  emails?: { id: string; subject: string; from: string; date: string; snippet: string }[] | null;
  calendar?: { id: string; title: string; start: string; end?: string; meetLink?: string | null; attendees?: { email: string; name?: string }[] }[] | null;
  drive?: { id: string; name: string; mimeType: string; webViewLink?: string; contentPreview?: string }[] | null;
  contacts?: { name: string; email?: string | null; company?: string | null; role?: string | null; last_touched_at?: string | null }[];
  tasks?: { title: string; status?: string; priority?: string; due_at?: string | null }[];
  slack?: { channel: string; user: string; text: string; ts?: string }[] | null;
  kb?: { id: string; document_id: string; document_title: string; content: string }[];
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

  // Emails
  if (ctx.emails && ctx.emails.length) {
    lines.push(`\n📧 EMAILS (${ctx.emails.length}):`);
    for (const e of ctx.emails) {
      lines.push(`• [gmail:${e.id}] ${e.from} — "${e.subject}" (${e.date})\n  ${e.snippet}`);
    }
  }

  // Calendar
  if (ctx.calendar && ctx.calendar.length) {
    lines.push(`\n📅 CALENDAR (${ctx.calendar.length}):`);
    for (const ev of ctx.calendar) {
      const att = (ev.attendees ?? []).map((a) => a.name || a.email).filter(Boolean).slice(0, 5).join(", ");
      lines.push(`• ${fmtDate(ev.start)} — ${ev.title}${att ? ` | with ${att}` : ""}${ev.meetLink ? ` | Meet: ${ev.meetLink}` : ""}`);
    }
  }

  // Tasks
  if (ctx.tasks && ctx.tasks.length) {
    lines.push(`\n✅ OPEN TASKS (${ctx.tasks.length}):`);
    for (const t of ctx.tasks.slice(0, 8)) {
      lines.push(`• [${t.priority ?? "normal"}] ${t.title}${t.due_at ? ` (due ${fmtDate(t.due_at)})` : ""}`);
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
      lines.push(`• [drive:${f.id}] ${f.name}${f.contentPreview ? `\n  ${f.contentPreview}` : ""}`);
    }
  }

  // Slack
  if (ctx.slack && ctx.slack.length) {
    lines.push(`\n💬 SLACK:`);
    for (const m of ctx.slack) {
      lines.push(`• [slack:${m.channel}] #${m.channel} — ${m.user}: "${m.text}"`);
    }
  }

  // KB
  if (ctx.kb && ctx.kb.length) {
    lines.push(`\n📚 KNOWLEDGE BASE:`);
    for (const k of ctx.kb) {
      lines.push(`[kb:${k.document_id}] ${k.document_title}\n${k.content.slice(0, 600)}`);
    }
  }

  lines.push(`\n═══ END LIVE DATA ═══`);

  lines.push(`\nYou are Vision. Never refer to yourself as Claude, Anthropic, or any underlying model.
Cite sources naturally inline using these tokens (the UI renders them as clickable chips):
  [gmail:THREAD_ID|short label]   [drive:FILE_ID|name]   [kb:DOC_ID|title]
  [slack:channel|#channel]        [task:title]
Be specific. Be grounded in the data above. If a source isn't connected, don't pretend you saw it.`);

  return lines.join("\n");
}
