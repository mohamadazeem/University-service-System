import { useRef, useState } from "react";
import api, { errorMessage } from "../api/client";
import useResource from "../hooks/useResource";
import { Badge, LoadingError, Notice, Pagination } from "../admin/AdminUI";
import Modal from "../components/Modal";
import { dateTime } from "../admin/adminUtils";
import { appointmentDateTime } from "../utils/appointmentTime";
import "../styles/appointments.css";
import { RelatedNotificationDetails } from "./Notifications";

const transitions = {
  Pending: ["Approved", "Rejected", "Cancelled"],
  Approved: ["In Progress", "Completed", "Rejected", "Cancelled"],
  "In Progress": ["Completed", "Cancelled"],
  Cancelled: [], Completed: [], Rejected: [],
};
function BookingInformation({ item }) {
  const slot = item.slot;
  return <dl className="detail-list appointment-details">
    <dt>Student</dt><dd>{item.student?.name || "Unavailable account"}<small>{item.student?.studentId}</small><small>{item.student?.email}</small></dd>
    <dt>Service</dt><dd>{slot?.serviceName || "Not specified"}</dd>
    <dt>Staff member</dt><dd>{item.staff?.name || "Unavailable account"}</dd>
    <dt>Date &amp; time</dt><dd>{appointmentDateTime(slot?.startsAt || item.date)}{slot?.endsAt && <> – {appointmentDateTime(slot.endsAt)}</>}<small>Asia/Colombo</small></dd>
    <dt>Location</dt><dd>{slot?.location || [slot?.building, slot?.room].filter(Boolean).join(" / ") || "Not specified"}</dd>
    <dt>Booking status</dt><dd><Badge value={item.status} /></dd>
  </dl>;
}
export default function Support({ kind, admin = false }) {
  const appointments = kind === "appointments";
  const [page, setPage] = useState(1), [filter, setFilter] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [editing, setEditing] = useState(null), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [success, setSuccess] = useState("");
  const lock = useRef(false);
  const base = `${admin ? "/admin" : ""}/${kind}`;
  const resource = useResource(`${base}?page=${page}&status=${encodeURIComponent(filter)}`, !admin);
  const Container = admin ? "section" : "main";
  const open = value => { setError(""); setSuccess(""); setReviewStatus(transitions[value.row?.status]?.[0] || ""); setEditing(value); };
  const save = async event => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setSuccess("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (editing.type === "review") await api.patch(`${base}/${editing.row._id}`, {
        ...values, expectedStatus: editing.row.status, expectedUpdatedAt: editing.row.updatedAt,
      });
      else await api.post(base, values);
      setEditing(null); setSuccess("Saved successfully."); resource.reload();
    } catch (err) { setError(errorMessage(err)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Container className={admin ? "admin-appointments" : "page"}>
    {!admin && !appointments && <RelatedNotificationDetails type="complaint" />}
    <div className="page-heading"><div><p className="eyebrow">{admin ? "STUDENT SUPPORT" : "YOUR STUDENT PORTAL"}</p><h1>{appointments ? "Appointments" : "Complaints"}</h1><p className="muted">{appointments ? "Review student bookings, approve or reject appointments, and monitor booking statuses. Times are shown in Asia/Colombo. Staff manage availability in their dashboard." : "Share a concern and follow the review, response, and resolution."}</p></div>
      <div className="button-row"><button className="secondary" onClick={resource.reload}>Refresh</button>{!admin && !appointments && <button onClick={() => open({ type: "new" })}>Submit complaint</button>}</div>
    </div>
    <Notice>{success}</Notice>{!editing && <Notice error>{error}</Notice>}
    {admin && appointments && <label className="support-filter">Filter by status<select aria-label="Filter by status" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }}><option value="">All statuses</option>{Object.keys(transitions).map(status => <option key={status}>{status}</option>)}</select></label>}
    <LoadingError resource={resource} />
    {!resource.loading && !resource.error && <section className="panel">
      {!resource.data.items.length && <div className="empty-state">{admin ? "No appointments match this view." : "No complaints yet. Submit a concern when you need help."}</div>}
      <div className="support-records">{resource.data.items.map(row => <article className="support-record" key={row._id}>
        <div className="panel-heading"><h2>{appointments ? row.slot?.title || "Staff appointment" : row.subject}</h2><Badge value={row.status} /></div>
        {appointments ? <BookingInformation item={row} /> : <><p className="muted">Department: {row.department || "Not specified"} / Assigned staff: {row.assignedStaff?.name || "Awaiting administrator assignment"}</p><p><Badge value={row.priority || "Medium"} /> / {row.category || "General"}</p></>}
        <p className="preserve-lines">{appointments ? row.reason : row.description}</p>
        {row.response && <div className="support-response"><strong>University support response</strong><p className="preserve-lines">{row.response}</p></div>}
        <small>Submitted {dateTime(row.createdAt)}</small>
        {admin && appointments && <div className="button-row section-space"><button className="secondary" onClick={() => open({ type: "details", row })}>View details</button>{transitions[row.status]?.length > 0 && <button className="secondary" onClick={() => open({ type: "review", row })}>Review</button>}</div>}
      </article>)}</div>
      <Pagination data={resource.data} page={page} onChange={setPage} />
    </section>}
    {editing && <Modal title={editing.type === "review" ? "Review appointment" : editing.type === "details" ? "Appointment details" : "Submit complaint"} onClose={() => setEditing(null)} busy={busy}>
      {editing.row && <><BookingInformation item={editing.row} /><p><strong>Booking ID: </strong>{editing.row._id}</p><p className="preserve-lines"><strong>Reason: </strong>{editing.row.reason}</p>{editing.row.slot?.description && <p className="preserve-lines">{editing.row.slot.description}</p>}{editing.row.slot?.instructions && <p className="preserve-lines"><strong>Instructions: </strong>{editing.row.slot.instructions}</p>}{editing.row.history?.length > 0 && <section aria-label="Booking history"><h3>Booking history</h3><ol>{editing.row.history.map(entry => <li key={entry._id}>{entry.status} · {appointmentDateTime(entry.at)}</li>)}</ol></section>}</>}
      {editing.type === "details" ? <footer className="modal-actions"><button className="secondary" onClick={() => setEditing(null)}>Close</button>{transitions[editing.row.status]?.length > 0 && <button onClick={() => setEditing({ ...editing, type: "review" })}>Review</button>}</footer> : <form onSubmit={save}><Notice error>{error}</Notice><fieldset disabled={busy}>
        {editing.type === "review" ? <><label>Status<select aria-label="Status" name="status" value={reviewStatus} onChange={event => setReviewStatus(event.target.value)} required>{transitions[editing.row.status].map(status => <option key={status}>{status}</option>)}</select></label>{reviewStatus === "Rejected" && <label>Rejection reason<textarea aria-label="Rejection reason" name="rejectionReason" required maxLength={2000} rows={3} /></label>}</> : <><label>Subject<input name="subject" required maxLength={160} /></label><label>Department<select aria-label="Department" name="department" defaultValue=""><option value="">Not specified</option>{resource.data?.departments?.map(value => <option key={value}>{value}</option>)}</select></label><label>Category<select name="category" defaultValue="General">{(resource.data?.categories || ["General"]).map(value => <option key={value}>{value}</option>)}</select></label><label>Priority<select name="priority" defaultValue="Medium">{(resource.data?.priorities || ["Medium"]).map(value => <option key={value}>{value}</option>)}</select></label><label>Description<textarea name="description" required maxLength={4000} rows={6} /></label></>}
        <div className="button-row"><button>{busy ? "Saving..." : "Save"}</button><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button></div>
      </fieldset></form>}
    </Modal>}
  </Container>;
}
