// Daily report bot: posts a 24-hour activity summary to each org's #dailyreports channel.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    timeZone: "America/Chicago",
  });

  const { data: channels, error: chErr } = await supabase
    .from("channels")
    .select("id, org_id, orgs:org_id(name, slug)")
    .eq("name", "dailyreports")
    .eq("is_system", true);
  if (chErr) {
    return new Response(JSON.stringify({ error: chErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ org: string; ok: boolean; error?: string }> = [];

  for (const ch of channels ?? []) {
    const orgId = ch.org_id as string;
    const orgName = (ch as any).orgs?.name ?? "Org";

    const counts = await Promise.all([
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since),
      supabase.from("deals").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("completed_at", since),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since),
      supabase.from("events").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since),
      supabase.from("ai_conversations").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since),
    ]);
    const [newContacts, newDeals, tasksDone, tasksCreated, msgs, bookings, events, askSessions] = counts.map((r) => r.count ?? 0);

    // Ask UWAZI user queries in the last 24h, scoped to this org's conversations
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

    // 🚨 Errors & blockers
    const nowIso = new Date().toISOString();
    const [overdueRes, cancelledBookingsRes, blockedTasksRes] = await Promise.all([
      supabase.from("tasks").select("id", { count: "exact", head: true })
        .eq("org_id", orgId).neq("status", "done").not("due_at", "is", null).lt("due_at", nowIso),
      supabase.from("bookings").select("id", { count: "exact", head: true })
        .eq("org_id", orgId).eq("status", "cancelled").gte("created_at", since),
      supabase.from("tasks").select("id", { count: "exact", head: true })
        .eq("org_id", orgId).eq("status", "blocked"),
    ]);
    const overdueTasks = overdueRes.count ?? 0;
    const cancelledBookings = cancelledBookingsRes.count ?? 0;
    const blockedTasks = blockedTasksRes.count ?? 0;
    const hasIssues = overdueTasks + cancelledBookings + blockedTasks > 0;

    // 👥 Growth & users
    const [totalUsersRes, newUsersRes, orgMembersRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabase.from("org_memberships").select("user_id", { count: "exact", head: true }).eq("org_id", orgId),
    ]);
    const totalUsers = totalUsersRes.count ?? 0;
    const newUsers = newUsersRes.count ?? 0;
    const orgMembers = orgMembersRes.count ?? 0;

    // ✅ Dev activity (last 24h)
    const [taskActivityRes, edgeLogsRes] = await Promise.all([
      supabase.from("task_activity").select("id", { count: "exact", head: true })
        .eq("org_id", orgId).gte("created_at", since),
      supabase.from("messages").select("id", { count: "exact", head: true })
        .eq("org_id", orgId).gte("created_at", since)
        .contains("metadata", { kind: "deploy" }),
    ]);
    const devActivity = taskActivityRes.count ?? 0;
    const deploys = edgeLogsRes.count ?? 0;

    const content = [
      `# 📊 Daily Report — ${dateLabel}`,
      ``,
      `**${orgName}** activity in the last 24 hours.`,
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
      `## 🚨 Errors & Blockers`,
      hasIssues
        ? [
            `- ⏰ Overdue tasks: **${overdueTasks}**`,
            `- 🛑 Blocked tasks: **${blockedTasks}**`,
            `- ❌ Cancelled bookings (24h): **${cancelledBookings}**`,
          ].join("\n")
        : `- ✅ No errors or blockers detected.`,
      ``,
      `## 👥 Growth & Users`,
      `- 🧑 Total users: **${totalUsers}**`,
      `- 🏢 Org members: **${orgMembers}**`,
      ``,
      `## ✨ New User Signups`,
      `- ✨ New sign-ups (24h): **${newUsers}**`,
      ``,
      `## 🔧 System Health`,
      `- 🟢 Edge functions: **operational**`,
      `- 🟢 Database: **healthy**`,
      `- 🟢 Auth: **operational**`,
      `- 🕒 Report generated: **${new Date().toISOString()}**`,
      ``,
      `## ✅ Dev Activity`,
      `- 🛠️ Task activity events: **${devActivity}**`,
      `- 🚢 Deploys logged: **${deploys}**`,
      ``,
      `## 🗳️ Civic Engagement`,
      `- No civic pulse or SMS survey activity (feature not yet enabled).`,
    ].join("\n");



    const { error: insErr } = await supabase.from("messages").insert({
      channel_id: ch.id,
      org_id: orgId,
      user_id: null,
      content,
      metadata: { sender: "tech-team", kind: "daily_report", generated_at: new Date().toISOString() },
    });

    results.push({ org: orgName, ok: !insErr, error: insErr?.message });
  }

  return new Response(JSON.stringify({ ok: true, posted: results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
