import { deriveShortName } from "@/lib/orgColors";

interface OrgPillProps {
  name: string;
  shortName?: string | null;
  color: string;
  active?: boolean;
  size?: "sm" | "md";
  onClick?: () => void;
}

export function OrgPill({ name, shortName, color, active, size = "md", onClick }: OrgPillProps) {
  const label = shortName?.trim() || deriveShortName(name);
  const padding = size === "sm" ? "2px 8px" : "4px 10px";
  const fontSize = size === "sm" ? 10 : 11;
  return (
    <span
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full font-medium uppercase tracking-wide"
      style={{
        padding,
        fontSize,
        background: active ? color : `${color}22`,
        color: active ? "#fff" : color,
        border: `1px solid ${color}55`,
        cursor: onClick ? "pointer" : "default",
        letterSpacing: "0.04em",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      {label}
    </span>
  );
}
