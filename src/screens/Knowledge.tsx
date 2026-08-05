import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button, Card, Col, Desc, Eyebrow, SectionHead, Tag, Title } from "@/components/primitives";
import {
  CitedRow, CoverageRow, NeverCited, ResultRow, WaitingNotice,
} from "@/components/KnowledgeParts";
import { CATEGORIES, coverage, queryTerms, search } from "@/data/knowledge";
import { useKovaData } from "@/data/live/KovaData";
import { useAppState } from "@/lib/AppState";

const EXAMPLES = [
  "what do we charge for ctv?",
  "price",
  "who signs off on spending",
  "voter turnout",
];

/**
 * Knowledge — the document set Vision can cite, and the honest state of it.
 *
 * Three questions, in the order they matter: can I find the thing, is the
 * thing even indexed, and is anything actually being used.
 */
const Knowledge = () => {
  const { orgs, inScope, scope } = useAppState();
  const { docs } = useKovaData();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const colorOf = (org: string) => orgs.find((o) => o.id === org)?.color ?? "var(--ws-all)";
  const nameOf = (org: string) => orgs.find((o) => o.id === org)?.name ?? "Cross-org";

  const scoped = useMemo(
    () => docs.filter((d) => inScope(d.org) && (!category || d.category === category)),
    [docs, inScope, category],
  );

  const terms = queryTerms(query);
  const hits = useMemo(() => search(query, scoped), [query, scoped]);
  const rows = useMemo(() => coverage(scoped), [scoped]);

  const waiting = scoped.filter((d) => !d.indexed);
  const cited = scoped.filter((d) => d.citations > 0).sort((a, b) => b.citations - a.citations);
  const never = scoped.filter((d) => d.indexed && d.citations === 0);
  const max = cited[0]?.citations ?? 0;
  const scopeName = orgs.find((o) => o.id === scope)?.name ?? "All organizations";

  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      <SectionHead
        title="Knowledge"
        action={<span className="vo-meta">{scoped.length} documents in {scopeName}</span>}
      />

      {/* ---- Semantic search ---- */}
      <Card ungated>
        <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
          <div className="vo-stack" style={{ gap: 4 }}>
            <Eyebrow>Semantic search</Eyebrow>
            <Desc>
              Matches on meaning, so a good result can contain none of the words you
              typed. Every hit below shows the passage it matched and which concepts
              fired, because "trust me" is not a citation.
            </Desc>
          </div>

          <label className="vo-searchbox">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={query}
              placeholder="Ask it the way you'd ask a person"
              aria-label="Search knowledge"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <div className="vo-row" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
            <span className="vo-meta">Try:</span>
            {EXAMPLES.map((e) => (
              <button key={e} type="button" className="vo-chip" onClick={() => setQuery(e)}>
                {e}
              </button>
            ))}
          </div>

          {query.trim() ? (
            <div className="vo-meta">
              {terms.length === 0 ? (
                <>Every word you typed is a stopword — nothing left to match on.</>
              ) : (
                <>
                  Searching on <strong>{terms.map((t) => t.stem).join(", ")}</strong> ·
                  stopwords dropped, both sides stemmed, so <em>price</em> reaches{" "}
                  <em>pricing</em>.
                </>
              )}
            </div>
          ) : null}

          <div className="vo-hits">
            {query.trim() && terms.length > 0 && hits.length === 0 ? (
              <div className="vo-empty">
                <Eyebrow>No concept match</Eyebrow>
                <Desc>
                  Nothing indexed in {scopeName} carries these concepts.
                  {waiting.length > 0
                    ? ` ${waiting.length} document${waiting.length === 1 ? "" : "s"} in scope ` +
                      "are still waiting to be embedded — the answer may be sitting in one of them."
                    : ""}
                </Desc>
              </div>
            ) : (
              hits.map((h) => (
                <ResultRow
                  key={h.doc.id}
                  hit={h}
                  orgColor={colorOf(h.doc.org)}
                  orgName={nameOf(h.doc.org)}
                />
              ))
            )}
          </div>
        </div>
      </Card>

      {/* ---- Categories ---- */}
      <div className="vo-row" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
        <Button variant={category === null ? "primary" : "quiet"} onClick={() => setCategory(null)}>
          All categories
        </Button>
        {CATEGORIES.map((c) => (
          <Button
            key={c.id}
            variant={category === c.id ? "primary" : "quiet"}
            onClick={() => setCategory(category === c.id ? null : c.id)}
          >
            {c.name}
          </Button>
        ))}
      </div>

      <div className="vo-bento">
        {/* ---- Index coverage ---- */}
        <Col span={7}>
          <Card ungated>
            <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
              <div className="vo-between">
                <Title>Index coverage</Title>
                <Tag tone={waiting.length > 0 ? "warn" : "ok"}>
                  {waiting.length > 0 ? `${waiting.length} waiting` : "fully indexed"}
                </Tag>
              </div>
              <WaitingNotice docs={waiting} />
              <div className="vo-covlist">
                {rows.map((r) => (
                  <CoverageRow key={r.category.id} row={r} />
                ))}
              </div>
            </div>
          </Card>
        </Col>

        {/* ---- Cited this month ---- */}
        <Col span={5}>
          <Card ungated>
            <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
              <div className="vo-between">
                <Title>Cited this month</Title>
                <span className="vo-meta">last 30 days</span>
              </div>
              {cited.length === 0 ? (
                <Desc>Vision cited nothing in {scopeName} this month.</Desc>
              ) : (
                <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
                  {cited.map((d) => (
                    <CitedRow key={d.id} doc={d} max={max} orgColor={colorOf(d.org)} />
                  ))}
                </div>
              )}
              <NeverCited docs={never} />
            </div>
          </Card>
        </Col>
      </div>
    </div>
  );
};

export default Knowledge;
