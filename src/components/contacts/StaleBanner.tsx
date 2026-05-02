import { AlertTriangle } from "lucide-react";

interface Props {
  count: number;
  onView: () => void;
}

export const StaleBanner = ({ count, onView }: Props) => {
  if (count === 0) return null;
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-[12px]"
      style={{
        background: "rgba(245,158,11,0.08)",
        border: "1px solid rgba(245,158,11,0.25)",
      }}
    >
      <AlertTriangle size={16} style={{ color: "var(--sev-warn)" }} />
      <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>
        <strong style={{ fontWeight: 600 }}>{count}</strong>{" "}
        contact{count === 1 ? "" : "s"} haven't been touched in 60+ days.
      </span>
      <button
        onClick={onView}
        className="btn-ghost"
        style={{ height: 28, padding: "0 12px", fontSize: 10 }}
      >
        View Stale Contacts
      </button>
    </div>
  );
};
