export type OrgSlug = "uwazi" | "bin" | "cc" | "all";

export interface Org {
  id: string;
  name: string;
  slug: string;
  color: string;
  metadata?: { domains?: string[] } & Record<string, unknown>;
}

export const ORG_COLORS: Record<string, string> = {
  uwazi: "#2563EB",
  bin: "#EF4444",
  cc: "#22C55E",
};

export const ORG_GLOW: Record<string, string> = {
  uwazi: "rgba(37,99,235,0.25)",
  bin: "rgba(239,68,68,0.20)",
  cc: "rgba(34,197,94,0.20)",
};
