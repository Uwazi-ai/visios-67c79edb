// AI Settings + Training wizard
import { useEffect, useState } from "react";
import { Sparkles, ChevronLeft, ChevronRight, Check, Upload, Loader2, ThumbsUp, ThumbsDown, Plus, Trash2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { extractText } from "@/lib/docExtract";
import { callClaude } from "@/lib/claudeStream";
import { buildSystemPrompt } from "@/lib/aiPrompt";
import { toast } from "@/hooks/use-toast";

type TrainingRow = {
  writing_style: string;
  signature_style: string;
  response_length: string;
  never_say: string;
  sample_emails: string[];
  org_context: Record<string, string>;
  workflow_notes: { partnerships?: string; followup?: string; sla?: string; templates?: string };
  canned_responses: { title: string; body: string }[];
};

const STEPS = ["Voice", "Companies", "Workflows", "Knowledge", "Test"];

export default function AISettings() {
  const { user } = useAuth();
  const { orgs } = useOrg();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [t, setT] = useState<TrainingRow>({
    writing_style: "semi-formal",
    signature_style: "first_name",
    response_length: "standard",
    never_say: "",
    sample_emails: [],
    org_context: {},
    workflow_notes: {},
    canned_responses: [],
  });

  // Anthropic key state
  const [anthropicKey, setAnthropicKey] = useState("");
  const [keyVerified, setKeyVerified] = useState(false);
  const [verifyingKey, setVerifyingKey] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: training }, { data: profile }] = await Promise.all([
        supabase.from("ai_training").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("ai_prefs").eq("id", user.id).maybeSingle(),
      ]);
      if (training) {
        setT({
          writing_style: training.writing_style ?? "semi-formal",
          signature_style: training.signature_style ?? "first_name",
          response_length: training.response_length ?? "standard",
          never_say: training.never_say ?? "",
          sample_emails: (training.sample_emails as any) ?? [],
          org_context: (training.org_context as any) ?? {},
          workflow_notes: (training.workflow_notes as any) ?? {},
          canned_responses: (training.canned_responses as any) ?? [],
        });
      }
      const prefs = (profile?.ai_prefs ?? {}) as any;
      if (prefs.anthropic_verified_at) setKeyVerified(true);
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("ai_training").upsert({
      user_id: user.id,
      writing_style: t.writing_style,
      signature_style: t.signature_style,
      response_length: t.response_length,
      never_say: t.never_say,
      sample_emails: t.sample_emails,
      org_context: t.org_context,
      workflow_notes: t.workflow_notes,
      canned_responses: t.canned_responses,
    }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Training saved" });
  };

  const verifyKey = async () => {
    if (!anthropicKey) return;
    setVerifyingKey(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-verify-anthropic", {
        body: { api_key: anthropicKey },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setKeyVerified(true);
      setAnthropicKey("");
      toast({ title: "Anthropic key verified", description: "Vision is ready." });
    } catch (e: any) {
      toast({ title: "Key invalid", description: e.message, variant: "destructive" });
    } finally {
      setVerifyingKey(false);
    }
  };

  if (loading) return <div className="t-mono text-xs">LOADING<span className="slash">/</span>TRAINING</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="t-section flex items-center gap-2"><Sparkles size={20} /> AI Assistant</h1>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Train Visi to know your voice, your business, and your workflows.</p>
        </div>
      </div>

      {/* Anthropic Key panel */}
      <div className="glass p-4">
        <div className="flex items-start gap-3">
          <KeyRound size={16} className="mt-1 text-amber-300" />
          <div className="flex-1">
            <div className="t-card-title">Anthropic API Key</div>
            <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
              Vision uses Claude. Get a key at console.anthropic.com → API Keys.
            </div>
            {keyVerified ? (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-300">
                <Check size={12} /> Key verified
                <button onClick={() => setKeyVerified(false)} className="ml-2 underline opacity-70">Replace</button>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <input className="input-glass flex-1" placeholder="sk-ant-..." type="password" value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} />
                <button onClick={verifyKey} disabled={!anthropicKey || verifyingKey} className="btn-primary flex items-center gap-2">
                  {verifyingKey && <Loader2 size={12} className="animate-spin" />} Verify
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="glass p-4">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: i <= step ? "linear-gradient(135deg, hsl(217,91%,60%), hsl(258,90%,66%))" : "var(--bg-glass-2)",
                    color: i <= step ? "white" : "var(--text-tertiary)",
                    border: "1px solid " + (i <= step ? "transparent" : "var(--border-glass)"),
                  }}
                >
                  {i < step ? <Check size={12} /> : i + 1}
                </div>
                <div className="text-[10px] mt-1" style={{ color: i === step ? "var(--text-primary)" : "var(--text-tertiary)" }}>{label}</div>
              </div>
              {i < STEPS.length - 1 && <div className="flex-1 h-px mx-2" style={{ background: "var(--border-glass)" }} />}
            </div>
          ))}
        </div>
      </div>

      {step === 0 && <Step1Voice t={t} setT={setT} />}
      {step === 1 && <Step2Companies t={t} setT={setT} orgs={orgs} />}
      {step === 2 && <Step3Workflows t={t} setT={setT} />}
      {step === 3 && <Step4KB />}
      {step === 4 && <Step5Test t={t} />}

      <div className="flex items-center justify-between">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="btn-ghost flex items-center gap-1 disabled:opacity-30">
          <ChevronLeft size={14} /> Back
        </button>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="btn-ghost flex items-center gap-2">
            {saving && <Loader2 size={12} className="animate-spin" />} Save
          </button>
          <button
            onClick={() => { save(); setStep((s) => Math.min(STEPS.length - 1, s + 1)); }}
            className="btn-primary flex items-center gap-1"
          >
            {step === STEPS.length - 1 ? "Finish" : "Next"} <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

