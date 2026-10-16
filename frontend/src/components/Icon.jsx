import { LayoutDashboard, ClipboardList, Users, LibraryBig, CalendarDays, MessageSquareText, Bell, ArrowUpRight, GraduationCap, ShieldCheck } from "lucide-react";
const icons = { overview: LayoutDashboard, requests: ClipboardList, users: Users, services: LibraryBig, appointments: CalendarDays, complaints: MessageSquareText, notifications: Bell, arrow: ArrowUpRight, student: GraduationCap, admin: ShieldCheck };
export default function Icon({ name, size = 22 }) {
  const Component = icons[name] || LibraryBig;
  return <Component className="ui-icon" size={size} strokeWidth={1.7} aria-hidden="true" />;
}
