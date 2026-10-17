import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import useResource from "../hooks/useResource";
import useDebouncedValue from "../hooks/useDebouncedValue";
import Modal from "../components/Modal";
import { Badge, Notice, Pagination, LoadingError } from "./AdminUI";
import { listUrl, dateTime } from "./adminUtils";
const statuses = ["Pending", "Processing", "Approved", "Rejected", "Completed"];

function RequestEditor({ data, staff, onClose, onSaved, staffMode }) {
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
  const saving = useRef(false);
  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await api.patch(`/${staffMode ? "staff" : "admin"}/requests/${request._id}`, {
        status: form.status,
        staffComment: form.staffComment,
        ...(!staffMode && { assignedStaff: form.assignedStaff || null }),
        expectedStatus: request.status,
        expectedUpdatedAt: request.updatedAt,
      });
      onSaved(response.data.message);
    } catch (err) {
      setError(errorMessage(err));
      setConfirming(false);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal title="Request details" onClose={onClose} busy={busy}>
      <div className="request-detail-heading">
        <Badge value={request.status} />
        <code>{request._id}</code>
      </div>
      <h3>Student &amp; service information</h3>
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
        <dt>Department</dt>
        <dd>{request.serviceDetails?.department || "Department unavailable"}</dd>
        {request.serviceDetails?.description && <><dt>Service description</dt><dd className="preserve-lines">{request.serviceDetails.description}</dd></>}
        <dt>Request description</dt>
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
        <dt>Assigned staff</dt><dd>{request.assignedStaff?.name || "Unassigned"}</dd>
        <dt>Submitted</dt>
        <dd>{dateTime(request.createdAt)}</dd>
        <dt>Updated</dt>
        <dd>{dateTime(request.updatedAt)}</dd>
      </dl>
      <h3>Request management</h3>
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
            {staffMode ? "Staff comments" : "Assignment and staff comments"} will be saved. Completed and rejected
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
            {!staffMode && <label>
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
            </label>}
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
function RequestDialog({ id, onClose, onSaved, staffMode }) {
  const resource = useResource(`/${staffMode ? "staff" : "admin"}/requests/${id}`);
  const staff = useResource(staffMode ? null : "/admin/staff");
  if (resource.loading || resource.error || (!staffMode && (staff.loading || staff.error)))
    return (
      <Modal title="Request details" onClose={onClose}>
        <LoadingError resource={resource} />
        {!staffMode && <LoadingError resource={staff} />}
      </Modal>
    );
  return (
    <RequestEditor
      data={resource.data}
      staff={staffMode ? [] : staff.data.staff}
      staffMode={staffMode}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
export default function AdminRequests({ staffMode = false, onUpdated }) {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("request");
  const [filters, setFilters] = useState({
    q: "",
    status: statuses.includes(params.get("status")) ? params.get("status") : "",
    priority: "",
    service: "",
    department: "",
    from: "",
    to: "",
    sort: "createdAt",
    order: "desc",
  });
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const search = useDebouncedValue(filters.q);
  const resource = useResource(listUrl(`/${staffMode ? "staff" : "admin"}/requests`, { ...filters, q: staffMode ? search : filters.q }, page));
  const departments = useResource("/auth/departments");
  const filter = (event) => {
    setFilters({ ...filters, [event.target.name]: event.target.value });
    setPage(1);
  };
  const close = () => { const next = new URLSearchParams(params); next.delete("request"); setParams(next, { replace: true }); };
  return (
    <>
      <div className="page-heading">
        <div>
          {!staffMode && <p className="eyebrow">STUDENT SUPPORT</p>}
          {staffMode ? <h2>Service requests</h2> : <h1>Service requests</h1>}
          <p className="muted">
            {staffMode ? "Review and process service requests across all university departments." : "Review requests, coordinate staff and track progress."}
          </p>
        </div>
        <button className="secondary" onClick={resource.reload}>
          ↻ Refresh
        </button>
      </div>
      <Notice>{notice}</Notice>
      <section className="panel">
        {staffMode ? <div className="staff-filters">
          <label className="staff-search">Search requests<input name="q" value={filters.q} onChange={filter} placeholder="Student, full request ID or service" maxLength={100} /></label>
          <label>Status<select aria-label="Status" name="status" value={filters.status} onChange={filter}><option value="">All statuses</option>{statuses.map(status => <option key={status}>{status}</option>)}</select></label>
          <label>Department<select aria-label="Department" name="department" value={filters.department} onChange={filter}><option value="">All departments</option>{departments.data?.departments.map(department => <option key={department}>{department}</option>)}</select></label>
          <label>Sort by<select aria-label="Sort by" value={filters.sort + ":" + filters.order} onChange={event => { const [sort, order] = event.target.value.split(":"); setFilters({ ...filters, sort, order }); setPage(1); }}><option value="createdAt:desc">Newest first</option><option value="createdAt:asc">Oldest first</option><option value="priority:desc">Urgent first</option><option value="updatedAt:desc">Recently updated</option></select></label>
          <label>Priority<select aria-label="Priority" name="priority" value={filters.priority} onChange={filter}><option value="">All priorities</option><option>Normal</option><option>Urgent</option></select></label>
          <button className="secondary filter-reset" onClick={() => { setFilters({ q: "", status: "", priority: "", service: "", department: "", from: "", to: "", sort: "createdAt", order: "desc" }); setPage(1); }}>Clear filters</button>
        </div> : <>        <div className="filters">
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
          <div className="filter-control"><label htmlFor="request-department">Department</label>
            <select id="request-department" name="department" value={filters.department} onChange={filter}>
              <option value="">All departments</option>
              {departments.data?.departments.map((department) => <option key={department}>{department}</option>)}
            </select>
          </div>
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
                department: "",
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
</>}
        <LoadingError resource={resource} />
        {departments.error && <Notice error>Department filters could not load. <button className="secondary" onClick={departments.reload}>Retry departments</button></Notice>}
        {!resource.loading && !resource.error && (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Student / request ID</th>
                    <th>Service</th>
                    <th>Department</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned staff</th>
                    <th>Submitted</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.items.map((row) => (
                    <tr key={row._id}>
                      <td data-label="Student / request ID">
                        <strong>
                          {row.student?.name || "Unavailable account"}
                        </strong>
                        <small className="request-id">{row._id}</small>
                      </td>
                      <td data-label="Service">{row.service}</td>
                      <td data-label="Department">{row.serviceDetails?.department || "Department unavailable"}</td>
                      <td data-label="Priority">
                        <Badge value={row.priority} />
                      </td>
                      <td data-label="Status">
                        <Badge value={row.status} />
                      </td>
                      <td data-label="Assigned staff">{row.assignedStaff?.name || "Unassigned"}</td>
                      <td data-label="Submitted">{dateTime(row.createdAt)}</td>
                      <td data-label="Actions">
                        <button
                          className="table-button"
                          onClick={() => { const next = new URLSearchParams(params); next.set("request", row._id); setParams(next); }}
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
          staffMode={staffMode}
          onClose={close}
          onSaved={(message) => {
            setNotice(message);
            close();
            setPage(1);
            resource.reload();
            onUpdated?.();
          }}
        />
      )}
    </>
  );
}
