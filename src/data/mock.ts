/**
 * Fake data lives here and in ledger.ts — nowhere else.
 * Each export documents the query that replaces it.
 * The shapes are the contract the screens depend on.
 */

/** Confidence = agreement across signals, NOT probability of being correct.
 *  Those are different claims, and the difference is why the approve step
 *  exists. Keep the definition visible in the UI. */
export interface Proposal {
  id: string;
  org: string;
  agent: string;
  title: string;
  body: string;
  signals: string[];   // what agreed
  approved: boolean;
}

/** select id, org, agent, title, body, signals, approved
 *  from agent_proposals where approved is false order by created_at desc; */
export const PROPOSALS: Proposal[] = [
  {
    id: "p1",
    org: "uwazi",
    agent: "Inbox Triage",
    title: "Reply to Alex Sutter on Q2 partnership terms",
    body: "Draft acknowledges the revised revenue split and asks for the signed term sheet by Friday.",
    signals: ["Thread sentiment", "Calendar: call held Tue", "CRM stage: negotiation"],
    approved: false,
  },
  {
    id: "p2",
    org: "bin",
    agent: "Newsletter",
    title: "Schedule the March member digest",
    body: "Six items assembled from the last 14 days. Send window 9:00 CT Thursday.",
    signals: ["Open-rate history", "Publish cadence"],
    approved: false,
  },
  {
    id: "p3",
    org: "cc",
    agent: "Venue Scout",
    title: "Hold the Eastside loft for the April mixer",
    body: "Capacity 120, within budget, available on both candidate dates.",
    signals: ["Budget ceiling", "RSVP projection", "Prior venue ratings"],
    approved: true,
  },
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
];

export interface EmailItem {
  id: string;
  org: string;
  from: string;
  initials: string;
  subject: string;
  tone: "risk" | "warn" | "accent";
}

/** select id, org, from_name, subject, priority from email_threads
 *  where needs_attention order by received_at desc limit 6; */
export const EMAIL: EmailItem[] = [
  { id: "m1", org: "uwazi", from: "Alex Sutter", initials: "AS", subject: "Re: Q2 partnership terms", tone: "risk" },
  { id: "m2", org: "uwazi", from: "Mira Khan", initials: "MK", subject: "Notes from Tuesday's product sync", tone: "accent" },
  { id: "m3", org: "bin", from: "Devon Rios", initials: "DR", subject: "Updated deck — your review please", tone: "warn" },
];

export interface DueItem {
  id: string;
  org: string;
  title: string;
  project: string;
  due: string;
  tone: "risk" | "warn" | "accent";
}

/** select id, org, title, project, due_at from tasks
 *  where state <> 'done' and due_at < now() + interval '7 days'; */
export const DUE: DueItem[] = [
  { id: "t1", org: "uwazi", title: "Sign Uwazi funding doc", project: "Fundraise", due: "Today", tone: "risk" },
  { id: "t2", org: "bin", title: "Draft BIN newsletter", project: "Newsletter", due: "Tomorrow", tone: "warn" },
  { id: "t3", org: "cc", title: "Book Culture Club venue", project: "Events", due: "Fri", tone: "accent" },
  { id: "t4", org: "uwazi", title: "Refactor onboarding copy", project: "Platform", due: "Next week", tone: "accent" },
];

export function byScope<T extends { org: string }>(rows: T[], scope: string): T[] {
  return scope === "all" ? rows : rows.filter((r) => r.org === scope);
}
