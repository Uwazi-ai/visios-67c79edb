import { useSyncExternalStore } from "react";

/**
 * Fallbacks — what a field does when its source is missing.
 *
 * Hiding a widget is the safe default and often the wrong one. The choice
 * depends on whether somebody will act on the number:
 *
 *   substitute  the same field from an equivalent integration
 *   manual      let them type it — the number is decision-grade and known
 *   import      paste or upload; an export exists, only the API isn't wired
 *   degrade     a weaker but honest version, with the gap named
 *   sample      clearly-labelled example data — pre-connection only
 *   hide        nothing honest can be shown
 *
 * The rule: if a field is decision-grade, offer manual or import before
 * hiding it. If it is context, degrade or hide. Never show sample data once
 * a tenant has connected anything — at that point example data is a lie,
 * not a preview.
 */

export type FallbackKind =
  | "substitute"
  | "manual"
  | "import"
  | "degrade"
  | "sample"
  | "hide";

export interface Fallback {
  kind: FallbackKind;
  /** Said on the card, so the reader knows the number's standing. */
  note: string;
}

/** Keyed by capability, the same keys SourceGate is given. */
export const FALLBACKS: Record<string, Fallback> = {
  /* Raise — cash, burn and revenue are three numbers a founder already
     knows. A form that computes runway from what they type teaches them
     Kova can help; an empty card teaches them it can't. */
  cash: { kind: "manual", note: "Type it — Stripe measures it later." },
  burn: { kind: "manual", note: "Type it — Stripe measures it later." },
  revenue: { kind: "manual", note: "Type it — Stripe measures it later." },
  runway: {
    kind: "manual",
    note: "Computed from figures you enter until Stripe is connected.",
  },

  /* Social — organic alone cannot distinguish amplification from
     substitution. Show the organic half, name the gap, withhold the
     verdict rather than guessing at it. */
  "organic-vs-paid": {
    kind: "degrade",
    note: "Half the picture — the organic line only. The verdict needs the paid half.",
  },

  /* Campaigns — a CSV export from Ads Manager, parsed into the shape the
     API would have returned. */
  cpm: { kind: "import", note: "Paste a CSV export from Ads Manager." },
  funnel: { kind: "import", note: "Paste a CSV export from Ads Manager." },
  "creative-leaderboard": { kind: "import", note: "Paste a CSV export from Ads Manager." },

  /* Deliberately hidden. A task count from nowhere is not a smaller truth,
     it is a fabrication. */
  throughput: { kind: "hide", note: "No honest partial version exists." },
  velocity: { kind: "hide", note: "No honest partial version exists." },
  channels: { kind: "hide", note: "No honest partial version exists." },
  "run-history": { kind: "hide", note: "No honest partial version exists." },
};

export const fallbackFor = (key: string): Fallback | undefined => FALLBACKS[key];

/* ------------------------------------------------------------------ */
/* Entered-by-you store                                                */
/* ------------------------------------------------------------------ */

/**
 * Values a person typed or pasted. Kept apart from measured data on
 * purpose: everything that comes out of here carries an "Entered by you"
 * badge wherever it surfaces, so a typed number is never mistaken for a
 * measured one.
 */
export interface ManualRunway {
  cash: number;
  burn: number;
  revenue: number;
  at: string;
}

export interface ImportedCampaign {
  name: string;
  platform: string;
  spend: number;
  cpm: number;
  benchmark: number;
}

interface EnteredState {
  runway?: ManualRunway;
  campaigns?: { rows: ImportedCampaign[]; at: string };
}

const KEY = "kova:entered";

const read = (): EnteredState => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as EnteredState) : {};
  } catch {
    return {};
  }
};

let entered: EnteredState = read();
const listeners = new Set<() => void>();

const commit = (next: EnteredState) => {
  entered = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode — the session still holds it */
  }
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const EMPTY: EnteredState = {};

export const useEntered = (): EnteredState =>
  useSyncExternalStore(
    subscribe,
    () => entered,
    () => EMPTY,
  );

export const setManualRunway = (v: Omit<ManualRunway, "at">) =>
  commit({ ...entered, runway: { ...v, at: new Date().toISOString() } });

export const clearManualRunway = () => commit({ ...entered, runway: undefined });

export const setImportedCampaigns = (rows: ImportedCampaign[]) =>
  commit({ ...entered, campaigns: { rows, at: new Date().toISOString() } });

export const clearImportedCampaigns = () => commit({ ...entered, campaigns: undefined });

/* ------------------------------------------------------------------ */
/* Derivations                                                         */
/* ------------------------------------------------------------------ */

/** cash ÷ (burn − revenue). Same formula whether Stripe fed it or a person did. */
export const runwayMonths = (cash: number, burn: number, revenue: number): number | null => {
  const net = burn - revenue;
  if (!(cash > 0)) return 0;
  if (net <= 0) return null; // profitable — runway is not the question
  return Math.floor(cash / net);
};

/**
 * A CSV export parsed into the shape the Meta API would have returned.
 * Header-driven, so column order does not matter, and unparseable rows are
 * reported rather than silently dropped.
 */
export function parseCampaignCsv(text: string): {
  rows: ImportedCampaign[];
  skipped: number;
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { rows: [], skipped: 0 };

  const split = (l: string) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const head = split(lines[0]).map((h) => h.toLowerCase());
  const at = (names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));

  const iName = at(["campaign", "name"]);
  const iPlatform = at(["platform", "channel", "publisher"]);
  const iSpend = at(["spend", "amount", "cost"]);
  const iCpm = at(["cpm"]);
  const iBench = at(["benchmark"]);

  const num = (s: string | undefined) => Number(String(s ?? "").replace(/[^0-9.\-]/g, ""));

  const rows: ImportedCampaign[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const c = split(line);
    const name = iName >= 0 ? c[iName] : "";
    const cpm = num(c[iCpm]);
    if (!name || !Number.isFinite(cpm) || cpm <= 0) {
      skipped += 1;
      continue;
    }
    const bench = iBench >= 0 ? num(c[iBench]) : NaN;
    rows.push({
      name,
      platform: (iPlatform >= 0 ? c[iPlatform] : "") || "Imported",
      spend: Number.isFinite(num(c[iSpend])) ? num(c[iSpend]) : 0,
      cpm,
      benchmark: Number.isFinite(bench) && bench > 0 ? bench : cpm,
    });
  }
  return { rows, skipped };
}
