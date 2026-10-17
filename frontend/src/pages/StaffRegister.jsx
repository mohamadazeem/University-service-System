import { useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import { Notice } from "../admin/AdminUI";
import "../styles/login.css";

const empty = { name: "", email: "", staffId: "", password: "" };
export default function StaffRegister() {
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError(""); setSuccess("");
    if (new TextEncoder().encode(form.password).length > 72) { setError("Password must contain at most 72 UTF-8 bytes"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/auth/staff/register", form);
      setSuccess(data.message); setForm(empty);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  return <main className="auth-page"><section className="auth-card">
    <p className="eyebrow">STAFF AND LECTURER REGISTRATION</p>
    <h1>Staff Registration</h1>
    <p className="muted">Register using your details. Your account must be approved by an administrator before you can sign in.</p>
    <Notice error>{error}</Notice><Notice>{success}</Notice>
    <form onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy}>
        <label htmlFor="staff-name">Full Name</label><input id="staff-name" name="name" autoComplete="name" value={form.name} onChange={change} required maxLength={100} />
        <label htmlFor="staff-email">Email</label><input id="staff-email" name="email" type="email" autoComplete="email" value={form.email} onChange={change} required maxLength={254} />
        <label htmlFor="staff-id">Staff ID / Employee Number</label><input id="staff-id" name="staffId" value={form.staffId} onChange={change} required maxLength={50} />
        <label htmlFor="staff-password">Password</label>
        <div className="password-field">
          <input id="staff-password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={form.password} onChange={change} required minLength={8} maxLength={72} />
          <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} aria-controls="staff-password" aria-pressed={showPassword}>{showPassword ? "Hide" : "Show"}</button>
        </div>
        <small>At least 8 characters; at most 72 UTF-8 bytes.</small>
        <button className="full-width" type="submit">{busy ? "Submitting…" : "Submit for approval"}</button>
      </fieldset>
    </form>
    <p className="auth-footer">Already registered? <Link to="/staff/login">Staff Login</Link></p>
  </section></main>;
}
