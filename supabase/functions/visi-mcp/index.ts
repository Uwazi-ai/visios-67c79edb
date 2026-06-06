/**
 * VisiOS MCP Server — team-wide, Streamable HTTP (stateless JSON-RPC)
 *
 * Auth:
 *   Authorization: Bearer <token>
 *   - tokens issued per-user via Settings → MCP Tokens (table: public.mcp_tokens)
 *   - legacy fallback: VISI_MCP_API_KEY env var maps to VISI_MCP_USER_ID (Myke)
 *
 * Every tool call is scoped to the caller's user_id and their org memberships.
 */

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import { getFreshGoogleAccessToken } from "../_shared/google.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface ToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const mcpOk = (id: any, result: unknown): MCPResponse => ({ jsonrpc: "2.0", id, result });
const mcpErr = (id: any, code: number, message: string, data?: unknown): MCPResponse =>
  ({ jsonrpc: "2.0", id, error: { code, message, data } });

const toolResult = (content: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(content, null, 2) }],
});
const toolError = (message: string) => ({
  content: [{ type: "text", text: `Error: ${message}` }],
  isError: true,
});

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function resolveUserId(admin: SupabaseClient, token: string): Promise<string | null> {
  if (!token) return null;
  // Legacy env-var token fallback (Myke's existing setup)
  const envKey = Deno.env.get("VISI_MCP_API_KEY");
  const envUser = Deno.env.get("VISI_MCP_USER_ID");
  if (envKey && envUser && token === envKey) return envUser;
  // Per-user token lookup
  const hash = await sha256Hex(token);
  const { data } = await admin.rpc("mcp_token_lookup", { _hash: hash });
  if (!data) return null;
  // best-effort last_used_at update
  admin.from("mcp_tokens").update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", hash).then(() => {});
  return data as string;
}

async function allowedOrgIds(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await admin.from("org_memberships").select("org_id").eq("user_id", userId);
  return (data ?? []).map((r: any) => r.org_id);
}

