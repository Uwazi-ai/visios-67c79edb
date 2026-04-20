import { Inbox, CheckSquare, Calendar, Link2, MessageSquare, Bell, Users, Video, BarChart3, SlidersHorizontal } from "lucide-react";
import { PagePlaceholder } from "@/components/visi/PagePlaceholder";

export const InboxPage = () => <PagePlaceholder title="Inbox" icon={Inbox} />;
export const TasksPage = () => <PagePlaceholder title="Tasks" icon={CheckSquare} />;
export const CalendarPage = () => <PagePlaceholder title="Calendar" icon={Calendar} />;
export const BookingsPage = () => <PagePlaceholder title="Bookings" icon={Link2} />;
export const ChatPage = () => <PagePlaceholder title="Chat" icon={MessageSquare} />;
export const NotificationsPage = () => <PagePlaceholder title="Notifications" icon={Bell} />;
export const ContactsPage = () => <PagePlaceholder title="Contacts" icon={Users} />;
export const MeetingsPage = () => <PagePlaceholder title="Meetings" icon={Video} />;
export const FinancePage = () => <PagePlaceholder title="Finance" icon={BarChart3} />;
export const SettingsPage = () => <PagePlaceholder title="Settings" icon={SlidersHorizontal} hint="Workspace preferences, integrations, and team management land here." />;
