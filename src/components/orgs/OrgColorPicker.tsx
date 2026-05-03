import { ORG_PALETTE } from "@/lib/orgColors";
import { Check } from "lucide-react";

interface Props {
  value: string;
  onChange: (hex: string) => void;
}

export function OrgColorPicker({ value, onChange }: Props) {
  const isCustom = !ORG_PALETTE.some((c) => c.hex.toLowerCase() === value.toLowerCase());
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {ORG_PALETTE.map((c) => {
          const selected = c.hex.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={c.hex}
              type="button"
              onClick={() => onChange(c.hex)}
              title={c.name}
              className="rounded-full flex items-center justify-center transition-transform hover:scale-110"
              style={{
                width: 32,
                height: 32,
                background: c.hex,
                border: selected ? "2px solid #fff" : "2px solid transparent",
                boxShadow: selected ? `0 0 0 2px ${c.hex}66` : "none",
              }}
            >
              {selected && <Check size={14} color="#fff" strokeWidth={3} />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <span className="t-mono" style={{ fontSize: 10 }}>CUSTOM</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 36, height: 28, background: "transparent", border: "1px solid var(--border-glass)", borderRadius: 6, cursor: "pointer" }}
        />
        <input
          className="input-glass"
          style={{ width: 110, fontSize: 12 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {isCustom && <span className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>custom</span>}
      </div>
    </div>
  );
}