function checkOrg(orgIds: string[], orgId: unknown): string | null {
  if (typeof orgId !== "string") return "org_id is required";
  if (!orgIds.includes(orgId)) return "You do not have access to that org";
  return null;
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  { name: "visi_get_context", description: "Get the full VisiOS context: your orgs, projects, open task counts, recent notifications. Call this first.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "visi_list_orgs", description: "List all orgs you are a member of.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "visi_list_team", description: "List members of an org you belong to.", inputSchema: { type: "object", properties: { org_id: { type: "string" } }, required: ["org_id"] } },
  { name: "visi_get_tasks", description: "Get tasks. Filter by org, project, status, priority.", inputSchema: { type: "object", properties: { org_id: { type: "string" }, project_id: { type: "string" }, status: { type: "string", enum: ["todo", "in_progress", "done", "blocked"] }, priority: { type: "string", enum: ["urgent", "high", "medium", "low"] }, limit: { type: "number" } }, required: [] } },
  { name: "visi_get_projects", description: "Get active projects, optionally by org.", inputSchema: { type: "object", properties: { org_id: { type: "string" }, include_archived: { type: "boolean" } }, required: [] } },
  { name: "visi_get_notifications", description: "Get notifications (unacknowledged by default).", inputSchema: { type: "object", properties: { include_acknowledged: { type: "boolean" }, app: { type: "string" }, limit: { type: "number" } }, required: [] } },
  { name: "visi_create_task", description: "Create a task. org_id required.", inputSchema: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, org_id: { type: "string" }, project_id: { type: "string" }, section_id: { type: "string" }, priority: { type: "string", enum: ["urgent", "high", "medium", "low"] }, due_at: { type: "string" }, estimate_mins: { type: "number" } }, required: ["title", "org_id"] } },
  { name: "visi_update_task", description: "Update an existing task.", inputSchema: { type: "object", properties: { task_id: { type: "string" }, status: { type: "string", enum: ["todo", "in_progress", "done", "blocked"] }, priority: { type: "string", enum: ["urgent", "high", "medium", "low"] }, title: { type: "string" }, description: { type: "string" }, due_at: { type: "string" }, completed_at: { type: "string" } }, required: ["task_id"] } },
  { name: "visi_notify", description: "Push a notification into VisiOS (FYI-style, no approval needed).", inputSchema: { type: "object", properties: { app: { type: "string" }, title: { type: "string" }, body: { type: "string" }, severity: { type: "string", enum: ["info", "warning", "critical"] }, metadata: { type: "object" }, org_id: { type: "string" } }, required: ["app", "title"] } },
  { name: "visi_request_approval", description: "Queue an action for human approval inside VisiOS.", inputSchema: { type: "object", properties: { title: { type: "string" }, body: { type: "string" }, source: { type: "string" }, org_id: { type: "string" }, priority: { type: "string", enum: ["urgent", "high", "medium", "low"] }, metadata: { type: "object" } }, required: ["title", "source"] } },
  { name: "visi_get_pending_approvals", description: "List items awaiting your approval.", inputSchema: { type: "object", properties: { source: { type: "string" } }, required: [] } },
  { name: "visi_resolve_approval", description: "Approve or reject a pending approval item.", inputSchema: { type: "object", properties: { item_id: { type: "string" }, resolution: { type: "string", enum: ["approved", "rejected"] }, notes: { type: "string" } }, required: ["item_id", "resolution"] } },
  { name: "visi_log_activity", description: "Append an activity entry to a task's timeline.", inputSchema: { type: "object", properties: { task_id: { type: "string" }, org_id: { type: "string" }, kind: { type: "string" }, body: { type: "string" }, metadata: { type: "object" } }, required: ["task_id", "org_id", "kind"] } },
  { name: "visi_search_kb", description: "Full-text search across the VisiOS knowledge base.", inputSchema: { type: "object", properties: { query: { type: "string" }, org_id: { type: "string" }, limit: { type: "number" } }, required: ["query"] } },
  { name: "visi_search_contacts", description: "Search contacts in your orgs by name, email, or company.", inputSchema: { type: "object", properties: { query: { type: "string" }, org_id: { type: "string" }, limit: { type: "number" } }, required: ["query"] } },
  { name: "visi_get_contact", description: "Get a contact by id.", inputSchema: { type: "object", properties: { contact_id: { type: "string" } }, required: ["contact_id"] } },
  { name: "visi_get_calendar", description: "Get your Google Calendar events for a date range (defaults to next 7 days).", inputSchema: { type: "object", properties: { time_min: { type: "string", description: "ISO datetime, default = now" }, time_max: { type: "string", description: "ISO datetime, default = now+7d" }, max_results: { type: "number" } }, required: [] } },
  { name: "visi_create_calendar_event", description: "Create a Google Calendar event on your primary calendar.", inputSchema: { type: "object", properties: { summary: { type: "string" }, description: { type: "string" }, start: { type: "string", description: "ISO datetime" }, end: { type: "string", description: "ISO datetime" }, attendees: { type: "array", items: { type: "string", description: "email" } } }, required: ["summary", "start", "end"] } },
  { name: "visi_list_emails", description: "List recent Gmail threads. Supports a Gmail search query.", inputSchema: { type: "object", properties: { query: { type: "string", description: "Gmail search syntax (e.g. 'is:unread', 'from:foo@bar.com')" }, limit: { type: "number" } }, required: [] } },
  { name: "visi_get_email", description: "Get a Gmail thread by id (returns subject, participants, and message bodies).", inputSchema: { type: "object", properties: { thread_id: { type: "string" } }, required: ["thread_id"] } },
  { name: "visi_search_drive", description: "Search across the shared drives of your orgs.", inputSchema: { type: "object", properties: { query: { type: "string" }, org_id: { type: "string", description: "Limit to one org's drive" }, limit: { type: "number" } }, required: ["query"] } },
  { name: "visi_list_grants", description: "List grant opportunities. Filter by status (UWAZI grants pipeline).", inputSchema: { type: "object", properties: { status: { type: "string", enum: ["identified", "drafting", "submitted", "awarded", "rejected"] }, limit: { type: "number" } }, required: [] } },
  { name: "visi_get_grant_proposal", description: "Get the full text of a grant proposal by id.", inputSchema: { type: "object", properties: { proposal_id: { type: "string" } }, required: ["proposal_id"] } },
  { name: "visi_get_inbox", description: "Get unread messages from your VisiOS Inbox (Gmail). Returns subject, sender, snippet, and date for each unread thread.", inputSchema: { type: "object", properties: { limit: { type: "number", description: "Max threads, default 20, max 50" }, include_read: { type: "boolean", description: "If true, includes read threads too (default false)" } }, required: [] } },
  { name: "visi_trigger_agent", description: "Fire a named VisiOS agent (e.g. bug-patrol, growth-radar, sprint-commander, content-studio). Matches by template_key or name (case-insensitive). Logs a run and POSTs to the agent's webhook if configured.", inputSchema: { type: "object", properties: { agent_name: { type: "string", description: "Agent identifier: template_key or display name. Examples: 'bug-patrol', 'growth-radar', 'sprint-commander', 'content-studio'" }, payload: { type: "object", description: "Optional JSON payload to send to the agent webhook" } }, required: ["agent_name"] } },
  { name: "visi_get_daily_report", description: "Get the latest message from the dailyreports system channel for UWAZI.AI.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "visi_get_uwazi_metrics", description: "Get UWAZI.AI growth metrics: total users, new signups last 24h, waitlist count, and Ask UWAZI sessions.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "visi_get_sprint_status", description: "Get current sprint status for an org: task counts by status, in-progress items, recently completed, overdue, and upcoming due. Defaults to UWAZI.AI and a 14-day window.", inputSchema: { type: "object", properties: { org_slug: { type: "string", description: "Org slug (defaults to 'uwazi')" }, days: { type: "number", description: "Sprint window in days (default 14)" } }, required: [] } },
];



// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleGetContext(admin: SupabaseClient, userId: string) {
  const orgIds = await allowedOrgIds(admin, userId);
  const [orgsRes, projectsRes, tasksRes, notifsRes] = await Promise.all([
    admin.from("orgs").select("id, name, short_name, slug, color, is_active, description").in("id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"]),
    admin.from("projects").select("id, name, status, emoji, org_id").in("org_id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"]).eq("is_archived", false).order("display_order"),
    admin.from("tasks").select("id, title, status, priority, due_at, org_id, project_id").in("org_id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"]).neq("status", "done").order("due_at", { ascending: true, nullsFirst: false }).limit(20),
    admin.from("notifications").select("id, app, title, body, severity, created_at, org_id").is("acknowledged_at", null).order("created_at", { ascending: false }).limit(10),
  ]);
  const orgs = orgsRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const notifications = notifsRes.data ?? [];
  return toolResult({
    user_id: userId,
    orgs: orgs.map((o: any) => ({
      ...o,
      projects: projects.filter((p: any) => p.org_id === o.id),
      open_tasks: tasks.filter((t: any) => t.org_id === o.id).length,
      urgent_tasks: tasks.filter((t: any) => t.org_id === o.id && t.priority === "urgent").length,
    })),
    unacknowledged_notifications: notifications.length,
    recent_notifications: notifications.slice(0, 3),
    open_tasks_total: tasks.length,
    urgent_tasks: tasks.filter((t: any) => t.priority === "urgent"),
  });
}

async function handleListOrgs(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("org_memberships")
    .select("role, orgs(id, name, short_name, slug, color, description, is_active)")
    .eq("user_id", userId);
  if (error) return toolError(error.message);
  return toolResult((data ?? []).map((m: any) => ({ role: m.role, ...m.orgs })).filter((o: any) => o.id));
}

async function handleListTeam(admin: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const orgIds = await allowedOrgIds(admin, userId);
  const orgId = args.org_id as string;
  if (!orgIds.includes(orgId)) return toolError("You do not have access to that org");
  const { data, error } = await admin.rpc("get_org_members", { _org_id: orgId });
  if (error) return toolError(error.message);
  return toolResult(data ?? []);
}

async function handleGetTasks(admin: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const orgIds = await allowedOrgIds(admin, userId);
  let q = admin.from("tasks")
    .select("id, title, description, status, priority, due_at, estimate_mins, org_id, project_id, section_id, created_at, completed_at, task_sections(name), projects(name)")
    .in("org_id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"])
    .order("priority", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false });
  if (args.org_id) {
    if (!orgIds.includes(args.org_id as string)) return toolError("No access to that org");
    q = q.eq("org_id", args.org_id);
  }
  if (args.project_id) q = q.eq("project_id", args.project_id);
  if (args.status) q = q.eq("status", args.status);
  if (args.priority) q = q.eq("priority", args.priority);
  q = q.limit(Math.min(Number(args.limit ?? 25), 50));
  const { data, error } = await q;
  if (error) return toolError(error.message);
  return toolResult(data ?? []);
}

async function handleGetProjects(admin: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const orgIds = await allowedOrgIds(admin, userId);
  let q = admin.from("projects")
    .select("id, name, status, emoji, description, org_id, display_order, is_archived, orgs(name, short_name, color)")
    .in("org_id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"])
    .order("display_order");
  if (!args.include_archived) q = q.eq("is_archived", false);
  if (args.org_id) {
    if (!orgIds.includes(args.org_id as string)) return toolError("No access to that org");
    q = q.eq("org_id", args.org_id);
  }
  const { data, error } = await q;
  if (error) return toolError(error.message);
  return toolResult(data ?? []);
}

