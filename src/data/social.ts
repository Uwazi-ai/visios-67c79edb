/**
 * Social — a month of content, the empty stretches included.
 *
 * The mirror chart is the point: organic above the axis, paid below. Two
 * separate lines let amplification and substitution look identical. On a
 * mirror, one shape grows on both sides and the other trades one for the
 * other, and you can see which you bought.
 */

export type Platform = "linkedin" | "instagram" | "x" | "youtube" | "newsletter";

export interface PlatformDef {
  id: Platform;
  label: string;
  color: string;
}

export const PLATFORMS: PlatformDef[] = [
  { id: "linkedin", label: "LinkedIn", color: "var(--sw-blue)" },
  { id: "instagram", label: "Instagram", color: "var(--sw-magenta)" },
  { id: "x", label: "X", color: "var(--sw-slate)" },
  { id: "youtube", label: "YouTube", color: "var(--sw-red)" },
  { id: "newsletter", label: "Newsletter", color: "var(--sw-teal)" },
];

export const platformDef = (id: Platform) =>
  PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0];

export interface Post {
  id: string;
  /** ISO date. Sorting a content calendar by string only works in ISO. */
  date: string;
  platform: Platform;
  status: "scheduled" | "draft" | "published";
  title: string;
  org: string;
}

export const MONTH = { year: 2026, month: 8, label: "September 2026" }; // month is 0-indexed

export const POSTS: Post[] = [
  { id: "p1", date: "2026-09-01", platform: "linkedin", status: "published", title: "Civic data pilot — what residents own", org: "uwazi" },
  { id: "p2", date: "2026-09-02", platform: "newsletter", status: "published", title: "August in three numbers", org: "uwazi" },
  { id: "p3", date: "2026-09-03", platform: "instagram", status: "published", title: "Showcase venue walkthrough", org: "cc" },
  { id: "p4", date: "2026-09-03", platform: "x", status: "published", title: "Thread — data trusts explained", org: "uwazi" },
  { id: "p5", date: "2026-09-04", platform: "linkedin", status: "published", title: "Mentor intake is open", org: "bin" },
  { id: "p6", date: "2026-09-08", platform: "youtube", status: "scheduled", title: "Pilot demo — 4 min cut", org: "uwazi" },
  { id: "p7", date: "2026-09-09", platform: "linkedin", status: "scheduled", title: "Kauffman committee recap", org: "uwazi" },
  { id: "p8", date: "2026-09-10", platform: "instagram", status: "draft", title: "Artist call — October slate", org: "cc" },
  { id: "p9", date: "2026-09-11", platform: "newsletter", status: "draft", title: "Who holds the keys?", org: "uwazi" },
  { id: "p10", date: "2026-09-11", platform: "x", status: "draft", title: "Quote card — resident ownership", org: "uwazi" },
  { id: "p11", date: "2026-09-21", platform: "linkedin", status: "draft", title: "BIN cohort announcement", org: "bin" },
  { id: "p12", date: "2026-09-22", platform: "instagram", status: "draft", title: "Behind the showcase", org: "cc" },
  { id: "p13", date: "2026-09-23", platform: "youtube", status: "draft", title: "Founder Q&A", org: "bin" },
  { id: "p14", date: "2026-09-24", platform: "linkedin", status: "scheduled", title: "Hiring — civic data engineer", org: "uwazi" },
  { id: "p15", date: "2026-09-25", platform: "newsletter", status: "draft", title: "September close", org: "uwazi" },
  { id: "p16", date: "2026-09-29", platform: "x", status: "draft", title: "Showcase countdown", org: "cc" },
  { id: "p17", date: "2026-09-30", platform: "instagram", status: "draft", title: "Ticket link live", org: "cc" },
];

/* ---------- Calendar grid ---------- */

export const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** Monday-first offset, because the working week is what the gap is measured in. */
export const leadingBlanks = (y: number, m: number) => (new Date(y, m, 1).getDay() + 6) % 7;

export const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export const isWeekend = (y: number, m: number, d: number) => {
  const w = new Date(y, m, d).getDay();
  return w === 0 || w === 6;
};

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface Gap {
  days: number;
  fromDay: number;
  toDay: number;
  label: string;
}

