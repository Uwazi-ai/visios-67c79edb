import { ReactNode, CSSProperties } from "react";

/**
 * Shared primitives. Imported, never redeclared inline — the module graph
 * enforces the ordering. No hex codes here; every value reads var(--*).
 */

export const Card = ({
  children,
  span,
  ungated,
  style,
}: {
  children: ReactNode;
  span?: number;
  ungated?: boolean;
  style?: CSSProperties;
}) => (
  <div
    className="vo-card"
    data-ungated={ungated ? "true" : undefined}
    style={{ gridColumn: span ? `span ${span}` : undefined, ...style }}
  >
    {children}
  </div>
);

export const Eyebrow = ({ children }: { children: ReactNode }) => (
  <div className="vo-eyebrow">{children}</div>
);

export const Title = ({ children }: { children: ReactNode }) => (
  <h3 className="vo-title">{children}</h3>
);

export const Desc = ({ children }: { children: ReactNode }) => (
  <p className="vo-desc">{children}</p>
);

export const Stat = ({
  value,
  label,
  note,
}: {
  value: ReactNode;
  label: string;
  note?: ReactNode;
}) => (
  <div className="vo-stack">
    <Eyebrow>{label}</Eyebrow>
    <div className="vo-stat">{value}</div>
    {note ? <div className="vo-meta">{note}</div> : null}
  </div>
);

export const Tag = ({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: "ok" | "warn" | "risk" | "accent";
}) => (
  <span className="vo-tag" data-tone={tone}>
    {children}
  </span>
);

/**
 * Face — one component for people and for orgs, so the fallback never
 * differs between them. Photo when set, initials when not. An org with no
 * logo and a person with no headshot degrade to the same shape.
 */
export const Face = ({
  initials,
  title,
  photo,
  color,
  size,
  shape,
}: {
  initials: string;
  title?: string;
  photo?: string;
  /** Token reference, e.g. var(--org-uwazi). */
  color?: string;
  size?: "md" | "lg";
  shape?: "circle" | "square";
}) => (
  <span
    className="vo-face"
    title={title}
    aria-hidden={title ? undefined : true}
    data-size={size === "lg" ? "lg" : undefined}
    data-shape={shape === "square" ? "square" : undefined}
    style={color && !photo ? { background: color, color: "var(--nav-bg)" } : undefined}
  >
    {photo ? <img src={photo} alt={title ?? ""} /> : initials}
  </span>
);

type Size = "lg" | "md" | "sm";

export const Button = ({
  children,
  onClick,
  variant,
  size = "md",
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "quiet";
  size?: Size;
  disabled?: boolean;
  title?: string;
}) => (
  <button
    type="button"
    className="vo-btn"
    data-variant={variant}
    data-size={size}
    onClick={onClick}
    disabled={disabled}
    title={title}
  >
    {children}
  </button>
);

/**
 * GatedButton — three states, one rule.
 *
 * 01 BLOCKED  .b-gate      dashed, really `disabled`, labelled with what blocks it
 * 02 CLEARED  .b-complete  --grad-action, live — only for model-proposed work
 * 03 DONE     .b-done      green tint, no longer actionable
 *
 * The real `disabled` attribute, not styling that looks disabled: a button
 * that only *appears* blocked still fires on Enter for a keyboard user, and
 * still reads as actionable to a screen reader.
 *
 * variant="plain" keeps ordinary primary actions on --a-500 blue. The
 * gradient is reserved for a cleared AI workflow; used anywhere else it
 * stops signalling anything and the gate stops reading as significant.
 */
export const GatedButton = ({
  children,
  blockedCount,
  blockedLabel,
  readyLabel,
  doneLabel,
  done,
  onClick,
  variant = "complete",
  size = "md",
}: {
  children?: ReactNode;
  blockedCount: number;
  blockedLabel?: string;
  readyLabel?: string;
  doneLabel?: string;
  done?: boolean;
  onClick?: () => void;
  variant?: "complete" | "plain";
  size?: Size;
}) => {
  const label = readyLabel ?? children;

  if (done) {
    return (
      <button type="button" className="b-done" data-size={size} disabled aria-disabled="true">
        {doneLabel ?? "Done"}
      </button>
    );
  }

  if (blockedCount > 0) {
    return (
      <button
        type="button"
        className="b-gate"
        data-size={size}
        disabled
        aria-describedby="gate-reason"
      >
        {blockedLabel ?? `${blockedCount} proposal${blockedCount === 1 ? "" : "s"} pending review`}
      </button>
    );
  }


  return (
    <button
      type="button"
      className={variant === "plain" ? "b-pri" : "b-complete"}
      data-size={size}
      onClick={onClick}
    >
      {label}
    </button>
  );
};


/**
 * SectionHead — index is optional and means "step N of a sequence".
 * A reference section is not a step, so it gets a title only. Numbering
 * everything is how the pattern stops meaning anything and turns into
 * decoration.
 */
export const SectionHead = ({
  title,
  index,
  action,
}: {
  title: string;
  index?: number;
  action?: ReactNode;
}) => (
  <div className="vo-between" style={{ marginBottom: "var(--s-3)" }}>
    <div className="vo-row" style={{ gap: "var(--s-2)" }}>
      {typeof index === "number" ? <Eyebrow>Step {index}</Eyebrow> : null}
      <h2 className="vo-head">{title}</h2>
    </div>
    {action}
  </div>
);

export const Bento = ({ children }: { children: ReactNode }) => (
  <div className="vo-bento">{children}</div>
);

/** Span is a data attribute so CSS can override it at narrow widths.
 *  Reading window.innerWidth during render never updates on resize. */
export const Col = ({ span, children }: { span: number; children: ReactNode }) => (
  <div className="vo-col" data-span={span} style={{ gridColumn: `span ${span}` }}>
    {children}
  </div>
);

/**
 * ProposalCard — the product rule: agents propose, a person commits.
 *
 * Unapproved output renders with a dashed edge and a dimmed heading, so it
 * reads as unfinished on sight — the inverse of the usual pattern where
 * model output looks authoritative and the caveat is buried.
 *
 * Do not add an auto-approve path. The gate is the product.
 */
export const ProposalCard = ({
  title,
  body,
  signals,
  approved,
  onApprove,
  onDismiss,
}: {
  title: string;
  body: string;
  signals: string[];
  approved: boolean;
  onApprove: () => void;
  onDismiss?: () => void;
}) => (
  <div className="vo-gate" data-approved={approved ? "true" : "false"}>
    <div className="vo-stack">
      <div className="vo-between">
        <Title>{title}</Title>
        <Tag tone={approved ? "ok" : undefined}>{approved ? "committed" : "proposed"}</Tag>
      </div>
      <Desc>{body}</Desc>
      <div className="vo-meta">
        {/* confidence = agreement across signals, not probability of being correct */}
        {signals.length} signals agree · {signals.join(" · ")}
      </div>
      {!approved && (
        <div className="vo-row" style={{ marginTop: "var(--s-1)" }}>
          <Button variant="primary" onClick={onApprove}>
            Approve
          </Button>
          {onDismiss ? (
            <Button variant="quiet" onClick={onDismiss}>
              Dismiss
            </Button>
          ) : null}
        </div>
      )}
    </div>
  </div>
);
