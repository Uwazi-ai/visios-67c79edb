import { useSyncExternalStore } from "react";
import { clearSyncStatus, syncSource } from "@/lib/syncStatus";


/**
 * Capability model.
 *
 * Kova holds no data of its own. Every number on every screen is borrowed
 * from something a tenant connected. So the honest unit of the product is
 * not "a widget" but "a widget and the sources it stands on".
 *
 * A dashboard rendering zeros for a disconnected source is worse than one
 * saying "not connected", because zero looks like an answer.
 */

export type SourceId =
  | "google"
  | "supabase"
  | "slack"
  | "stripe"
  | "hubspot"
  | "make"
  | "linkedin"
  | "meta"
  | "tiktok"
  | "fathom";

export interface Source {
  id: SourceId;
  name: string;
  /** What connecting this actually turns on, in plain words. */
  turnsOn: string[];
  /** Exactly what Kova reads. Read-only, always. */
  reads: string;
  /**
   * Platform review sits between the click and the data. Saying it on the
   * card costs a sentence; discovering it a fortnight later costs the
   * tenant their plan.
   */
  delay?: string;
}

/**
 * Order is the recommendation. Google Workspace unlocks more surfaces than
 * anything else, so a tenant sees something true within a minute rather
 * than after connecting seven things.
 */
export const SOURCES: Source[] = [
  {
    id: "google",
    name: "Google Workspace",
    reads: "Mail threads, calendar events, Drive files, contacts. Read-only.",
    turnsOn: [
      "Inbox and unanswered-thread tracking",
      "Calendar, conflicts and bookings",
      "Contacts and org detection",
      "Knowledge from Drive documents",
      "The daily brief",
    ],
  },
  {
    id: "supabase",
    name: "Supabase",
    reads: "Tables under your tenant. Read-only unless you approve a write.",
    turnsOn: ["Tasks and throughput", "Velocity", "Agent proposals", "Knowledge index"],
  },
  {
    id: "slack",
    name: "Slack",
    reads: "Channel and thread history in channels you pick.",
    turnsOn: ["Chat mirroring", "Team activity in the brief"],
  },
  {
    id: "stripe",
    name: "Stripe",
    reads: "Charges, payouts, subscriptions. No refunds, no writes.",
    turnsOn: ["Revenue and runway", "Raise pipeline actuals"],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    reads: "Contacts, companies, deals.",
    turnsOn: ["Deal pipeline", "Contact enrichment"],
  },
  {
    id: "make",
    name: "Make.com",
    reads: "Scenario list and run history.",
    turnsOn: ["Agent run history", "Automation health"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    reads: "Page posts and their performance.",
    turnsOn: ["Organic social performance", "Campaign reach"],
    delay: "Partner access review takes 1–3 weeks before data flows.",
  },
  {
    id: "meta",
    name: "Meta",
    reads: "Page and ad account insights.",
    turnsOn: ["Paid social", "Campaign spend and creative results"],
    delay: "App review takes 2–6 weeks before data flows.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    reads: "Post and ad performance.",
    turnsOn: ["Short-form performance", "Paid reach"],
    delay: "Developer review takes 2–4 weeks before data flows.",
  },
  {
    id: "fathom",
    name: "Fathom",
    reads: "Meeting recordings and transcripts.",
    turnsOn: ["Meeting summaries", "Action items into Tasks"],
  },
];

export const SOURCE_BY_ID = Object.fromEntries(SOURCES.map((s) => [s.id, s])) as Record<
  SourceId,
  Source
>;

export interface Capability {
  /** Widget title, reused by the empty card so the shape of the page holds. */
  title: string;
  /** What it would show, said plainly, for someone who has connected nothing. */
  does: string;
  /** Without every one of these the widget cannot be true. */
  needs: SourceId[];
  /** Present makes it fuller; absent makes it incomplete, not wrong. */
  enriches: SourceId[];
}

/** Keyed by surface, not by screen — one screen can hold several. */
export const CAPABILITIES: Record<string, Capability> = {
  throughput: {
    title: "Throughput",
    does: "Tasks opened and closed per day, so you can see whether the machine is moving.",
    needs: ["supabase"],
    enriches: ["google", "slack"],
  },
  velocity: {
    title: "Velocity",
    does: "Completion rate over the last six weeks against the rate you need to hold.",
    needs: ["supabase"],
    enriches: ["make"],
  },
  proposals: {
    title: "Agent proposals",
    does: "Work agents think should happen, waiting on a person to commit it.",
    needs: ["supabase"],
    enriches: ["google", "slack", "make"],
  },
  brief: {
    title: "Daily brief",
    does: "The one thing that matters most today, and why it beat everything else.",
    needs: ["google"],
    enriches: ["supabase", "slack", "stripe"],
  },
  inbox: {
    title: "Inbox",
    does: "Threads waiting on you, oldest first, with drafted replies you approve.",
    needs: ["google"],
    enriches: ["hubspot"],
  },
  calendar: {
    title: "Calendar",
    does: "Your week, conflicts named, holds proposed rather than booked.",
    needs: ["google"],
    enriches: ["fathom"],
  },
  contacts: {
    title: "Contacts",
    does: "People you actually deal with, scored by how many signals agree.",
    needs: ["google"],
    enriches: ["hubspot", "linkedin"],
  },
  knowledge: {
    title: "Knowledge",
    does: "Your documents, searchable, with citations back to the source file.",
    needs: ["supabase"],
    enriches: ["google", "fathom"],
  },
  revenue: {
    title: "Revenue and runway",
    does: "Money in, money out, and how many months that leaves.",
    needs: ["stripe"],
    enriches: ["hubspot"],
  },
  raise: {
    title: "Raise pipeline",
    does: "Every conversation by stage, weighted by the money behind it.",
    needs: ["supabase"],
    enriches: ["stripe", "hubspot", "google"],
  },
  social: {
    title: "Social performance",
    does: "What you published and what it did, organic against paid.",
    needs: ["linkedin"],
    enriches: ["meta", "tiktok"],
  },
  campaigns: {
    title: "Campaigns",
    does: "Spend, reach and which creative earned its place.",
    needs: ["meta"],
    enriches: ["tiktok", "linkedin", "stripe"],
  },
  agents: {
    title: "Agent runs",
    does: "Every run an agent made, whether it was right, and what it cost.",
    needs: ["make"],
    enriches: ["supabase"],
  },
};

/* ------------------------------------------------------------------ */
/* Connected-source store                                              */
/* ------------------------------------------------------------------ */

const KEY = "kova:sources";

/**
 * Seeded with the sources a founding tenant already wired. Everything else
 * is off, and says so, rather than rendering a confident zero.
 */
const DEFAULTS: SourceId[] = ["google", "supabase", "make"];

const read = (): SourceId[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as SourceId[];
    return Array.isArray(parsed) ? parsed : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
};

let connected: SourceId[] = read();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const commit = (next: SourceId[]) => {
  connected = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode — state still holds for this session */
  }
  emit();
};

