import { useSyncExternalStore } from "react";
import { clearSyncStatus, syncSource } from "@/lib/syncStatus";


/**
 * Capability model — the field-to-integration map.
 *
 * Kova holds no data of its own. Every number on every screen is borrowed
 * from something a tenant connected. A metric that renders without a live
 * source is a fabricated metric, so every field in the product is declared
 * here with what feeds it. If a field is not on this list it should not be
 * on screen.
 *
 * Stripe appears twice and the two are not the same connection:
 *   stripe           the tenant's own Stripe — their revenue, their runway
 *   stripe_platform  Kova's Stripe — billing tenants, MRR on the admin console
 * Separate OAuth grants against separate accounts. Conflating them would
 * show a tenant Kova's revenue, or show Kova a tenant's.
 */

export type SourceId =
  | "google"
  | "supabase"
  | "slack"
  | "stripe"
  | "stripe_platform"
  | "hubspot"
  | "make"
  | "linkedin"
  | "meta"
  | "tiktok"
  | "tokens";

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
  /** Kova's own plumbing — not a tenant connection, not on Connect. */
  platformOnly?: boolean;
}

/**
 * Order is the recommendation. Google Workspace and Supabase carry the most
 * fields between them, so a tenant sees something true within a minute
 * rather than after connecting ten things.
 */
export const SOURCES: Source[] = [
  {
    id: "supabase",
    name: "Supabase",
    reads: "Tables under your tenant. Read-only unless you approve a write.",
    turnsOn: [
      "Tasks, throughput and velocity",
      "Timeline, dependencies and WIP limits",
      "Semantic search and index coverage",
      "Vision conversations and tool disclosure",
      "Agent proposals",
    ],
  },
  {
    id: "google",
    name: "Google Workspace",
    reads: "Mail threads, calendar events, Drive files, contacts. Read-only.",
    turnsOn: [
      "The daily brief and awaiting-reply",
      "Inbox threads, drafts and voice match",
      "Calendar grid and conflict detection",
      "Documents for Knowledge",
      "Booking links and availability",
    ],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    reads: "Contacts, companies, deals.",
    turnsOn: [
      "Contacts and provenance",
      "Relationship track and outreach drafts",
      "AI prep brief on bookings",
      "Card scans by context",
    ],
  },
  {
    id: "make",
    name: "Make.com",
    reads: "Scenario list and run history.",
    turnsOn: ["Agent configuration and run history", "Need-a-decision queue", "Agent posts in Chat"],
  },
  {
    id: "slack",
    name: "Slack",
    reads: "Channel and thread history in channels you pick.",
    turnsOn: ["Channels and DMs", "Unread counts", "Presence"],
  },
  {
    id: "stripe",
    name: "Stripe",
    reads: "Your charges, payouts and subscriptions. No refunds, no writes.",
    turnsOn: ["Cash position and burn", "Revenue per month", "Runway"],
  },
  {
    id: "meta",
    name: "Meta",
    reads: "Page and ad account insights.",
    turnsOn: ["Paid reach", "Organic vs paid verdict", "CPM, funnel and creative leaderboard"],
    delay: "App review takes 2–6 weeks before data flows.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    reads: "Page posts and their performance.",
    turnsOn: ["Content calendar", "Organic reach", "Top posts"],
    delay: "Partner access review takes 1–3 weeks before data flows.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    reads: "Post and ad performance.",
    turnsOn: ["Content calendar", "Organic reach", "Top posts"],
    delay: "Developer review takes 2–4 weeks before data flows.",
  },
  {
    id: "stripe_platform",
    name: "Stripe (Kova billing)",
    reads: "Kova's own billing account. Never a tenant's.",
    turnsOn: ["MRR and movement", "Average per tenant", "Gross margin and headroom"],
    platformOnly: true,
  },
  {
    id: "tokens",
    name: "Token logging",
    reads: "Per-message model token counts written by the proxy.",
    turnsOn: ["Inference cost", "Gross margin", "Headroom"],
    platformOnly: true,
  },
];

