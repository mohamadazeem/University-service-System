import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, Eye, EyeOff, GraduationCap, Headphones, IdCard, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import api, { errorMessage } from "../api/client";
import ThemeToggle from "../components/ThemeToggle";
import "../styles/register.css";

const empty = { name: "", email: "", studentId: "", phone: "", password: "" };
export default function Register() {
  const [form, setForm] = useState(empty), [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState({ password: false, confirm: false });
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [success, setSuccess] = useState(false);
  const lock = useRef(false);
  const change = event => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async event => {
    event.preventDefault();
    if (lock.current) return;
    setSuccess(false); setMessage("");
    if (form.password !== confirm) { setMessage("Passwords do not match. Please confirm your password."); return; }
    if (new TextEncoder().encode(form.password).length > 72) { setMessage("Password must be at most 72 UTF-8 bytes."); return; }
    lock.current = true; setBusy(true);
    try {
      const { data } = await api.post("/auth/register", form);
      setMessage(data.message); setSuccess(true); setForm(empty); setConfirm(""); setVisible({ password: false, confirm: false });
    } catch (error) { setMessage(errorMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <main className="registration-page">
    <aside className="registration-story" aria-label="University Services">
      <Link to="/" className="registration-brand"><span>U</span>University Services</Link>
      <div className="registration-story-copy"><div className="registration-rule" /><h2>Your Journey<br />at University Starts Here.</h2><p>Create your student account to access university services, make requests, book appointments and get support.</p></div>
      <div className="registration-benefits">{[[GraduationCap, "Access", "University Services"], [CalendarDays, "Book", "Appointments"], [Headphones, "Get", "timely Support"]].map(([Icon, first, second]) => <div key={first}><span><Icon size={26} aria-hidden="true" /></span><p>{first}<br />{second}</p></div>)}</div>
    </aside>
    <section className="registration-panel" aria-labelledby="registration-heading">
      <div className="registration-top"><Link to="/student/login" className="registration-back"><ArrowLeft size={19} aria-hidden="true" />Back to login</Link><ThemeToggle /></div>
      <div className="registration-content">
        <p className="eyebrow">STUDENT REGISTRATION</p>
        <h1 id="registration-heading">Create your student account</h1>
        <p className="registration-intro">Join University Services to access and manage your university services easily.</p>
        <form onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy} className="registration-fields">
            {[["name", "Full name", "Enter your full name", "text", "name", 100, UserRound], ["email", "Email address", "Enter your university email", "email", "email", 254, Mail], ["studentId", "Student ID", "e.g. E12345", "text", "off", 50, IdCard], ["phone", "Phone number (optional)", "Enter your phone number", "tel", "tel", 30, Phone]].map(([name, label, placeholder, type, autoComplete, maxLength, Icon]) => <label key={name} htmlFor={`registration-${name}`}>{label}<span className="registration-input"><Icon size={20} aria-hidden="true" /><input id={`registration-${name}`} name={name} type={type} value={form[name]} onChange={change} placeholder={placeholder} autoComplete={autoComplete} required={name === "name" || name === "email"} maxLength={maxLength} /></span></label>)}
            {[false, true].map(isConfirm => {
              const name = isConfirm ? "confirm" : "password", show = visible[name];
              return <div className="registration-password" key={name}><label htmlFor={`registration-${name}`}>{isConfirm ? "Confirm password" : "Password"}</label><div className="registration-input"><LockKeyhole size={20} aria-hidden="true" /><input id={`registration-${name}`} name={name} type={show ? "text" : "password"} value={isConfirm ? confirm : form.password} onChange={isConfirm ? event => setConfirm(event.target.value) : change} autoComplete="new-password" placeholder={isConfirm ? "Confirm your password" : "Create a password"} required minLength={8} aria-describedby={!isConfirm ? "registration-password-help" : undefined} /><button type="button" className="registration-visibility" aria-label={`${show ? "Hide" : "Show"} ${isConfirm ? "confirm password" : "password"}`} aria-pressed={show} onClick={() => setVisible({ ...visible, [name]: !show })}>{show ? <Eye size={20} /> : <EyeOff size={20} />}</button></div>{!isConfirm && <small id="registration-password-help">At least 8 characters; at most 72 UTF-8 bytes.</small>}</div>;
            })}
          </fieldset>
          {message && <div className={`notice ${success ? "notice-success" : "notice-error"}`} role={success ? "status" : "alert"}>{message}{success && <> <Link to="/student/login">Sign in →</Link></>}</div>}
          <button className="registration-submit" disabled={busy}>{busy ? "Creating account…" : "Create student account"}</button>
        </form>
        <div className="registration-divider"><span>or</span></div>
        <p className="registration-signin">Already have an account? <Link to="/student/login">Sign in</Link></p>
      </div>
    </section>
  </main>;
}
