// Vision (Sprint 03) — persona loading, context assembly, and the untrusted-data
// boundary. Everything here runs server-side; no persona text or key reaches
// the browser.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function authedUser(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  return data?.user ?? null;
}

/** Org ids the user actually belongs to. Scope is intersected with this, always. */
export async function memberOrgIds(userId: string): Promise<string[]> {
  const db = admin();
  const [a, b] = await Promise.all([
    db.from("org_memberships").select("org_id").eq("user_id", userId),
    db.from("org_members").select("org_id").eq("user_id", userId),
  ]);
  const ids = new Set<string>();
  for (const r of (a.data ?? []) as any[]) ids.add(r.org_id);
  for (const r of (b.data ?? []) as any[]) ids.add(r.org_id);
  return [...ids];
}

/* ------------------------------------------------------------------ *
 * Personas
 * ------------------------------------------------------------------ */

export interface Persona {
  key: string;
  display_name: string;
  system_prompt: string;
  allowed_tools: string[];
}

/**
 * An org-specific row wins over the global one. A persona the org has
 * deactivated falls back to global rather than vanishing mid-conversation.
 */
export async function loadPersona(key: string, orgId: string | null): Promise<Persona> {
  const db = admin();
  const { data } = await db
    .from("personas")
    .select("key,display_name,system_prompt,allowed_tools,org_id,is_active")
    .eq("key", key)
    .eq("is_active", true);
  const rows = (data ?? []) as any[];
  const scoped = orgId ? rows.find((r) => r.org_id === orgId) : undefined;
  const global = rows.find((r) => r.org_id === null);
  const row = scoped ?? global;
  if (!row) {
    return {
      key,
      display_name: "Vision",
      system_prompt:
        "You are Vision, the AI chief of staff inside Kova. You never refer to yourself as any other product, model, company or assistant name.",
      allowed_tools: [],
    };
  }
  return {
    key: row.key,
    display_name: row.display_name,
    system_prompt: row.system_prompt,
    allowed_tools: row.allowed_tools ?? [],
  };
}

/* ------------------------------------------------------------------ *
 * Untrusted data boundary
 * ------------------------------------------------------------------ */

/**
 * Everything the operator did not type is third-party text: mail bodies,
 * document extracts, contact notes, event descriptions. It is fenced and
 * labelled so an instruction hidden inside a supplier's email reads as
 * quoted material rather than as a command.
 */
export function untrusted(label: string, body: string): string {
  const safe = String(body ?? "")
    .replace(/-{5,}\s*(BEGIN|END) UNTRUSTED DATA\s*-{5,}/gi, "[fence removed]")
    .slice(0, 4000);
  return `----- BEGIN UNTRUSTED DATA (${label}) -----\n${safe}\n----- END UNTRUSTED DATA (${label}) -----`;
}

/* ------------------------------------------------------------------ *
 * Context assembler
 * ------------------------------------------------------------------ */

export interface ContextRef {
  kind: "mail" | "event" | "task" | "proposal" | "contact" | "org" | "drive";
  id: string;
  label: string;
  org_id: string | null;
}


export interface AssembledContext {
  text: string;
  refs: ContextRef[];
  orgNames: Record<string, string>;
}

const iso = (d: Date) => d.toISOString();

/**
 * One parallel read per source. A source that fails is named as unreadable
 * rather than dropped — a silently missing source makes the answer look
 * wider than it was.
 */
