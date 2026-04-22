// Central time formatting utilities.
// All date/time output in the app must go through here so that:
//   1) the user's timezone preference (profiles.timezone) is respected, and
//   2) times are always rendered in 12-hour format (h:mm AM/PM).
//
// Use the `useTime()` hook in components to get formatters bound to the
// current user's timezone. Standalone helpers are also exported for
// non-React contexts (e.g. utility files).

export const DEFAULT_TZ = "America/Chicago";

export type TimeOpts = Intl.DateTimeFormatOptions;

function toDate(d: Date | string | number): Date {
  return d instanceof Date ? d : new Date(d);
}

/**
 * Force 12-hour clock by stripping/overriding any 24h hint in opts.
 */
function with12h(opts: TimeOpts): TimeOpts {
  return { ...opts, hour12: true };
}

export function formatTime(d: Date | string | number, tz: string = DEFAULT_TZ, opts: TimeOpts = {}): string {
  return toDate(d).toLocaleTimeString("en-US", with12h({
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    ...opts,
  }));
}

export function formatDate(d: Date | string | number, tz: string = DEFAULT_TZ, opts: TimeOpts = {}): string {
  return toDate(d).toLocaleDateString("en-US", {
    timeZone: tz,
    ...opts,
  });
}

export function formatDateTime(d: Date | string | number, tz: string = DEFAULT_TZ, opts: TimeOpts = {}): string {
  return toDate(d).toLocaleString("en-US", with12h({
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    ...opts,
  }));
}

/**
 * Short, casual time like "2:30 PM" or "2 PM" when on the hour.
 */
export function formatTimeShort(d: Date | string | number, tz: string = DEFAULT_TZ): string {
  const s = formatTime(d, tz);
  return s.replace(":00", "");
}
