import { corsHeaders, jsonResponse, getAuthedUser, getGoogleToken, gmailFetch } from "../_shared/gmail.ts";

function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { user } = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const googleToken = getGoogleToken(req);
    if (!googleToken) return jsonResponse({ error: "Missing Google token" }, 400);

    const { to, subject, body, threadId, inReplyTo, references, fromName } = await req.json();
    if (!to || !body) return jsonResponse({ error: "Missing to/body" }, 400);

    const fromHeader = fromName ? `${fromName} <${user.email}>` : user.email;
    const headers = [
      `From: ${fromHeader}`,
      `To: ${to}`,
      `Subject: ${subject ?? ""}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 7bit",
    ];
    if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);
    if (references) headers.push(`References: ${references}`);
    const mime = headers.join("\r\n") + "\r\n\r\n" + body;
    const raw = b64url(mime);

    const r = await gmailFetch(`/messages/send`, googleToken, {
      method: "POST",
      body: JSON.stringify(threadId ? { raw, threadId } : { raw }),
    });
    const data = await r.json();
    if (!r.ok) return jsonResponse({ error: `Gmail send failed [${r.status}]: ${JSON.stringify(data)}` }, r.status);
    return jsonResponse({ ok: true, ...data });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
