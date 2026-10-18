import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, Eye, EyeOff, FileText, GraduationCap, Headphones, Info, LockKeyhole, Mail, UsersRound, ShieldCheck } from "lucide-react";
import useAuth from "../auth/useAuth";
import { errorMessage } from "../api/client";
import ThemeToggle from "../components/ThemeToggle";
import "../styles/login.css";
import "../styles/register.css";

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
      <aside className="registration-story login-story" aria-label="University Services">
        <Link className="registration-brand" to="/"><span>U</span>University Services</Link>
        <div className="registration-story-copy"><div className="registration-rule" /><h2>Connecting Students<br />to University Services.</h2><p>Your central platform for university services, requests, and support.</p></div>
        <div className="registration-benefits">{[[FileText, "Access", "University Services"], [CalendarDays, "Book", "Appointments"], [Headphones, "Get", "Timely Support"]].map(([Icon, first, second]) => <div key={first}><span><Icon size={26} aria-hidden="true" /></span><p>{first}<br />{second}</p></div>)}</div>
      </aside>
      <main className="login-content">
        <header className="login-panel-header">
        <Link className="registration-back" to="/"><ArrowLeft size={18} aria-hidden="true" />Home</Link>
        <nav className="login-nav" aria-label="Main navigation">
          <Link to="/services">Services</Link>
          {user && roles[user.role] && <Link to={roles[user.role].dashboard}>My dashboard</Link>}
          <ThemeToggle />
        </nav>
        </header>
        <section className="auth-card portal-login-card" aria-labelledby="login-title">
          <div className="login-welcome"><p className="eyebrow">WELCOME BACK</p><h1 id="login-title">Sign in to University Services</h1><p className="login-intro">Access your account to manage your requests, appointments and more.</p></div>
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
              <div className="login-icon-field"><Mail size={22} aria-hidden="true" /><input id="login-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" maxLength={254} placeholder="Email address" required /></div>
              <label htmlFor="login-password">Password</label>
              <div className="password-field login-icon-field"><LockKeyhole size={22} aria-hidden="true" />
                <input id="login-password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" maxLength={200} placeholder="Password" aria-describedby={message ? "login-error" : undefined} required />
                <button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} aria-controls="login-password" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <Eye size={21} /> : <EyeOff size={21} />}</button>
              </div>
              {message && <div id="login-error" className="notice notice-error" role="alert">{message}</div>}
              <button className="full-width portal-submit" type="submit">
                {busy ? <><span className="login-spinner" aria-hidden="true" /> Signing in…</> : <>Sign In <ArrowRight size={21} aria-hidden="true" /></>}
              </button>
            </fieldset>
          </form>
          <div className="login-account-help">
            <div className="registration-divider"><span>or</span></div>
            {role === "student" && <><p>Don't have an account? <Link to="/register">Create an account</Link></p><div className="login-student-note"><Info size={24} aria-hidden="true" /><p>This portal is for students to access and manage university services.</p></div></>}
            {role === "staff" && <>
              <p>New staff member? <Link to="/staff/register">Register for approval</Link></p>
              <div className="login-student-note"><Info size={18} aria-hidden="true" /><p>Staff accounts require administrator approval before signing in.</p></div>
            </>}
            {role === "admin" && <div className="login-student-note"><Info size={18} aria-hidden="true" /><p>Administrators must use authorized existing accounts.</p></div>}
          </div>
        </section>
      </main>
    </div>
  );
}
