import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PendingProposal {
  id: string;
  org_id: string;
  org_name: string;
  identity_color: string;
  agent_key: string;
  kind: string;
  title: string;
  rationale: string | null;
  payload: Record<string, unknown>;
  confidence: number | null;
  created_at: string;
}

export interface ConnectionRow {
  org_id: string;
  org_name: string;
  identity_color: string;
  provider: string;
  status: "connected" | "disconnected" | "error" | "expired";
  last_sync_at: string | null;
  last_error: string | null;
}

export interface DashboardSummary {
  scope: { org_id: string | null; org_count: number };
  pending_proposals: PendingProposal[];
  pending_count: number;
  connections: { connected: number; error: number; total: number; rows: ConnectionRow[] };
  today: {
    calendar_connected: boolean;
    event_count: number;
    events: { id: string; title: string; start_at: string; identity_color: string | null }[];
  };
  inbox: { gmail_connected: boolean; needs_reply: number };
  tasks: { due_today: number; overdue: number };
}

/** One RPC, one render. Six queries means six chances at a partial page. */
export function useDashboardSummary(scopeOrgId: string | null) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: res, error: err } = await supabase.rpc("get_dashboard_summary", {
      p_org_id: scopeOrgId,
    });
    if (err) {
      setError(err.message);
      setData(null);
    } else {
      setData(res as unknown as DashboardSummary);
    }
    setLoading(false);
  }, [scopeOrgId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, refetch: load };
}
