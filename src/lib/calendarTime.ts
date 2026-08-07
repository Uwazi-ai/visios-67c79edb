/**
 * Calendar time and geometry helpers.
 *
 * Times arrive from Postgres as timestamptz — real instants — and are
 * rendered in the reader's zone. All-day events are stored at UTC midnight
 * and must be read back in UTC, or a 00:00Z date renders as the previous
 * day west of Greenwich.
 */

export const START_HOUR = 7;
export const END_HOUR = 20;

export const dayMs = 86400000;

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** 12-hour display. Flat hours drop the dead ":00": 9 AM, 2 PM, 9:30 AM. */
export function fmt12(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour} ${suffix}` : `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const fmtRange = (a: Date, b: Date) => `${fmt12(a)}–${fmt12(b)}`;

/** All-day dates are stored at UTC midnight; read them back in UTC. */
export function allDayDate(iso: string) {
  const d = new Date(iso);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Position inside the day track, as a percentage of the visible window. */
export function trackTop(d: Date) {
  const mins = d.getHours() * 60 + d.getMinutes() - START_HOUR * 60;
  return (mins / ((END_HOUR - START_HOUR) * 60)) * 100;
}

export function trackHeight(a: Date, b: Date) {
  const mins = Math.max(15, (b.getTime() - a.getTime()) / 60000);
  return (mins / ((END_HOUR - START_HOUR) * 60)) * 100;
}

/** Overlapping blocks share the column instead of printing over each other. */
export function laneOut<T extends { start: Date; end: Date }>(items: T[]) {
  const sorted = [...items].sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: { item: T; lane: number; lanes: number }[] = [];
  let cluster: T[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const ends: number[] = [];
    const placed = cluster.map((it) => {
      let lane = ends.findIndex((e) => e <= it.start.getTime());
      if (lane === -1) lane = ends.length;
      ends[lane] = it.end.getTime();
      return { item: it, lane };
    });
    placed.forEach((p) => out.push({ ...p, lanes: ends.length }));
    cluster = [];
  };

  for (const it of sorted) {
    if (cluster.length && it.start.getTime() >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end.getTime());
  }
  if (cluster.length) flush();
  return out;
}
