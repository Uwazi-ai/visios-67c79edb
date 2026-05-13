/**
 * VisiOS MCP Server
 * Supabase Edge Function — Streamable HTTP transport (stateless JSON-RPC)
 *
 * Exposes VisiOS data as MCP tools so Claude can directly read context,
 * create tasks, fire notifications, and queue agent approval requests.
 *
 * Auth: Bearer token in Authorization header (VISI_MCP_API_KEY env var)
 * Scope: All operations are scoped to VISI_MCP_USER_ID env var (Myke's user)
 *
 * Connect in Claude settings:
 *   URL: https://<project>.supabase.co/functions/v1/visi-mcp
 *   Header: Authorization: Bearer <VISI_MCP_API_KEY>
 */

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

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

function mcpOk(id: string | number | null, result: unknown): MCPResponse {
  return { jsonrpc: "2.0", id, result };
}

function mcpErr(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): MCPResponse {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

function toolResult(content: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(content, null, 2) }],
  };
}

function toolError(message: string) {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "visi_get_context",
    description:
      "Get the full VisiOS context snapshot: active orgs, their projects, open task counts, and recent notifications. Call this first in every agent session to understand the current state of Myke's work.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "visi_get_tasks",
    description:
      "Get tasks from VisiOS. Filter by org, project, status, or priority. Returns tasks with title, status, priority, due date, and section.",
    inputSchema: {
      type: "object",
      properties: {
        org_id: { type: "string", description: "Filter by org ID" },
        project_id: { type: "string", description: "Filter by project ID" },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done", "blocked"],
          description: "Filter by status",
        },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low"],
          description: "Filter by priority",
        },
        limit: { type: "number", description: "Max results (default 25, max 50)" },
      },
      required: [],
    },
  },
  {
    name: "visi_get_projects",
    description: "Get all active projects, optionally filtered by org.",
    inputSchema: {
      type: "object",
      properties: {
        org_id: { type: "string", description: "Filter by org ID" },
        include_archived: {
          type: "boolean",
          description: "Include archived projects (default false)",
        },
      },
      required: [],
    },
  },
  {
    name: "visi_get_notifications",
    description:
      "Get VisiOS notifications. By default returns only unacknowledged ones.",
    inputSchema: {
      type: "object",
      properties: {
        include_acknowledged: {
          type: "boolean",
          description: "Include already-acknowledged notifications",
        },
        app: {
          type: "string",
          description: 'Filter by app/agent source (e.g. "bug_patrol", "growth_radar")',
        },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "visi_create_task",
    description:
      "Create a new task in VisiOS. Always provide org_id. Project and section are optional.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title (required)" },
        description: { type: "string", description: "Task description / body" },
        org_id: { type: "string", description: "Org this task belongs to (required)" },
        project_id: { type: "string", description: "Project ID" },
        section_id: { type: "string", description: "Section ID" },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low"],
          description: "Priority level",
        },
        due_at: {
          type: "string",
          description: "Due date ISO string (e.g. 2026-05-15T00:00:00Z)",
        },
        estimate_mins: { type: "number", description: "Time estimate in minutes" },
      },
      required: ["title", "org_id"],
    },
  },
  {
    name: "visi_update_task",
    description:
      "Update an existing task. Use this to change status, priority, due date, or description.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Task ID to update (required)" },
        status: { type: "string", enum: ["todo", "in_progress", "done", "blocked"] },
        priority: { type: "string", enum: ["urgent", "high", "medium", "low"] },
        title: { type: "string" },
        description: { type: "string" },
        due_at: { type: "string", description: "ISO date string" },
        completed_at: {
          type: "string",
          description: "Set to mark as complete (ISO string)",
        },
      },
      required: ["task_id"],
    },
  },
  {
    name: "visi_notify",
    description:
      "Push a read-only notification into VisiOS. Use for alerts that don't require Myke's approval — new users, build completions, milestone hits, FYI events.",
    inputSchema: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description:
            'Agent source name (e.g. "bug_patrol", "growth_radar", "sprint_commander", "content_studio")',
        },
        title: { type: "string", description: "Notification title (required)" },
        body: { type: "string", description: "Notification body / detail" },
        severity: {
          type: "string",
          enum: ["info", "warning", "critical"],
          description: "Severity level (default: info)",
        },
        metadata: {
          type: "object",
          description: "Structured payload (user data, error details, etc.)",
        },
        org_id: { type: "string", description: "Org this notification is for" },
      },
      required: ["app", "title"],
    },
  },
  {
    name: "visi_request_approval",
    description:
      "Queue an action for Myke's approval inside VisiOS. Use for anything that touches production: opening PRs, publishing content, triggering deploys, sending communications. Creates a pending item Myke must approve or reject.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "What is being requested (required)" },
        body: {
          type: "string",
          description: "Full context, diff, script, or plan being approved",
        },
        source: {
          type: "string",
          description: 'Which agent is requesting (e.g. "bug_patrol", "content_studio")',
        },
        org_id: { type: "string", description: "Org this request relates to" },
        priority: { type: "string", enum: ["urgent", "high", "medium", "low"] },
        metadata: {
          type: "object",
          description: "Structured payload (PR url, content script, deploy config, etc.)",
        },
      },
      required: ["title", "source"],
    },
  },
  {
    name: "visi_get_pending_approvals",
    description:
      "Get all items currently awaiting Myke's approval, sorted by priority then creation date.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Filter by agent source" },
      },
      required: [],
    },
  },
  {
    name: "visi_resolve_approval",
    description:
      "Approve or reject a pending approval item. Once resolved, agents can proceed (approved) or abort (rejected).",
    inputSchema: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "Item ID to resolve (required)" },
        resolution: {
          type: "string",
          enum: ["approved", "rejected"],
          description: "Resolution decision (required)",
        },
        notes: {
          type: "string",
          description: "Optional notes from Myke about the decision",
        },
      },
      required: ["item_id", "resolution"],
    },
  },
  {
    name: "visi_log_activity",
    description:
      "Log an activity entry to a task's timeline. Use to record what an agent did (bug triage, PR opened, content generated, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Task ID to log against (required)" },
        org_id: { type: "string", description: "Org ID (required)" },
        kind: {
          type: "string",
          description:
            'Activity kind (e.g. "agent_comment", "status_change", "bug_triage", "pr_opened")',
        },
        body: { type: "string", description: "Activity message / description" },
        metadata: { type: "object", description: "Additional structured data" },
      },
      required: ["task_id", "org_id", "kind"],
    },
  },
  {
    name: "visi_search_kb",
    description:
      "Full-text search across the VisiOS knowledge base. Use to find playbooks, policies, process docs, and reference material.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (required)" },
        org_id: { type: "string", description: "Limit search to a specific org" },
        limit: { type: "number", description: "Max results (default 5)" },
      },
      required: ["query"],
    },
  },
];

