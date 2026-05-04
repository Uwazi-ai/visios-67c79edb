export const TYPE_COLOR: Record<string, string> = {
  accelerator: "#a78bfa",
  vc: "#5b9cf6",
  grant: "#e5b84a",
};

export const URGENCY_COLOR: Record<string, string> = {
  fire: "#e05252",
  now: "#9bd34b",
  soon: "#e5b84a",
  build: "#5b9cf6",
  watch: "#9ca3af",
};

export const STATUS_COLOR: Record<string, string> = {
  "not started": "#6b7280",
  researching: "#5b9cf6",
  drafting: "#a78bfa",
  applied: "#e5b84a",
  "in review": "#e5b84a",
  awarded: "#9bd34b",
  declined: "#e05252",
  watching: "#9ca3af",
};

export const STATUS_OPTIONS = [
  "not started", "researching", "drafting", "applied", "in review", "awarded", "declined", "watching",
] as const;

export const URGENCY_OPTIONS = ["fire", "now", "soon", "build", "watch"] as const;

export const TIMELINE_BUCKETS: { label: string; match: (deadline: string | null) => boolean }[] = [
  { label: "May", match: (d) => /may/i.test(d ?? "") },
  { label: "Jun", match: (d) => /jun/i.test(d ?? "") },
  { label: "Jul", match: (d) => /jul/i.test(d ?? "") },
  { label: "Aug", match: (d) => /aug/i.test(d ?? "") },
  { label: "Sep–Oct", match: (d) => /sep|oct|q3/i.test(d ?? "") },
  { label: "Q1 '27", match: (d) => /2027|q1.*27/i.test(d ?? "") },
];
