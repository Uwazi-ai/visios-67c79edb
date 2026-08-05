import { ANY_ORG } from "@/lib/AppState";

/**
 * Contacts — the record of who you met, and the honest version of where.
 *
 * PROVENANCE is the distinguishing feature. When someone scans your digital
 * card, three *independent* signals are captured and kept independent:
 *
 *   location — GPS at scan time, resolved to a place
 *   calendar — what was on your calendar in that window
 *   overlap  — other cards scanned nearby at the same moment
 *
 * THE RULE: two or more signals must agree before Kova states anything.
 * One signal makes a question, not a claim. A confidently wrong "you met
 * them at X" is worse than an empty field, because you will repeat it to
 * their face and they will correct you.
 *
 * Replace with: select … from contact_scans join contact_signals — keep the
 * three signals as separate rows. Collapsing them into one resolved
 * `met_at` string at write time throws away exactly the disagreement this
 * screen needs to show.
 */

export type SignalKind = "location" | "calendar" | "overlap";

export interface Signal {
  kind: SignalKind;
  /** 0–1. Below AGREE_AT the signal is present but not load-bearing. */
  strength: number;
  /** What the signal actually says. Empty string when it says nothing. */
  reading: string;
  /** Why it is as strong or as weak as it is — the part most tools hide. */
  basis: string;
}

/** A signal is only counted as agreeing above this. */
export const AGREE_AT = 0.6;

/** Fixed weights, so a confidence number cannot be tuned per contact. */
const WEIGHT: Record<SignalKind, number> = { location: 0.34, calendar: 0.36, overlap: 0.3 };

export interface Provenance {
  signals: Signal[];
  /** The sentence Kova is willing to say when the signals agree. */
  claim: string;
  /** The sentence it asks instead when they do not. */
  question: string;
}

export interface Touchpoint {
  /** Days before today. 0 is today. Plotted on a real axis, so a three
   *  month silence renders as three months of empty track. */
  daysAgo: number;
  label: string;
  channel: "scan" | "email" | "call" | "event";
}

export interface Enrichment {
  source: string;
  found: string;
  url: string;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  org: string;
  initials: string;
  scannedOn: string;
  provenance: Provenance;
  track: Touchpoint[];
  /** A deadline or task on another screen that makes the silence matter. */
  crossRef?: string;
  enrichment: Enrichment[];
  /** Written when nothing public matched. Said out loud, not left blank. */
  noPublicMatch?: string;
  /** Opening line for outreach, written from what provenance supports. */
  draftOpener: string;
  draftBody: string;
}

/* ------------------------------------------------------------------ */
/* Confidence                                                           */
/* ------------------------------------------------------------------ */

export interface Verdict {
  /** 0–100, computed from the signals. Never stored on the record. */
  pct: number;
  /** True when two or more signals clear AGREE_AT. */
  stated: boolean;
  agreeing: number;
  /** The line to render: a statement, or a question. */
  line: string;
}

export function verdict(p: Provenance): Verdict {
  const pct = Math.round(
    p.signals.reduce((sum, s) => sum + s.strength * WEIGHT[s.kind], 0) * 100,
  );
  const agreeing = p.signals.filter((s) => s.strength >= AGREE_AT).length;
  const stated = agreeing >= 2;
  return { pct, stated, agreeing, line: stated ? p.claim : p.question };
}

/* ------------------------------------------------------------------ */
/* Records                                                              */
/* ------------------------------------------------------------------ */

