import { useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import useResource from "../hooks/useResource";
import { Badge, LoadingError, Notice, Pagination } from "../admin/AdminUI";
import Modal from "../components/Modal";
import { dateTime } from "../admin/adminUtils";
import { appointmentDateTime } from "../utils/appointmentTime";
const transitions = {
  appointments: {
    Pending: ["Approved", "Rejected", "Cancelled"],
    Approved: ["Completed", "Rejected", "Cancelled"],
    Cancelled: [],
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
        startsAt: new Date(values.startsAt + "+05:30").toISOString()
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
    if (value.type === "slot") staff.reload();
    if (value.type === "new" && appointments) availability.reload();
    setEditing(value);
  };
  return <Container className={admin ? "" : "page"}>
    <div className="page-heading"><div><p className="eyebrow">{admin ? "STUDENT SUPPORT" : "YOUR STUDENT PORTAL"}</p><h1>{title}</h1><p className="muted">{appointments ? "Book available times and follow approval progress. Times are shown in Asia/Colombo." : "Share a concern and follow the review, response, and resolution."}</p></div>
      <div className="button-row">{admin && appointments && <Link className="button-link secondary" to="/admin/appointment-slots">Manage availability</Link>}<button className="secondary" onClick={() => {
          resource.reload();
          availability.reload();
          staff.reload();
        }}>Refresh</button>
      {(!admin || appointments) && <button onClick={() => open({
          type: admin ? "slot" : "new"
        })}>{admin ? "Publish availability" : appointments ? "Book appointment" : "Submit complaint"}</button>}</div>
    </div>
    <Notice>{success}</Notice>{!editing && <Notice error>{error}</Notice>}
    {admin && appointments && !staff.loading && !staff.error && !staff.data?.staff.length && <section className="panel form-panel" aria-label="Appointment setup">
      <h2>Add a staff member to enable bookings</h2>
      <p>Appointment times must belong to an active staff account. No active staff accounts are available yet.</p>
      <ol><li>Open Users and choose Create account with the staff role, or reactivate an existing staff account.</li><li>Return here and publish a future appointment time.</li><li>Students can then book that time from their Appointments page.</li></ol>
      <Link className="button-link" to="/admin/users">Manage staff accounts</Link>
    </section>}
    {admin && <label className="support-filter">Filter by status<select value={filter} onChange={e => {
        setFilter(e.target.value);
        setPage(1);
      }}><option value="">All statuses</option>{Object.keys(transitions[kind]).map(s => <option key={s}>{s}</option>)}</select></label>}
    <LoadingError resource={resource} />
    {!resource.loading && !resource.error && <section className="panel">
      {!resource.data.items.length && <div className="empty-state">{admin ? "No records match this view." : `No ${kind} yet. ${appointments ? "Choose an available time to get started." : "Submit a concern when you need help."}`}</div>}
      <div className="support-records">{resource.data.items.map(row => <article className="support-record" key={row._id}>
        <div className="panel-heading"><h2>{appointments ? appointmentDateTime(row.date) : row.subject}</h2><Badge value={row.status} /></div>
        {admin && <p className="muted">{row.student?.name || "Unavailable account"} {row.student?.studentId && `· ${row.student.studentId}`}</p>}
        {!appointments && <p className="muted">Department: {row.department || "Not specified"} / Assigned staff: {row.assignedStaff?.name || "Awaiting administrator assignment"}</p>}
        {!appointments && <p><Badge value={row.priority || "Medium"} /> / {row.category || "General"}</p>}
        <p className="preserve-lines">{appointments ? row.reason : row.description}</p>
        {row.response && <div className="support-response"><strong>University support response</strong><p className="preserve-lines">{row.response}</p></div>}
        <small>Submitted {dateTime(row.createdAt)}</small>
        {admin && transitions[kind][row.status]?.length > 0 && <button className="secondary" onClick={() => open({
            type: "review",
            row
          })}>Review</button>}
      </article>)}</div>
      <Pagination data={resource.data} page={page} onChange={setPage} />
    </section>}
    {admin && appointments && <section className="panel section-space"><h2>Available appointment times</h2><p className="muted">Each published time accepts one booking. Closing availability preserves existing appointments.</p><LoadingError resource={availability} />
      {!availability.loading && !availability.error && <>{!availability.data?.items.length && <p>No unbooked times available.</p>}{availability.data?.items.map(slot => <div className="availability-row" key={slot._id}><span>{appointmentDateTime(slot.startsAt)} · {slot.staff?.name}</span><button className="secondary" disabled={busy} onClick={() => closeSlot(slot._id)}>Close availability</button></div>)}</>}
    </section>}
    {editing && <Modal title={editing.type === "review" ? `Review ${appointments ? "appointment" : "complaint"}` : editing.type === "slot" ? "Publish availability" : appointments ? "Book appointment" : "Submit complaint"} onClose={() => setEditing(null)} busy={busy}>
      {editing.row && <p className="preserve-lines">{appointments ? editing.row.reason : editing.row.subject}</p>}
      <form onSubmit={save}><Notice error>{error}</Notice><fieldset disabled={busy}>
        {editing.type === "review" ? <><label>Status<select name="status" required>{transitions[kind][editing.row.status].map(s => <option key={s}>{s}</option>)}</select></label>{!appointments && <label>Response<textarea name="response" required maxLength={4000} rows={5} defaultValue={editing.row.response || ""} /></label>}</> : editing.type === "slot" ? <><LoadingError resource={staff} />{!staff.loading && !staff.error && !staff.data?.staff.length && <div className="notice" role="status"><p>No active staff accounts are available. Create or reactivate a staff account before publishing an appointment time.</p><Link to="/admin/users">Manage staff accounts</Link><button type="button" className="secondary" onClick={staff.reload}>Refresh staff list</button></div>}<label>Staff member<select name="staff" required defaultValue=""><option value="" disabled>Select active staff</option>{staff.data?.staff.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label><label>Start date and time (Asia/Colombo)<input type="datetime-local" name="startsAt" required /></label><label>Location / resource details<input name="location" maxLength={200} placeholder="Office, room or online meeting" /></label></> : appointments ? <><LoadingError resource={availability} />{!availability.loading && !availability.error && !availability.data?.items.length && <p role="status">No appointment times have been published yet, or all available times are booked. Ask your university administrator to publish a future appointment time, then refresh this page.</p>}<label>Available time<select name="slot" required defaultValue=""><option value="" disabled>Select a time</option>{availability.data?.items.map(s => <option key={s._id} value={s._id}>{appointmentDateTime(s.startsAt)} · {s.staff?.name}</option>)}</select></label><label>Reason<textarea name="reason" required maxLength={2000} rows={4} /></label></> : <><label>Subject<input name="subject" required maxLength={160} /></label><label>Department<select aria-label="Department" name="department" defaultValue=""><option value="">Not specified</option>{resource.data?.departments?.map(value => <option key={value}>{value}</option>)}</select></label><label>Category<select name="category" defaultValue="General">{(resource.data?.categories || ["General"]).map(value => <option key={value}>{value}</option>)}</select></label><label>Priority<select name="priority" defaultValue="Medium">{(resource.data?.priorities || ["Medium"]).map(value => <option key={value}>{value}</option>)}</select></label><label>Description<textarea name="description" required maxLength={4000} rows={6} /></label></>}
        <div className="button-row"><button disabled={editing.type === "slot" ? staff.loading || !!staff.error || !staff.data?.staff.length : editing.type === "new" && appointments ? availability.loading || !!availability.error || !availability.data?.items.length : false}>{busy ? "Saving…" : "Save"}</button><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button></div>
      </fieldset></form>
    </Modal>}
  </Container>;
}
