import { ANY_ORG } from "@/lib/AppState";
import { CONNECTIONS } from "@/data/connections";
import { DOCS } from "@/data/knowledge";

/**
 * Vision — a chat assistant that reads across every venture.
 *
 * Two structural commitments, neither of them prompt wording:
 *
 * 1. TOOL CALLS ARE VISIBLE, including the ones that failed or were denied.
 *    An assistant that says "your pipeline is broken" should be checkable:
 *    you can see it read the logs instead of taking its word. Hiding the
 *    calls makes the product feel effortless and makes every claim
 *    unfalsifiable, which is a bad trade for anyone running real money.
 *
 * 2. SIDE EFFECTS ARE GATED. The model returns an *intent*. The write
 *    happens on approval and only on approval. Send, post, spend and delete
 *    stop here every time — there is no confidence score that skips it.
 *
 * Replace with: a streaming endpoint returning message parts plus a tool
 * trace. Keep the trace in the response body, not in a debug panel — the
 * point is that a normal user sees it.
 */

export type CallStatus = "ok" | "denied" | "failed";

export interface ToolCall {
  tool: string;
  args: Record<string, string | number>;
  /** Milliseconds. Real latency, shown because slow reads explain slow answers. */
  ms: number;
  status: CallStatus;
  /** One line of what came back — or why nothing did. */
  result: string;
}

/** Actions that always stop at a person. Not configurable. */
export type EffectKind = "send" | "post" | "spend" | "delete";

export interface Proposal {
  kind: EffectKind;
  title: string;
  /** The body of what would be written, verbatim. */
  body: string;
  /** Who this reaches if approved, stated in people not in jargon. */
  reach: string;
  /** What happens if you do nothing. Always the safe branch. */
  ifIgnored: string;
}

export interface Turn {
  id: string;
  role: "user" | "vision";
  text: string;
  calls?: ToolCall[];
  proposal?: Proposal;
  /** Rendered under the answer when part of it is inference, not record. */
  inferred?: string;
}

export interface Exchange {
  id: string;
  /** Shown as a starter prompt. */
  prompt: string;
  /** Words that route a typed question to this exchange. */
  keys: string[];
  org: string;
  answer: Omit<Turn, "id" | "role">;
}

export const EXCHANGES: Exchange[] = [
  /* The blocked-read case. This is the one that has to work: revenue is
     exactly where a confabulated number does the most damage, so the answer
     stops at what delivery activity can support and labels the rest. */
  {
    id: "revenue",
    prompt: "Where is revenue landing this month?",
    keys: ["revenue", "money", "mrr", "cash", "billing", "invoice", "stripe", "income"],
    org: ANY_ORG,
    answer: {
      text:
        "I can only answer this partway. Stripe reads are blocked, so I have no billed figure for August — not a stale one, none. What I can see is delivery: 3 client engagements shipped milestones this month (Hoop Tea activation, 1Flock handoff, Ascend cohort 3), and the signed scopes behind them total $184k, of which $61k is milestone-billable now. Two invoices for July are still open at $38k.",
      calls: [
        {
          tool: "stripe.charges.list",
          args: { period: "2026-08", status: "succeeded" },
          ms: 240,
          status: "denied",
          result: "Key rejected 3 days ago. No revenue figure available from source.",
        },
        {
          tool: "stripe.invoices.list",
          args: { status: "open" },
          ms: 198,
          status: "denied",
          result: "Same credential. Open-invoice total below is from the contract records, not Stripe.",
        },
        {
          tool: "db.query",
          args: { table: "deliverables", filter: "shipped_at >= 2026-08-01" },
          ms: 84,
          status: "ok",
          result: "3 engagements with milestones marked shipped.",
        },
        {
          tool: "kb.search",
          args: { q: "scope of work billing milestones", top_k: 4 },
          ms: 310,
          status: "ok",
          result: "Hoop Tea SOW, 1Flock handoff, Q2 retrospectives.",
        },
        {
          tool: "slack.history",
          args: { channel: "#ops", days: 30 },
          ms: 1240,
          status: "failed",
          result: "Missing channels:history scope. Any billing chatter in #ops is not in this answer.",
        },
      ],
      inferred:
        "The $61k is inferred from signed scopes and shipped milestones — it is what we are entitled to bill, not what anyone has paid. Do not put it in a board update as revenue. Reconnect Stripe and ask again for the real number.",
    },
  },

  {
    id: "risk",
    prompt: "What is at risk this week?",
    keys: ["risk", "slip", "late", "behind", "blocked", "week", "deadline"],
    org: ANY_ORG,
    answer: {
      text:
        "One thing, and it is a hard date. The Hoop Tea pour-station permit has to be filed 21 days ahead and the activation is in 19 days — you are two days past the window, so this is now an exception request rather than a filing. Everything else can absorb a week: the Ascend mentor matching closes in 6 days with 4 of 11 matched, which is uncomfortable but not yet late.",
      calls: [
        {
          tool: "tasks.query",
          args: { scope: "all", due_within_days: 14, status: "open" },
          ms: 62,
          status: "ok",
          result: "18 open, 2 overdue.",
        },
        {
          tool: "kb.search",
          args: { q: "permit lead time activation", top_k: 3 },
          ms: 287,
          status: "ok",
          result: "Hoop Tea SOW: 21-day permit filing requirement.",
        },
        {
          tool: "calendar.freebusy",
          args: { range: "next_21d" },
          ms: 141,
          status: "ok",
          result: "Activation date confirmed on the Culture Club calendar.",
        },
      ],
    },
  },

  {
    id: "post",
    prompt: "Tell the ops channel the permit is late.",
    keys: ["slack", "channel", "post", "ops", "tell", "announce", "message"],
    org: "cc",
    answer: {
      text:
        "I drafted it. I have not posted it — posting is public and lands on other people's screens, so it waits for you.",
      calls: [
        {
          tool: "slack.channels.info",
          args: { channel: "#ops" },
          ms: 96,
          status: "ok",
          result: "6 members. Posting scope granted for this channel.",
        },
        {
          tool: "tasks.get",
          args: { id: "hoop-permit" },
          ms: 44,
          status: "ok",
          result: "Due 2 days ago, unassigned.",
        },
      ],
      proposal: {
        kind: "post",
        title: "Post to #ops",
        body:
          "Heads up: the pour-station permit missed the 21-day window by two days. Filing it today as an exception request. If anyone has a contact at the licensing office, say so in the next hour — otherwise we proceed on the standard queue.",
        reach: "6 people in the channel",
        ifIgnored: "Nothing is posted. The draft stays here.",
      },
    },
  },

  {
    id: "send",
    prompt: "Reply to the licensing office about the permit.",
    keys: ["email", "reply", "draft", "mail", "send", "respond", "licensing"],
    org: "cc",
    answer: {
      text:
        "Drafted against the thread from Tuesday. It stays in your outbox until you approve — I do not hold a send permission at any confidence level.",
      calls: [
        {
          tool: "gmail.threads.search",
          args: { q: "from:licensing permit", newer_than: "14d" },
          ms: 420,
          status: "ok",
          result: "1 thread, last message Tue 09:14.",
        },
        {
          tool: "kb.search",
          args: { q: "permit exception request wording", top_k: 3 },
          ms: 265,
          status: "ok",
          result: "No template on file — drafted from the thread instead.",
        },
        {
          tool: "gmail.send",
          args: { to: "licensing@county.gov" },
          ms: 0,
          status: "denied",
          result: "Send is permanently ungranted. Returned an intent instead of performing the action.",
        },
      ],
      proposal: {
        kind: "send",
        title: "Send email to licensing@county.gov",
        body:
          "Following up on our Tuesday thread — we are filing the pour-station permit as an exception request, two days outside the standard window. The event date is fixed and the site plan is unchanged from the application you already have. Happy to provide anything further today.",
        reach: "1 recipient, outside your organisation",
        ifIgnored: "Nothing is sent. The draft is not saved to Gmail either.",
      },
    },
  },

  {
    id: "spend",
    prompt: "Pay the expedite fee for the permit.",
    keys: ["pay", "spend", "buy", "fee", "purchase", "expedite", "card"],
    org: "cc",
    answer: {
      text:
        "I can see the fee and the approval rule, and I cannot pay it. $340 sits under the $5,000 second-signature line, which means one approval — yours — not zero.",
      calls: [
        {
          tool: "kb.search",
          args: { q: "spend approval matrix limits", top_k: 2 },
          ms: 231,
          status: "ok",
          result: "Above $5,000 needs a second signature. No agent holds a signature at any amount.",
        },
        {
          tool: "payments.charge",
          args: { amount_usd: 340, vendor: "County licensing" },
          ms: 0,
          status: "denied",
          result: "No agent holds a payment credential. Intent returned for approval.",
        },
      ],
      proposal: {
        kind: "spend",
        title: "Pay $340 expedite fee",
        body:
          "County licensing — pour-station permit expedite fee, $340, charged to the Culture Club card ending 4471. Non-refundable once filed.",
        reach: "$340, non-refundable",
        ifIgnored: "No charge. The permit stays in the standard queue, roughly 9 working days.",
      },
    },
  },
];

