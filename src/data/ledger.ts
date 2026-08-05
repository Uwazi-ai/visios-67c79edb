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
