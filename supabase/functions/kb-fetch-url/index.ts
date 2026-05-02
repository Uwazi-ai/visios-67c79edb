// Fetch a URL, extract readable text, then call kb-process-document logic inline.
import { corsHeaders, jsonResponse, getAuthedUserFromReq, adminClient } from "../_shared/google.ts";

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkText(text: string, target = 1800): string[] {
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
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.filter((c) => c.length > 20);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { url, title, category, org_id, description } = await req.json();
    if (!url || typeof url !== "string") return jsonResponse({ error: "url required" }, 400);

    const r = await fetch(url, {
      headers: { "User-Agent": "VisiOS-KB/1.0 (+https://visios.lovable.app)" },
    });
    if (!r.ok) return jsonResponse({ error: `Fetch failed: ${r.status}` }, 400);
    const html = await r.text();
    const text = htmlToText(html);
    if (text.length < 50) return jsonResponse({ error: "Page contained no readable text" }, 400);

    const docTitle = title || (html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? url);
    const admin = adminClient();
    const { data: doc, error: docErr } = await admin
      .from("kb_documents")
      .insert({
        user_id: user.id,
        org_id: org_id ?? null,
        title: docTitle,
        description: description ?? null,
        category: category ?? "General",
        source_type: "url",
        source_url: url,
        status: "processing",
      })
      .select()
      .single();
    if (docErr || !doc) return jsonResponse({ error: docErr?.message ?? "Insert failed" }, 500);

    const chunks = chunkText(text);
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    const rows = chunks.map((content, idx) => ({
      document_id: doc.id,
      user_id: user.id,
      org_id: org_id ?? null,
      content,
      chunk_index: idx,
    }));
    const { error: insErr } = await admin.from("kb_chunks").insert(rows);
    if (insErr) {
      await admin.from("kb_documents").update({ status: "error", error_message: insErr.message }).eq("id", doc.id);
      return jsonResponse({ error: insErr.message }, 500);
    }
    await admin.from("kb_documents").update({ status: "ready", word_count: wordCount }).eq("id", doc.id);

    return jsonResponse({ ok: true, document_id: doc.id, chunks: chunks.length });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
