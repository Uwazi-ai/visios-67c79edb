import { ANY_ORG } from "@/lib/AppState";

/**
 * Chat — channels, DMs and threads, with one structural difference from
 * every other team messenger: agents are members.
 *
 * Bug Patrol does not post to a webhook feed nobody reads. It posts into
 * the engineering channel, with an AGENT badge, carrying the same gated
 * action card the rest of Kova uses. Humans reply in thread underneath it.
 * Without that this screen is a Slack clone competing with Slack.
 *
 * Action state lives on the message record, never in component state or
 * the DOM — reacting to any message re-renders the whole channel, and an
 * approved action silently reverting to pending is the worst possible bug
 * in a product whose entire claim is "a person committed to this".
 */

export type Presence = "online" | "away" | "offline";

export interface Author {
  id: string;
  name: string;
  initials: string;
  color: string;
  kind: "human" | "agent";
  /** Agents only: what it is allowed to do, shown on hover of the badge. */
  remit?: string;
  presence?: Presence;
}

export type ActionKind = "send" | "post" | "spend" | "delete" | "write";

export interface MessageAction {
  kind: ActionKind;
  title: string;
  /** Verbatim body of what would be written. */
  body: string;
  reach: string;
  ifIgnored: string;
}

export type ActionState = "pending" | "approved" | "declined";

export interface Message {
  id: string;
  channel: string;
  author: string;
  /** Minutes since the session's zero mark. Grouping compares whole minutes. */
  at: number;
  text: string;
  action?: MessageAction;
  /** Terminal once decided. Stored here, on the message, deliberately. */
  actionState?: ActionState;
  /** emoji -> author ids who reacted. */
  reactions: Record<string, string[]>;
  /** Thread replies, in order. Replies never carry actions of their own. */
  replies: Message[];
}

export interface Channel {
  id: string;
  name: string;
  org: string;
  kind: "channel" | "dm";
  /** DMs only: the other person. */
  peer?: string;
  topic?: string;
  unread: number;
}

export const ME = "me";

export const AUTHORS: Record<string, Author> = {
  me: { id: "me", name: "Myke", initials: "MY", color: "var(--ws-uwazi)", kind: "human", presence: "online" },
  dana: { id: "dana", name: "Dana Okoye", initials: "DO", color: "var(--ws-cc)", kind: "human", presence: "online" },
  sam: { id: "sam", name: "Sam Whitfield", initials: "SW", color: "var(--ws-bin)", kind: "human", presence: "away" },
  lena: { id: "lena", name: "Lena Cruz", initials: "LC", color: "var(--ws-raia)", kind: "human", presence: "offline" },
  marcus: { id: "marcus", name: "Marcus Bell", initials: "MB", color: "var(--ws-1flock)", kind: "human", presence: "online" },
  bugpatrol: {
    id: "bugpatrol",
    name: "Bug Patrol",
    initials: "BP",
    color: "var(--ws-all)",
    kind: "agent",
    remit: "Reads CI logs and the repo. Can open a pull request only on approval.",
  },
  ledger: {
    id: "ledger",
    name: "Ledger",
    initials: "LG",
    color: "var(--ws-all)",
    kind: "agent",
    remit: "Reads Stripe and the bank feed. Never moves money.",
  },
};

export const CHANNELS: Channel[] = [
  { id: "uwazi-eng", name: "uwazi-eng", org: "uwazi", kind: "channel", topic: "Shipping. CI noise goes here too.", unread: 3 },
  { id: "uwazi-gtm", name: "uwazi-gtm", org: "uwazi", kind: "channel", topic: "Pipeline and pricing", unread: 0 },
  { id: "cc-programming", name: "cc-programming", org: "cc", kind: "channel", topic: "Season 4 slate", unread: 1 },
  { id: "bin-community", name: "bin-community", org: "bin", kind: "channel", topic: "Members and events", unread: 0 },
  { id: "raia-deals", name: "raia-deals", org: "raia", kind: "channel", topic: "Diligence in flight", unread: 0 },
  { id: "general", name: "general", org: ANY_ORG, kind: "channel", topic: "Everyone, every venture", unread: 0 },
  { id: "dm-dana", name: "Dana Okoye", org: ANY_ORG, kind: "dm", peer: "dana", unread: 2 },
  { id: "dm-sam", name: "Sam Whitfield", org: ANY_ORG, kind: "dm", peer: "sam", unread: 0 },
  { id: "dm-marcus", name: "Marcus Bell", org: ANY_ORG, kind: "dm", peer: "marcus", unread: 0 },
];

