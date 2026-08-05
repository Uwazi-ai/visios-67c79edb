// Semantic search over kova_doc_chunks via the kova_match_chunks RPC.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { z } from "npm:zod";
import { corsHeaders, jsonResponse, getAuthedUserFromReq } from "../_shared/google.ts";

const BodySchema = z.object({
  query: z.string().min(1),
  org: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const EMBED_MODEL = "openai/text-embedding-3-small";

async function embedQuery(input: string): Promise<{ embedding?: number[]; error?: Response }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Lovable-API-Key": apiKey ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: [input] }),
  });

  if (r.status === 429) {
    return { error: jsonResponse({ error: "Rate limited by AI gateway, please retry shortly." }, 429) };
  }
  if (r.status === 402) {
    return { error: jsonResponse({ error: "AI gateway credits exhausted. Add funds to continue." }, 402) };
  }
  if (!r.ok) {
    const text = await r.text();
    return { error: jsonResponse({ error: `Embedding request failed: ${r.status} ${text}` }, 502) };
  }
  const json = await r.json();
  return { embedding: json.data?.[0]?.embedding };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const user = await getAuthedUserFromReq(req);
  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const parseResult = BodySchema.safeParse(parsedBody);
  if (!parseResult.success) {
    return jsonResponse({ error: "Invalid request", details: parseResult.error.flatten() }, 400);
  }
  const { query, org, limit } = parseResult.data;

  const { embedding, error } = await embedQuery(query);
  if (error) return error;
  if (!embedding) {
    return jsonResponse({ error: "Failed to compute query embedding" }, 502);
  }

  // Use a client scoped to the caller's own JWT (not the service role) so
  // RLS on kova_doc_chunks / the RPC applies and users only see their data.
  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data, error: rpcError } = await callerClient.rpc("kova_match_chunks", {
    query_embedding: embedding,
    match_count: limit ?? 10,
    org_filter: org ?? null,
  });

  if (rpcError) {
    return jsonResponse({ error: `Search failed: ${rpcError.message}` }, 500);
  }

  const hits = (data ?? []).map((row: Record<string, unknown>) => ({
    chunk_id: row.chunk_id ?? row.id,
    document_id: row.document_id,
    title: row.title,
    category: row.category,
    org: row.org,
    content: row.content,
    similarity: row.similarity,
  }));

  return jsonResponse({ hits });
});
