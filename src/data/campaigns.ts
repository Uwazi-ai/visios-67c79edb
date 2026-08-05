/**
 * Campaigns — CPM read against its own benchmark, not against other
 * platforms.
 *
 * LinkedIn at $28.50 looks like the most expensive line on a bar chart and
 * is in fact the best buy on the board, because LinkedIn's own benchmark is
 * $35. Absolute bars answer a question nobody is asking.
 */

export interface Campaign {
  id: string;
  name: string;
  platform: string;
  org: string;
  color: string;
  spend: number;
  cpm: number;
  /** What this platform normally costs for this audience. */
  benchmark: number;
  status: "live" | "paused" | "ended";
}

export const CAMPAIGNS: Campaign[] = [
  { id: "c1", name: "Civic pilot — decision makers", platform: "LinkedIn", org: "uwazi", color: "#2563EB", spend: 6400, cpm: 28.5, benchmark: 35, status: "live" },
  { id: "c2", name: "Showcase tickets", platform: "Instagram", org: "cc", color: "#DB2777", spend: 3100, cpm: 11.2, benchmark: 9.5, status: "live" },
  { id: "c3", name: "Mentor intake", platform: "Meta", org: "bin", color: "#4F46E5", spend: 2200, cpm: 7.8, benchmark: 8.5, status: "live" },
  { id: "c4", name: "Pilot demo pre-roll", platform: "YouTube", org: "uwazi", color: "#DC2626", spend: 4300, cpm: 19.4, benchmark: 14, status: "live" },
  { id: "c5", name: "Founder thread boost", platform: "X", org: "uwazi", color: "#64748B", spend: 900, cpm: 6.1, benchmark: 6.4, status: "paused" },
  { id: "c6", name: "Cohort applications", platform: "TikTok", org: "bin", color: "#0D9488", spend: 1500, cpm: 5.2, benchmark: 4.1, status: "live" },
];

/** Signed deviation from the platform's own benchmark, as a percentage. */
export const deviation = (c: Campaign) => ((c.cpm - c.benchmark) / c.benchmark) * 100;

export const usd = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(n % 1 ? 2 : 0)}`;

/* ---------- Funnel ---------- */

export interface FunnelStep {
  label: string;
  value: number;
  /** What the step actually means, so "leads" is not four different things. */
  note: string;
}

export const FUNNEL: FunnelStep[] = [
  { label: "Impressions", value: 1840000, note: "Served, not necessarily seen" },
  { label: "Clicks", value: 22100, note: "1.2% — above the 0.9% we hold ourselves to" },
  { label: "Landed", value: 18400, note: "17% dropped before the page rendered" },
  { label: "Leads", value: 1240, note: "Form completed with a work address" },
  { label: "Qualified", value: 310, note: "Budget and timing confirmed by a human" },
];

/* ---------- Creative leaderboard ---------- */

export interface Creative {
  id: string;
  name: string;
  campaign: string;
  color: string;
  /** 0–100. The bands are what make it a decision rather than a ranking. */
  score: number;
  spend: number;
  cpl: number;
}

/**
 * Band thresholds are marked on the track for a reason: 74 and 76 sit one
 * point apart in the list and on opposite sides of a decision — one gets
 * more budget, the other gets rewritten.
 */
export const BANDS = { kill: 50, scale: 75 };

export const bandOf = (score: number): "kill" | "hold" | "scale" =>
  score < BANDS.kill ? "kill" : score < BANDS.scale ? "hold" : "scale";

export const BAND_LABEL: Record<"kill" | "hold" | "scale", string> = {
  kill: "Cut it",
  hold: "Keep, do not scale",
  scale: "Put money behind it",
};

export const CREATIVES: Creative[] = [
  { id: "cr1", name: "Resident-owned data — plain text", campaign: "Civic pilot", color: "#2563EB", score: 88, spend: 2400, cpl: 41 },
  { id: "cr2", name: "Committee room photo", campaign: "Civic pilot", color: "#2563EB", score: 76, spend: 1800, cpl: 58 },
  { id: "cr3", name: "Pilot demo — 15s cut", campaign: "Pilot demo", color: "#DC2626", score: 74, spend: 2100, cpl: 61 },
  { id: "cr4", name: "Showcase lineup carousel", campaign: "Showcase tickets", color: "#DB2777", score: 69, spend: 1400, cpl: 22 },
  { id: "cr5", name: "Mentor quote card", campaign: "Mentor intake", color: "#4F46E5", score: 54, spend: 900, cpl: 74 },
  { id: "cr6", name: "Stock office b-roll", campaign: "Cohort applications", color: "#0D9488", score: 31, spend: 1100, cpl: 168 },
];
