import { Link } from "react-router-dom";
import useAuth from "../auth/useAuth";
import useResource from "../hooks/useResource";
import { Badge } from "../admin/AdminUI";
import { dateTime } from "../admin/adminUtils";
export default function Dashboard() {
  const { user } = useAuth();
  const requests = useResource("/requests/my");
  const services = useResource("/services");
  const loading = requests.loading || services.loading;
  const error = requests.error || services.error;
  const rows = requests.data?.requests || [];
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR UNIVERSITY SERVICES</p>
          <h1>Welcome, {user.name}</h1>
          <p className="muted">
            Your requests and university services, in one place.
          </p>
        </div>
        {user.role === "admin" && (
          <Link className="button-link" to="/admin">
            Open admin portal →
          </Link>
        )}
      </div>
      {loading && <p role="status">Loading your dashboard…</p>}
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
          <button
            className="secondary"
            onClick={() => {
              requests.reload();
              services.reload();
            }}
          >
            Retry
          </button>
        </div>
      )}
      {!loading && !error && (
        <>
          <div className="metric-grid student-metrics">
            {[
              ["Available services", services.data.services.length],
              ["My requests", rows.length],
              [
                "Pending requests",
                rows.filter((row) => row.status === "Pending").length,
              ],
              [
                "Completed requests",
                rows.filter((row) => row.status === "Completed").length,
              ],
            ].map(([label, count]) => (
              <article className="metric-card" key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
              </article>
            ))}
          </div>
          <div className="button-row section-space">
            <Link className="button-link" to="/services">
              Browse services
            </Link>
            {user.role === "student" && (
              <Link className="button-link secondary" to="/request-service">
                Request a service
              </Link>
            )}
            <Link className="button-link secondary" to="/my-requests">
              My requests
            </Link>
            <Link className="button-link secondary" to="/profile">
              My profile
            </Link>
          </div>
          <div className="button-row section-space"><Link className="button-link secondary" to="/appointments">Appointments</Link><Link className="button-link secondary" to="/complaints">Complaints & support</Link><Link className="button-link secondary" to="/notifications">Notifications</Link></div>
          <section className="panel">
            <header className="panel-heading">
              <h2>Recent requests</h2>
              <Link to="/my-requests">View all →</Link>
            </header>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Submitted</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row) => (
                    <tr key={row._id}>
                      <td>{row.service}</td>
                      <td>{dateTime(row.createdAt)}</td>
                      <td>
                        <Badge value={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <div className="empty-state">
                You have not submitted a service request yet.
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
