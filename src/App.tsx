import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrgProvider } from "@/contexts/OrgContext";
import { TimezoneProvider } from "@/contexts/TimezoneContext";
import { AppShell } from "@/components/visi/AppShell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import InboxPage from "./pages/Inbox";
import BookingsPage from "./pages/Bookings";
import BookingPublic from "./pages/BookingPublic";
import SettingsPage from "./pages/Settings";
import CalendarPage from "./pages/Calendar";
import TasksPage from "./pages/Tasks";
import ChatPage from "./pages/Chat";
import MeetingsPage from "./pages/Meetings";
import TokenHealthPage from "./pages/TokenHealth";
import {
  NotificationsPage, FinancePage,
} from "./pages/EmptyPages";
import ContactsPage from "./pages/Contacts";
import CardPublic from "./pages/CardPublic";
import MyCardSettings from "./pages/MyCardSettings";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import NotFound from "./pages/NotFound";

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
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/book/:username/:slug" element={<BookingPublic />} />
              <Route path="/card/:username" element={<CardPublic />} />
              <Route element={<AppShell />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/inbox" element={<InboxPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/bookings" element={<BookingsPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/contacts" element={<ContactsPage />} />
                <Route path="/meetings" element={<MeetingsPage />} />
                <Route path="/finance" element={<FinancePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/my-card" element={<MyCardSettings />} />
                <Route path="/settings/token-health" element={<TokenHealthPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            <InstallBanner />
            </TimezoneProvider>
          </OrgProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
