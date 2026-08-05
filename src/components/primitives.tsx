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

export const Face = ({ initials, title }: { initials: string; title?: string }) => (
  <span className="vo-face" title={title} aria-hidden={title ? undefined : true}>
    {initials}
  </span>
);

export const SectionHead = ({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) => (
  <div className="vo-between" style={{ marginBottom: "var(--s-3)" }}>
    <h2 className="vo-head">{title}</h2>
    {action}
  </div>
);

export const Bento = ({ children }: { children: ReactNode }) => (
  <div className="vo-bento">{children}</div>
);

export const Col = ({ span, children }: { span: number; children: ReactNode }) => (
  <div className="vo-col" style={{ gridColumn: `span ${span}` }}>
    {children}
  </div>
);

export const Button = ({
  children,
  onClick,
  variant,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "quiet";
  disabled?: boolean;
}) => (
  <button type="button" className="vo-btn" data-variant={variant} onClick={onClick} disabled={disabled}>
    {children}
  </button>
);

/**
 * GatedButton — the product rule: agents propose, a person commits.
 *
 * Unapproved output renders with a dashed edge and dimmed heading, so it
 * reads as unfinished on sight — the inverse of the usual pattern where
 * model output looks authoritative and caveats are buried.
 *
 * Do not add an auto-approve path. The gate is the product.
 */
export const GatedButton = ({
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
