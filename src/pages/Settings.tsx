import { useEffect, useMemo, useState } from "react";
import {
  User as UserIcon, Building2, Plug, Sparkles, CreditCard, Bell, Lock, Settings as SettingsIcon,
  Trash2, Users, Rocket,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/integrations/supabase/client";
import ProfileTab from "@/components/settings/tabs/ProfileTab";
import OrganizationsTab from "@/components/settings/tabs/OrganizationsTab";
import ConnectionsTab from "@/components/settings/tabs/ConnectionsTab";
import VisionAITab from "@/components/settings/tabs/VisionAITab";
import DigitalCardTab from "@/components/settings/tabs/DigitalCardTab";
import NotificationsTab from "@/components/settings/tabs/NotificationsTab";
import PrivacyTab from "@/components/settings/tabs/PrivacyTab";
import AccountTab from "@/components/settings/tabs/AccountTab";
import TeamTab from "@/components/settings/tabs/TeamTab";
import UpdatesTab from "@/components/settings/tabs/UpdatesTab";

const SUPER_ADMIN_EMAIL = "myke@uwazi.ai";

type TabKey = "profile" | "orgs" | "team" | "connections" | "vision" | "card" | "notifications" | "privacy" | "account" | "danger" | "updates";

interface NavItem {
  key: TabKey;
  label: string;
  icon: any;
  danger?: boolean;
}

const NAV: NavItem[] = [
  { key: "profile", label: "Profile", icon: UserIcon },
  { key: "orgs", label: "Organizations", icon: Building2 },
  { key: "team", label: "Team", icon: Users },
  { key: "connections", label: "Connections", icon: Plug },
  { key: "vision", label: "Vision", icon: Sparkles },
  { key: "card", label: "My Digital Card", icon: CreditCard },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "privacy", label: "Privacy", icon: Lock },
  { key: "account", label: "Account", icon: SettingsIcon },
  { key: "danger", label: "Data & Reset", icon: Trash2, danger: true },
];

interface CompletionMap {
  profile: { ok: boolean; missing: number };
  orgs: { ok: boolean; missing: number };
  connections: { ok: boolean; missing: number };
  vision: { ok: boolean; missing: number };
  card: { ok: boolean; missing: number };
  notifications: { ok: boolean; missing: number };
  privacy: { ok: boolean; missing: number };
  account: { ok: boolean; missing: number };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { isRestricted } = useOrg();
  const isSuperAdmin = (user?.email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL;
  const [tab, setTab] = useState<TabKey>("profile");
  const NAV_VISIBLE = NAV
    .filter((n) => !isRestricted || (n.key !== "orgs" && n.key !== "team" && n.key !== "danger"))
    .concat(isSuperAdmin ? [{ key: "updates", label: "Updates", icon: Rocket }] : []);
  useEffect(() => {
    if (isRestricted && (tab === "orgs" || tab === "team" || tab === "danger")) setTab("profile");
    if (!isSuperAdmin && tab === "updates") setTab("profile");
  }, [isRestricted, isSuperAdmin, tab]);
  const [completion, setCompletion] = useState<CompletionMap | null>(null);

  // Compute completion indicators
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: profile }, { data: ints }, { data: orgs }] = await Promise.all([
        supabase.from("profiles").select("display_name,phone,timezone,username,avatar_url,tagline,google_refresh_token").eq("id", user.id).maybeSingle(),
        supabase.from("integrations").select("provider,status,vision_enabled").eq("user_id", user.id),
        supabase.from("orgs").select("id,description,priorities"),
      ]);
      const p = profile ?? {} as any;
      const profileMissing = ["display_name", "phone", "timezone"].filter((k) => !p[k]).length;
      const cardMissing = ["username", "avatar_url", "tagline"].filter((k) => !p[k]).length;
      const expectedConnectors = ["google", "slack", "jira", "confluence"];
      const have = new Set((ints ?? []).map((i: any) => i.provider));
      const connMissing = expectedConnectors.filter((k) => !have.has(k)).length;
      const orgsMissing = (orgs ?? []).filter((o: any) => !o.description).length;
      setCompletion({
        profile: { ok: profileMissing === 0, missing: profileMissing },
        orgs: { ok: orgsMissing === 0, missing: orgsMissing },
        connections: { ok: connMissing === 0, missing: connMissing },
        vision: { ok: true, missing: 0 },
        card: { ok: cardMissing === 0, missing: cardMissing },
        notifications: { ok: true, missing: 0 },
        privacy: { ok: true, missing: 0 },
        account: { ok: true, missing: 0 },
      });
    })();
  }, [user, tab]);

  const content = useMemo(() => {
    switch (tab) {
      case "profile": return <ProfileTab />;
      case "orgs": return <OrganizationsTab />;
      case "team": return <TeamTab />;
      case "connections": return <ConnectionsTab />;
      case "vision": return <VisionAITab />;
      case "card": return <DigitalCardTab />;
      case "notifications": return <NotificationsTab />;
      case "privacy": return <PrivacyTab />;
      case "account": return <AccountTab />;
      case "danger": return <AccountTab dangerOnly />;
      default: return null;
    }
  }, [tab]);

  return (
    <div className="page-enter h-full flex flex-col">
      <div className="mb-4 hidden md:block">
        <h1 className="t-hero" style={{ fontSize: 36 }}>Settings</h1>
        <div className="t-mono mt-1">Master control center</div>
      </div>

      <div className="flex flex-col md:flex-row gap-5 flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className="md:flex-shrink-0 md:w-[220px] glass overflow-x-auto md:overflow-x-visible"
          style={{ padding: 8 }}
        >
          <nav className="flex md:flex-col gap-0.5 md:gap-1 min-w-max md:min-w-0">
            {NAV_VISIBLE.map((item) => {
              const Icon = item.icon;
              const isActive = tab === item.key;
              const c = completion?.[item.key as keyof CompletionMap];
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className="nav-item"
                  style={{
                    background: isActive ? "var(--bg-glass-active)" : "transparent",
                    borderLeft: isActive ? "2px solid hsl(var(--primary))" : "2px solid transparent",
                    color: item.danger ? "#FCA5A5" : isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon size={15} strokeWidth={1.5} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {c && !item.danger && (
                    c.ok ? (
                      <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: "#22C55E" }} />
                    ) : (
                      <span className="t-mono flex items-center gap-1" style={{ color: "#F59E0B", fontSize: 9 }}>
                        ⚠ {c.missing}
                      </span>
                    )
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 overflow-y-auto pr-1">
          {content}
        </main>
      </div>
    </div>
  );
}
