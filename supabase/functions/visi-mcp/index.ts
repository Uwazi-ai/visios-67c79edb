// VisiOS MCP Server — exposes Visi data + actions to Claude Desktop / other MCP clients.
// Auth: Bearer VISI_MCP_API_KEY. All operations scoped to VISI_MCP_USER_ID (Myke).
import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_KEY = Deno.env.get("VISI_MCP_API_KEY")!;
const USER_ID = Deno.env.get("VISI_MCP_USER_ID")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

const text = (s: unknown) => ({
  content: [{ type: "text" as const, text: typeof s === "string" ? s : JSON.stringify(s, null, 2) }],
});

async function userOrgIds(): Promise<string[]> {
  const { data } = await admin.from("org_memberships").select("org_id").eq("user_id", USER_ID);
  const ids = (data ?? []).map((r: any) => r.org_id);
  return ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];
}

const mcp = new McpServer({
  name: "visios-mcp",
  version: "1.0.0",
  // Convert zod schemas to JSON Schema for tools/list
  schemaAdapter: (schema: any) => z.toJSONSchema ? z.toJSONSchema(schema) : (schema as any)._def ?? schema,
});

// ---------------- visi_get_context ----------------
mcp.tool("visi_get_context", {
  description: "Full snapshot: orgs, projects, open tasks, unacknowledged notifications.",
  inputSchema: z.object({}),
  handler: async () => {
    const orgIds = await userOrgIds();
    const [orgsRes, projRes, taskRes, notifRes] = await Promise.all([
      admin.from("orgs").select("id, name, slug").in("id", orgIds),
      admin.from("projects").select("id, name, emoji, org_id, status").eq("is_archived", false).in("org_id", orgIds),
      admin.from("tasks").select("id, title, status, priority, due_at, org_id, project_id, assignee_id").neq("status", "done").in("org_id", orgIds).order("due_at", { ascending: true, nullsFirst: false }).limit(100),
      admin.from("notifications").select("id, title, body, severity, org_id, created_at").is("acknowledged_at", null).in("org_id", orgIds).order("created_at", { ascending: false }).limit(50),
    ]);
    return text({
      orgs: orgsRes.data ?? [],
      projects: projRes.data ?? [],
      open_tasks: taskRes.data ?? [],
      notifications: notifRes.data ?? [],
    });
  },
});

// ---------------- visi_get_tasks ----------------
mcp.tool("visi_get_tasks", {
  description: "Get tasks with optional filters (org_id, project_id, status, priority, limit).",
  inputSchema: z.object({
    org_id: z.string().optional(),
    project_id: z.string().optional(),
    status: z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
    priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
    limit: z.number().optional(),
  }),
  handler: async (args) => {
    const orgIds = await userOrgIds();
    let q = admin.from("tasks").select("*").in("org_id", orgIds);
    if (args.org_id) q = q.eq("org_id", args.org_id);
    if (args.project_id) q = q.eq("project_id", args.project_id);
    if (args.status) q = q.eq("status", args.status);
    if (args.priority) q = q.eq("priority", args.priority);
    q = q.order("due_at", { ascending: true, nullsFirst: false }).limit(Math.min(args.limit ?? 50, 200));
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return text(data);
  },
});

// ---------------- visi_get_projects ----------------
mcp.tool("visi_get_projects", {
  description: "List active (non-archived) projects across all of Myke's orgs.",
  inputSchema: z.object({ org_id: z.string().optional() }),
  handler: async (args) => {
    const orgIds = await userOrgIds();
    let q = admin.from("projects").select("*").eq("is_archived", false).in("org_id", orgIds);
    if (args.org_id) q = q.eq("org_id", args.org_id);
    const { data, error } = await q.order("display_order").order("name");
    if (error) throw new Error(error.message);
    return text(data);
  },
});

// ---------------- visi_get_notifications ----------------
mcp.tool("visi_get_notifications", {
  description: "List unacknowledged notifications/alerts.",
  inputSchema: z.object({
    severity: z.enum(["critical", "warn", "info"]).optional(),
    limit: z.number().optional(),
  }),
  handler: async (args) => {
    const orgIds = await userOrgIds();
    let q = admin.from("notifications").select("*").is("acknowledged_at", null).in("org_id", orgIds);
    if (args.severity) q = q.eq("severity", args.severity);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(Math.min(args.limit ?? 50, 200));
    if (error) throw new Error(error.message);
    return text(data);
  },
});

// ---------------- visi_create_task ----------------
mcp.tool("visi_create_task", {
  description: "Create a new task. Required: title, org_id.",
  inputSchema: z.object({
    title: z.string(),
    org_id: z.string(),
    project_id: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
    priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
    due_at: z.string().optional().describe("ISO 8601 timestamp"),
    assignee_id: z.string().optional(),
  }),
  handler: async (args) => {
    const orgIds = await userOrgIds();
    if (!orgIds.includes(args.org_id)) throw new Error("Not a member of that org");
    const { data, error } = await admin.from("tasks").insert({
      title: args.title,
      org_id: args.org_id,
      project_id: args.project_id ?? null,
      description: args.description ?? null,
      status: args.status ?? "todo",
      priority: args.priority ?? "normal",
      due_at: args.due_at ?? null,
      assignee_id: args.assignee_id ?? USER_ID,
      created_by: USER_ID,
    }).select().single();
    if (error) throw new Error(error.message);
    return text(data);
  },
});