const Step1Voice = ({ t, setT }: { t: TrainingRow; setT: (r: TrainingRow) => void }) => (
  <div className="glass p-5 space-y-4">
    <h2 className="t-card-title">Your Voice</h2>
    <Radio label="Writing style" value={t.writing_style} onChange={(v) => setT({ ...t, writing_style: v })} options={[["formal", "Formal"], ["semi-formal", "Semi-formal"], ["casual", "Casual"]]} />
    <Radio label="Signature" value={t.signature_style} onChange={(v) => setT({ ...t, signature_style: v })} options={[["first_name", "First name"], ["full_name", "Full name"], ["name_title", "Name + Title"]]} />
    <Radio label="Response length" value={t.response_length} onChange={(v) => setT({ ...t, response_length: v })} options={[["brief", "Brief"], ["standard", "Standard"], ["detailed", "Detailed"]]} />
    <label className="block">
      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Things I never say (one per line)</span>
      <textarea className="input-glass w-full mt-1" rows={3} value={t.never_say} onChange={(e) => setT({ ...t, never_say: e.target.value })} placeholder="I hope this email finds you well&#10;Just circling back" />
    </label>
    <div>
      <div className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>Sample emails (paste up to 5 — AI will mirror your patterns)</div>
      {t.sample_emails.map((s, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <textarea className="input-glass flex-1" rows={3} value={s} onChange={(e) => {
            const next = [...t.sample_emails]; next[i] = e.target.value; setT({ ...t, sample_emails: next });
          }} />
          <button onClick={() => setT({ ...t, sample_emails: t.sample_emails.filter((_, idx) => idx !== i) })} className="btn-icon" style={{ width: 28, height: 28 }}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      {t.sample_emails.length < 5 && (
        <button onClick={() => setT({ ...t, sample_emails: [...t.sample_emails, ""] })} className="btn-ghost flex items-center gap-1 text-xs">
          <Plus size={12} /> Add sample
        </button>
      )}
    </div>
  </div>
);

const Step2Companies = ({ t, setT, orgs }: { t: TrainingRow; setT: (r: TrainingRow) => void; orgs: any[] }) => (
  <div className="glass p-5 space-y-4">
    <h2 className="t-card-title">Your Companies</h2>
    {orgs.length === 0 && <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>No orgs yet. Add via Settings → Orgs.</div>}
    {orgs.map((o) => (
      <div key={o.id} className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="org-pill" style={{ background: `${o.color}22`, color: o.color, border: `1px solid ${o.color}44` }}>{o.name}</span>
        </div>
        <textarea
          className="input-glass w-full"
          rows={4}
          placeholder={`What does ${o.name} do? Who does it serve? Top 3 priorities this quarter? What does success look like?`}
          value={t.org_context[o.slug] ?? ""}
          onChange={(e) => setT({ ...t, org_context: { ...t.org_context, [o.slug]: e.target.value } })}
        />
      </div>
    ))}
  </div>
);

const Step3Workflows = ({ t, setT }: { t: TrainingRow; setT: (r: TrainingRow) => void }) => (
  <div className="glass p-5 space-y-4">
    <h2 className="t-card-title">Your Workflows</h2>
    <Field label="How do you handle new partnership inquiries?" value={t.workflow_notes.partnerships ?? ""} onChange={(v) => setT({ ...t, workflow_notes: { ...t.workflow_notes, partnerships: v } })} />
    <Field label="How do you follow up after meetings?" value={t.workflow_notes.followup ?? ""} onChange={(v) => setT({ ...t, workflow_notes: { ...t.workflow_notes, followup: v } })} />
    <Radio
      label="Email response SLA"
      value={t.workflow_notes.sla ?? "24h"}
      onChange={(v) => setT({ ...t, workflow_notes: { ...t.workflow_notes, sla: v } })}
      options={[["same_day", "Same day"], ["24h", "24h"], ["48h", "48h"]]}
    />
    <Field label="Canned responses / templates you reuse" value={t.workflow_notes.templates ?? ""} onChange={(v) => setT({ ...t, workflow_notes: { ...t.workflow_notes, templates: v } })} multiline rows={4} />
  </div>
);

const Step4KB = () => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleFiles = async (files: FileList | null) => {
    if (!files || !user) return;
    const arr = Array.from(files).slice(0, 10);
    setBusy(true);
    setProgress({ current: 0, total: arr.length });
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      try {
        const { text, type } = await extractText(file);
        const path = `${user.id}/${Date.now()}-${file.name}`;
        await supabase.storage.from("knowledge-base").upload(path, file);
        const { data: doc } = await supabase.from("kb_documents").insert({
          user_id: user.id,
          title: file.name,
          category: "Training",
          source_type: "upload",
          file_path: path,
          file_type: type,
          status: "processing",
        }).select().single();
        if (doc) {
          await supabase.functions.invoke("kb-process-document", { body: { document_id: doc.id, text } });
        }
      } catch (e: any) {
        toast({ title: `Failed: ${file.name}`, description: e.message, variant: "destructive" });
      }
      setProgress({ current: i + 1, total: arr.length });
    }
    setBusy(false);
    toast({ title: "Knowledge base updated", description: `${arr.length} files processed` });
  };

  return (
    <div className="glass p-5 space-y-4">
      <h2 className="t-card-title">Quick Knowledge Upload</h2>
      <div
        className="rounded-xl p-8 text-center cursor-pointer"
        style={{ border: "1px dashed var(--border-glass)", background: "var(--bg-glass-1)" }}
        onClick={() => document.getElementById("kb-multi")?.click()}
      >
        <Upload size={20} className="mx-auto mb-2" style={{ color: "var(--text-tertiary)" }} />
        <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Drop or click to upload (up to 10 files)</div>
        <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>PDF, DOCX, TXT, MD</div>
        <input id="kb-multi" type="file" multiple accept=".pdf,.docx,.txt,.md" hidden onChange={(e) => handleFiles(e.target.files)} />
      </div>
      {busy && (
        <div className="text-xs flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
          <Loader2 size={12} className="animate-spin" /> Processing {progress.current} of {progress.total}...
        </div>
      )}
    </div>
  );
};

const Step5Test = ({ t }: { t: TrainingRow }) => {
  const [prompt, setPrompt] = useState("Draft a quick email introducing me to a new partner.");
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);

  const test = async () => {
    setBusy(true);
    setResponse("");
    try {
      const ctx: any = {
        today: new Date().toISOString(),
        training: t,
      };
      const system = buildSystemPrompt("writer", ctx);
      const text = await callClaude({ system, messages: [{ role: "user", content: prompt }] });
      setResponse(text);
    } catch (e: any) {
      setResponse(`⚠️ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass p-5 space-y-4">
      <h2 className="t-card-title">Test Visi</h2>
      <textarea className="input-glass w-full" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <button onClick={test} disabled={busy} className="btn-primary flex items-center gap-2">
        {busy && <Loader2 size={12} className="animate-spin" />} Run test
      </button>
      {response && (
        <div>
          <div className="rounded-lg p-4 whitespace-pre-wrap text-sm" style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)", color: "var(--text-primary)" }}>
            {response}
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => toast({ title: "Marked good" })} className="btn-ghost flex items-center gap-1 text-xs"><ThumbsUp size={12} /> Good</button>
            <button onClick={() => toast({ title: "Logged for tuning" })} className="btn-ghost flex items-center gap-1 text-xs"><ThumbsDown size={12} /> Needs work</button>
          </div>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, value, onChange, multiline = true, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; rows?: number }) => (
  <label className="block">
    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{label}</span>
    {multiline
      ? <textarea className="input-glass w-full mt-1" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      : <input className="input-glass w-full mt-1" value={value} onChange={(e) => onChange(e.target.value)} />}
  </label>
);

const Radio = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) => (
  <div>
    <div className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>{label}</div>
    <div className="flex gap-1.5 flex-wrap">
      {options.map(([v, l]) => {
        const active = v === value;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className="px-3 py-1.5 rounded-full text-xs"
            style={{
              background: active ? "linear-gradient(135deg, hsl(217,91%,60%), hsl(258,90%,66%))" : "var(--bg-glass-1)",
              color: active ? "white" : "var(--text-secondary)",
              border: "1px solid " + (active ? "transparent" : "var(--border-glass)"),
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  </div>
);