let seq = 0;
const mk = (
  channel: string,
  author: string,
  at: number,
  text: string,
  extra: Partial<Message> = {},
): Message => ({
  id: `m${++seq}`,
  channel,
  author,
  at,
  text,
  reactions: {},
  replies: [],
  ...extra,
});

export const SEED: Message[] = [
  mk("uwazi-eng", "dana", 0, "Deploy 2.14 is out. Watching error rates for the next hour."),
  mk("uwazi-eng", "dana", 0, "Nothing in Sentry yet, which is either good or suspicious."),
  mk("uwazi-eng", "sam", 3, "Suspicious. The mapper changed shape in that release.", {
    reactions: { "👀": ["dana", "me"] },
  }),
  mk(
    "uwazi-eng",
    "bugpatrol",
    7,
    "Contact import has been dropping the `title` field since 2.14. 41 records affected in the last 6 hours. Cause is a rename in `mapContact` — the source key is now `job_title` and the mapper still reads `title`.",
    {
      action: {
        kind: "write",
        title: "Open PR with the one-line mapper fix",
        body: "// src/lib/mapContact.ts\n- title: row.title,\n+ title: row.job_title ?? row.title,",
        reach: "Opens a pull request on uwazi/core against main. No merge, no deploy — two reviewers still required.",
        ifIgnored: "Nothing is written. Imports keep dropping titles and the count keeps climbing.",
      },
      actionState: "pending",
      reactions: { "🔥": ["sam"] },
      replies: [
        mk("uwazi-eng", "sam", 9, "That matches what I saw. The rename was mine — I missed the mapper."),
        mk("uwazi-eng", "dana", 11, "Backfill for the 41 after the fix lands? I can write that."),
      ],
    },
  ),
  mk("uwazi-eng", "me", 14, "Reading it now."),

  mk("uwazi-gtm", "lena", 2, "Two inbound from the civic data post. Both mid-market."),
  mk("uwazi-gtm", "me", 5, "Route them to Dana — she has the pricing context."),
  mk(
    "uwazi-gtm",
    "ledger",
    12,
    "October collected is $61k against $74k invoiced. The gap is one invoice, 19 days out, from the same account that was late in August.",
    {
      action: {
        kind: "send",
        title: "Send the second reminder to Northshore",
        body: "Hi Priya — invoice #2214 ($13,200) is 19 days past due. Same as August, so I want to check whether the PO process changed on your side rather than just resend it.",
        reach: "One email to priya@northshore.co. Nothing else on the thread.",
        ifIgnored: "No email goes out. The invoice ages into the 30-day bucket on Friday.",
      },
      actionState: "pending",
    },
  ),

  mk("cc-programming", "dana", 1, "Season 4 slate is down to nine. Two need location locks this week."),
  mk("cc-programming", "marcus", 6, "I can hold the warehouse for the 14th if we decide by Thursday.", {
    reactions: { "✅": ["dana"] },
    replies: [mk("cc-programming", "dana", 8, "Thursday works. I'll confirm the budget line tomorrow.")],
  }),

  mk("bin-community", "sam", 4, "Member count crossed 1,200. Event RSVPs are the lagging number now."),
  mk("raia-deals", "lena", 3, "Diligence pack for the seed deal is in Knowledge. Two red flags in the cap table."),
  mk("general", "marcus", 2, "Reminder: the offsite doc is open for comments until Friday."),

  mk("dm-dana", "dana", 1, "Did you see Bug Patrol's finding in eng?"),
  mk("dm-dana", "dana", 1, "It's the same mapper we touched last month."),
  mk("dm-dana", "me", 4, "Just got there. Approving the PR, not the deploy."),
  mk("dm-sam", "sam", 2, "Sending the community numbers before standup."),
  mk("dm-marcus", "marcus", 0, "Warehouse walkthrough at 3 if you want to come."),
];

export const KIND_WORD: Record<ActionKind, string> = {
  send: "Sends a message",
  post: "Posts publicly",
  spend: "Moves money",
  delete: "Deletes records",
  write: "Writes to a repository",
};

export const QUICK_EMOJI = ["👍", "✅", "👀", "🔥", "🎯"];

/** Session zero, so relative minutes render as clock times. */
const ZERO = new Date();
ZERO.setHours(9, 12, 0, 0);

export const clock = (at: number) => {
  const d = new Date(ZERO.getTime() + at * 60000);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

/** Consecutive posts from the same person in the same minute drop the
 *  avatar and name. This single rule is what keeps a busy channel legible. */
export const grouped = (msg: Message, prev?: Message) =>
  !!prev && prev.author === msg.author && prev.at === msg.at && !prev.action && !msg.action;
