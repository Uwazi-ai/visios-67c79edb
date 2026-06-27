import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { useOrgTier } from "@/hooks/useFeatureAccess";
import { FEATURE_LABELS, type Tier } from "@/config/tiers";

type OpenArgs = {
  feature: string;
  requiredTier?: Tier;
};

type Ctx = {
  open: (args: OpenArgs) => void;
  close: () => void;
};

const UpgradeCtx = createContext<Ctx>({ open: () => {}, close: () => {} });

export const useUpgrade = () => useContext(UpgradeCtx);

export const UpgradeProvider = ({ children }: { children: ReactNode }) => {
  const { tier } = useOrgTier();
  const [state, setState] = useState<{ open: boolean; feature: string; requiredTier: Tier }>({
    open: false,
    feature: "",
    requiredTier: "team",
  });

  const open = useCallback((args: OpenArgs) => {
    setState({
      open: true,
      feature: FEATURE_LABELS[args.feature] ?? args.feature,
      requiredTier: args.requiredTier ?? "team",
    });
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  // Handle ?upgraded=true on return from Stripe.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      toast.success("🎉 Plan upgraded — new features are now unlocked.");
      params.delete("upgraded");
      const qs = params.toString();
      const url = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
      window.history.replaceState({}, "", url);
    }
  }, []);

  return (
    <UpgradeCtx.Provider value={{ open, close }}>
      {children}
      <UpgradeModal
        open={state.open}
        onOpenChange={(o) => setState((s) => ({ ...s, open: o }))}
        feature={state.feature}
        requiredTier={state.requiredTier as any}
        currentTier={tier as any}
      />
    </UpgradeCtx.Provider>
  );
};
