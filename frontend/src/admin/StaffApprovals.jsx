import { useState } from "react";
import api, { errorMessage } from "../api/client";
import useResource from "../hooks/useResource";
import Modal from "../components/Modal";
import { Badge, Confirm, LoadingError, Notice, Pagination } from "./AdminUI";
import { dateTime, listUrl } from "./adminUtils";

function ReviewForm({ user, onClose, onSaved }) {
  const [decision, setDecision] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const review = async () => {
    setBusy(true); setError("");
    try {
      const { data } = await api.patch(`/admin/staff-registrations/${user._id}`, {
        approvalStatus: decision, expectedStatus: user.approvalStatus || "pending",
        expectedUpdatedAt: user.updatedAt || null,
      });
      onSaved(data.message);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  if (decision) return <Confirm title={`${decision === "approved" ? "Approve" : "Reject"} staff registration?`} busy={busy} error={error} onClose={() => { setDecision(""); setError(""); }} onConfirm={review}>
    {user.name} ({user.email}) will be marked {decision}. {decision === "approved" ? "An active account will be able to process requests across all university departments." : "The account will lose staff access, including existing sessions."}
  </Confirm>;
  return <Modal title="Review staff registration" onClose={onClose}>
    <dl className="detail-list">
      <dt>Name</dt><dd>{user.name}</dd><dt>Email</dt><dd>{user.email}</dd>
      <dt>Staff ID</dt><dd>{user.staffId || "Not provided"}</dd>
      {user.department && <><dt>Legacy department</dt><dd>{user.department}</dd></>}
      <dt>Approval</dt><dd><Badge value={user.approvalStatus || "pending"} /></dd>
      <dt>Account</dt><dd>{user.active === false ? "Inactive — approval does not reactivate it" : "Active"}</dd>
      <dt>Registered</dt><dd>{dateTime(user.createdAt)}</dd>
    </dl>
    <p className="muted">Verify the name, email and staff ID through university records before approving. Approved staff can process requests across all departments.</p>
    {Boolean(user.approvalHistory?.length) && <details><summary>Review history</summary><ul>{user.approvalHistory.map((entry, i) => <li key={entry._id || i}>{entry.status} · {entry.department} · {dateTime(entry.reviewedAt)} · Administrator {entry.reviewedBy}</li>)}</ul></details>}
    <footer className="modal-actions"><button className="secondary" onClick={onClose}>Close</button><button className="secondary" onClick={() => setDecision("rejected")}>Reject</button><button onClick={() => setDecision("approved")}>Approve</button></footer>
  </Modal>;
}
function ReviewDialog({ id, onClose, onSaved }) {
  const resource = useResource(`/admin/staff-registrations/${id}`);
  if (resource.loading || resource.error) return <Modal title="Staff registration" onClose={onClose}><LoadingError resource={resource} /></Modal>;
  return <ReviewForm user={resource.data.user} onClose={onClose} onSaved={onSaved} />;
}
export default function StaffApprovals() {
  const [filters, setFilters] = useState({ q: "", approvalStatus: "pending", department: "" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState("");
  const resource = useResource(listUrl("/admin/staff-registrations", filters, page));
  const departments = useResource("/auth/departments");
  const change = (event) => { setFilters({ ...filters, [event.target.name]: event.target.value }); setPage(1); };
  return <>
    <div className="page-heading"><div><p className="eyebrow">ACCOUNT REVIEW</p><h1>Staff approvals</h1><p className="muted">Verify staff and lecturers before granting access to university service requests.</p></div><button className="secondary" onClick={resource.reload}>Refresh</button></div>
    <Notice>{notice}</Notice>
    {resource.data?.summary && <section className="staff-summary" aria-label="Staff approval totals">{Object.entries(resource.data.summary).map(([status, count]) => <article className="panel" key={status}><Badge value={status} /><h2>{count}</h2></article>)}</section>}
    <section className="panel"><div className="filters">
      <label className="search-field">Search staff<input name="q" value={filters.q} onChange={change} placeholder="Name, email, staff ID or department" maxLength={100} /></label>
      <div><label htmlFor="approval-status-filter">Approval status</label><select id="approval-status-filter" name="approvalStatus" value={filters.approvalStatus} onChange={change}><option value="">All statuses</option>{["pending", "approved", "rejected"].map((s) => <option key={s}>{s}</option>)}</select></div>
      <label>Department<select name="department" value={filters.department} onChange={change}><option value="">All departments</option>{departments.data?.departments.map((d) => <option key={d}>{d}</option>)}</select></label>
    </div>
    <LoadingError resource={resource} /><LoadingError resource={departments} />
    {!resource.loading && !resource.error && <>
      <div className="table-scroll"><table><thead><tr><th>Staff member</th><th>Staff ID</th><th>Department</th><th>Approval</th><th>Registered</th><th>Action</th></tr></thead><tbody>
        {resource.data.items.map((user) => <tr key={user._id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td>{user.staffId || "—"}</td><td>{user.department || "Not required"}</td><td><Badge value={user.approvalStatus || "pending"} /></td><td>{dateTime(user.createdAt)}</td><td><button className="table-button" onClick={() => setSelected(user._id)}>Review</button></td></tr>)}
      </tbody></table></div>
      {!resource.data.items.length && <div className="empty-state">No staff registrations match these filters.</div>}
      <Pagination data={resource.data} page={page} onChange={setPage} />
    </>}
    </section>
    {selected && <ReviewDialog id={selected} onClose={() => setSelected(null)} onSaved={(message) => { setNotice(message); setSelected(null); resource.reload(); }} />}
  </>;
}
