import { ANY_ORG } from "@/lib/AppState";

/**
 * Knowledge — the document set Vision is allowed to cite.
 *
 * Two ideas carry this file:
 *
 * 1. A document is only real to Vision once it is EMBEDDED. Uploaded-but-
 *    waiting is the dangerous state, because the failure is silent: the
 *    search returns nothing rather than returning something wrong, and
 *    nothing looks exactly like "we have no policy on that".
 *
 * 2. Retrieval matches CONCEPTS, not substrings. Every document carries a
 *    concept vocabulary, and the query is compared against that vocabulary
 *    after both sides are stemmed. See `stem` below for why both.
 *
 * Replace with:
 *   select d.id, d.title, d.category, d.org_id, d.embedded_at,
 *          d.citations_30d, array_agg(t.concept) as concepts
 *   from kb_documents d left join kb_concepts t on t.document_id = d.id
 *   group by d.id;
 * Passages come from kb_chunks; keep the chunk text verbatim so a quote in
 * the UI is a quote from the source and not a paraphrase of it.
 */

export interface Category {
  id: string;
  name: string;
  blurb: string;
}

export const CATEGORIES: Category[] = [
  { id: "brand", name: "Brand & voice", blurb: "How we sound before anyone edits it." },
  { id: "playbooks", name: "Playbooks", blurb: "Repeatable motions, written down once." },
  { id: "legal", name: "Legal & contracts", blurb: "Executed paper and the templates behind it." },
  { id: "product", name: "Product specs", blurb: "What we said the thing would do." },
  { id: "civic", name: "Civic research", blurb: "Field data, turnout, jurisdiction rules." },
  { id: "client", name: "Client work", blurb: "Deliverables, scopes, retrospectives." },
  { id: "finance", name: "Finance & ops", blurb: "Money in, money out, and who approves it." },
];

export interface Passage {
  /** Verbatim chunk text. Never paraphrase — the quote is the evidence. */
  text: string;
  /** Concepts this specific passage carries. */
  concepts: string[];
}

export interface Doc {
  id: string;
  title: string;
  category: string;
  /** Workspace id, or ANY_ORG for material that survives every filter. */
  org: string;
  pages: number;
  updated: string;
  /** Null until the embedding job finishes. Null = invisible to Vision. */
  indexed: boolean;
  /** Times Vision cited this document in the last 30 days. */
  citations: number;
  concepts: string[];
  passages: Passage[];
}

