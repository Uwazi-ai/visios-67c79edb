/**
 * Agents — the run history and the hit rate, not a badge that says
 * "9 issues found".
 *
 * An agent that raises nine flags and is right about seven is useful. The
 * same agent reported as "9 issues found" is indistinguishable from one
 * that is right about two, and you cannot decide whether to keep listening
 * to it.
 */

export interface Run {
  /** Day offset back from today, 0 = today. */
  day: number;
  /** How many times it ran that day. Zero is a real value and is drawn. */
  runs: number;
  /** Calls it raised that day. */
  calls: number;
  /** Of those, how many turned out to be right. */
  correct: number;
  failed?: boolean;
}

export interface Agent {
  id: string;
  name: string;
  org: string;
  purpose: string;
  /** The judgement it makes, phrased as a claim it can be wrong about. */
  claim: string;
  state: "on" | "paused";
  /** What it may do without asking. Anything absent needs approval. */
  allowed: string[];
  gated: string[];
  history: Run[];
  lastCall: string;
}

/** 14 days of history, newest last, so the comb reads left-to-right in time. */
const comb = (spec: [number, number, number][], fails: number[] = []): Run[] =>
  spec.map(([runs, calls, correct], i) => ({
    day: 13 - i,
    runs,
    calls,
    correct,
    failed: fails.includes(13 - i) || undefined,
  }));

export const AGENTS: Agent[] = [
  {
    id: "a-bug",
    name: "Bug Patrol",
    org: "uwazi",
    purpose: "Watches the pilot error stream and the deploy log.",
    claim: "This error is a regression from the last deploy, not noise.",
    state: "on",
    allowed: ["Read logs", "Read the repo", "Post in #uwazi-eng"],
    gated: ["Open a PR", "Roll back a deploy"],
    lastCall: "Mapper drops the county field on null — one line",
    history: comb(
      [
        [24, 1, 1], [24, 0, 0], [24, 2, 1], [24, 1, 1], [23, 0, 0], [24, 3, 2], [24, 1, 0],
        [24, 0, 0], [24, 2, 2], [24, 1, 1], [24, 0, 0], [24, 2, 1], [24, 1, 1], [18, 1, 1],
      ],
      [3],
    ),
  },
  {
    id: "a-deal",
    name: "Deal Watch",
    org: "raia",
    purpose: "Reads the pipeline and the thread history behind each deal.",
    claim: "This opportunity is going quiet and will slip.",
    state: "on",
    allowed: ["Read pipeline", "Read email threads"],
    gated: ["Send a nudge", "Move a stage"],
    lastCall: "Sprint Accelerator LP — 19 days silent after the deck",
    history: comb([
      [4, 1, 1], [4, 0, 0], [4, 1, 0], [4, 2, 2], [4, 0, 0], [4, 1, 1], [4, 0, 0],
      [4, 1, 1], [4, 0, 0], [4, 1, 0], [4, 1, 1], [4, 0, 0], [4, 1, 1], [3, 0, 0],
    ]),
  },
  {
    id: "a-content",
    name: "Content Scout",
    org: "cc",
    purpose: "Reads the calendar, the drafts and last month's performance.",
    claim: "This gap will cost reach, and here is what fills it.",
    state: "on",
    allowed: ["Read calendar", "Read analytics", "Write drafts"],
    gated: ["Schedule a post", "Publish", "Spend on boost"],
    lastCall: "Sep 14–18 is empty — five working days, no draft in the queue",
    history: comb(
      [
        [2, 1, 0], [2, 1, 1], [2, 0, 0], [2, 2, 1], [2, 0, 0], [2, 1, 1], [2, 1, 0],
        [2, 0, 0], [2, 1, 1], [2, 0, 0], [2, 2, 1], [2, 0, 0], [2, 1, 1], [1, 1, 1],
      ],
      [9],
    ),
  },
  {
    id: "a-inbox",
    name: "Inbox Triage",
    org: "__any",
    purpose: "Sorts the inbox and drafts replies for the ones that matter.",
    claim: "This thread needs you today, and here is the reply.",
    state: "on",
    allowed: ["Read mail", "Draft replies"],
    gated: ["Send", "Archive", "Forward"],
    lastCall: "Kauffman — ownership model, four days before the deadline",
    history: comb([
      [96, 6, 5], [96, 4, 4], [96, 5, 3], [96, 7, 6], [94, 3, 3], [96, 5, 4], [96, 6, 5],
      [96, 4, 3], [96, 5, 5], [96, 6, 4], [96, 3, 3], [96, 5, 4], [96, 6, 6], [72, 4, 4],
    ]),
  },
];

export interface HitRate {
  calls: number;
  correct: number;
  pct: number;
  runs: number;
  failedDays: number;
}

export const hitRate = (a: Agent): HitRate => {
  const calls = a.history.reduce((s, r) => s + r.calls, 0);
  const correct = a.history.reduce((s, r) => s + r.correct, 0);
  return {
    calls,
    correct,
    pct: calls ? Math.round((correct / calls) * 100) : 0,
    runs: a.history.reduce((s, r) => s + r.runs, 0),
    failedDays: a.history.filter((r) => r.failed).length,
  };
};

/** Phrased as a claim with a score, never as a count of "issues found". */
export const hitPhrase = (h: HitRate) =>
  `${h.calls} at-risk call${h.calls === 1 ? "" : "s"} · ${h.correct} were right`;
