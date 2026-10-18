import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GraduationCap, UsersRound, ShieldCheck } from "lucide-react";
import useAuth from "../auth/useAuth";
import { errorMessage } from "../api/client";
import ThemeToggle from "../components/ThemeToggle";
import "../styles/login.css";

const roles = {
  student: { label: "Student", path: "/student/login", dashboard: "/dashboard", icon: GraduationCap },
  staff: { label: "Staff / Lecturer", path: "/staff/login", dashboard: "/staff", icon: UsersRound },
  admin: { label: "Admin", path: "/admin/login", dashboard: "/admin", icon: ShieldCheck },
};

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routeRole = location.pathname === roles.admin.path ? "admin"
    : location.pathname === roles.staff.path ? "staff" : "student";
  const [selection, setSelection] = useState({ path: location.pathname, role: routeRole });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  // Update radios immediately on selection, and also follow browser Back/Forward.
  if (selection.path !== location.pathname) {
    setSelection({ path: location.pathname, role: routeRole });
  }
  const role = selection.role;

  const selectRole = (nextRole) => {
    if (busy || nextRole === role) return;
    setSelection({ ...selection, role: nextRole });
    setPassword("");
    setShowPassword(false);
    setMessage("");
    navigate(roles[nextRole].path, { replace: true, state: location.state });
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setMessage("");
    if (!email.trim() || !password) {
      setMessage("Enter your email address and password.");
      return;
    }
    setBusy(true);
    try {
      const account = await login(email.trim(), password, role);
      navigate(roles[account.role].dashboard, { replace: true });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="portal-page unified-login-page">
      <header className="portal-header">
        <Link className="auth-brand" to="/">
          <span className="brand-mark">U</span>University Services
        </Link>
        <nav className="login-nav" aria-label="Main navigation">
          <Link to="/services">Services</Link>
          {user && roles[user.role] && <Link to={roles[user.role].dashboard}>My dashboard</Link>}
          <ThemeToggle />
        </nav>
      </header>
      <main className="login-content">
        <div className="login-welcome">
          <h1>Welcome to University Services</h1>
          <p>Access university services, manage requests, and stay updated in one place.</p>
        </div>
        <section className="auth-card portal-login-card" aria-labelledby="login-title">
          <h2 id="login-title">Sign in to your account</h2>
          <p className="login-intro">Select your role to continue.</p>
          {location.state?.sessionRequired && <p className="notice" role="status">Please sign in to continue. Your session may have expired.</p>}
          <form onSubmit={submit} aria-busy={busy}>
            <fieldset disabled={busy}>
              <div className="login-roles" role="radiogroup" aria-label="Sign in role">
                {Object.entries(roles).map(([value, { label, icon: RoleIcon }]) => (
                  <label key={value} className={`login-role ${role === value ? "is-selected" : ""}`}>
                    <input type="radio" name="portal" value={value} checked={role === value} onChange={() => selectRole(value)} />
                    <RoleIcon size={17} strokeWidth={1.8} aria-hidden="true" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <label htmlFor="login-email">University email</label>
              <input id="login-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" maxLength={254} placeholder="name@university.edu" required />
              <label htmlFor="login-password">Password</label>
              <div className="password-field">
                <input id="login-password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" maxLength={200} aria-describedby={message ? "login-error" : undefined} required />
                <button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} aria-controls="login-password" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button>
              </div>
              {message && <div id="login-error" className="notice notice-error" role="alert">{message}</div>}
              <button className="full-width portal-submit" type="submit">
                {busy ? <><span className="login-spinner" aria-hidden="true" /> Signing in…</> : "Sign In"}
              </button>
            </fieldset>
          </form>
          <div className="login-account-help">
            {role === "student" && <p>New student? <Link to="/register">Create an account</Link></p>}
            {role === "staff" && <>
              <p>New staff member? <Link to="/staff/register">Register for approval</Link></p>
              <p className="login-role-note">Staff accounts require administrator approval before signing in.</p>
            </>}
            {role === "admin" && <p className="login-role-note">Administrators must use authorized existing accounts.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
