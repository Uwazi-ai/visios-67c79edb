// Server-side guardrails for brain-mcp. These run in code on every write.
// They are deliberately conservative: a false rejection costs an agent one
// retry, a false pass could put the wrong thing in the brain.

export class Rejection extends Error {}

export const MONEY_MESSAGE = "Financials are handled by Myke manually.";

export const GATED_ACTIONS = ["send", "post_draft", "reply_batch", "book", "buy", "deploy"];

const MONEY = new RegExp(
  [
    "\\bpay(?:ment|ments|ing|out|outs)\\b",
    "\\bpay\\s+(?:the|for|off|an?|our|my|this|that)\\b",
    "\\bpay\\s+\\$",
    "\\bcheck\\s?out\\b",
    "\\b(?:wire|bank|money|funds?|balance|account)\\s+transfers?\\b",
    "\\btransfer(?:s|red|ring)?\\s+(?:of\\s+)?(?:(?:money|funds|cash)\\b|\\$)",
    "\\bwire\\s+\\$?\\d",
    "\\binvoic(?:e|es|ed|ing)\\b",
    "\\bbanking\\b",
    "\\bbank\\s+(?:account|details|login|statement)s?\\b",
    "\\b(?:routing|account)\\s+number\\b",
    "\\bpricing\\b",
    "\\bprice\\s+(?:quote|list|change|increase)s?\\b",
    "\\brefund(?:s|ed|ing)?\\b",
    "\\bpayroll\\b",
    "\\breimburs\\w+",
    "\\b(?:venmo|paypal|zelle|cash\\s?app)\\b",
  ].join("|"),
  "i",
);

// A buy job ends with a cart for a human to review. Nothing here may claim
// the purchase happened.
const PURCHASE_DONE =
  /\b(?:purchased|bought|paid|checked\s+out|order\s+(?:placed|confirmed|complete|completed)|payment\s+(?:sent|made|complete|completed))\b/i;

const MONEY_KEYS =
  /^(?:card|cvv|cvc|payment|paid|purchased|purchase_complete|order_confirmation|confirmation_number|receipt|bank|routing|account_number)/i;

const CAMPAIGN =
  /ryana\s+for\s+mayor|\br4m\b|\brps\s+campaign\b|\bcampaign\s+os\b|\blavern\b|\bmayoral\s+campaign\b|\bcampaign\s+verify\b|#campaign\b/i;

const JOURNAL =
  /\bjournal\s+(?:entry|entries|page|pages|note|notes)\b|\bmy\s+journal\b|\bdear\s+diary\b|#journal\b|\[journal\]|^\s*journal\s*:/im;

const PROTECTED_SOCIAL =
  /rps\s+office|mayor\s+pro\s+tem|parks[-\s]shaw|\bryana\b|city\s+of\s+k(?:c|ansas\s+city)|\bkcmo\b/i;

const PUBLISH =
  /\b(?:publish(?:es|ed|ing)?|auto-?post(?:s|ed|ing)?|go(?:es)?\s+live|post(?:s|ed|ing)?\s+(?:it\s+|this\s+|them\s+)?(?:live|now|directly|immediately))\b/i;

const MINOR_RECORDS =
  /\b(?:grades?|report\s+cards?|transcripts?|iep|school\s+records?|diagnos\w+|medications?|prescriptions?|medical|doctors?|therap(?:y|ist)|allerg\w+|health|pediatric\w*|immuniz\w+|vaccin\w+|location\s+history|gps|track(?:ing|er)|whereabouts|geoloc\w+|find\s+my)\b/i;

const MINOR_KEYS =
  /^(?:last_?name|surname|full_?name|dob|birth\w*|school\w*|grade\w*|health\w*|medical\w*|diagnos\w*|address|location\w*|gps|lat|lng|latitude|longitude)$/i;

export function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
  return out;
}

export function collectKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const v of value) collectKeys(v, out);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      collectKeys(v, out);
    }
  }
  return out;
}

const anyMatch = (re: RegExp, value: unknown) => collectStrings(value).some((s) => re.test(s));

/** Rule 5. Runs on every write: journal content and the campaign stay out. */
export function screenExclusions(args: unknown): void {
  if (anyMatch(CAMPAIGN, args)) {
    throw new Rejection(
      "Ryana for Mayor campaign content stays out of the brain. Remove it and call again. RPS Office work is allowed with venture rps-office.",
    );
  }
  if (anyMatch(JOURNAL, args)) {
    throw new Rejection("Journal content stays out of the brain. Remove it and call again.");
  }
}

/** Rule 1. Jobs and approvals about money are refused outright. */
export function screenMoney(value: unknown): void {
  if (anyMatch(MONEY, value) || collectKeys(value).some((k) => MONEY_KEYS.test(k))) {
    throw new Rejection(MONEY_MESSAGE);
  }
}

/** Rule 1. No tool can mark a purchase complete. */
export function screenPurchaseClaim(value: unknown): void {
  if (anyMatch(PURCHASE_DONE, value)) {
    throw new Rejection(
      `${MONEY_MESSAGE} A buy job ends with a cart for review. Report the cart, not a completed purchase.`,
    );
  }
}

/** Rule 4. Social work is drafts only, and never on protected accounts. */
export function screenSocial(job: {
  domain: string;
  venture: string;
  action_type?: string | null;
  text: unknown;
}): void {
  const social =
    job.domain === "social" || job.action_type === "post_draft" || job.action_type === "reply_batch";
  if (!social) return;
  if (job.venture === "rps-office" || anyMatch(PROTECTED_SOCIAL, job.text)) {
    throw new Rejection(
      "Agents cannot run social jobs on RPS Office (City of KC) or Ryana for Mayor accounts. Other RPS Office content is allowed with venture rps-office in a non-social domain.",
    );
  }
  if (job.action_type === "send" || job.action_type === "deploy" || anyMatch(PUBLISH, job.text)) {
    throw new Rejection(
      "Agents create social drafts only. Use action_type post_draft or reply_batch and describe a draft, not a live post.",
    );
  }
}

// First names that carry the minors rule outside the family domain. This repo
// is public, so the names are never written in code. The edge function reads
// them from the BRAIN_PROTECTED_NAMES secret (comma separated).
let protectedNames: RegExp | null = null;

export function setProtectedNames(names: string[]): void {
  const clean = names.map((n) => n.trim()).filter(Boolean)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  protectedNames = clean.length ? new RegExp(`\\b(?:${clean.join("|")})\\b`, "i") : null;
}

/** Rule 6. Family items carry first names and logistics only. */
export function screenMinors(context: { family: boolean; value: unknown }): void {
  const mentionsProtected = protectedNames !== null && anyMatch(protectedNames, context.value);
  if (!context.family && !mentionsProtected) return;
  if (anyMatch(MINOR_RECORDS, context.value) || collectKeys(context.value).some((k) => MINOR_KEYS.test(k))) {
    throw new Rejection(
      "Family items can hold first names and logistics only. Remove school records, health details, and location history, then call again.",
    );
  }
}
