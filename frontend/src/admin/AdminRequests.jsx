import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import useResource from "../hooks/useResource";
import Modal from "../components/Modal";
import { Badge, Notice, Pagination, LoadingError } from "./AdminUI";
import { listUrl, dateTime } from "./adminUtils";
const statuses = ["Pending", "Processing", "Approved", "Rejected", "Completed"];

function RequestEditor({ data, staff, onClose, onSaved }) {
  const request = data.request;
  const [form, setForm] = useState({
    status: request.status,
    assignedStaff: request.assignedStaff?._id || "",
    staffComment: request.staffComment || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const change = (event) =>
    setForm({ ...form, [event.target.name]: event.target.value });
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await api.patch(`/admin/requests/${request._id}`, {
        ...form,
        assignedStaff: form.assignedStaff || null,
        expectedStatus: request.status,
      });
      onSaved(response.data.message);
    } catch (err) {
      setError(errorMessage(err));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Request details" onClose={onClose} busy={busy}>
      <div className="request-detail-heading">
        <Badge value={request.status} />
        <code>{request._id}</code>
      </div>
      <dl className="detail-list">
        <dt>Student</dt>
        <dd>
          {request.student?.name || "Unavailable account"}
          <small>{request.student?.email || "Email unavailable"}</small>
        </dd>
        <dt>Student ID</dt>
        <dd>{request.studentId}</dd>
        <dt>Phone</dt>
        <dd>{request.student?.phone || "Not provided"}</dd>
        <dt>Service</dt>
        <dd>{request.service}</dd>
        <dt>Description</dt>
        <dd className="preserve-lines">{request.description}</dd>
        <dt>Priority</dt>
        <dd>
          <Badge value={request.priority} />
        </dd>
        {request.document && (
          <>
            <dt>Document reference</dt>
            <dd>{request.document}</dd>
          </>
        )}
        <dt>Submitted</dt>
        <dd>{dateTime(request.createdAt)}</dd>
        <dt>Updated</dt>
        <dd>{dateTime(request.updatedAt)}</dd>
      </dl>
      <Notice error>{error}</Notice>
      {confirming ? (
        <div className="confirm-inline">
          <h3>Confirm request changes</h3>
          <p>
            Status:{" "}
            <strong>
              {request.status} → {form.status}
            </strong>
          </p>
          <p>
            Assignment and staff comments will be saved. Completed and rejected
            requests cannot change status.
          </p>
          <footer className="modal-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Back to editing
            </button>
            <button disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Confirm changes"}
            </button>
          </footer>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setConfirming(true);
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Request status
              <select name="status" value={form.status} onChange={change}>
                {[request.status, ...data.allowedStatuses].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              Assigned staff
              <select
                name="assignedStaff"
                value={form.assignedStaff}
                onChange={change}
              >
                <option value="">Unassigned</option>
                {request.assignedStaff &&
                  !staff.some(
                    (user) => user._id === request.assignedStaff._id,
                  ) && (
                    <option value={request.assignedStaff._id}>
                      {request.assignedStaff.name} (unavailable; choose another)
                    </option>
                  )}
                {staff.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name} · {user.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Staff comments
              <textarea
                name="staffComment"
                value={form.staffComment}
                onChange={change}
                rows={3}
                maxLength={2000}
              />
            </label>
          </fieldset>
          <footer className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Close
            </button>
            <button disabled={busy}>Review changes</button>
          </footer>
        </form>
      )}
    </Modal>
  );
}
function RequestDialog({ id, onClose, onSaved }) {
  const resource = useResource(`/admin/requests/${id}`);
  const staff = useResource("/admin/staff");
  if (resource.loading || resource.error || staff.loading || staff.error)
    return (
      <Modal title="Request details" onClose={onClose}>
        <LoadingError resource={resource} />
        <LoadingError resource={staff} />
      </Modal>
    );
  return (
    <RequestEditor
      data={resource.data}
      staff={staff.data.staff}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
export default function AdminRequests() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("request");
  const [filters, setFilters] = useState({
    q: "",
    status: statuses.includes(params.get("status")) ? params.get("status") : "",
    priority: "",
    service: "",
    from: "",
    to: "",
    sort: "createdAt",
    order: "desc",
  });
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const resource = useResource(listUrl("/admin/requests", filters, page));
  const filter = (event) => {
    setFilters({ ...filters, [event.target.name]: event.target.value });
    setPage(1);
  };
  const close = () => setParams({}, { replace: true });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">STUDENT SUPPORT</p>
          <h1>Service requests</h1>
          <p className="muted">
            Review requests, coordinate staff and track progress.
          </p>
        </div>
        <button className="secondary" onClick={resource.reload}>
          ↻ Refresh
        </button>
      </div>
      <Notice>{notice}</Notice>
      <section className="panel">
        <div className="filters">
          <label className="search-field">
            Search requests
            <input
              name="q"
              value={filters.q}
              onChange={filter}
              placeholder="Student, full request ID or service…"
            />
          </label>
          <label>
            Status
            <select name="status" value={filters.status} onChange={filter}>
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select name="priority" value={filters.priority} onChange={filter}>
              <option value="">All priorities</option>
              <option>Normal</option>
              <option>Urgent</option>
            </select>
          </label>
          <label>
            Service (exact name)
            <input
              name="service"
              value={filters.service}
              onChange={filter}
              placeholder="All services"
              maxLength={120}
            />
          </label>
        </div>
        <div className="filters filters-secondary">
          <label>
            From date (UTC)
            <input
              type="date"
              name="from"
              value={filters.from}
              onChange={filter}
            />
          </label>
          <label>
            To date (UTC)
            <input type="date" name="to" value={filters.to} onChange={filter} />
          </label>
          <label>
            Sort by
            <select name="sort" value={filters.sort} onChange={filter}>
              <option value="createdAt">Submitted date</option>
              <option value="updatedAt">Last updated</option>
              <option value="service">Service</option>
              <option value="status">Status</option>
              <option value="priority">Priority</option>
            </select>
          </label>
          <label>
            Order
            <select name="order" value={filters.order} onChange={filter}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
          <button
            className="secondary filter-reset"
            onClick={() => {
              setFilters({
                q: "",
                status: "",
                priority: "",
                service: "",
                from: "",
                to: "",
                sort: "createdAt",
                order: "desc",
              });
              setPage(1);
            }}
          >
            Reset
          </button>
        </div>
        <LoadingError resource={resource} />
        {!resource.loading && !resource.error && (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Student / request ID</th>
                    <th>Service</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned staff</th>
                    <th>Submitted</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {resource.data.items.map((row) => (
                    <tr key={row._id}>
                      <td>
                        <strong>
                          {row.student?.name || "Unavailable account"}
                        </strong>
                        <small className="request-id">{row._id}</small>
                      </td>
                      <td>{row.service}</td>
                      <td>
                        <Badge value={row.priority} />
                      </td>
                      <td>
                        <Badge value={row.status} />
                      </td>
                      <td>{row.assignedStaff?.name || "Unassigned"}</td>
                      <td>{dateTime(row.createdAt)}</td>
                      <td>
                        <button
                          className="table-button"
                          onClick={() => setParams({ request: row._id })}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!resource.data.items.length && (
              <div className="empty-state">No requests match your filters.</div>
            )}
            <Pagination data={resource.data} page={page} onChange={setPage} />
          </>
        )}
      </section>
      {selectedId && (
        <RequestDialog
          id={selectedId}
          onClose={close}
          onSaved={(message) => {
            setNotice(message);
            close();
            setPage(1);
            resource.reload();
          }}
        />
      )}
    </>
  );
}
