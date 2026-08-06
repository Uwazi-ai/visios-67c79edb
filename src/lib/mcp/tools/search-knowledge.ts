import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_knowledge",
  title: "Search knowledge base",
  description: "Full-text search across the signed-in user's knowledge documents. Returns matching titles and excerpts.",
  inputSchema: {
    query: z.string().trim().min(2).describe("Words to look for in document titles and bodies."),
    org: z.string().optional().describe("Workspace slug to restrict the search to."),
    limit: z.number().int().min(1).max(25).optional().describe("Max documents. Defaults to 8."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, org, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const term = query.replace(/[%,]/g, " ").trim();
    let q = supabase
      .from("kova_documents")
      .select("id, title, category, org, source, body, updated_at")
      .or(`title.ilike.%${term}%,body.ilike.%${term}%`)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 8);
    if (org) q = q.eq("org", org);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const results = (data ?? []).map((d) => {
      const body = d.body ?? "";
      const at = body.toLowerCase().indexOf(term.toLowerCase());
      const start = at > 120 ? at - 120 : 0;
      return {
        id: d.id,
        title: d.title,
        category: d.category,
        org: d.org,
        source: d.source,
        updated_at: d.updated_at,
        excerpt: body.slice(start, start + 400),
      };
    });

    if (results.length === 0) {
      return { content: [{ type: "text", text: `No documents matched "${term}".` }], structuredContent: { results } };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      structuredContent: { results },
    };
  },
});
