import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useOrgTier, useOrgUsage } from "@/hooks/useFeatureAccess";
import { TIER_CONFIG } from "@/config/tiers";

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  if (limit === -1) return null;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  let color = "#2563EB";
  if (pct >= 95) color = "#ef4444";
  else if (pct >= 80) color = "#f59e0b";
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-[11px] mb-1" style={{ color: "var(--text-secondary)" }}>
        <span>{label}</span>
        <span className="t-mono">{used}/{limit}</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 200ms" }} />
      </div>
    </div>
  );
}

export const UsageWidget = () => {
  const { tier, tierConfig, isTrialing, trialDaysLeft } = useOrgTier();
  const usage = useOrgUsage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const limits = tierConfig.limits;
  const visionLimit = limits.vision_messages_per_month;
  const visionPct = visionLimit === -1 ? 0 : Math.min(100, Math.round((usage.vision_messages_used / visionLimit) * 100));

  return (
    <div
      className="mx-3 mb-2 rounded-lg"
      style={{ border: "1px solid var(--border-glass)", background: "rgba(255,255,255,0.02)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px]"
        style={{ color: "var(--text-secondary)" }}
      >
        <span
          className="t-mono px-1.5 py-0.5 rounded"
          style={{ fontSize: 9, color: tierConfig.color, background: `${tierConfig.color}22` }}
        >
          {tierConfig.label.toUpperCase()}
        </span>
        {visionLimit !== -1 && (
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div style={{ width: `${visionPct}%`, height: "100%", background: "#2563EB" }} />
          </div>
        )}
        {visionLimit === -1 && <span className="flex-1 truncate">Unlimited ✓</span>}
        <span className="ml-auto">{open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1">
          {isTrialing && trialDaysLeft !== null && (
            <div className="mb-3 text-[11px]" style={{ color: trialDaysLeft <= 3 ? "#ef4444" : "var(--text-secondary)" }}>
              ⏱ Trial: {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} left
            </div>
          )}

          {tier === "growth" || tier === "enterprise" ? (
            <div className="text-[11px] mb-3" style={{ color: "var(--text-secondary)" }}>
              {tierConfig.label} plan · Unlimited ✓
            </div>
          ) : (
            <>
              <Meter label="Vision msgs" used={usage.vision_messages_used} limit={limits.vision_messages_per_month} />
              <Meter label="Docs" used={usage.knowledge_docs_count} limit={limits.knowledge_base_docs} />
              <Meter label="Contacts" used={usage.contacts_count} limit={limits.contacts} />
              {tier === "team" && (
                <>
                  <Meter label="Agents" used={usage.active_agents_count} limit={limits.active_agents} />
                  <Meter label="Seats" used={usage.seats_used} limit={limits.seats} />
                </>
              )}
            </>
          )}

          <button
            onClick={() => navigate("/settings?tab=billing")}
            className="w-full mt-2 py-1.5 rounded text-[11px] font-medium"
            style={{ background: "#2563EB", color: "white" }}
          >
            Upgrade plan →
          </button>
        </div>
      )}
    </div>
  );
};
