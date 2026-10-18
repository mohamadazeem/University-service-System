import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Files, Clock3, CircleCheck, LayoutGrid, RefreshCw, Plus } from "lucide-react";
import useResource from "../hooks/useResource";
import { Badge, LoadingError, Pagination } from "../admin/AdminUI";
import { dateTime } from "../admin/adminUtils";
import Modal from "../components/Modal";
import "../styles/dashboard.css";

export default function Dashboard() {
  const requests = useResource("/requests/my");
  const services = useResource("/services");
  const slots = useResource("/appointments/availability?limit=1");
  const upcoming = useResource("/appointments?view=upcoming&limit=1");
  const [search, setSearch] = useState(""), [status, setStatus] = useState(""), [page, setPage] = useState(1), [selected, setSelected] = useState(null);
  const rows = requests.data?.requests || [];
  const count = status => rows.filter(row => row.status === status).length;
  const filtered = rows.filter(row => (!status || row.status === status) && [row.service, row._id, row.description, row.department].some(value => String(value || "").toLowerCase().includes(search.trim().toLowerCase())));
  const pages = Math.max(1, Math.ceil(filtered.length / 10)), currentPage = Math.min(page, pages);
  const refresh = () => { requests.reload(); services.reload(); slots.reload(); upcoming.reload(); };
  const value = (resource, number) => resource.loading ? "…" : resource.error ? "—" : number;
  return <main className="staff-dashboard student-dashboard">
    <div className="staff-page-heading"><div><p className="eyebrow">UNIVERSITY SERVICES</p><h1>Student Dashboard</h1><p className="muted">Manage your university services, requests, appointments, and support.</p></div><button className="secondary" onClick={refresh} disabled={requests.loading || services.loading || slots.loading || upcoming.loading}><RefreshCw size={16} />Refresh overview</button></div>
    <section className="staff-metrics" aria-label="Student request statistics">{[
      ["Available Services", value(services, services.data?.services.length), LayoutGrid, "Available university services"],
      ["My Requests", value(requests, rows.length), Files, "Submitted by you"],
      ["Pending Requests", value(requests, count("Pending")), Clock3, "Awaiting review"],
      ["Completed Requests", value(requests, count("Completed")), CircleCheck, "Service delivered"],
    ].map(([label, number, Icon, hint]) => <article className="staff-metric" key={label}><div><span>{label}</span><Icon size={19} aria-hidden="true" /></div><strong>{number}</strong><small>{hint}</small></article>)}</section>
    {services.error && <LoadingError resource={services} />}
    <div className="staff-status-summary" aria-label="Additional outcomes"><span>Other outcomes</span>{[["Approved", "Approved"], ["Rejected", "Rejected"], ["In Progress", "Processing"]].map(([label, status]) => <span key={status}><i className={`staff-status-dot ${status.toLowerCase()}`} />{label} <strong>{value(requests, count(status))}</strong></span>)}<small>Counts include only your requests.</small></div>
    <section className="staff-support-overview" aria-label="Appointment overview"><h2>Appointments</h2><div className="staff-metrics">{[
      ["Available Appointment Slots", slots, slots.data?.total, CalendarDays, "Published slots available to book"],
      ["My Upcoming Appointments", upcoming, upcoming.data?.total, CircleCheck, "Your upcoming approved appointments"],
    ].map(([label, resource, total, Icon, hint]) => <div key={label}><Link className="staff-support-metric student-appointment-metric" to="/appointments"><div><span>{label}</span><Icon size={19} aria-hidden="true" /></div><strong>{value(resource, total)}</strong><small>{hint}</small></Link>{resource.error && <LoadingError resource={resource} />}</div>)}</div></section>
    <div className="page-heading"><div><h2>Service Requests</h2><p className="muted">Track your requests and read the latest university updates.</p></div><div className="button-row"><Link className="button-link" to="/request-service"><Plus size={16} />Submit a request</Link><button className="secondary" onClick={requests.reload} disabled={requests.loading}><RefreshCw size={16} />Refresh</button></div></div>
    <section className="panel student-request-panel" aria-label="Your service requests">
      <div className="staff-filters student-request-filters"><label className="staff-search">Search requests<input value={search} maxLength={100} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Service, description or request ID" /></label><label>Status<select aria-label="Status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{["Pending", "Processing", "Approved", "Rejected", "Completed"].map(status => <option key={status} value={status}>{status === "Processing" ? "In Progress" : status}</option>)}</select></label><button className="secondary filter-reset" onClick={() => { setSearch(""); setStatus(""); setPage(1); }}>Reset filters</button></div>
      <LoadingError resource={requests} />
      {!requests.loading && !requests.error && <><div className="table-scroll"><table><thead><tr><th>Service / ID</th><th>Submitted</th><th>Department</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 10, currentPage * 10).map(row => <tr key={row._id}><td data-label="Service / ID"><strong>{row.service}</strong><small className="request-id">{row._id}</small></td><td data-label="Submitted">{dateTime(row.createdAt)}</td><td data-label="Department">{row.department || "Not specified"}</td><td data-label="Status"><Badge value={row.status} /></td><td data-label="Action"><button className="secondary table-button" aria-label={`View ${row.service} request`} onClick={() => setSelected(row)}>View</button></td></tr>)}</tbody></table></div>{!filtered.length && <div className="empty-state">{rows.length ? "No requests match your filters." : "You have not submitted a service request yet."}</div>}<Pagination data={{ total: filtered.length, pages }} page={currentPage} onChange={setPage} /></>}
    </section>
    {selected && <Modal title="Request details" onClose={() => setSelected(null)}><div className="request-detail-heading"><Badge value={selected.status} /><code>{selected._id}</code></div><h3>{selected.service}</h3><dl className="detail-list"><dt>Submitted</dt><dd>{dateTime(selected.createdAt)}</dd><dt>Department</dt><dd>{selected.department || "Not specified"}</dd><dt>Description</dt><dd className="preserve-lines">{selected.description}</dd><dt>Priority</dt><dd>{selected.priority || "Normal"}</dd><dt>Staff update</dt><dd className="preserve-lines">{selected.staffComment || "No comments yet"}</dd></dl><footer className="modal-actions"><button className="secondary" onClick={() => setSelected(null)}>Close</button></footer></Modal>}
  </main>;
}
