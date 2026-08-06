import { ReactNode } from "react";
import { Desc, Eyebrow } from "@/components/primitives";
import { Fallback } from "@/lib/fallbacks";

/**
 * "Entered by you" — the badge a typed or pasted number carries everywhere
 * it surfaces. Measured and entered numbers sit side by side in this
 * product; only the badge keeps them apart.
 */
export const EnteredBadge = ({ what = "Entered by you" }: { what?: string }) => (
  <span className="vo-entered" title="This figure was typed or pasted by a person, not read from a connected source.">
    {what}
  </span>
);

const LABEL: Record<Fallback["kind"], string> = {
  substitute: "Substitute source",
  manual: "Enter it yourself",
  import: "Import it",
  degrade: "Half the picture",
  sample: "Example data",
  hide: "Not shown",
};

/**
 * The frame a fallback renders inside. It never pretends to be the live
 * field: the kind is named at the top and the note says what is missing.
 */
export const FallbackFrame = ({
  title,
  fallback,
  missing,
  children,
}: {
  title: string;
  fallback: Fallback;
  missing?: string;
  children: ReactNode;
}) => (
  <div className="vo-card vo-fallback" data-kind={fallback.kind}>
    <div className="vo-between">
      <Eyebrow>{title}</Eyebrow>
      <span className="vo-entered" data-kind={fallback.kind}>
        {LABEL[fallback.kind]}
      </span>
    </div>
    <Desc>
      {fallback.note}
      {missing ? ` Connect ${missing} and this is measured instead.` : ""}
    </Desc>
    {children}
  </div>
);

export default FallbackFrame;
