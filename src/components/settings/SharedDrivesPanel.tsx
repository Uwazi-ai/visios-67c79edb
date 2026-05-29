import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "sonner";
import { HardDrive, X, Loader2, RefreshCw } from "lucide-react";
import { ORG_COLORS } from "@/lib/orgs";

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  shared_drive_id: string | null;
  shared_drive_name: string | null;
  shared_drive_connected_at: string | null;
}

interface SharedDrive {
  id: string;
  name: string;
  createdTime?: string;
}

export default function SharedDrivesPanel() {
  const { user } = useAuth();
  const { orgs } = useOrg();
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [browseFor, setBrowseFor] = useState<OrgRow | null>(null);
  const [drives, setDrives] = useState<SharedDrive[] | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const reload = async () => {
    if (!user) return;
    const orgIds = orgs.map((o) => o.id);
    if (!orgIds.length) { setRows([]); setLoading(false); return; }
    const { data } = await supabase
      .from("orgs")
      .select("id, name, slug, color, shared_drive_id, shared_drive_name, shared_drive_connected_at")
      .in("id", orgIds);
    setRows((data ?? []) as OrgRow[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [user, orgs]);

  const openBrowse = async (row: OrgRow) => {
    setBrowseFor(row);
    setDrives(null);
    setBrowseLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("drive-proxy", {
        body: { action: "drive_list_shared_drives" },
      });
      if (error) throw error;
      setDrives(data?.drives ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to list Shared Drives");
      setDrives([]);
    } finally {
      setBrowseLoading(false);
    }
  };

  const selectDrive = async (row: OrgRow, drive: SharedDrive) => {
    const { error } = await supabase
      .from("orgs")
      .update({
        shared_drive_id: drive.id,
        shared_drive_name: drive.name,
        shared_drive_connected_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success(`Linked "${drive.name}" to ${row.name}`);
    setBrowseFor(null);
    reload();
  };

  const saveManual = async (row: OrgRow, driveId: string) => {
    const id = driveId.trim();
    if (!id) return;
    const { error } = await supabase
      .from("orgs")
      .update({
        shared_drive_id: id,
        shared_drive_name: row.shared_drive_name ?? null,
        shared_drive_connected_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Saved Drive ID");
    reload();
  };

  const clear = async (row: OrgRow) => {
    const { error } = await supabase
      .from("orgs")
      .update({ shared_drive_id: null, shared_drive_name: null, shared_drive_connected_at: null })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Cleared");
    reload();
  };

  const testConn = async (row: OrgRow) => {
    if (!row.shared_drive_id) return;
    setTestingId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("drive-proxy", {
        body: { action: "drive_search", params: { driveId: row.shared_drive_id, query: "", maxResults: 5 } },
      });
      if (error) throw error;
      const count = (data?.files ?? []).length;
      toast.success(`Connected — found ${count} recent file${count === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Test failed");
    } finally {
      setTestingId(null);
    }
  };

  if (loading) return <div className="text-sm text-gray-400">Loading shared drives…</div>;
  if (!rows.length) return null;

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}>
      <div className="flex items-center gap-2 mb-1">
        <HardDrive size={16} className="text-[#a78bfa]" />
        <div className="text-sm font-medium text-white">Org Shared Drives</div>
      </div>
      <p className="text-xs text-gray-400 mb-4">Connect each org to its Google Shared Drive so Vision can reference files.</p>

      <div className="space-y-3">
        {rows.map((row) => {
          const color = ORG_COLORS[row.slug] ?? row.color ?? "#6366F1";
          const connected = !!row.shared_drive_id;
          return (
            <div key={row.id} className="rounded-lg p-3" style={{ background: "var(--bg-glass-2)", border: "1px solid var(--border-glass)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <div className="text-sm font-medium text-white">{row.name}</div>
                {connected ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "#86efac", border: "1px solid rgba(34,197,94,0.3)" }}>
                    Connected{row.shared_drive_name ? ` · ${row.shared_drive_name}` : ""}
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-500">Not connected</span>
                )}
              </div>

              <ManualIdInput
                key={(row.shared_drive_id ?? "") + row.id}
                initial={row.shared_drive_id ?? ""}
                onSave={(v) => saveManual(row, v)}
                onBrowse={() => openBrowse(row)}
              />

              <div className="flex gap-2 mt-2">
                {connected && (
                  <>
                    <button
                      onClick={() => testConn(row)}
                      className="text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1.5"
                      style={{ background: "var(--bg-glass-1)", color: "var(--text-secondary)", border: "1px solid var(--border-glass)" }}
                      disabled={testingId === row.id}
                    >
                      {testingId === row.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Test Connection
                    </button>
                    <button
                      onClick={() => clear(row)}
                      className="text-xs px-3 py-1.5 rounded-md"
                      style={{ background: "var(--bg-glass-1)", color: "#fca5a5", border: "1px solid var(--border-glass)" }}
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {browseFor && (
        <BrowseModal
          orgName={browseFor.name}
          drives={drives}
          loading={browseLoading}
          onClose={() => setBrowseFor(null)}
          onSelect={(d) => selectDrive(browseFor, d)}
        />
      )}
    </div>
  );
}

function ManualIdInput({ initial, onSave, onBrowse }: { initial: string; onSave: (v: string) => void; onBrowse: () => void }) {
  const [val, setVal] = useState(initial);
  return (
    <div className="flex gap-2">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Shared Drive ID (e.g. 0AHk9...)"
        className="flex-1 input-glass text-sm"
      />
      <button onClick={onBrowse} className="btn-ghost text-sm px-3">🔗 Browse</button>
      <button onClick={() => onSave(val)} className="btn-primary text-sm px-3" disabled={!val.trim() || val === initial}>
        Save
      </button>
    </div>
  );
}

function BrowseModal({
  orgName, drives, loading, onClose, onSelect,
}: {
  orgName: string;
  drives: SharedDrive[] | null;
  loading: boolean;
  onClose: () => void;
  onSelect: (d: SharedDrive) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl p-5"
        style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-medium text-white">Pick a Shared Drive</div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={16} /></button>
        </div>
        <div className="text-xs text-gray-400 mb-3">Linking to <span className="text-white">{orgName}</span></div>

        {loading && <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center"><Loader2 size={14} className="animate-spin" /> Loading…</div>}

        {!loading && drives && drives.length === 0 && (
          <div className="text-sm text-gray-400 py-4">
            No Shared Drives found for your Google account. Personal "My Drive" is not a Shared Drive.
          </div>
        )}

        {!loading && drives && drives.length > 0 && (
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {drives.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-md px-3 py-2"
                style={{ background: "var(--bg-glass-2)", border: "1px solid var(--border-glass)" }}
              >
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">📁 {d.name}</div>
                  <div className="text-[10px] text-gray-500 font-mono truncate">{d.id}</div>
                </div>
                <button onClick={() => onSelect(d)} className="btn-primary text-xs px-3 py-1.5">Select</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