/**
 * The longest run of working days with nothing going out. Weekends are
 * excluded rather than counted as silence — nobody schedules Saturday, so
 * counting it would inflate every gap by two and make them all look alike.
 */
export const longestWeekdayGap = (posts: Post[]): Gap | null => {
  const total = daysInMonth(MONTH.year, MONTH.month);
  const has = new Set(posts.map((p) => p.date));
  let best: Gap | null = null;
  let run: number[] = [];

  const close = () => {
    if (run.length && (!best || run.length > best.days)) {
      best = {
        days: run.length,
        fromDay: run[0],
        toDay: run[run.length - 1],
        label: `${MONTH_SHORT[MONTH.month]} ${run[0]}–${run[run.length - 1]}`,
      };
    }
    run = [];
  };

  for (let d = 1; d <= total; d++) {
    if (isWeekend(MONTH.year, MONTH.month, d)) continue;
    if (has.has(iso(MONTH.year, MONTH.month, d))) close();
    else run.push(d);
  }
  close();
  return best;
};

/* ---------- Mirror: organic vs paid ---------- */

export interface WeekReach {
  week: string;
  /** Reach earned. Plotted above the axis. */
  organic: number;
  /** Reach bought. Plotted below it. */
  paid: number;
  spend: number;
}

export const REACH: WeekReach[] = [
  { week: "W1", organic: 58000, paid: 8000, spend: 1200 },
  { week: "W2", organic: 55000, paid: 11000, spend: 1800 },
  { week: "W3", organic: 57000, paid: 9000, spend: 1500 },
  { week: "W4", organic: 56000, paid: 14000, spend: 2400 },
  { week: "W5", organic: 54000, paid: 19000, spend: 3100 },
  { week: "W6", organic: 55000, paid: 23000, spend: 3900 },
  { week: "W7", organic: 53000, paid: 27000, spend: 4600 },
  { week: "W8", organic: 54000, paid: 31000, spend: 5200 },
  { week: "W9", organic: 53000, paid: 34000, spend: 5900 },
  { week: "W10", organic: 52000, paid: 38000, spend: 6400 },
  { week: "W11", organic: 50000, paid: 40000, spend: 6900 },
  { week: "W12", organic: 49000, paid: 42000, spend: 7300 },
];

export interface Verdict {
  headline: string;
  body: string;
  tone: "warn" | "ok";
  organicDelta: number;
  paidDelta: number;
}

const k = (n: number) => `${Math.abs(Math.round(n / 1000))}K`;

/**
 * First three weeks against the last three. A single week is noise and a
 * trailing average hides the turn; three against three is the smallest
 * comparison that survives one bad post.
 */
export const readMirror = (rows: WeekReach[]): Verdict => {
  const sum = (xs: WeekReach[], key: "organic" | "paid") =>
    xs.reduce((s, r) => s + r[key], 0);
  const first = rows.slice(0, 3);
  const last = rows.slice(-3);
  const organicDelta = sum(last, "organic") - sum(first, "organic");
  const paidDelta = sum(last, "paid") - sum(first, "paid");

  if (paidDelta > 0 && organicDelta < 0) {
    return {
      headline: "Paid is substituting, not amplifying.",
      body: `Paid reach rose ${k(paidDelta)} while organic fell ${k(organicDelta)} — you're buying back reach you used to earn.`,
      tone: "warn",
      organicDelta,
      paidDelta,
    };
  }
  if (paidDelta > 0 && organicDelta >= 0) {
    return {
      headline: "Paid is amplifying.",
      body: `Paid rose ${k(paidDelta)} and organic held or grew by ${k(organicDelta)} — the spend is pulling earned reach up with it.`,
      tone: "ok",
      organicDelta,
      paidDelta,
    };
  }
  return {
    headline: "Organic is carrying this.",
    body: `Paid moved ${k(paidDelta)} and organic moved ${k(organicDelta)} — the earned side is doing the work.`,
    tone: "ok",
    organicDelta,
    paidDelta,
  };
};
