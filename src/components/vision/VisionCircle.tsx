import visionV from "@/assets/vision-v.png";

interface VisionCircleProps {
  size?: number;
  thinking?: boolean;
  letter?: string;
}

export const VisionCircle = ({ size = 40, thinking = false }: VisionCircleProps) => {
  const inner = Math.round(size * 0.6);
  return (
    <div
      className={`vision-circle${thinking ? " thinking" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <img
        src={visionV}
        alt=""
        style={{ width: inner, height: inner, objectFit: "contain", display: "block" }}
      />
    </div>
  );
};
