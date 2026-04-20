import { corsHeaders, jsonResponse, getAuthedUser, getGoogleToken, gmailFetch } from "../_shared/gmail.ts";

function decodeBase64Url(input: string): string {
  try {
    const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const bin = atob(b64 + pad);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

function extractBody(payload: any): { text: string; html: string } {
  let text = "";
  let html = "";
  const walk = (p: any) => {
    if (!p) return;
    if (p.mimeType === "text/plain" && p.body?.data) text ||= decodeBase64Url(p.body.data);
    if (p.mimeType === "text/html" && p.body?.data) html ||= decodeBase64Url(p.body.data);
    (p.parts ?? []).forEach(walk);
  };
  walk(payload);
  return { text, html };
}

function formatBytes(n: number): string {
  if (!n || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

function extractAttachments(payload: any): Array<{ name: string; size: string }> {
  const out: Array<{ name: string; size: string }> = [];
  const walk = (p: any) => {
    if (!p) return;
    const filename: string = p.filename ?? "";
    const disposition = (p.headers ?? []).find((h: any) => h.name?.toLowerCase() === "content-disposition")?.value ?? "";
    const isAttachment = !!filename && (p.body?.attachmentId || /attachment/i.test(disposition));
    if (isAttachment) {
      out.push({ name: filename, size: formatBytes(p.body?.size ?? 0) });
    }
    (p.parts ?? []).forEach(walk);
  };
  walk(payload);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { user } = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const googleToken = getGoogleToken(req);
    if (!googleToken) return jsonResponse({ error: "Missing Google token" }, 400);

    const url = new URL(req.url);
    let id = url.searchParams.get("id") ?? url.searchParams.get("threadId");
    if (!id && (req.method === "POST" || req.method === "PUT")) {
      try {
        const body = await req.json();
        id = body?.threadId ?? body?.id ?? null;
      } catch { /* ignore */ }
    }
    if (!id) return jsonResponse({ error: "Missing thread id" }, 400);

    const r = await gmailFetch(`/threads/${id}?format=full`, googleToken);
    if (!r.ok) {
      const t = await r.text();
      return jsonResponse({ error: `Gmail get failed [${r.status}]: ${t}` }, r.status);
    }
    const data = await r.json();
    const parsed = (data.messages ?? []).map((m: any) => {
      const headers: Array<{ name: string; value: string }> = m.payload?.headers ?? [];
      const h = (n: string) => headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
      const { text, html } = extractBody(m.payload);
      const attachments = extractAttachments(m.payload);
      const from = h("From");
      const fm = from.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
      return {
        id: m.id,
        threadId: m.threadId,
        from,
        fromName: (fm?.[1] ?? from).trim(),
        fromEmail: (fm?.[2] ?? from).trim(),
        to: h("To"),
        subject: h("Subject"),
        date: h("Date"),
        messageId: h("Message-ID") || h("Message-Id"),
        references: h("References"),
        snippet: m.snippet ?? "",
        body: text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        bodyText: text,
        bodyHtml: html,
        labelIds: m.labelIds ?? [],
        attachments,
      };
    });

    return jsonResponse({
      id: data.id,
      historyId: data.historyId,
      messages: data.messages ?? [],
      parsed,
      subject: parsed[0]?.subject ?? "",
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
