import { useEffect, useState } from "react";
import { Search, Plus, Loader2, X, Sparkles, FileText, Kanban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { callClaude } from "@/lib/claudeStream";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";

const ORG_CONTEXT = `UWAZI.AI is a civic intelligence PBC based in Kansas City, MO.
Products:
- Ask UWAZI: voter guide AI
- UWAZI Engage: SMS civic surveys
- Jamii: B2G civic platform
Traction: 200 beta users, 800 waitlist, one B2G LOI.
Mission: making civic information accessible to underserved communities.`;

const FOCUS_AREAS = ["Any", "Civic Tech", "Voter Engagement", "Democracy", "AI for Good", "Community Engagement", "Local Government", "Underserved Communities"];
const FUNDER_TYPES = ["Any", "Foundation", "Government", "Corporate", "Family Office", "Community Foundation"];
const AWARD_SIZES = ["Any", "<$25k", "$25k-$100k", "$100k-$500k", "$500k-$1M", ">$1M"];
const SECTIONS = ["Executive Summary", "Problem Statement", "Project Description", "Goals & Objectives", "Target Population", "Impact & Evaluation", "Timeline", "Budget Narrative"];
const TONES = ["Formal & Academic", "Mission-Driven & Inspirational", "Data-Driven & Pragmatic", "Conversational & Direct"];
const STAGES = ["identified", "drafting", "submitted", "awarded", "rejected"] as const;
const STAGE_LABELS: Record<string, string> = { identified: "Identified", drafting: "Drafting", submitted: "Submitted", awarded: "Awarded", rejected: "Rejected" };
const STAGE_COLORS: Record<string, string> = { identified: "#60A5FA", drafting: "#F59E0B", submitted: "#A78BFA", awarded: "#22C55E", rejected: "#EF4444" };

interface GrantOpp {
  id: string; name: string; funder: string;
  amount_min?: number | null; amount_max?: number | null;
  deadline?: string | null; funder_type?: string | null;
  focus_area?: string | null; alignment?: string | null;
  description?: string | null; url?: string | null;
  status?: string | null; notes?: string | null;
}

interface GrantProposal {
  id: string; grant_name: string; funder: string;
  amount_requested?: string | null; deadline?: string | null;
  project_focus?: string | null; tone?: string | null;
  sections_generated?: string[] | null; full_text: string;
  status?: string | null; opportunity_id?: string | null;
}

interface ProposalDraft {
  grant_name: string; funder: string; amount: string; deadline: string;
  description: string; project_focus: string;
  sections: Record<string, boolean>; tone: string;
}

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(37,99,235,0.2)",
  borderRadius: 14,
  backdropFilter: "blur(12px)",
};

const badgeStyle = (color: string): React.CSSProperties => ({
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 10, padding: "3px 8px", borderRadius: 6,
  background: `${color}1f`, color, border: `1px solid ${color}40`,
  textTransform: "uppercase", letterSpacing: "0.06em",
});

function formatAmount(min?: number | null, max?: number | null) {
  if (!min && !max) return "Amount TBD";
  const f = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
  if (min && max) return `${f(min)}-${f(max)}`;
  return f((min || max) as number);
}

