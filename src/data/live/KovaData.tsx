/**
 * The live data layer.
 *
 * Two rules drive everything here.
 *
 * 1. Promise.allSettled, never Promise.all. One dead table must not blank
 *    the dashboard. Each source records its own outcome and the header says
 *    out loud how many are down. A dashboard that silently renders zeros for
 *    a broken table is worse than one that admits it, because zero is a
 *    number a founder will act on.
 *
 * 2. Sample data is labelled. When there is no session — no key — the
 *    screens fall back to the generated fixtures and the header goes amber
 *    and says "Sample data". A demo must never pass generated numbers off
 *    as real ones.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { markSyncError, markSynced } from "@/lib/syncStatus";

import { ORGS as SAMPLE_ORGS, useAppState, type Org } from "@/lib/AppState";
import { LEDGER as SAMPLE_LEDGER, type LedgerRow } from "@/data/ledger";
import { PROPOSALS as SAMPLE_PROPOSALS, type Proposal } from "@/data/mock";
import { TASKS as SAMPLE_TASKS, PROJECTS as SAMPLE_PROJECTS, type Task, type Project } from "@/data/tasks";
import { AGENTS as SAMPLE_AGENTS, type Agent } from "@/data/agents";
import {
  CONNECTIONS as SAMPLE_CONNECTIONS,
  GUARDRAILS as SAMPLE_GUARDRAILS,
  type Connection,
  type Guardrail,
} from "@/data/connections";
import { DOCS as SAMPLE_DOCS, type Doc } from "@/data/knowledge";
import { CONTACTS as SAMPLE_CONTACTS, type Contact } from "@/data/contacts";
import {
  CHANNELS as SAMPLE_CHANNELS,
  AUTHORS as SAMPLE_AUTHORS,
  SEED as SAMPLE_MESSAGES,
  type Author,
  type Channel,
  type Message,
} from "@/data/chat";
import { hydrateProposals } from "@/data/proposalStore";
import { hydrateTasks } from "@/data/taskStore";
import { hydrateChat } from "@/data/chatStore";
import {
  fetchAgents,
  fetchChat,
  fetchConnections,
  fetchContacts,
  fetchDocuments,
  fetchLedger,
  fetchOrgs,
  fetchPermissions,
  fetchProposals,
  fetchTasks,
} from "./sources";

export type Mode = "live" | "sample";

export interface SourceState {
  key: string;
  /** Table name as the user would recognise it in the schema. */
  label: string;
  ok: boolean;
  rows: number;
  error?: string;
}

interface KovaDataValue {
  mode: Mode;
  loading: boolean;
  sources: SourceState[];
  /** The ones that threw. Named in the tooltip, counted in the header. */
  down: SourceState[];
  refresh: () => void;

  orgs: Org[];
  /** Raw closes. Bucketing stays in ledger.ts, at render time. */
  ledger: LedgerRow[];
  tasks: Task[];
  projects: Project[];
  proposals: Proposal[];
  agents: Agent[];
  connections: Connection[];
  guardrails: Guardrail[];
  docs: Doc[];
  contacts: Contact[];
  channels: Channel[];
  authors: Record<string, Author>;
  messages: Message[];
}

const SAMPLE: Omit<KovaDataValue, "mode" | "loading" | "sources" | "down" | "refresh"> = {
  orgs: SAMPLE_ORGS,
  ledger: SAMPLE_LEDGER,
  tasks: SAMPLE_TASKS,
  projects: SAMPLE_PROJECTS,
  proposals: SAMPLE_PROPOSALS,
  agents: SAMPLE_AGENTS,
  connections: SAMPLE_CONNECTIONS,
  guardrails: SAMPLE_GUARDRAILS,
  docs: SAMPLE_DOCS,
  contacts: SAMPLE_CONTACTS,
  channels: SAMPLE_CHANNELS,
  authors: SAMPLE_AUTHORS,
  messages: SAMPLE_MESSAGES,
};

const Ctx = createContext<KovaDataValue>({
  mode: "sample",
  loading: false,
  sources: [],
  down: [],
  refresh: () => {},
  ...SAMPLE,
});

interface Loaded {
  orgs: Org[];
  ledger: LedgerRow[];
  tasks: Task[];
  projects: Project[];
  proposals: Proposal[];
  agents: Agent[];
  connections: Connection[];
  guardrails: Guardrail[];
  docs: Doc[];
  contacts: Contact[];
  channels: Channel[];
  authors: Record<string, Author>;
  messages: Message[];
}

const EMPTY: Loaded = {
  orgs: [],
  ledger: [],
  tasks: [],
  projects: [],
  proposals: [],
  agents: [],
  connections: [],
  guardrails: [],
  docs: [],
  contacts: [],
  channels: [],
  authors: {},
  messages: [],
};

