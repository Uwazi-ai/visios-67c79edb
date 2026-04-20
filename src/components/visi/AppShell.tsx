import { Outlet, Navigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileTabbar } from "./MobileTabbar";
import { useAuth } from "@/contexts/AuthContext";
import { QuickCaptureModal } from "@/components/tasks/QuickCaptureModal";

export const AppShell = () => {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center">
        <div className="t-mono">LOADING<span className="slash">/</span>OS</div>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="app-bg min-h-screen flex">
      <div className="bg-orb-1" />
      <div className="bg-orb-2" />
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col relative z-10">
        <Topbar />
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 page-enter">
          <Outlet />
        </main>
      </div>
      <MobileTabbar />
      <QuickCaptureModal />
    </div>
  );
};
