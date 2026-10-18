import { useRef, useState } from "react";
import { CalendarDays, MapPin, Users, Plus, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import useResource from "../hooks/useResource";
import useDebouncedValue from "../hooks/useDebouncedValue";
import Modal from "../components/Modal";
import { Badge, LoadingError, Notice, Pagination } from "../admin/AdminUI";
import { appointmentDateTime, appointmentFields, appointmentInstant } from "../utils/appointmentTime";
import "../styles/appointments.css";

function AvailabilityForm({ slot, base, onClose, onSaved }) {
  const services = useResource("/services");
  const start = appointmentFields(slot?.startsAt), end = appointmentFields(slot?.endsAt);
  const originalLocation = slot?.location || [slot?.building, slot?.room].filter(Boolean).join(" / ");
  const [form, setForm] = useState({ service: slot?.service?._id || slot?.service || "", title: slot?.title || "", date: start.date, start: start.time, end: end.time, location: originalLocation });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false), booked = slot?.booked > 0;
  const change = event => { setForm({ ...form, [event.target.name]: event.target.value }); setError(""); };
  const save = async event => {
    event.preventDefault(); if (lock.current) return;
    setError("");
    const status = event.nativeEvent.submitter?.value || slot?.status || "Published";
    let startsAt, endsAt;
    if (!booked) {
      try {
        startsAt = slot && form.date === start.date && form.start === start.time ? slot.startsAt : appointmentInstant(form.date, form.start);
        endsAt = slot && form.date === end.date && form.end === end.time ? slot.endsAt : appointmentInstant(form.date, form.end);
      }
      catch { setError("Choose a valid appointment date and time."); return; }
      if (new Date(startsAt) <= new Date()) { setError("Choose a future appointment date and start time."); return; }
      if (endsAt <= startsAt) { setError("End time must be later than start time."); return; }
      if (new Date(endsAt) - new Date(startsAt) > 8 * 3600000) { setError("Appointment slots cannot exceed 8 hours."); return; }
    }
    lock.current = true; setBusy(true);
    try {
      // Omit hidden fields on edits so historical metadata and capacity survive.
      const body = { title: form.title.trim(), ...(!booked && { service: form.service, startsAt, endsAt, status }), ...((!slot || form.location !== originalLocation) && { location: form.location.trim() }), ...(slot && { expectedUpdatedAt: slot.updatedAt }) };
      const { data } = slot ? await api.patch(base + "/" + slot._id, body) : await api.post(base, body);
      onSaved(data.message);
    } catch (err) { setError(errorMessage(err)); }
    finally { lock.current = false; setBusy(false); }
  };
  const all = services.data?.services || [];
  const canPublish = !slot || slot.status === "Draft";
  const unavailable = busy || services.loading || !!services.error || (!all.length && !slot);
  return <Modal title={slot ? "Edit availability" : "Create Availability"} onClose={onClose} busy={busy}>
    <form className="compact-availability-form" onSubmit={save}>
      <p className="muted">Sri Lanka time (Asia/Colombo). New slots accept one booking.</p>
      {booked && <Notice>This slot has bookings. You can update its title and location; its service and schedule are protected.</Notice>}
      <LoadingError resource={services} /><Notice error>{error}</Notice>
      {!services.loading && !services.error && !all.length && !slot && <Notice>No active university services are available. Ask an administrator to add a service.</Notice>}
      <fieldset disabled={busy}>
        <label>Service<select aria-label="Service" name="service" value={form.service} onChange={change} required disabled={booked || services.loading || !!services.error}><option value="">Select a university service</option>{slot?.service && !all.some(service => service._id === form.service) && <option value={form.service}>{slot.serviceName || slot.service?.name || "Existing service"}</option>}{all.map(service => <option key={service._id} value={service._id}>{service.name}</option>)}</select></label>
        <label>Appointment Title<input aria-label="Appointment Title" name="title" value={form.title} onChange={change} required maxLength={160} /></label>
        <label>Appointment Date<input aria-label="Appointment Date" type="date" name="date" value={form.date} onChange={change} required min={appointmentFields(new Date()).date} disabled={booked} /></label>
        <div className="availability-time-fields"><label>Start Time<input aria-label="Start Time" type="time" name="start" value={form.start} onChange={change} required disabled={booked} /></label><label>End Time<input aria-label="End Time" type="time" name="end" value={form.end} onChange={change} required disabled={booked} /></label></div>
        <label>Location (optional)<input aria-label="Location (optional)" name="location" value={form.location} onChange={change} maxLength={300} placeholder="Office, room or online meeting" /></label>
        <footer className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" value={canPublish ? "Published" : slot.status} disabled={unavailable}>{busy ? "Saving..." : canPublish ? "Publish availability" : "Save availability"}</button>{canPublish && <button type="submit" value="Draft" className="secondary" disabled={unavailable}>Save draft</button>}</footer>
      </fieldset>
    </form>
  </Modal>;
}
function SlotDetails({ id, base, onClose, onSaved, onEdit }) {
  const resource = useResource(`${base}/${id}`);
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  const cancel = async () => {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try { const { data } = await api.patch(`${base}/${id}`, { action: "cancel", expectedUpdatedAt: resource.data.slot.updatedAt }); onSaved(data.message); }
    catch (err) { setError(errorMessage(err)); } finally { lock.current = false; setBusy(false); }
  };
  const slot = resource.data?.slot;
  return <Modal title="Availability details" onClose={onClose} busy={busy}><LoadingError resource={resource} />{slot && !resource.loading && !resource.error && <><Badge value={slot.status} /><h3>{slot.title}</h3><SlotInformation slot={slot} /><h3>Student bookings</h3>{!resource.data.bookings.length ? <p className="muted">No student bookings yet.</p> : <div className="appointment-roster">{resource.data.bookings.map(item => <article key={item._id}><strong>{item.student?.name || "Unavailable account"}</strong><Badge value={item.status} /><small>{item.student?.studentId} · {item.student?.email}</small><p className="preserve-lines">{item.reason}</p></article>)}</div>}<Notice error>{error}</Notice>{!["Cancelled", "Closed"].includes(slot.status) && <>{confirming ? <section className="confirm-inline"><h3>Cancel this availability?</h3><p>All pending and approved bookings will be cancelled. Affected students receive persistent notifications.</p><footer className="modal-actions"><button className="secondary" disabled={busy} onClick={() => setConfirming(false)}>Keep availability</button><button disabled={busy} onClick={cancel}>{busy ? "Cancelling..." : "Confirm cancellation"}</button></footer></section> : <footer className="modal-actions"><button className="secondary" onClick={() => onEdit(slot)}>Edit availability</button><button onClick={() => setConfirming(true)}>Cancel availability</button></footer>}</>}</>}</Modal>;
}
export function SlotInformation({ slot }) {
  return <dl className="detail-list"><dt>Service</dt><dd>{slot.serviceName || slot.service?.name || "Staff appointment"}</dd><dt>Staff</dt><dd>{slot.staff?.name || "University staff"}</dd><dt>Schedule</dt><dd>{appointmentDateTime(slot.startsAt)} – {appointmentDateTime(slot.endsAt)}<small>Asia/Colombo</small></dd><dt>Location</dt><dd>{slot.location || [slot.building, slot.room].filter(Boolean).join(" / ") || "Not specified"}</dd><dt>Description</dt><dd className="preserve-lines">{slot.description || "Not specified"}</dd><dt>Capacity</dt><dd>{slot.remaining} remaining / {slot.capacity} spaces</dd>{slot.durationMinutes && <><dt>Duration</dt><dd>{slot.durationMinutes} minutes</dd></>}{slot.instructions && <><dt>Instructions</dt><dd className="preserve-lines">{slot.instructions}</dd></>}</dl>;
}
export function AvailabilityCard({ slot, children }) {
  return <article className="appointment-card"><div className="appointment-card-top"><span className="appointment-category">{slot.category || "University services"}</span><Badge value={slot.status} /></div><h2>{slot.title || slot.serviceName || "Staff appointment"}</h2><p className="muted">{slot.serviceName || slot.service?.name || "Staff appointment"} · {slot.staff?.name || "University staff"}</p><div className="appointment-fact"><CalendarDays size={17} /><span>{appointmentDateTime(slot.startsAt)}<small>Until {appointmentDateTime(slot.endsAt)} · Asia/Colombo</small></span></div><div className="appointment-fact"><MapPin size={17} /><span>{slot.location || "Location not specified"}</span></div><div className="appointment-fact"><Users size={17} /><span>{slot.status === "Published" ? <>{slot.remaining} of {slot.capacity} spaces available</> : <>{slot.booked || 0} booked / {slot.capacity} spaces</>}{slot.status === "Published" && slot.booked > 0 && <small>{slot.booked} booked</small>}</span></div>{slot.description && <p className="appointment-description">{slot.description}</p>}<footer>{children}</footer></article>;
}
export default function AppointmentAvailability({ admin = false }) {
  const base = `/${admin ? "admin" : "staff"}/appointment-slots`;
  const [filters, setFilters] = useState({ q: "", date: "", service: "", status: "" }), [page, setPage] = useState(1);
  const search = useDebouncedValue(filters.q);
  const resource = useResource(`${base}?${new URLSearchParams({ ...filters, q: search, page, limit: 9 })}`);
  const services = useResource("/services");
  const [editing, setEditing] = useState(null), [selected, setSelected] = useState(null), [notice, setNotice] = useState("");
  const change = event => { setFilters({ ...filters, [event.target.name]: event.target.value }); setPage(1); };
  const saved = message => { setEditing(null); setSelected(null); setNotice(message); resource.reload(); };
  return <main className={`appointment-management ${admin ? "" : "staff-appointment-management"}`}><div className="staff-page-heading"><div><p className="eyebrow">APPOINTMENT AVAILABILITY</p><h1>Appointments</h1><p className="muted">Manage appointment availability for university services.</p></div><div className="button-row"><button className="secondary" onClick={resource.reload} disabled={resource.loading}><RefreshCw size={16} />Refresh</button><button onClick={() => { setNotice(""); setEditing({}); }}><Plus size={17} />Create Availability</button></div></div><p className="appointment-timezone">All appointment times are shown in Sri Lanka time (Asia/Colombo).</p><Notice>{notice}</Notice><section className="panel"><div className="appointment-filters"><label>Search appointments<input name="q" value={filters.q} onChange={change} maxLength={100} placeholder="Title, service, building or room" /></label><label>Date<input type="date" name="date" value={filters.date} onChange={change} /></label><label>Service<select aria-label="Service" name="service" value={filters.service} onChange={change}><option value="">All services</option>{services.data?.services.map(service => <option key={service._id} value={service._id}>{service.name}</option>)}</select></label><label>Status<select aria-label="Status" name="status" value={filters.status} onChange={change}><option value="">All statuses</option>{["Draft", "Published", "Closed", "Cancelled"].map(value => <option key={value}>{value}</option>)}</select></label><button className="secondary" onClick={() => { setFilters({ q: "", date: "", service: "", status: "" }); setPage(1); }}>Clear filters</button></div>{services.error && <LoadingError resource={services} />}</section><LoadingError resource={resource} />{!resource.loading && !resource.error && <>{!resource.data.items.length ? <section className="panel empty-state"><CalendarDays size={28} /><h2>No availability matches this view</h2><p>Create availability to let students book time with you.</p></section> : <div className="appointment-grid">{resource.data.items.map(slot => <AvailabilityCard slot={slot} key={slot._id}><button className="secondary" onClick={() => setSelected(slot._id)}>View &amp; manage</button></AvailabilityCard>)}</div>}<Pagination data={resource.data} page={page} onChange={setPage} /></>}{!admin && <Link className="text-link" to="/staff/bookings">Review student bookings →</Link>}{editing && <AvailabilityForm slot={editing._id ? editing : null} admin={admin} base={base} onClose={() => setEditing(null)} onSaved={saved} />}{selected && <SlotDetails id={selected} base={base} onClose={() => setSelected(null)} onSaved={saved} onEdit={slot => { setSelected(null); setEditing(slot); }} />}</main>;
}
