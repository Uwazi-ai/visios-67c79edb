/**
 * Mail categories — a semantic status palette, not decoration and not an AI
 * signal. These five hues live here rather than in tokens.css because they are
 * data-domain values (like org identity colours), not design tokens.
 *
 * Colour never carries meaning alone: every chip and every row also carries the
 * label as text. Lime/cyan and amber/red are exactly the pairs that fail for
 * colourblind users at small sizes.
 */
export type Category =
  | "urgent"
  | "meetings"
  | "transactions"
  | "outreach"
  | "marketing"
  | "uncategorized";

export const CATEGORIES: {
  key: Exclude<Category, "uncategorized">;
  label: string;
  color: string;
  /** Distinct copy per category — a generic "no results" says nothing. */
  empty: string;
}[] = [
  { key: "urgent", label: "Urgent", color: "#DC2626", empty: "Nothing urgent right now." },
  { key: "meetings", label: "Meetings", color: "#D97706", empty: "No scheduling to deal with." },
  { key: "transactions", label: "Transactions", color: "#65A30D", empty: "No invoices, receipts or contracts waiting." },
  { key: "outreach", label: "Outreach", color: "#0891B2", empty: "Nobody new is asking for anything." },
  { key: "marketing", label: "Marketing", color: "#64748B", empty: "No bulk mail to clear." },
];

export const categoryColor = (c: Category) =>
  CATEGORIES.find((x) => x.key === c)?.color ?? "var(--t-dim)";

export const categoryLabel = (c: Category) =>
  CATEGORIES.find((x) => x.key === c)?.label ?? "Sorting";

/** Relative time. Shared helper — kept when the mock data was deleted. */
export function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** 12-hour display, 24-hour data. */
export function fullTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function initialsOf(name?: string | null, address?: string): string {
  const src = (name ?? address ?? "?").trim();
  const parts = src.split(/[\s.@]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}
