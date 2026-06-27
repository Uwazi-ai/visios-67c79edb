import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
  requiredTier?: "team" | "growth" | "enterprise";
  currentTier?: "solo" | "team" | "growth" | "enterprise";
}

type Cycle = "monthly" | "annual";

interface Plan {
  key: "team" | "growth";
  name: string;
  monthly: number;
  annual: number; // total per year
  features: string[];
}

const PLANS: Plan[] = [
  {
    key: "team",
    name: "Team",
    monthly: 79,
    annual: 790,
    features: [
      "Up to 10 team members",
      "Team Chat with realtime",
      "Agents & workflows",
      "Vision unlimited briefs",
      "Daily team reports",
    ],
  },
  {
    key: "growth",
    name: "Growth",
    monthly: 179,
    annual: 1790,
    features: [
      "Unlimited team members",
      "Everything in Team",
      "Social media studio",
      "Admin dashboard & analytics",
      "Priority support",
    ],
  },
];

export const UpgradeModal = ({
  open,
  onOpenChange,
  feature,
  requiredTier = "team",
  currentTier = "solo",
}: UpgradeModalProps) => {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<Cycle>("monthly");

  const visiblePlans = PLANS.filter((p) => {
    if (currentTier === "team") return p.key === "growth";
    if (requiredTier === "growth") return p.key === "growth";
    return true;
  });

  const start = (plan: Plan) => {
    onOpenChange(false);
    navigate(`/settings?tab=billing&plan=${plan.key}&cycle=${cycle}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="glass max-w-3xl"
        style={{ background: "rgba(2,2,10,0.96)" }}
      >
        <DialogHeader>
          <div
            className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ background: "rgba(37,99,235,0.15)", color: "#2563EB" }}
          >
            <Sparkles size={20} strokeWidth={1.5} />
          </div>
          <DialogTitle className="t-section">
            Unlock {feature ?? "this feature"}
          </DialogTitle>
          <DialogDescription style={{ color: "var(--text-secondary)" }}>
            Available on the {requiredTier === "growth" ? "Growth" : "Team"} plan.
            Start with a 14-day free trial — cancel anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center mb-4">
          <div
            className="inline-flex rounded-full p-1"
            style={{ background: "var(--bg-glass-1)" }}
          >
            <button
              onClick={() => setCycle("monthly")}
              className="px-4 py-1.5 text-sm rounded-full transition-colors"
              style={{
                background: cycle === "monthly" ? "#2563EB" : "transparent",
                color: cycle === "monthly" ? "white" : "var(--text-secondary)",
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setCycle("annual")}
              className="px-4 py-1.5 text-sm rounded-full inline-flex items-center gap-2 transition-colors"
              style={{
                background: cycle === "annual" ? "#2563EB" : "transparent",
                color: cycle === "annual" ? "white" : "var(--text-secondary)",
              }}
            >
              Annual
              <span
                className="t-mono"
                style={{
                  fontSize: 9,
                  background: cycle === "annual" ? "rgba(255,255,255,0.18)" : "rgba(34,197,94,0.15)",
                  color: cycle === "annual" ? "white" : "#22C55E",
                  padding: "2px 6px",
                  borderRadius: 999,
                  letterSpacing: "0.05em",
                }}
              >
                SAVE 17%
              </span>
            </button>
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: visiblePlans.length === 1 ? "1fr" : "1fr 1fr" }}>
          {visiblePlans.map((p) => {
            const price = cycle === "monthly" ? p.monthly : Math.round(p.annual / 12);
            return (
              <div
                key={p.key}
                className="glass p-5 rounded-xl flex flex-col"
                style={{ border: "1px solid #1a1a2e" }}
              >
                <div className="t-mono mb-1" style={{ fontSize: 10, color: "#2563EB" }}>
                  {p.name.toUpperCase()}
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-display" style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)" }}>
                    ${price}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>/mo</span>
                </div>
                <div className="t-mono mb-4" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {cycle === "annual" ? `Billed $${p.annual}/yr` : "Billed monthly"}
                </div>
                <ul className="space-y-2 mb-5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <Check size={14} style={{ color: "#22C55E", marginTop: 2, flexShrink: 0 }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => start(p)}
                  style={{ background: "#2563EB", color: "white" }}
                  className="w-full"
                >
                  Start 14-day free trial
                </Button>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-3">
          <button
            onClick={() => onOpenChange(false)}
            className="text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Not now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
