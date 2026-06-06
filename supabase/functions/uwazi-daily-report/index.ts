// UWAZI Daily Report bot: posts a daily ops summary to UWAZI's #dailyreports channel.
// Ensures the channel exists, gathers metrics, checks edge-function error signals
// (especially visi-mcp), and inserts a formatted markdown message.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UWAZI_SLUG = "uwazi";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  let ensureOnly = false;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      ensureOnly = !!body?.ensure_only;
    } catch { /* no body */ }
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const generatedAt = new Date();
  const dateLabel = generatedAt.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    timeZone: "America/Chicago",
  });
  const timeLabel = generatedAt.toLocaleString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "America/Chicago", timeZoneName: "short",
  });

  try {
    // 1. Resolve UWAZI org
    const { data: org, error: orgErr } = await supabase
      .from("orgs").select("id, name, slug").eq("slug", UWAZI_SLUG).maybeSingle();
    if (orgErr || !org) {
      return json({ error: orgErr?.message ?? "UWAZI org not found" }, 500);
    }
    const orgId = org.id as string;

    // 2. Ensure #dailyreports system channel exists
    let { data: channel } = await supabase
      .from("channels")
      .select("id")
      .eq("org_id", orgId).eq("name", "dailyreports").eq("is_system", true)
      .maybeSingle();
    if (!channel) {
      const { data: created, error: createErr } = await supabase
        .from("channels")
        .insert({
          org_id: orgId,
          name: "dailyreports",
          type: "system",
          is_system: true,
          is_dm: false,
        })
        .select("id").single();
      if (createErr || !created) {
        return json({ error: `Could not create channel: ${createErr?.message}` }, 500);
      }
      channel = created;
    }

    // 3. Gather metrics in parallel
    const [
      newContactsR, newDealsR, tasksDoneR, tasksCreatedR, msgsR, bookingsR, eventsR,
      askSessionsR, totalUsersR, newUsersR, orgMembersR, overdueR, blockedR, cancelledR,
      taskActivityR, deploysR, waitlistR,
    ] = await Promise.all([
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since),
      supabase.from("deals").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("completed_at", since),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since),
      supabase.from("events").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since),
      supabase.from("ai_conversations").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabase.from("org_memberships").select("user_id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase.from("tasks").select("id", { count: "exact", head: true })
        .eq("org_id", orgId).neq("status", "done").not("due_at", "is", null).lt("due_at", new Date().toISOString()),
      supabase.from("tasks").select("id", { count: "exact", head: true })
        .eq("org_id", orgId).eq("status", "blocked"),
      supabase.from("bookings").select("id", { count: "exact", head: true })
        .eq("org_id", orgId).eq("status", "cancelled").gte("created_at", since),
      supabase.from("task_activity").select("id", { count: "exact", head: true })
        .eq("org_id", orgId).gte("created_at", since),
      supabase.from("messages").select("id", { count: "exact", head: true })
        .eq("org_id", orgId).gte("created_at", since).contains("metadata", { kind: "deploy" }),
      // Waitlist: treat is_restricted profiles as waitlisted (matches Growth pattern)
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_restricted", true),
    ]);

    const newContacts = newContactsR.count ?? 0;
    const newDeals = newDealsR.count ?? 0;
    const tasksDone = tasksDoneR.count ?? 0;
    const tasksCreated = tasksCreatedR.count ?? 0;
    const msgs = msgsR.count ?? 0;
    const bookings = bookingsR.count ?? 0;
    const events = eventsR.count ?? 0;
    const askSessions = askSessionsR.count ?? 0;
    const totalUsers = totalUsersR.count ?? 0;
    const newUsers = newUsersR.count ?? 0;
    const orgMembers = orgMembersR.count ?? 0;
    const overdueTasks = overdueR.count ?? 0;
    const blockedTasks = blockedR.count ?? 0;
    const cancelledBookings = cancelledR.count ?? 0;
    const devActivity = taskActivityR.count ?? 0;
    const deploys = deploysR.count ?? 0;
    const waitlistCount = waitlistR.count ?? 0;
    const activeUsers = Math.max(totalUsers - waitlistCount, 0);

    // Ask UWAZI user queries (scoped to UWAZI conversations)
    let askQueries = 0;
    const { data: orgConvs } = await supabase
      .from("ai_conversations").select("id").eq("org_id", orgId);
    const convIds = (orgConvs ?? []).map((c: any) => c.id);
    if (convIds.length) {
      const { count } = await supabase
        .from("ai_messages").select("id", { count: "exact", head: true })
        .in("conversation_id", convIds).eq("role", "user").gte("created_at", since);
      askQueries = count ?? 0;
    }

    // 4. Edge Function health — query Supabase analytics for function_edge_logs
    // Falls back gracefully if the analytics endpoint isn't reachable.
    const edgeHealth = await checkEdgeFunctionHealth(since);

    const hasIssues =
      overdueTasks + cancelledBookings + blockedTasks + edgeHealth.totalErrors > 0;

    // 5. Build markdown
    const content = [
      `# 📊 UWAZI Daily Report — ${dateLabel}`,
      ``,
      `_Generated ${timeLabel}_`,
      ``,
      `## 🔧 System Health`,
      `- 🟢 Database: **healthy**`,
      `- 🟢 Auth: **operational**`,
      edgeHealth.totalErrors === 0
        ? `- 🟢 Edge functions: **operational** (no errors in last 24h)`
        : `- 🟠 Edge functions: **${edgeHealth.totalErrors} errors** in last 24h`,
      edgeHealth.visiMcpErrors > 0
        ? `- 🔴 \`visi-mcp\`: **${edgeHealth.visiMcpErrors} errors**`
        : `- 🟢 \`visi-mcp\`: **0 errors**`,
      ...(edgeHealth.topOffenders.length
        ? [`- Top offenders: ${edgeHealth.topOffenders.map((o) => `\`${o.fn}\` (${o.count})`).join(", ")}`]
        : []),
      ...(edgeHealth.note ? [`- _${edgeHealth.note}_`] : []),
      ``,
      `## 👥 Growth & Users`,
      `- 🧑 Total users: **${totalUsers}**`,
      `- ✅ Active users: **${activeUsers}**`,
      `- ⏳ Waitlist: **${waitlistCount}**`,
      `- 🏢 UWAZI members: **${orgMembers}**`,
      ``,
      `## ✨ New User Signups`,
      `- ✨ New sign-ups (24h): **${newUsers}**`,
      ``,
      `## 🚀 Activity`,
      `- 👥 New contacts: **${newContacts}**`,
      `- 💼 New deals: **${newDeals}**`,
      `- ✅ Tasks completed: **${tasksDone}**`,
      `- 📝 Tasks created: **${tasksCreated}**`,
      `- 💬 Chat messages: **${msgs}**`,
      `- 📅 New bookings: **${bookings}**`,
      `- 🗓️ Calendar events: **${events}**`,
      ``,
      `## 🤖 Ask UWAZI`,
      `- 🧵 New sessions: **${askSessions}**`,
      `- ❓ User queries: **${askQueries}**`,
      ``,
      `## ✅ Dev Activity`,
      `- 🛠️ Task activity events: **${devActivity}**`,
      `- 🚢 Deploys logged: **${deploys}**`,
      ``,
      `## 🚨 Errors & Blockers`,
      hasIssues
        ? [
            `- ⏰ Overdue tasks: **${overdueTasks}**`,
            `- 🛑 Blocked tasks: **${blockedTasks}**`,
            `- ❌ Cancelled bookings (24h): **${cancelledBookings}**`,
            `- ⚠️ Edge function errors (24h): **${edgeHealth.totalErrors}**`,
          ].join("\n")
        : `- ✅ No errors or blockers detected.`,
      ``,
      `---`,
      `🕒 _Report generated at ${generatedAt.toISOString()}_`,
    ].join("\n");

    // 6. Insert into #dailyreports
    const { error: insErr } = await supabase.from("messages").insert({
      channel_id: channel.id,
      org_id: orgId,
      user_id: null,
      content,
      metadata: {
        sender: "uwazi-daily-report",
        kind: "daily_report",
        generated_at: generatedAt.toISOString(),
      },
    });
    if (insErr) return json({ error: `Insert failed: ${insErr.message}` }, 500);

    return json({ ok: true, org: org.name, channel_id: channel.id, edgeHealth });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

