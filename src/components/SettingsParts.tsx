import { ChangeEvent, ReactNode, useRef, useState } from "react";
import { Upload, X, Lock } from "lucide-react";
import { Face } from "@/components/primitives";
import { readImageFile } from "@/lib/readImageFile";
import { resolveHex } from "@/lib/colorValue";
import { Health } from "@/data/connections";

/**
 * Settings controls. Split out of the screen so each one owns its own
 * interaction rules — a picker that clears itself, a toggle that knows the
 * difference between "off" and "not available".
 */

/** Nine, because a row of nine reads as a palette and a row of thirty reads
 *  as a colour wheel with extra steps. Token references, not hexes: the
 *  only literal colour in this app comes from the user's own picker. */
export const SWATCHES = [
  "var(--sw-blue)",
  "var(--sw-indigo)",
  "var(--sw-violet)",
  "var(--sw-magenta)",
  "var(--sw-red)",
  "var(--sw-amber)",
  "var(--sw-green)",
  "var(--sw-teal)",
  "var(--sw-slate)",
];

/**
 * ImageWell — click or drop, then a way back out. An avatar picker with no
 * remove control is a one-way door: pick the wrong file and your only fix
 * is to find a better one.
 */
export const ImageWell = ({
  label,
  image,
  initials,
  color,
  shape,
  onPick,
  onClear,
}: {
  label: string;
  image?: string;
  initials: string;
  color: string;
  shape?: "circle" | "square";
  onPick: (dataUrl: string) => void;
  onClear: () => void;
}) => {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();

  const handle = async (file?: File) => {
    if (!file) return;
    const { url, error: err } = await readImageFile(file);
    setError(err);
    if (url) onPick(url);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    void handle(e.target.files?.[0]);
    /* Reset so choosing the same file twice still fires a change event. */
    e.target.value = "";
  };

  return (
    <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
      <div className="vo-row">
        <button
          type="button"
          className="vo-well"
          data-shape={shape === "square" ? "square" : undefined}
          onClick={() => input.current?.click()}
          aria-label={label}
        >
          {image ? (
            <img src={image} alt="" />
          ) : (
            <span className="vo-well-fill" style={{ background: color }}>
              {initials}
            </span>
          )}
          <span className="vo-well-hover" aria-hidden>
            <Upload size={15} strokeWidth={1.75} />
          </span>
        </button>

        <div className="vo-stack" style={{ gap: 2 }}>
          <button type="button" className="vo-link" onClick={() => input.current?.click()}>
            {image ? "Replace image" : "Upload image"}
          </button>
          {image ? (
            <button type="button" className="vo-link" data-quiet="true" onClick={onClear}>
              <X size={12} strokeWidth={2} aria-hidden /> Remove
            </button>
          ) : (
            <span className="vo-meta">PNG or JPG, under 4 MB</span>
          )}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="vo-hidden-input"
        onChange={onChange}
        tabIndex={-1}
      />
      {error ? <div className="vo-meta" style={{ color: "var(--err-txt)" }}>{error}</div> : null}
    </div>
  );
};

/**
 * ColorRow — nine swatches plus the native input for everything else.
 * The native input is not a fallback; brand colours are rarely in anyone's
 * nine, and a founder who cannot enter their actual hex will notice.
 */
export const ColorRow = ({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) => (
  <div className="vo-row" style={{ flexWrap: "wrap", gap: "var(--s-2)" }}>
    {SWATCHES.map((c) => (
      <button
        key={c}
        type="button"
        className="vo-swatch"
        style={{ background: c }}
        aria-label={`${label}: swatch ${SWATCHES.indexOf(c) + 1}`}
        aria-pressed={value === c}
        data-active={value === c ? "true" : undefined}
        onClick={() => onChange(c)}
      />
    ))}
    <label className="vo-swatch vo-swatch-custom" title="Custom colour">
      <span className="vo-swatch-ring" style={{ background: value }} aria-hidden />
      <input
        type="color"
        value={resolveHex(value)}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label}: custom colour`}
      />
    </label>
  </div>
);

export const HealthBadge = ({ health }: { health: Health }) => {
  const map: Record<Health, { tone?: "ok" | "warn" | "risk"; text: string }> = {
    ok: { tone: "ok", text: "Healthy" },
    warn: { tone: "warn", text: "Degraded" },
    down: { tone: "risk", text: "Failing" },
    off: { text: "Not connected" },
  };
  const { tone, text } = map[health];
  return (
    <span className="vo-tag" data-tone={tone}>
      {text}
    </span>
  );
};

/**
 * Toggle — `disabled` on the input itself, not a class that looks disabled.
 * A styled-off switch still flips on Enter for a keyboard user and still
 * announces as actionable to a screen reader, which is exactly the promise
 * this screen must not break.
 */
export const Toggle = ({
  id,
  label,
  detail,
  checked,
  locked,
  reason,
  onChange,
}: {
  id: string;
  label: string;
  detail: string;
  checked: boolean;
  locked?: boolean;
  reason?: string;
  onChange?: (v: boolean) => void;
}) => (
  <div className="vo-toggle-row" data-locked={locked ? "true" : undefined}>
    <label className="vo-stack" style={{ gap: 2 }} htmlFor={id}>
      <span className="vo-toggle-label">
        {locked ? <Lock size={12} strokeWidth={2} aria-hidden /> : null}
        {label}
      </span>
      <span className="vo-meta">{detail}</span>
    </label>
    <div className="vo-row" style={{ gap: "var(--s-2)" }}>
      {locked ? <span className="vo-meta vo-nowrap">{reason}</span> : null}
      <input
        id={id}
        type="checkbox"
        className="vo-switch"
        checked={locked ? false : checked}
        disabled={locked}
        aria-describedby={locked ? "gate-policy" : undefined}
        onChange={locked ? undefined : (e) => onChange?.(e.target.checked)}
      />
    </div>
  </div>
);

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
    <div className="vo-eyebrow">{label}</div>
    {children}
  </div>
);

/** Segmented control. Radios under the hood so arrow keys work. */
export const Segmented = <T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
}) => (
  <div className="vo-seg" role="radiogroup" aria-label={name}>
    {options.map((o) => (
      <label key={o.value} className="vo-seg-opt" data-active={value === o.value ? "true" : undefined}>
        <input
          type="radio"
          name={name}
          value={o.value}
          checked={value === o.value}
          onChange={() => onChange(o.value)}
        />
        {o.icon}
        {o.label}
      </label>
    ))}
  </div>
);

/** Live preview of a surface the identity actually appears on. */
export const Surface = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="vo-surface">
    <div className="vo-eyebrow">{title}</div>
    {children}
  </div>
);

export { Face };
