import { corsHeaders, jsonResponse, getAuthedUser, getGoogleToken, gmailFetch } from "../_shared/gmail.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { user } = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    let googleToken: string;
    try {
      googleToken = await getGoogleToken(req, user.id) ?? "";
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/refresh token|GOOGLE_AUTH_REQUIRED/i.test(message)) {
        return jsonResponse({ error: "GOOGLE_AUTH_REQUIRED", threads: [] });
      }
      throw e;
    }
    if (!googleToken) return jsonResponse({ error: "GOOGLE_AUTH_REQUIRED", threads: [] });

    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "in:inbox";
    const maxResults = url.searchParams.get("maxResults") ?? "30";

    const listRes = await gmailFetch(
      `/threads?q=${encodeURIComponent(q)}&maxResults=${maxResults}`,
      googleToken,
    );
    if (!listRes.ok) {
      const txt = await listRes.text();
      return jsonResponse({ error: `Gmail list failed [${listRes.status}]: ${txt}` }, listRes.status);
    }
    const list = await listRes.json();
    const threadIds: string[] = (list.threads ?? []).map((t: any) => t.id);

    // Fetch metadata for each thread in parallel (limit concurrency naturally with Promise.all)
    const details = await Promise.all(
      threadIds.map(async (id) => {
        const r = await gmailFetch(
          `/threads/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          googleToken,
        );
        if (!r.ok) return null;
        const t = await r.json();
        const msgs = t.messages ?? [];
        const last = msgs[msgs.length - 1];
        const headers: Array<{ name: string; value: string }> = last?.payload?.headers ?? [];
        const h = (n: string) => headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
        const from = h("From");
        const subject = h("Subject");
        const date = h("Date");
        const snippet = last?.snippet ?? "";
        const isUnread = (last?.labelIds ?? []).includes("UNREAD");
        // simple keyword urgency
        const text = `${subject} ${snippet}`.toLowerCase();
        let urgency: "urgent" | "action" | "fyi" | "newsletter" = "fyi";
        if ((last?.labelIds ?? []).includes("CATEGORY_PROMOTIONS") || /unsubscribe|newsletter/.test(text)) urgency = "newsletter";
        else if (/urgent|asap|today|deadline|overdue/.test(text)) urgency = "urgent";
        else if (/\?|please|can you|could you|reply|review|approve|sign/.test(text)) urgency = "action";

        // parse "Name <email@x>"
        const m = from.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/) ?? from.match(/^(.*)$/);
        const fromName = (m?.[1] ?? from).trim() || from;
        const fromEmail = (m?.[2] ?? from).trim();

        return {
          id,
          fromName,
          fromEmail,
          subject: subject || "(no subject)",
          snippet,
          date,
          isUnread,
          urgency,
          messageCount: msgs.length,
        };
      }),
    );

    return jsonResponse({ threads: details.filter(Boolean) });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
