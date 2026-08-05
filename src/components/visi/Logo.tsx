import kovaWordmark from "@/assets/kova-wordmark.png.asset.json";

interface LogoProps {
  size?: number;
  /** Show the wordmark next to the mark. */
  showWordmark?: boolean;
}

export const VisiLogo = ({ size = 28, showWordmark = false }: LogoProps) => {
  void showWordmark;
  // 3x the previous scale so the wordmark reads clearly at every placement.
  const wordmarkHeight = (size > 30 ? 20 : 15) * 3;
  return (
    <div className="flex items-center">
      <img
        src={kovaWordmark.url}
        alt="Kova"
        style={{ height: wordmarkHeight, width: "auto", objectFit: "contain", display: "block" }}
      />
    </div>
  );
};
