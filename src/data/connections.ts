import { ANY_ORG } from "@/lib/AppState";

/**
 * Connections and guardrails.
 *
 * select provider, status, detail, last_sync_at from integrations
 * where tenant_id = current_tenant_id();
 */

export type Health = "ok" | "warn" | "down" | "off";

export interface Connection {
  id: string;
  name: string;
  /** Which venture's account this is wired to. */
  org: string;
  health: Health;
  /** What the badge means in plain words — a coloured dot alone tells the
   *  user something is wrong without telling them what or what to do. */
  detail: string;
  scopes: string;
}

export const CONNECTIONS: Connection[] = [
  {
    id: "supabase",
    name: "Supabase",
    org: ANY_ORG,
    health: "ok",
    detail: "Synced 2 minutes ago",
    scopes: "Read and write · all tables under your tenant",
  },
  {
    id: "make",
    name: "Make.com",
    org: ANY_ORG,
    health: "ok",
    detail: "14 scenarios · last run 08:40",
    scopes: "Trigger scenarios · read run history",
  },
  {
    id: "gmail",
    name: "Gmail",
    org: "uwazi",
    health: "ok",
    detail: "Synced 6 minutes ago",
    scopes: "Read threads · create drafts. No send.",
  },
  {
    id: "gcal",
    name: "Google Calendar",
    org: "uwazi",
    health: "ok",
    detail: "Synced 6 minutes ago",
    scopes: "Read events · propose holds",
  },
  {
    id: "slack",
    name: "Slack",
    org: "cc",
    health: "warn",
    detail: "Missing channels:history — the brief cannot read #ops",
    scopes: "Read channels · post to approved channels only",
  },
  {
    id: "stripe",
    name: "Stripe",
    org: "raia",
    health: "down",
    detail: "Read blocked — key rejected 3 days ago. Revenue is stale everywhere.",
    scopes: "Read charges and payouts. No refunds, no writes.",
  },
  {
    id: "airtable",
    name: "Airtable",
    org: "bin",
    health: "off",
    detail: "Not connected",
    scopes: "—",
  },
];

export interface Guardrail {
  id: string;
  label: string;
  detail: string;
  /** Enabled-by-default reading and drafting are yours to switch off.
   *  The acting permissions are not switchable at all — see below. */
  locked?: boolean;
  /** Why it is locked, shown next to the control. */
  reason?: string;
  initial: boolean;
}

/**
 * The bottom four are rendered disabled and are genuinely non-functional:
 * no handler, no state, `disabled` on the input. Approval before an agent
 * acts in the world is the product. A settings screen that offers a switch
 * to turn the product off is either lying about the switch or lying about
 * the product, and both cost more trust than the toggle is worth.
 */
export const GUARDRAILS: Guardrail[] = [
  { id: "read-mail", label: "Read email and calendar", detail: "Agents can see threads and events in connected accounts.", initial: true },
  { id: "read-docs", label: "Read documents and knowledge base", detail: "Indexed files are available as context.", initial: true },
  { id: "draft-mail", label: "Draft replies", detail: "Drafts land in your mail client. Nothing leaves.", initial: true },
  { id: "draft-posts", label: "Draft social posts and campaigns", detail: "Written to the queue as proposals.", initial: true },
  { id: "suggest-tasks", label: "Propose tasks and reschedules", detail: "Appears on the dashboard for approval.", initial: true },
  {
    id: "send-mail",
    label: "Send email without approval",
    detail: "Every send goes through you. An agent that mails a funder on a hunch is not a feature.",
    locked: true,
    reason: "Permanently off",
    initial: false,
  },
  {
    id: "publish",
    label: "Publish posts without approval",
    detail: "Publishing is public and permanent. It waits for a person.",
    locked: true,
    reason: "Permanently off",
    initial: false,
  },
  {
    id: "spend",
    label: "Spend money without approval",
    detail: "No agent holds a card. Payments are approved one at a time.",
    locked: true,
    reason: "Permanently off",
    initial: false,
  },
  {
    id: "delete",
    label: "Delete records without approval",
    detail: "Deletion is the one action nobody can review after the fact.",
    locked: true,
    reason: "Permanently off",
    initial: false,
  },
];
