import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrgProvider } from "@/contexts/OrgContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { TimezoneProvider } from "@/contexts/TimezoneContext";
import { UpgradeProvider } from "@/contexts/UpgradeContext";
import SignIn from "./pages/SignIn";
import Landing from "./pages/Landing";
import ResetPassword from "./pages/ResetPassword";
import { TermsPage, PrivacyPage, ChangelogPage, RoadmapPage, AboutPage, BlogPage } from "./pages/StubPages";
import { Navigate } from "react-router-dom";
import BookingPublic from "./pages/BookingPublic";
import ContactMeetPublic from "./pages/ContactMeetPublic";
import CardPublic from "./pages/CardPublic";
import OAuthCallback from "./pages/OAuthCallback";
import Onboarding from "./pages/Onboarding";
import OS from "./pages/OS";

import { InstallBanner } from "@/components/pwa/InstallBanner";
import { AppUpdateListener } from "@/components/AppUpdateListener";
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
          <TenantProvider>
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
              <Route path="/dashboard" element={<Navigate to="/os" replace />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/book/:username/:slug" element={<BookingPublic />} />
              <Route path="/meet/:token" element={<ContactMeetPublic />} />
              <Route path="/card/:username" element={<CardPublic />} />
              <Route path="/oauth-callback/:platform" element={<OAuthCallback />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <InstallBanner />
            <AppUpdateListener />
            </UpgradeProvider>
            </TimezoneProvider>
          </OrgProvider>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
