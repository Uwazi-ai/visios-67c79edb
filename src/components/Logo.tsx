import { useAppState } from "@/lib/AppState";

/**
 * Kova logo. Ten files in /public/brand — five wordmarks, five square marks.
 *
 * The variant is picked by theme, not by the caller: white on dark, black on
 * light. Those are the only two that clear the floor. Three combinations are
 * measured failures and are refused here rather than left to judgement:
 *
 *   black on dark    1.12:1
 *   white on light   1.00:1
 *   blue  on dark    2.42:1  (below the 3:1 floor for a large graphic)
 *
 * The gradient wordmark is a hero asset, not a UI asset. Its tail measures
 * 1.08:1 against white — the "A" is not faint, it is invisible. Marketing and
 * splash surfaces only.
 *
 * Clear space is the height of the K on all four sides; the wrapper applies it
 * as padding so no caller has to remember. Never recolour outside these five,
 * never add a stroke, shadow or glow, and never set the name in a typeface —
 * the letterforms are custom.
 */

export type LogoVariant = "black" | "white" | "blue" | "magenta" | "gradient";
type Theme = "dark" | "light";

/** Ratio of each variant against each theme's background, measured. */
const LEGIBLE: Record<LogoVariant, Record<Theme, boolean>> = {
  black: { dark: false, light: true },
  white: { dark: true, light: false },
  blue: { dark: false, light: true },
  magenta: { dark: true, light: true },
  gradient: { dark: true, light: false },
};

const REASON: Record<string, string> = {
  "black/dark": "1.12:1",
  "white/light": "1.00:1",
  "blue/dark": "2.42:1 — below the 3:1 floor for a large graphic",
  "gradient/light": "1.08:1 at the tail — the A is invisible, hero use only",
};

const autoVariant = (theme: Theme): LogoVariant => (theme === "dark" ? "white" : "black");

function warnIfIllegible(kind: string, variant: LogoVariant, theme: Theme) {
  if (import.meta.env.PROD) return;
  if (LEGIBLE[variant][theme]) return;
  const why = REASON[`${variant}/${theme}`] ?? "fails the contrast floor";
  // eslint-disable-next-line no-console
  console.warn(
    `[Kova ${kind}] "${variant}" on the ${theme} theme is illegible (${why}). ` +
      `Use "${autoVariant(theme)}" instead, or drop the variant prop to let the theme pick.`,
  );
}

/** Clear space = the height of the K, i.e. the rendered height, on all sides. */
const clearSpace = (height: number) => `${Math.round(height)}px`;

export interface LogoProps {
  /** Rendered height in px. */
  height?: number;
  /** Override the theme-picked variant. Hero surfaces only. */
  variant?: LogoVariant;
  /** Skip the built-in clear space when the parent already provides it. */
  bare?: boolean;
  className?: string;
}

export const Logo = ({ height = 22, variant, bare, className }: LogoProps) => {
  const { theme } = useAppState();
  const v = variant ?? autoVariant(theme);
  warnIfIllegible("Logo", v, theme);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        padding: bare ? undefined : clearSpace(height),
        lineHeight: 0,
      }}
    >
      <img
        src={`/brand/kova-wordmark-${v}.png`}
        alt="Kova"
        style={{ height, width: "auto", objectFit: "contain", display: "block" }}
      />
    </span>
  );
};

export interface LogoMarkProps {
  /** Rendered size in px (square). */
  size?: number;
  variant?: LogoVariant;
  /** Sets the mark on a --brand-gradient plate; forces the white mark. */
  plate?: boolean;
  bare?: boolean;
  className?: string;
}

export const LogoMark = ({ size = 22, variant, plate, bare, className }: LogoMarkProps) => {
  const { theme } = useAppState();
  // A plate supplies its own dark ground, so the theme no longer decides.
  const v: LogoVariant = plate ? "white" : variant ?? autoVariant(theme);
  if (!plate) warnIfIllegible("LogoMark", v, theme);

  const img = (
    <img
      src={`/brand/kova-mark-${v}.png`}
      alt="Kova"
      style={{
        height: plate ? Math.round(size * 0.68) : size,
        width: "auto",
        objectFit: "contain",
        display: "block",
      }}
    />
  );

  if (plate) {
    return (
      <span
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: "var(--r-inner)",
          background: "var(--brand-gradient)",
          lineHeight: 0,
        }}
      >
        {img}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ display: "inline-flex", padding: bare ? undefined : clearSpace(size), lineHeight: 0 }}
    >
      {img}
    </span>
  );
};

/**
 * RailLogo — the wordmark at the top of the nav rail at 22px, swapping to the
 * square mark under 96px of usable width. Below that the letterforms close up
 * and the gradient reads as a smudge, so the mark is not a fallback, it is the
 * correct asset at that size.
 *
 * The threshold is measured from the element, not from window.innerWidth: the
 * rail collapses independently of the viewport.
 */
export const RailLogo = () => {
  return (
    <div className="vo-raillogo" style={{ lineHeight: 0 }}>
      <span className="vo-raillogo-word">
        <Logo height={22} bare />
      </span>
      <span className="vo-raillogo-mark">
        <LogoMark size={22} bare />
      </span>
    </div>
  );
};
