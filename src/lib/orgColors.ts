export interface OrgColorOption {
  name: string;
  hex: string;
}

export const ORG_PALETTE: OrgColorOption[] = [
  { name: "Blue",   hex: "#3b82f6" },
  { name: "Red",    hex: "#ef4444" },
  { name: "Green",  hex: "#22c55e" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Amber",  hex: "#f59e0b" },
  { name: "Pink",   hex: "#ec4899" },
  { name: "Teal",   hex: "#14b8a6" },
  { name: "Orange", hex: "#f97316" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Lime",   hex: "#84cc16" },
];

export const DEFAULT_ORG_COLOR = "#3b82f6";

export interface OrgTypeOption {
  value: string;
  label: string;
  emoji: string;
  stages: [string, string, string, string];
  relationship: string;
}

export const ORG_TYPES: OrgTypeOption[] = [
  { value: "startup",    label: "Startup/Tech", emoji: "🚀", stages: ["Prospect", "Intro", "Active Partner", "Ecosystem"], relationship: "Partners" },
  { value: "agency",     label: "Agency",       emoji: "🎨", stages: ["Lead", "Proposal", "Active Client", "Retained"],   relationship: "Clients" },
  { value: "nonprofit",  label: "Nonprofit",    emoji: "🌱", stages: ["New", "Engaged", "Advisor", "Champion"],            relationship: "Members" },
  { value: "community",  label: "Community",    emoji: "🤝", stages: ["New", "Engaged", "Contributor", "Champion"],        relationship: "Members" },
  { value: "consulting", label: "Consulting",   emoji: "💼", stages: ["Lead", "Scoping", "Active", "Complete"],            relationship: "Clients" },
  { value: "personal",   label: "Personal",     emoji: "👤", stages: ["New", "Active", "Engaged", "Inner Circle"],         relationship: "People" },
  { value: "other",      label: "Other",        emoji: "✨", stages: ["Prospect", "Intro", "Active", "Champion"],          relationship: "Partners" },
];

export const RELATIONSHIP_LABELS = ["Partners", "Clients", "Members", "Customers", "Ecosystem", "Leads"];

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function deriveShortName(name: string): string {
  const first = (name.split(/\s+/)[0] || "").toUpperCase();
  return first.slice(0, 10);
}
