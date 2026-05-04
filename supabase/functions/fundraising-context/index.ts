// Returns a structured fundraising context summary for the Ask Uwazi RAG pipeline.
import { corsHeaders, jsonResponse, getAuthedUserFromReq, adminClient } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const admin = adminClient();
    const [{ data: opps }, { data: tasks }] = await Promise.all([
      admin.from("fundraising_opportunities").select("*").order("order_num"),
      admin.from("fundraising_tasks").select("*"),
    ]);

    const TARGET = 2_750_000;
    const O = opps ?? [];
    const T = tasks ?? [];

    const committed = O.reduce((s: number, o: any) => s + Number(o.committed_amount ?? 0), 0);
    const byStatus: Record<string, number> = {};
    O.forEach((o: any) => { byStatus[o.status] = (byStatus[o.status] ?? 0) + 1; });

    const phaseSummary = [1, 2, 3, 4].map((p) => {
      const inPhase = O.filter((o: any) => o.phase === p);
      return {
        phase: p,
        total: inPhase.length,
        applied: inPhase.filter((o: any) => o.status === "applied" || o.status === "in review").length,
        awarded: inPhase.filter((o: any) => o.status === "awarded").length,
      };
    });

    const tasksByAssignee: Record<string, any[]> = {};
    T.filter((t: any) => t.status !== "done").forEach((t: any) => {
      const k = t.assigned_to ?? "Unassigned";
      (tasksByAssignee[k] ??= []).push({ title: t.title, due_at: t.due_at, opportunity_id: t.opportunity_id });
    });

    return jsonResponse({
      target: TARGET,
      committed,
      pipeline_count: O.length,
      active_count: O.filter((o: any) => ["applied", "in review", "drafting"].includes(o.status)).length,
      by_status: byStatus,
      phase_summary: phaseSummary,
      opportunities: O.map((o: any) => ({
        order_num: o.order_num, name: o.name, organization: o.organization, type: o.type,
        entity: o.entity, target_amount: o.target_amount, deadline: o.deadline,
        phase: o.phase, urgency: o.urgency, status: o.status,
        assigned_to: o.assigned_to, next_action: o.next_action, committed_amount: o.committed_amount,
      })),
      tasks_by_assignee: tasksByAssignee,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
