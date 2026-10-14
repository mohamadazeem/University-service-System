import { useState } from "react";
import useResource from "../hooks/useResource";
import { Badge } from "../admin/AdminUI";
import { dateTime } from "../admin/adminUtils";
export default function MyRequests() {
  const resource = useResource("/requests/my");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const rows = (resource.data?.requests || []).filter(
    (row) =>
      (!status || row.status === status) &&
      [row.service, row._id, row.description].some((value) =>
        value.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR REQUEST HISTORY</p>
          <h1>My requests</h1>
          <p className="muted">
            Track your requests and read the latest staff comments.
          </p>
        </div>
        <button className="secondary" onClick={resource.reload}>
          ↻ Refresh
        </button>
      </div>
      <section className="panel">
        <div className="filters">
          <label className="search-field">
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Service, description or request ID…"
            />
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {[
                "Pending",
                "Processing",
                "Approved",
                "Rejected",
                "Completed",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        {resource.loading && (
          <div className="empty-state" role="status">
            Loading requests…
          </div>
        )}
        {resource.error && (
          <div className="notice notice-error" role="alert">
            {resource.error}
          </div>
        )}
        {!resource.loading && !resource.error && (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Service / ID</th>
                    <th>Description</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Staff comments</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row._id}>
                      <td>
                        <strong>{row.service}</strong>
                        <small className="request-id">{row._id}</small>
                      </td>
                      <td className="preserve-lines">{row.description}</td>
                      <td>
                        <Badge value={row.priority} />
                      </td>
                      <td>
                        <Badge value={row.status} />
                      </td>
                      <td className="preserve-lines">
                        {row.staffComment || "No comments yet"}
                      </td>
                      <td>{dateTime(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <div className="empty-state">
                No requests match your selection.
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
