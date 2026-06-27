import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { Step1Workspace } from "@/components/onboarding/Step1Workspace";
import { Step2Invites } from "@/components/onboarding/Step2Invites";
import { Step3Google } from "@/components/onboarding/Step3Google";
import { Step4Vision } from "@/components/onboarding/Step4Vision";
import { toast } from "@/hooks/use-toast";

const STEPS = ["Workspace", "Team", "Google", "Vision"];

export default function OnboardingPage() {
  const { session, user, loading: authLoading } = useAuth();
  const { refreshOrgs } = useOrg();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();
      if ((profile as any)?.onboarding_completed) {
        navigate("/", { replace: true });
        return;
      }
      const { data: mems } = await supabase
        .from("org_memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1);
      if (mems && mems.length > 0) {
        setOrgId(mems[0].org_id);
        setStep(3);
      }
      setChecking(false);
    })();
  }, [user, navigate]);

  if (authLoading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (checking) {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center">
        <div className="t-mono">LOADING<span className="slash">/</span>ONBOARDING</div>
      </div>
    );
  }

  const finish = async (destination: "/" | "/chat") => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);
    await refreshOrgs();
    toast({ title: "Welcome to VisiOS" });
    navigate(destination, { replace: true });
  };

  return (
    <div className="app-bg min-h-screen flex items-center justify-center p-4">
      <div className="bg-orb-1" />
      <div className="bg-orb-2" />
      <div className="relative z-10 w-full max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="t-mono" style={{ fontSize: 11 }}>
            STEP {step}<span className="slash">/</span>OF 4
          </div>
          <div className="t-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {STEPS[step - 1]}
          </div>
        </div>
        <div
          className="mb-6 h-1 w-full overflow-hidden rounded-full"
          style={{ background: "var(--bg-glass-1)" }}
        >
          <div
            className="h-full transition-all"
            style={{ width: `${(step / 4) * 100}%`, background: "#2563EB" }}
          />
        </div>
        <div className="glass p-6 md:p-8 rounded-2xl">
          {step === 1 && (
            <Step1Workspace
              onComplete={(newOrgId) => {
                setOrgId(newOrgId);
                setStep(2);
                void refreshOrgs();
              }}
            />
          )}
          {step === 2 && orgId && (
            <Step2Invites
              orgId={orgId}
              onNext={() => setStep(3)}
              onSkip={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <Step3Google onNext={() => setStep(4)} onSkip={() => setStep(4)} />
          )}
          {step === 4 && (
            <Step4Vision
              onStartVision={() => finish("/")}
              onExplore={() => finish("/chat")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
