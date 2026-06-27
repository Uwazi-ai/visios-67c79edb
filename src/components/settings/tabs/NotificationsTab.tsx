import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { savePreferences } from "@/lib/settingsHelpers";
import SectionCard, { ToggleRow } from "../SectionCard";
import { toast } from "sonner";

const IN_APP = [
  { k: "stale_contact", label: "Stale contact alerts (30+ days)", default: true },
  { k: "overdue_task", label: "Overdue task alerts", default: true },
  { k: "review_queue", label: "New contacts in review queue", default: true },
  { k: "meeting_15", label: "Meeting starting in 15 min", default: true },
  { k: "contract_expiry", label: "Contract expiry alerts", default: true },
  { k: "gmail_sync", label: "Gmail sync complete", default: false },
  { k: "jira_sync", label: "Jira sync complete", default: false },
];
const EMAIL = [
  { k: "weekly_digest", label: "Weekly digest (Monday 8am)", default: true },
  { k: "critical_alerts", label: "Critical alerts (overdue 7+ days)", default: true },
  { k: "contact_sync_report", label: "Contact sync report", default: false },
];

export default function NotificationsTab() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<any>({});
  const [pushOn, setPushOn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.rpc("get_my_profile_private");
      const row = (Array.isArray(data) ? data[0] : null) as any;
      setPrefs(row?.preferences ?? {});
      if ("Notification" in window) setPushOn(Notification.permission === "granted");
      setLoading(false);
    })();
  }, [user]);

  const updNested = (group: string, k: string, v: boolean) => {
    if (!user) return;
    const next = { ...prefs, notifications: { ...(prefs.notifications ?? {}), [group]: { ...(prefs.notifications?.[group] ?? {}), [k]: v } } };
    setPrefs(next);
    savePreferences(user.id, prefs, { notifications: next.notifications });
  };

  const enablePush = async () => {
    if (!("Notification" in window)) { toast.error("Push not supported"); return; }
    const perm = await Notification.requestPermission();
    setPushOn(perm === "granted");
    if (perm === "granted") toast.success("Push enabled");
  };

  if (loading) return <div className="glass flex items-center justify-center" style={{ minHeight: 200 }}><Loader2 className="animate-spin" size={18} /></div>;

  const get = (group: string, k: string, def: boolean) => prefs.notifications?.[group]?.[k] ?? def;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="In-App Notifications">
        {IN_APP.map((n) => <ToggleRow key={n.k} label={n.label} value={get("in_app", n.k, n.default)} onChange={(v) => updNested("in_app", n.k, v)} />)}
      </SectionCard>
      <SectionCard title="Email Notifications">
        {EMAIL.map((n) => <ToggleRow key={n.k} label={n.label} value={get("email", n.k, n.default)} onChange={(v) => updNested("email", n.k, v)} />)}
      </SectionCard>
      <SectionCard title="PWA Push Notifications">
        <ToggleRow label="Push enabled" value={pushOn} onChange={() => enablePush()} />
        {!pushOn && <button onClick={enablePush} className="btn-primary" style={{ alignSelf: "start" }}>Enable Push Notifications</button>}
      </SectionCard>
    </div>
  );
}
