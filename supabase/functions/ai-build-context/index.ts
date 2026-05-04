// Build live context snapshot for the AI assistant: today's events, open task counts,
// recent contacts, training data, and KB hits matching the current user query.
import { corsHeaders, jsonResponse, getAuthedUserFromReq, adminClient } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { org_id, query, use_kb } = await req.json();
    const admin = adminClient();

    // Profile + training
    const [profileRes, trainingRes] = await Promise.all([
      admin.from("profiles").select("display_name, preferred_name, email, timezone, title, company").eq("id", user.id).maybeSingle(),
      admin.from("ai_training").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    const today = new Date();
    const dayStart = new Date(today); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(today); dayEnd.setHours(23, 59, 59, 999);

    // Today events, open tasks (org-scoped if provided)
    const eventsQ = admin.from("events").select("title, start_at, end_at, attendees")
      .gte("start_at", dayStart.toISOString())
      .lte("start_at", dayEnd.toISOString())
      .order("start_at", { ascending: true })
      .limit(10);
    const tasksQ = admin.from("tasks").select("title, status, priority, due_at")
      .neq("status", "done")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(15);
    const contactsQ = admin.from("contacts")
      .select("name, company, role, email, last_touched_at")
      .order("last_touched_at", { ascending: false, nullsFirst: false })
      .limit(8);

    if (org_id) {
      eventsQ.eq("org_id", org_id);
      tasksQ.eq("org_id", org_id);
      contactsQ.eq("org_id", org_id);
    }

    const [{ data: events }, { data: tasks }, { data: contacts }] = await Promise.all([eventsQ, tasksQ, contactsQ]);

    // KB search via FTS
    let citations: { id: string; document_id: string; title: string; snippet: string }[] = [];
    if (use_kb && typeof query === "string" && query.trim().length > 2) {
      const { data: kbHits } = await admin.rpc("search_kb_text", {
        query_text: query,
        org_filter: org_id ?? null,
        user_filter: user.id,
        match_count: 5,
      });
      citations = (kbHits ?? []).map((h: any) => ({
        id: h.id,
        document_id: h.document_id,
        title: h.document_title,
        snippet: h.content.slice(0, 600),
      }));
    }

    // Fundraising context (lightweight summary, included when query mentions raise/capital/fundraising/etc.)
    let fundraising: any = null;
    const q = typeof query === "string" ? query.toLowerCase() : "";
    if (/fundrais|raise|capital|investor|grant|accelerator|vc|pipeline|opportunit/.test(q)) {
      const [{ data: opps }, { data: ftasks }] = await Promise.all([
        admin.from("fundraising_opportunities").select("name,organization,type,entity,phase,urgency,status,deadline,target_amount,assigned_to,next_action,committed_amount").order("order_num"),
        admin.from("fundraising_tasks").select("title,due_at,assigned_to,status,opportunity_id").neq("status", "done"),
      ]);
      const O = opps ?? [];
      fundraising = {
        target: 2_750_000,
        committed: O.reduce((s: number, o: any) => s + Number(o.committed_amount ?? 0), 0),
        pipeline_count: O.length,
        opportunities: O,
        open_tasks: ftasks ?? [],
      };
    }

    return jsonResponse({
      profile: profileRes.data ?? null,
      training: trainingRes.data ?? null,
      events: events ?? [],
      tasks: tasks ?? [],
      contacts: contacts ?? [],
      citations,
      fundraising,
      today: today.toISOString(),
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
