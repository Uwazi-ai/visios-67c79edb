// Indexes a kova_documents row into pgvector chunks for RAG search.
import { z } from "npm:zod";
import {
  corsHeaders,
  jsonResponse,
  adminClient,
  getAuthedUserFromReq,
} from "../_shared/google.ts";

const BodySchema = z.object({
  document_id: z.string().uuid(),
});

const EMBED_MODEL = "openai/text-embedding-3-small";
const EMBED_BATCH_SIZE = 64;

// Token counts are approximated as ceil(chars / 4), a rough heuristic for
// English text with the tiktoken cl100k-ish tokenizer used by OpenAI models.
// It's not exact, but it's cheap, deterministic, and keeps chunk sizes in the
// right ballpark without pulling in a full tokenizer dependency.
const CHARS_PER_TOKEN = 4;
const CHUNK_TOKENS = 800;
const OVERLAP_TOKENS = 120;
const CHUNK_CHARS = CHUNK_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

/**
 * Splits `text` into ~CHUNK_TOKENS-token chunks with ~OVERLAP_TOKENS overlap,
 * walking paragraph then sentence boundaries so we never split mid-word.
 */
function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  // Flatten paragraphs into sentence-ish segments so we have fine-grained
  // boundaries to pack into chunks without cutting words.
  const segments: string[] = [];
  for (const para of paragraphs) {
    const sentences = para.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) ?? [para];
    for (const s of sentences) {
      const trimmed = s.trim();
      if (trimmed) segments.push(trimmed);
    }
  }
  if (segments.length === 0) return [];

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push(current.join(" ").trim());
  };

  for (const seg of segments) {
    // A single segment longer than a full chunk: hard-split on word
    // boundaries so we still never cut a word in half.
    if (seg.length > CHUNK_CHARS) {
      const words = seg.split(/\s+/);
      let piece = "";
      for (const w of words) {
        if ((piece + " " + w).length > CHUNK_CHARS) {
          if (current.join(" ").length + piece.length > CHUNK_CHARS) {
            flush();
            current = [];
            currentLen = 0;
          }
          current.push(piece.trim());
          currentLen += piece.length;
          flush();
          current = [];
          currentLen = 0;
          piece = w;
        } else {
          piece = piece ? `${piece} ${w}` : w;
        }
      }
      if (piece) {
        current.push(piece.trim());
        currentLen += piece.length;
      }
      continue;
    }

    if (currentLen + seg.length > CHUNK_CHARS && current.length > 0) {
      flush();
      // Build overlap: keep trailing segments whose combined length is
      // roughly OVERLAP_CHARS to preserve context across the boundary.
      let overlap: string[] = [];
      let overlapLen = 0;
      for (let i = current.length - 1; i >= 0 && overlapLen < OVERLAP_CHARS; i--) {
        overlap.unshift(current[i]);
        overlapLen += current[i].length;
      }
      current = overlap;
      currentLen = overlapLen;
    }
    current.push(seg);
    currentLen += seg.length;
  }
  flush();

  return chunks.filter(Boolean);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function embedBatch(inputs: string[]): Promise<{ embeddings?: number[][]; error?: Response }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Lovable-API-Key": apiKey ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
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
  const embeddings = (json.data ?? []).map((d: { embedding: number[] }) => d.embedding);
  return { embeddings };
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
  const { document_id } = parseResult.data;

  const admin = adminClient();

  const { data: doc, error: docError } = await admin
    .from("kova_documents")
    .select("id, user_id, title, body, indexed, content_hash")
    .eq("id", document_id)
    .maybeSingle();

  if (docError) {
    return jsonResponse({ error: `Failed to load document: ${docError.message}` }, 500);
  }
  if (!doc || doc.user_id !== user.id) {
    return jsonResponse({ error: "Document not found" }, 404);
  }

  const hash = await sha256Hex(`${doc.title}\n${doc.body}`);
  if (doc.indexed && doc.content_hash === hash) {
    return jsonResponse({ skipped: true });
  }

  // A stale chunk is worse than a missing one: if content changed (or we're
  // re-indexing after a failure), wipe old chunks first so we never answer
  // confidently with outdated text while re-embedding is in progress.
  const { error: deleteError } = await admin
    .from("kova_doc_chunks")
    .delete()
    .eq("document_id", document_id);
  if (deleteError) {
    return jsonResponse({ error: `Failed to clear old chunks: ${deleteError.message}` }, 500);
  }

  const chunks = chunkText(doc.body ?? "");
  if (chunks.length === 0) {
    // Nothing to index; mark as indexed with the current hash so we don't
    // keep retrying an empty document.
    await admin
      .from("kova_documents")
      .update({ indexed: true, content_hash: hash })
      .eq("id", document_id);
    return jsonResponse({ indexed: true, chunk_count: 0 });
  }

  const allEmbeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const { embeddings, error } = await embedBatch(batch);
    if (error) return error;
    allEmbeddings.push(...(embeddings ?? []));
  }

  const rows = chunks.map((content, idx) => ({
    document_id,
    user_id: user.id,
    ord: idx,
    content,
    embedding: allEmbeddings[idx],
  }));

  const { error: insertError } = await admin.from("kova_doc_chunks").insert(rows);
  if (insertError) {
    return jsonResponse({ error: `Failed to insert chunks: ${insertError.message}` }, 500);
  }

  const { error: updateError } = await admin
    .from("kova_documents")
    .update({ indexed: true, content_hash: hash })
    .eq("id", document_id);
  if (updateError) {
    return jsonResponse({ error: `Failed to update document status: ${updateError.message}` }, 500);
  }

  return jsonResponse({ indexed: true, chunk_count: chunks.length });
});
