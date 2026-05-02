import { useEffect, useState, useMemo } from "react";
import { X, Sparkles, Mail, Loader2, Check, Rocket, RefreshCw, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { DiscoveredContactCard, type QueueRow } from "./DiscoveredContactCard";

type Phase = "config" | "scanning" | "review" | "done";

interface Org {
  id: string;
  slug: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  orgs: Org[];
  onContactsChanged: () => void; // refresh Contacts list
  onPendingChanged: () => void; // refresh badge
  initialPhase?: Phase; // "review" if user clicked badge
}

interface ScanResult {
  threadsScanned: number;
  uniqueSenders: number;
  candidates: number;
  queued: number;
  updatedExisting: number;
  existingCount: number;
}

export const GmailAgentDrawer = ({ open, onClose, orgs, onContactsChanged, onPendingChanged, initialPhase = "config" }: Props) => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [minEmailCount, setMinEmailCount] = useState<1 | 2 | 3>(1);
  const [defaultOrgId, setDefaultOrgId] = useState<string>(""); // empty = let me choose
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [filter, setFilter] = useState<"all" | "high" | "review">("all");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPhase(initialPhase);
      setScanError(null);
      setScanResult(null);
      if (initialPhase === "review") void loadQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPhase]);

  const loadQueue = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("contact_review_queue")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("email_count", { ascending: false })
      .order("confidence", { ascending: false });
    setQueue((data ?? []) as QueueRow[]);
  };

  const startScan = async () => {
    setScanError(null);
    setPhase("scanning");
    try {
      const { data, error } = await supabase.functions.invoke("gmail-discover-contacts", {
        body: {
          days,
          minEmailCount,
          defaultOrgId: defaultOrgId || null,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) {
        if (data.error === "GOOGLE_AUTH_REQUIRED") {
          throw new Error("Sign in to Google again to grant Gmail access.");
        }
        throw new Error(data.error);
      }
      setScanResult(data as ScanResult);
      await loadQueue();
      onPendingChanged();
      onContactsChanged();
      setPhase((data.queued ?? 0) === 0 ? "done" : "review");
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e));
      setPhase("config");
    }
  };

  const handleApprove = async (overrides: { id: string; orgId: string; name: string; email: string; company: string | null; title: string | null; phone: string | null; linkedin_url: string | null }) => {
    setBusyIds((s) => new Set(s).add(overrides.id));
    try {
      const { data, error } = await supabase.functions.invoke("contact-review-action", {
        body: { action: "approve", ...overrides },
      });
      if (error || data?.error) throw new Error(error?.message ?? data.error);
      setQueue((q) => q.filter((r) => r.id !== overrides.id));
      onContactsChanged();
      onPendingChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add contact");
    } finally {
      setBusyIds((s) => { const n = new Set(s); n.delete(overrides.id); return n; });
    }
  };

  const handleSkip = async (id: string) => {
    setBusyIds((s) => new Set(s).add(id));
    try {
      await supabase.functions.invoke("contact-review-action", { body: { action: "skip", id } });
      setQueue((q) => q.filter((r) => r.id !== id));
      onPendingChanged();
    } finally {
      setBusyIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const handleApproveAll = async () => {
    const items = filtered
      .filter((r) => r.suggested_org_id)
      .map((r) => ({
        id: r.id,
        orgId: r.suggested_org_id!,
        name: r.name ?? r.email,
        email: r.email,
        company: r.company,
        title: r.title,
        phone: r.phone,
        linkedin_url: r.linkedin_url,
      }));
    if (items.length === 0) {
      toast.error("Pick an org for each contact first, or assign suggestions before bulk-adding.");
      return;
    }
    setBulkBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("contact-review-action", {
        body: { action: "approve_bulk", items },
      });
      if (error) throw new Error(error.message);
      const approvedIds = new Set((data?.results ?? []).filter((r: any) => r.ok).map((r: any) => r.id));
      setQueue((q) => q.filter((r) => !approvedIds.has(r.id)));
      onContactsChanged();
      onPendingChanged();
      toast.success(`Added ${approvedIds.size} contact${approvedIds.size === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk approve failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleSkipAll = async () => {
    const ids = filtered.map((r) => r.id);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      await supabase.functions.invoke("contact-review-action", { body: { action: "skip_bulk", ids } });
      setQueue((q) => q.filter((r) => !ids.includes(r.id)));
      onPendingChanged();
    } finally {
      setBulkBusy(false);
    }
  };

  const filtered = useMemo(() => {
    if (filter === "high") return queue.filter((r) => r.confidence === "high");
    if (filter === "review") return queue.filter((r) => r.confidence !== "high");
    return queue;
  }, [queue, filter]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(2,2,10,0.55)", backdropFilter: "blur(4px)" }}
      />

      {/* Drawer */}
      <aside
        className="fixed right-0 top-0 z-50 h-full flex flex-col"
        style={{
          width: "min(680px, 100vw)",
          background: "rgba(8,8,18,0.92)",
          backdropFilter: "var(--blur-sidebar)",
          borderLeft: "1px solid var(--border-glass)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-glass)" }}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: "var(--text-accent)" }} />
            <Mail size={14} style={{ color: "var(--text-secondary)" }} />
            <h2 className="t-section" style={{ margin: 0 }}>Gmail Contact Agent</h2>
          </div>
          <button onClick={onClose} className="btn-icon" title="Close"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {phase === "config" && (
            <ConfigPanel
              days={days} setDays={setDays}
              minEmailCount={minEmailCount} setMinEmailCount={setMinEmailCount}
              defaultOrgId={defaultOrgId} setDefaultOrgId={setDefaultOrgId}
              orgs={orgs}
              onStart={startScan}
              error={scanError}
            />
          )}

          {phase === "scanning" && <ScanProgress days={days} />}

          {phase === "review" && (
            <ReviewQueue
              queue={queue}
              filtered={filtered}
              filter={filter}
              setFilter={setFilter}
              orgs={orgs}
              onApprove={handleApprove}
              onSkip={handleSkip}
              onApproveAll={handleApproveAll}
              onSkipAll={handleSkipAll}
              busyIds={busyIds}
              bulkBusy={bulkBusy}
              addedSoFar={(scanResult?.queued ?? queue.length) - queue.length}
              total={scanResult?.queued ?? queue.length}
            />
          )}

          {phase === "done" && scanResult && (
            <CompletionSummary
              result={scanResult}
              onScanAgain={() => { setPhase("config"); setScanResult(null); }}
              onViewContacts={() => onClose()}
            />
          )}
        </div>
      </aside>
    </>
  );
};

// ----------------------------- Config Panel -----------------------------
interface ConfigProps {
  days: 7 | 30 | 90;
  setDays: (d: 7 | 30 | 90) => void;
  minEmailCount: 1 | 2 | 3;
  setMinEmailCount: (n: 1 | 2 | 3) => void;
  defaultOrgId: string;
  setDefaultOrgId: (s: string) => void;
  orgs: Org[];
  onStart: () => void;
  error: string | null;
}

const ConfigPanel = ({ days, setDays, minEmailCount, setMinEmailCount, defaultOrgId, setDefaultOrgId, orgs, onStart, error }: ConfigProps) => (
  <div className="flex flex-col gap-5">
    <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
      The agent scans your Gmail, extracts contact details from email signatures using AI, and queues new people for your review.
    </p>

    <div>
      <div className="t-mono mb-2">SCAN EMAILS FROM THE LAST</div>
      <div className="flex gap-2">
        {([7, 30, 90] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={days === d ? "btn-primary" : "btn-ghost"}
            style={{ height: 36, flex: 1 }}
          >
            {d} days
          </button>
        ))}
      </div>
    </div>

    <div>
      <div className="t-mono mb-2">MINIMUM EMAILS WITH THIS PERSON</div>
      <div className="flex gap-2">
        {([1, 2, 3] as const).map((n) => (
          <button
            key={n}
            onClick={() => setMinEmailCount(n)}
            className={minEmailCount === n ? "btn-primary" : "btn-ghost"}
            style={{ height: 36, flex: 1 }}
          >
            {n}{n === 3 ? "+" : ""}
          </button>
        ))}
      </div>
    </div>

    <div>
      <div className="t-mono mb-2">ASSIGN CONTACTS TO ORG</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setDefaultOrgId("")}
          className={defaultOrgId === "" ? "btn-primary" : "btn-ghost"}
          style={{ height: 36 }}
        >
          Let me choose
        </button>
        {orgs.map((o) => (
          <button
            key={o.id}
            onClick={() => setDefaultOrgId(o.id)}
            className={defaultOrgId === o.id ? "btn-primary" : "btn-ghost"}
            style={{ height: 36 }}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>

    {error && (
      <div className="glass" style={{ padding: 12, borderColor: "var(--sev-critical)", color: "var(--sev-critical)", fontSize: 12 }}>
        {error}
      </div>
    )}

    <button onClick={onStart} className="btn-primary" style={{ height: 44, fontSize: 13 }}>
      <Rocket size={14} /> Start Scan
    </button>
  </div>
);

// ----------------------------- Scan Progress -----------------------------
const ScanProgress = ({ days }: { days: number }) => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const steps = 4;
    const i = setInterval(() => setStep((s) => Math.min(s + 1, steps)), 1500);
    return () => clearInterval(i);
  }, []);
  const lines = [
    `🔍 Scanning your Gmail (last ${days} days)…`,
    "📬 Reading email threads",
    "🤖 Extracting contact details from signatures",
    "🔄 Deduplicating against existing contacts",
  ];
  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex items-center gap-3">
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-accent)" }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Working…</span>
      </div>

      <div className="glass" style={{ padding: 16 }}>
        <div className="flex flex-col gap-2.5">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2" style={{ fontSize: 13, color: i <= step ? "var(--text-primary)" : "var(--text-muted)" }}>
              {i < step ? <Check size={14} style={{ color: "var(--sev-success, #22C55E)" }} /> : i === step ? <Loader2 size={14} className="animate-spin" /> : <span style={{ width: 14 }} />}
              {l}
            </div>
          ))}
        </div>

        <div className="mt-4" style={{ height: 4, background: "var(--bg-glass-2)", borderRadius: 999, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              background: "linear-gradient(90deg, var(--text-accent), #6366F1)",
              width: `${Math.min((step + 1) * 25, 95)}%`,
              transition: "width 1.2s ease",
            }}
          />
        </div>
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5 }}>
        This may take up to 1–2 minutes for 30+ days of mail. Don't close this drawer.
      </p>
    </div>
  );
};

// ----------------------------- Review Queue -----------------------------
interface ReviewQueueProps {
  queue: QueueRow[];
  filtered: QueueRow[];
  filter: "all" | "high" | "review";
  setFilter: (f: "all" | "high" | "review") => void;
  orgs: Org[];
  onApprove: ConfigProps["onStart"] extends any ? any : never;
  onSkip: (id: string) => void;
  onApproveAll: () => void;
  onSkipAll: () => void;
  busyIds: Set<string>;
  bulkBusy: boolean;
  addedSoFar: number;
  total: number;
}

const ReviewQueue = (props: ReviewQueueProps) => {
  const { queue, filtered, filter, setFilter, orgs, onApprove, onSkip, onApproveAll, onSkipAll, busyIds, bulkBusy, addedSoFar, total } = props;
  const counts = {
    all: queue.length,
    high: queue.filter((r) => r.confidence === "high").length,
    review: queue.filter((r) => r.confidence !== "high").length,
  };

  if (queue.length === 0) {
    return (
      <div className="glass flex flex-col items-center justify-center text-center py-10" style={{ color: "var(--text-muted)" }}>
        <Check size={28} style={{ color: "var(--sev-success, #22C55E)" }} />
        <p className="mt-3" style={{ fontSize: 13 }}>All caught up — no pending contacts.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="t-section" style={{ margin: 0, fontSize: 16 }}>
          ✨ Found {total > 0 ? total : queue.length} contact{queue.length === 1 ? "" : "s"}
        </div>
        <div className="t-mono">{addedSoFar > 0 ? `Added ${addedSoFar} · ${queue.length} remaining` : `${queue.length} to review`}</div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onApproveAll} disabled={bulkBusy} className="btn-primary" style={{ height: 30, fontSize: 11 }}>
          {bulkBusy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Approve all w/ org
        </button>
        <button onClick={onSkipAll} disabled={bulkBusy} className="btn-ghost" style={{ height: 30, fontSize: 11 }}>
          Skip all
        </button>
        <div className="flex-1" />
        {(["all", "high", "review"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? "btn-primary" : "btn-ghost"}
            style={{ height: 28, fontSize: 11, padding: "0 10px" }}
          >
            {f === "all" ? `All ${counts.all}` : f === "high" ? `High ${counts.high}` : `Review ${counts.review}`}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {filtered.map((row) => (
          <DiscoveredContactCard
            key={row.id}
            row={row}
            orgs={orgs}
            onApprove={onApprove}
            onSkip={onSkip}
            busy={busyIds.has(row.id)}
          />
        ))}
      </div>
    </div>
  );
};

// ----------------------------- Completion -----------------------------
const CompletionSummary = ({ result, onScanAgain, onViewContacts }: { result: ScanResult; onScanAgain: () => void; onViewContacts: () => void }) => (
  <div className="flex flex-col gap-4 py-6">
    <div className="flex flex-col items-center text-center py-4">
      <div
        className="flex items-center justify-center mb-3"
        style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(34,197,94,0.15)", color: "#22C55E" }}
      >
        <Check size={28} />
      </div>
      <h3 className="t-section" style={{ margin: 0 }}>Contact sync complete</h3>
    </div>

    <div className="glass" style={{ padding: 16 }}>
      <Row label="Threads scanned" value={result.threadsScanned} />
      <Row label="Unique senders" value={result.uniqueSenders} />
      <Row label="New contacts queued" value={result.queued} accent />
      <Row label="Existing contacts refreshed" value={result.updatedExisting} />
    </div>

    <div className="flex gap-2">
      <button onClick={onViewContacts} className="btn-primary" style={{ flex: 1, height: 38 }}>
        <ListChecks size={13} /> View contacts
      </button>
      <button onClick={onScanAgain} className="btn-ghost" style={{ flex: 1, height: 38 }}>
        <RefreshCw size={13} /> Run again
      </button>
    </div>
  </div>
);

const Row = ({ label, value, accent }: { label: string; value: number; accent?: boolean }) => (
  <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--border-glass)" }}>
    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
    <span style={{ fontSize: 16, fontWeight: 700, color: accent ? "var(--text-accent)" : "var(--text-primary)" }}>{value}</span>
  </div>
);
