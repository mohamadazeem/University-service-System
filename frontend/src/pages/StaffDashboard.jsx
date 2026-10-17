import useAuth from "../auth/useAuth";
import useResource from "../hooks/useResource";
import AdminRequests from "../admin/AdminRequests";
import { LoadingError } from "../admin/AdminUI";
import "../admin/shared.css";
export default function StaffDashboard() {
  const { user } = useAuth();
  const dashboard = useResource("/staff/dashboard");
  return <main className="page staff-dashboard">
    <div className="page-heading"><div><p className="eyebrow">STAFF WORKSPACE</p><h1>Welcome, {user.name}</h1><p className="muted">{user.department || "Department not assigned"} · Department service requests</p></div><button className="secondary" onClick={dashboard.reload}>Refresh totals</button></div>
    <LoadingError resource={dashboard} />
    {dashboard.data && !dashboard.error && <>
      <section className="staff-summary" aria-label="Department request statistics">
        {Object.entries({ Total: dashboard.data.total, ...dashboard.data.counts }).map(([label, count]) => <article className="panel" key={label}><span className="muted">{label}</span><h2>{count}</h2></article>)}
      </section>
      <AdminRequests staffMode onUpdated={dashboard.reload} />
    </>}
  </main>;
}
