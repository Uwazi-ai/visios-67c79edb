import logoSrc from "@/assets/visi-logo.png";

interface LogoProps {
  size?: number;
  /** Show the wordmark next to the V mark. The uploaded asset already includes "/OS", so by default we render only the mark and let surrounding UI carry context. */
  showWordmark?: boolean;
}

export const VisiLogo = ({ size = 28, showWordmark = false }: LogoProps) => {
  // The source asset is square with generous whitespace; render at intrinsic ratio
  // and rely on object-contain to keep it crisp at any size.
  if (showWordmark) {
    // Full lockup: V + /OS from the uploaded asset
    return (
      <img
        src={logoSrc}
        alt="Visi OS"
        height={size}
        style={{ height: size, width: "auto", objectFit: "contain", display: "block" }}
      />
    );
  }

  // Compact: V mark + typographic "/OS" so the slash motif is reused live
  return (
    <div className="flex items-center gap-2.5">
      <img
        src={logoSrc}
        alt="Visi"
        style={{ height: size, width: size, objectFit: "contain", display: "block" }}
      />
      <span
        className="font-display"
        style={{
          fontWeight: 900,
          fontSize: size > 30 ? 20 : 15,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-primary)",
          lineHeight: 1,
        }}
      >
        VISI<span className="slash" style={{ margin: "0 2px" }}>/</span>OS
      </span>
    </div>
  );
};
