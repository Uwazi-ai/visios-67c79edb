interface LogoProps {
  size?: number;
  showText?: boolean;
}

export const VisiLogo = ({ size = 28, showText = true }: LogoProps) => (
  <div className="flex items-center gap-2.5">
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-label="Visi OS">
      <path d="M2 4 L14 24 L26 4 L20 4 L14 16 L8 4 Z" fill="#2563EB" />
      <path d="M16 4 L22 4 L17 12 Z" fill="white" />
    </svg>
    {showText && (
      <span
        className="font-display"
        style={{
          fontWeight: 900,
          fontSize: size > 30 ? 22 : 16,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-primary)",
          lineHeight: 1,
        }}
      >
        VISI<span className="slash">/</span>OS
      </span>
    )}
  </div>
);
