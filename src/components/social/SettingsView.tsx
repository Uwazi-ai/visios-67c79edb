import { useEffect, useState } from "react";
import { Instagram, Linkedin, Facebook, Youtube, Music2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BRAND_ORDER, BRANDS, TEAM, type BrandKey } from "./shared";
import { toast } from "sonner";

const PLATFORMS = [
  { key: "meta", label: "Meta", Icon: Facebook },
  { key: "tiktok", label: "TikTok", Icon: Music2 },
  { key: "linkedin", label: "LinkedIn", Icon: Linkedin },
  { key: "facebook", label: "Facebook", Icon: Facebook },
  { key: "youtube", label: "YouTube", Icon: Youtube },
  { key: "instagram", label: "Instagram", Icon: Instagram },
];

export function SettingsView() {
  const [integrations, setIntegrations] = useState<Record<string, { status: string }>>({});
  const [brandPrompts, setBrandPrompts] = useState<Record<string, { voice_notes: string; require_approval: boolean }>>({});
  const [teamPerms, setTeamPerms] = useState<Array<{ id: string; name: string; permissions: any }>>([]);

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data: ints } = await supabase.from("social_integrations").select("platform,status");
    const m: any = {};
    (ints || []).forEach((r: any) => { m[r.platform] = { status: r.status }; });
    setIntegrations(m);

    const { data: prompts } = await supabase.from("social_ai_prompts").select("brand,voice_notes,require_approval");
    const pm: any = {};
    (prompts || []).forEach((r: any) => { pm[r.brand] = { voice_notes: r.voice_notes || "", require_approval: r.require_approval || false }; });
    setBrandPrompts(pm);

    const { data: tm } = await supabase.from("social_team_members").select("id,name,permissions");
    setTeamPerms((tm || []) as any);
  }

  async function connect(platform: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("social_integrations").upsert({
      user_id: user.id, platform, status: "connected", connected_at: new Date().toISOString(),
    }, { onConflict: "user_id,platform" });
    toast.success(`${platform} marked connected (placeholder)`);
    load();
  }

  async function disconnect(platform: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("social_integrations").delete().eq("user_id", user.id).eq("platform", platform);
    toast.success("Disconnected");
    load();
  }

  async function saveBrand(brand: BrandKey, patch: Partial<{ voice_notes: string; require_approval: boolean }>) {
    const { error } = await supabase.from("social_ai_prompts").update(patch).eq("brand", brand);
    if (error) toast.error(error.message); else { toast.success("Saved"); load(); }
  }

  async function togglePerm(id: string, key: string, value: boolean, current: any) {
    const next = { ...current, [key]: value };
    const { error } = await supabase.from("social_team_members").update({ permissions: next }).eq("id", id);
    if (error) toast.error(error.message); else load();
  }

  const permKeys: { key: string; label: string }[] = [
    { key: "draft", label: "Draft" },
    { key: "schedule", label: "Schedule" },
    { key: "post", label: "Post" },
    { key: "approve", label: "Approve" },
    { key: "delete", label: "Delete" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-5 max-w-4xl mx-auto w-full space-y-6">
      <Section title="Connected Accounts">
        <div className="glass rounded-xl divide-y" style={{ borderColor: "var(--border-glass)" }}>
          {PLATFORMS.map(({ key, label, Icon }) => {
            const connected = integrations[key]?.status === "connected";
            return (
              <div key={key} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border-glass)" }}>
                <Icon size={16} style={{ color: "var(--text-secondary)" }} />
                <div className="flex-1" style={{ fontSize: 13 }}>{label}</div>
                <div className="flex items-center gap-2" style={{ fontSize: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: connected ? "#22C55E" : "#6b7280" }} />
                  <span style={{ color: "var(--text-muted)" }}>{connected ? "Connected" : "Not connected"}</span>
                </div>
                {connected ? (
                  <button onClick={() => disconnect(key)} className="btn-ghost" style={{ fontSize: 11 }}>Disconnect</button>
                ) : (
                  <button onClick={() => connect(key)} className="btn-primary" style={{ fontSize: 11 }}>Connect</button>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Team Access">
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full" style={{ fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-glass)" }}>
                <th className="p-2 text-left t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)" }}>Member</th>
                {permKeys.map((p) => (
                  <th key={p.key} className="p-2 text-center t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)" }}>{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teamPerms.map((t) => {
                const member = TEAM.find((tm) => tm.name === t.name);
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid var(--border-glass)" }}>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span style={{
                          width: 24, height: 24, borderRadius: 99,
                          background: member?.color, color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 600,
                        }}>{member?.initials}</span>
                        <div>
                          <div style={{ fontSize: 12 }}>{t.name}</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{member?.role}</div>
                        </div>
                      </div>
                    </td>
                    {permKeys.map((p) => (
                      <td key={p.key} className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!t.permissions?.[p.key]}
                          onChange={(e) => togglePerm(t.id, p.key, e.target.checked, t.permissions || {})}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Brand Settings">
        <div className="space-y-4">
          {BRAND_ORDER.map((b) => {
            const cfg = BRANDS[b];
            const bp = brandPrompts[b] ?? { voice_notes: "", require_approval: false };
            return (
              <div key={b} className="glass p-4 rounded-xl" style={{ borderLeft: `2px solid ${cfg.color}` }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold" style={{ fontSize: 14, color: cfg.color }}>{cfg.label}</div>
                  <label className="flex items-center gap-2" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    <input
                      type="checkbox"
                      checked={bp.require_approval}
                      onChange={(e) => saveBrand(b, { require_approval: e.target.checked })}
                    />
                    Require Myke's approval
                  </label>
                </div>
                <textarea
                  defaultValue={bp.voice_notes}
                  onBlur={(e) => { if (e.target.value !== bp.voice_notes) saveBrand(b, { voice_notes: e.target.value }); }}
                  rows={3}
                  className="input-glass w-full"
                  placeholder="Brand voice notes..."
                  style={{ fontSize: 12 }}
                />
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div className="t-section mb-3" style={{ fontSize: 14 }}>{title}</div>
    {children}
  </div>
);
