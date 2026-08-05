import { ANY_ORG } from "@/lib/AppState";

/**
 * Calendar — Mon–Fri, 9 AM to 4 PM.
 *
 * TIMES ARE STORED IN 24-HOUR STRINGS AND NEVER IN ANY OTHER FORM.
 * Sorting and slot matching both depend on "09:30" < "14:00" being true as
 * a plain string comparison. Store "2 PM" and that breaks silently: "2 PM"
 * sorts before "9 AM", so an afternoon event climbs to the top of the day
 * and no error is thrown. Only the render layer converts — see fmt12.
 *
 * Replace with: select … from calendar_events where starts_at::time … —
 * keep `calendar_id` distinct from `org`. Two events at the same hour on
 * two different calendars is a person with two accounts, not a conflict.
 */

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
export type Day = (typeof DAYS)[number];

/** Grid bounds, inclusive start hour, exclusive end hour. 24-hour. */
export const START_HOUR = 9;
export const END_HOUR = 16;

export interface Calendar {
  id: string;
  label: string;
}

/** Distinct calendars, not distinct ventures. A single calendar can carry
 *  work from several orgs; two calendars can legitimately double-book. */
export const CALENDARS: Calendar[] = [
  { id: "work", label: "Work — myke@uwazi.ai" },
  { id: "personal", label: "Personal — myke@gmail" },
  { id: "shared", label: "Culture Club shared" },
];

export interface CalEvent {
  id: string;
  title: string;
  day: Day;
  /** 24-hour "HH:MM". */
  start: string;
  end: string;
  calendar: string;
  org: string;
  where?: string;
}

export const EVENTS: CalEvent[] = [
  { id: "e1", title: "Kauffman pilot standup", day: "Mon", start: "09:00", end: "09:30", calendar: "work", org: "uwazi", where: "Meet" },
  { id: "e2", title: "Deep work — ownership model", day: "Mon", start: "10:00", end: "12:00", calendar: "work", org: "uwazi" },
  { id: "e3", title: "Dentist", day: "Mon", start: "14:00", end: "15:00", calendar: "personal", org: ANY_ORG, where: "Brookside" },

  { id: "e4", title: "BIN mentor review", day: "Tue", start: "09:30", end: "10:30", calendar: "work", org: "bin" },
  /* Same calendar, overlapping — this is the conflict the card names. */
  { id: "e5", title: "Raia LP call", day: "Tue", start: "10:00", end: "11:00", calendar: "work", org: "raia", where: "Zoom" },
  { id: "e6", title: "Showcase venue walkthrough", day: "Tue", start: "13:00", end: "14:30", calendar: "shared", org: "cc", where: "The Gem" },

  { id: "e7", title: "1Flock handoff", day: "Wed", start: "09:00", end: "10:00", calendar: "work", org: "1flock" },
  /* Different calendars at the same hour — normal, must not flag. */
  { id: "e8", title: "Culture Club programming", day: "Wed", start: "11:00", end: "12:00", calendar: "shared", org: "cc" },
  { id: "e9", title: "Investor coffee", day: "Wed", start: "11:00", end: "12:00", calendar: "personal", org: "raia", where: "Monarch" },
  { id: "e10", title: "UWAZI eng sync", day: "Wed", start: "15:00", end: "16:00", calendar: "work", org: "uwazi" },

  { id: "e11", title: "Kauffman committee walkthrough", day: "Thu", start: "10:00", end: "11:00", calendar: "work", org: "uwazi" },
  { id: "e12", title: "BIN office hours", day: "Thu", start: "13:00", end: "15:00", calendar: "work", org: "bin" },
  /* Same calendar, overlapping — second conflict. */
  { id: "e13", title: "Grant call — Ewing", day: "Thu", start: "14:30", end: "15:30", calendar: "work", org: "uwazi", where: "Phone" },

  { id: "e14", title: "Showcase headcount decision", day: "Fri", start: "09:30", end: "10:00", calendar: "shared", org: "cc" },
  { id: "e15", title: "Weekly close", day: "Fri", start: "15:00", end: "16:00", calendar: "work", org: ANY_ORG },
];

/* ---------------- time ---------------- */

/** Minutes since midnight, from a 24-hour "HH:MM". */
export const mins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * The only place a time becomes human. Drops the dead ":00" so the grid
 * reads "9 AM" and "2 PM", keeps the minutes when they carry information:
 * "9:30 AM".
 */
export function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour} ${suffix}` : `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const fmtRange = (start: string, end: string) => `${fmt12(start)}–${fmt12(end)}`;

/* ---------------- conflicts ---------------- */

export interface Conflict {
  day: Day;
  calendar: string;
  a: CalEvent;
  b: CalEvent;
  /** Overlap in minutes — a 5-minute brush is not a 60-minute collision. */
  overlap: number;
}

const overlaps = (a: CalEvent, b: CalEvent) =>
  Math.min(mins(a.end), mins(b.end)) - Math.max(mins(a.start), mins(b.start));

/**
 * A conflict is two events on the SAME calendar that overlap on the same
 * day. Two calendars overlapping is a person with a work account and a
 * personal one, and flagging that trains the user to ignore the flag.
 */
export function conflicts(events: CalEvent[]): Conflict[] {
  const out: Conflict[] = [];
  const sorted = [...events].sort((x, y) => x.start.localeCompare(y.start));
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (a.day !== b.day || a.calendar !== b.calendar) continue;
      const o = overlaps(a, b);
      if (o > 0) out.push({ day: a.day, calendar: a.calendar, a, b, overlap: o });
    }
  }
  return out.sort((x, y) => DAYS.indexOf(x.day) - DAYS.indexOf(y.day));
}

/** Overlaps across different calendars — counted, named as normal, never flagged. */
export function crossCalendarOverlaps(events: CalEvent[]): number {
  let n = 0;
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (a.day !== b.day || a.calendar === b.calendar) continue;
      if (overlaps(a, b) > 0) n++;
    }
  }
  return n;
}

export const calendarLabel = (id: string) =>
  CALENDARS.find((c) => c.id === id)?.label ?? id;
