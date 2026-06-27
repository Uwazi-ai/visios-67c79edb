import { useEffect, useState } from "react";
import { Loader2, Save, Plus, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "sonner";
import { PERSONAS } from "@/lib/aiPersonas";
import SectionCard, { Field, ToggleRow } from "../SectionCard";
import { ensureIntegrationRow, savePreferences } from "@/lib/settingsHelpers";

const DATA_SOURCES = [
  { key: "google", sub: "gmail_enabled", label: "📧 Gmail" },
  { key: "google", sub: "calendar_enabled", label: "📅 Calendar" },
  { key: "google", sub: "drive_enabled", label: "📁 Google Drive" },
  { key: "contacts", label: "👥 Contacts" },
  { key: "tasks", label: "✅ Tasks" },
  { key: "slack", label: "💬 Slack" },
  { key: "kb", label: "📚 Knowledge Base" },
  { key: "jira", label: "🔧 Jira" },
  { key: "confluence", label: "📖 Confluence" },
];

export default function VisionAITab() {
  const { user } = useAuth();
  const { orgs } = useOrg();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<any>({});
  const [training, setTraining] = useState<any>({
    writing_style: "semi-formal", response_length: "standard", signature_style: "first_name",
    never_say: "", sample_emails: [] as string[], org_context: {} as Record<string, string>,
  });
  const [signatureName, setSignatureName] = useState("");
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [convoCount, setConvoCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: profile }, { data: train }, { data: ints }, { count: cc }, { count: mc }] = await Promise.all([
        supabase.from("profiles").select("preferences,display_name").eq("id", user.id).maybeSingle(),
        supabase.from("ai_training").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("integrations").select("*").eq("user_id", user.id),
        supabase.from("vision_conversations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("vision_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      setPrefs((profile as any)?.preferences ?? {});
      if (train) {
        setTraining({
          writing_style: train.writing_style ?? "semi-formal",
          response_length: train.response_length ?? "standard",
          signature_style: train.signature_style ?? "first_name",
          never_say: train.never_say ?? "",
          sample_emails: (train.sample_emails as any) ?? [],
          org_context: (train.org_context as any) ?? {},
        });
      }
      setSignatureName(((profile as any)?.preferences?.signature_name) ?? (profile as any)?.display_name ?? "");
      setIntegrations(ints ?? []);
      setConvoCount(cc ?? 0);
      setMsgCount(mc ?? 0);
      setLoading(false);
    })();
  }, [user]);

  const updPref = (patch: any) => {
    if (!user) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePreferences(user.id, prefs, patch);
  };

  const isSourceOn = (key: string, sub?: string) => {
    const row = integrations.find((i) => i.provider === key);
    if (!row) return ["contacts", "tasks", "kb"].includes(key);
    if (sub) return (row.metadata?.[sub] !== false) && row.vision_enabled;
    return row.vision_enabled;
  };

  const toggleSource = async (key: string, sub: string | undefined, value: boolean) => {
    if (!user) return;
    const row = await ensureIntegrationRow(user.id, key);
    if (!row) return;
    if (sub) {
      const newMeta = { ...((row.metadata as any) ?? {}), [sub]: value };
      await supabase.from("integrations").update({ metadata: newMeta, vision_enabled: true }).eq("id", row.id);
    } else {
      await supabase.from("integrations").update({ vision_enabled: value }).eq("id", row.id);
    }
    const { data: ints } = await supabase.from("integrations").select("*").eq("user_id", user.id);
    setIntegrations(ints ?? []);
  };

  const saveTraining = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("ai_training").upsert({
      user_id: user.id,
      writing_style: training.writing_style,
      response_length: training.response_length,
      signature_style: training.signature_style,
      never_say: training.never_say,
      sample_emails: training.sample_emails,
      org_context: training.org_context,
    } as never, { onConflict: "user_id" });
    if (signatureName !== (prefs.signature_name ?? "")) {
      await savePreferences(user.id, prefs, { signature_name: signatureName });
      setPrefs((p: any) => ({ ...p, signature_name: signatureName }));
    }
    setSaving(false);
    toast.success("Voice settings saved");
  };

  const clearConversations = async () => {
    if (!user) return;
    const txt = prompt('Type "CLEAR" to delete all Vision conversations.');
    if (txt !== "CLEAR") return;
    await supabase.from("vision_messages").delete().eq("user_id", user.id);
    await supabase.from("vision_conversations").delete().eq("user_id", user.id);
    setConvoCount(0); setMsgCount(0);
    toast.success("Conversations cleared");
  };

  if (loading) return <div className="glass flex items-center justify-center" style={{ minHeight: 200 }}><Loader2 className="animate-spin" size={18} /></div>;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Default Persona" subtitle="The persona Vision opens with on every new conversation.">
        <div className="grid grid-cols-2 gap-2">
          {PERSONAS.map((p) => {
            const active = (prefs.default_persona ?? "chief_of_staff") === p.key;
            return (
              <button key={p.key} onClick={() => updPref({ default_persona: p.key })} className="text-left p-3 rounded-lg transition-colors"
                style={{ background: active ? "var(--bg-glass-active)" : "var(--bg-glass-1)", border: `1px solid ${active ? "hsl(var(--primary))" : "var(--border-glass)"}` }}>
                <div className="flex items-center gap-2"><span>{p.emoji}</span><span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span></div>
                <div className="t-mono mt-1" style={{ fontSize: 10, color: "var(--text-muted)" }}>{p.shortLabel}</div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Vision Identity" subtitle="What your AI calls itself, how it sounds, and any custom persona instructions.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Display name" hint="The name Vision uses to refer to itself.">
            <input
              className="input-glass"
              value={prefs.vision_display_name ?? ""}
              placeholder="Vision"
              onChange={(e) => updPref({ vision_display_name: e.target.value })}
            />
          </Field>
          <Field label="Tone">
            <select
              className="input-glass"
              value={prefs.vision_tone ?? "direct"}
              onChange={(e) => updPref({ vision_tone: e.target.value })}
            >
              <option value="direct">Direct</option>
              <option value="formal">Formal</option>
              <option value="friendly">Friendly</option>
              <option value="casual">Casual</option>
              <option value="playful">Playful</option>
            </select>
          </Field>
        </div>
        <Field label="Custom persona" hint="Optional. Free-form instructions layered on top of the active persona.">
          <textarea
            className="input-glass"
            rows={3}
            placeholder="e.g. Speak like a no-nonsense Chief of Staff with a startup-operator mindset. Reference my OKRs when relevant."
            value={prefs.vision_persona_description ?? ""}
            onChange={(e) => updPref({ vision_persona_description: e.target.value })}
          />
        </Field>
      </SectionCard>

      <SectionCard title="Vision Data Access" subtitle="Toggle which sources Vision can read in every conversation.">
        {DATA_SOURCES.map((s) => (
          <ToggleRow key={`${s.key}-${s.sub ?? ""}`} label={s.label} value={isSourceOn(s.key, s.sub)} onChange={(v) => toggleSource(s.key, s.sub, v)} />
        ))}
      </SectionCard>

      <SectionCard title="Train Vision — Your Voice" subtitle="Vision uses these to draft emails and messages in your style.">
        <Field label="Writing style">
          <div className="flex gap-2">
            {(["formal", "semi-formal", "casual"] as const).map((s) => (
              <button key={s} onClick={() => setTraining((t: any) => ({ ...t, writing_style: s }))} className={training.writing_style === s ? "btn-primary" : "btn-ghost"} style={{ flex: 1, justifyContent: "center", textTransform: "capitalize" }}>{s}</button>
            ))}
          </div>
        </Field>
        <Field label="Email length">
          <div className="flex gap-2">
            {(["brief", "standard", "detailed"] as const).map((s) => (
              <button key={s} onClick={() => setTraining((t: any) => ({ ...t, response_length: s }))} className={training.response_length === s ? "btn-primary" : "btn-ghost"} style={{ flex: 1, justifyContent: "center", textTransform: "capitalize" }}>{s}</button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sign-off style">
            <select className="input-glass" value={training.signature_style} onChange={(e) => setTraining((t: any) => ({ ...t, signature_style: e.target.value }))}>
              <option value="first_name">First name</option>
              <option value="full_name">Full name</option>
              <option value="name_title">Name + title</option>
            </select>
          </Field>
          <Field label="Sign-off name"><input className="input-glass" value={signatureName} onChange={(e) => setSignatureName(e.target.value)} /></Field>
        </div>
        <Field label="Never say" hint="Phrases Vision should never use in drafts.">
          <textarea className="input-glass" rows={2} value={training.never_say} onChange={(e) => setTraining((t: any) => ({ ...t, never_say: e.target.value }))} />
        </Field>
        <Field label={`Sample emails (${training.sample_emails.length}/5)`}>
          <div className="flex flex-col gap-2">
            {training.sample_emails.map((s: string, i: number) => (
              <div key={i} className="flex gap-2">
                <textarea className="input-glass" rows={2} value={s} onChange={(e) => setTraining((t: any) => ({ ...t, sample_emails: t.sample_emails.map((x: string, j: number) => j === i ? e.target.value : x) }))} />
                <button onClick={() => setTraining((t: any) => ({ ...t, sample_emails: t.sample_emails.filter((_: any, j: number) => j !== i) }))} className="btn-icon"><Trash2 size={12} /></button>
              </div>
            ))}
            {training.sample_emails.length < 5 && (
              <button onClick={() => setTraining((t: any) => ({ ...t, sample_emails: [...t.sample_emails, ""] }))} className="btn-ghost" style={{ alignSelf: "start" }}><Plus size={12} /> Add Sample</button>
            )}
          </div>
        </Field>
        <div className="flex justify-end pt-2">
          <button onClick={saveTraining} className="btn-primary" disabled={saving}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Voice Settings
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Train Vision — Business Context" subtitle="Vision reads these per-org for context-aware reasoning.">
        {orgs.map((o) => (
          <Field key={o.id} label={`${o.name} context`}>
            <textarea className="input-glass" rows={3} value={training.org_context[o.id] ?? ""} onChange={(e) => setTraining((t: any) => ({ ...t, org_context: { ...t.org_context, [o.id]: e.target.value } }))} />
          </Field>
        ))}
        <div className="flex justify-end pt-2">
          <button onClick={saveTraining} className="btn-primary" disabled={saving}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Business Context
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Morning Brief" subtitle="What Vision shows on dashboard load each morning.">
        <ToggleRow label="Auto-generate on dashboard load" value={prefs.brief_auto !== false} onChange={(v) => updPref({ brief_auto: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brief time" hint="Auto-generated within a 3-hour window starting at this time.">
            <select className="input-glass" value={prefs.brief_time ?? "07:00"} onChange={(e) => updPref({ brief_time: e.target.value })}>
              {["05:00","05:30","06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30","10:00"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Delivery">
            <div className="flex flex-col gap-1">
              <ToggleRow label="Post brief to #dailyreports" value={prefs.brief_to_channel === true} onChange={(v) => updPref({ brief_to_channel: v })} />
              <ToggleRow label="Email brief to my inbox" value={prefs.brief_to_inbox === true} onChange={(v) => updPref({ brief_to_inbox: v })} />
            </div>
          </Field>
        </div>
        <Field label="Cache duration">
          <select className="input-glass" value={prefs.brief_cache ?? "4"} onChange={(e) => updPref({ brief_cache: e.target.value })}>
            <option value="1">1 hour</option><option value="4">4 hours</option><option value="12">12 hours</option>
          </select>
        </Field>
        <Field label="Length">
          <div className="flex gap-2">
            {(["concise", "standard", "detailed"] as const).map((t) => (
              <button key={t} onClick={() => updPref({ brief_length: t })} className={(prefs.brief_length ?? "standard") === t ? "btn-primary" : "btn-ghost"} style={{ flex: 1, justifyContent: "center", textTransform: "capitalize" }}>{t}</button>
            ))}
          </div>
        </Field>
        <Field label="Include in brief">
          <div className="grid grid-cols-2 gap-1">
            {[
              { k: "calendar", label: "Today's calendar" },
              { k: "emails", label: "Important emails" },
              { k: "tasks", label: "Open tasks" },
              { k: "stale_contacts", label: "Stale contacts" },
              { k: "first_action", label: "First action recommendation" },
            ].map((opt) => (
              <ToggleRow key={opt.k} label={opt.label} value={(prefs.brief_include?.[opt.k] ?? true)} onChange={(v) => updPref({ brief_include: { ...(prefs.brief_include ?? {}), [opt.k]: v } })} />
            ))}
          </div>
        </Field>
      </SectionCard>

      <SectionCard title="Conversation History">
        <ToggleRow label="Save conversations" value={prefs.save_conversations !== false} onChange={(v) => updPref({ save_conversations: v })} />
        <Field label="Keep for">
          <select className="input-glass" value={prefs.keep_convos_days ?? "90"} onChange={(e) => updPref({ keep_convos_days: e.target.value })}>
            <option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option>
          </select>
        </Field>
        <div className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
          {convoCount} conversation{convoCount === 1 ? "" : "s"} · {msgCount} message{msgCount === 1 ? "" : "s"}
        </div>
        <button onClick={clearConversations} className="btn-ghost" style={{ color: "#FCA5A5", alignSelf: "start" }}>
          <AlertTriangle size={12} /> Clear All Conversations
        </button>
      </SectionCard>
    </div>
  );
}
