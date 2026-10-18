import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, CalendarDays, MessageSquare, GraduationCap, LayoutDashboard, Files, Clock3, LoaderCircle, CircleCheck, UserRound, LogOut, Bell, PanelLeftClose, PanelLeftOpen, Menu, X, ChevronDown } from "lucide-react";
import useAuth from "../auth/useAuth";
import Modal from "../components/Modal";
import NotificationBell from "../components/NotificationBell";
import ThemeToggle from "../components/ThemeToggle";
import "../styles/staff.css";
const links = [
  ["Dashboard", "/staff", LayoutDashboard],
  ["Assigned Requests", "/staff/requests", Files],
  ["Pending Requests", "/staff/requests?status=Pending", Clock3],
  ["In Progress", "/staff/requests?status=Processing", LoaderCircle],
  ["Completed Requests", "/staff/requests?status=Completed", CircleCheck],
  ["Manage Time Slots", "/staff/appointments", CalendarDays],
  ["Bookings", "/staff/bookings", CalendarDays],
  ["My Assigned Complaints", "/staff/complaints", MessageSquare],
  ["Notifications", "/staff/notifications", Bell],
];
export default function StaffLayout({ student = false, children }) {
  const navigationLinks = student ? [["Dashboard", "/dashboard", LayoutDashboard], ["Browse Services", "/services", LayoutGrid], ["My Requests", "/my-requests", Files], ["Appointments", "/appointments", CalendarDays], ["Complaints", "/complaints", MessageSquare], ["Notifications", "/notifications", Bell]] : links;
  const home = student ? "/dashboard" : "/staff";
  const profile = student ? "/profile" : "/staff/profile";
  const roleLabel = student ? "Student" : "Staff / Lecturer";
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => {
    if (!accountOpen) return;
    const close = (event) => { if (event.key === "Escape") setAccountOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [accountOpen]);
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("");
  const title = student ? ({ "/dashboard": "Student Dashboard", "/services": "Browse Services", "/my-requests": "My Requests", "/appointments": "Appointments", "/complaints": "Complaints", "/notifications": "Notifications", "/profile": "Profile / Account", "/request-service": "Submit a Request" }[location.pathname] || "Student Workspace") : location.pathname.endsWith("appointments") ? "Appointments" : location.pathname.endsWith("bookings") ? "Booking Management" : location.pathname.endsWith("complaints") ? "My Assigned Complaints" : location.pathname.endsWith("profile") ? "Profile / Account" : location.pathname.endsWith("notifications") ? "Notifications" : location.pathname.endsWith("requests") ? "Service Requests" : "Staff Dashboard";
  const signOut = () => { logout(); navigate(student ? "/student/login" : "/staff/login"); };
  const navigation = <>
    <Link className="staff-brand" to={home} onClick={() => setMobileOpen(false)}><span className="staff-brand-icon"><GraduationCap size={24} /></span><span className="staff-nav-label">University<span>Service System</span></span></Link>
    <p className="staff-nav-caption">{student ? "STUDENT WORKSPACE" : "STAFF WORKSPACE"}</p>
    <nav aria-label={student ? "Student navigation" : "Staff navigation"}>{navigationLinks.map(([label, to, Icon]) => {
      const active = to.includes("?") ? location.pathname + "?status=" + new URLSearchParams(location.search).get("status") === to : location.pathname === to && (to !== "/staff/requests" || !new URLSearchParams(location.search).get("status"));
      return <Link key={to} to={to} title={label} aria-current={active ? "page" : undefined} className={active ? "active" : ""} onClick={() => setMobileOpen(false)}><Icon size={19} /><span className="staff-nav-label">{label}</span></Link>;
    })}</nav>
    <div className="staff-nav-bottom"><NavLink to={profile} title="Profile / Account" onClick={() => setMobileOpen(false)}><UserRound size={19} /><span className="staff-nav-label">Profile / Account</span></NavLink><button onClick={signOut} title="Logout"><LogOut size={19} /><span className="staff-nav-label">Logout</span></button></div>
    <div className="staff-sidebar-user"><span className="avatar">{initials}</span><span className="staff-nav-label"><strong>{user.name}</strong><small>{roleLabel}</small></span></div>
  </>;
  return <div className={`staff-shell ${student ? "student-workspace" : ""} ${collapsed ? "staff-collapsed" : ""}`}>
    <aside className="staff-sidebar">{navigation}<button className="staff-collapse" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen size={19} /> : <><PanelLeftClose size={19} /><span>Collapse sidebar</span></>}</button></aside>
    {mobileOpen && <Modal title={student ? "Student navigation" : "Staff navigation"} onClose={() => setMobileOpen(false)}><div className="staff-mobile-navigation">{navigation}</div></Modal>}
    <div className="staff-workspace"><header className="staff-topbar"><div className="staff-breadcrumb"><button className="secondary staff-mobile-toggle" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><span>Workspace</span><span>/</span><strong>{title}</strong></div><div className="staff-header-actions"><NotificationBell /><ThemeToggle /><div className="staff-account"><button className="staff-account-trigger" aria-expanded={accountOpen} aria-label="Account menu" onClick={() => setAccountOpen(!accountOpen)}><span className="avatar">{initials}</span><span className="staff-account-name">{user.name}<small>{roleLabel}</small></span>{accountOpen ? <X size={14} /> : <ChevronDown size={14} />}</button>{accountOpen && <><button className="staff-account-dismiss" aria-label="Close account menu" onClick={() => setAccountOpen(false)} /><div className="staff-account-menu"><Link to={profile} onClick={() => setAccountOpen(false)}><UserRound size={16} />My account</Link><button onClick={signOut}><LogOut size={16} />Logout</button></div></>}</div></div></header><div className="staff-content">{children || <Outlet />}</div><footer className="staff-footer">University Service System <span>{student ? "Student workspace · University services" : "Staff workspace · Assigned requests"}</span></footer></div>
  </div>;
}
