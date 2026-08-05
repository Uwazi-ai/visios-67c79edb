import kovaWordmark from "@/assets/kova-wordmark.png";

interface LogoProps {
  size?: number;
  /** Show the wordmark next to the mark. */
  showWordmark?: boolean;
}

export const VisiLogo = ({ size = 28, showWordmark = false }: LogoProps) => {
  void showWordmark;
  const wordmarkHeight = (size > 30 ? 20 : 15) * 1.5;
  return (
    <div className="flex items-center">
      <img
        src={kovaWordmark}
        alt="Kova"
        style={{ height: wordmarkHeight, width: "auto", objectFit: "contain", display: "block" }}
      />
    </div>
  );
};
