import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_contacts",
  title: "List contacts",
  description: "List or search the signed-in user's contacts, with company, role and confidence score.",
  inputSchema: {
    search: z.string().trim().min(1).optional().describe("Match against name or company."),
    org: z.string().optional().describe("Workspace slug to filter by."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows. Defaults to 25."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, org, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("kova_contacts")
      .select("id, name, role, company, org, confidence, scanned_at")
      .order("scanned_at", { ascending: false, nullsFirst: false })
      .limit(limit ?? 25);
    if (org) q = q.eq("org", org);
    if (search) {
      const term = search.replace(/[%,]/g, " ").trim();
      q = q.or(`name.ilike.%${term}%,company.ilike.%${term}%`);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { contacts: data ?? [] },
    };
  },
});
