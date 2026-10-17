import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, MessageSquare, RefreshCw, Search } from "lucide-react";
import api, { errorMessage } from "../api/client";
import useResource from "../hooks/useResource";
import useDebouncedValue from "../hooks/useDebouncedValue";
import Modal from "../components/Modal";
import { Badge, LoadingError, Notice, Pagination } from "../admin/AdminUI";
import { dateTime } from "../admin/adminUtils";
import { appointmentDateTime } from "../utils/appointmentTime";

function SupportEditor({ data, booking, base, onSaved, onClose, reload }) {
  const { item, allowedStatuses, priorities } = data;
  const [status, setStatus] = useState(booking ? allowedStatuses[0] || item.status : item.status);
  const [response, setResponse] = useState(item.response || "");
  const [priority, setPriority] = useState(item.priority || "Medium");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const { data: saved } = await api.patch(`${base}/${item._id}`, {
        status, expectedStatus: item.status, expectedUpdatedAt: item.updatedAt,
        ...(!booking && { response, priority }),
      });
      onSaved(saved.message);
    } catch (err) {
      setError(errorMessage(err));
      setConfirming(false);
    } finally { lock.current = false; setBusy(false); }
  };
  return <Modal title={booking ? "Booking details" : "Complaint details"} onClose={onClose} busy={busy}>
    <div className="request-detail-heading"><Badge value={item.status} /><code>{item._id}</code></div>
    <h3>Student information</h3>
    <dl className="detail-list"><dt>Student</dt><dd>{item.student?.name || "Unavailable account"}<small>{item.student?.email}</small></dd><dt>Student ID</dt><dd>{item.student?.studentId || "Not provided"}</dd><dt>Submitted</dt><dd>{dateTime(item.createdAt)}</dd></dl>
    <h3>{booking ? "Appointment information" : item.subject}</h3>
    <dl className="detail-list">{booking ? <><dt>Booking type</dt><dd>Staff appointment</dd><dt>Date &amp; time</dt><dd>{appointmentDateTime(item.date)}</dd><dt>Resource</dt><dd>{item.staff?.name || "Staff appointment"}</dd><dt>Location</dt><dd>{item.slot?.location || "Not specified"}</dd><dt>Reason</dt><dd className="preserve-lines">{item.reason}</dd></> : <><dt>Category</dt><dd>{item.category || "General"}</dd><dt>Priority</dt><dd><Badge value={item.priority || "Medium"} /></dd><dt>Description</dt><dd className="preserve-lines">{item.description}</dd></>}</dl>
    {!booking && <section className="staff-complaint-history" aria-label="Complaint history"><h3>Response history</h3>{!item.history?.length && <p className="muted">{item.response || "No responses yet."}</p>}{item.history?.map(entry => <article key={entry._id}><div><Badge value={entry.status} /><Badge value={entry.priority} /></div><p className="preserve-lines">{entry.response}</p><small>{entry.actorName || "University support"} ({entry.actorRole}) · {dateTime(entry.at)}</small></article>)}</section>}
    <Notice error>{error}</Notice>
    {error && <button className="secondary" disabled={busy} onClick={reload}>Reload latest details</button>}
    {allowedStatuses.length > 0 ? confirming ? <section className="confirm-inline"><h3>Confirm {booking ? "booking update" : "complaint response"}</h3><p>Status: <strong>{item.status} → {status}</strong></p>{!booking && <p>Priority: <strong>{priority}</strong>. Your response will be added to the complaint history and shown to the student.</p>}{booking && ["Rejected", "Cancelled"].includes(status) && <p>This releases the reserved time so it can be booked again if still available.</p>}<footer className="modal-actions"><button className="secondary" disabled={busy} onClick={() => setConfirming(false)}>Back to editing</button><button disabled={busy} onClick={save}>{busy ? "Saving..." : "Confirm changes"}</button></footer></section> : <form onSubmit={event => { event.preventDefault(); setConfirming(true); }}><h3>{booking ? "Manage booking" : "Respond and update"}</h3><fieldset disabled={busy}><label>Update status<select aria-label="Update status" value={status} onChange={event => setStatus(event.target.value)}>{[...(!booking ? [item.status] : []), ...allowedStatuses].map(value => <option key={value}>{value}</option>)}</select></label>{!booking && <><label>Complaint priority<select aria-label="Complaint priority" value={priority} onChange={event => setPriority(event.target.value)}>{priorities.map(value => <option key={value}>{value}</option>)}</select></label><label>Staff response<textarea aria-label="Staff response" value={response} onChange={event => setResponse(event.target.value)} required maxLength={4000} rows={5} /></label></>}<footer className="modal-actions"><button className="secondary" type="button" onClick={onClose}>Close</button><button disabled={busy}>Review changes</button></footer></fieldset></form> : <><p className="muted">This {booking ? "booking" : "complaint"} is closed and cannot be changed.</p><footer className="modal-actions"><button className="secondary" onClick={onClose}>Close</button></footer></>}
  </Modal>;
}
function SupportDialog({ id, base, booking, onClose, onSaved }) {
  const resource = useResource(`${base}/${id}`);
  if (resource.loading || resource.error) return <Modal title={booking ? "Booking details" : "Complaint details"} onClose={onClose}><LoadingError resource={resource} /></Modal>;
  return <SupportEditor key={resource.data.item.updatedAt} data={resource.data} booking={booking} base={base} onSaved={onSaved} onClose={onClose} reload={resource.reload} />;
}
export default function StaffSupport({ kind }) {
  const booking = kind === "bookings";
  const base = `/staff/${kind}`;
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const search = useDebouncedValue(q);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState("");
  const query = new URLSearchParams(params);
  query.set("q", search);
  query.set("limit", "10");
  const page = Number(params.get("page") || 1);
  const resource = useResource(`${base}?${query}`);
  const change = (name, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value); else next.delete(name);
    next.delete("page");
    // Summary views remain explicit until the staff member chooses another view.
    if (name === "status" || name === "priority") next.delete("view");
    setParams(next);
  };
  const Icon = booking ? CalendarDays : MessageSquare;
  const statuses = resource.data?.statuses || [];
  return <main className="staff-support">
    <div className="staff-page-heading"><div><p className="eyebrow">STUDENT SUPPORT</p><h1><Icon size={25} />{booking ? "Booking Management" : "Complaint Management"}</h1><p className="muted">{booking ? "Review appointment bookings assigned to you. Times are shown in Asia/Colombo." : "Review university concerns, respond to students, and track resolution. Complaint details are confidential."}</p></div><button className="secondary" disabled={resource.loading} onClick={resource.reload}><RefreshCw size={16} />Refresh</button></div>
    <Notice>{notice}</Notice>
    <section className="panel"><div className="staff-filters staff-support-filters">
      <label className="staff-search">Search {kind}<span className="staff-search-input"><Search size={16} /><input value={q} maxLength={100} placeholder={booking ? "Booking ID, student or reason" : "Complaint ID, student or subject"} onChange={event => { setQ(event.target.value); if (params.has("page")) { const next = new URLSearchParams(window.location.search); next.delete("page"); setParams(next, { replace: true }); } }} /></span></label>
      <label>Status<select aria-label="Status" value={params.get("status") || ""} onChange={event => change("status", event.target.value)}><option value="">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>View<select aria-label="View" value={params.get("view") || ""} onChange={event => { const next = new URLSearchParams(params); next.delete("status"); next.delete("priority"); next.delete("page"); if (event.target.value) next.set("view", event.target.value); else next.delete("view"); setParams(next); }}><option value="">All {kind}</option>{booking ? <option value="upcoming">Upcoming approved bookings</option> : <><option value="unresolved">Unresolved complaints</option><option value="high-priority">High-priority unresolved</option></>}</select></label>
      <label>Sort by<select aria-label="Sort by" value={params.get("sort") || "createdAt"} onChange={event => change("sort", event.target.value)}><option value="createdAt">Submitted date</option><option value="updatedAt">Last updated</option>{booking && <option value="date">Appointment date</option>}</select></label>
      {!booking && <><label>Priority<select aria-label="Priority" value={params.get("priority") || ""} onChange={event => change("priority", event.target.value)}><option value="">All priorities</option>{resource.data?.priorities.map(value => <option key={value}>{value}</option>)}</select></label><label>Category<select aria-label="Category" value={params.get("category") || ""} onChange={event => change("category", event.target.value)}><option value="">All categories</option>{resource.data?.categories.map(value => <option key={value}>{value}</option>)}</select></label></>}
      <label>Order<select aria-label="Order" value={params.get("order") || "desc"} onChange={event => change("order", event.target.value)}><option value="desc">Newest first</option><option value="asc">Oldest first</option></select></label>
      <button className="secondary filter-reset" onClick={() => { setQ(""); setParams({}); }}>Clear filters</button>
    </div><LoadingError resource={resource} />
    {!resource.loading && !resource.error && <>{resource.data.items.length > 0 ? <div className="table-scroll"><table><thead><tr><th>Student / {booking ? "booking" : "complaint"} ID</th><th>{booking ? "Type / resource" : "Subject"}</th>{booking ? <><th>Date &amp; time</th><th>Location</th></> : <><th>Category</th><th>Priority</th></>}<th>Submitted</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{resource.data.items.map(item => <tr key={item._id}><td data-label="Student / ID"><strong>{item.student?.name || "Unavailable account"}</strong><small>{item.student?.studentId}</small><small className="request-id">{item._id}</small></td><td data-label={booking ? "Type / resource" : "Subject"}>{booking ? <>Staff appointment<small>{item.staff?.name || "Assigned staff"}</small></> : item.subject}</td>{booking ? <><td data-label="Date & time">{appointmentDateTime(item.date)}</td><td data-label="Location">{item.slot?.location || "Not specified"}</td></> : <><td data-label="Category">{item.category || "General"}</td><td data-label="Priority"><Badge value={item.priority || "Medium"} /></td></>}<td data-label="Submitted">{dateTime(item.createdAt)}</td><td data-label="Status"><Badge value={item.status} /></td><td data-label="Actions"><button className="table-button" onClick={() => { setSelected(item._id); setNotice(""); }}>Review</button></td></tr>)}</tbody></table></div> : <div className="empty-state">No {kind} match this view.</div>}<Pagination data={resource.data} page={page} onChange={value => { const next = new URLSearchParams(params); next.set("page", String(value)); setParams(next); }} /></>}
    </section>
    {selected && <SupportDialog id={selected} base={base} booking={booking} onClose={() => setSelected(null)} onSaved={message => { setSelected(null); setNotice(message); resource.reload(); }} />}
  </main>;
}
