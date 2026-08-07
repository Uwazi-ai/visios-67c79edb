// gmail-sync — incremental Gmail sync into mail_messages.
//
// org_id comes straight off the account: one account belongs to exactly one
// org, so there is no attribution logic to get wrong.
import {
  corsHeaders, jsonResponse, admin, authedUser, isOrgMember,
  loadAccount, googleToken, gmail, parseAddress, splitAddresses,
} from "../_shared/mail.ts";

const DAYS = 30;

function header(headers: any[], name: string): string | null {
  const h = headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? null;
}

async function fetchMeta(ids: string[], token: string) {
  const out: any[] = [];
  for (const id of ids) {
    const r = await gmail(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`, token);
    if (r.ok) out.push(await r.json());
  }
  return out;
}

function toRow(m: any, account: any, selfAddress: string) {
  const hs = m.payload?.headers ?? [];
  const from = parseAddress(header(hs, "From") ?? "");
  const to = splitAddresses(header(hs, "To"));
  const cc = splitAddresses(header(hs, "Cc"));
  const labels: string[] = m.labelIds ?? [];
  const unread = labels.includes("UNREAD");

  // needs_reply: addressed to you directly, still unread, and from a human.
  const directlyAddressed = to.includes(selfAddress);
  const noReply = /(^|[.\-_])(no-?reply|do-?not-?reply|notifications?|mailer|bounce)/i.test(from.address);
  const fromSelf = from.address === selfAddress;

  return {
    org_id: account.org_id,
    mail_account_id: account.id,
    provider_message_id: m.id,
    provider_thread_id: m.threadId,
    from_name: from.name,
    from_address: from.address || "unknown@invalid",
    to_addresses: to,
    cc_addresses: cc,
    subject: header(hs, "Subject"),
    snippet: m.snippet ?? null,
    received_at: new Date(Number(m.internalDate ?? Date.now())).toISOString(),
    is_unread: unread,
    is_starred: labels.includes("STARRED"),
    has_attachments: !!m.payload?.parts?.some((p: any) => p.filename),
    gmail_labels: labels,
    needs_reply: directlyAddressed && unread && !noReply && !fromSelf,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = admin();
  let accountId = "";
  try {
    const user = await authedUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    accountId = body.mail_account_id;
    if (!accountId) return jsonResponse({ error: "mail_account_id required" }, 400);

    const { account, error } = await loadAccount(accountId);
    if (error === "DEMO_ORG_REFUSED") return jsonResponse({ error: "Demo workspaces do not sync mail." }, 400);
    if (!account) return jsonResponse({ error: error ?? "not found" }, 404);
    if (!(await isOrgMember(user.id, account.org_id))) return jsonResponse({ error: "Forbidden" }, 403);

    const token = await googleToken(req, account.connected_by);
    if (!token) {
      await db.from("mail_accounts").update({ status: "expired", last_error: "No Google refresh token" }).eq("id", accountId);
      return jsonResponse({ error: "GOOGLE_AUTH_REQUIRED" }, 200);
    }

    const self = account.email_address.toLowerCase();
    let ids: string[] = [];
    let newHistoryId: string | null = null;

    if (account.history_id) {
      const r = await gmail(`/history?startHistoryId=${account.history_id}&historyTypes=messageAdded`, token);
      if (r.status === 404) {
        // Watermark expired. Full resync rather than silent drift.
        account.history_id = null;
      } else if (r.status === 401) {
        await db.from("mail_accounts").update({ status: "expired", last_error: "Google token expired" }).eq("id", accountId);
        return jsonResponse({ error: "GOOGLE_AUTH_REQUIRED" }, 200);
      } else if (!r.ok) {
        throw new Error(`history.list [${r.status}]: ${await r.text()}`);
      } else {
        const d = await r.json();
        newHistoryId = d.historyId ?? account.history_id;
        ids = (d.history ?? []).flatMap((h: any) => (h.messagesAdded ?? []).map((x: any) => x.message.id));
      }
    }

    if (!account.history_id) {
      const after = Math.floor((Date.now() - DAYS * 864e5) / 1000);
      const r = await gmail(`/messages?maxResults=200&q=after:${after}`, token);
      if (r.status === 401) {
        await db.from("mail_accounts").update({ status: "expired", last_error: "Google token expired" }).eq("id", accountId);
        return jsonResponse({ error: "GOOGLE_AUTH_REQUIRED" }, 200);
      }
      if (!r.ok) throw new Error(`messages.list [${r.status}]: ${await r.text()}`);
      const d = await r.json();
      ids = (d.messages ?? []).map((m: any) => m.id);
      const prof = await gmail(`/profile`, token);
      if (prof.ok) newHistoryId = String((await prof.json()).historyId);
    }

    ids = [...new Set(ids)];
    const metas = await fetchMeta(ids, token);
    const rows = metas.map((m) => toRow(m, account, self));

    if (rows.length) {
      // Idempotent: same provider message on the same account is one row.
      const { error: upErr } = await db
        .from("mail_messages")
        .upsert(rows, { onConflict: "mail_account_id,provider_message_id", ignoreDuplicates: false });
      if (upErr) throw new Error(upErr.message);
    }

    await db.from("mail_accounts").update({
      history_id: newHistoryId ?? account.history_id,
      last_sync_at: new Date().toISOString(),
      status: "connected",
      last_error: null,
    }).eq("id", accountId);

    return jsonResponse({ ok: true, synced: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (accountId) {
      await admin().from("mail_accounts").update({ status: "error", last_error: msg }).eq("id", accountId);
    }
    return jsonResponse({ error: msg }, 500);
  }
});
