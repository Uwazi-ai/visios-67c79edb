import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { useOrg } from "@/contexts/OrgContext";

export const TrialBanner = () => {
  const { orgs, activeOrgId } = useOrg();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem("visi:trialBannerDismissed") === "1");
  }, []);

  const active = orgs.find((o) => o.id === activeOrgId) as
    | (typeof orgs[number] & {
        subscription_status?: string;
        trial_ends_at?: string;
      })
    | undefined;

  if (!active || dismissed) return null;
  if (active.subscription_status !== "trialing") return null;
  if (!active.trial_ends_at) return null;

  const ms = new Date(active.trial_ends_at).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));

  const dismiss = () => {
    sessionStorage.setItem("visi:trialBannerDismissed", "1");
    setDismissed(true);
  };

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-2 text-sm relative"
      style={{ background: "#2563EB", color: "white" }}
    >
      <Sparkles size={14} strokeWidth={2} />
      <span className="font-medium">You're on a 14-day free trial</span>
      <span style={{ opacity: 0.85 }}>·</span>
      <span style={{ opacity: 0.9 }}>
        {days} {days === 1 ? "day" : "days"} remaining
      </span>
      <span style={{ opacity: 0.85 }}>·</span>
      <button
        onClick={() => navigate("/settings?tab=billing")}
        className="underline underline-offset-2 font-medium hover:opacity-90"
      >
        Upgrade now →
      </button>
      <button
        onClick={dismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
};
