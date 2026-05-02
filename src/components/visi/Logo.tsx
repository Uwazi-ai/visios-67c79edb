import logoSrc from "@/assets/visi-logo.png";
import wordmarkSrc from "@/assets/visi-wordmark.png";

interface LogoProps {
  size?: number;
  /** Show the wordmark next to the V mark. */
  showWordmark?: boolean;
}

export const VisiLogo = ({ size = 28, showWordmark = false }: LogoProps) => {
  if (showWordmark) {
    return (
      <img
        src={logoSrc}
        alt="Visi OS"
        height={size}
        style={{ height: size, width: "auto", objectFit: "contain", display: "block" }}
      />
    );
  }

  // Compact: V mark + /OS wordmark image
  const wordmarkHeight = size > 30 ? 20 : 15;
  return (
    <div className="flex items-center gap-2.5">
      <img
        src={logoSrc}
        alt="Visi"
        style={{ height: size, width: size, objectFit: "contain", display: "block" }}
      />
      <img
        src={wordmarkSrc}
        alt="/OS"
        style={{ height: wordmarkHeight, width: "auto", objectFit: "contain", display: "block" }}
      />
    </div>
  );
};
