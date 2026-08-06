import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_agent_proposals",
  title: "List agent proposals",
  description: "List proposals agents have raised for the signed-in user, with rationale, confidence and approval state. Read-only — approving a proposal stays a human action inside the app.",
  inputSchema: {
    org: z.string().optional().describe("Workspace slug to filter by."),
    state: z.string().optional().describe("Filter by proposal state, e.g. 'pending'."),
    limit: z.number().int().min(1).max(50).optional().describe("Max rows. Defaults to 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ org, state, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("kova_proposals")
      .select("id, agent, org, ref, proposal, rationale, confidence, signals, state, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (org) q = q.eq("org", org);
    if (state) q = q.eq("state", state);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { proposals: data ?? [] },
    };
  },
});
