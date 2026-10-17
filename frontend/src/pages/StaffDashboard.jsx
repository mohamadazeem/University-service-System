import { Link, useLocation, useSearchParams } from "react-router-dom";
import { CalendarDays, MessageSquare, CircleAlert, Files, Clock3, LoaderCircle, CircleCheck, RefreshCw } from "lucide-react";
import useResource from "../hooks/useResource";
import AdminRequests from "../admin/AdminRequests";
import { LoadingError } from "../admin/AdminUI";
export default function StaffDashboard() {
  const location = useLocation();
  const [params] = useSearchParams();
  const overview = location.pathname === "/staff";
  const dashboard = useResource(overview ? "/staff/dashboard" : null);
  const support = useResource(overview ? "/staff/support-overview" : null);
  const metrics = dashboard.data ? [
    ["Total Requests", dashboard.data.total, Files, "All departments"],
    ["Pending Requests", dashboard.data.counts.Pending, Clock3, "Awaiting review"],
    ["In Progress", dashboard.data.counts.Processing, LoaderCircle, "Currently processing"],
    ["Completed Requests", dashboard.data.counts.Completed, CircleCheck, "Service delivered"],
  ] : [];
  return <main className="staff-dashboard">
    <div className="staff-page-heading"><div><p className="eyebrow">UNIVERSITY SERVICES</p><h1>{overview ? "Staff Dashboard" : params.get("status") === "Processing" ? "In Progress" : params.get("status") ? `${params.get("status")} Requests` : "All Service Requests"}</h1><p className="muted">Manage university service requests and track their progress from one place.</p></div>{overview && <button className="secondary" onClick={() => { dashboard.reload(); support.reload(); }} disabled={dashboard.loading}><RefreshCw size={16} />Refresh overview</button>}</div>
    {overview && <><LoadingError resource={dashboard} />{!dashboard.loading && !dashboard.error && dashboard.data && <><section className="staff-metrics" aria-label="All-department request statistics">{metrics.map(([label, count, Icon, description]) => <article className="staff-metric" key={label}><div><span>{label}</span><Icon size={19} /></div><strong>{count}</strong><small>{description}</small></article>)}</section><div className="staff-status-summary" aria-label="Additional outcomes"><span>Other outcomes</span><span><i className="staff-status-dot approved" />Approved <strong>{dashboard.data.counts.Approved}</strong></span><span><i className="staff-status-dot rejected" />Rejected <strong>{dashboard.data.counts.Rejected}</strong></span><small>Counts include all university departments.</small></div></>}</>}
    {overview && <section className="staff-support-overview" aria-label="Booking and complaint overview"><h2>Bookings &amp; complaints</h2><LoadingError resource={support} />{!support.loading && !support.error && support.data && <div className="staff-metrics">{[
      ["Pending bookings", support.data.pendingBookings, "/staff/bookings?status=Pending", CalendarDays, "Assigned to you"],
      ["Upcoming approved bookings", support.data.upcomingBookings, "/staff/bookings?view=upcoming", CircleCheck, "Your future appointments"],
      ["Unresolved complaints", support.data.unresolvedComplaints, "/staff/complaints?view=unresolved", MessageSquare, "Awaiting resolution"],
      ["High-priority complaints", support.data.highPriorityComplaints, "/staff/complaints?view=high-priority", CircleAlert, "High or urgent; unresolved"],
    ].map(([label, count, to, Icon, hint]) => <Link className="staff-support-metric" to={to} key={label}><div><span>{label}</span><Icon size={19} /></div><strong>{count}</strong><small>{hint}</small></Link>)}</div>}</section>}
    <AdminRequests key={params.get("status") || "all"} staffMode onUpdated={overview ? dashboard.reload : undefined} />
  </main>;
}