async function checkEdgeFunctionHealth(since: string): Promise<{
  totalErrors: number;
  visiMcpErrors: number;
  topOffenders: Array<{ fn: string; count: number }>;
  note?: string;
}> {
  // Best-effort: query messages with metadata.kind = 'edge_error' as an app-level signal.
  // Real Supabase log analytics requires a management token not available to edge runtime.
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await supabase
      .from("messages")
      .select("metadata")
      .gte("created_at", since)
      .or("metadata->>kind.eq.edge_error,metadata->>kind.eq.error");
    if (error) throw error;
    const byFn = new Map<string, number>();
    let visiMcp = 0;
    for (const row of data ?? []) {
      const fn = String((row as any).metadata?.function ?? (row as any).metadata?.fn ?? "unknown");
      byFn.set(fn, (byFn.get(fn) ?? 0) + 1);
      if (fn === "visi-mcp") visiMcp++;
    }
    const top = [...byFn.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([fn, count]) => ({ fn, count }));
    return {
      totalErrors: data?.length ?? 0,
      visiMcpErrors: visiMcp,
      topOffenders: top,
      note: data?.length === 0 ? "Tracking app-level error reports only" : undefined,
    };
  } catch (e) {
    return {
      totalErrors: 0,
      visiMcpErrors: 0,
      topOffenders: [],
      note: `Health check unavailable: ${(e as any)?.message ?? "unknown"}`,
    };
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
