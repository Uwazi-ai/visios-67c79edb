import { AGREE_AT, Contact, Signal, Touchpoint, verdict } from "@/data/contacts";
import { Desc, Eyebrow, Tag } from "@/components/primitives";

const LABEL: Record<Signal["kind"], string> = {
  location: "Location",
  calendar: "Calendar",
  overlap: "Overlap",
};

const state = (s: Signal) =>
  s.strength >= AGREE_AT ? "firing" : s.strength > 0 ? "weak" : "silent";

const STATE_COPY: Record<string, string> = {
  firing: "Firing",
  weak: "Weak",
  silent: "Nothing",
};

/**
 * One signal, on its own row, with its own state. Kept visually separate
 * because the whole point is that they can disagree — averaging them into a
 * single "confidence" bar hides which one is carrying the claim.
 */
export const SignalRow = ({ signal }: { signal: Signal }) => {
  const st = state(signal);
  return (
    <div className="vo-signal" data-state={st}>
      <div className="vo-signal-head">
        <span className="vo-signal-name">{LABEL[signal.kind]}</span>
        <span className="vo-signal-state" data-state={st}>
          {STATE_COPY[st]}
        </span>
        <span className="vo-signal-bar" aria-hidden="true">
          <span style={{ width: `${Math.round(signal.strength * 100)}%` }} data-state={st} />
        </span>
      </div>
      <div className="vo-signal-read">
        {signal.reading || "Nothing recorded in that window."}
      </div>
      <div className="vo-meta">{signal.basis}</div>
    </div>
  );
};

/**
 * The claim, or the question. Edge is solid green only when two or more
 * signals clear the bar; otherwise dashed amber and phrased as a question,
 * because being confidently wrong about where you met someone is worse than
 * saying nothing — you will repeat it to their face.
 */
export const ProvenanceCard = ({
  contact,
  onAsk,
}: {
  contact: Contact;
  onAsk: () => void;
}) => {
  const v = verdict(contact.provenance);
  return (
    <div className="vo-prov" data-stated={v.stated ? "true" : "false"}>
      <div className="vo-row" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
        <Eyebrow>Provenance</Eyebrow>
        <Tag tone={v.stated ? "ok" : "warn"}>{v.pct}% confidence</Tag>
        <span className="vo-meta">
          {v.agreeing} of 3 signals agree — {v.stated ? "stated" : "not enough to state"}
        </span>
      </div>

      <p className="vo-prov-line" data-stated={v.stated ? "true" : "false"}>
        {v.line}
      </p>

      {!v.stated ? (
        <div className="vo-row" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
          <button type="button" className="vo-btn" data-variant="quiet" onClick={onAsk}>
            Work it out in Vision
          </button>
          <span className="vo-meta">
            Vision can search your threads and photos for that afternoon. It will still
            ask before it writes anything to the record.
          </span>
        </div>
      ) : null}

      <div className="vo-signals">
        {contact.provenance.signals.map((s) => (
          <SignalRow key={s.kind} signal={s} />
        ))}
      </div>
    </div>
  );
};

/**
 * Relationship track — touchpoints on a real time axis, not an evenly
 * spaced list. A month of silence has to *look* like a month of silence.
 */
export const Track = ({
  points,
  crossRef,
}: {
  points: Touchpoint[];
  crossRef?: string;
}) => {
  const span = Math.max(60, ...points.map((p) => p.daysAgo)) + 4;
  const last = points.length ? Math.min(...points.map((p) => p.daysAgo)) : null;

  return (
    <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
      <div className="vo-track">
        <div className="vo-track-axis" aria-hidden="true" />
        {points.map((p) => (
          <span
            key={`${p.daysAgo}-${p.label}`}
            className="vo-track-dot"
            data-channel={p.channel}
            style={{ left: `${((span - p.daysAgo) / span) * 100}%` }}
            title={`${p.label} — ${p.daysAgo} days ago`}
          />
        ))}
        <span className="vo-track-end" aria-hidden="true">
          today
        </span>
      </div>
      <div className="vo-row" style={{ justifyContent: "space-between" }}>
        <span className="vo-meta">{span} days ago</span>
        <span className="vo-meta">
          {last === null ? "No touchpoints" : `Last contact ${last} days ago`}
        </span>
      </div>

      <ul className="vo-tp">
        {[...points]
          .sort((a, b) => a.daysAgo - b.daysAgo)
          .map((p) => (
            <li key={`${p.daysAgo}-${p.label}`}>
              <span className="vo-tp-when">{p.daysAgo}d</span>
              <span>{p.label}</span>
            </li>
          ))}
      </ul>

      {crossRef ? <div className="vo-crossref">{crossRef}</div> : null}
    </div>
  );
};

/**
 * Enrichment — public pages and your own threads, each row naming its
 * source. No source, no row. When nothing matched, that is written out
 * rather than filled in with a plausible guess.
 */
export const Found = ({ contact }: { contact: Contact }) => {
  if (!contact.enrichment.length) {
    return (
      <div className="vo-nomatch">
        <Eyebrow>No public match</Eyebrow>
        <Desc>{contact.noPublicMatch}</Desc>
      </div>
    );
  }
  return (
    <ul className="vo-found">
      {contact.enrichment.map((e) => (
        <li key={e.source}>
          <span className="vo-found-src">{e.source}</span>
          <span className="vo-found-what">{e.found}</span>
          <span className="vo-meta vo-found-url">{e.url}</span>
        </li>
      ))}
    </ul>
  );
};