/**
 * Route a typed question to a scripted exchange.
 *
 * When nothing matches, say so plainly rather than generating a
 * confident-sounding paragraph — an unscripted shell inventing a revenue
 * number is the exact failure this screen exists to argue against.
 */
export function route(query: string): Exchange | null {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let best: { ex: Exchange; hits: number } | null = null;
  for (const ex of EXCHANGES) {
    const hits = ex.keys.filter((k) => words.includes(k)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { ex, hits };
  }
  return best?.ex ?? null;
}

export const UNROUTED: Omit<Turn, "id" | "role"> = {
  text:
    "I don't have a grounded answer for that in this session. Rather than write something that reads like one, here is what I actually reached for and what came back empty.",
  calls: [
    { tool: "kb.search", args: { q: "…", top_k: 5 }, ms: 274, status: "ok", result: "No passage above the relevance threshold." },
    { tool: "db.query", args: { table: "activity", days: 30 }, ms: 71, status: "ok", result: "Nothing matching." },
  ],
};

/* ------------------------------------------------------------------ */
/* Session visibility                                                   */
/* ------------------------------------------------------------------ */

export interface Sight {
  name: string;
  detail: string;
  blocked: boolean;
}

/**
 * What Vision can see *this session*, derived from the same connection and
 * index records the rest of the app reads — not a hand-written list that
 * drifts. A source Vision cannot read is shown here, marked, rather than
 * omitted: an absent row looks like a source that doesn't exist, and the
 * user never learns the answer was narrower than it looked.
 */
export function sightlines(inScope: (org?: string | null) => boolean): Sight[] {
  const rows: Sight[] = CONNECTIONS.filter((c) => inScope(c.org)).map((c) => ({
    name: c.name,
    detail: c.detail,
    blocked: c.health === "down" || c.health === "off" || c.health === "warn",
  }));

  const docs = DOCS.filter((d) => inScope(d.org));
  const waiting = docs.filter((d) => !d.indexed).length;
  rows.push({
    name: "Knowledge base",
    detail:
      waiting > 0
        ? `${docs.length - waiting} documents readable · ${waiting} uploaded but not embedded, so they cannot be cited`
        : `${docs.length} documents readable`,
    blocked: waiting > 0,
  });

  return rows;
}
