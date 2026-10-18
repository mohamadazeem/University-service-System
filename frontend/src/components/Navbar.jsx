import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./NotificationBell";
export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  if ((user?.role === "staff" && (location.pathname === "/staff" || location.pathname.startsWith("/staff/"))) || location.pathname.startsWith("/admin") || ["/login", "/student/login", "/staff/login", "/register"].includes(location.pathname)) return null;
  return (
    <header className={`site-header ${user ? "authenticated-header" : ""}`}>
      <Link className="site-brand" to="/">
        <span className="brand-mark">U</span>
        <span>University Services</span>
      </Link>
      <nav aria-label="Main navigation">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/services">Services</NavLink>
        {user ? (
          <>
            {user.role === "student" && <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink to="/my-requests">My requests</NavLink>
              <NavLink to="/appointments">Appointments</NavLink>
              <NavLink to="/complaints">Complaints</NavLink>
            </>}
            {user.role === "staff" && <NavLink to="/staff">Staff dashboard</NavLink>}
            <NavLink to="/profile">Profile</NavLink>
            <NavLink to="/notifications">Notifications</NavLink>
            {user.role === "admin" && (
              <NavLink to="/admin">Admin portal</NavLink>
            )}
            <button
              className="secondary"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login">Sign in</NavLink>
            <Link className="button-link" to="/register">
              Register
            </Link>
          </>
        )}
        {!user && <ThemeToggle />}
      </nav>
      {user && <div className="site-header-actions"><NotificationBell /><ThemeToggle /></div>}
    </header>
  );
}
