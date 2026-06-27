import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { toast } from "@/hooks/use-toast";
import type { Tier } from "@/config/tiers";

const TIER_PRICE: Record<Exclude<Tier, "enterprise">, { monthly: number; annual: number }> = {
  solo: { monthly: 29, annual: 290 },
  team: { monthly: 79, annual: 790 },
  growth: { monthly: 179, annual: 1790 },
};

const TIER_LABEL: Record<Tier, string> = {
  solo: "Solo",
  team: "Team",
  growth: "Growth",
  enterprise: "Enterprise",
};

const STATUS_COLOR: Record<string, string> = {
  trialing: "#F59E0B",
  active: "#22C55E",
  past_due: "#EF4444",
  canceled: "#6B7280",
};

const STATUS_LABEL: Record<string, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past Due",
  canceled: "Canceled",
};

export default function BillingTab() {
  const { user } = useAuth();
  const { orgs, activeOrgId, memberships, refreshOrgs } = useOrg();
  const [params, setParams] = useSearchParams();
  const [seatCount, setSeatCount] = useState<number>(0);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const active = orgs.find((o) => o.id === activeOrgId) as
    | (typeof orgs[number] & {
        subscription_tier?: Tier;
        subscription_status?: string;
        trial_ends_at?: string;
      })
    | undefined;

  const tier: Tier = (active?.subscription_tier as Tier) ?? "solo";
  const status = active?.subscription_status ?? "trialing";
  const myRole = active ? memberships.find((m) => m.org_id === active.id)?.role : null;
  const isOwnerOrAdmin = myRole === "owner" || myRole === "admin";

  useEffect(() => {
    if (params.get("success") === "true") {
      toast({ title: `You're on the ${TIER_LABEL[tier]} plan. Welcome.` });
      refreshOrgs();
      const next = new URLSearchParams(params);
      next.delete("success");
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!active) return;
    supabase
      .from("org_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("org_id", active.id)
      .then(({ count }) => setSeatCount(count ?? 0));
  }, [active]);

  if (!active) {
    return <div className="t-mono">No active workspace.</div>;
  }

  const seatLimit = tier === "solo" ? 1 : tier === "team" ? 10 : 999;
  const trialDays = active.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(active.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0;
  const price = tier === "enterprise" ? null : TIER_PRICE[tier];

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="t-section">Billing & Plans</h2>
        <p className="t-mono" style={{ color: "var(--text-muted)" }}>
          Manage your subscription and view usage
        </p>
      </div>

      {/* Current plan card */}
      <div className="glass p-6 rounded-2xl" style={{ border: "1px solid #1a1a2e" }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="t-mono mb-1" style={{ fontSize: 10, color: "#2563EB" }}>
              CURRENT PLAN
            </div>
            <div className="flex items-center gap-3">
              <h3 className="font-display" style={{ fontSize: 28, fontWeight: 700 }}>
                {TIER_LABEL[tier]}
              </h3>
              <span
                className="badge"
                style={{
                  background: `${STATUS_COLOR[status]}22`,
                  color: STATUS_COLOR[status],
                  border: `1px solid ${STATUS_COLOR[status]}55`,
                }}
              >
                {STATUS_LABEL[status] ?? status}
              </span>
            </div>
          </div>
          {price && (
            <div className="text-right">
              <div className="font-display" style={{ fontSize: 24, fontWeight: 700 }}>
                ${price.monthly}
              </div>
              <div className="t-mono" style={{ color: "var(--text-muted)" }}>/MONTH</div>
            </div>
          )}
        </div>

        {status === "trialing" && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4"
            style={{ background: "rgba(245,158,11,0.1)", color: "#F59E0B" }}
          >
            <Sparkles size={14} />
            <span className="text-sm">
              {trialDays} {trialDays === 1 ? "day" : "days"} left in your trial
            </span>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: "var(--text-secondary)" }}>Seats used</span>
            <span className="t-mono">
              {seatCount} of {seatLimit === 999 ? "∞" : seatLimit}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--bg-glass-1)" }}>
            <div
              className="h-full transition-all"
              style={{
                width: `${Math.min(100, (seatCount / Math.min(seatLimit, 50)) * 100)}%`,
                background: "#2563EB",
              }}
            />
          </div>
        </div>
      </div>

      {/* Upgrade or manage */}
      {tier === "solo" || tier === "team" ? (
        <div className="glass p-6 rounded-2xl" style={{ border: "1px solid #1a1a2e" }}>
          <h3 className="t-section mb-1">Upgrade your workspace</h3>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            Unlock {tier === "solo" ? "team chat, agents, and unlimited Vision briefs" : "social, admin dashboard, and unlimited seats"}.
          </p>
          <Button
            onClick={() => setUpgradeOpen(true)}
            style={{ background: "#2563EB", color: "white" }}
            disabled={!isOwnerOrAdmin}
          >
            View plans
          </Button>
          {!isOwnerOrAdmin && (
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              Only owners and admins can change the plan.
            </p>
          )}
        </div>
      ) : (
        <div className="glass p-6 rounded-2xl" style={{ border: "1px solid #1a1a2e" }}>
          <h3 className="t-section mb-3">Manage subscription</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!isOwnerOrAdmin}>
              Manage subscription
            </Button>
            <Button variant="outline" disabled={!isOwnerOrAdmin}>
              View invoices
            </Button>
          </div>
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-glass)" }}>
            <div className="t-mono mb-2" style={{ fontSize: 10, color: "#EF4444" }}>
              DANGER ZONE
            </div>
            <Button
              variant="outline"
              disabled={!isOwnerOrAdmin}
              style={{ color: "#FCA5A5", borderColor: "rgba(239,68,68,0.3)" }}
            >
              Cancel subscription
            </Button>
          </div>
        </div>
      )}

      <div className="glass p-4 rounded-xl flex items-start gap-3" style={{ border: "1px solid #1a1a2e" }}>
        <CheckCircle2 size={16} style={{ color: "#2563EB", marginTop: 2 }} />
        <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--text-primary)" }}>Built-in payments.</strong>{" "}
          VisiOS handles checkout, tax, and invoicing automatically. No external account setup required.
        </div>
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentTier={tier}
        requiredTier={tier === "solo" ? "team" : "growth"}
      />
    </div>
  );
}
