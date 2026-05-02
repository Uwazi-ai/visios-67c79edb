import { Sparkles, Mail, RefreshCw, Loader2, Inbox } from "lucide-react";

interface Props {
  syncEnabled: boolean;
  syncing: boolean;
  lastSyncedAt: string | null;
  pendingCount: number;
  onScanNow: () => void;
  onReview: () => void;
  onConfigureSync: () => void;
}

function relative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const AgentStatusBar = ({ syncEnabled, syncing, lastSyncedAt, pendingCount, onScanNow, onReview, onConfigureSync }: Props) => {
  if (syncing) {
    return (
      <div className="glass flex items-center gap-3" style={{ padding: "8px 14px", fontSize: 12 }}>
        <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-accent)" }} />
        <span style={{ color: "var(--text-secondary)" }}>Gmail Agent scanning…</span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="glass flex items-center gap-3" style={{ padding: "8px 14px", fontSize: 12 }}>
        <Sparkles size={14} style={{ color: "var(--text-accent)" }} />
        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
          {pendingCount} contact{pendingCount === 1 ? "" : "s"} ready to review
        </span>
        {lastSyncedAt && (
          <span className="t-mono" style={{ color: "var(--text-muted)" }}>· last sync {relative(lastSyncedAt)}</span>
        )}
        <div className="flex-1" />
        <button onClick={onReview} className="btn-primary" style={{ height: 26, fontSize: 11, padding: "0 10px" }}>
          Review
        </button>
        <button onClick={onScanNow} className="btn-ghost" style={{ height: 26, fontSize: 11, padding: "0 10px" }}>
          <RefreshCw size={10} /> Sync now
        </button>
      </div>
    );
  }

  if (syncEnabled) {
    return (
      <div className="glass flex items-center gap-3" style={{ padding: "8px 14px", fontSize: 12 }}>
        <Mail size={14} style={{ color: "var(--text-secondary)" }} />
        <span style={{ color: "var(--text-secondary)" }}>
          Auto-sync on · last sync {relative(lastSyncedAt)}
        </span>
        <div className="flex-1" />
        <button onClick={onScanNow} className="btn-ghost" style={{ height: 26, fontSize: 11, padding: "0 10px" }}>
          <RefreshCw size={10} /> Sync now
        </button>
      </div>
    );
  }

  return (
    <div className="glass flex items-center gap-3" style={{ padding: "8px 14px", fontSize: 12 }}>
      <Inbox size={14} style={{ color: "var(--text-muted)" }} />
      <span style={{ color: "var(--text-muted)" }}>Gmail sync off</span>
      <div className="flex-1" />
      <button onClick={onScanNow} className="btn-primary" style={{ height: 26, fontSize: 11, padding: "0 10px" }}>
        <Sparkles size={10} /> Find contacts from Gmail
      </button>
      <button onClick={onConfigureSync} className="btn-ghost" style={{ height: 26, fontSize: 11, padding: "0 10px" }}>
        Configure auto-sync
      </button>
    </div>
  );
};
