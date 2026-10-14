import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";
import { errorMessage } from "../api/client";
export default function Login({ adminOnly = false }) {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const user = await login(email, password);
      if (adminOnly && user.role !== "admin") {
        logout();
        setMessage("This account does not have administrator access.");
        return;
      }
      const destination =
        user.role === "admin"
          ? "/admin"
          : location.state?.from?.startsWith("/admin")
            ? "/dashboard"
            : location.state?.from || "/dashboard";
      navigate(destination, { replace: true });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" to="/">
          <span className="brand-mark">U</span>University Services
        </Link>
        <p className="eyebrow">
          {adminOnly ? "ADMINISTRATION" : "WELCOME BACK"}
        </p>
        <h1>{adminOnly ? "Admin sign in" : "Sign in to your account"}</h1>
        <p className="muted">
          {adminOnly
            ? "Secure access for university administrators."
            : "Access your university services and track your requests."}
        </p>
        <form onSubmit={submit}>
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              maxLength={254}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {message && (
            <div className="notice notice-error" role="alert">
              {message}
            </div>
          )}
          <button className="full-width" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="auth-footer">
          {adminOnly ? (
            <Link to="/login">Student sign in</Link>
          ) : (
            <>
              New student? <Link to="/register">Create an account</Link> ·{" "}
              <Link to="/admin/login">Admin sign in</Link>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
