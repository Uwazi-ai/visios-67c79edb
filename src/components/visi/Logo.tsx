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
  const wordmarkHeight = (size > 30 ? 20 : 15) * 5;
  return (
    <div className="flex items-center">
      <img
        src={wordmarkSrc}
        alt="Visi OS"
        style={{ height: wordmarkHeight, width: "auto", objectFit: "contain", display: "block" }}
      />
    </div>
  );
};
