import { CheckSquare, Calendar, MessageSquare, Bell, Users, Video, BarChart3 } from "lucide-react";
import { PagePlaceholder } from "@/components/visi/PagePlaceholder";

export const TasksPage = () => <PagePlaceholder title="Tasks" icon={CheckSquare} />;
export const CalendarPage = () => <PagePlaceholder title="Calendar" icon={Calendar} />;
export const ChatPage = () => <PagePlaceholder title="Chat" icon={MessageSquare} />;
export const NotificationsPage = () => <PagePlaceholder title="Notifications" icon={Bell} />;
export const ContactsPage = () => <PagePlaceholder title="Contacts" icon={Users} />;
export const MeetingsPage = () => <PagePlaceholder title="Meetings" icon={Video} />;
export const FinancePage = () => <PagePlaceholder title="Finance" icon={BarChart3} />;
