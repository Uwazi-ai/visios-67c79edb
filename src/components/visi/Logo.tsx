import logoSrc from "@/assets/visi-logo.png";
import wordmarkSrc from "@/assets/visi-wordmark.png";
import { withVersion } from "@/lib/assetVersion";

interface LogoProps {
  size?: number;
  /** Show the wordmark next to the V mark. */
  showWordmark?: boolean;
}

export const VisiLogo = ({ size = 28, showWordmark = false }: LogoProps) => {
  void logoSrc;
  const wordmarkHeight = (size > 30 ? 20 : 15) * 5;
  return (
    <div className="flex items-center">
      <img
        src={withVersion(wordmarkSrc)}
        alt="Visi OS"
        style={{ height: wordmarkHeight, width: "auto", objectFit: "contain", display: "block" }}
      />
    </div>
  );
};
