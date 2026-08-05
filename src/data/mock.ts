/**
 * Fake data lives here and in ledger.ts — nowhere else.
 * Each export documents the query that replaces it.
 * The shapes are the contract the screens depend on.
 */

import { ANY_ORG } from "@/lib/AppState";

/** Confidence = agreement across signals, NOT probability of being correct.
 *  Those are different claims, and the difference is why the approve step
 *  exists. Keep the definition visible in the UI. */
export type ProposalStatus = "pending" | "approved" | "rejected";

export interface Proposal {
  id: string;
  org: string;
  agent: "Bug Patrol" | "Growth Radar" | "Sprint Commander" | "Content Studio";
  /** What the agent wants to do, in one line. */
  claim: string;
  /** Why it thinks so. */
  rationale: string;
  /** 0–1. Agreement across signals. */
  confidence: number;
  signals: string[];
  /** State lives on the record. Never read approval back out of the DOM —
   *  a re-render would revert an approved item to pending. */
  status: ProposalStatus;
}

/** select id, org, agent, claim, rationale, confidence, signals, status
 *  from agent_proposals order by confidence desc; */
export const PROPOSALS: Proposal[] = [
  {
    id: "p1",
    org: "uwazi",
    agent: "Bug Patrol",
    claim: "Roll back the booking-slot cache to yesterday's build",
    rationale:
      "Slot collisions started 14 hours ago and track the cache deploy exactly. Nine bookings double-booked since.",
    confidence: 0.91,
    signals: ["Error rate +340%", "Deploy timestamp match", "9 duplicate bookings", "No schema change"],
    status: "pending",
  },
  {
    id: "p2",
    org: "cc",
    agent: "Growth Radar",
    claim: "Move the April mixer invite send to Thursday 09:00",
    rationale:
      "Thursday morning sends have outperformed Tuesday by 22 points on opens across the last eleven campaigns.",
    confidence: 0.78,
    signals: ["11-campaign open history", "Venue confirmed", "List growth +6%"],
    status: "pending",
  },
  {
    id: "p3",
    org: "uwazi",
    agent: "Sprint Commander",
    claim: "Split the Civic Intel scraper epic into three tickets",
    rationale:
      "It has been open 19 days with four assignees touching it. Every comparable epic that shipped was split first.",
    confidence: 0.64,
    signals: ["19 days open", "4 assignees", "No closed subtasks"],
    status: "pending",
  },
  {
    id: "p4",
    org: "bin",
    agent: "Content Studio",
    claim: "Publish the member digest with the six assembled items",
    rationale:
      "Six items cleared review and the cadence gap is now 17 days against a 14-day target.",
    confidence: 0.83,
    signals: ["6 items ready", "Cadence gap 17d", "Editor sign-off"],
    status: "approved",
  },
  {
    id: "p5",
    org: ANY_ORG,
    agent: "Growth Radar",
    claim: "Consolidate the three venture newsletters into one shared footer",
    rationale: "Footer variants diverged across ventures; one template would cut maintenance.",
    confidence: 0.41,
    signals: ["3 template variants", "Low engagement delta"],
    status: "rejected",
  },
];

/** Sources the brief could not read. A brief that silently omits a dead
 *  source is worse than one that admits it, because you read it as complete. */
export const MISSING_SOURCES: { name: string; reason: string }[] = [
  { name: "Stripe", reason: "read blocked" },
  { name: "LinkedIn", reason: "token expired" },
];


export interface EventItem {
  id: string;
  org: string;
  at: string;
  title: string;
  who: string;
  conflict?: boolean;
}

/** select id, org, starts_at, title, attendees from events
 *  where starts_at::date = current_date order by starts_at; */
export const EVENTS: EventItem[] = [
  { id: "e1", org: "uwazi", at: "09:00", title: "Platform standup", who: "Eng" },
  { id: "e2", org: "uwazi", at: "11:30", title: "Funder call — Wexler", who: "Myke, Mira" },
  { id: "e3", org: "cc", at: "11:45", title: "Venue walkthrough", who: "Devon", conflict: true },
  { id: "e4", org: "bin", at: "15:00", title: "Editorial review", who: "Alex" },
  { id: "e5", org: ANY_ORG, at: "16:30", title: "All-hands — every venture", who: "Everyone" },
];

export interface EmailItem {
  id: string;
  org: string;
  from: string;
  initials: string;
  subject: string;
  /** Days since they wrote and nobody replied. 7+ is a lead candidate. */
  waitingDays: number;
  tone: "risk" | "warn" | "accent";
}

/** select id, org, from_name, subject, priority,
 *         extract(day from now() - last_inbound_at) as waiting_days
 *  from email_threads where needs_attention order by waiting_days desc; */
export const EMAIL: EmailItem[] = [
  { id: "m1", org: "uwazi", from: "Alex Sutter", initials: "AS", subject: "Re: Q2 partnership terms", waitingDays: 11, tone: "risk" },
  { id: "m2", org: "bin", from: "Devon Rios", initials: "DR", subject: "Updated deck — your review please", waitingDays: 8, tone: "warn" },
  { id: "m3", org: "cc", from: "Priya Nandi", initials: "PN", subject: "Loft contract — signature needed", waitingDays: 4, tone: "warn" },
  { id: "m4", org: "uwazi", from: "Mira Khan", initials: "MK", subject: "Notes from Tuesday's product sync", waitingDays: 1, tone: "accent" },
];

export interface DueItem {
  id: string;
  org: string;
  title: string;
  project: string;
  due: string;
  /** Explicit, not parsed from the label. */
  dueToday: boolean;
  overdue?: boolean;
  tone: "risk" | "warn" | "accent";
}

/** select id, org, title, project, due_at from tasks
 *  where state <> 'done' and due_at < now() + interval '7 days'; */
export const DUE: DueItem[] = [
  { id: "t1", org: "uwazi", title: "Sign Uwazi funding doc", project: "Fundraise", due: "Today", dueToday: true, tone: "risk" },
  { id: "t2", org: "bin", title: "Draft BIN newsletter", project: "Newsletter", due: "Tomorrow", dueToday: false, tone: "warn" },
  { id: "t3", org: "cc", title: "Book Culture Club venue", project: "Events", due: "Fri", dueToday: false, tone: "accent" },
  { id: "t4", org: "uwazi", title: "Refactor onboarding copy", project: "Platform", due: "Next week", dueToday: false, tone: "accent" },
  { id: "t5", org: ANY_ORG, title: "Sign the shared insurance renewal", project: "Operations", due: "Thu", dueToday: false, tone: "warn" },
  { id: "t6", org: "cc", title: "Confirm caterer headcount", project: "Events", due: "Today", dueToday: true, tone: "warn" },
];


/**
 * Scope filter. "__any" rows belong to no single venture — a general
 * channel, a shared doc, a platform notice — and survive every filter.
 * Drop that clause and the cross-org layer vanishes the moment a founder
 * scopes down, which is exactly when they still need it.
 */
export function byScope<T extends { org: string }>(rows: T[], scope: string): T[] {
  return rows.filter((r) => scope === "all" || r.org === scope || r.org === ANY_ORG);
}