async function handleGetNotifications(admin: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const orgIds = await allowedOrgIds(admin, userId);
  let q = admin.from("notifications")
    .select("id, app, title, body, severity, metadata, org_id, created_at, acknowledged_at")
    .or(`org_id.is.null,org_id.in.(${orgIds.join(",") || "00000000-0000-0000-0000-000000000000"})`)
    .order("created_at", { ascending: false })
    .limit(Math.min(Number(args.limit ?? 20), 50));
  if (!args.include_acknowledged) q = q.is("acknowledged_at", null);
  if (args.app) q = q.eq("app", args.app);
  const { data, error } = await q;
  if (error) return toolError(error.message);
  return toolResult(data ?? []);
}

async function handleCreateTask(admin: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const orgIds = await allowedOrgIds(admin, userId);
  if (!orgIds.includes(args.org_id as string)) return toolError("No access to that org");
  const { data, error } = await admin.from("tasks").insert({
    title: args.title as string,
    description: (args.description as string) ?? null,
    org_id: args.org_id as string,
    project_id: (args.project_id as string) ?? null,
    section_id: (args.section_id as string) ?? null,
    priority: (args.priority as string) ?? "medium",
    due_at: (args.due_at as string) ?? null,
    estimate_mins: (args.estimate_mins as number) ?? null,
    status: "todo",
    created_by: userId,
    sort_order: 0,
  }).select().single();
  if (error) return toolError(error.message);
  return toolResult({ created: true, task: data });
}

async function handleUpdateTask(admin: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const orgIds = await allowedOrgIds(admin, userId);
  const { data: existing } = await admin.from("tasks").select("org_id").eq("id", args.task_id as string).single();
  if (!existing || !orgIds.includes(existing.org_id)) return toolError("Task not found or no access");
  const { task_id, ...updates } = args;
  const patch: Record<string, unknown> = {};
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.priority !== undefined) patch.priority = updates.priority;
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.due_at !== undefined) patch.due_at = updates.due_at;
  if (updates.completed_at !== undefined) { patch.completed_at = updates.completed_at; patch.status = "done"; }
  const { data, error } = await admin.from("tasks").update(patch).eq("id", task_id as string).select().single();
  if (error) return toolError(error.message);
  return toolResult({ updated: true, task: data });
}

async function handleNotify(admin: SupabaseClient, userId: string, args: Record<string, unknown>) {
  if (args.org_id) {
    const orgIds = await allowedOrgIds(admin, userId);
    if (!orgIds.includes(args.org_id as string)) return toolError("No access to that org");
  }
  const { data, error } = await admin.from("notifications").insert({
    app: args.app, title: args.title, body: (args.body as string) ?? null,
    severity: (args.severity as string) ?? "info",
    metadata: (args.metadata as object) ?? {},
    org_id: (args.org_id as string) ?? null,
  }).select().single();
  if (error) return toolError(error.message);
  return toolResult({ notified: true, notification: data });
}

async function handleRequestApproval(admin: SupabaseClient, userId: string, args: Record<string, unknown>) {
  if (args.org_id) {
    const orgIds = await allowedOrgIds(admin, userId);
    if (!orgIds.includes(args.org_id as string)) return toolError("No access to that org");
  }
  const { data, error } = await admin.from("items").insert({
    title: args.title, body: (args.body as string) ?? null,
    type: "agent_request", source: args.source,
    status: "pending_approval",
    priority: (args.priority as string) ?? "medium",
    org_id: (args.org_id as string) ?? null,
    user_id: userId,
    metadata: { ...((args.metadata as object) ?? {}), requested_by: args.source, requested_at: new Date().toISOString() },
  }).select().single();
  if (error) return toolError(error.message);
  return toolResult({ approval_requested: true, item_id: data.id, item: data });
}

async function handleGetPendingApprovals(admin: SupabaseClient, userId: string, args: Record<string, unknown>) {
  let q = admin.from("items")
    .select("id, title, body, source, priority, org_id, metadata, created_at")
    .eq("type", "agent_request").eq("status", "pending_approval").eq("user_id", userId)
    .order("priority", { ascending: true }).order("created_at", { ascending: true });
  if (args.source) q = q.eq("source", args.source);
  const { data, error } = await q;
  if (error) return toolError(error.message);
  return toolResult({ pending_count: (data ?? []).length, items: data ?? [] });
}

async function handleResolveApproval(admin: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const { data: existing } = await admin.from("items").select("user_id").eq("id", args.item_id as string).single();
  if (!existing || existing.user_id !== userId) return toolError("Item not found or no access");
  const { data, error } = await admin.from("items").update({ status: args.resolution as string })
    .eq("id", args.item_id as string).select().single();
  if (error) return toolError(error.message);
  return toolResult({ resolved: true, item_id: args.item_id, resolution: args.resolution, notes: args.notes ?? null, item: data });
}

