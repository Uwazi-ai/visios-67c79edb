/**
 * Raise — the pipeline is sized by money in play, never by deal count.
 *
 * A $250K grant sitting in diligence outweighs four $10K conversations at
 * intro. Count-sizing draws those as 1 against 4 and tells you to go work
 * the intros, which is exactly backwards.
 */

export type StageId =
  | "sourced"
  | "intro"
  | "qualified"
  | "pitched"
  | "diligence"
  | "term"
  | "committed"
  | "closed";

export interface Stage {
  id: StageId;
  label: string;
  /** What has to be true to leave this stage. */
  exit: string;
}

export const STAGES: Stage[] = [
  { id: "sourced", label: "Sourced", exit: "A named person, not an org" },
  { id: "intro", label: "Intro", exit: "They replied" },
  { id: "qualified", label: "Qualified", exit: "Budget and timing confirmed" },
  { id: "pitched", label: "Pitched", exit: "They have seen the numbers" },
  { id: "diligence", label: "Diligence", exit: "Their questions are answered" },
  { id: "term", label: "Term", exit: "Amount and conditions in writing" },
  { id: "committed", label: "Committed", exit: "Signed, unfunded" },
  { id: "closed", label: "Closed", exit: "Money landed" },
];

export interface Opportunity {
  id: string;
  name: string;
  org: string;
  /** Dollars in play, not a weighted expectation — weighting is a second
   *  opinion dressed up as a fact. */
  amount: number;
  stage: StageId;
  kind: "grant" | "equity" | "contract" | "sponsorship";
  /** Days since the last real exchange. */
  quiet: number;
  next: string;
}

export const OPPS: Opportunity[] = [
  { id: "o1", name: "Kauffman civic data pilot", org: "uwazi", amount: 250000, stage: "diligence", kind: "grant", quiet: 3, next: "Ownership model due Sep 5" },
  { id: "o2", name: "City of KC data contract", org: "uwazi", amount: 140000, stage: "pitched", kind: "contract", quiet: 11, next: "Procurement wants a reference" },
  { id: "o3", name: "Ewing Marion seed", org: "uwazi", amount: 75000, stage: "term", kind: "grant", quiet: 2, next: "Terms back Thursday" },
  { id: "o4", name: "Sprint Accelerator LP", org: "raia", amount: 500000, stage: "qualified", kind: "equity", quiet: 19, next: "No answer since the deck" },
  { id: "o5", name: "Hall Family Foundation", org: "bin", amount: 90000, stage: "committed", kind: "grant", quiet: 6, next: "Wire scheduled Sep 12" },
  { id: "o6", name: "Showcase title sponsor", org: "cc", amount: 35000, stage: "closed", kind: "sponsorship", quiet: 21, next: "Funded Aug 8" },
  { id: "o7", name: "Bank of KC community fund", org: "bin", amount: 25000, stage: "intro", kind: "grant", quiet: 8, next: "Warm intro from Renée" },
  { id: "o8", name: "Monarch venue partnership", org: "cc", amount: 12000, stage: "intro", kind: "sponsorship", quiet: 4, next: "Coffee Wednesday" },
  { id: "o9", name: "Regional arts council", org: "cc", amount: 18000, stage: "intro", kind: "grant", quiet: 30, next: "Cycle reopens October" },
  { id: "o10", name: "1Flock pilot conversion", org: "1flock", amount: 48000, stage: "pitched", kind: "contract", quiet: 5, next: "Pricing page walkthrough" },
];

export const money = (n: number) =>
  n >= 1000000
    ? `$${(n / 1000000).toFixed(2).replace(/0$/, "")}M`
    : n >= 1000
      ? `$${Math.round(n / 1000)}K`
      : `$${n}`;

export const moneyLong = (n: number) => `$${n.toLocaleString("en-US")}`;

export interface StageRoll {
  stage: Stage;
  amount: number;
  count: number;
  /** Percentage width on the ladder, floored so empty stages stay visible. */
  width: number;
}

/**
 * Width is money share with a 4% floor per stage. Without the floor an
 * empty stage collapses to nothing and the ladder silently loses a rung —
 * and an empty Diligence is a finding, not an absence.
 */
export const rollUp = (opps: Opportunity[]): StageRoll[] => {
  const rows = STAGES.map((stage) => {
    const mine = opps.filter((o) => o.stage === stage.id);
    return {
      stage,
      amount: mine.reduce((s, o) => s + o.amount, 0),
      count: mine.length,
      width: 0,
    };
  });
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const floor = 4;
  const free = 100 - floor * rows.length;
  return rows.map((r) => ({
    ...r,
    width: total === 0 ? 100 / rows.length : floor + (r.amount / total) * free,
  }));
};

/* ---------- Tier cap ---------- */

export const TIER = {
  name: "Starter",
  /** Ten opportunities. Ten dots — not a percentage, because you cannot
   *  half-open a deal. */
  cap: 10,
  next: "Operator",
  nextCap: 50,
  price: "$79/mo",
};

/* ---------- Runway ---------- */

export interface Runway {
  cash: number;
  burn: number;
  /** Whole months of cover — the fraction is not a month you can spend. */
  months: number;
  cliff: string;
  committedUnfunded: number;
  monthsWithCommitted: number;
}

export const RUNWAY: Runway = {
  cash: 412000,
  burn: 47500,
  months: 8,
  cliff: "Apr 2027",
  committedUnfunded: 90000,
  monthsWithCommitted: 10,
};
