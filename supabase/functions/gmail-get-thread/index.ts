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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { user } = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const googleToken = getGoogleToken(req);
    if (!googleToken) return jsonResponse({ error: "Missing Google token" }, 400);

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ error: "Missing thread id" }, 400);

    const r = await gmailFetch(`/threads/${id}?format=full`, googleToken);
    if (!r.ok) {
      const t = await r.text();
      return jsonResponse({ error: `Gmail get failed [${r.status}]: ${t}` }, r.status);
    }
    const data = await r.json();
    const messages = (data.messages ?? []).map((m: any) => {
      const headers: Array<{ name: string; value: string }> = m.payload?.headers ?? [];
      const h = (n: string) => headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
      const { text, html } = extractBody(m.payload);
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
        snippet: m.snippet ?? "",
        body: text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        labelIds: m.labelIds ?? [],
      };
    });

    return jsonResponse({ id, messages, subject: messages[0]?.subject ?? "" });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
