/**
 * Live sources.
 *
 * Every function here returns one of the shapes already declared in
 * src/data/* — the contract the screens depend on. Mapping happens at the
 * edge, once, so no screen ever learns a column name. If a table is renamed
 * the change lands in this file and nowhere else.
 *
 * Nothing here is cached or precomputed. Throughput in particular is one
 * query of raw closes; the buckets are derived at render time in ledger.ts,
 * which is what lets the workspace scope filter it.
 */

import { supabase } from "@/integrations/supabase/client";
import { ANY_ORG, type Org } from "@/lib/AppState";
import type { LedgerRow } from "@/data/ledger";
import type { Proposal, ProposalStatus } from "@/data/mock";
import type { Task, Project, Priority } from "@/data/tasks";
import type { Agent, Run } from "@/data/agents";
import type { Connection, Guardrail, Health } from "@/data/connections";
import type { Doc } from "@/data/knowledge";
import type { Contact, Signal, SignalKind } from "@/data/contacts";
import type { Author, Channel, Message } from "@/data/chat";
import { epochDate } from "@/data/tasks";

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

/** Typed select strings blow up tsc; keep the parser out of it. */
const sel = (s: string): string => s;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

const DAY = 86_400_000;

/** Whole days between a timestamp and the axis epoch. */
const offsetFrom = (iso: string | null, fallback: number): number => {
  if (!iso) return fallback;
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - epochDate().getTime()) / DAY);
};

/** Every fetcher throws on error so Promise.allSettled can record which
 *  source is down. Swallowing the error here would render zeros. */
async function rows<T>(table: string, query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as T[];
}

/* ------------------------------------------------------------------ */
/* orgs                                                                 */
/* ------------------------------------------------------------------ */

export async function fetchOrgs(): Promise<Org[]> {
  const raw = await rows<Record<string, string>>(
    "kova_orgs",
    supabase.from("kova_orgs").select(sel("slug, name, role, color, logo_url, status, position")).order("position"),
  );

  // Tenancy gives you the tenant's orgs; membership decides which of them you
  // may see. A person can belong to a tenant and still only work in two of its
  // five ventures, so the filter is membership, not tenant.
  const { data: mine } = await supabase.rpc("my_kova_org_slugs");
  const allowed = new Set(((mine ?? []) as { slug: string }[]).map((m) => m.slug));

  const live = raw
    .filter((r) => r.status !== "archived")
    .filter((r) => allowed.size === 0 || allowed.has(r.slug))
    .map<Org>((r) => ({
      id: r.slug,
      name: r.name,
      role: r.role ?? "",
      color: r.color ?? "var(--ws-all)",
      logo: r.logo_url ?? undefined,
    }));
  // "All organizations" is a state of the app, not a row in a table.
  return live.length
    ? [{ id: "all", name: "All organizations", role: "Everything, unfiltered", color: "var(--ws-all)" }, ...live]
    : [];
}


/* ------------------------------------------------------------------ */
/* throughput ledger — the one query                                    */
/* ------------------------------------------------------------------ */

/**
 *   select closed_at, org, project, assignee from kova_tasks
 *   where state = 'done' and closed_at > now() - interval '56 days';
 */
export async function fetchLedger(): Promise<LedgerRow[]> {
  const since = new Date(Date.now() - 56 * DAY).toISOString();
  const raw = await rows<Record<string, string>>(
    "kova_tasks",
    supabase
      .from("kova_tasks")
      .select(sel("closed_at, org, project, assignee"))
      .eq("state", "done")
      .gt("closed_at", since),
  );
  return raw.map((r) => ({
    closed_at: r.closed_at,
    org: r.org ?? ANY_ORG,
    project: r.project ?? "—",
    assignee: r.assignee ?? "Unassigned",
  }));
}

/* ------------------------------------------------------------------ */
/* tasks + projects                                                     */
/* ------------------------------------------------------------------ */

export interface TaskSet {
  tasks: Task[];
  projects: Project[];
}

export async function fetchTasks(): Promise<TaskSet> {
  const raw = await rows<Record<string, string | null>>(
    "kova_tasks",
    supabase
      .from("kova_tasks")
      .select(sel("id, title, org, project, state, priority, assignee, started_at, due_at, closed_at"))
      .order("due_at", { nullsFirst: false }),
  );

  const projects = new Map<string, Project>();
  const tasks = raw.map<Task>((r) => {
    const project = (r.project ?? "General") as string;
    const org = (r.org ?? ANY_ORG) as string;
    if (!projects.has(project)) {
      projects.set(project, { id: project, name: project, org, lead: (r.assignee ?? "—") as string });
    }
    // Day offsets, not date strings: the list and the Gantt bar are drawn
    // from the same two integers so they cannot drift apart.
    const start = offsetFrom(r.started_at as string | null, 0);
    const due = offsetFrom(r.due_at as string | null, start);
    return {
      id: r.id as string,
      project,
      title: r.title as string,
      assignee: (r.assignee ?? "Unassigned") as string,
      priority: ((r.priority ?? "medium") as Priority),
      start,
      len: Math.max(1, due - start + 1),
      done: r.state === "done",
    };
  });

  return { tasks, projects: [...projects.values()] };
}