async function handleLogActivity(admin: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const orgIds = await allowedOrgIds(admin, userId);
  if (!orgIds.includes(args.org_id as string)) return toolError("No access to that org");
  const { data, error } = await admin.from("task_activity").insert({
    task_id: args.task_id, org_id: args.org_id, kind: args.kind,
    body: (args.body as string) ?? null,
    metadata: (args.metadata as object) ?? {},
    user_id: userId,
  }).select().single();
  if (error) return toolError(error.message);
  return toolResult({ logged: true, activity: data });
}

async function handleSearchKb(admin: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc("search_kb_text", {
    query_text: args.query as string,
    org_filter: (args.org_id as string) ?? null,
    user_filter: userId,
    match_count: Math.min(Number(args.limit ?? 5), 10),
  });
  if (error) return toolError(error.message);
  return toolResult(data ?? []);
}

async function handleSearchContacts(admin: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const orgIds = await allowedOrgIds(admin, userId);
  const q = (args.query as string).trim();
  const pattern = `%${q}%`;
  let query = admin.from("contacts")
    .select("id, name, email, company, role, phone, engagement_stage, org_id, last_touched_at")
    .in("org_id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"])
    .or(`name.ilike.${pattern},email.ilike.${pattern},company.ilike.${pattern}`)
    .order("last_touched_at", { ascending: false, nullsFirst: false })
    .limit(Math.min(Number(args.limit ?? 10), 30));
  if (args.org_id) query = query.eq("org_id", args.org_id as string);
  const { data, error } = await query;
  if (error) return toolError(error.message);
  return toolResult(data ?? []);
}

async function handleGetContact(admin: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const orgIds = await allowedOrgIds(admin, userId);
  const { data, error } = await admin.from("contacts")
    .select("*, orgs(name, short_name)")
    .eq("id", args.contact_id as string).single();
  if (error) return toolError(error.message);
  if (!data || (data.org_id && !orgIds.includes(data.org_id))) return toolError("Contact not found or no access");
  return toolResult(data);
}

// ─── Google-backed handlers ───────────────────────────────────────────────────

async function handleGetCalendar(userId: string, args: Record<string, unknown>) {
  let accessToken: string;
  try { accessToken = await getFreshGoogleAccessToken(userId); }
  catch { return toolError("Google account not connected. Connect it in Settings → Connections."); }
  const timeMin = (args.time_min as string) ?? new Date().toISOString();
  const timeMax = (args.time_max as string) ?? new Date(Date.now() + 7 * 86400000).toISOString();
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(Math.min(Number(args.max_results ?? 25), 100)));
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return toolError(`Calendar API ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const events = (j.items ?? []).map((e: any) => ({
    id: e.id, summary: e.summary, description: e.description,
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    location: e.location,
    attendees: (e.attendees ?? []).map((a: any) => ({ email: a.email, responseStatus: a.responseStatus })),
    hangoutLink: e.hangoutLink, htmlLink: e.htmlLink,
  }));
  return toolResult(events);
}

async function handleCreateCalendarEvent(userId: string, args: Record<string, unknown>) {
  let accessToken: string;
  try { accessToken = await getFreshGoogleAccessToken(userId); }
  catch { return toolError("Google account not connected."); }
  const body = {
    summary: args.summary, description: args.description,
    start: { dateTime: args.start }, end: { dateTime: args.end },
    attendees: ((args.attendees as string[]) ?? []).map((email) => ({ email })),
  };
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return toolError(`Calendar API ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return toolResult({ created: true, event_id: j.id, htmlLink: j.htmlLink, hangoutLink: j.hangoutLink });
}

async function handleListEmails(userId: string, args: Record<string, unknown>) {
  let accessToken: string;
  try { accessToken = await getFreshGoogleAccessToken(userId); }
  catch { return toolError("Google account not connected."); }
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/threads");
  if (args.query) url.searchParams.set("q", args.query as string);
  url.searchParams.set("maxResults", String(Math.min(Number(args.limit ?? 15), 50)));
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return toolError(`Gmail API ${res.status}`);
  const j = await res.json();
  const threads = await Promise.all((j.threads ?? []).slice(0, Math.min(Number(args.limit ?? 15), 50)).map(async (t: any) => {
    const tr = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!tr.ok) return { id: t.id, snippet: t.snippet };
    const td = await tr.json();
    const last = td.messages?.[td.messages.length - 1];
    const headers = last?.payload?.headers ?? [];
    const h = (k: string) => headers.find((x: any) => x.name?.toLowerCase() === k.toLowerCase())?.value;
    return { id: t.id, subject: h("Subject"), from: h("From"), date: h("Date"), snippet: last?.snippet, message_count: td.messages?.length };
  }));
  return toolResult(threads);
}