// ─── Tool Handlers ────────────────────────────────────────────────────────────

async function handleGetContext(admin: SupabaseClient, userId: string) {
  const [orgsRes, projectsRes, tasksRes, notifsRes] = await Promise.all([
    admin
      .from("org_memberships")
      .select(
        "role, orgs(id, name, short_name, slug, color, is_active, description, success_metric)",
      )
      .eq("user_id", userId),
    admin
      .from("projects")
      .select("id, name, status, emoji, org_id, description")
      .eq("is_archived", false)
      .order("display_order"),
    admin
      .from("tasks")
      .select("id, title, status, priority, due_at, org_id, project_id")
      .neq("status", "done")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(20),
    admin
      .from("notifications")
      .select("id, app, title, body, severity, created_at, org_id")
      .is("acknowledged_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const orgs = (orgsRes.data ?? []).map((m: any) => m.orgs).filter(Boolean);
  const projects = projectsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const notifications = notifsRes.data ?? [];

  const orgSummary = orgs.map((org: any) => ({
    ...org,
    projects: projects.filter((p: any) => p.org_id === org.id),
    open_tasks: tasks.filter((t: any) => t.org_id === org.id).length,
    urgent_tasks: tasks.filter(
      (t: any) => t.org_id === org.id && t.priority === "urgent",
    ).length,
  }));

  return toolResult({
    user_id: userId,
    orgs: orgSummary,
    unacknowledged_notifications: notifications.length,
    recent_notifications: notifications.slice(0, 3),
    open_tasks_total: tasks.length,
    urgent_tasks: tasks.filter((t: any) => t.priority === "urgent"),
  });
}

async function handleGetTasks(admin: SupabaseClient, args: Record<string, unknown>) {
  let q = admin
    .from("tasks")
    .select(
      "id, title, description, status, priority, due_at, estimate_mins, org_id, project_id, section_id, created_at, completed_at, task_sections(name), projects(name)",
    )
    .order("priority", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false });

  if (args.org_id) q = q.eq("org_id", args.org_id);
  if (args.project_id) q = q.eq("project_id", args.project_id);
  if (args.status) q = q.eq("status", args.status);
  if (args.priority) q = q.eq("priority", args.priority);
  q = q.limit(Math.min(Number(args.limit ?? 25), 50));

  const { data, error } = await q;
  if (error) return toolError(error.message);
  return toolResult(data ?? []);
}

async function handleGetProjects(admin: SupabaseClient, args: Record<string, unknown>) {
  let q = admin
    .from("projects")
    .select(
      "id, name, status, emoji, description, org_id, display_order, is_archived, orgs(name, short_name, color)",
    )
    .order("display_order");

  if (!args.include_archived) q = q.eq("is_archived", false);
  if (args.org_id) q = q.eq("org_id", args.org_id);

  const { data, error } = await q;
  if (error) return toolError(error.message);
  return toolResult(data ?? []);
}

async function handleGetNotifications(
  admin: SupabaseClient,
  args: Record<string, unknown>,
) {
  let q = admin
    .from("notifications")
    .select(
      "id, app, title, body, severity, metadata, org_id, created_at, acknowledged_at",
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(Number(args.limit ?? 20), 50));

  if (!args.include_acknowledged) q = q.is("acknowledged_at", null);
  if (args.app) q = q.eq("app", args.app);

  const { data, error } = await q;
  if (error) return toolError(error.message);
  return toolResult(data ?? []);
}

async function handleCreateTask(
  admin: SupabaseClient,
  userId: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await admin
    .from("tasks")
    .insert({
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
    })
    .select()
    .single();

  if (error) return toolError(error.message);
  return toolResult({ created: true, task: data });
}

async function handleUpdateTask(admin: SupabaseClient, args: Record<string, unknown>) {
  const { task_id, ...updates } = args;
  const patch: Record<string, unknown> = {};
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.priority !== undefined) patch.priority = updates.priority;
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.due_at !== undefined) patch.due_at = updates.due_at;
  if (updates.completed_at !== undefined) {
    patch.completed_at = updates.completed_at;
    patch.status = "done";
  }

  const { data, error } = await admin
    .from("tasks")
    .update(patch)
    .eq("id", task_id as string)
    .select()
    .single();

  if (error) return toolError(error.message);
  return toolResult({ updated: true, task: data });
}

