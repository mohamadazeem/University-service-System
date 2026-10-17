import { useLocation, useSearchParams } from "react-router-dom";
import { Files, Clock3, LoaderCircle, CircleCheck, RefreshCw } from "lucide-react";
import useResource from "../hooks/useResource";
import AdminRequests from "../admin/AdminRequests";
import { LoadingError } from "../admin/AdminUI";
export default function StaffDashboard() {
  const location = useLocation();
  const [params] = useSearchParams();
  const overview = location.pathname === "/staff";
  const dashboard = useResource(overview ? "/staff/dashboard" : null);
  const metrics = dashboard.data ? [
    ["Total Requests", dashboard.data.total, Files, "All departments"],
    ["Pending Requests", dashboard.data.counts.Pending, Clock3, "Awaiting review"],
    ["In Progress", dashboard.data.counts.Processing, LoaderCircle, "Currently processing"],
    ["Completed Requests", dashboard.data.counts.Completed, CircleCheck, "Service delivered"],
  ] : [];
  return <main className="staff-dashboard">
    <div className="staff-page-heading"><div><p className="eyebrow">UNIVERSITY SERVICES</p><h1>{overview ? "Staff Dashboard" : params.get("status") === "Processing" ? "In Progress" : params.get("status") ? `${params.get("status")} Requests` : "All Service Requests"}</h1><p className="muted">Manage university service requests and track their progress from one place.</p></div>{overview && <button className="secondary" onClick={dashboard.reload} disabled={dashboard.loading}><RefreshCw size={16} />Refresh overview</button>}</div>
    {overview && <><LoadingError resource={dashboard} />{!dashboard.loading && !dashboard.error && dashboard.data && <><section className="staff-metrics" aria-label="All-department request statistics">{metrics.map(([label, count, Icon, description]) => <article className="staff-metric" key={label}><div><span>{label}</span><Icon size={19} /></div><strong>{count}</strong><small>{description}</small></article>)}</section><div className="staff-status-summary" aria-label="Additional outcomes"><span>Other outcomes</span><span><i className="staff-status-dot approved" />Approved <strong>{dashboard.data.counts.Approved}</strong></span><span><i className="staff-status-dot rejected" />Rejected <strong>{dashboard.data.counts.Rejected}</strong></span><small>Counts include all university departments.</small></div></>}</>}
    <AdminRequests key={params.get("status") || "all"} staffMode onUpdated={overview ? dashboard.reload : undefined} />
  </main>;
}
