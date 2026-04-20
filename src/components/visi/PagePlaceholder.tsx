import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  icon: LucideIcon;
  hint?: string;
}

export const PagePlaceholder = ({ title, icon: Icon, hint }: Props) => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Icon size={20} strokeWidth={1.25} style={{ color: "var(--text-accent)" }} />
      <h1 className="t-section">{title}</h1>
    </div>
    <div className="glass card-enter p-12 flex flex-col items-center justify-center text-center" style={{ minHeight: 280 }}>
      <div
        style={{
          width: 56, height: 56, borderRadius: 14,
          background: "var(--bg-glass-2)", border: "1px solid var(--border-glass)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Icon size={24} strokeWidth={1.25} style={{ color: "var(--text-accent)" }} />
      </div>
      <div className="t-card-title mb-2">Coming Soon</div>
      <p className="t-body max-w-sm" style={{ color: "var(--text-muted)" }}>
        {hint ?? `${title} is part of Phase 1. The foundation is in place — features land here next.`}
      </p>
    </div>
  </div>
);
