import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrgTier } from "@/hooks/useFeatureAccess";
import { TIER_CONFIG } from "@/config/tiers";

/**
 * Combines two behaviors:
 *  - Escalating trial banner across the top while a trial is active
 *  - Full-screen blocking modal once the trial has ended
 *
 * /settings/billing is always reachable.
 */
export const TrialGate = ({ children }: { children: React.ReactNode }) => {
  const { isTrialing, trialDaysLeft, trialEnded } = useOrgTier();
  const navigate = useNavigate();
  const location = useLocation();

  const onBillingRoute = location.pathname.startsWith("/settings");

  return (
    <>
      {isTrialing && !trialEnded && trialDaysLeft !== null && (
        <TrialBannerStrip days={trialDaysLeft} onUpgrade={() => navigate("/settings?tab=billing")} />
      )}
      {children}
      {trialEnded && !onBillingRoute && <TrialEndedBlock onChoose={() => navigate("/settings?tab=billing")} />}
    </>
  );
};

function TrialBannerStrip({ days, onUpgrade }: { days: number; onUpgrade: () => void }) {
  let bg = "#2563EB";
  let icon = <Sparkles size={14} />;
  let pulse = "";
  let msg = `Trial: ${days} ${days === 1 ? "day" : "days"} left — Upgrade anytime →`;

  if (days <= 6 && days >= 3) {
    bg = "#f59e0b";
    icon = <AlertTriangle size={14} />;
    msg = `Trial ending in ${days} days · Add a card to continue →`;
  } else if (days <= 2 && days > 0) {
    bg = "#ef4444";
    icon = <AlertTriangle size={14} />;
    pulse = "animate-pulse";
    msg =
      days === 1
        ? "Trial ends tomorrow · Upgrade now to keep your data →"
        : "Trial ends in 2 days · Upgrade now to keep your data →";
  }

  return (
    <button
      onClick={onUpgrade}
      className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white ${pulse}`}
      style={{ background: bg }}
    >
      {icon}
      <span>{msg}</span>
    </button>
  );
}

function TrialEndedBlock({ onChoose }: { onChoose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center px-6 py-10 overflow-y-auto"
      style={{ background: "rgba(2,2,10,0.92)", backdropFilter: "blur(8px)" }}
    >
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: "rgba(239,68,68,0.18)", color: "#ef4444" }}
          >
            <AlertTriangle size={22} />
          </div>
          <h1 className="t-hero mb-2">Your free trial has ended</h1>
          <p style={{ color: "var(--text-secondary)" }}>Choose a plan to keep using Kova.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {(["solo", "team", "growth"] as const).map((t) => {
            const c = TIER_CONFIG[t];
            return (
              <div
                key={t}
                className="glass p-5 rounded-xl"
                style={{
                  border: t === "team" ? `1px solid ${c.color}` : "1px solid #1a1a2e",
                  background: "rgba(2,2,10,0.9)",
                }}
              >
                <div className="t-mono mb-1" style={{ fontSize: 10, color: c.color }}>
                  {c.label.toUpperCase()}
                </div>
                <div className="font-display mb-3" style={{ fontSize: 28, fontWeight: 700 }}>
                  ${c.price_monthly}
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}> /mo</span>
                </div>
                <Button onClick={onChoose} className="w-full" style={{ background: "#2563EB", color: "white" }}>
                  Choose {c.label}
                </Button>
              </div>
            );
          })}
        </div>
        <p className="text-center t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
          SECURE PAYMENT · CANCEL ANYTIME
        </p>
      </div>
    </div>
  );
}
