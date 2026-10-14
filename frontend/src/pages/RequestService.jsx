import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import useAuth from "../auth/useAuth";
import useResource from "../hooks/useResource";
import api, { errorMessage } from "../api/client";
export default function RequestService() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const resource = useResource("/services");
  const [serviceId, setServiceId] = useState(params.get("serviceId") || "");
  const [studentId, setStudentId] = useState(user.studentId || "");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const selected =
    serviceId ||
    resource.data?.services.find(
      (service) => service.name === params.get("service"),
    )?._id ||
    "";
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      const { data } = await api.post("/requests", {
        serviceId: selected,
        studentId,
        description,
        priority,
      });
      setMessage(data.message);
      setSuccess(true);
      setDescription("");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="page narrow-page">
      <section className="panel form-panel">
        <p className="eyebrow">STUDENT SUPPORT</p>
        <h1>Request a service</h1>
        <p className="muted">
          Provide the details your department needs to assist you.
        </p>
        {resource.loading && <p role="status">Loading service catalogue…</p>}
        {resource.error && (
          <div className="notice notice-error" role="alert">
            {resource.error}
            <button onClick={resource.reload}>Retry</button>
          </div>
        )}
        {!resource.loading && !resource.error && (
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              <label>
                Service
                <select
                  value={selected}
                  onChange={(event) => setServiceId(event.target.value)}
                  required
                >
                  <option value="">Choose a service</option>
                  {resource.data.services.map((service) => (
                    <option key={service._id} value={service._id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Student ID
                <input
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  readOnly={Boolean(user.studentId)}
                  required
                  maxLength={50}
                />
              </label>
              <label>
                Priority
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                >
                  <option>Normal</option>
                  <option>Urgent</option>
                </select>
              </label>
              <label>
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                  maxLength={4000}
                  rows={6}
                  placeholder="Explain your request…"
                />
              </label>
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
                    <Link to="/my-requests">Track your request →</Link>
                  </>
                )}
              </div>
            )}
            <button
              className="full-width"
              disabled={busy || !resource.data.services.length}
            >
              {busy ? "Submitting…" : "Submit request"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
