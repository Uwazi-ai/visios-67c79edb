import { useEffect, useMemo, useState } from "react";
import { BookOpen, Upload, Link as LinkIcon, Search, FileText, Trash2, X, AlertCircle, CheckCircle2, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { extractText } from "@/lib/docExtract";
import { toast } from "@/hooks/use-toast";

interface KbDoc {
  id: string;
  title: string;
  description: string | null;
  category: string;
  source_type: string;
  source_url: string | null;
  file_path: string | null;
  file_type: string | null;
  word_count: number | null;
  status: "processing" | "ready" | "error";
  org_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_CATEGORIES = [
  "All",
  "SOPs & Processes",
  "Pitches & Decks",
  "Brand & Voice",
  "Proposals & Templates",
  "Meeting Notes",
  "Training",
  "Case Studies",
];

export default function KnowledgePage() {
  const { user } = useAuth();
  const { activeOrgId, orgs } = useOrg();
  const [docs, setDocs] = useState<KbDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState("All");
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("kb_documents")
      .select("*")
      .order("created_at", { ascending: false });
    setDocs((data ?? []) as KbDoc[]);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  // Realtime updates so processing status flips to ready in UI
  useEffect(() => {
    const ch = supabase.channel("kb-docs")
      .on("postgres_changes", { event: "*", schema: "public", table: "kb_documents" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return docs.filter((d) => {
      if (activeCat !== "All" && d.category !== activeCat) return false;
      if (q && !(`${d.title} ${d.description ?? ""} ${d.category}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [docs, activeCat, search]);

  const customCats = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    docs.forEach((d) => set.add(d.category));
    return Array.from(set);
  }, [docs]);

  const handleDelete = async (doc: KbDoc) => {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    if (doc.file_path) {
      await supabase.storage.from("knowledge-base").remove([doc.file_path]);
    }
    await supabase.from("kb_documents").delete().eq("id", doc.id);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="t-section flex items-center gap-2"><BookOpen size={20} /> Knowledge Base</h1>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Searchable docs powering Visi AI's responses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowUrl(true)} className="btn-ghost flex items-center gap-2">
            <LinkIcon size={14} /> Add URL
          </button>
          <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2">
            <Upload size={14} /> Upload Document
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[180px_1fr] gap-6">
        <aside className="space-y-1">
          {customCats.map((cat) => {
            const count = cat === "All" ? docs.length : docs.filter((d) => d.category === cat).length;
            const active = cat === activeCat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition"
                style={{
                  background: active ? "var(--bg-glass-2)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  border: "1px solid " + (active ? "var(--border-glass)" : "transparent"),
                }}
              >
                <span className="truncate">{cat}</span>
                <span className="t-mono text-[10px]" style={{ color: "var(--text-tertiary)" }}>{count}</span>
              </button>
            );
          })}
        </aside>

        <div className="space-y-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
            <input
              className="input-glass w-full pl-9"
              placeholder="Search knowledge base..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="glass p-8 text-center">
              <BookOpen size={28} className="mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>No documents yet.</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Upload a doc or add a URL to get started.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((doc) => {
                const org = orgs.find((o) => o.id === doc.org_id);
                return (
                  <div key={doc.id} className="glass p-4 group relative">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(168,85,247,0.15)", color: "#C4B5FD" }}>
                        <FileText size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="t-card-title truncate">{doc.title}</div>
                        <div className="text-[11px] mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: "var(--text-tertiary)" }}>
                          <span>{doc.category}</span>
                          {org && (
                            <span className="org-pill" style={{ background: `${org.color}22`, color: org.color, border: `1px solid ${org.color}44` }}>
                              {org.name}
                            </span>
                          )}
                          {doc.word_count && <span>{doc.word_count.toLocaleString()} words</span>}
                        </div>
                        {doc.description && <div className="text-xs mt-2 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{doc.description}</div>}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <StatusBadge status={doc.status} error={doc.error_message} />
                      <button onClick={() => handleDelete(doc)} className="opacity-0 group-hover:opacity-100 transition btn-icon" style={{ width: 26, height: 26 }} title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onDone={refresh} />}
      {showUrl && <UrlModal onClose={() => setShowUrl(false)} onDone={refresh} />}
    </div>
  );
}

const StatusBadge = ({ status, error }: { status: string; error: string | null }) => {
  if (status === "ready") return <span className="badge inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 size={10} /> Ready</span>;
  if (status === "processing") return <span className="badge inline-flex items-center gap-1 text-blue-300"><Loader2 size={10} className="animate-spin" /> Processing</span>;
  return <span className="badge inline-flex items-center gap-1 text-red-300" title={error ?? ""}><AlertCircle size={10} /> Error</span>;
};

const UploadModal = ({ onClose, onDone }: { onClose: () => void; onDone: () => void }) => {
  const { user } = useAuth();
  const { activeOrgId, orgs } = useOrg();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("SOPs & Processes");
  const [orgId, setOrgId] = useState<string | "">(activeOrgId ?? "");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const handleUpload = async () => {
    if (!file || !user) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 50MB.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      // Extract text first (if extraction fails we don't bother uploading)
      const { text, type } = await extractText(file);

      // Upload file
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("knowledge-base").upload(path, file);
      if (upErr) throw upErr;

      // Create doc row
      const { data: doc, error: docErr } = await supabase.from("kb_documents").insert({
        user_id: user.id,
        org_id: orgId || null,
        title: title || file.name,
        description: description || null,
        category,
        source_type: "upload",
        file_path: path,
        file_type: type,
        status: "processing",
      }).select().single();
      if (docErr) throw docErr;

      // Process chunks
      const { error: procErr } = await supabase.functions.invoke("kb-process-document", {
        body: { document_id: doc.id, text },
      });
      if (procErr) throw procErr;

      toast({ title: "Document added", description: file.name });
      onDone();
      onClose();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Upload Document" onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>File (PDF, DOCX, TXT, MD — max 10MB)</span>
          <input type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full mt-1 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Title</span>
          <input className="input-glass w-full mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={file?.name ?? "Document title"} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Category</span>
            <select className="input-glass w-full mt-1" value={category} onChange={(e) => setCategory(e.target.value)}>
              {DEFAULT_CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Org</span>
            <select className="input-glass w-full mt-1" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">Personal</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Description (optional)</span>
          <textarea className="input-glass w-full mt-1" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost" disabled={busy}>Cancel</button>
          <button onClick={handleUpload} disabled={!file || busy} className="btn-primary flex items-center gap-2">
            {busy && <Loader2 size={14} className="animate-spin" />} Upload & Process
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const UrlModal = ({ onClose, onDone }: { onClose: () => void; onDone: () => void }) => {
  const { activeOrgId, orgs } = useOrg();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Case Studies");
  const [orgId, setOrgId] = useState<string | "">(activeOrgId ?? "");
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!url) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("kb-fetch-url", {
        body: { url, title, category, org_id: orgId || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "URL added", description: `${data.chunks ?? 0} chunks indexed` });
      onDone();
      onClose();
    } catch (e: any) {
      toast({ title: "Could not fetch URL", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Add URL" onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>URL</span>
          <input className="input-glass w-full mt-1" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article" />
        </label>
        <label className="block">
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Title (optional, will infer)</span>
          <input className="input-glass w-full mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Category</span>
            <select className="input-glass w-full mt-1" value={category} onChange={(e) => setCategory(e.target.value)}>
              {DEFAULT_CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Org</span>
            <select className="input-glass w-full mt-1" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">Personal</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost" disabled={busy}>Cancel</button>
          <button onClick={handleAdd} disabled={!url || busy} className="btn-primary flex items-center gap-2">
            {busy && <Loader2 size={14} className="animate-spin" />} Fetch & Index
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const ModalShell = ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
    <div className="glass w-full max-w-md p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="t-card-title">{title}</h2>
        <button onClick={onClose} className="btn-icon" style={{ width: 26, height: 26 }}><X size={12} /></button>
      </div>
      {children}
    </div>
  </div>
);
