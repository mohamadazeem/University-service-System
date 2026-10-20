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
  const [form, setForm] = useState({ service: slot?.service?._id || slot?.service || "", title: slot?.title || "", date: start.date, start: start.time, end: end.time, location: originalLocation, description: slot?.description || "", capacity: slot?.capacity || 1 });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false), booked = slot?.booked > 0;
  const change = event => { setForm({ ...form, [event.target.name]: event.target.value }); setError(""); };
  const save = async event => {
    event.preventDefault(); if (lock.current) return;
    setError("");
    if (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1 || Number(form.capacity) > 100) { setError("Capacity must be an integer from 1 to 100."); return; }
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
      // Omitted legacy metadata (instructions and duration) survives edits.
      const body = { title: form.title.trim(), description: form.description.trim(), ...(!booked && { service: form.service, startsAt, endsAt, status, capacity: Number(form.capacity) }), ...((!slot || form.location !== originalLocation) && { location: form.location.trim() }), ...(slot && { expectedUpdatedAt: slot.updatedAt }) };
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
      <p className="muted">Sri Lanka time (Asia/Colombo). Choose 1 space for an individual appointment or up to 100 for a group.</p>
      {booked && <Notice>This slot has bookings. You can update its title, location and description; its service, schedule and capacity are protected.</Notice>}
      <LoadingError resource={services} /><Notice error>{error}</Notice>
      {!services.loading && !services.error && !all.length && !slot && <Notice>No active university services are available. Ask an administrator to add a service.</Notice>}
      <fieldset disabled={busy}>
        <label>Service<select aria-label="Service" name="service" value={form.service} onChange={change} required disabled={booked || services.loading || !!services.error}><option value="">Select a university service</option>{slot?.service && !all.some(service => service._id === form.service) && <option value={form.service}>{slot.serviceName || slot.service?.name || "Existing service"}</option>}{all.map(service => <option key={service._id} value={service._id}>{service.name}</option>)}</select></label>
        <label>Appointment Title<input aria-label="Appointment Title" name="title" value={form.title} onChange={change} required maxLength={160} /></label>
        <label>Appointment Date<input aria-label="Appointment Date" type="date" name="date" value={form.date} onChange={change} required min={appointmentFields(new Date()).date} disabled={booked} /></label>
        <div className="availability-time-fields"><label>Start Time<input aria-label="Start Time" type="time" name="start" value={form.start} onChange={change} required disabled={booked} /></label><label>End Time<input aria-label="End Time" type="time" name="end" value={form.end} onChange={change} required disabled={booked} /></label></div>
        <label>Location (optional)<input aria-label="Location (optional)" name="location" value={form.location} onChange={change} maxLength={300} placeholder="Office, room or online meeting" /></label>
        <label>Capacity<input aria-label="Capacity" type="number" name="capacity" value={form.capacity} onChange={change} required min={1} max={100} step={1} disabled={booked} /></label>
        <label>Description (optional)<textarea aria-label="Description (optional)" name="description" value={form.description} onChange={change} maxLength={2000} rows={2} /></label>
        <footer className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" value={canPublish ? "Published" : slot.status} disabled={unavailable}>{busy ? "Saving..." : canPublish ? "Publish availability" : "Save availability"}</button>{canPublish && <button type="submit" value="Draft" className="secondary" disabled={unavailable}>Save draft</button>}</footer>
      </fieldset>
    </form>
  </Modal>;
}
function SlotDetails({ id, base, onClose, onSaved, onEdit }) {
  const resource = useResource(`${base}/${id}`);
  const [confirming, setConfirming] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  const cancel = async () => {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const body = { expectedUpdatedAt: resource.data.slot.updatedAt };
      const { data } = confirming === "delete" ? await api.delete(`${base}/${id}`, { data: body }) : await api.patch(`${base}/${id}`, { ...body, action: "cancel" });
      onSaved(data.message);
    }
    catch (err) { setError(errorMessage(err)); } finally { lock.current = false; setBusy(false); }
  };
  const slot = resource.data?.slot;
  return <Modal title="Availability details" onClose={onClose} busy={busy}><LoadingError resource={resource} />{slot && !resource.loading && !resource.error && <><Badge value={slot.status} /><h3>{slot.title}</h3><SlotInformation slot={slot} /><h3>Student bookings</h3>{!resource.data.bookings.length ? <p className="muted">No student bookings yet.</p> : <div className="appointment-roster">{resource.data.bookings.map(item => <article key={item._id}><strong>{item.student?.name || "Unavailable account"}</strong><Badge value={item.status} /><small>{item.student?.studentId} · {item.student?.email}</small><p className="preserve-lines">{item.reason}</p></article>)}</div>}<Notice error>{error}</Notice>{confirming ? <section className="confirm-inline"><h3>{confirming === "delete" ? "Delete this availability?" : "Cancel this availability?"}</h3><p>All pending and approved bookings will be cancelled. Affected students receive persistent notifications. Booking history is preserved.</p><footer className="modal-actions"><button className="secondary" disabled={busy} onClick={() => setConfirming("")}>Keep availability</button><button disabled={busy} onClick={cancel}>{busy ? "Saving..." : confirming === "delete" ? "Confirm deletion" : "Confirm cancellation"}</button></footer></section> : <footer className="modal-actions">{!["Cancelled", "Closed", "Expired"].includes(slot.status) && <><button className="secondary" onClick={() => onEdit(slot)}>Edit availability</button><button onClick={() => setConfirming("cancel")}>Cancel availability</button></>}<button className="secondary" onClick={() => setConfirming("delete")}>Delete availability</button></footer>}</>}</Modal>;
}
export function SlotInformation({ slot }) {
  return <dl className="detail-list"><dt>Service</dt><dd>{slot.serviceName || slot.service?.name || "Staff appointment"}</dd><dt>Category</dt><dd>{slot.category || slot.service?.department || "Not specified"}</dd><dt>Bookings</dt><dd>{slot.booked || 0}{slot.confirmed !== undefined && <> ? {slot.confirmed} confirmed ? {slot.pending || 0} pending</>}</dd><dt>Staff</dt><dd>{slot.staff?.name || "University staff"}</dd><dt>Schedule</dt><dd>{appointmentDateTime(slot.startsAt)} – {appointmentDateTime(slot.endsAt)}<small>Asia/Colombo</small></dd><dt>Location</dt><dd>{slot.location || [slot.building, slot.room].filter(Boolean).join(" / ") || "Not specified"}</dd><dt>Description</dt><dd className="preserve-lines">{slot.description || "Not specified"}</dd><dt>Capacity</dt><dd>{slot.remaining} remaining / {slot.capacity} spaces</dd>{slot.durationMinutes && <><dt>Duration</dt><dd>{slot.durationMinutes} minutes</dd></>}{slot.instructions && <><dt>Instructions</dt><dd className="preserve-lines">{slot.instructions}</dd></>}</dl>;
}
export function AvailabilityCard({ slot, children }) {
  return <article className="appointment-card"><div className="appointment-card-top"><span className="appointment-category">{slot.category || "University services"}</span><Badge value={slot.status} /></div><h2>{slot.title || slot.serviceName || "Staff appointment"}</h2><p className="muted">{slot.serviceName || slot.service?.name || "Staff appointment"} · {slot.staff?.name || "University staff"}</p><div className="appointment-fact"><CalendarDays size={17} /><span>{appointmentDateTime(slot.startsAt)}<small>Until {appointmentDateTime(slot.endsAt)} · Asia/Colombo</small></span></div><div className="appointment-fact"><MapPin size={17} /><span>{slot.location || "Location not specified"}</span></div><div className="appointment-fact"><Users size={17} /><span>{slot.remaining} of {slot.capacity} spaces available<small>{slot.booked || 0} booked</small></span></div>{slot.description && <p className="appointment-description">{slot.description}</p>}<footer>{children}</footer></article>;
}
export default function AppointmentAvailability({ admin = false }) {
  const base = `/${admin ? "admin" : "staff"}/appointment-slots`;
  const [filters, setFilters] = useState({ q: "", date: "", service: "", status: "", staff: "" }), [page, setPage] = useState(1);
  const search = useDebouncedValue(filters.q);
  const resource = useResource(`${base}?${new URLSearchParams({ ...filters, q: search, page, limit: 9 })}`, true);
  const services = useResource("/services");
  const staff = useResource(admin ? "/admin/staff?availability=true" : null);
  const [editing, setEditing] = useState(null), [selected, setSelected] = useState(null), [notice, setNotice] = useState("");
  const change = event => { setFilters({ ...filters, [event.target.name]: event.target.value }); setPage(1); };
  const saved = message => { setEditing(null); setSelected(null); setNotice(message); resource.reload(); };
  return <main className={`appointment-management ${admin ? "" : "staff-appointment-management"}`}><div className="staff-page-heading"><div><p className="eyebrow">APPOINTMENT AVAILABILITY</p><h1>{admin ? "Staff Availability" : "Appointments"}</h1><p className="muted">{admin ? "Availability from all staff, including drafts and past slots. Student bookings are managed separately." : "Manage appointment availability for university services."}</p></div><div className="button-row"><button className="secondary" onClick={resource.reload} disabled={resource.loading}><RefreshCw size={16} />Refresh</button>{!admin && <button onClick={() => { setNotice(""); setEditing({}); }}><Plus size={17} />Create Availability</button>}</div></div><p className="appointment-timezone">All appointment times are shown in Sri Lanka time (Asia/Colombo).</p><Notice>{notice}</Notice><section className="panel"><div className="appointment-filters"><label>Search appointments<input name="q" value={filters.q} onChange={change} maxLength={100} placeholder="Title, service, building or room" /></label>{admin && <label>Staff member<select aria-label="Staff member" name="staff" value={filters.staff} onChange={change}><option value="">All staff</option>{staff.data?.staff.map(person => <option key={person._id} value={person._id}>{person.name}</option>)}</select></label>}<label>Date<input type="date" name="date" value={filters.date} onChange={change} /></label><label>Service<select aria-label="Service" name="service" value={filters.service} onChange={change}><option value="">All services</option>{services.data?.services.map(service => <option key={service._id} value={service._id}>{service.name}</option>)}</select></label><label>Status<select aria-label="Status" name="status" value={filters.status} onChange={change}><option value="">All statuses</option>{["Draft", "Published", "Closed", "Cancelled", "Expired"].map(value => <option key={value}>{value}</option>)}</select></label><button className="secondary" onClick={() => { setFilters({ q: "", date: "", service: "", status: "", staff: "" }); setPage(1); }}>Clear filters</button></div>{services.error && <LoadingError resource={services} />}{admin && staff.error && <LoadingError resource={staff} />}</section><LoadingError resource={resource} />{!resource.loading && !resource.error && <>{!resource.data.items.length ? <section className="panel empty-state"><CalendarDays size={28} /><h2>No availability matches this view</h2><p>{admin ? "No staff availability exists for the selected filters. Clear filters or refresh after staff create a slot." : "Create availability to let students book time with you."}</p></section> : <div className="appointment-grid">{resource.data.items.map(slot => <AvailabilityCard slot={slot} key={slot._id}><button className="secondary" onClick={() => setSelected(slot._id)}>View &amp; manage</button></AvailabilityCard>)}</div>}<Pagination data={resource.data} page={page} onChange={setPage} /></>}{!admin && <Link className="text-link" to="/staff/bookings">Review student bookings →</Link>}{editing && <AvailabilityForm slot={editing._id ? editing : null} admin={admin} base={base} onClose={() => setEditing(null)} onSaved={saved} />}{selected && <SlotDetails id={selected} base={base} onClose={() => setSelected(null)} onSaved={saved} onEdit={slot => { setSelected(null); setEditing(slot); }} />}</main>;
}