// ---------------- visi_update_task ----------------
mcp.tool("visi_update_task", {
  description: "Update a task's status, priority, due date, title, assignee, or description.",
  inputSchema: z.object({
    task_id: z.string(),
    title: z.string().optional(),
    status: z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
    priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
    due_at: z.string().nullable().optional(),
    assignee_id: z.string().optional(),
    description: z.string().optional(),
  }),
  handler: async (args) => {
    const patch: Record<string, unknown> = {};
    for (const k of ["title", "status", "priority", "due_at", "assignee_id", "description"] as const) {
      if (args[k] !== undefined) patch[k] = args[k];
    }
    const { data, error } = await admin.from("tasks").update(patch).eq("id", args.task_id).select().single();
    if (error) throw new Error(error.message);
    return text(data);
  },
});

// ---------------- visi_notify ----------------
mcp.tool("visi_notify", {
  description: "Push a read-only alert/notification into VisiOS.",
  inputSchema: z.object({
    title: z.string(),
    body: z.string().optional(),
    severity: z.enum(["critical", "warn", "info"]).optional(),
    org_id: z.string().optional(),
    app: z.string().optional().describe("Source app/integration label, e.g. 'mcp', 'claude'"),
    metadata: z.record(z.any()).optional(),
  }),
  handler: async (args) => {
    const { data, error } = await admin.from("notifications").insert({
      org_id: args.org_id ?? null,
      title: args.title,
      body: args.body ?? null,
      severity: args.severity ?? "info",
      app: args.app ?? "mcp",
      metadata: args.metadata ?? {},
    }).select().single();
    if (error) throw new Error(error.message);
    return text(data);
  },
});

// ---------------- visi_request_approval ----------------
mcp.tool("visi_request_approval", {
  description: "Queue an action for Myke's approval before execution.",
  inputSchema: z.object({
    tool: z.string(),
    payload: z.record(z.any()),
    org_id: z.string().optional(),
    note: z.string().optional(),
  }),
  handler: async (args) => {
    const { data, error } = await admin.from("mcp_approvals").insert({
      tool: args.tool,
      payload: args.payload,
      org_id: args.org_id ?? null,
      note: args.note ?? null,
      requested_by: USER_ID,
      status: "pending",
    }).select().single();
    if (error) throw new Error(error.message);
    return text(data);
  },
});

// ---------------- visi_get_pending_approvals ----------------
mcp.tool("visi_get_pending_approvals", {
  description: "List items awaiting Myke's approval.",
  inputSchema: z.object({ limit: z.number().optional() }),
  handler: async (args) => {
    const { data, error } = await admin.from("mcp_approvals").select("*")
      .eq("status", "pending").order("created_at", { ascending: false })
      .limit(Math.min(args.limit ?? 50, 200));
    if (error) throw new Error(error.message);
    return text(data);
  },
});

// ---------------- visi_resolve_approval ----------------
mcp.tool("visi_resolve_approval", {
  description: "Approve or reject a pending approval.",
  inputSchema: z.object({
    approval_id: z.string(),
    decision: z.enum(["approved", "rejected"]),
    note: z.string().optional(),
  }),
  handler: async (args) => {
    const { data, error } = await admin.from("mcp_approvals").update({
      status: args.decision,
      resolved_by: USER_ID,
      resolved_at: new Date().toISOString(),
      note: args.note ?? null,
    }).eq("id", args.approval_id).select().single();
    if (error) throw new Error(error.message);
    return text(data);
  },
});

// ---------------- visi_log_activity ----------------
mcp.tool("visi_log_activity", {
  description: "Add a comment/entry to a task's activity timeline.",
  inputSchema: z.object({
    task_id: z.string(),
    body: z.string(),
    kind: z.string().optional().describe("default 'comment'"),
    metadata: z.record(z.any()).optional(),
  }),
  handler: async (args) => {
    const { data: task, error: tErr } = await admin.from("tasks").select("org_id").eq("id", args.task_id).single();
    if (tErr) throw new Error(tErr.message);
    const { data, error } = await admin.from("task_activity").insert({
      task_id: args.task_id,
      org_id: task.org_id,
      user_id: USER_ID,
      kind: args.kind ?? "comment",
      body: args.body,
      metadata: args.metadata ?? {},
    }).select().single();
    if (error) throw new Error(error.message);
    return text(data);
  },
});

// ---------------- visi_search_kb ----------------
mcp.tool("visi_search_kb", {
  description: "Full-text search the knowledge base.",
  inputSchema: z.object({
    query: z.string(),
    org_id: z.string().optional(),
    limit: z.number().optional(),
  }),
  handler: async (args) => {
    const { data, error } = await admin.rpc("search_kb_text", {
      query_text: args.query,
      org_filter: args.org_id ?? null,
      user_filter: USER_ID,
      match_count: Math.min(args.limit ?? 5, 20),
    });
    if (error) throw new Error(error.message);
    return text(data);
  },
});

// ---------------- HTTP server ----------------
const app = new Hono();
const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);

app.options("*", () => new Response("ok", { headers: corsHeaders }));

app.all("/*", async (c) => {
  const auth = c.req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!API_KEY || token !== API_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const res = await httpHandler(c.req.raw);
  for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
  return res;
});

Deno.serve(app.fetch);
