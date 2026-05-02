// Process a knowledge base document: chunk text and insert into kb_chunks.
// Client extracts text (mammoth/pdfjs) and posts plain text here.
import { corsHeaders, jsonResponse, getAuthedUserFromReq, adminClient } from "../_shared/google.ts";

function chunkText(text: string, target = 1800): string[] {
  // ~500 tokens ≈ 1800 chars. Split on paragraph then sentence.
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= target) return [clean];
  const paragraphs = clean.split(/\n\n+/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length > target && buf) {
      chunks.push(buf.trim());
      buf = p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
    if (buf.length > target * 1.5) {
      // hard split
      const sentences = buf.split(/(?<=[.!?])\s+/);
      let s = "";
      for (const sent of sentences) {
        if ((s + " " + sent).length > target && s) {
          chunks.push(s.trim());
          s = sent;
        } else {
          s = s ? s + " " + sent : sent;
        }
      }
      buf = s;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.filter((c) => c.length > 20);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { document_id, text } = await req.json();
    if (!document_id || typeof text !== "string") {
      return jsonResponse({ error: "document_id and text required" }, 400);
    }

    const admin = adminClient();
    const { data: doc, error: docErr } = await admin
      .from("kb_documents")
      .select("id, user_id, org_id")
      .eq("id", document_id)
      .maybeSingle();
    if (docErr || !doc) return jsonResponse({ error: "Document not found" }, 404);
    if (doc.user_id !== user.id) return jsonResponse({ error: "Forbidden" }, 403);

    // Wipe existing chunks for re-processing
    await admin.from("kb_chunks").delete().eq("document_id", document_id);

    const chunks = chunkText(text);
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

    if (chunks.length === 0) {
      await admin.from("kb_documents").update({
        status: "error",
        error_message: "No extractable text",
        word_count: wordCount,
      }).eq("id", document_id);
      return jsonResponse({ error: "No extractable text" }, 400);
    }

    const rows = chunks.map((content, idx) => ({
      document_id,
      user_id: doc.user_id,
      org_id: doc.org_id,
      content,
      chunk_index: idx,
    }));

    const { error: insErr } = await admin.from("kb_chunks").insert(rows);
    if (insErr) {
      await admin.from("kb_documents").update({
        status: "error",
        error_message: insErr.message,
      }).eq("id", document_id);
      return jsonResponse({ error: insErr.message }, 500);
    }

    await admin.from("kb_documents").update({
      status: "ready",
      word_count: wordCount,
      error_message: null,
    }).eq("id", document_id);

    return jsonResponse({ ok: true, chunks: chunks.length, word_count: wordCount });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