export async function assembleContext(opts: {
  userId: string;
  orgIds: string[];
  scopeOrgId: string | null;
  question: string;
  conversationId?: string | null;
}): Promise<AssembledContext> {
  const db = admin();

  const ids = opts.scopeOrgId ? [opts.scopeOrgId] : opts.orgIds;
  if (ids.length === 0) {
    return { text: "The operator belongs to no organizations yet.", refs: [], orgNames: {} };
  }

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 864e5);
  const weekBack = new Date(now.getTime() - 7 * 864e5);

  const [orgsR, mailR, eventsR, tasksR, propsR, contactsR] = await Promise.allSettled([
    db.from("orgs").select("id,name,slug,color").in("id", ids),
    db
      .from("mail_messages")
      .select("id,org_id,subject,from_name,from_address,snippet,category,triage_status,received_at")
      .in("org_id", ids)
      .gte("received_at", iso(weekBack))
      .order("received_at", { ascending: false })
      .limit(25),
    db
      .from("events")
      .select("id,org_id,title,start_at,end_at,location")
      .in("org_id", ids)
      .gte("start_at", iso(new Date(now.getTime() - 864e5)))
      .lte("start_at", iso(weekAhead))
      .order("start_at")
      .limit(25),
    db
      .from("tasks")
      .select("id,org_id,title,status,priority,due_at")
      .in("org_id", ids)
      .neq("status", "done")
      .order("due_at", { nullsFirst: false })
      .limit(25),
    db
      .from("proposals")
      .select("id,org_id,title,kind,status,created_at")
      .in("org_id", ids)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(15),
    db.from("contacts").select("id,org_id,name,email,company,title").in("org_id", ids).limit(40),
  ]);

  const refs: ContextRef[] = [];
  const lines: string[] = [];
  const orgNames: Record<string, string> = {};

  const unreadable: string[] = [];
  const ok = <T,>(r: PromiseSettledResult<any>, name: string): T[] => {
    if (r.status !== "fulfilled" || r.value?.error) {
      unreadable.push(name);
      return [];
    }
    return (r.value.data ?? []) as T[];
  };

  const orgs = ok<any>(orgsR, "organizations");
  for (const o of orgs) orgNames[o.id] = o.name;
  const orgName = (id: string | null) => (id && orgNames[id]) || "Unassigned";

  lines.push(
    `SCOPE: ${opts.scopeOrgId ? orgName(opts.scopeOrgId) : `all organizations (${orgs.map((o) => o.name).join(", ") || "none"})`}`,
  );
  lines.push(`NOW: ${now.toISOString()}`);

  const mail = ok<any>(mailR, "mail");
  if (mail.length) {
    lines.push("\nRECENT MAIL (last 7 days):");
    for (const m of mail) {
      refs.push({ kind: "mail", id: m.id, label: m.subject || "(no subject)", org_id: m.org_id });
      lines.push(
        `- [${orgName(m.org_id)}] ${m.received_at} · ${m.from_name || m.from_address} · ${m.category} / ${m.triage_status}`,
      );
      lines.push(untrusted(`mail:${m.id}`, `${m.subject || ""}\n${m.snippet || ""}`));
    }
  }

  const events = ok<any>(eventsR, "calendar");
  if (events.length) {
    lines.push("\nCALENDAR (yesterday through next week):");
    for (const e of events) {
      refs.push({ kind: "event", id: e.id, label: e.title || "(untitled)", org_id: e.org_id });
      lines.push(`- [${orgName(e.org_id)}] ${e.start_at} → ${e.end_at ?? "?"} · ${e.title ?? "(untitled)"}`);
    }
  }

  const tasks = ok<any>(tasksR, "tasks");
  if (tasks.length) {
    lines.push("\nOPEN TASKS:");
    for (const t of tasks) {
      refs.push({ kind: "task", id: t.id, label: t.title, org_id: t.org_id });
      lines.push(`- [${orgName(t.org_id)}] ${t.title} · ${t.status} · ${t.priority} · due ${t.due_at ?? "none"}`);
    }
  }

  const props = ok<any>(propsR, "proposals");
  if (props.length) {
    lines.push("\nPROPOSALS AWAITING A HUMAN COMMIT:");
    for (const p of props) {
      refs.push({ kind: "proposal", id: p.id, label: p.title, org_id: p.org_id });
      lines.push(`- [${orgName(p.org_id)}] ${p.kind} · ${p.title}`);
    }
  }

  const contacts = ok<any>(contactsR, "contacts");
  if (contacts.length) {
    lines.push("\nCONTACTS (resolve names and addresses from this list only):");
    for (const c of contacts) {
      refs.push({ kind: "contact", id: c.id, label: c.name ?? c.email ?? "contact", org_id: c.org_id });
      lines.push(`- [${orgName(c.org_id)}] ${c.name ?? "?"} <${c.email ?? "no address"}> ${c.company ?? ""} ${c.title ?? ""}`);
    }
  }

  if (unreadable.length) {
    lines.push(
      `\nUNREADABLE THIS TURN: ${unreadable.join(", ")}. Say so if the answer depends on them; do not fill the gap with an estimate.`,
    );
  }

  return { text: lines.join("\n"), refs, orgNames };
}
