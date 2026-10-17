import { useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import useResource from "../hooks/useResource";
import { LoadingError, Notice } from "../admin/AdminUI";

const empty = { name: "", email: "", staffId: "", department: "", password: "", confirmPassword: "" };
export default function StaffRegister() {
  const departments = useResource("/auth/departments");
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setError(""); setSuccess("");
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
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
    <h1>Join your department</h1>
    <p className="muted">An administrator will verify your staff information and department before you can sign in.</p>
    <LoadingError resource={departments} />
    <Notice error>{error}</Notice><Notice>{success}</Notice>
    {!departments.loading && !departments.error && <form onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy || !departments.data.departments.length}>
        <label>Full name<input name="name" autoComplete="name" value={form.name} onChange={change} required maxLength={100} /></label>
        <label>University email<input name="email" type="email" autoComplete="email" value={form.email} onChange={change} required maxLength={254} /></label>
        <label>Staff ID / employee number (optional)<input name="staffId" value={form.staffId} onChange={change} maxLength={50} /></label>
        <label htmlFor="staff-department">Department</label><select id="staff-department" name="department" value={form.department} onChange={change} required>
          <option value="">Choose your department</option>
          {departments.data.departments.map((department) => <option key={department}>{department}</option>)}
        </select>
        <label>Password<input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={form.password} onChange={change} required minLength={8} maxLength={72} /></label>
        <small>At least 8 characters; at most 72 UTF-8 bytes.</small>
        <label>Confirm password<input name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" value={form.confirmPassword} onChange={change} required minLength={8} maxLength={72} aria-invalid={Boolean(form.confirmPassword && form.password !== form.confirmPassword)} /></label>
        {form.confirmPassword && form.password !== form.confirmPassword && <small role="status">Passwords do not match.</small>}
        <button type="button" className="secondary" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword}>{showPassword ? "Hide passwords" : "Show passwords"}</button>
        <button className="full-width" type="submit">{busy ? "Submitting…" : "Submit for approval"}</button>
      </fieldset>
      {!departments.data.departments.length && <p role="status">Departments have not been configured. Contact the university administrator.</p>}
    </form>}
    <p className="auth-footer">Already registered? <Link to="/staff/login">Staff sign in</Link></p>
  </section></main>;
}
