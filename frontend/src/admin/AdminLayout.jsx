import { useEffect, useRef, useState } from "react";
import { Menu, X, PanelLeftClose, PanelLeftOpen, ChevronDown, ArrowUpRight } from "lucide-react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import useAuth from "../auth/useAuth";
import "./admin.css";
import Icon from "../components/Icon";
import ThemeToggle from "../components/ThemeToggle";
const links = [
  ["/admin", "Overview", "overview"],
  ["/admin/requests", "Requests", "requests"],
  ["/admin/users", "Users", "users"],
  ["/admin/staff-approvals", "Staff approvals", "users"],
  ["/admin/services", "Services", "services"],
  ["/admin/appointments", "Appointments", "appointments"],
  ["/admin/appointment-slots", "Availability", "appointments"],
  ["/admin/complaints", "Complaints", "complaints"],
  ["/admin/notifications", "Notifications", "notifications"],
];
export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebar = useRef(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () =>
      Array.from(sidebar.current.querySelectorAll("a, button")).filter(
        (element) => element.offsetParent !== null,
      );
    controls()[0]?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key === "Tab") {
        const items = controls();
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, [mobileOpen]);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const page =
    links.find(([path]) => path === location.pathname)?.[1] || "Administration";
  const signOut = () => {
    logout();
    navigate("/login");
  };
  return (
    <div className={`admin-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        id="admin-sidebar"
        ref={sidebar}
        className={`admin-sidebar ${mobileOpen ? "mobile-open" : ""}`}
      >
        <button
          className="mobile-sidebar-close"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        ><X size={20} aria-hidden="true" /></button>
        <Link to="/admin" className="admin-brand">
          <span className="brand-mark">U</span>
          <span className="sidebar-label">
            University Services<small>ADMINISTRATION</small>
          </span>
        </Link>
        <p className="nav-caption sidebar-label">WORKSPACE</p>
        <nav aria-label="Admin navigation">
          {links.map(([path, label, icon]) => (
            <NavLink
              end={path === "/admin"}
              key={path}
              to={path}
              title={label}
              aria-label={label}
              onClick={() => setMobileOpen(false)}
            >
              <Icon name={icon} />
              <span className="sidebar-label">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link to="/services" title="Service catalogue">
            <ArrowUpRight size={20} aria-hidden="true" />
            <span className="sidebar-label">Service catalogue</span>
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="collapse-toggle"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
            <span className="sidebar-label">Collapse sidebar</span>
          </button>
          <small className="sidebar-label">University Service System</small>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-title">
            <button
              className="secondary mobile-menu"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              aria-controls="admin-sidebar"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <span>
              Administration <span className="muted">/ {page}</span>
            </span>
          </div>
          <div className="topbar-actions"><ThemeToggle /><details className="profile-menu">
            <summary>
              <span className="avatar">{user?.name?.slice(0, 1)}</span>
              <span>
                {user?.name}
                <small>Administrator</small>
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div>
              <Link to="/profile">My profile</Link>
              <button onClick={signOut}>Sign out</button>
            </div>
          </details></div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
        <footer className="admin-footer">
          University Service System <span>Administration portal</span>
        </footer>
      </div>
    </div>
  );
}