export const SOURCE_BY_ID = Object.fromEntries(SOURCES.map((s) => [s.id, s])) as Record<
  SourceId,
  Source
>;

export interface Capability {
  /** Field title, reused by the empty card so the shape of the page holds. */
  title: string;
  /** Which screen the field lives on. */
  screen: string;
  /** What it would show, said plainly, for someone who has connected nothing. */
  does: string;
  /** Without every one of these the field cannot be true. */
  needs: SourceId[];
  /** At least one of these is required — Social reads any network. */
  anyOf?: SourceId[];
  /** Present makes it fuller; absent makes it incomplete, not wrong. */
  enriches: SourceId[];
  /** Computed rather than read — the note says how, so nobody reads it as measured. */
  derived?: string;
}

/**
 * Keyed by field, not by screen — one screen holds many fields, and each is
 * gated on its own sources.
 */
export const CAPABILITIES: Record<string, Capability> = {
  /* ---------------- Dashboard ---------------- */
  brief: {
    title: "Daily brief lead",
    screen: "Dashboard",
    does: "The one thing that matters most today, and why it beat everything else.",
    needs: ["google"],
    enriches: ["supabase", "make"],
    derived: "Chooses the most severe item across four streams.",
  },
  "awaiting-reply": {
    title: "Awaiting reply",
    screen: "Dashboard",
    does: "Threads where somebody is waiting on you.",
    needs: ["google"],
    enriches: [],
  },
  "due-today": {
    title: "Due today",
    screen: "Dashboard",
    does: "Tasks dated today across the scope you are in.",
    needs: ["supabase"],
    enriches: [],
  },
  "on-calendar": {
    title: "On calendar",
    screen: "Dashboard",
    does: "What is booked today and how much of the day it takes.",
    needs: ["google"],
    enriches: [],
  },
  "need-decision": {
    title: "Need a decision",
    screen: "Dashboard",
    does: "Work an agent has staged that cannot move until a person commits it.",
    needs: ["supabase", "make"],
    enriches: [],
  },
  throughput: {
    title: "Tasks closed, 30 days",
    screen: "Dashboard",
    does: "Tasks opened and closed per day, so you can see whether the machine is moving.",
    needs: ["supabase"],
    enriches: [],
  },
  "throughput-delta": {
    title: "Throughput delta",
    screen: "Dashboard",
    does: "This window against the one before it.",
    needs: ["supabase"],
    enriches: [],
    derived: "Computed from the same closes.",
  },
  "projected-closes": {
    title: "Projected closes",
    screen: "Dashboard",
    does: "Where the next stretch lands if nothing changes.",
    needs: ["supabase"],
    enriches: [],
    derived: "Flat trailing 10-day mean — not a trend.",
  },
  velocity: {
    title: "Velocity, 8 weeks",
    screen: "Dashboard",
    does: "Completion rate over the last eight weeks against the rate you need to hold.",
    needs: ["supabase"],
    enriches: [],
  },
  "who-closed": {
    title: "Who closed it",
    screen: "Dashboard",
    does: "Closes by person, so throughput has a name behind it.",
    needs: ["supabase"],
    enriches: [],
  },
  proposals: {
    title: "Agent proposals",
    screen: "Dashboard",
    does: "Work agents think should happen, waiting on a person to commit it.",
    needs: ["supabase", "make"],
    enriches: ["google", "slack"],
  },

  /* ---------------- Tasks ---------------- */
  projects: {
    title: "Projects and progress",
    screen: "Tasks",
    does: "Every project and how far through it you are.",
    needs: ["supabase"],
    enriches: [],
  },
  "task-list": {
    title: "Task list",
    screen: "Tasks",
    does: "The work itself, in sections, with status.",
    needs: ["supabase"],
    enriches: [],
  },
  assignees: {
    title: "Assignees",
    screen: "Tasks",
    does: "Who owns each task.",
    needs: ["supabase"],
    enriches: [],
  },
  timeline: {
    title: "Timeline and dependencies",
    screen: "Tasks",
    does: "Dates, blockers and the critical path through them.",
    needs: ["supabase"],
    enriches: [],
  },
  "wip-limits": {
    title: "WIP limits",
    screen: "Tasks",
    does: "Where a column is carrying more than it can finish.",
    needs: ["supabase"],
    enriches: [],
    derived: "Counted from the board, not configured.",
  },

  /* ---------------- Inbox ---------------- */
  threads: {
    title: "Threads",
    screen: "Inbox",
    does: "Threads waiting on you, oldest first.",
    needs: ["google"],
    enriches: [],
  },
  "draft-reply": {
    title: "AI draft reply",
    screen: "Inbox",
    does: "A reply written for you to approve. Nothing sends itself.",
    needs: ["google"],
    enriches: [],
  },
  "voice-match": {
    title: "Voice match score",
    screen: "Inbox",
    does: "How close a draft sits to the way you actually write.",
    needs: ["google"],
    enriches: [],
    derived: "Scored against your sent mail.",
  },
  "org-attribution": {
    title: "Org attribution",
    screen: "Inbox",
    does: "Which venture a thread belongs to.",
    needs: ["google"],
    enriches: [],
    derived: "Domain-first, from the addresses on the thread.",
  },

  /* ---------------- Chat ---------------- */
  channels: {
    title: "Channels and DMs",
    screen: "Chat",
    does: "Your conversations, mirrored read-only.",
    needs: ["slack"],
    enriches: [],
  },
  unread: {
    title: "Unread counts",
    screen: "Chat",
    does: "What you have not seen yet.",
    needs: ["slack"],
    enriches: [],
  },
  presence: {
    title: "Presence dots",
    screen: "Chat",
    does: "Who is around right now.",
    needs: ["slack"],
    enriches: [],
  },
  "agent-posts": {
    title: "Agent posts",
    screen: "Chat",
    does: "Agents as members of a channel, with actions that wait for approval.",
    needs: ["slack", "make"],
    enriches: [],
  },

  /* ---------------- Calendar ---------------- */
  calendar: {
    title: "Week grid",
    screen: "Calendar",
    does: "Your week, hour by hour.",
    needs: ["google"],
    enriches: [],
  },
  conflicts: {
    title: "Conflict detection",
    screen: "Calendar",
    does: "Where two things are booked over each other.",
    needs: ["google"],
    enriches: [],
    derived: "Overlap computed from the events themselves.",
  },
  "booked-free": {
    title: "Booked vs free",
    screen: "Calendar",
    does: "How much of the week is already spoken for.",
    needs: ["google"],
    enriches: [],
    derived: "Summed from the grid.",
  },

  /* ---------------- Contacts ---------------- */
  contacts: {
    title: "Contacts",
    screen: "Contacts",
    does: "People you actually deal with.",
    needs: ["hubspot"],
    enriches: ["google"],
  },
  "prov-location": {
    title: "Provenance · location",
    screen: "Contacts",
    does: "Where you were when the contact was scanned.",
    needs: ["hubspot"],
    enriches: [],
    derived: "Device location at scan time, stored on the contact.",
  },
  "prov-calendar": {
    title: "Provenance · calendar",
    screen: "Contacts",
    does: "The meeting the two of you were in.",
    needs: ["google"],
    enriches: [],
  },
  "prov-overlap": {
    title: "Provenance · overlap",
    screen: "Contacts",
    does: "People and companies you have in common.",
    needs: ["hubspot"],
    enriches: [],
    derived: "Intersection across your records.",
  },
  "prov-confidence": {
    title: "Provenance confidence",
    screen: "Contacts",
    does: "How sure Kova is about who this person is to you.",
    needs: ["hubspot", "google"],
    enriches: [],
    derived: "Two or more signals must agree before the claim is a statement.",
  },
  "relationship-track": {
    title: "Relationship track",
    screen: "Contacts",
    does: "Where the relationship stands and what moves it forward.",
    needs: ["hubspot", "google"],
    enriches: [],
  },
  "outreach-draft": {
    title: "Outreach draft",
    screen: "Contacts",
    does: "A written approach for you to approve.",
    needs: ["hubspot", "google"],
    enriches: [],
  },

  /* ---------------- Knowledge ---------------- */
  documents: {
    title: "Documents",
    screen: "Knowledge",
    does: "Your files, listed and readable.",
    needs: ["google"],
    enriches: [],
  },
  "semantic-search": {
    title: "Semantic search",
    screen: "Knowledge",
    does: "Search by meaning, with citations back to the source file.",
    needs: ["google", "supabase"],
    enriches: [],
    derived: "Needs pgvector — documents must be embedded, not just present.",
  },
  "index-coverage": {
    title: "Index coverage",
    screen: "Knowledge",
    does: "How much of your corpus is actually searchable.",
    needs: ["supabase"],
    enriches: [],
  },
  citations: {
    title: "Citations this month",
    screen: "Knowledge",
    does: "Which documents the answers actually leaned on.",
    needs: ["supabase"],
    enriches: [],
  },

  /* ---------------- Bookings ---------------- */
  "booking-links": {
    title: "Booking links",
    screen: "Bookings",
    does: "Public links people can use to take time with you.",
    needs: ["google"],
    enriches: [],
  },
  slots: {
    title: "Available slots",
    screen: "Bookings",
    does: "The times that are genuinely open.",
    needs: ["google"],
    enriches: [],
    derived: "Free/busy minus your rules.",
  },
  heatmap: {
    title: "Availability heatmap",
    screen: "Bookings",
    does: "Where the week has room and where it does not.",
    needs: ["google"],
    enriches: [],
    derived: "Aggregated from the same free/busy read.",
  },
  "prep-brief": {
    title: "AI prep brief",
    screen: "Bookings",
    does: "Who you are about to meet and what you already know about them.",
    needs: ["google", "hubspot"],
    enriches: [],
    derived: "Joins the invitee to Contacts and the Raise pipeline.",
  },

  /* ---------------- Raise ---------------- */
  pipeline: {
    title: "Opportunity pipeline",
    screen: "Raise",
    does: "Every raise conversation by stage.",
    needs: [],
    enriches: ["hubspot", "google"],
    derived: "Manual entry — the one screen that works with nothing connected.",
  },
  "stage-ladder": {
    title: "Stage ladder",
    screen: "Raise",
    does: "How the money spreads across the stages.",
    needs: [],
    enriches: [],
    derived: "Computed from the pipeline you entered.",
  },
  "opportunity-cap": {
    title: "Opportunity cap",
    screen: "Raise",
    does: "The most this pipeline could realistically deliver.",
    needs: [],
    enriches: [],
    derived: "Weighted from stage probabilities.",
  },
  cash: {
    title: "Cash position",
    screen: "Raise",
    does: "What is actually in the account.",
    needs: ["stripe"],
    enriches: [],
  },
  burn: {
    title: "Burn rate",
    screen: "Raise",
    does: "What leaves each month.",
    needs: ["stripe"],
    enriches: [],
  },
  revenue: {
    title: "Revenue per month",
    screen: "Raise",
    does: "Money in, month by month.",
    needs: ["stripe"],
    enriches: [],
  },
  runway: {
    title: "Runway months",
    screen: "Raise",
    does: "How long the money lasts at the current rate.",
    needs: ["stripe"],
    enriches: [],
    derived: "cash ÷ (burn − revenue). Every input is Stripe.",
  },

  /* ---------------- Social ---------------- */
  "content-calendar": {
    title: "Content calendar",
    screen: "Social",
    does: "What is going out and when.",
    needs: [],
    anyOf: ["meta", "tiktok", "linkedin"],
    enriches: [],
  },
  "scheduled-vs-draft": {
    title: "Scheduled vs draft",
    screen: "Social",
    does: "How much of the plan is committed rather than intended.",
    needs: [],
    anyOf: ["meta", "tiktok", "linkedin"],
    enriches: [],
    derived: "Counted from the calendar.",
  },
  "weekday-gap": {
    title: "Longest weekday gap",
    screen: "Social",
    does: "The longest stretch with nothing published.",
    needs: [],
    anyOf: ["meta", "tiktok", "linkedin"],
    enriches: [],
    derived: "Measured between published posts.",
  },
  "organic-reach": {
    title: "Organic reach",
    screen: "Social",
    does: "How far unpaid posts travelled.",
    needs: [],
    anyOf: ["meta", "tiktok", "linkedin"],
    enriches: [],
  },
  "paid-reach": {
    title: "Paid reach",
    screen: "Social",
    does: "How far spend carried you.",
    needs: ["meta"],
    enriches: [],
  },
  "organic-vs-paid": {
    title: "Organic vs paid verdict",
    screen: "Social",
    does: "Whether spend amplified the work or replaced it.",
    needs: ["meta"],
    enriches: [],
    derived: "Needs both halves — organic alone cannot tell amplification from substitution.",
  },
  "top-posts": {
    title: "Top posts",
    screen: "Social",
    does: "What actually landed.",
    needs: [],
    anyOf: ["meta", "tiktok", "linkedin"],
    enriches: [],
  },

  /* ---------------- Campaigns ---------------- */
  cpm: {
    title: "CPM vs benchmark",
    screen: "Campaigns",
    does: "What you paid per thousand against what you should have.",
    needs: ["meta"],
    enriches: [],
  },
  funnel: {
    title: "Performance funnel",
    screen: "Campaigns",
    does: "Impression to click to action, and where it leaks.",
    needs: ["meta"],
    enriches: [],
  },
  "creative-leaderboard": {
    title: "Creative leaderboard",
    screen: "Campaigns",
    does: "Which creative earned its place.",
    needs: ["meta"],
    enriches: [],
  },

  /* ---------------- Agents ---------------- */
  "agent-config": {
    title: "Agent configuration",
    screen: "Agents",
    does: "What each agent is allowed to look at and do.",
    needs: ["make"],
    enriches: [],
  },
  "run-history": {
    title: "Run history",
    screen: "Agents",
    does: "Every run an agent made, and what it cost.",
    needs: ["make"],
    enriches: [],
  },
  "hit-rate": {
    title: "Hit rate",
    screen: "Agents",
    does: "How often an agent was right, verified against what happened.",
    needs: ["make", "supabase"],
    enriches: [],
    derived: "Runs joined to their outcomes.",
  },

  /* ---------------- Vision ---------------- */
  conversation: {
    title: "Conversation",
    screen: "Vision",
    does: "Your thread with Vision, kept.",
    needs: ["supabase"],
    enriches: [],
  },
  "tool-disclosure": {
    title: "Tool call disclosure",
    screen: "Vision",
    does: "Every tool Vision called, including the ones that were denied or failed.",
    needs: ["supabase"],
    enriches: [],
  },
  sightlines: {
    title: "What Vision can see",
    screen: "Vision",
    does: "The sources Vision is reading from in this session.",
    needs: [],
    enriches: [],
    derived: "Reads the connection list itself — always available.",
  },

  /* ---------------- Card ---------------- */
  "card-identity": {
    title: "Card identity",
    screen: "Card",
    does: "Your digital card, as people receive it.",
    needs: [],
    enriches: [],
  },
  "card-scans": {
    title: "Scans by context",
    screen: "Card",
    does: "Where your card was scanned and who it became.",
    needs: ["hubspot"],
    enriches: [],
  },

  /* ---------------- Platform admin ---------------- */
  mrr: {
    title: "MRR",
    screen: "PlatformAdmin",
    does: "Recurring revenue across tenants.",
    needs: ["stripe_platform"],
    enriches: [],
  },
  "mrr-movement": {
    title: "MRR movement",
    screen: "PlatformAdmin",
    does: "New, expansion and churn behind the number.",
    needs: ["stripe_platform"],
    enriches: [],
  },
  "avg-per-tenant": {
    title: "Average per tenant",
    screen: "PlatformAdmin",
    does: "What a workspace is worth on average.",
    needs: ["stripe_platform"],
    enriches: [],
    derived: "MRR ÷ paying tenants.",
  },
  "inference-cost": {
    title: "Inference cost",
    screen: "PlatformAdmin",
    does: "What the models cost to serve.",
    needs: ["tokens"],
    enriches: [],
    derived: "Estimated from message counts until per-message token logging ships.",
  },
  "gross-margin": {
    title: "Gross margin",
    screen: "PlatformAdmin",
    does: "Revenue less what it cost to serve it.",
    needs: ["stripe_platform", "tokens"],
    enriches: [],
    derived: "Revenue minus inference cost.",
  },
  headroom: {
    title: "Headroom",
    screen: "PlatformAdmin",
    does: "How much more usage the current price can absorb.",
    needs: ["stripe_platform", "tokens"],
    enriches: [],
    derived: "Margin against pool consumption.",
  },
  "pool-usage": {
    title: "Pool usage",
    screen: "PlatformAdmin",
    does: "How much of each tenant's allowance is spent.",
    needs: ["supabase"],
    enriches: [],
  },
  "audit-log": {
    title: "Audit log",
    screen: "PlatformAdmin",
    does: "Every platform-level write, with who made it and why.",
    needs: ["supabase"],
    enriches: [],
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
  /** When a field takes any one of several networks and none are on. */
  missingAnyOf: Source[];
  missingOptional: Source[];
}

export function resolveCapability(key: string, active: SourceId[]): Resolved {
  const capability = CAPABILITIES[key] ?? {
    title: key,
    screen: "",
    does: "This surface has no declared sources yet.",
    needs: [],
    enriches: [],
  };
  const has = (id: SourceId) => active.includes(id);
  const missingRequired = capability.needs.filter((id) => !has(id)).map((id) => SOURCE_BY_ID[id]);
  const anyOf = capability.anyOf ?? [];
  const anyOfSatisfied = anyOf.length === 0 || anyOf.some(has);
  const missingAnyOf = anyOfSatisfied ? [] : anyOf.map((id) => SOURCE_BY_ID[id]);
  const missingOptional = capability.enriches.filter((id) => !has(id)).map((id) => SOURCE_BY_ID[id]);

  /* Any required source missing means empty. A field standing on half a
     foundation is not "partially true" — it is guessing. */
  const state: CapabilityState =
    missingRequired.length > 0 || missingAnyOf.length > 0
      ? "empty"
      : missingOptional.length > 0
        ? "partial"
        : "ready";

  return { state, capability, missingRequired, missingAnyOf, missingOptional };
}

export const useCapability = (key: string): Resolved =>
  resolveCapability(key, useConnectedSources());

/** "10 / 15 fields live" — counted from the same map the widgets use. */
export function featureCount(active: SourceId[]) {
  const keys = Object.keys(CAPABILITIES);
  const live = keys.filter((k) => resolveCapability(k, active).state !== "empty").length;
  return { live, total: keys.length };
}

/** Which fields a single source is load-bearing for — used on the cards. */
export function fieldsFor(id: SourceId) {
  return Object.values(CAPABILITIES).filter(
    (c) => c.needs.includes(id) || (c.anyOf ?? []).includes(id),
  );
}

/** Which screens a single source is load-bearing for. */
export function surfacesFor(id: SourceId) {
  return Array.from(new Set(fieldsFor(id).map((c) => c.screen))).filter(Boolean);
}