function decodeB64Url(s: string) {
  try { return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0))); }
  catch { return ""; }
}
function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) return decodeB64Url(payload.body.data);
  if (payload.parts) {
    const text = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (text?.body?.data) return decodeB64Url(text.body.data);
    for (const p of payload.parts) { const r = extractBody(p); if (r) return r; }
  }
  return "";
}

async function handleGetEmail(userId: string, args: Record<string, unknown>) {
  let accessToken: string;
  try { accessToken = await getFreshGoogleAccessToken(userId); }
  catch { return toolError("Google account not connected."); }
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${args.thread_id}?format=full`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return toolError(`Gmail API ${res.status}`);
  const j = await res.json();
  const messages = (j.messages ?? []).map((m: any) => {
    const h = (k: string) => (m.payload?.headers ?? []).find((x: any) => x.name?.toLowerCase() === k.toLowerCase())?.value;
    return { id: m.id, from: h("From"), to: h("To"), subject: h("Subject"), date: h("Date"), body: extractBody(m.payload).slice(0, 4000) };
  });
  return toolResult({ thread_id: args.thread_id, messages });
}

async function handleSearchDrive(admin: SupabaseClient, userId: string, args: Record<string, unknown>) {
  let accessToken: string;
  try { accessToken = await getFreshGoogleAccessToken(userId); }
  catch { return toolError("Google account not connected."); }
  const orgIds = await allowedOrgIds(admin, userId);
  let orgQ = admin.from("orgs").select("id, name, shared_drive_id, shared_drive_name")
    .in("id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"])
    .not("shared_drive_id", "is", null);
  if (args.org_id) orgQ = orgQ.eq("id", args.org_id as string);
  const { data: orgs } = await orgQ;
  if (!orgs || orgs.length === 0) return toolResult({ files: [], message: "No shared drives configured for your orgs." });

  const query = (args.query as string).replace(/'/g, "\\'");
  const limit = Math.min(Number(args.limit ?? 10), 25);
  const results: any[] = [];
  for (const org of orgs) {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `(name contains '${query}' or fullText contains '${query}') and trashed = false`);
    url.searchParams.set("driveId", org.shared_drive_id);
    url.searchParams.set("corpora", "drive");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("pageSize", String(limit));
    url.searchParams.set("fields", "files(id,name,mimeType,webViewLink,modifiedTime)");
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.ok) {
      const j = await res.json();
      for (const f of j.files ?? []) results.push({ ...f, org_name: org.name, drive_name: org.shared_drive_name });
    }
  }
  return toolResult(results);
}

async function handleListGrants(admin: SupabaseClient, args: Record<string, unknown>) {
  let q = admin.from("grant_opportunities")
    .select("id, name, funder, amount_min, amount_max, deadline, focus_area, alignment, status, url")
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(Math.min(Number(args.limit ?? 25), 100));
  if (args.status) q = q.eq("status", args.status);
  const { data, error } = await q;
  if (error) return toolError(error.message);
  return toolResult(data ?? []);
}

async function handleGetGrantProposal(admin: SupabaseClient, args: Record<string, unknown>) {
  const { data, error } = await admin.from("grant_proposals")
    .select("*, grant_opportunities(name, funder, deadline)")
    .eq("id", args.proposal_id as string).single();
  if (error) return toolError(error.message);
  return toolResult(data);
}

async function handleGetInbox(userId: string, args: Record<string, unknown>) {
  let accessToken: string;
  try { accessToken = await getFreshGoogleAccessToken(userId); }
  catch { return toolError("Google account not connected. Connect Google in Settings → Connections."); }
  const limit = Math.min(Number(args.limit ?? 20), 50);
  const includeRead = Boolean(args.include_read);
  const q = includeRead ? "in:inbox" : "is:unread in:inbox";
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/threads");
  url.searchParams.set("q", q);
  url.searchParams.set("maxResults", String(limit));
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return toolError(`Gmail API ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const threads = await Promise.all((j.threads ?? []).map(async (t: any) => {
    const tr = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!tr.ok) return { id: t.id, snippet: t.snippet };
    const td = await tr.json();
    const last = td.messages?.[td.messages.length - 1];
    const headers = last?.payload?.headers ?? [];
    const h = (k: string) => headers.find((x: any) => x.name?.toLowerCase() === k.toLowerCase())?.value;
    const isUnread = (last?.labelIds ?? []).includes("UNREAD");
    return { id: t.id, subject: h("Subject"), from: h("From"), date: h("Date"), snippet: last?.snippet, message_count: td.messages?.length, unread: isUnread };
  }));
  return toolResult({ count: threads.length, threads });
}

