import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SlidersHorizontal, Check, Loader2 } from "lucide-react";

const SettingsPage = () => {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name, email")
        .eq("id", user.id)
        .maybeSingle();
      setUsername(data?.username ?? "");
      setDisplayName(data?.display_name ?? "");
      setEmail(data?.email ?? "");
      setLoading(false);
    })();
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const cleanedUsername = username.toLowerCase().replace(/[^a-z0-9-_]/g, "");
    const { error } = await supabase
      .from("profiles")
      .update({ username: cleanedUsername || null, display_name: displayName || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      setError(error.message.includes("duplicate") ? "That username is taken." : error.message);
      return;
    }
    setUsername(cleanedUsername);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <SlidersHorizontal size={20} style={{ color: "var(--text-accent)" }} />
        <h1 className="t-hero" style={{ fontSize: 28 }}>Settings</h1>
      </div>

      <section className="glass p-5">
        <div className="t-card-title mb-4">Public Booking Profile</div>
        {loading ? (
          <div className="space-y-3">
            <div className="shimmer-block h-9 rounded-lg" />
            <div className="shimmer-block h-9 rounded-lg" />
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="t-mono mb-1" style={{ fontSize: 10 }}>USERNAME</div>
              <input className="input-glass" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="myke" />
              <div className="t-body mt-1.5" style={{ fontSize: 11 }}>
                Your booking links will be: <span className="t-mono" style={{ color: "var(--text-accent)" }}>{window.location.origin}/book/{username || "your-username"}/[event-slug]</span>
              </div>
            </div>
            <div>
              <div className="t-mono mb-1" style={{ fontSize: 10 }}>DISPLAY NAME</div>
              <input className="input-glass" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your full name" />
            </div>
            <div>
              <div className="t-mono mb-1" style={{ fontSize: 10 }}>EMAIL (read-only)</div>
              <input className="input-glass" value={email} disabled style={{ opacity: 0.6 }} />
            </div>
            {error && <div className="t-body" style={{ color: "var(--sev-critical)", fontSize: 12 }}>{error}</div>}
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving</> : saved ? <><Check size={14} /> Saved</> : "Save"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default SettingsPage;