export const KovaDataProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("sample");
  const [sources, setSources] = useState<SourceState[]>([]);
  const [data, setData] = useState<Loaded>(EMPTY);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) {
        // No key, no live read. Say so rather than showing fixtures as fact.
        if (cancelled) return;
        setMode("sample");
        setSources([]);
        setData(EMPTY);
        setLoading(false);
        return;
      }

      const jobs = [
        ["orgs", "kova_orgs", fetchOrgs],
        ["ledger", "kova_tasks (closes)", fetchLedger],
        ["tasks", "kova_tasks", fetchTasks],
        ["proposals", "kova_proposals", fetchProposals],
        ["agents", "kova_agents", fetchAgents],
        ["connections", "kova_connections", fetchConnections],
        ["permissions", "kova_permissions", fetchPermissions],
        ["docs", "kova_documents", fetchDocuments],
        ["contacts", "kova_contacts", fetchContacts],
        ["chat", "kova_chat_messages", fetchChat],
      ] as const;

      // allSettled: a rejected source costs that one card, not the page.
      const settled = await Promise.allSettled(jobs.map(([, , fn]) => fn()));
      if (cancelled) return;

      const next: Loaded = { ...EMPTY };
      const states: SourceState[] = [];

      settled.forEach((res, i) => {
        const [key, label] = jobs[i];
        if (res.status === "rejected") {
          states.push({
            key,
            label,
            ok: false,
            rows: 0,
            error: res.reason instanceof Error ? res.reason.message : String(res.reason),
          });
          return;
        }
        const value = res.value;
        let count = 0;
        switch (key) {
          case "orgs":
            next.orgs = value as Org[];
            count = next.orgs.length;
            break;
          case "ledger":
            next.ledger = value as LedgerRow[];
            count = next.ledger.length;
            break;
          case "tasks": {
            const set = value as { tasks: Task[]; projects: Project[] };
            next.tasks = set.tasks;
            next.projects = set.projects;
            count = set.tasks.length;
            break;
          }
          case "proposals":
            next.proposals = value as Proposal[];
            count = next.proposals.length;
            break;
          case "agents":
            next.agents = value as Agent[];
            count = next.agents.length;
            break;
          case "connections":
            next.connections = value as Connection[];
            count = next.connections.length;
            break;
          case "permissions":
            next.guardrails = value as Guardrail[];
            count = next.guardrails.length;
            break;
          case "docs":
            next.docs = value as Doc[];
            count = next.docs.length;
            break;
          case "contacts":
            next.contacts = value as Contact[];
            count = next.contacts.length;
            break;
          case "chat": {
            const set = value as { channels: Channel[]; authors: Record<string, Author>; messages: Message[] };
            next.channels = set.channels;
            next.authors = set.authors;
            next.messages = set.messages;
            count = set.messages.length;
            break;
          }
        }
        states.push({ key, label, ok: true, rows: count });
      });

      /* The Supabase source's sync status is not a separate probe — it is
         this read. Record it so the Connect screen and the dashboard agree. */
      const failed = states.filter((s) => !s.ok);
      if (failed.length > 0) {
        markSyncError(
          "supabase",
          failed.map((s) => `${s.label}: ${s.error ?? "failed"}`).join("; "),
        );
      } else {
        markSynced("supabase", states.reduce((n, s) => n + s.rows, 0));
      }

      // A signed-in workspace with nothing in it yet is still a demo. Show
      // the fixtures, but keep the amber badge on so nobody quotes them.
      const anyRows = states.some((s) => s.ok && s.rows > 0);
      setMode(anyRows ? "live" : "sample");
      setData(next);
      setSources(states);
      setLoading(false);

    })();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const value = useMemo<KovaDataValue>(() => {
    const down = sources.filter((s) => !s.ok);
    if (mode === "sample") {
      return { mode, loading, sources, down, refresh, ...SAMPLE };
    }
    // Live: an empty collection from a healthy table is a real answer and is
    // rendered empty. Only a source that is *down* is excluded, and the
    // header counts it.
    return { mode, loading, sources, down, refresh, ...data, orgs: data.orgs.length ? data.orgs : SAMPLE_ORGS };
  }, [mode, loading, sources, data, refresh]);

  /* The switcher reads from AppState, so the membership-filtered list has to
     land there — otherwise a person sees ventures they are not a member of. */
  const { setOrgs } = useAppState();
  useEffect(() => {
    if (mode === "live" && data.orgs.length) setOrgs(data.orgs);
  }, [mode, data.orgs, setOrgs]);

  /* Three screens keep their write state in module stores — approvals,
     completions, agent action decisions. Push the read rows in rather than
     rewiring those screens: a decision already taken survives the push. */
  useEffect(() => {
    hydrateProposals(value.proposals);
    hydrateTasks(value.tasks);
    hydrateChat({ channels: value.channels, messages: value.messages, authors: value.authors });
  }, [value.proposals, value.tasks, value.channels, value.messages, value.authors]);


  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useKovaData = () => useContext(Ctx);