async function handleTriggerAgent(admin: SupabaseClient, userId: string, args: Record<string, unknown>) {
  const nameArg = String(args.agent_name ?? "").trim();
  if (!nameArg) return toolError("agent_name is required");
  const payload = (args.payload ?? {}) as Record<string, unknown>;

  // Match by template_key OR normalized name (slugified)
  const slug = nameArg.toLowerCase().replace(/[\s_]+/g, "-");
  const { data: agents } = await admin
    .from("visi_agents")
    .select("id, name, template_key, make_scenario_url, trigger_type, run_count");
  const agent = (agents ?? []).find((a: any) => {
    const tk = (a.template_key ?? "").toLowerCase();
    const nm = (a.name ?? "").toLowerCase().replace(/[\s_]+/g, "-");
    return tk === slug || tk === nameArg.toLowerCase() || nm === slug;
  }) as any;
  if (!agent) return toolError(`Agent not found: ${nameArg}. Try template_key like 'bug-patrol' or 'growth-radar'.`);

  // Log run
  const startedAt = new Date().toISOString();
  const { data: runRow } = await admin.from("visi_agent_runs").insert({
    agent_id: agent.id,
    status: "running",
    triggered_by: `mcp:${userId}`,
    started_at: startedAt,
  }).select("id").single();

  let webhookStatus: number | null = null;
  let webhookBody: string | null = null;
  let finalStatus: "success" | "failed" | "running" = "running";
  let errorMessage: string | null = null;

  if (agent.make_scenario_url) {
    try {
      const res = await fetch(agent.make_scenario_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, triggered_by: userId, agent_id: agent.id, run_id: runRow?.id }),
      });
      webhookStatus = res.status;
      webhookBody = (await res.text()).slice(0, 500);
      finalStatus = res.ok ? "success" : "failed";
      if (!res.ok) errorMessage = `Webhook ${res.status}: ${webhookBody}`;
    } catch (e) {
      finalStatus = "failed";
      errorMessage = e instanceof Error ? e.message : String(e);
    }
  } else {
    // No webhook — mark as queued/manual
    finalStatus = "success";
  }

  const finishedAt = new Date().toISOString();
  if (runRow?.id) {
    await admin.from("visi_agent_runs").update({
      status: finalStatus,
      finished_at: finishedAt,
      duration_ms: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
      error_message: errorMessage,
      output_summary: webhookBody,
    }).eq("id", runRow.id);
  }
  await admin.from("visi_agents").update({
    last_run_at: finishedAt,
    last_run_status: finalStatus,
    run_count: (agent.run_count ?? 0) + 1,
  }).eq("id", agent.id);

  return toolResult({
    triggered: true,
    agent: { id: agent.id, name: agent.name, template_key: agent.template_key },
    run_id: runRow?.id,
    status: finalStatus,
    webhook_status: webhookStatus,
    error: errorMessage,
  });
}

async function handleGetDailyReport(admin: SupabaseClient, userId: string) {
  const orgIds = await allowedOrgIds(admin, userId);
  // Find UWAZI.AI org
  const { data: org } = await admin.from("orgs").select("id").or("slug.eq.uwazi,name.eq.UWAZI.AI").single();
  if (!org || !orgIds.includes(org.id)) return toolError("You do not have access to UWAZI.AI");

  // Find dailyreports system channel
  const { data: channel } = await admin.from("channels").select("id").eq("org_id", org.id).eq("name", "dailyreports").eq("is_system", true).single();
  if (!channel) return toolError("dailyreports channel not found");

  // Get latest message with sender info
  const { data: message } = await admin.from("messages")
    .select("id, content, created_at, user_id, metadata, profiles(display_name, email, avatar_url)")
    .eq("channel_id", channel.id)
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!message) return toolResult({ message: null, note: "No daily report available yet." });

  const profile = (message.profiles as any) ?? {};
  return toolResult({
    id: message.id,
    content: message.content,
    created_at: message.created_at,
    sender: { id: message.user_id, name: profile.display_name ?? null, email: profile.email ?? null, avatar_url: profile.avatar_url ?? null },
    metadata: message.metadata,
  });
}