export const CONTACTS: Contact[] = [
  {
    id: "marcus",
    name: "Marcus Bell",
    role: "Director of Digital Equity, KC",
    org: "uwazi",
    initials: "MB",
    scannedOn: "Jul 31 · 19:42",
    provenance: {
      claim:
        "You met Marcus at the KC AI Club panel at the Kauffman Conference Centre.",
      question: "Where did you meet Marcus?",
      signals: [
        {
          kind: "location",
          strength: 1,
          reading: "Kauffman Conference Centre, 4801 Rockhill Rd",
          basis: "GPS accurate to 8m at scan time, resolved to a single venue.",
        },
        {
          kind: "calendar",
          strength: 0.95,
          reading: "KC AI Club — civic data panel, 18:30–20:30",
          basis: "One event covering the scan minute, at the same address.",
        },
        {
          kind: "overlap",
          strength: 0.85,
          reading: "4 other cards scanned in the same room within 11 minutes",
          basis: "Consistent with a panel, not with a one-to-one meeting.",
        },
      ],
    },
    track: [
      { daysAgo: 6, label: "Card scanned at the panel", channel: "scan" },
      { daysAgo: 5, label: "You sent the civic data one-pager", channel: "email" },
      { daysAgo: 4, label: "He replied — asked about resident consent", channel: "email" },
      { daysAgo: 1, label: "15-minute call", channel: "call" },
    ],
    crossRef: "Kauffman's deadline is Sep 5 — 31 days out. He is on the review committee.",
    enrichment: [
      { source: "kcmo.gov staff directory", found: "Title, department, office line", url: "kcmo.gov/city-officials" },
      { source: "KC AI Club event page", found: "Panel bio and session abstract", url: "kcaiclub.org/events/jul-31" },
      { source: "Your Gmail thread", found: "Direct reply address and signature block", url: "thread · Jul 27" },
    ],
    draftOpener:
      "Marcus — you asked how residents keep ownership of civic data after the panel.",
    draftBody:
      "I pulled together the consent model we run for the Voting Hub: residents hold the record, we hold a revocable read. Two pages, no pitch. If it is useful before the Sep 5 window closes, I can walk the committee through it in fifteen minutes.",
  },

  {
    id: "dana",
    name: "Dana Okafor",
    role: "Unknown — scanned, not introduced",
    org: "cc",
    initials: "DO",
    scannedOn: "Jul 28 · 14:06",
    provenance: {
      claim: "You met Dana at 39th & Main.",
      question:
        "You were at 39th & Main on Jul 28. Nothing on your calendar — where did you meet Dana?",
      signals: [
        {
          kind: "location",
          strength: 0.55,
          reading: "39th & Main — 140m radius, four businesses in range",
          basis:
            "GPS accurate to 140m indoors. That circle covers a coffee shop, a co-work floor and two restaurants, so the venue is a guess.",
        },
        {
          kind: "calendar",
          strength: 0,
          reading: "",
          basis: "Nothing scheduled between 13:00 and 16:00. Absence of an event is not evidence of an informal one.",
        },
        {
          kind: "overlap",
          strength: 0.4,
          reading: "2 other scans within 90 minutes, neither at a shared event",
          basis: "Consistent with a busy block, and equally consistent with three unrelated encounters.",
        },
      ],
    },
    track: [
      { daysAgo: 9, label: "Card scanned", channel: "scan" },
    ],
    crossRef: "No contact in 30 days. A cold follow-up gets colder each week.",
    enrichment: [],
    noPublicMatch:
      "No public match. Three people share this name in the metro and nothing ties one of them to your scan, so Kova is not picking. Ask her rather than guessing at her employer.",
    draftOpener: "Dana — we crossed paths on the 28th near 39th & Main.",
    draftBody:
      "I would rather ask than assume: what were you working on? If it touches civic tech or community programming there is probably something here, and if not, no harm in a short reply.",
  },

  {
    id: "renee",
    name: "Renee Castillo",
    role: "Programme lead, Ascend",
    org: ANY_ORG,
    initials: "RC",
    scannedOn: "Jun 12 · 09:20",
    provenance: {
      claim: "You met Renee at the Ascend cohort 3 kickoff, Crossroads studio.",
      question: "Where did you meet Renee?",
      signals: [
        {
          kind: "location",
          strength: 0.9,
          reading: "Crossroads studio, 1712 Main",
          basis: "GPS accurate to 14m, single tenant at that address.",
        },
        {
          kind: "calendar",
          strength: 0.88,
          reading: "Ascend cohort 3 kickoff, 09:00–11:00",
          basis: "Event covers the scan minute and lists her as an attendee.",
        },
        {
          kind: "overlap",
          strength: 0.3,
          reading: "1 other scan, 40 minutes later",
          basis: "Too sparse to corroborate. Counted, not leaned on.",
        },
      ],
    },
    track: [
      { daysAgo: 55, label: "Card scanned at kickoff", channel: "scan" },
      { daysAgo: 54, label: "Cohort welcome email", channel: "email" },
      { daysAgo: 32, label: "Mid-cohort check-in", channel: "event" },
    ],
    crossRef: "No contact in 32 days. Cohort 3 closes in 6 days with 4 of 11 mentors matched.",
    enrichment: [
      { source: "Ascend programme page", found: "Role, cohort, public bio", url: "ascend.org/team" },
      { source: "Your Gmail thread", found: "Reply address, timezone", url: "thread · Jun 13" },
    ],
    draftOpener: "Renee — you were matching mentors when we spoke at the kickoff.",
    draftBody:
      "Cohort 3 closes in six days at 4 of 11. I can put two operators from the UWAZI side in front of you this week if that helps close the gap.",
  },
];

/**
 * Enrichment provenance, stated once and plainly. Every row above names the
 * page it came from; if a claim has no row, it is not on the screen.
 */
export const ENRICHMENT_RULE =
  "Public pages and your own threads only. Kova does not buy data or compile from third-party brokers.";
