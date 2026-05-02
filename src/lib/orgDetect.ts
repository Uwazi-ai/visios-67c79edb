// Detects which org an event/email belongs to based on attendee email domains.
// Domain map is sourced from each org's metadata.domains, with sensible defaults
// when an org hasn't configured any.

import type { Org } from "./orgs";

export const DEFAULT_ORG_DOMAINS: Record<string, string[]> = {
  uwazi: ["uwazi.ai", "uwazi.com"],
  cc: ["cultureclub.com", "cultureclub.co", "cultureclub.org"],
  bin: ["bin.org", "blackinnovatorsnetwork.org", "blackinnovators.org"],
};

function domainOf(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

/** Build a flat domain → org slug lookup from a list of orgs. */
export function buildDomainIndex(orgs: Pick<Org, "slug" | "metadata">[]): Map<string, string> {
  const idx = new Map<string, string>();
  for (const o of orgs) {
    const domains =
      (o.metadata?.domains && o.metadata.domains.length > 0
        ? o.metadata.domains
        : DEFAULT_ORG_DOMAINS[o.slug]) ?? [];
    for (const d of domains) {
      const norm = d.toLowerCase().trim().replace(/^@/, "");
      if (norm) idx.set(norm, o.slug);
    }
  }
  return idx;
}

/** Backwards-compatible: returns slug or null using the configured index. */
export function detectOrgSlugFromEmails(
  emails: string[],
  orgs?: Pick<Org, "slug" | "metadata">[],
): string | null {
  const idx = orgs ? buildDomainIndex(orgs) : buildDomainIndex(
    Object.entries(DEFAULT_ORG_DOMAINS).map(([slug, domains]) => ({
      slug,
      metadata: { domains },
    })),
  );
  for (const e of emails) {
    const d = domainOf(e);
    if (!d) continue;
    if (idx.has(d)) return idx.get(d)!;
    // subdomain match
    for (const [dom, slug] of idx) {
      if (d.endsWith("." + dom)) return slug;
    }
  }
  return null;
}

// Legacy export kept so old imports don't break.
export const ORG_DOMAINS = DEFAULT_ORG_DOMAINS;
