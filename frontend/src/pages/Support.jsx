import { useState } from "react";
import api, { errorMessage } from "../api/client";
import useResource from "../hooks/useResource";
import { Badge, LoadingError, Notice, Pagination } from "../admin/AdminUI";
import Modal from "../components/Modal";
import { dateTime } from "../admin/adminUtils";
const transitions = {
  appointments: {
    Pending: ["Approved", "Rejected"],
    Approved: ["Completed", "Rejected"],
    Completed: [],
    Rejected: []
  },
  complaints: {
    Pending: ["In Review", "Resolved", "Rejected"],
    "In Review": ["Resolved", "Rejected"],
    Resolved: [],
    Rejected: []
  }
};
export default function Support({
  kind,
  admin = false
}) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const appointments = kind === "appointments";
  const title = appointments ? "Appointments" : "Complaints";
  const Container = admin ? "section" : "main";
  const base = `${admin ? "/admin" : ""}/${kind}`;
  const resource = useResource(`${base}?page=${page}&status=${encodeURIComponent(filter)}`);
  const availability = useResource(appointments ? "/appointments/availability" : null);
  const staff = useResource(admin && appointments ? "/admin/staff" : null);
  const save = async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (editing.type === "review") await api.patch(`${base}/${editing.row._id}`, {
        ...values,
        expectedStatus: editing.row.status
      });else if (editing.type === "slot") await api.post("/admin/appointment-slots", {
        ...values,
        startsAt: new Date(values.startsAt).toISOString()
      });else await api.post(base, values);
      setEditing(null);
      setSuccess("Saved successfully.");
      resource.reload();
      availability.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const closeSlot = async id => {
    setBusy(true);
    setError("");
    try {
      await api.delete(`/admin/appointment-slots/${id}`);
      availability.reload();
      setSuccess("Availability closed.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const open = value => {
    setError("");
    setSuccess("");
    setEditing(value);
  };
  return <Container className={admin ? "" : "page"}>
    <div className="page-heading"><div><p className="eyebrow">{admin ? "STUDENT SUPPORT" : "YOUR STUDENT PORTAL"}</p><h1>{title}</h1><p className="muted">{appointments ? "Book available times and follow approval progress. Times are shown in your device’s local timezone." : "Share a concern and follow the review, response, and resolution."}</p></div>
      <div className="button-row"><button className="secondary" onClick={() => {
          resource.reload();
          availability.reload();
        }}>Refresh</button>
      {(!admin || appointments) && <button onClick={() => open({
          type: admin ? "slot" : "new"
        })}>{admin ? "Publish availability" : appointments ? "Book appointment" : "Submit complaint"}</button>}</div>
    </div>
    <Notice>{success}</Notice>{!editing && <Notice error>{error}</Notice>}
    {admin && <label className="support-filter">Filter by status<select value={filter} onChange={e => {
        setFilter(e.target.value);
        setPage(1);
      }}><option value="">All statuses</option>{Object.keys(transitions[kind]).map(s => <option key={s}>{s}</option>)}</select></label>}
    <LoadingError resource={resource} />
    {!resource.loading && !resource.error && <section className="panel">
      {!resource.data.items.length && <div className="empty-state">{admin ? "No records match this view." : `No ${kind} yet. ${appointments ? "Choose an available time to get started." : "Submit a concern when you need help."}`}</div>}
      <div className="support-records">{resource.data.items.map(row => <article className="support-record" key={row._id}>
        <div className="panel-heading"><h2>{appointments ? dateTime(row.date) : row.subject}</h2><Badge value={row.status} /></div>
        {admin && <p className="muted">{row.student?.name || "Unavailable account"} {row.student?.studentId && `· ${row.student.studentId}`}</p>}
        <p className="preserve-lines">{appointments ? row.reason : row.description}</p>
        {row.response && <div className="support-response"><strong>Administrator response</strong><p className="preserve-lines">{row.response}</p></div>}
        <small>Submitted {dateTime(row.createdAt)}</small>
        {admin && transitions[kind][row.status]?.length > 0 && <button className="secondary" onClick={() => open({
            type: "review",
            row
          })}>Review</button>}
      </article>)}</div>
      <Pagination data={resource.data} page={page} onChange={setPage} />
    </section>}
    {admin && appointments && <section className="panel section-space"><h2>Available appointment times</h2><p className="muted">Each published time accepts one booking. Closing availability preserves existing appointments.</p><LoadingError resource={availability} />
      {!availability.loading && !availability.error && <>{!availability.data?.items.length && <p>No unbooked times available.</p>}{availability.data?.items.map(slot => <div className="availability-row" key={slot._id}><span>{dateTime(slot.startsAt)} · {slot.staff?.name}</span><button className="secondary" disabled={busy} onClick={() => closeSlot(slot._id)}>Close availability</button></div>)}</>}
    </section>}
    {editing && <Modal title={editing.type === "review" ? `Review ${appointments ? "appointment" : "complaint"}` : editing.type === "slot" ? "Publish availability" : appointments ? "Book appointment" : "Submit complaint"} onClose={() => setEditing(null)} busy={busy}>
      {editing.row && <p className="preserve-lines">{appointments ? editing.row.reason : editing.row.subject}</p>}
      <form onSubmit={save}><Notice error>{error}</Notice><fieldset disabled={busy}>
        {editing.type === "review" ? <><label>Status<select name="status" required>{transitions[kind][editing.row.status].map(s => <option key={s}>{s}</option>)}</select></label>{!appointments && <label>Response<textarea name="response" required maxLength={4000} rows={5} defaultValue={editing.row.response || ""} /></label>}</> : editing.type === "slot" ? <><LoadingError resource={staff} /><label>Staff member<select name="staff" required defaultValue=""><option value="" disabled>Select active staff</option>{staff.data?.staff.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label><label>Start date and time (your local timezone)<input type="datetime-local" name="startsAt" required /></label></> : appointments ? <><LoadingError resource={availability} />{!availability.loading && !availability.error && !availability.data?.items.length && <p role="status">No appointment times are currently available. Please check back later.</p>}<label>Available time<select name="slot" required defaultValue=""><option value="" disabled>Select a time</option>{availability.data?.items.map(s => <option key={s._id} value={s._id}>{dateTime(s.startsAt)} · {s.staff?.name}</option>)}</select></label><label>Reason<textarea name="reason" required maxLength={2000} rows={4} /></label></> : <><label>Subject<input name="subject" required maxLength={160} /></label><label>Description<textarea name="description" required maxLength={4000} rows={6} /></label></>}
        <div className="button-row"><button disabled={editing.type === "slot" ? staff.loading || !!staff.error || !staff.data?.staff.length : editing.type === "new" && appointments ? availability.loading || !!availability.error || !availability.data?.items.length : false}>{busy ? "Saving…" : "Save"}</button><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button></div>
      </fieldset></form>
    </Modal>}
  </Container>;
}
