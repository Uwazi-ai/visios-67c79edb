export type AgentCategory = "content" | "campaigns" | "analytics" | "approvals" | "reports" | "general";

export const CATEGORY_COLORS: Record<AgentCategory, string> = {
  content: "#1D9E75",
  campaigns: "#BA7517",
  analytics: "#185FA5",
  approvals: "#534AB7",
  reports: "#3B6D11",
  general: "#5F5E5A",
};

export const CATEGORY_LABELS: Record<AgentCategory, string> = {
  content: "Content",
  campaigns: "Campaigns",
  analytics: "Analytics",
  approvals: "Approvals",
  reports: "Reports",
  general: "General",
};

export const CATEGORIES: AgentCategory[] = ["content", "campaigns", "analytics", "approvals", "reports", "general"];

export const TEAM_MEMBERS = [
  { key: "anna", label: "Anna", color: "#185FA5" },
  { key: "alexis", label: "Alexis", color: "#534AB7" },
  { key: "myke", label: "Myke", color: "#3B6D11" },
];

export const BRAND_OPTIONS = [
  { key: "uwazi", label: "UWAZI.AI", color: "#9bd34b" },
  { key: "bin", label: "BIN", color: "#534AB7" },
  { key: "myke", label: "Myke", color: "#185FA5" },
];

export const LIME = "#9bd34b";

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  category: AgentCategory | null;
  make_scenario_id: string | null;
  make_scenario_url: string | null;
  trigger_type: "schedule" | "webhook" | "manual" | null;
  trigger_config: any;
  is_active: boolean;
  is_prebuilt: boolean;
  template_key: string | null;
  assigned_to: string[];
  brand: string[];
  last_run_at: string | null;
  last_run_status: "success" | "failed" | "running" | "warning" | null;
  run_count: number;
  ai_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRun {
  id: string;
  agent_id: string | null;
  make_execution_id: string | null;
  status: "success" | "failed" | "running" | "warning" | null;
  triggered_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  output_summary: string | null;
  error_message: string | null;
  created_at: string;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
