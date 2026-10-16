import { Link } from "react-router-dom";
import useResource from "../hooks/useResource";
import { Badge, LoadingError } from "./AdminUI";
import { dateTime } from "./adminUtils";
const colors = {
  Pending: "#d39a29",
  Processing: "#5076df",
  Approved: "#3c9980",
  Rejected: "#d3656b",
  Completed: "#7162bb",
};
export default function AdminDashboard() {
  const resource = useResource("/admin/dashboard");
  const data = resource.data;
  if (resource.loading || resource.error)
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">ADMINISTRATION</p>
            <h1>Dashboard overview</h1>
          </div>
        </div>
        <LoadingError resource={resource} />
      </>
    );
  const metrics = [
    ["Registered students", data.students],
    ["Staff members", data.staff],
    ["Total requests", data.totalRequests],
    ...Object.entries(data.statusCounts).map(([key, count]) => [
      `${key} requests`,
      count,
    ]),
  ];
  const total = data.totalRequests;
  let position = 0;
  const segments = Object.entries(data.statusCounts)
    .map(([key, count]) => {
      const start = position;
      position += total ? (count / total) * 100 : 0;
      return `${colors[key]} ${start}% ${position}%`;
    })
    .join(", ");
  const maxTrend = Math.max(1, ...data.trends.map((row) => row.count));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR UNIVERSITY AT A GLANCE</p>
          <h1>Dashboard overview</h1>
          <p className="muted">
            Manage services, support students, and keep requests moving.
          </p>
        </div>
        <button className="secondary" onClick={resource.reload}>
          ↻ Refresh data
        </button>
      </div>
      <div className="attention-banner"><div><strong>{data.statusCounts.Pending} requests awaiting review</strong><p>Start with pending requests to keep student services moving.</p></div><Link className="button-link" to="/admin/requests?status=Pending">Review pending requests</Link></div>
      <div className="metric-grid">
        {metrics.map(([label, count], index) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{count.toLocaleString()}</strong>
            <small>
              {index < 3 ? "University records" : "Current request status"}
            </small>
          </article>
        ))}
      </div>
      <div className="dashboard-charts">
        <section className="panel">
          <header className="panel-heading">
            <h2>Request distribution</h2>
            <span className="muted">All time</span>
          </header>
          <div className="distribution">
            <div
              className="donut"
              role="img"
              aria-label={Object.entries(data.statusCounts)
                .map(([key, count]) => `${key}: ${count}`)
                .join(", ")}
              style={{
                background: total ? `conic-gradient(${segments})` : "var(--border)",
              }}
            >
              <div>
                <strong>{total}</strong>
                <span>requests</span>
              </div>
            </div>
            <ul className="chart-legend">
              {Object.entries(data.statusCounts).map(([key, count]) => (
                <li key={key}>
                  <span>
                    <i style={{ background: colors[key] }} />
                    {key}
                  </span>
                  <strong>{count}</strong>
                </li>
              ))}
            </ul>
          </div>
          {!total && (
            <p className="muted">No requests have been submitted yet.</p>
          )}
        </section>
        <section className="panel">
          <header className="panel-heading">
            <h2>Request trends</h2>
            <span className="muted">Last 6 months · UTC</span>
          </header>
          <div
            className="trend-chart"
            role="img"
            aria-label={data.trends
              .map((row) => `${row.month}: ${row.count}`)
              .join(", ")}
          >
            {data.trends.map((row) => (
              <div className="trend-column" key={row.month}>
                <strong>{row.count}</strong>
                <div className="trend-track">
                  <div style={{ height: `${(row.count / maxTrend) * 100}%` }} />
                </div>
                <small>
                  {new Date(row.month + "-01T00:00:00Z").toLocaleDateString(
                    undefined,
                    { month: "short", timeZone: "UTC" },
                  )}
                </small>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel">
        <header className="panel-heading">
          <div>
            <h2>Recent requests</h2>
            <p className="muted">The latest requests from your students</p>
          </div>
          <Link className="text-link" to="/admin/requests">
            View all requests →
          </Link>
        </header>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Service</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.recentRequests.map((row) => (
                <tr key={row._id}>
                  <td>
                    <strong>
                      {row.student?.name || "Unavailable account"}
                    </strong>
                    <small>{row.studentId}</small>
                  </td>
                  <td>{row.service}</td>
                  <td>
                    <Badge value={row.priority} />
                  </td>
                  <td>
                    <Badge value={row.status} />
                  </td>
                  <td>{dateTime(row.createdAt)}</td>
                  <td>
                    <Link
                      className="text-link"
                      to={`/admin/requests?request=${row._id}`}
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.recentRequests.length && (
          <div className="empty-state">
            New requests will appear here when students submit them.
          </div>
        )}
      </section>
      <div className="quick-action-grid">
        {[
          [
            "Requests",
            "/admin/requests",
            "Review, assign and update student requests.",
          ],
          [
            "Users",
            "/admin/users",
            "Manage university accounts and permissions.",
          ],
          [
            "Services",
            "/admin/services",
            `${data.services} active services. Manage your catalogue.`,
          ],
        ].map(([title, path, description]) => (
          <Link to={path} className="quick-action" key={path}>
            <h3>
              Manage {title.toLowerCase()} <span>→</span>
            </h3>
            <p>{description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
