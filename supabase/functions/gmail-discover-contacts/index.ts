// Gmail Contact Discovery Agent
// Scans the user's Gmail for the last N days, extracts unique senders,
// parses signatures via Lovable AI Gateway (gpt-5-mini), dedupes against
// existing contacts, and upserts into contact_review_queue.
//
// Body: { days?: 7|30|90, minEmailCount?: number, defaultOrgId?: string|null,
//         autoApproveKnownDomains?: boolean }
//
// Streams progress as Server-Sent Events.
import { corsHeaders, getAuthedUserFromReq, getFreshGoogleAccessToken, googleFetch, adminClient } from "../_shared/google.ts";

const NOISE_PREFIXES = [
  "noreply", "no-reply", "donotreply", "do-not-reply", "support", "info",
  "hello", "hi", "notifications", "notification", "newsletter", "mailer",
  "team", "updates", "alerts", "billing", "receipts", "automated", "robot",
  "bot", "feedback", "marketing", "news", "press", "hr", "careers", "jobs",
  "admin", "postmaster", "mailer-daemon", "auto", "system",
];

// Default org-domain map (matches src/lib/orgDetect.ts)
const DEFAULT_ORG_DOMAINS: Record<string, string[]> = {
  uwazi: ["uwazi.ai", "uwazi.com"],
  cc: ["cultureclub.com", "cultureclub.co", "cultureclub.org"],
  bin: ["bin.org", "blackinnovatorsnetwork.org", "blackinnovators.org"],
};

// Title/company keyword fallback rules (per spec)
const ORG_KEYWORD_RULES: Array<{ slug: string; keywords: string[] }> = [
  { slug: "uwazi", keywords: ["uwazi", "ai", "tech", "software", "startup", "venture", "engineer", "developer"] },
  { slug: "bin", keywords: ["black innovators", "bin", "innovation", "nonprofit", "community", "foundation"] },
  { slug: "cc", keywords: ["culture club", "creative", "agency", "design", "marketing", "brand", "media"] },
];

interface RawContact {
  email: string;
  name: string | null;
  signatureSamples: string[];
  threadIds: Set<string>;
  lastDate: string | null;
  sampleSubject: string | null;
}

interface ParsedSignature {
  name?: string | null;
  title?: string | null;
  company?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  website?: string | null;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

function extractBody(payload: unknown): string {
  let text = "";
  let html = "";
  const walk = (p: any) => {
    if (!p) return;
    if (p.mimeType === "text/plain" && p.body?.data) text ||= decodeBase64Url(p.body.data);
    if (p.mimeType === "text/html" && p.body?.data) html ||= decodeBase64Url(p.body.data);
    (p.parts ?? []).forEach(walk);
  };
  walk(payload);
  if (text) return text;
  // Strip HTML
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractSignature(body: string): string | null {
  if (!body) return null;
  // Remove quoted reply blocks (lines starting with ">")
  const cleaned = body
    .split("\n")
    .filter((l) => !l.trim().startsWith(">"))
    .join("\n");

  // Look for "-- " separator (RFC standard sig delimiter)
  const dashIdx = cleaned.search(/\n-- ?\n/);
  if (dashIdx > -1) {
    return cleaned.slice(dashIdx + 4, dashIdx + 800).trim();
  }

  // Heuristic: take last ~12 non-empty lines if they contain phone or linkedin or title hint
  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  const tail = lines.slice(-12).join("\n");
  const hasSig = /(\+?\d[\d\s().-]{7,})|linkedin\.com|\b(ceo|cto|founder|director|manager|engineer|head of|vp|chief|partner|analyst|associate|president|coordinator)\b/i.test(tail);
  if (hasSig) return tail.slice(0, 800);
  return null;
}

function parseFromHeader(from: string): { name: string | null; email: string } {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  return { name: null, email: from.trim().toLowerCase() };
}

function isNoiseEmail(email: string, ownEmail: string | null): boolean {
  if (!email || !email.includes("@")) return true;
  if (ownEmail && email === ownEmail.toLowerCase()) return true;
  const local = email.split("@")[0].toLowerCase();
  if (NOISE_PREFIXES.some((p) => local === p || local.startsWith(p + ".") || local.startsWith(p + "-") || local.startsWith(p + "_"))) {
    return true;
  }
  return false;
}

function companyFromDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  const domain = email.slice(at + 1);
  if (!domain) return null;
  // Skip personal-mail providers
  const personal = new Set(["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com"]);
  if (personal.has(domain.toLowerCase())) return null;
  const stripped = domain.replace(/\.(com|org|net|io|co|gov|edu|ai|app|dev|xyz)$/i, "");
  return stripped
    .split(".")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function detectOrgIdFromDomain(
  email: string,
  orgs: Array<{ id: string; slug: string; metadata: any }>,
): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  const d = email.slice(at + 1).toLowerCase();
  for (const o of orgs) {
    const domains: string[] =
      (o.metadata?.domains && o.metadata.domains.length > 0)
        ? o.metadata.domains
        : (DEFAULT_ORG_DOMAINS[o.slug] ?? []);
    for (const dom of domains) {
      const norm = dom.toLowerCase().replace(/^@/, "");
      if (d === norm || d.endsWith("." + norm)) return o.id;
    }
  }
  return null;
}

function detectOrgIdFromKeywords(
  text: string,
  orgs: Array<{ id: string; slug: string }>,
): string | null {
  const lower = text.toLowerCase();
  for (const rule of ORG_KEYWORD_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      const o = orgs.find((x) => x.slug === rule.slug);
      if (o) return o.id;
    }
  }
  return null;
}

