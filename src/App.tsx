import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrgProvider } from "@/contexts/OrgContext";
import { TimezoneProvider } from "@/contexts/TimezoneContext";
import { UpgradeProvider } from "@/contexts/UpgradeContext";
import { AppShell } from "@/components/visi/AppShell";
import SignIn from "./pages/SignIn";
import Landing from "./pages/Landing";
import ResetPassword from "./pages/ResetPassword";
import { TermsPage, PrivacyPage, ChangelogPage, RoadmapPage, AboutPage, BlogPage } from "./pages/StubPages";
import { Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import InboxPage from "./pages/Inbox";
import BookingsPage from "./pages/Bookings";
import BookingPublic from "./pages/BookingPublic";
import ContactMeetPublic from "./pages/ContactMeetPublic";
import SettingsPage from "./pages/Settings";
import CalendarPage from "./pages/Calendar";
import TasksPage from "./pages/Tasks";
import TaskFullPage from "./pages/TaskFullPage";
import ChatPage from "./pages/Chat";
import MeetingsPage from "./pages/Meetings";
import TokenHealthPage from "./pages/TokenHealth";
import {
  NotificationsPage, FinancePage,
} from "./pages/EmptyPages";
import ContactsPage from "./pages/Contacts";
import CardPublic from "./pages/CardPublic";
import MyCardSettings from "./pages/MyCardSettings";
import KnowledgePage from "./pages/Knowledge";
import AISettings from "./pages/AISettings";
import Vision from "./pages/Vision";
import CapitalRaise from "./pages/CapitalRaise";
import Social from "./pages/Social";
import Agents from "./pages/Agents";
import Grants from "./pages/Grants";
import MakeIntegration from "./pages/MakeIntegration";
import OAuthCallback from "./pages/OAuthCallback";
import CivicIntel from "./pages/CivicIntel";
import Onboarding from "./pages/Onboarding";
import OS from "./pages/OS";

import { InstallBanner } from "@/components/pwa/InstallBanner";
import { AppUpdateListener } from "@/components/AppUpdateListener";
import { RestrictedGuard } from "@/components/RestrictedGuard";
import { FeatureGate } from "@/components/billing/FeatureGate";
import NotFound from "./pages/NotFound";
import Unsubscribe from "./pages/Unsubscribe";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrgProvider>
            <TimezoneProvider>
            <UpgradeProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<SignIn />} />
              <Route path="/signup" element={<Navigate to="/login?tab=signup" replace />} />
              <Route path="/signin" element={<Navigate to="/login?tab=signin" replace />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/changelog" element={<ChangelogPage />} />
              <Route path="/roadmap" element={<RoadmapPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/os" element={<OS />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/book/:username/:slug" element={<BookingPublic />} />
              <Route path="/meet/:token" element={<ContactMeetPublic />} />
              <Route path="/card/:username" element={<CardPublic />} />
              <Route path="/oauth-callback/:platform" element={<OAuthCallback />} />
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/vision" element={<Vision />} />
                <Route path="/inbox" element={<InboxPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/grants" element={<Grants />} />
                <Route path="/tasks/:id" element={<TaskFullPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/bookings" element={<BookingsPage />} />
                <Route path="/social" element={<FeatureGate feature="social"><Social /></FeatureGate>} />
                <Route path="/agents" element={<FeatureGate feature="agents"><Agents /></FeatureGate>} />
                <Route path="/chat" element={<FeatureGate feature="team_chat"><ChatPage /></FeatureGate>} />
                <Route path="/meetings" element={<FeatureGate feature="meetings"><MeetingsPage /></FeatureGate>} />
                <Route path="/notifications" element={<RestrictedGuard><NotificationsPage /></RestrictedGuard>} />
                <Route path="/contacts" element={<ContactsPage />} />
                <Route path="/knowledge" element={<KnowledgePage />} />
                
                <Route path="/finance" element={<RestrictedGuard><FinancePage /></RestrictedGuard>} />
                <Route path="/capital-raise" element={<RestrictedGuard><CapitalRaise /></RestrictedGuard>} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/my-card" element={<MyCardSettings />} />
                <Route path="/settings/ai" element={<AISettings />} />
                <Route path="/settings/token-health" element={<TokenHealthPage />} />
                <Route path="/settings/integrations/make" element={<MakeIntegration />} />
                <Route path="/civic-intel" element={<CivicIntel />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            <InstallBanner />
            <AppUpdateListener />
            </UpgradeProvider>
            </TimezoneProvider>
          </OrgProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
