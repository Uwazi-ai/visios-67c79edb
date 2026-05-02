// Build the Claude system prompt from persona, training data, org context, and KB hits.
import { PERSONA_MAP, type PersonaKey } from "./aiPersonas";

export interface AIContextSnapshot {
  profile?: {
    display_name?: string | null;
    preferred_name?: string | null;
    email?: string | null;
    timezone?: string | null;
    title?: string | null;
    company?: string | null;
  } | null;
  training?: {
    writing_style?: string;
    signature_style?: string;
    response_length?: string;
    never_say?: string | null;
    sample_emails?: string[];
    org_context?: Record<string, string>;
    workflow_notes?: Record<string, string>;
    canned_responses?: { title: string; body: string }[];
  } | null;
  events?: { title: string; start_at: string; end_at?: string; attendees?: unknown }[];
  tasks?: { title: string; status?: string; priority?: string; due_at?: string | null }[];
  contacts?: { name: string; company?: string | null; role?: string | null; email?: string | null; last_touched_at?: string | null }[];
  citations?: { id: string; document_id: string; title: string; snippet: string }[];
  today: string;
  active_org_name?: string | null;
}

export function buildSystemPrompt(personaKey: PersonaKey, ctx: AIContextSnapshot, options?: { surface?: string }): string {
  const persona = PERSONA_MAP[personaKey];
  const userName = ctx.profile?.preferred_name || ctx.profile?.display_name || "the user";
  const today = new Date(ctx.today).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const sections: string[] = [];

  sections.push(`You are Visi, ${userName}'s AI assistant, currently in the ${persona.name} ${persona.emoji} role.`);
  sections.push(persona.systemDescription);

  sections.push(`\n=== CONTEXT ===\nToday is ${today}.${ctx.profile?.timezone ? ` Timezone: ${ctx.profile.timezone}.` : ""}${ctx.active_org_name ? ` Active org: ${ctx.active_org_name}.` : ""}${options?.surface ? ` User is currently on the ${options.surface} screen.` : ""}`);

  if (ctx.events && ctx.events.length > 0) {
    sections.push(`\nToday's calendar:\n${ctx.events.map((e) => `- ${new Date(e.start_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} — ${e.title}`).join("\n")}`);
  }

  if (ctx.tasks && ctx.tasks.length > 0) {
    const open = ctx.tasks.filter((t) => t.status !== "done");
    sections.push(`\nOpen tasks (${open.length}):\n${open.slice(0, 8).map((t) => `- [${t.priority ?? "normal"}] ${t.title}${t.due_at ? ` (due ${new Date(t.due_at).toLocaleDateString()})` : ""}`).join("\n")}`);
  }

  if (ctx.contacts && ctx.contacts.length > 0) {
    sections.push(`\nRecent contacts:\n${ctx.contacts.slice(0, 5).map((c) => `- ${c.name}${c.role ? `, ${c.role}` : ""}${c.company ? ` @ ${c.company}` : ""}`).join("\n")}`);
  }

  if (ctx.training) {
    const t = ctx.training;
    const tParts: string[] = [];
    if (t.writing_style) tParts.push(`Writing style: ${t.writing_style}`);
    if (t.signature_style) tParts.push(`Sign as: ${t.signature_style}`);
    if (t.response_length) tParts.push(`Response length: ${t.response_length}`);
    if (t.never_say) tParts.push(`NEVER say: ${t.never_say}`);
    if (t.sample_emails && t.sample_emails.length > 0) {
      tParts.push(`Voice samples:\n${t.sample_emails.slice(0, 3).map((s, i) => `[Sample ${i + 1}] ${s.slice(0, 400)}`).join("\n---\n")}`);
    }
    if (t.org_context && Object.keys(t.org_context).length > 0) {
      tParts.push(`Organizations:\n${Object.entries(t.org_context).map(([k, v]) => `${k}: ${v}`).join("\n")}`);
    }
    if (tParts.length > 0) sections.push(`\n=== USER TRAINING ===\n${tParts.join("\n\n")}`);
  }

  if (ctx.citations && ctx.citations.length > 0) {
    sections.push(`\n=== KNOWLEDGE BASE EXCERPTS ===\nWhen you use information from these excerpts, cite the document inline like [Source: <Doc Title>].\n\n${ctx.citations.map((c) => `[${c.title}]\n${c.snippet}`).join("\n\n---\n\n")}`);
  }

  sections.push(`\nRespond as ${persona.name}. Be honest, useful, and brief unless the user asks for depth.`);

  return sections.join("\n");
}

export function getQuickActions(surface: string): string[] {
  switch (surface) {
    case "/":
    case "/dashboard":
      return ["Brief me on today", "What's most urgent?", "Plan my week"];
    case "/contacts":
      return ["Draft a follow-up", "Who should I reach out to?", "Summarize recent contacts"];
    case "/calendar":
    case "/meetings":
      return ["Prep for my next meeting", "What's on my plate today?", "Find me focus time"];
    case "/inbox":
      return ["Draft a reply", "Summarize unread", "What needs urgent reply?"];
    case "/tasks":
      return ["What should I do next?", "Re-prioritize my tasks", "Break down a task"];
    case "/knowledge":
      return ["Summarize a doc", "Find me an SOP", "What's in my KB?"];
    default:
      return ["Brief me", "What's urgent?", "Help me think"];
  }
}