export const connectSource = (id: SourceId) => {
  if (connected.includes(id)) return;
  commit([...connected, id]);
  /* A fresh connection proves itself immediately rather than sitting on a
     green tick nobody verified. */
  void syncSource(id);
};

/**
 * Disconnecting stops reads immediately and drops that source's data from
 * the workspace. Dependent widgets return to their empty state on the same
 * tick — no stale chart, no zeroed chart.
 */
export const disconnectSource = (id: SourceId) => {
  if (!connected.includes(id)) return;
  commit(connected.filter((s) => s !== id));
  clearSyncStatus(id);
};


export const toggleSource = (id: SourceId) =>
  connected.includes(id) ? disconnectSource(id) : connectSource(id);

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useConnectedSources = (): SourceId[] =>
  useSyncExternalStore(
    subscribe,
    () => connected,
    () => DEFAULTS,
  );

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

export type CapabilityState = "ready" | "partial" | "empty";

export interface Resolved {
  state: CapabilityState;
  capability: Capability;
  missingRequired: Source[];
  missingOptional: Source[];
}

export function resolveCapability(key: string, active: SourceId[]): Resolved {
  const capability = CAPABILITIES[key] ?? {
    title: key,
    does: "This surface has no declared sources yet.",
    needs: [],
    enriches: [],
  };
  const has = (id: SourceId) => active.includes(id);
  const missingRequired = capability.needs.filter((id) => !has(id)).map((id) => SOURCE_BY_ID[id]);
  const missingOptional = capability.enriches.filter((id) => !has(id)).map((id) => SOURCE_BY_ID[id]);

  /* Any required source missing means empty. A widget standing on half a
     foundation is not "partially true" — it is guessing. */
  const state: CapabilityState =
    missingRequired.length > 0 ? "empty" : missingOptional.length > 0 ? "partial" : "ready";

  return { state, capability, missingRequired, missingOptional };
}

export const useCapability = (key: string): Resolved =>
  resolveCapability(key, useConnectedSources());

/** "10 / 15 features live" — counted from the same map the widgets use. */
export function featureCount(active: SourceId[]) {
  const keys = Object.keys(CAPABILITIES);
  const live = keys.filter((k) => resolveCapability(k, active).state !== "empty").length;
  return { live, total: keys.length };
}

/** Which surfaces a single source is load-bearing for — used on the cards. */
export function surfacesFor(id: SourceId) {
  return Object.values(CAPABILITIES)
    .filter((c) => c.needs.includes(id))
    .map((c) => c.title);
}
