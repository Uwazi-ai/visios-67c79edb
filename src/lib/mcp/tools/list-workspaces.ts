import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_workspaces",
  title: "List workspaces",
  description: "List the ventures/organisations (workspaces) the signed-in user belongs to, with slug, name, role and status.",
  inputSchema: {
    include_archived: z.boolean().optional().describe("Include archived workspaces. Defaults to false."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_archived }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("kova_orgs")
      .select("slug, name, role, status, color")
      .order("position", { ascending: true });
    if (!include_archived) query = query.neq("status", "archived");
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { workspaces: data ?? [] },
    };
  },
});
