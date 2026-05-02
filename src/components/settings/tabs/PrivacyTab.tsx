import { useEffect, useState } from "react";
import { Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { savePreferences } from "@/lib/settingsHelpers";
import SectionCard, { ToggleRow } from "../SectionCard";
import { toast } from "sonner";

export default function PrivacyTab() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
      setPrefs((data as any)?.preferences ?? {});
      setLoading(false);
    })();
  }, [user]);

  const upd = (k: string, v: boolean) => {
    if (!user) return;
    const next = { ...prefs, privacy: { ...(prefs.privacy ?? {}), [k]: v } };
    setPrefs(next);
    savePreferences(user.id, prefs, { privacy: next.privacy });
  };
  const get = (k: string) => prefs.privacy?.[k] ?? false;

  const exportData = async () => {
    if (!user) return;
    setExporting(true);
    const [contacts, tasks, convos, kb, profile] = await Promise.all([
      supabase.from("contacts").select("*"),
      supabase.from("tasks").select("*"),
      supabase.from("vision_conversations").select("*").eq("user_id", user.id),
      supabase.from("kb_documents").select("*").eq("user_id", user.id),
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    ]);
    const blob = new Blob([JSON.stringify({ contacts: contacts.data, tasks: tasks.data, vision_conversations: convos.data, knowledge_base: kb.data, profile: profile.data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `visi-export-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast.success("Export downloaded");
  };

  if (loading) return <div className="glass flex items-center justify-center" style={{ minHeight: 200 }}><Loader2 className="animate-spin" size={18} /></div>;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Data Usage" subtitle="All off by default. Vision reads live and never caches when off.">
        <ToggleRow label="Allow Vision conversations to improve AI" hint="Anonymized conversation logs help train models. Off = your data never leaves your account." value={get("ai_improvement")} onChange={(v) => upd("ai_improvement", v)} />
        <ToggleRow label="Store email body in database" hint="Off = Vision reads Gmail live each time, never persists message bodies." value={get("store_email")} onChange={(v) => upd("store_email", v)} />
        <ToggleRow label="Store Slack messages in database" hint="Off = Vision queries Slack live, never persists messages." value={get("store_slack")} onChange={(v) => upd("store_slack", v)} />
      </SectionCard>
      <SectionCard title="Data Portability">
        <button onClick={exportData} className="btn-primary" disabled={exporting} style={{ alignSelf: "start" }}>
          {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Export All My Data
        </button>
      </SectionCard>
    </div>
  );
}
