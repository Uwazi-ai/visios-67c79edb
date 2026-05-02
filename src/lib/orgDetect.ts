// Detects which org an event/email belongs to based on attendee email domains.
// Mapping is intentionally explicit and lives here so it's easy to tweak.

export const ORG_DOMAINS: Record<string, string[]> = {
  uwazi: ["uwazi.ai", "uwazi.com"],
  cc: ["cultureclub.com", "cultureclub.co", "cultureclub.org"],
  bin: ["bin.org", "blackinnovatorsnetwork.org", "blackinnovators.org"],
};

function domainOf(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

/**
 * Pick an org slug for a list of attendee emails.
 * Returns the first matching slug found, or null if no attendee belongs to any known org.
 */
export function detectOrgSlugFromEmails(emails: string[]): string | null {
  for (const e of emails) {
    const d = domainOf(e);
    if (!d) continue;
    for (const [slug, domains] of Object.entries(ORG_DOMAINS)) {
      if (domains.some((dom) => d === dom || d.endsWith("." + dom))) return slug;
    }
  }
  return null;
}
