import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";
import { errorMessage } from "../api/client";
import PortalIcon from "../components/PortalIcon";
import "../styles/login.css";

export default function Login({ adminOnly = false }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!email.trim() || !password) {
      setMessage("Enter your email address and password.");
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password, adminOnly ? "admin" : "student");
      navigate(adminOnly ? "/admin" : "/dashboard", { replace: true });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="portal-page portal-form-page">
      <header className="portal-header">
        <Link className="auth-brand" to="/"><span className="brand-mark">U</span>University Services</Link>
        <Link className="portal-home" to="/login"><span aria-hidden="true">←</span> All portals</Link>
      </header>
      <section className="auth-card portal-login-card" aria-labelledby="login-title">
        <Link className="back-to-portals" to="/login"><span aria-hidden="true">←</span> Back to portal selection</Link>
        <span className="portal-icon"><PortalIcon admin={adminOnly} /></span>
        <p className="eyebrow">{adminOnly ? "ADMIN PORTAL" : "STUDENT PORTAL"}</p>
        <h1 id="login-title">{adminOnly ? "Administrator sign in" : "Student sign in"}</h1>
        <p className="muted">{adminOnly ? "Manage your university with confidence." : "Your next step starts here. Welcome back."}</p>
        {location.state?.sessionRequired && <p className="notice" role="status">Please sign in to continue. Your session may have expired.</p>}
        <form onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy}>
            <label htmlFor="login-email">{adminOnly ? "Administrator email" : "Email address"}</label>
            <input id="login-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" maxLength={254} placeholder={adminOnly ? "admin@university.edu" : "student@university.edu"} required />
            <label htmlFor="login-password">Password</label>
            <div className="password-field">
              <input id="login-password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" maxLength={200} required />
              <button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} aria-controls="login-password" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button>
            </div>
            {message && <div id="login-error" className="notice notice-error" role="alert">{message}</div>}
            <button className="full-width portal-submit" type="submit">{busy ? <><span className="login-spinner" aria-hidden="true" /> Signing in…</> : adminOnly ? "Admin Sign In" : "Sign In"}</button>
          </fieldset>
        </form>
        <p className="auth-footer">{adminOnly ? "Access is restricted to authorized administrators." : <>New student? <Link to="/register">Create an account</Link></>}</p>
      </section>
      <footer className="portal-footer"><span>University Service System</span><span>Here to support your university journey.</span></footer>
    </main>
  );
}
