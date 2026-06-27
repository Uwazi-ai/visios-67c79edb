import { useEffect, useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/integrations/supabase/client";
import { QuickCaptureModal } from "@/components/tasks/QuickCaptureModal";
import { TrialGate } from "@/components/billing/TrialGate";

export const AppShell = () => {
  const { session, user, loading } = useAuth();
  const { memberships, loading: orgLoading } = useOrg();
  const location = useLocation();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!user) {
      setOnboardingChecked(true);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();
      const completed = Boolean((data as any)?.onboarding_completed);
      setNeedsOnboarding(!completed && memberships.length === 0);
      setOnboardingChecked(true);
    })();
  }, [user, memberships.length]);

  if (loading || orgLoading || !onboardingChecked) {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center">
        <div className="t-mono">LOADING<span className="slash">/</span>OS</div>
      </div>
    );
  }
  if (!session) return <Navigate to="/" replace />;
  if (needsOnboarding && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="app-bg min-h-screen flex">
      <div className="bg-orb-1" />
      <div className="bg-orb-2" />
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col relative z-10">
        <TrialGate>
          <Topbar />
          <main className="flex-1 p-4 md:p-6 mobile-bottom-pad page-enter">
            <Outlet />
          </main>
        </TrialGate>
      </div>
      <BottomNav />
      <QuickCaptureModal />
    </div>
  );
};
