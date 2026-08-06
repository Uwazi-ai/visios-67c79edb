import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "Create task",
  description: "Create a task for the signed-in user in one of their workspaces.",
  inputSchema: {
    title: z.string().trim().min(1).max(300).describe("What needs doing."),
    org: z.string().optional().describe("Workspace slug from list_workspaces. Omit for a cross-workspace task."),
    project: z.string().optional().describe("Project name this task belongs to."),
    priority: z.enum(["low", "medium", "high"]).optional().describe("Defaults to medium."),
    due_at: z.string().datetime().optional().describe("ISO 8601 due date/time."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, org, project, priority, due_at }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const { data: tenantId, error: tenantError } = await supabase.rpc("current_tenant_id");
    if (tenantError || !tenantId) {
      return {
        content: [{ type: "text", text: "Could not resolve your workspace tenant. Open the app once, then retry." }],
        isError: true,
      };
    }

    const { data, error } = await supabase
      .from("kova_tasks")
      .insert({
        tenant_id: tenantId as string,
        user_id: ctx.getUserId(),
        title,
        org: org ?? "__any",
        project: project ?? null,
        priority: priority ?? "medium",
        due_at: due_at ?? null,
      })
      .select("id, title, org, project, state, priority, due_at")
      .single();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created task "${data.title}".` }],
      structuredContent: { task: data },
    };
  },
});
