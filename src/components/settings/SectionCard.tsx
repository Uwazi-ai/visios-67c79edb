import type { ReactNode } from "react";

export default function SectionCard({
  title, subtitle, children, accent,
}: { title: string; subtitle?: string; children: ReactNode; accent?: "ok" | "warn" | "danger" }) {
  const borderColor =
    accent === "ok" ? "hsl(var(--success, 142 76% 45%))" :
    accent === "warn" ? "#F59E0B" :
    accent === "danger" ? "#EF4444" :
    "var(--border-glass)";
  return (
    <div
      className="glass p-5"
      style={{
        borderLeft: accent ? `3px solid ${borderColor}` : undefined,
      }}
    >
      <div className="mb-4">
        <div className="t-card-title" style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 600 }}>{title}</div>
        {subtitle && <div className="t-mono mt-1" style={{ fontSize: 10, color: "var(--text-muted)" }}>{subtitle}</div>}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <div>
    <label className="t-mono block mb-1.5" style={{ fontSize: 10 }}>{label}</label>
    {children}
    {hint && <div className="t-mono mt-1" style={{ fontSize: 9, color: "var(--text-muted)" }}>{hint}</div>}
  </div>
);

export const ToggleRow = ({
  label, hint, value, onChange, disabled,
}: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <div className="flex items-center justify-between gap-4 py-2">
    <div className="flex-1 min-w-0">
      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{label}</div>
      {hint && <div className="t-mono mt-0.5" style={{ fontSize: 10, color: "var(--text-muted)" }}>{hint}</div>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className="relative rounded-full transition-colors flex-shrink-0"
      style={{
        width: 36, height: 20,
        background: value ? "hsl(var(--primary))" : "var(--bg-glass-2)",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        className="block rounded-full bg-white transition-transform"
        style={{ width: 16, height: 16, transform: `translateX(${value ? 18 : 2}px) translateY(2px)` }}
      />
    </button>
  </div>
);