export default function Grants() {
  const [tab, setTab] = useState("find");
  const [draft, setDraft] = useState<ProposalDraft>({
    grant_name: "", funder: "", amount: "", deadline: "",
    description: "", project_focus: "",
    sections: Object.fromEntries(SECTIONS.map((s) => [s, true])),
    tone: TONES[1],
  });

  return (
    <div style={{ background: "#02020A", minHeight: "100vh", padding: "32px 28px" }}>
      <header className="mb-6">
        <h1 style={{ fontFamily: "Monument Grotesk, sans-serif", fontSize: 32, fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>
          Grant Writer Agent
        </h1>
        <p style={{ fontFamily: "Satoshi, sans-serif", color: "rgba(255,255,255,0.55)", fontSize: 14, marginTop: 6 }}>
          Find, draft, and track grants for UWAZI.AI
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(37,99,235,0.2)" }}>
          <TabsTrigger value="find"><Search size={14} className="mr-2" />Find Grants</TabsTrigger>
          <TabsTrigger value="write"><FileText size={14} className="mr-2" />Write Proposal</TabsTrigger>
          <TabsTrigger value="pipeline"><Kanban size={14} className="mr-2" />Pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value="find" className="mt-6">
          <FindGrants onWrite={(opp) => {
            setDraft({
              grant_name: opp.name,
              funder: opp.funder,
              amount: formatAmount(opp.amount_min, opp.amount_max),
              deadline: opp.deadline ?? "",
              description: opp.description ?? "",
              project_focus: "",
              sections: Object.fromEntries(SECTIONS.map((s) => [s, true])),
              tone: TONES[1],
            });
            setTab("write");
          }} />
        </TabsContent>

        <TabsContent value="write" className="mt-6">
          <WriteProposal draft={draft} setDraft={setDraft} />
        </TabsContent>

        <TabsContent value="pipeline" className="mt-6">
          <Pipeline />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- TAB 1: FIND ---------------- */
function FindGrants({ onWrite }: { onWrite: (o: GrantOpp) => void }) {
  const [focus, setFocus] = useState(FOCUS_AREAS[0]);
  const [funder, setFunder] = useState(FUNDER_TYPES[0]);
  const [size, setSize] = useState(AWARD_SIZES[0]);
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GrantOpp[]>([]);

  useEffect(() => {
    supabase.from("grant_opportunities").select("*").order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => { if (data) setResults(data as GrantOpp[]); });
  }, []);

  async function search() {
    setLoading(true);
    try {
      const system = `You are a grant research analyst. Org context: ${ORG_CONTEXT}\n\nReturn ONLY valid JSON: an array of 6-10 grant opportunities relevant to the filters. Each object: { "name": string, "funder": string, "funder_type": string, "amount_min": number, "amount_max": number, "deadline": string (YYYY-MM-DD or "Rolling"), "focus_area": string, "alignment": "high"|"medium"|"low", "description": string (2-3 sentences), "url": string, "fit_score": number 0-100 }. No markdown, no preamble.`;
      const user = `Find real grant opportunities matching:\n- Focus Area: ${focus}\n- Funder Type: ${funder}\n- Award Size: ${size}\n- Keywords: ${keywords || "none"}\n\nFocus on grants UWAZI.AI could realistically win.`;
      const text = await callClaude({ system, messages: [{ role: "user", content: user }], maxTokens: 3000 });
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Could not parse response");
      const parsed = JSON.parse(jsonMatch[0]);
      const mapped: GrantOpp[] = parsed.map((p: any) => ({
        id: crypto.randomUUID(),
        name: p.name, funder: p.funder, funder_type: p.funder_type,
        amount_min: p.amount_min, amount_max: p.amount_max,
        deadline: p.deadline, focus_area: p.focus_area, alignment: p.alignment,
        description: p.description, url: p.url,
        notes: p.fit_score ? `Fit: ${p.fit_score}` : null,
      }));
      setResults(mapped);
      // Persist to grant_opportunities
      await supabase.from("grant_opportunities").insert(mapped.map(m => ({
        name: m.name, funder: m.funder, funder_type: m.funder_type,
        amount_min: m.amount_min, amount_max: m.amount_max,
        deadline: m.deadline && m.deadline !== "Rolling" ? m.deadline : null,
        focus_area: m.focus_area, alignment: m.alignment,
        description: m.description, url: m.url, status: "identified", notes: m.notes,
      })));
    } catch (e: any) {
      toast({ title: "Search failed", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <div>
      <div style={cardStyle} className="p-5 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <SelectField label="Focus Area" value={focus} onChange={setFocus} options={FOCUS_AREAS} />
          <SelectField label="Funder Type" value={funder} onChange={setFunder} options={FUNDER_TYPES} />
          <SelectField label="Award Size" value={size} onChange={setSize} options={AWARD_SIZES} />
          <div>
            <MonoLabel>Keywords</MonoLabel>
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="civic, AI, voter" className="bg-transparent border-white/10" />
          </div>
        </div>
        <Button onClick={search} disabled={loading} style={{ background: "#2563EB" }}>
          {loading ? <Loader2 className="animate-spin mr-2" size={14} /> : <Sparkles size={14} className="mr-2" />}
          Search Grants
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((r) => (
          <div key={r.id} style={cardStyle} className="p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 style={{ fontFamily: "Monument Grotesk", fontWeight: 700, fontSize: 16, color: "rgba(255,255,255,0.95)" }}>{r.name}</h3>
                <div style={{ fontFamily: "Satoshi", fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{r.funder}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <span style={badgeStyle("#22C55E")}>{formatAmount(r.amount_min, r.amount_max)}</span>
              {r.deadline && <span style={badgeStyle("#F59E0B")}>{r.deadline}</span>}
              {r.alignment && <span style={badgeStyle("#2563EB")}>Fit: {r.alignment}</span>}
            </div>
            <p style={{ fontFamily: "Satoshi", fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{r.description}</p>
            <Button onClick={() => onWrite(r)} size="sm" className="mt-4" style={{ background: "#2563EB" }}>
              Write Proposal →
            </Button>
          </div>
        ))}
        {results.length === 0 && !loading && (
          <div style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Satoshi" }}>No grants yet. Run a search to discover opportunities.</div>
        )}
      </div>
    </div>
  );
}

/* ---------------- TAB 2: WRITE ---------------- */
function WriteProposal({ draft, setDraft }: { draft: ProposalDraft; setDraft: (d: ProposalDraft) => void }) {
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [saving, setSaving] = useState(false);

  async function generate() {
    if (!draft.grant_name || !draft.funder) {
      toast({ title: "Missing fields", description: "Grant name and funder required", variant: "destructive" });
      return;
    }
    setLoading(true); setOutput("");
    try {
      const selected = Object.entries(draft.sections).filter(([, v]) => v).map(([k]) => k);
      const system = `You are a senior grant writer. Org context: ${ORG_CONTEXT}\n\nWrite a complete, compelling grant proposal. Use clear section headers (##). Tone: ${draft.tone}.`;
      const user = `Draft a proposal for:\n\nGrant: ${draft.grant_name}\nFunder: ${draft.funder}\nAmount: ${draft.amount}\nDeadline: ${draft.deadline}\n\nGrant Description: ${draft.description}\n\nProject Focus: ${draft.project_focus}\n\nInclude these sections in order: ${selected.join(", ")}`;
      const text = await callClaude({ system, messages: [{ role: "user", content: user }], maxTokens: 4000 });
      setOutput(text);
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function save() {
    if (!output) return;
    setSaving(true);
    try {
      const selected = Object.entries(draft.sections).filter(([, v]) => v).map(([k]) => k);
      const { error } = await supabase.from("grant_proposals").insert({
        grant_name: draft.grant_name, funder: draft.funder,
        amount_requested: draft.amount, deadline: draft.deadline,
        project_focus: draft.project_focus, tone: draft.tone,
        sections_generated: selected, full_text: output, status: "draft",
      });
      if (error) throw error;
      toast({ title: "Saved to pipeline" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div style={cardStyle} className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grant Name" value={draft.grant_name} onChange={(v) => setDraft({ ...draft, grant_name: v })} />
          <Field label="Funding Org" value={draft.funder} onChange={(v) => setDraft({ ...draft, funder: v })} />
          <Field label="Amount" value={draft.amount} onChange={(v) => setDraft({ ...draft, amount: v })} />
          <Field label="Deadline" value={draft.deadline} onChange={(v) => setDraft({ ...draft, deadline: v })} />
        </div>
        <div>
          <MonoLabel>Grant Description</MonoLabel>
          <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} className="bg-transparent border-white/10" />
        </div>
        <div>
          <MonoLabel>Project Focus</MonoLabel>
          <Textarea value={draft.project_focus} onChange={(e) => setDraft({ ...draft, project_focus: e.target.value })} rows={4} className="bg-transparent border-white/10" placeholder="What specifically will UWAZI.AI do with this grant?" />
        </div>
        <div>
          <MonoLabel>Sections to Include</MonoLabel>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {SECTIONS.map((s) => (
              <label key={s} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={draft.sections[s]} onCheckedChange={(c) => setDraft({ ...draft, sections: { ...draft.sections, [s]: !!c } })} />
                <span style={{ fontFamily: "Satoshi", fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{s}</span>
              </label>
            ))}
          </div>
        </div>
        <SelectField label="Tone" value={draft.tone} onChange={(v) => setDraft({ ...draft, tone: v })} options={TONES} />
        <Button onClick={generate} disabled={loading} className="w-full" style={{ background: "#2563EB" }}>
          {loading ? <Loader2 className="animate-spin mr-2" size={14} /> : <Sparkles size={14} className="mr-2" />}
          Generate Proposal
        </Button>
      </div>

      <div style={cardStyle} className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontFamily: "Monument Grotesk", fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>Output</h3>
          {output && (
            <Button onClick={save} disabled={saving} size="sm" style={{ background: "#22C55E" }}>
              {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
              Save to Pipeline
            </Button>
          )}
        </div>
        <Textarea value={output} onChange={(e) => setOutput(e.target.value)} rows={28}
          className="bg-transparent border-white/10 font-mono text-xs"
          placeholder="Generated proposal will appear here..." />
      </div>
    </div>
  );
}

/* ---------------- TAB 3: PIPELINE ---------------- */
function Pipeline() {
  const [proposals, setProposals] = useState<GrantProposal[]>([]);
  const [selected, setSelected] = useState<GrantProposal | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("grant_proposals").select("*").order("updated_at", { ascending: false });
    if (data) setProposals(data as GrantProposal[]);
  }
  useEffect(() => { load(); }, []);

  function stageOf(p: GrantProposal): string {
    const s = (p.status || "").toLowerCase();
    if (STAGES.includes(s as any)) return s;
    if (s === "draft") return "drafting";
    return "identified";
  }

  async function moveTo(id: string, stage: string) {
    await supabase.from("grant_proposals").update({ status: stage }).eq("id", id);
    await load();
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowAdd(true)} style={{ background: "#2563EB" }}>
          <Plus size={14} className="mr-2" />Add Opportunity
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {STAGES.map((stage) => {
          const items = proposals.filter((p) => stageOf(p) === stage);
          return (
            <div key={stage} style={cardStyle} className="p-3 min-h-[400px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragId) { moveTo(dragId, stage); setDragId(null); } }}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <span style={badgeStyle(STAGE_COLORS[stage])}>{STAGE_LABELS[stage]}</span>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((p) => (
                  <div key={p.id}
                    draggable
                    onDragStart={() => setDragId(p.id)}
                    onClick={() => setSelected(p)}
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 10, cursor: "pointer" }}
                  >
                    <div style={{ fontFamily: "Monument Grotesk", fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.95)" }}>{p.grant_name}</div>
                    <div style={{ fontFamily: "Satoshi", fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{p.funder}</div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {p.amount_requested && <span style={badgeStyle("#22C55E")}>{p.amount_requested}</span>}
                      {p.deadline && <span style={badgeStyle("#F59E0B")}>{p.deadline}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <SlidePanel onClose={() => setSelected(null)}>
          <h2 style={{ fontFamily: "Monument Grotesk", fontWeight: 700, fontSize: 22, color: "rgba(255,255,255,0.95)" }}>{selected.grant_name}</h2>
          <div style={{ fontFamily: "Satoshi", color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 4 }}>{selected.funder}</div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {selected.amount_requested && <span style={badgeStyle("#22C55E")}>{selected.amount_requested}</span>}
            {selected.deadline && <span style={badgeStyle("#F59E0B")}>{selected.deadline}</span>}
            <span style={badgeStyle(STAGE_COLORS[stageOf(selected)])}>{STAGE_LABELS[stageOf(selected)]}</span>
          </div>
          {selected.project_focus && (
            <div className="mt-5">
              <MonoLabel>Project Focus</MonoLabel>
              <p style={{ fontFamily: "Satoshi", fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>{selected.project_focus}</p>
            </div>
          )}
          <div className="mt-5">
            <MonoLabel>Proposal</MonoLabel>
            <pre style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "rgba(255,255,255,0.8)", whiteSpace: "pre-wrap", marginTop: 6, background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 8, maxHeight: 500, overflow: "auto" }}>{selected.full_text}</pre>
          </div>
          <div className="mt-5">
            <MonoLabel>Move to Stage</MonoLabel>
            <div className="flex gap-2 mt-2 flex-wrap">
              {STAGES.map((s) => (
                <button key={s} onClick={async () => { await moveTo(selected.id, s); setSelected({ ...selected, status: s }); }}
                  style={{ ...badgeStyle(STAGE_COLORS[s]), cursor: "pointer" }}>
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </SlidePanel>
      )}

      {showAdd && <AddOpportunityModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddOpportunityModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ grant_name: "", funder: "", amount_requested: "", deadline: "", project_focus: "" });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!form.grant_name || !form.funder) return;
    setSaving(true);
    const { error } = await supabase.from("grant_proposals").insert({
      ...form, full_text: "", status: "identified",
    });
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    onSaved();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div style={cardStyle} className="p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: "Monument Grotesk", fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>Add Opportunity</h3>
          <button onClick={onClose}><X size={18} color="rgba(255,255,255,0.6)" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Grant Name" value={form.grant_name} onChange={(v) => setForm({ ...form, grant_name: v })} />
          <Field label="Funder" value={form.funder} onChange={(v) => setForm({ ...form, funder: v })} />
          <Field label="Amount" value={form.amount_requested} onChange={(v) => setForm({ ...form, amount_requested: v })} />
          <Field label="Deadline" value={form.deadline} onChange={(v) => setForm({ ...form, deadline: v })} />
          <div>
            <MonoLabel>Project Focus</MonoLabel>
            <Textarea value={form.project_focus} onChange={(e) => setForm({ ...form, project_focus: e.target.value })} className="bg-transparent border-white/10" />
          </div>
          <Button onClick={save} disabled={saving} className="w-full" style={{ background: "#2563EB" }}>
            {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : null}Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function SlidePanel({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "min(640px, 100%)", background: "#0A0A18", borderLeft: "1px solid rgba(37,99,235,0.3)", padding: 28, overflowY: "auto" }}>
        <button onClick={onClose} className="mb-4"><X size={18} color="rgba(255,255,255,0.6)" /></button>
        {children}
      </div>
    </div>
  );
}

/* ---------------- shared bits ---------------- */
function MonoLabel({ children }: { children: React.ReactNode }) {
  return <Label style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{children}</Label>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <MonoLabel>{label}</MonoLabel>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent border-white/10" />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <MonoLabel>{label}</MonoLabel>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", height: 40, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.9)", padding: "0 12px", fontFamily: "Satoshi", fontSize: 14 }}>
        {options.map((o) => <option key={o} value={o} style={{ background: "#02020A" }}>{o}</option>)}
      </select>
    </div>
  );
}
