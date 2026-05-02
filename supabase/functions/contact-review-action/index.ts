// Approve / skip / bulk-approve discovered contacts from contact_review_queue.
//
// Body variants:
//   { action: "approve", id, orgId, name?, email?, company?, title?, phone?, linkedin_url? }
//   { action: "skip", id }
//   { action: "approve_bulk", items: [{ id, orgId, ...overrides }] }
import { corsHeaders, getAuthedUserFromReq, adminClient } from "../_shared/google.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ApproveItem {
  id: string;
  orgId: string;
  name?: string | null;
  email?: string | null;
  company?: string | null;
  title?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
}

async function approveOne(admin: ReturnType<typeof adminClient>, userId: string, item: ApproveItem) {
  // Fetch the queue row (and verify ownership)
  const { data: row, error: fetchErr } = await admin
    .from("contact_review_queue")
    .select("*")
    .eq("id", item.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchErr || !row) throw new Error(fetchErr?.message ?? "Queue row not found");
  if (row.status === "approved") return { id: item.id, contact_id: null, alreadyApproved: true };

  const orgId = item.orgId ?? row.suggested_org_id;
  if (!orgId) throw new Error("orgId required");

  const insertPayload = {
    org_id: orgId,
    name: item.name ?? row.name ?? row.email ?? "Unknown",
    email: item.email ?? row.email,
    company: item.company ?? row.company,
    role: item.title ?? row.title,
    phone: item.phone ?? row.phone,
    linkedin_url: item.linkedin_url ?? row.linkedin_url,
    last_touched_at: row.last_email_date,
    notes: row.raw_signature ? `Discovered from Gmail.\n\nSignature:\n${row.raw_signature}` : null,
    metadata: { source: "gmail_agent", queue_id: row.id, confidence: row.confidence },
  };

  const { data: contact, error: insErr } = await admin
    .from("contacts")
    .insert(insertPayload)
    .select("id")
    .single();
  if (insErr) throw new Error(`contact insert failed: ${insErr.message}`);

  // Log a single discovery interaction (one row per contact — thread refs are recorded for context).
  if (row.last_email_date) {
    await admin.from("contact_interactions").insert({
      contact_id: contact.id,
      org_id: orgId,
      type: "email",
      title: row.sample_subject ?? `Email from ${row.email}`,
      summary: `${row.email_count} email${row.email_count === 1 ? "" : "s"} exchanged`,
      occurred_at: row.last_email_date,
      source: "gmail_agent",
      external_id: `agent:${row.id}`,
    });
  }

  await admin
    .from("contact_review_queue")
    .update({ status: "approved" })
    .eq("id", row.id);

  return { id: item.id, contact_id: contact.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const admin = adminClient();
    const body = await req.json();

    if (body.action === "skip") {
      const { error } = await admin
        .from("contact_review_queue")
        .update({ status: "skipped" })
        .eq("id", body.id)
        .eq("user_id", user.id);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true });
    }

    if (body.action === "skip_bulk") {
      const ids: string[] = body.ids ?? [];
      const { error } = await admin
        .from("contact_review_queue")
        .update({ status: "skipped" })
        .in("id", ids)
        .eq("user_id", user.id);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true, count: ids.length });
    }

    if (body.action === "approve") {
      const result = await approveOne(admin, user.id, body as ApproveItem);
      return jsonResponse({ ok: true, ...result });
    }

    if (body.action === "approve_bulk") {
      const items: ApproveItem[] = body.items ?? [];
      const results: Array<{ id: string; ok: boolean; error?: string; contact_id?: string | null }> = [];
      for (const it of items) {
        try {
          const r = await approveOne(admin, user.id, it);
          results.push({ id: it.id, ok: true, contact_id: r.contact_id });
        } catch (e) {
          results.push({ id: it.id, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      }
      return jsonResponse({ ok: true, results });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