async function handleNotify(admin: SupabaseClient, args: Record<string, unknown>) {
  const { data, error } = await admin
    .from("notifications")
    .insert({
      app: args.app as string,
      title: args.title as string,
      body: (args.body as string) ?? null,
      severity: (args.severity as string) ?? "info",
      metadata: (args.metadata as object) ?? {},
      org_id: (args.org_id as string) ?? null,
    })
    .select()
    .single();

  if (error) return toolError(error.message);
  return toolResult({ notified: true, notification: data });
}

async function handleRequestApproval(
  admin: SupabaseClient,
  userId: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await admin
    .from("items")
    .insert({
      title: args.title as string,
      body: (args.body as string) ?? null,
      type: "agent_request",
      source: args.source as string,
      status: "pending_approval",
      priority: (args.priority as string) ?? "medium",
      org_id: (args.org_id as string) ?? null,
      user_id: userId,
      metadata: {
        ...((args.metadata as object) ?? {}),
        requested_by: args.source,
        requested_at: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (error) return toolError(error.message);
  return toolResult({
    approval_requested: true,
    item_id: data.id,
    item: data,
    message: "Approval request queued in VisiOS. Myke must approve before proceeding.",
  });
}

async function handleGetPendingApprovals(
  admin: SupabaseClient,
  userId: string,
  args: Record<string, unknown>,
) {
  let q = admin
    .from("items")
    .select("id, title, body, source, priority, org_id, metadata, created_at")
    .eq("type", "agent_request")
    .eq("status", "pending_approval")
    .eq("user_id", userId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (args.source) q = q.eq("source", args.source);

  const { data, error } = await q;
  if (error) return toolError(error.message);
  return toolResult({ pending_count: (data ?? []).length, items: data ?? [] });
}

async function handleResolveApproval(
  admin: SupabaseClient,
  args: Record<string, unknown>,
) {
  const { data: updated, error: updateErr } = await admin
    .from("items")
    .update({ status: args.resolution as string })
    .eq("id", args.item_id as string)
    .select()
    .single();

  if (updateErr) return toolError(updateErr.message);
  return toolResult({
    resolved: true,
    item_id: args.item_id,
    resolution: args.resolution,
    notes: args.notes ?? null,
    item: updated,
  });
}

async function handleLogActivity(
  admin: SupabaseClient,
  userId: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await admin
    .from("task_activity")
    .insert({
      task_id: args.task_id as string,
      org_id: args.org_id as string,
      kind: args.kind as string,
      body: (args.body as string) ?? null,
      metadata: (args.metadata as object) ?? {},
      user_id: userId,
    })
    .select()
    .single();

  if (error) return toolError(error.message);
  return toolResult({ logged: true, activity: data });
}

async function handleSearchKb(
  admin: SupabaseClient,
  userId: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await admin.rpc("search_kb_text", {
    query_text: args.query as string,
    org_filter: (args.org_id as string) ?? null,
    user_filter: userId,
    match_count: Math.min(Number(args.limit ?? 5), 10),
  });

  if (error) return toolError(error.message);
  return toolResult(data ?? []);
}

// ─── MCP Protocol Handler ─────────────────────────────────────────────────────

async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  admin: SupabaseClient,
  userId: string,
): Promise<unknown> {
  switch (name) {
    case "visi_get_context":
      return handleGetContext(admin, userId);
    case "visi_get_tasks":
      return handleGetTasks(admin, args);
    case "visi_get_projects":
      return handleGetProjects(admin, args);
    case "visi_get_notifications":
      return handleGetNotifications(admin, args);
    case "visi_create_task":
      return handleCreateTask(admin, userId, args);
    case "visi_update_task":
      return handleUpdateTask(admin, args);
    case "visi_notify":
      return handleNotify(admin, args);
    case "visi_request_approval":
      return handleRequestApproval(admin, userId, args);
    case "visi_get_pending_approvals":
      return handleGetPendingApprovals(admin, userId, args);
    case "visi_resolve_approval":
      return handleResolveApproval(admin, args);
    case "visi_log_activity":
      return handleLogActivity(admin, userId, args);
    case "visi_search_kb":
      return handleSearchKb(admin, userId, args);
    default:
      return toolError(`Unknown tool: ${name}`);
  }
}

async function handleMCPRequest(
  req: MCPRequest,
  admin: SupabaseClient,
  userId: string,
): Promise<MCPResponse> {
  const { id, method, params } = req;

  switch (method) {
    case "initialize":
      return mcpOk(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "visios-mcp", version: "1.0.0" },
      });

    case "notifications/initialized":
      return mcpOk(id, {});

    case "ping":
      return mcpOk(id, {});

    case "tools/list":
      return mcpOk(id, { tools: TOOLS });

    case "tools/call": {
      const p = params as ToolCallParams | undefined;
      if (!p?.name) return mcpErr(id, -32602, "Missing tool name");
      const args = p.arguments ?? {};
      try {
        const result = await dispatchTool(p.name, args, admin, userId);
        return mcpOk(id, result);
      } catch (e) {
        return mcpErr(id, -32603, e instanceof Error ? e.message : String(e));
      }
    }

    default:
      return mcpErr(id, -32601, `Method not found: ${method}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("VISI_MCP_API_KEY");
  const userId = Deno.env.get("VISI_MCP_USER_ID");

  if (!apiKey || !userId) {
    return json({ error: "Server misconfigured: missing env vars" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (token !== apiKey) {
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(mcpErr(null, -32700, "Parse error: invalid JSON"), 400);
  }

  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((r) => handleMCPRequest(r as MCPRequest, admin, userId)),
    );
    return json(responses);
  }

  const response = await handleMCPRequest(body as MCPRequest, admin, userId);
  return json(response);
});
