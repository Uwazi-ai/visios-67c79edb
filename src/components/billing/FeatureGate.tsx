import { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeatureAccess, type FeatureKey } from "@/hooks/useFeatureAccess";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { FEATURE_LABELS, TIER_CONFIG } from "@/config/tiers";

interface Props {
  feature: FeatureKey;
  title?: string;
  description?: string;
  preview?: ReactNode;
  children: ReactNode;
}

/**
 * Full-page paywall. If feature is locked, render an upgrade screen
 * with a blurred preview of the underlying page. Otherwise pass children through.
 */
export const FeatureGate = ({ feature, title, description, preview, children }: Props) => {
  const { hasAccess, requiredTier } = useFeatureAccess(feature);
  const { open } = useUpgrade();

  if (hasAccess) return <>{children}</>;

  const label = FEATURE_LABELS[feature as string] ?? "this feature";
  const tierLabel = TIER_CONFIG[requiredTier].label;

  return (
    <div className="relative min-h-[70vh] flex items-center justify-center px-6 py-12 overflow-hidden">
      {/* Blurred preview behind */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ filter: "blur(14px) saturate(0.7)", opacity: 0.35 }}
      >
        {preview ?? children}
      </div>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, rgba(2,2,10,0.55) 0%, rgba(2,2,10,0.92) 70%)",
        }}
      />

      <div
        className="relative z-10 glass rounded-2xl p-8 md:p-10 max-w-lg w-full text-center"
        style={{ border: "1px solid #1a1a2e", background: "rgba(2,2,10,0.85)" }}
      >
        <div
          className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "rgba(37,99,235,0.15)", color: "#2563EB" }}
        >
          <Lock size={24} strokeWidth={1.5} />
        </div>
        <h2 className="t-section mb-2">{title ?? `${label} is a ${tierLabel} plan feature`}</h2>
        <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
          {description ??
            `Unlock ${label.toLowerCase()} on the ${tierLabel} plan and above. Includes a 14-day free trial — cancel anytime.`}
        </p>
        <Button
          onClick={() => open({ feature: feature as string, requiredTier })}
          className="w-full"
          style={{ background: "#2563EB", color: "white" }}
        >
          Upgrade to {tierLabel} →
        </Button>
        <p className="t-mono mt-4" style={{ fontSize: 10, color: "var(--text-muted)" }}>
          14-DAY FREE TRIAL · CANCEL ANYTIME
        </p>
      </div>
    </div>
  );
};
