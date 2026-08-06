import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_tasks",
  title: "List tasks",
  description: "List the signed-in user's tasks, optionally filtered by workspace slug and state.",
  inputSchema: {
    org: z.string().optional().describe("Workspace slug from list_workspaces. Omit for all workspaces."),
    state: z.enum(["todo", "doing", "blocked", "done"]).optional().describe("Filter by task state."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows. Defaults to 25."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ org, state, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("kova_tasks")
      .select("id, title, org, project, state, priority, assignee, due_at, created_at")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(limit ?? 25);
    if (org) query = query.eq("org", org);
    if (state) query = query.eq("state", state);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { tasks: data ?? [] },
    };
  },
});
