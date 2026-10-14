import { useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage } from "../api/client";
export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    studentId: "",
    phone: "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const change = (event) =>
    setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      const { data } = await api.post("/auth/register", form);
      setMessage(data.message);
      setSuccess(true);
      setForm({ name: "", email: "", password: "", studentId: "", phone: "" });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">STUDENT REGISTRATION</p>
        <h1>Create your account</h1>
        <p className="muted">
          One account for your university service requests.
        </p>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <label>
              Full name
              <input
                name="name"
                value={form.name}
                onChange={change}
                autoComplete="name"
                required
                maxLength={100}
              />
            </label>
            <label>
              Email address
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={change}
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={change}
                autoComplete="new-password"
                required
                minLength={8}
              />
              <small>At least 8 characters; at most 72 UTF-8 bytes.</small>
            </label>
            <div className="form-grid">
              <label>
                Student ID
                <input
                  name="studentId"
                  value={form.studentId}
                  onChange={change}
                  maxLength={50}
                />
              </label>
              <label>
                Phone (optional)
                <input
                  name="phone"
                  value={form.phone}
                  onChange={change}
                  autoComplete="tel"
                  maxLength={30}
                />
              </label>
            </div>
          </fieldset>
          {message && (
            <div
              className={`notice ${success ? "notice-success" : "notice-error"}`}
              role={success ? "status" : "alert"}
            >
              {message}
              {success && (
                <>
                  {" "}
                  <Link to="/login">Sign in →</Link>
                </>
              )}
            </div>
          )}
          <button className="full-width" disabled={busy}>
            {busy ? "Creating account…" : "Create student account"}
          </button>
        </form>
        <p className="auth-footer">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