/* ------------------------------------------------------------------ */
/* proposals                                                            */
/* ------------------------------------------------------------------ */

export async function fetchProposals(): Promise<Proposal[]> {
  const raw = await rows<Record<string, unknown>>(
    "kova_proposals",
    supabase
      .from("kova_proposals")
      .select(sel("id, agent, org, proposal, rationale, confidence, signals, state"))
      .order("confidence", { ascending: false }),
  );
  return raw.map<Proposal>((r) => ({
    id: String(r.id),
    org: (r.org as string) ?? ANY_ORG,
    agent: r.agent as Proposal["agent"],
    claim: (r.proposal as string) ?? "",
    rationale: (r.rationale as string) ?? "",
    confidence: Number(r.confidence ?? 0),
    signals: (r.signals as string[]) ?? [],
    status: ((r.state as string) ?? "pending") as ProposalStatus,
  }));
}

/* ------------------------------------------------------------------ */
/* agents + run history                                                 */
/* ------------------------------------------------------------------ */

export async function fetchAgents(): Promise<Agent[]> {
  const since = new Date(Date.now() - 14 * DAY).toISOString();
  const [defs, runs] = await Promise.all([
    rows<Record<string, unknown>>(
      "kova_agents",
      supabase
        .from("kova_agents")
        .select(sel("key, name, org, description, call_line, enabled, autonomous, gated, last_call")),
    ),
    rows<Record<string, unknown>>(
      "kova_agent_runs",
      supabase
        .from("kova_agent_runs")
        .select(sel("agent, ran_at, ok, runs, at_risk, right_calls"))
        .gt("ran_at", since),
    ),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return defs.map<Agent>((d) => {
    const key = d.key as string;
    // 14 slots, newest last. A day with no run is a zero that gets drawn,
    // not a gap — an absent bar reads as "no data" when it means "idle".
    const history: Run[] = Array.from({ length: 14 }, (_, i) => ({
      day: 13 - i,
      runs: 0,
      calls: 0,
      correct: 0,
    }));
    for (const r of runs) {
      if (r.agent !== key) continue;
      const d0 = new Date(r.ran_at as string);
      d0.setHours(0, 0, 0, 0);
      const back = Math.round((today.getTime() - d0.getTime()) / DAY);
      if (back < 0 || back > 13) continue;
      const slot = history[13 - back];
      slot.runs += Number(r.runs ?? 1);
      slot.calls += Number(r.at_risk ?? 0);
      slot.correct += Number(r.right_calls ?? 0);
      if (r.ok === false) slot.failed = true;
    }
    return {
      id: key,
      name: d.name as string,
      org: (d.org as string) ?? ANY_ORG,
      purpose: (d.description as string) ?? "",
      claim: (d.call_line as string) ?? "",
      state: d.enabled === false ? "paused" : "on",
      allowed: (d.autonomous as string[]) ?? [],
      gated: (d.gated as string[]) ?? [],
      history,
      lastCall: (d.last_call as string) ?? "—",
    };
  });
}

/* ------------------------------------------------------------------ */
/* connections + permissions                                            */
/* ------------------------------------------------------------------ */

export async function fetchConnections(): Promise<Connection[]> {
  const raw = await rows<Record<string, unknown>>(
    "kova_connections",
    supabase
      .from("kova_connections")
      .select(sel("key, name, detail, status, scope, position"))
      .order("position"),
  );
  return raw.map<Connection>((r) => ({
    id: r.key as string,
    name: r.name as string,
    org: ANY_ORG,
    health: ((r.status as string) ?? "off") as Health,
    detail: (r.detail as string) ?? "",
    scopes: (r.scope as string) ?? "—",
  }));
}

export async function fetchPermissions(): Promise<Guardrail[]> {
  const raw = await rows<Record<string, unknown>>(
    "kova_permissions",
    supabase
      .from("kova_permissions")
      .select(sel("key, label, detail, allowed, locked, position"))
      .order("position"),
  );
  return raw.map<Guardrail>((r) => ({
    id: r.key as string,
    label: (r.label as string) ?? (r.key as string),
    detail: (r.detail as string) ?? "",
    locked: r.locked === true || undefined,
    initial: r.allowed === true,
  }));
}

/* ------------------------------------------------------------------ */
/* knowledge                                                            */
/* ------------------------------------------------------------------ */

export async function fetchDocuments(): Promise<Doc[]> {
  const [docs, chunks] = await Promise.all([
    rows<Record<string, unknown>>(
      "kova_documents",
      supabase
        .from("kova_documents")
        .select(sel("id, title, category, org, source, indexed, cited_count, updated_at"))
        .order("updated_at", { ascending: false }),
    ),
    rows<Record<string, unknown>>(
      "kova_doc_chunks",
      supabase.from("kova_doc_chunks").select(sel("document_id, ord, content")).order("ord"),
    ),
  ]);

  return docs.map<Doc>((d) => {
    // Passages are the chunk text verbatim. A quote in the UI has to be a
    // quote from the source, not a paraphrase of it.
    const mine = chunks.filter((c) => c.document_id === d.id);
    return {
      id: d.id as string,
      title: d.title as string,
      category: (d.category as string) ?? "note",
      org: (d.org as string) ?? ANY_ORG,
      pages: Math.max(1, Math.ceil(mine.length / 3)),
      updated: new Date(d.updated_at as string).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      indexed: d.indexed === true,
      citations: Number(d.cited_count ?? 0),
      concepts: [],
      passages: mine.map((c) => ({ text: c.content as string, concepts: [] })),
    };
  });
}

/* ------------------------------------------------------------------ */
/* contacts                                                             */
/* ------------------------------------------------------------------ */

interface SignalJson {
  strength?: number;
  reading?: string;
  basis?: string;
}

const signal = (kind: SignalKind, j: SignalJson | null): Signal => ({
  kind,
  strength: Number(j?.strength ?? 0),
  reading: j?.reading ?? "",
  basis: j?.basis ?? "No signal recorded.",
});

export async function fetchContacts(): Promise<Contact[]> {
  const raw = await rows<Record<string, unknown>>(
    "kova_contacts",
    supabase
      .from("kova_contacts")
      .select(sel("id, name, role, org, card_used, scanned_at, loc_signal, cal_signal, overlap_signal"))
      .order("scanned_at", { ascending: false }),
  );

  return raw.map<Contact>((r) => {
    const name = r.name as string;
    // Confidence is never read back from the row. It is recomputed from the
    // three signals by verdict(), so a stored number cannot disagree with
    // the evidence shown beside it.
    return {
      id: r.id as string,
      name,
      role: (r.role as string) ?? "",
      org: (r.org as string) ?? ANY_ORG,
      initials: initials(name),
      scannedOn: r.scanned_at
        ? new Date(r.scanned_at as string).toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : "—",
      provenance: {
        signals: [
          signal("location", r.loc_signal as SignalJson | null),
          signal("calendar", r.cal_signal as SignalJson | null),
          signal("overlap", r.overlap_signal as SignalJson | null),
        ],
        claim: `${name} was met at ${(r.card_used as string) ?? "an unrecorded event"}.`,
        question: `Where did you meet ${name.split(" ")[0]}?`,
      },
      track: [],
      enrichment: [],
      draftOpener: "",
      draftBody: "",
    };
  });
}

/* ------------------------------------------------------------------ */
/* chat                                                                 */
/* ------------------------------------------------------------------ */

export interface ChatSet {
  channels: Channel[];
  authors: Record<string, Author>;
  messages: Message[];
}

const AUTHOR_COLORS = ["var(--ws-uwazi)", "var(--ws-cc)", "var(--ws-bin)", "var(--ws-raia)", "var(--ws-1flock)"];

export async function fetchChat(): Promise<ChatSet> {
  const [msgs, calls] = await Promise.all([
    rows<Record<string, unknown>>(
      "kova_chat_messages",
      supabase
        .from("kova_chat_messages")
        .select(sel("id, channel, author, body, reactions, action, action_state, created_at"))
        .order("created_at"),
    ),
    rows<Record<string, unknown>>(
      "kova_tool_calls",
      supabase.from("kova_tool_calls").select(sel("message_id, tool, args, ms, ok")).order("created_at"),
    ),
  ]);

  const authors: Record<string, Author> = {};
  const channels = new Map<string, Channel>();
  const zero = msgs.length ? new Date(msgs[0].created_at as string).getTime() : Date.now();

  const messages = msgs.map<Message>((m) => {
    const author = m.author as string;
    if (!authors[author]) {
      const isAgent = /patrol|ledger|scout|triage|watch|bot/i.test(author);
      authors[author] = {
        id: author,
        name: author,
        initials: initials(author),
        color: isAgent ? "var(--ws-all)" : AUTHOR_COLORS[Object.keys(authors).length % AUTHOR_COLORS.length],
        kind: isAgent ? "agent" : "human",
      };
    }
    const channel = m.channel as string;
    if (!channels.has(channel)) {
      channels.set(channel, { id: channel, name: channel, org: ANY_ORG, kind: "channel", unread: 0 });
    }
    const tools = calls.filter((c) => c.message_id === m.id);
    return {
      id: m.id as string,
      channel,
      author,
      at: Math.round((new Date(m.created_at as string).getTime() - zero) / 60_000),
      text: (m.body as string) ?? "",
      action: (m.action as Message["action"]) ?? undefined,
      // Terminal state lives on the record, never in the DOM: a re-render
      // must not revert an approved action to pending.
      actionState: (m.action_state as Message["actionState"]) ?? undefined,
      reactions: (m.reactions as Record<string, string[]>) ?? {},
      replies: [],
      ...(tools.length ? { tools } : {}),
    } as Message;
  });

  return { channels: [...channels.values()], authors, messages };
}
