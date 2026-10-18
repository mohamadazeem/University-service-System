import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, Eye, EyeOff, IdCard, LockKeyhole, Mail, Settings, UserRound, UsersRound } from "lucide-react";
import api, { errorMessage } from "../api/client";
import ThemeToggle from "../components/ThemeToggle";
import "../styles/register.css";

const empty = { name: "", email: "", staffId: "", password: "" };
export default function StaffRegister() {
  const [form, setForm] = useState(empty), [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState({ password: false, confirm: false });
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const lock = useRef(false);
  const change = event => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async event => {
    event.preventDefault();
    if (lock.current) return;
    setError(""); setSuccess("");
    if (form.password !== confirm) { setError("Passwords do not match. Please confirm your password."); return; }
    if (new TextEncoder().encode(form.password).length > 72) { setError("Password must contain at most 72 UTF-8 bytes"); return; }
    lock.current = true; setBusy(true);
    try {
      const { data } = await api.post("/auth/staff/register", form);
      setSuccess(data.message); setForm(empty); setConfirm(""); setVisible({ password: false, confirm: false });
    } catch (err) { setError(errorMessage(err)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <main className="registration-page staff-registration-page">
    <aside className="registration-story" aria-label="University Services">
      <Link to="/" className="registration-brand"><span>U</span>University Services</Link>
      <div className="registration-story-copy"><div className="registration-rule" /><h2>Empowering<br />University Staff.</h2><p>Manage student requests, appointments and services in one place.</p></div>
      <div className="registration-benefits">{[[Settings, "Manage", "Requests"], [CalendarDays, "Handle", "Appointments"], [UsersRound, "Support", "Students"]].map(([Icon, first, second]) => <div key={first}><span><Icon size={26} aria-hidden="true" /></span><p>{first}<br />{second}</p></div>)}</div>
    </aside>
    <section className="registration-panel" aria-labelledby="staff-registration-heading">
      <div className="registration-top"><Link to="/staff/login" className="registration-back"><ArrowLeft size={19} aria-hidden="true" />Back to login</Link><ThemeToggle /></div>
      <div className="registration-content">
        <p className="eyebrow">STAFF REGISTRATION</p><h1 id="staff-registration-heading">Create your staff account</h1>
        <p className="registration-intro">Join University Services to manage student requests, appointments and more.</p>
        <form onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy} className="registration-fields">
            {[["name", "Full name", "Enter your full name", "text", "name", 100, UserRound], ["email", "Email address", "Enter your university email", "email", "email", 254, Mail], ["staffId", "Staff ID / Employee Number", "e.g. S12345", "text", "off", 50, IdCard]].map(([name, label, placeholder, type, autoComplete, maxLength, Icon]) => <label key={name} htmlFor={`staff-${name}`} className={name === "staffId" ? "staff-registration-wide" : undefined}>{label}<span className="registration-input"><Icon size={20} aria-hidden="true" /><input id={`staff-${name}`} name={name} type={type} autoComplete={autoComplete} value={form[name]} onChange={change} required maxLength={maxLength} placeholder={placeholder} /></span></label>)}
            {[false, true].map(isConfirm => {
              const name = isConfirm ? "confirm" : "password", show = visible[name];
              return <div className="registration-password" key={name}><label htmlFor={`staff-${name}`}>{isConfirm ? "Confirm password" : "Password"}</label><div className="registration-input"><LockKeyhole size={20} aria-hidden="true" /><input id={`staff-${name}`} name={name} type={show ? "text" : "password"} autoComplete="new-password" value={isConfirm ? confirm : form.password} onChange={isConfirm ? event => setConfirm(event.target.value) : change} required minLength={8} placeholder={isConfirm ? "Confirm your password" : "Create a password"} aria-describedby="staff-password-help" /><button className="registration-visibility" type="button" aria-label={`${show ? "Hide" : "Show"} ${isConfirm ? "confirm password" : "password"}`} aria-pressed={show} aria-controls={`staff-${name}`} onClick={() => setVisible({ ...visible, [name]: !show })}>{show ? <Eye size={20} /> : <EyeOff size={20} />}</button></div></div>;
            })}
          </fieldset>
          <p className="registration-password-help" id="staff-password-help">At least 8 characters; at most 72 UTF-8 bytes.</p>
          <p className="staff-registration-approval">Your account requires administrator approval before you can sign in.</p>
          {error && <div className="notice notice-error" role="alert">{error}</div>}
          {success && <div className="notice notice-success" role="status">{success}</div>}
          <button type="submit" className="registration-submit" disabled={busy}>{busy ? "Submitting…" : "Create staff account"}</button>
        </form>
        <div className="registration-divider"><span>or</span></div>
        <p className="registration-signin">Already have an account? <Link to="/staff/login">Sign in</Link></p>
      </div>
    </section>
  </main>;
}
