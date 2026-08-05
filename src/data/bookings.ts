import { DAYS, Day, fmt12 } from "@/data/calendar";

/**
 * Bookings — a link per venture, each with its own duration, branding and
 * rules. Not one link with a dropdown: a guest booking Culture Club should
 * never see UWAZI's name, and switching a dropdown is exactly how they do.
 *
 * The heatmap exists because rules are abstract. "Buffer 15 min, notice 1
 * day" tells you nothing about the week you are actually selling. The
 * caption states the finding rather than leaving it in the shading.
 */

export interface BookingLink {
  id: string;
  org: string;
  /** What the guest sees as the host. */
  hostName: string;
  title: string;
  slug: string;
  /** Minutes. */
  duration: number;
  bufferMin: number;
  noticeDays: number;
  maxPerDay: number;
  where: string;
  blurb: string;
  /** Rules stated as the guest experiences them, not as config lines. */
  rules: string[];
  /** Open slots per weekday, per hour offset from 9 AM (8 hours, 9–16). */
  open: Record<Day, number[]>;
}

/* index 0 = 9 AM … index 7 = 4 PM */
const hours = (...v: number[]) => v;

export const LINKS: BookingLink[] = [
  {
    id: "b-uwazi",
    org: "uwazi",
    hostName: "Myke — UWAZI.AI",
    title: "Civic data pilot intro",
    slug: "uwazi/pilot-intro",
    duration: 30,
    bufferMin: 15,
    noticeDays: 1,
    maxPerDay: 4,
    where: "Google Meet",
    blurb: "Thirty minutes on whether a civic data pilot fits your city. Bring the question you cannot get answered internally.",
    rules: [
      "Same-day booking is off — you get at least one night before it lands.",
      "Fifteen minutes after every call, so the one before yours running long cannot eat yours.",
      "Four a day maximum. The fifth request is offered tomorrow instead of being squeezed in.",
    ],
    open: {
      Mon: hours(2, 2, 1, 0, 0, 1, 1, 0),
      Tue: hours(2, 1, 0, 0, 1, 2, 1, 1),
      Wed: hours(1, 2, 2, 0, 0, 0, 1, 1),
      Thu: hours(2, 2, 1, 0, 1, 0, 0, 1),
      Fri: hours(2, 2, 2, 0, 1, 1, 2, 1),
    },
  },
  {
    id: "b-cc",
    org: "cc",
    hostName: "Culture Club",
    title: "Artist programming slot",
    slug: "cultureclub/programming",
    duration: 45,
    bufferMin: 10,
    noticeDays: 2,
    maxPerDay: 3,
    where: "The Gem, or phone",
    blurb: "Forty-five minutes to walk through your set, your run of show and what the room needs to look like.",
    rules: [
      "Two days notice — the venue needs a name before the hold moves.",
      "Ten minute buffer, enough to write the notes down before the next artist.",
      "Three a day. Programming conversations do not survive being stacked.",
    ],
    open: {
      Mon: hours(0, 1, 1, 0, 2, 2, 1, 0),
      Tue: hours(1, 1, 0, 0, 1, 1, 1, 0),
      Wed: hours(0, 0, 1, 0, 2, 2, 2, 1),
      Thu: hours(1, 1, 1, 0, 1, 1, 0, 0),
      Fri: hours(0, 1, 1, 0, 2, 1, 1, 0),
    },
  },
  {
    id: "b-bin",
    org: "bin",
    hostName: "Black Innovators Network",
    title: "Mentor office hours",
    slug: "bin/office-hours",
    duration: 20,
    bufferMin: 5,
    noticeDays: 0,
    maxPerDay: 8,
    where: "Zoom",
    blurb: "Twenty minutes, no agenda required. Bring the thing you are stuck on.",
    rules: [
      "Same-day is allowed here on purpose — being stuck is a today problem.",
      "Five minutes between, which is honest about what twenty-minute calls actually do.",
      "Eight a day, then the day closes rather than degrading.",
    ],
    open: {
      Mon: hours(3, 3, 2, 0, 1, 1, 2, 2),
      Tue: hours(2, 3, 2, 0, 2, 2, 1, 1),
      Wed: hours(3, 2, 1, 0, 1, 2, 2, 2),
      Thu: hours(2, 2, 2, 0, 2, 1, 1, 1),
      Fri: hours(3, 3, 3, 0, 1, 1, 1, 2),
    },
  },
];

export const HOUR_LABELS = Array.from({ length: 8 }, (_, i) =>
  fmt12(`${String(9 + i).padStart(2, "0")}:00`),
);

export interface HeatFinding {
  total: number;
  /** Highest single cell, used to normalise the shading. */
  peak: number;
  caption: string;
}

/**
 * The finding, stated. A heatmap where the user has to squint at shading
 * and infer the point is decoration; the sentence is the deliverable.
 */
export function readHeat(link: BookingLink): HeatFinding {
  let total = 0;
  let peak = 0;
  let morning = 0;
  let afternoon = 0;
  const dayTotals: { day: Day; n: number }[] = [];

  for (const day of DAYS) {
    const row = link.open[day];
    const n = row.reduce((a, b) => a + b, 0);
    dayTotals.push({ day, n });
    total += n;
    row.forEach((v, i) => {
      if (v > peak) peak = v;
      if (9 + i < 12) morning += v;
      else afternoon += v;
    });
  }

  const best = [...dayTotals].sort((a, b) => b.n - a.n)[0];
  const worst = [...dayTotals].sort((a, b) => a.n - b.n)[0];
  const leading = Math.max(morning, afternoon);
  const half = morning >= afternoon ? "Mornings" : "Afternoons";
  const share = total === 0 ? 0 : Math.round((leading / total) * 100);

  const caption =
    total === 0
      ? "Nothing open next week. This link is currently selling a page with no dates on it."
      : `${total} slots open next week. ${half} carry most of it — ${share}% of the open time. ${best.day} is the widest at ${best.n}; ${worst.day} has ${worst.n}.`;

  return { total, peak, caption };
}
