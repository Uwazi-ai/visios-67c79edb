import { Loader2, Mail } from "lucide-react";
import { useAgentSettings } from "@/hooks/useGmailAgent";

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

export const AutoSyncSettings = () => {
  const { settings, loading, save } = useAgentSettings();

  return (
    <div className="glass" style={{ padding: 18 }}>
      <div className="flex items-center gap-2 mb-1">
        <Mail size={14} style={{ color: "var(--text-accent)" }} />
        <h3 className="t-section" style={{ margin: 0, fontSize: 14 }}>Gmail Contact Sync</h3>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
        Auto-discover new contacts from Gmail. The agent runs in the background and queues new people for your review.
      </p>

      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <div className="flex flex-col gap-3">
          <Toggle
            label="Enabled"
            value={settings.gmail_contact_sync_enabled}
            onChange={(v) => save({ gmail_contact_sync_enabled: v })}
          />

          <Field label="Frequency">
            <select
              className="input-glass"
              style={{ height: 32, fontSize: 12, padding: "0 8px" }}
              value={settings.gmail_sync_frequency_hours}
              onChange={(e) => save({ gmail_sync_frequency_hours: Number(e.target.value) })}
            >
              <option value={6}>Every 6 hours</option>
              <option value={12}>Every 12 hours</option>
              <option value={24}>Every 24 hours</option>
              <option value={72}>Every 3 days</option>
              <option value={168}>Weekly</option>
            </select>
          </Field>

          <Field label="Look back">
            <select
              className="input-glass"
              style={{ height: 32, fontSize: 12, padding: "0 8px" }}
              value={settings.gmail_sync_lookback_days}
              onChange={(e) => save({ gmail_sync_lookback_days: Number(e.target.value) })}
            >
              <option value={1}>Past 24 hours</option>
              <option value={7}>Past 7 days</option>
              <option value={30}>Past 30 days</option>
            </select>
          </Field>

          <Field label="Min email count">
            <select
              className="input-glass"
              style={{ height: 32, fontSize: 12, padding: "0 8px" }}
              value={settings.gmail_min_email_count}
              onChange={(e) => save({ gmail_min_email_count: Number(e.target.value) })}
            >
              <option value={1}>1+</option>
              <option value={2}>2+</option>
              <option value={3}>3+</option>
            </select>
          </Field>

          <div
            className="flex items-center justify-between pt-3"
            style={{ borderTop: "1px solid var(--border-glass)" }}
          >
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Last synced</span>
            <span className="t-mono">{relative(settings.gmail_last_synced_at)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3">
    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
    {children}
  </div>
);

const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between">
    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      style={{
        width: 38, height: 22, borderRadius: 999,
        background: value ? "var(--text-accent)" : "var(--bg-glass-3)",
        position: "relative", transition: "background 150ms",
      }}
    >
      <span
        style={{
          position: "absolute", top: 2, left: value ? 18 : 2,
          width: 18, height: 18, borderRadius: 999,
          background: "white", transition: "left 150ms",
        }}
      />
    </button>
  </div>
);