async function parseSignatureWithAI(signature: string, email: string): Promise<ParsedSignature | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;
  const prompt = `Extract structured contact info from this email signature.
Return ONLY a JSON object (use null for missing fields):
{ "name": "", "title": "", "company": "", "phone": "", "linkedin": "", "website": "" }

Signature:
${signature}

Email address: ${email}

Return ONLY valid JSON. No markdown, no backticks, no commentary.`;

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: "You extract contact details from email signatures and respond with strict JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleaned) as ParsedSignature;
  } catch {
    return null;
  }
}

function scoreConfidence(c: { name?: string | null; company?: string | null; title?: string | null; phone?: string | null; companyInferred: boolean }): "high" | "medium" | "low" {
  if (c.name && c.company && c.title && c.phone) return "high";
  if (c.name && c.company && !c.companyInferred) return "high";
  if (c.name && (c.company || c.title)) return "medium";
  if (c.name) return "medium";
  return "low";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Allow service-role impersonation via x-cron-user-id header (used by gmail-discover-cron).
    const auth = req.headers.get("Authorization") ?? "";
    const bearer = auth.replace(/^Bearer\s+/i, "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const cronUserId = req.headers.get("x-cron-user-id");
    let user: { id: string; email?: string | null } | null = null;
    if (cronUserId && bearer && bearer === serviceKey) {
      const { data } = await adminClient().auth.admin.getUserById(cronUserId);
      if (data?.user) user = { id: data.user.id, email: data.user.email ?? null };
    } else {
      user = await getAuthedUserFromReq(req);
    }
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const days = [7, 30, 90].includes(body.days) ? body.days : 30;
    const minEmailCount = Math.max(1, Math.min(10, body.minEmailCount ?? 1));
    const defaultOrgId: string | null = body.defaultOrgId ?? null;

    const admin = adminClient();
    const ownEmail = user.email?.toLowerCase() ?? null;

    // Load orgs (for domain + keyword inference)
    const { data: orgs } = await admin
      .from("orgs")
      .select("id, slug, name, metadata");
    const orgsList = (orgs ?? []) as Array<{ id: string; slug: string; name: string; metadata: any }>;

    // Load existing contact emails for dedup
    const { data: existingContacts } = await admin
      .from("contacts")
      .select("email")
      .not("email", "is", null);
    const existingEmails = new Set(
      (existingContacts ?? []).map((c: any) => (c.email ?? "").toLowerCase()).filter(Boolean),
    );

    // Get Google access token
    let token: string;
    try {
      token = await getFreshGoogleAccessToken(user.id);
    } catch (e) {
      return jsonResponse({ error: "GOOGLE_AUTH_REQUIRED", message: e instanceof Error ? e.message : String(e) }, 200);
    }

    // 1. List threads
    const q = `newer_than:${days}d -from:me -category:promotions -category:social`;
    const listRes = await googleFetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(q)}&maxResults=200`,
      token,
    );
    if (!listRes.ok) {
      const t = await listRes.text();
      return jsonResponse({ error: `Gmail list failed: ${t}` }, listRes.status);
    }
    const list = await listRes.json();
    const threadIds: string[] = (list.threads ?? []).map((t: any) => t.id);

    // 2. Fetch each thread (concurrency limit 8)
    const rawByEmail = new Map<string, RawContact>();
    const CONCURRENCY = 8;
    for (let i = 0; i < threadIds.length; i += CONCURRENCY) {
      const batch = threadIds.slice(i, i + CONCURRENCY);
      const fetched = await Promise.all(
        batch.map(async (id) => {
          const r = await googleFetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=full`,
            token,
          );
          if (!r.ok) return null;
          return r.json();
        }),
      );
      for (const thread of fetched) {
        if (!thread) continue;
        const messages: any[] = thread.messages ?? [];
        for (const m of messages) {
          const headers: Array<{ name: string; value: string }> = m.payload?.headers ?? [];
          const h = (n: string) => headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
          const fromHeader = h("From");
          const subject = h("Subject");
          const dateStr = h("Date");
          if (!fromHeader) continue;
          const { name, email } = parseFromHeader(fromHeader);
          if (isNoiseEmail(email, ownEmail)) continue;

          const body = extractBody(m.payload);
          const sig = extractSignature(body);
          const occurredAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

          let entry = rawByEmail.get(email);
          if (!entry) {
            entry = {
              email,
              name: name,
              signatureSamples: [],
              threadIds: new Set(),
              lastDate: occurredAt,
              sampleSubject: subject || null,
            };
            rawByEmail.set(email, entry);
          }
          if (!entry.name && name) entry.name = name;
          entry.threadIds.add(thread.id);
          if (sig && entry.signatureSamples.length < 3 && !entry.signatureSamples.includes(sig)) {
            entry.signatureSamples.push(sig);
          }
          if (!entry.lastDate || occurredAt > entry.lastDate) {
            entry.lastDate = occurredAt;
            entry.sampleSubject = subject || entry.sampleSubject;
          }
        }
      }
    }

    // 3. Filter: dedup against existing + min email count
    const candidates = Array.from(rawByEmail.values()).filter((c) => {
      if (existingEmails.has(c.email)) {
        // touch existing contact
        return false;
      }
      if (c.threadIds.size < minEmailCount) return false;
      if (!c.name && !c.signatureSamples.length) return false;
      return true;
    });

    // 4. Refresh last_touched_at for matched existing contacts
    const matchedExistingTouches: Array<{ email: string; date: string }> = [];
    for (const c of rawByEmail.values()) {
      if (existingEmails.has(c.email) && c.lastDate) {
        matchedExistingTouches.push({ email: c.email, date: c.lastDate });
      }
    }
    let updatedExisting = 0;
    for (const m of matchedExistingTouches) {
      const { error, count } = await admin
        .from("contacts")
        .update({ last_touched_at: m.date }, { count: "exact" })
        .eq("email", m.email)
        .or(`last_touched_at.is.null,last_touched_at.lt.${m.date}`);
      if (!error && count) updatedExisting += count;
    }

    // 5. AI parse signatures + build review-queue rows
    const queueRows: Array<Record<string, unknown>> = [];
    for (const c of candidates) {
      let parsed: ParsedSignature | null = null;
      if (c.signatureSamples.length > 0) {
        parsed = await parseSignatureWithAI(c.signatureSamples[0], c.email);
      }
      const name = parsed?.name || c.name || null;
      const title = parsed?.title || null;
      let company = parsed?.company || null;
      let companyInferred = false;
      if (!company) {
        const inferred = companyFromDomain(c.email);
        if (inferred) {
          company = inferred;
          companyInferred = true;
        }
      }
      const phone = parsed?.phone || null;
      const linkedin = parsed?.linkedin || null;

      // Org inference: domain first, then keyword fallback
      let orgId =
        defaultOrgId ??
        detectOrgIdFromDomain(c.email, orgsList);
      if (!orgId) {
        const haystack = [name, title, company, parsed?.website].filter(Boolean).join(" ");
        if (haystack) orgId = detectOrgIdFromKeywords(haystack, orgsList);
      }

      const confidence = scoreConfidence({ name, company, title, phone, companyInferred });

      queueRows.push({
        user_id: user.id,
        email: c.email,
        name,
        title,
        company,
        phone,
        linkedin_url: linkedin,
        suggested_org_id: orgId,
        email_count: c.threadIds.size,
        last_email_date: c.lastDate,
        confidence,
        raw_signature: c.signatureSamples[0] ?? null,
        sample_subject: c.sampleSubject,
        status: "pending",
        source: "gmail_agent",
        thread_refs: Array.from(c.threadIds).slice(0, 10),
      });
    }

    // 6. Upsert into review queue (on conflict user_id+email → refresh counts/dates)
    let inserted = 0;
    if (queueRows.length > 0) {
      const { data: upserted, error: upErr } = await admin
        .from("contact_review_queue")
        .upsert(queueRows, { onConflict: "user_id,email", ignoreDuplicates: false })
        .select("id, status");
      if (upErr) {
        return jsonResponse({ error: `Queue upsert failed: ${upErr.message}` }, 500);
      }
      inserted = (upserted ?? []).filter((r: any) => r.status === "pending").length;
    }

    // 7. Stamp last sync time
    await admin
      .from("agent_settings")
      .upsert(
        { user_id: user.id, gmail_last_synced_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );

    return jsonResponse({
      ok: true,
      threadsScanned: threadIds.length,
      uniqueSenders: rawByEmail.size,
      candidates: candidates.length,
      queued: inserted,
      updatedExisting,
      existingCount: existingEmails.size,
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
