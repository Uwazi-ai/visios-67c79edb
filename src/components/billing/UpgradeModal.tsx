import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
  requiredTier?: "team" | "growth" | "enterprise";
}

const TIER_COPY: Record<string, { name: string; price: string }> = {
  team: { name: "Team", price: "$79/mo" },
  growth: { name: "Growth", price: "$199/mo" },
  enterprise: { name: "Enterprise", price: "Contact sales" },
};

export const UpgradeModal = ({
  open,
  onOpenChange,
  feature,
  requiredTier = "team",
}: UpgradeModalProps) => {
  const navigate = useNavigate();
  const tier = TIER_COPY[requiredTier] ?? TIER_COPY.team;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass">
        <DialogHeader>
          <div
            className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ background: "rgba(37,99,235,0.15)", color: "#2563EB" }}
          >
            <Sparkles size={20} strokeWidth={1.5} />
          </div>
          <DialogTitle className="t-section">
            Available on the {tier.name} plan
          </DialogTitle>
          <DialogDescription style={{ color: "var(--text-secondary)" }}>
            {feature
              ? `"${feature}" is part of VisiOS ${tier.name}.`
              : `This feature is part of VisiOS ${tier.name}.`}{" "}
            Upgrade to unlock it for your whole workspace.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate("/settings/billing");
            }}
            style={{ background: "#2563EB", color: "white" }}
          >
            Upgrade — {tier.price}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
