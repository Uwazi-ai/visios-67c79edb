import { ReactNode } from "react";
import { useCapability } from "@/lib/sources";
import { Button, Desc, Eyebrow, Title } from "@/components/primitives";

/**
 * SourceGate — resolves a widget's capability before the widget renders.
 *
 * empty    the required sources are missing. We say what this would show
 *          and offer the way to turn it on. We never render the widget,
 *          because a chart of zeros reads as an answer.
 * partial  the widget is true, but thinner than it could be. It renders,
 *          with one line naming what is missing so nobody reads it as the
 *          whole picture.
 * ready    the widget, alone.
 */
export const SourceGate = ({
  capability,
  onConnect,
  children,
}: {
  capability: string;
  onConnect?: () => void;
  children: ReactNode;
}) => {
  const { state, capability: cap, missingRequired, missingAnyOf, missingOptional } =
    useCapability(capability);

  if (state === "empty") {
    const blocking = [...missingRequired, ...missingAnyOf];
    const label =
      missingRequired.length > 0
        ? missingRequired.map((s) => s.name).join(" and ")
        : missingAnyOf.map((s) => s.name).join(" or ");
    return (
      <div className="vo-card vo-gate-empty">
        <Eyebrow>Not connected</Eyebrow>
        <Title>{cap.title}</Title>
        <Desc>{cap.does}</Desc>
        {missingAnyOf.length > 0 && (
          <p className="vo-meta">Any one of these turns this on.</p>
        )}
        <div className="vo-gate-chips">
          {blocking.map((s) => (
            <span key={s.id} className="vo-chip" data-draft="true">
              {s.name}
            </span>
          ))}
        </div>
        {onConnect && (
          <Button variant="primary" size="sm" onClick={onConnect}>
            Connect {label}
          </Button>
        )}
      </div>
    );
  }


  return (
    <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
      {children}
      {state === "partial" && (
        <p className="vo-meta vo-gate-note">
          Missing {missingOptional.map((s) => s.name).join(", ")} — this is incomplete, not empty.
        </p>
      )}
    </div>
  );
};

export default SourceGate;
