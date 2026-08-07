/**
 * Notification catalogue — mirrors supabase/functions/_shared/notify.ts.
 * Defaults are conservative: a user spammed once turns everything off forever.
 */

export type DeliveryMode = "off" | "immediate" | "digest";

export interface EventDef {
  type: string;
  label: string;
  detail: string;
  group: string;
  email: DeliveryMode;
}

export const NOTIFICATION_EVENTS: EventDef[] = [
  { type: "dm_received", label: "Direct messages", detail: "Someone messages you directly", group: "People", email: "immediate" },
  { type: "mention", label: "Mentions", detail: "You are named in a thread", group: "People", email: "immediate" },
  { type: "member_joined", label: "Member joined", detail: "Someone accepts an invite", group: "People", email: "off" },
  { type: "proposal_pending", label: "Proposals waiting", detail: "An agent needs your commit", group: "Decisions", email: "digest" },
  { type: "proposal_expiring", label: "Proposals expiring", detail: "24 hours before a proposal leaves the queue", group: "Decisions", email: "digest" },
  { type: "task_assigned", label: "Task assigned to you", detail: "Someone hands you work", group: "Work", email: "immediate" },
  { type: "task_due", label: "Task due", detail: "A task you own is due", group: "Work", email: "digest" },
  { type: "meeting_soon", label: "Meeting starting", detail: "15 minutes before a meeting", group: "Time", email: "off" },
  { type: "meeting_brief_ready", label: "Meeting brief ready", detail: "A prep brief finished generating", group: "Time", email: "off" },
  { type: "connection_failed", label: "Connection failing", detail: "A source stopped returning data", group: "System", email: "immediate" },
  { type: "connection_expired", label: "Connection expired", detail: "Access needs re-authorising", group: "System", email: "immediate" },
  { type: "quota_warning", label: "Approaching a limit", detail: "Storage or plan usage near its ceiling", group: "System", email: "immediate" },
];

export const EVENT_GROUPS = ["People", "Decisions", "Work", "Time", "System"];

export const defaultEmailMode = (type: string): DeliveryMode =>
  NOTIFICATION_EVENTS.find((e) => e.type === type)?.email ?? "off";