async function handleGetUwaziMetrics(admin: SupabaseClient, userId: string) {
  const orgIds = await allowedOrgIds(admin, userId);
  const { data: org } = await admin.from("orgs").select("id").eq("slug", "uwazi").maybeSingle();
  if (!org || !orgIds.includes(org.id)) return toolError("You do not have access to UWAZI.AI");
  const orgId = org.id as string;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    totalUsersR, newUsersR, waitlistR, askSessionsR,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_restricted", true),
    admin.from("ai_conversations").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", since),
  ]);

  // User queries in UWAZI AI conversations (last 24h)
  let askQueries = 0;
  const { data: orgConvs } = await admin.from("ai_conversations").select("id").eq("org_id", orgId);
  const convIds = (orgConvs ?? []).map((c: any) => c.id);
  if (convIds.length) {
    const { count } = await admin.from("ai_messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .eq("role", "user")
      .gte("created_at", since);
    askQueries = count ?? 0;
  }

  return toolResult({
    total_users: totalUsersR.count ?? 0,
    new_signups_24h: newUsersR.count ?? 0,
    waitlist_count: waitlistR.count ?? 0,
    active_users: Math.max((totalUsersR.count ?? 0) - (waitlistR.count ?? 0), 0),
    ask_uwazi_sessions_24h: askSessionsR.count ?? 0,
    ask_uwazi_user_queries_24h: askQueries,
    uwazi_org_members: (await admin.from("org_memberships").select("user_id", { count: "exact", head: true }).eq("org_id", orgId)).count ?? 0,
    as_of: new Date().toISOString(),
  });
}


// ─── Dispatcher ───────────────────────────────────────────────────────────────


async function dispatchTool(name: string, args: Record<string, unknown>, admin: SupabaseClient, userId: string): Promise<unknown> {

  switch (name) {
    case "visi_get_context": return handleGetContext(admin, userId);
    case "visi_list_orgs": return handleListOrgs(admin, userId);
    case "visi_list_team": return handleListTeam(admin, userId, args);
    case "visi_get_tasks": return handleGetTasks(admin, userId, args);
    case "visi_get_projects": return handleGetProjects(admin, userId, args);
    case "visi_get_notifications": return handleGetNotifications(admin, userId, args);
    case "visi_create_task": return handleCreateTask(admin, userId, args);
    case "visi_update_task": return handleUpdateTask(admin, userId, args);
    case "visi_notify": return handleNotify(admin, userId, args);
    case "visi_request_approval": return handleRequestApproval(admin, userId, args);
    case "visi_get_pending_approvals": return handleGetPendingApprovals(admin, userId, args);
    case "visi_resolve_approval": return handleResolveApproval(admin, userId, args);
    case "visi_log_activity": return handleLogActivity(admin, userId, args);
    case "visi_search_kb": return handleSearchKb(admin, userId, args);
    case "visi_search_contacts": return handleSearchContacts(admin, userId, args);
    case "visi_get_contact": return handleGetContact(admin, userId, args);
    case "visi_get_calendar": return handleGetCalendar(userId, args);
    case "visi_create_calendar_event": return handleCreateCalendarEvent(userId, args);
    case "visi_list_emails": return handleListEmails(userId, args);
    case "visi_get_email": return handleGetEmail(userId, args);
    case "visi_search_drive": return handleSearchDrive(admin, userId, args);
    case "visi_list_grants": return handleListGrants(admin, args);
    case "visi_get_grant_proposal": return handleGetGrantProposal(admin, args);
    case "visi_get_inbox": return handleGetInbox(userId, args);
    case "visi_trigger_agent": return handleTriggerAgent(admin, userId, args);
    case "visi_get_daily_report": return handleGetDailyReport(admin, userId);
    case "visi_get_uwazi_metrics": return handleGetUwaziMetrics(admin, userId);
    default: return toolError(`Unknown tool: ${name}`);


  }
}

async function handleMCPRequest(req: MCPRequest, admin: SupabaseClient, userId: string): Promise<MCPResponse> {
  const { id, method, params } = req;
  switch (method) {
    case "initialize":
      return mcpOk(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "visios-mcp", version: "2.0.0" } });
    case "notifications/initialized": return mcpOk(id, {});
    case "ping": return mcpOk(id, {});
    case "tools/list": return mcpOk(id, { tools: TOOLS });
    case "tools/call": {
      const p = params as ToolCallParams | undefined;
      if (!p?.name) return mcpErr(id, -32602, "Missing tool name");
      try {
        const result = await dispatchTool(p.name, p.arguments ?? {}, admin, userId);
        return mcpOk(id, result);
      } catch (e) {
        return mcpErr(id, -32603, e instanceof Error ? e.message : String(e));
      }
    }
    default: return mcpErr(id, -32601, `Method not found: ${method}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const userId = await resolveUserId(admin, token);
  if (!userId) return json({ error: "Unauthorized" }, 401);

  let body: unknown;
  try { body = await req.json(); }
  catch { return json(mcpErr(null, -32700, "Parse error: invalid JSON"), 400); }

  if (Array.isArray(body)) {
    const responses = await Promise.all(body.map((r) => handleMCPRequest(r as MCPRequest, admin, userId)));
    return json(responses);
  }
  return json(await handleMCPRequest(body as MCPRequest, admin, userId));
});
