// Helpers for computing relationship freshness on contacts.

export type HealthBucket = "active" | "warming" | "cold" | "unknown";

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

export function bucket(iso: string | null | undefined): HealthBucket {
  const d = daysSince(iso);
  if (d === null) return "unknown";
  if (d < 30) return "active";
  if (d < 60) return "warming";
  return "cold";
}

export function relativeTime(iso: string | null | undefined): string {
  const d = daysSince(iso);
  if (d === null) return "Never touched";
  if (d === 0) return "Today";
  if (d === 1) return "1 day ago";
  if (d < 30) return `${d} days ago`;
  const months = Math.floor(d / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(d / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export const HEALTH_COLORS: Record<HealthBucket, string> = {
  active: "var(--sev-success)",
  warming: "var(--sev-warn)",
  cold: "var(--sev-critical)",
  unknown: "var(--text-muted)",
};
