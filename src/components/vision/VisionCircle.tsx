interface VisionCircleProps {
  size?: number;
  thinking?: boolean;
  letter?: string;
}

export const VisionCircle = ({ size = 40, thinking = false, letter = "V" }: VisionCircleProps) => {
  const inner = Math.round(size * 0.5);
  return (
    <div
      className={`vision-circle${thinking ? " thinking" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="vision-circle-inner" style={{ fontSize: inner }}>{letter}</span>
    </div>
  );
};
