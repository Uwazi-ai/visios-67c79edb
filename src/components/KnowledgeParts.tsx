import { AlertTriangle, FileText, Quote } from "lucide-react";
import { Desc, Eyebrow, Tag, Title } from "@/components/primitives";
import type { Coverage, Doc, Hit } from "@/data/knowledge";

const pct = (n: number) => Math.round(n * 100);

/**
 * A semantic hit has to justify itself.
 *
 * The whole point of meaning-based retrieval is that a good result can
 * contain none of the words you typed — which is indistinguishable from a
 * bug unless the UI shows its working. So every row carries: the passage
 * quoted verbatim, a bar, a number, and a sentence naming which concepts
 * fired and which of your words did not.
 */
export const ResultRow = ({ hit, orgColor, orgName }: { hit: Hit; orgColor: string; orgName: string }) => {
  const weak = hit.score < 0.5;
  return (
    <article className="vo-hit" data-weak={weak ? "true" : undefined}>
      <div className="vo-between vo-hit-head">
        <div className="vo-row" style={{ gap: "var(--s-2)", minWidth: 0 }}>
          <span className="vo-orgdot" style={{ background: orgColor }} aria-hidden="true" />
          <Title>{hit.doc.title}</Title>
        </div>
        <div className="vo-row" style={{ gap: "var(--s-2)" }}>
          <span className="vo-meta">{orgName}</span>
          <span className="vo-relnum" data-weak={weak ? "true" : undefined}>{pct(hit.score)}%</span>
        </div>
      </div>

      <div className="vo-relbar" role="img" aria-label={`Relevance ${pct(hit.score)} percent`}>
        <span
          className="vo-relbar-fill"
          data-weak={weak ? "true" : undefined}
          style={{ width: `${Math.max(4, pct(hit.score))}%` }}
        />
      </div>

      <blockquote className="vo-quote">
        <Quote size={13} aria-hidden="true" />
        <span>{hit.passage.text}</span>
      </blockquote>

      <p className="vo-why">
        {hit.matched.length > 0 ? (
          <>
            Matched on <strong>{hit.matched.join(", ")}</strong>
            {hit.literal ? "" : " — not on your exact wording."}
            {hit.literal ? " — including your exact wording." : ""}
          </>
        ) : (
          "Matched on related concepts only."
        )}
        {hit.unmatched.length > 0 ? (
          <> Nothing here covers <strong>{hit.unmatched.join(", ")}</strong>.</>
        ) : null}
      </p>

      {weak ? (
        <p className="vo-why" data-weak="true">
          Under 50% — treat them as leads, not answers. Open the document before you
          repeat anything from it.
        </p>
      ) : null}

      <div className="vo-row vo-hit-foot">
        <span className="vo-meta">{hit.doc.pages} pages · updated {hit.doc.updated}</span>
        <span className="vo-meta">
          {hit.doc.citations > 0 ? `cited ${hit.doc.citations}× in 30 days` : "never cited"}
        </span>
      </div>
    </article>
  );
};

/**
 * Coverage. Indexed vs waiting, per category.
 *
 * Most tools hide this entirely, and the reason it matters is specific:
 * an un-embedded document does not degrade the answer, it disappears from
 * it. The search comes back empty rather than wrong, and empty reads like
 * "we never wrote that down".
 */
export const CoverageRow = ({ row }: { row: Coverage }) => {
  const ratio = row.indexed / row.total;
  return (
    <div className="vo-cov">
      <div className="vo-between">
        <span className="vo-cov-name">{row.category.name}</span>
        <span className="vo-meta">
          {row.indexed}/{row.total} indexed
          {row.waiting > 0 ? ` · ${row.waiting} waiting` : ""}
        </span>
      </div>
      <div className="vo-covbar" role="img" aria-label={`${row.indexed} of ${row.total} indexed`}>
        <span className="vo-covbar-fill" style={{ width: `${ratio * 100}%` }} />
        {row.waiting > 0 ? (
          <span className="vo-covbar-wait" style={{ width: `${(row.waiting / row.total) * 100}%` }} />
        ) : null}
      </div>
      <div className="vo-meta">{row.category.blurb}</div>
    </div>
  );
};

export const WaitingNotice = ({ docs }: { docs: Doc[] }) => {
  if (docs.length === 0) {
    return (
      <div className="vo-meta">
        Everything in scope is embedded. Vision can cite all of it.
      </div>
    );
  }
  return (
    <div className="vo-warn">
      <AlertTriangle size={14} aria-hidden="true" />
      <div className="vo-stack" style={{ gap: 4 }}>
        <strong>
          {docs.length} document{docs.length === 1 ? " is" : "s are"} uploaded but not embedded.
        </strong>
        <span>
          Vision cannot cite them, and a search that should have found{" "}
          <em>{docs[0].title}</em> will come back empty instead of wrong — which is easy
          to miss.
        </span>
        <span className="vo-meta">
          {docs.map((d) => d.title).join(" · ")}
        </span>
      </div>
    </div>
  );
};

export const CitedRow = ({
  doc,
  max,
  orgColor,
}: {
  doc: Doc;
  max: number;
  orgColor: string;
}) => (
  <div className="vo-cited">
    <span className="vo-orgdot" style={{ background: orgColor }} aria-hidden="true" />
    <span className="vo-cited-name">
      <FileText size={13} aria-hidden="true" /> {doc.title}
    </span>
    <span className="vo-cited-bar">
      <span style={{ width: `${max > 0 ? (doc.citations / max) * 100 : 0}%` }} />
    </span>
    <span className="vo-cited-n">{doc.citations}</span>
  </div>
);

export const NeverCited = ({ docs }: { docs: Doc[] }) => {
  if (docs.length === 0) return null;
  return (
    <div className="vo-stack" style={{ gap: "var(--s-2)", marginTop: "var(--s-3)" }}>
      <div className="vo-row" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
        <Eyebrow>Indexed, never cited</Eyebrow>
        <Tag>{docs.length}</Tag>
      </div>
      <Desc>
        These are embedded and retrievable, and Vision still never reached for them in
        30 days. A never-cited document is one of three things: wrong, so nothing
        should cite it; buried, so its concepts don't match how anyone actually asks;
        or unnecessary. All three are worth knowing, and only the second is fixable by
        editing the document.
      </Desc>
      <div className="vo-row" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
        {docs.map((d) => (
          <span key={d.id} className="vo-chip">{d.title}</span>
        ))}
      </div>
    </div>
  );
};
