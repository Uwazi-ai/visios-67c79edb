/**
 * Task ledger — the single source for every throughput number.
 *
 * Replace with:
 *   select closed_at, org, project, assignee
 *   from tasks where state='done' and closed_at > now() - interval '56 days';
 *
 * Keep this shape and no UI changes are needed.
 */

export interface LedgerRow {
  closed_at: string; // ISO date
  org: string;       // workspace id
  project: string;
  assignee: string;
}

const ORGS = ["uwazi", "bin", "cc"] as const;
const PROJECTS: Record<string, string[]> = {
  uwazi: ["Platform", "Civic Intel", "Fundraise"],
  bin: ["Newsletter", "Membership"],
  cc: ["Events", "Partnerships"],
};
const PEOPLE: Record<string, string[]> = {
  uwazi: ["Myke", "Devon Rios", "Mira Khan"],
  bin: ["Alex Sutter", "Mira Khan"],
  cc: ["Devon Rios", "Alex Sutter"],
};

/** Deterministic pseudo-random so renders and tests agree. */
function seeded(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function build(): LedgerRow[] {
  const rows: LedgerRow[] = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  for (let dayBack = 0; dayBack < 56; dayBack++) {
    const d = new Date(today);
    d.setDate(d.getDate() - dayBack);
    const weekend = d.getDay() === 0 || d.getDay() === 6;

    for (let i = 0; i < ORGS.length; i++) {
      const org = ORGS[i];
      const base = weekend ? 0.6 : 3.2;
      const r = seeded(dayBack * 7 + i * 31);
      const count = Math.round(base * (0.4 + r * 1.5));

      for (let k = 0; k < count; k++) {
        const rp = seeded(dayBack * 13 + i * 17 + k * 3);
        const projects = PROJECTS[org];
        const people = PEOPLE[org];
        rows.push({
          closed_at: d.toISOString(),
          org,
          project: projects[Math.floor(rp * projects.length) % projects.length],
          assignee: people[Math.floor(rp * 100) % people.length],
        });
      }
    }
  }
  return rows;
}

export const LEDGER: LedgerRow[] = build();

/** Throughput is derived at render time, never precomputed — that is what
 *  lets the workspace scope filter it. */
export function scoped(scope: string): LedgerRow[] {
  return scope === "all" ? LEDGER : LEDGER.filter((r) => r.org === scope);
}

const DAY = 86_400_000;

export interface Throughput {
  weeks: number[];        // oldest → newest, 8 buckets
  projection: number;     // flat trailing mean, NOT a trend
  total: number;
  deltaPct: number | null; // null when the sample is too small to mean anything
  noisy: boolean;
  byPerson: { name: string; closes: number }[];
}

export function throughput(scope: string): Throughput {
  const rows = scoped(scope);
  const now = Date.now();
  const weeks = new Array(8).fill(0);

  for (const r of rows) {
    const age = Math.floor((now - new Date(r.closed_at).getTime()) / (7 * DAY));
    if (age >= 0 && age < 8) weeks[7 - age] += 1;
  }

  const total = rows.length;
  // Flat trailing mean. A projection with growth baked in reads as a
  // forecast nobody approved.
  const trailing = weeks.slice(-4);
  const projection = Math.round(trailing.reduce((a, b) => a + b, 0) / trailing.length);

  const last = weeks[7];
  const prev = weeks[6];
  // Under 40 closes the percentage is noise. Small orgs always swing wildly.
  const noisy = total < 40;
  const deltaPct = noisy || prev === 0 ? null : Math.round(((last - prev) / prev) * 100);

  const tally = new Map<string, number>();
  for (const r of rows) tally.set(r.assignee, (tally.get(r.assignee) ?? 0) + 1);
  const byPerson = [...tally.entries()]
    .map(([name, closes]) => ({ name, closes }))
    .sort((a, b) => b.closes - a.closes);

  return { weeks, projection, total, deltaPct, noisy, byPerson };
}

/* ============================================================
   Daily derivations. Everything below is computed from LEDGER at call
   time — nothing is precomputed and cached, which is exactly what lets
   the workspace scope filter it. Change scope, call again, get a
   different comb from the same rows.
   ============================================================ */

/** Closes per day for the last `n` days, oldest → newest. */
export function dailyCloses(scope: string, n: number): number[] {
  const rows = scoped(scope);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = today.getTime() - (n - 1) * DAY;

  const out = new Array(n).fill(0);
  for (const r of rows) {
    const t = new Date(r.closed_at);
    t.setHours(0, 0, 0, 0);
    const idx = Math.round((t.getTime() - start) / DAY);
    if (idx >= 0 && idx < n) out[idx] += 1;
  }
  return out;
}

export const RECORDED_DAYS = 30;
export const PROJECTED_DAYS = 16;
export const COMB_BARS = RECORDED_DAYS + PROJECTED_DAYS; // 46

export interface Comb {
  recorded: number[];   // 30 real days, oldest → newest
  projected: number[];  // 16 flat days
  /** Trailing 10-day mean. Flat on purpose. */
  mean: number;
  /** Closes inside the current scope across the recorded window. */
  closes: number;
  /** Under 40 the percentage is noise and the UI must say so. */
  thin: boolean;
}

/**
 * The projection is a flat trailing 10-day mean. No trend is baked in.
 *
 * A projection with growth in it reads as a forecast — something a person
 * signed off on — when it is only arithmetic on the last ten days. If the
 * line slopes up, a founder plans against it. Keep it flat and caption it.
 */
export function comb(scope: string): Comb {
  const recorded = dailyCloses(scope, RECORDED_DAYS);
  const trailing = recorded.slice(-10);
  const mean = trailing.reduce((a, b) => a + b, 0) / trailing.length;
  const projected = new Array(PROJECTED_DAYS).fill(mean);
  const closes = recorded.reduce((a, b) => a + b, 0);
  return { recorded, projected, mean, closes, thin: closes < 40 };
}

export const VELOCITY_DAYS = 40;

export interface Velocity {
  days: number[];
  /** Real indices, found in the data. Hardcode a position and swapping the
   *  data leaves the annotation lying about which day it points at. */
  peakIdx: number;
  lowIdx: number;
  peak: number;
  low: number;
  labels: string[];
}

export function velocity(scope: string): Velocity {
  const days = dailyCloses(scope, VELOCITY_DAYS);
  let peakIdx = 0;
  let lowIdx = 0;
  for (let i = 1; i < days.length; i++) {
    if (days[i] > days[peakIdx]) peakIdx = i;
    if (days[i] < days[lowIdx]) lowIdx = i;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const labels = days.map((_, i) => {
    const d = new Date(today.getTime() - (VELOCITY_DAYS - 1 - i) * DAY);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  });
  return { days, peakIdx, lowIdx, peak: days[peakIdx], low: days[lowIdx], labels };
}