export const DOCS: Doc[] = [
  {
    id: "d1",
    title: "UWAZI voice & tone guide",
    category: "brand",
    org: "uwazi",
    pages: 14,
    updated: "Jul 21",
    indexed: true,
    citations: 31,
    concepts: ["voice", "tone", "writing", "brand", "plain language", "audience"],
    passages: [
      {
        text: "Write to a busy operator, not a committee. If a sentence survives only because it sounds authoritative, cut it. We never use 'leverage' as a verb.",
        concepts: ["voice", "tone", "writing", "plain language"],
      },
      {
        text: "Our audience is a founder wearing four hats. Assume competence, never assume spare time.",
        concepts: ["audience", "brand"],
      },
    ],
  },
  {
    id: "d2",
    title: "Culture Club brand book v3",
    category: "brand",
    org: "cc",
    pages: 42,
    updated: "Jun 09",
    indexed: true,
    citations: 12,
    concepts: ["brand", "logo", "colour", "typography", "activation", "sponsorship"],
    passages: [
      {
        text: "The wordmark never sits on a photograph without a 60% scrim. Sponsor lockups go bottom-right, never inline with the wordmark.",
        concepts: ["logo", "brand", "sponsorship"],
      },
    ],
  },
  {
    id: "d3",
    title: "Founder narrative — long form",
    category: "brand",
    org: ANY_ORG,
    pages: 9,
    updated: "Aug 02",
    indexed: false,
    citations: 0,
    concepts: ["story", "founder", "narrative", "fundraising", "voice"],
    passages: [
      {
        text: "The through-line is not the technology. It is that the same person has to run five ventures on one calendar and nothing was built for that.",
        concepts: ["story", "narrative", "founder"],
      },
    ],
  },

  {
    id: "d4",
    title: "CTV media buying playbook",
    category: "playbooks",
    org: "uwazi",
    pages: 28,
    updated: "Jul 30",
    indexed: true,
    citations: 44,
    concepts: [
      "ctv", "media buying", "pricing", "cpm", "inventory", "targeting", "attribution", "budget",
    ],
    passages: [
      {
        text: "Never accept a flat CPM across dayparts. We hold a floor of $18 on primetime CTV inventory and trade weekend daytime down to $11 to keep the blended rate under budget.",
        concepts: ["ctv", "pricing", "cpm", "media buying", "budget", "inventory"],
      },
      {
        text: "Attribution windows shorter than seven days systematically undercount CTV, because the device that saw the ad is not the device that converts.",
        concepts: ["attribution", "ctv", "targeting"],
      },
    ],
  },
  {
    id: "d5",
    title: "Cohort launch runbook — Ascend",
    category: "playbooks",
    org: "bin",
    pages: 19,
    updated: "Jul 12",
    indexed: true,
    citations: 17,
    concepts: ["cohort", "onboarding", "curriculum", "mentors", "launch", "scheduling"],
    passages: [
      {
        text: "Mentor matching closes ten days before day one. Matches made in the first week of programming have a 40% drop-off; matches made before it have 9%.",
        concepts: ["mentors", "cohort", "onboarding"],
      },
    ],
  },
  {
    id: "d6",
    title: "Inbound triage & response SLAs",
    category: "playbooks",
    org: ANY_ORG,
    pages: 6,
    updated: "May 28",
    indexed: true,
    citations: 0,
    concepts: ["inbox", "triage", "sla", "response time", "escalation"],
    passages: [
      {
        text: "Anything from a signed client gets a human reply inside four working hours, even when the reply is 'received, answer Thursday'.",
        concepts: ["sla", "response time", "triage"],
      },
    ],
  },

  {
    id: "d7",
    title: "Master services agreement — template",
    category: "legal",
    org: ANY_ORG,
    pages: 23,
    updated: "Apr 18",
    indexed: true,
    citations: 26,
    concepts: [
      "contract", "msa", "liability", "indemnity", "termination", "payment terms", "ip ownership",
    ],
    passages: [
      {
        text: "Liability is capped at fees paid in the preceding twelve months. We do not sign uncapped indemnity for third-party media placement — that risk belongs with the platform.",
        concepts: ["liability", "indemnity", "contract", "msa"],
      },
      {
        text: "Payment terms are net 30 from invoice, not from delivery acceptance. Acceptance clauses are how net 30 becomes net 90.",
        concepts: ["payment terms", "contract"],
      },
    ],
  },
  {
    id: "d8",
    title: "Raia Ventures SAFE — executed",
    category: "legal",
    org: "raia",
    pages: 11,
    updated: "Jul 26",
    indexed: false,
    citations: 0,
    concepts: ["safe", "equity", "valuation cap", "fundraising", "dilution", "investor"],
    passages: [
      {
        text: "Post-money valuation cap of $12M with no discount. Pro rata rights attach at $250k and above.",
        concepts: ["valuation cap", "safe", "equity", "investor"],
      },
    ],
  },
  {
    id: "d9",
    title: "Contractor IP assignment",
    category: "legal",
    org: ANY_ORG,
    pages: 4,
    updated: "Mar 02",
    indexed: true,
    citations: 5,
    concepts: ["ip ownership", "contractor", "assignment", "work for hire"],
    passages: [
      {
        text: "Every contractor assigns work product on creation, not on final payment. A withheld invoice must never become a claim on the codebase.",
        concepts: ["ip ownership", "contractor", "assignment"],
      },
    ],
  },

  {
    id: "d10",
    title: "Vision retrieval spec",
    category: "product",
    org: "uwazi",
    pages: 17,
    updated: "Aug 04",
    indexed: true,
    citations: 38,
    concepts: ["retrieval", "embedding", "citation", "search", "ranking", "chunking", "relevance"],
    passages: [
      {
        text: "Vision may only cite chunks that scored above threshold in the retrieval pass. It is never permitted to cite a document it did not read in this turn.",
        concepts: ["citation", "retrieval", "relevance"],
      },
      {
        text: "Chunk on semantic boundaries, not on a fixed character count. A clause split across two chunks retrieves as two weak matches instead of one strong one.",
        concepts: ["chunking", "embedding", "ranking"],
      },
    ],
  },
  {
    id: "d11",
    title: "Approval gate — behaviour spec",
    category: "product",
    org: "uwazi",
    pages: 8,
    updated: "Jul 19",
    indexed: true,
    citations: 21,
    concepts: ["approval", "agent", "guardrail", "permissions", "automation", "audit"],
    passages: [
      {
        text: "An agent proposes; a person commits. There is no configuration that removes the gate, because the gate is the product and a switch to disable it is a switch to sell a different product.",
        concepts: ["approval", "guardrail", "agent", "automation"],
      },
    ],
  },
  {
    id: "d12",
    title: "Timeline & dependency model",
    category: "product",
    org: "uwazi",
    pages: 12,
    updated: "Aug 01",
    indexed: false,
    citations: 0,
    concepts: ["timeline", "gantt", "dependency", "critical path", "scheduling", "tasks"],
    passages: [
      {
        text: "Start and length are stored as integer day offsets. A row and a bar read the same two numbers, so a date can never disagree with its bar.",
        concepts: ["timeline", "gantt", "scheduling", "dependency"],
      },
    ],
  },

  {
    id: "d13",
    title: "Voting Hub — precinct turnout 2024",
    category: "civic",
    org: "bin",
    pages: 61,
    updated: "Jun 30",
    indexed: true,
    citations: 29,
    concepts: ["turnout", "precinct", "election", "voter", "demographics", "civic", "registration"],
    passages: [
      {
        text: "Turnout in the eleven target precincts trailed county average by 14 points, and the gap widens to 22 points among voters under 30.",
        concepts: ["turnout", "precinct", "voter", "demographics"],
      },
      {
        text: "Same-day registration accounted for 31% of under-25 ballots cast, which makes registration deadline messaging the highest-leverage intervention we have.",
        concepts: ["registration", "voter", "turnout"],
      },
    ],
  },
  {
    id: "d14",
    title: "Ballot access rules by state",
    category: "civic",
    org: "bin",
    pages: 88,
    updated: "May 14",
    indexed: true,
    citations: 8,
    concepts: ["ballot", "jurisdiction", "deadline", "election law", "compliance", "registration"],
    passages: [
      {
        text: "Fourteen states close registration 30 days out. Any canvassing calendar that ignores the closing date spends its last three weeks talking to people who cannot vote.",
        concepts: ["deadline", "registration", "jurisdiction", "ballot"],
      },
    ],
  },
  {
    id: "d15",
    title: "Community listening sessions — raw notes",
    category: "civic",
    org: "bin",
    pages: 35,
    updated: "Jul 28",
    indexed: false,
    citations: 0,
    concepts: ["community", "interviews", "qualitative", "civic", "trust"],
    passages: [
      {
        text: "Trust in the county clerk's office was the single most repeated theme, mentioned unprompted in nine of twelve sessions.",
        concepts: ["trust", "community", "qualitative"],
      },
    ],
  },

  {
    id: "d16",
    title: "Hoop Tea activation — scope of work",
    category: "client",
    org: "cc",
    pages: 15,
    updated: "Jul 24",
    indexed: true,
    citations: 19,
    concepts: ["activation", "event", "sponsorship", "deliverables", "scope", "budget", "staffing"],
    passages: [
      {
        text: "Pour stations are the critical path: eight units, two staff each, and a permit that must be filed 21 days ahead. Everything else can slip a week without moving the date.",
        concepts: ["activation", "event", "staffing", "scope"],
      },
      {
        text: "Sponsor deliverables are capped at four social posts and one on-site banner. Anything beyond that is a change order, priced separately.",
        concepts: ["sponsorship", "deliverables", "budget"],
      },
    ],
  },
  {
    id: "d17",
    title: "1Flock handoff documentation",
    category: "client",
    org: "1flock",
    pages: 31,
    updated: "Aug 03",
    indexed: true,
    citations: 11,
    concepts: ["handoff", "documentation", "runbook", "access", "support", "transition"],
    passages: [
      {
        text: "Handoff is complete when their team has run one full deploy without us in the room. Credential transfer alone is not a handoff.",
        concepts: ["handoff", "transition", "access"],
      },
    ],
  },
  {
    id: "d18",
    title: "Q2 client retrospectives",
    category: "client",
    org: ANY_ORG,
    pages: 22,
    updated: "Jul 08",
    indexed: true,
    citations: 3,
    concepts: ["retrospective", "client", "churn", "feedback", "scope creep"],
    passages: [
      {
        text: "Three of four overruns started as an unpriced 'quick favour' in week two. Scope creep does not arrive as a request; it arrives as a courtesy.",
        concepts: ["scope creep", "retrospective", "feedback"],
      },
    ],
  },

  {
    id: "d19",
    title: "FY26 operating budget",
    category: "finance",
    org: ANY_ORG,
    pages: 26,
    updated: "Jul 31",
    indexed: true,
    citations: 23,
    concepts: ["budget", "runway", "burn", "forecast", "headcount", "pricing", "revenue"],
    passages: [
      {
        text: "Blended burn is $148k monthly against $2.1M cash, which is fourteen months of runway before any revenue from the pre-seed cohort.",
        concepts: ["burn", "runway", "budget", "forecast"],
      },
      {
        text: "Pricing assumes a $2,400 annual seat at 60% gross margin. Every point of margin below that costs a month of runway.",
        concepts: ["pricing", "revenue", "runway"],
      },
    ],
  },
  {
    id: "d20",
    title: "Spend approval matrix",
    category: "finance",
    org: ANY_ORG,
    pages: 3,
    updated: "Feb 11",
    indexed: true,
    citations: 14,
    concepts: ["approval", "spend", "procurement", "limits", "expenses", "budget"],
    passages: [
      {
        text: "Anything above $5,000 needs a second signature, and no agent holds a signature at any amount.",
        concepts: ["approval", "spend", "limits", "expenses"],
      },
    ],
  },
  {
    id: "d21",
    title: "Vendor invoices — Q3",
    category: "finance",
    org: "uwazi",
    pages: 47,
    updated: "Aug 05",
    indexed: false,
    citations: 0,
    concepts: ["invoice", "vendor", "payment terms", "accounts payable", "expenses"],
    passages: [
      {
        text: "Two vendors moved to net 15 without notice; the change surfaced only as a late fee on the July statement.",
        concepts: ["invoice", "payment terms", "vendor"],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Semantic matching                                                    */
/* ------------------------------------------------------------------ */

/**
 * Stopwords. Dropped from the query BEFORE scoring.
 *
 * Without this, a question and a keyword search with identical intent get
 * wildly different scores: "what do we charge for ctv?" is seven tokens of
 * which two carry meaning, so a document matching both lands at 2/7 = 29%
 * and renders as a weak lead — while "ctv pricing" matching the same two
 * concepts lands at 100%. Same intent, same document, a third of the score.
 * People then learn to type like a search engine, which is the opposite of
 * what semantic retrieval is for.
 */
const STOPWORDS = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "but", "by", "can", "did", "do", "does",
  "for", "from", "get", "had", "has", "have", "how", "i", "if", "in", "is", "it", "its", "me",
  "my", "of", "on", "or", "our", "should", "show", "so", "than", "that", "the",
  "their", "them", "then", "there", "these", "they", "this", "to", "up", "us", "was", "we",
  "were", "what", "when", "where", "which", "who", "why", "will", "with", "would", "you", "your",
  "about", "find", "tell", "give", "need", "want", "know", "much", "many", "some", "please",
]);

/**
 * Light stemmer. Reduces a surface word to a comparable root.
 *
 * THE TRAP THIS EXISTS TO AVOID: it is tempting to stem only the query and
 * then test `concept.startsWith(queryStem)`. That silently fails on the
 * most ordinary pair in this dataset. Type "price" and the stem is "price";
 * the concept tag is "pricing" — p-r-i-c-i-n-g — which does not start with
 * "price", because the shared root is only "pric". The search returns
 * nothing and looks like an honest miss.
 *
 * So: stem BOTH sides, always, and compare the roots. "price" -> "pric",
 * "pricing" -> "pric", "prices" -> "pric". They meet in the middle or they
 * do not meet at all.
 */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (w.length <= 3) return w;

  const suffixes = ["ational", "iveness", "ization", "fulness", "ousness", "ments", "ement",
    "ing", "ies", "ied", "ers", "est", "ly", "ment", "ness", "ed", "es", "s"];
  for (const s of suffixes) {
    if (w.endsWith(s) && w.length - s.length >= 3) {
      w = w.slice(0, w.length - s.length);
      break;
    }
  }
  // "ies" -> "i" tails and doubled consonants ("shipping" -> "shipp") normalise here.
  if (/([bdfglmnprt])\1$/.test(w)) w = w.slice(0, -1);
  // Trailing silent e, so "price" meets "pricing" at "pric".
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Query terms: stopwords dropped, everything else stemmed. */
export function queryTerms(query: string): { raw: string; stem: string }[] {
  const seen = new Set<string>();
  const out: { raw: string; stem: string }[] = [];
  for (const raw of tokenize(query)) {
    if (STOPWORDS.has(raw)) continue;
    const s = stem(raw);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push({ raw, stem: s });
  }
  return out;
}

/** A concept matches a term when their stems agree on any word. */
function conceptMatches(concept: string, termStem: string): boolean {
  return tokenize(concept).some((word) => {
    const c = stem(word);
    if (c === termStem) return true;
    // Compound roots ("subcontract" / "contract") still meet, but only when
    // the shorter root is substantial — three letters would match anything.
    const [short, long] = c.length < termStem.length ? [c, termStem] : [termStem, c];
    return short.length >= 4 && long.startsWith(short);
  });
}

export interface Hit {
  doc: Doc;
  /** 0-1. */
  score: number;
  /** Concept tags that actually fired, in the document's own words. */
  matched: string[];
  /** Query terms with no concept behind them. */
  unmatched: string[];
  /** Best passage, quoted verbatim. */
  passage: Passage;
  /** True when the document literally contains a typed word. */
  literal: boolean;
}

/**
 * Search. Concept overlap, not substring containment.
 *
 * Scoring is coverage-of-query: how much of what you asked for does this
 * document actually carry. A document that answers one of your three terms
 * perfectly is still a partial answer, and should say so.
 */
export function search(query: string, docs: Doc[]): Hit[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];

  const hits: Hit[] = [];
  for (const doc of docs) {
    if (!doc.indexed) continue; // not embedded = not retrievable. Honestly.

    const matched: string[] = [];
    const unmatched: string[] = [];
    let covered = 0;

    for (const term of terms) {
      const concept = doc.concepts.find((c) => conceptMatches(c, term.stem));
      const inTitle = tokenize(doc.title).some((w) => stem(w) === term.stem);
      if (concept) {
        covered += 1;
        if (!matched.includes(concept)) matched.push(concept);
      } else if (inTitle) {
        covered += 0.8;
        if (!matched.includes(doc.title)) matched.push(`title: ${term.raw}`);
      } else {
        unmatched.push(term.raw);
      }
    }
    if (covered === 0) continue;

    // Pick the passage carrying the most matched concepts, so the quote is
    // evidence for this query rather than the document's opening line.
    let best = doc.passages[0];
    let bestOverlap = -1;
    for (const p of doc.passages) {
      const overlap = terms.filter((t) => p.concepts.some((c) => conceptMatches(c, t.stem))).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = p;
      }
    }

    const coverage = covered / terms.length;
    // A passage that also carries the concepts is stronger evidence than a
    // document-level tag match with an unrelated quote.
    const passageBoost = bestOverlap > 0 ? 0.1 * (bestOverlap / terms.length) : 0;
    const score = Math.min(1, coverage * 0.9 + passageBoost);

    const literal = terms.some(
      (t) =>
        tokenize(doc.title).includes(t.raw) ||
        doc.passages.some((p) => tokenize(p.text).includes(t.raw)),
    );

    hits.push({ doc, score, matched, unmatched, passage: best, literal });
  }

  return hits.sort((a, b) => b.score - a.score || b.doc.citations - a.doc.citations);
}

export interface Coverage {
  category: Category;
  indexed: number;
  waiting: number;
  total: number;
}

export function coverage(docs: Doc[]): Coverage[] {
  return CATEGORIES.map((category) => {
    const inCat = docs.filter((d) => d.category === category.id);
    const indexed = inCat.filter((d) => d.indexed).length;
    return { category, indexed, waiting: inCat.length - indexed, total: inCat.length };
  }).filter((c) => c.total > 0);
}
