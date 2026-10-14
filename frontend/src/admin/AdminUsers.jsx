import { useState } from "react";
import api, { errorMessage } from "../api/client";
import useResource from "../hooks/useResource";
import Modal from "../components/Modal";
import { Badge, Confirm, Notice, Pagination, LoadingError } from "./AdminUI";
import { listUrl, dateTime } from "./adminUtils";
const roles = ["student", "staff", "admin"];
function UserForm({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    studentId: user?.studentId || "",
    ...(!user && { password: "", role: "staff" }),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = (event) =>
    setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    if (
      !user &&
      !window.confirm(`Create a ${form.role} account for ${form.email}?`)
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = user
        ? await api.patch(`/admin/users/${user._id}`, form)
        : await api.post("/admin/users", form);
      onSaved(response.data.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={user ? "Edit account details" : "Create university account"}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <Notice error>{error}</Notice>
        <fieldset disabled={busy}>
          <label>
            Full name
            <input
              name="name"
              value={form.name}
              onChange={change}
              required
              maxLength={100}
            />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={change}
              required
              maxLength={254}
            />
          </label>
          <div className="form-grid">
            <label>
              Student ID (optional)
              <input
                name="studentId"
                value={form.studentId}
                onChange={change}
                maxLength={50}
              />
            </label>
            <label>
              Phone (optional)
              <input
                name="phone"
                value={form.phone}
                onChange={change}
                maxLength={30}
              />
            </label>
          </div>
          {!user && (
            <>
              <label>
                Role
                <select name="role" value={form.role} onChange={change}>
                  {roles.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>
              <label>
                Initial password
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={change}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <p className="muted">
                At least 8 characters; at most 72 UTF-8 bytes. Share it securely
                with the account owner.
              </p>
            </>
          )}
        </fieldset>
        <footer className="modal-actions">
          <button
            className="secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button disabled={busy}>{busy ? "Saving…" : "Save account"}</button>
        </footer>
      </form>
    </Modal>
  );
}
function UserDetails({ id, onClose, onEdit }) {
  const resource = useResource(`/admin/users/${id}`);
  const user = resource.data?.user;
  return (
    <Modal title="Account details" onClose={onClose}>
      <LoadingError resource={resource} />
      {!resource.loading && !resource.error && (
        <>
          <dl className="detail-list">
            <dt>Name</dt>
            <dd>{user.name}</dd>
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Role</dt>
            <dd>
              <Badge value={user.role} />
            </dd>
            <dt>Account</dt>
            <dd>
              <Badge value={user.active === false ? "Inactive" : "Active"} />
            </dd>
            <dt>Student ID</dt>
            <dd>{user.studentId || "Not provided"}</dd>
            <dt>Phone</dt>
            <dd>{user.phone || "Not provided"}</dd>
            <dt>Related requests</dt>
            <dd>{resource.data.requestCount}</dd>
            <dt>Registered</dt>
            <dd>{dateTime(user.createdAt)}</dd>
            <dt>Updated</dt>
            <dd>{dateTime(user.updatedAt)}</dd>
          </dl>
          <footer className="modal-actions">
            <button onClick={() => onEdit(user)}>Edit details</button>
          </footer>
        </>
      )}
    </Modal>
  );
}
export default function AdminUsers() {
  const [filters, setFilters] = useState({
    q: "",
    role: "",
    active: "",
    sort: "createdAt",
    order: "desc",
  });
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const [role, setRole] = useState("student");
  const [confirmRole, setConfirmRole] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resource = useResource(listUrl("/admin/users", filters, page));
  const filter = (event) => {
    setFilters({ ...filters, [event.target.name]: event.target.value });
    setPage(1);
  };
  const open = (type, user) => {
    setError("");
    setConfirmRole(false);
    setDialog({ type, user });
    if (user) setRole(user.role);
  };
  const saved = (message) => {
    setNotice(message);
    setDialog(null);
    setPage(1);
    resource.reload();
  };
  const mutate = async () => {
    setBusy(true);
    setError("");
    try {
      let response;
      if (dialog.type === "role")
        response = await api.patch(`/admin/users/${dialog.user._id}/role`, {
          role,
        });
      else if (dialog.user.active === false)
        response = await api.patch(`/admin/users/${dialog.user._id}`, {
          active: true,
        });
      else response = await api.delete(`/admin/users/${dialog.user._id}`);
      saved(response.data.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">UNIVERSITY DIRECTORY</p>
          <h1>Users & permissions</h1>
          <p className="muted">
            Manage accounts with care. Administrator accounts are protected.
          </p>
        </div>
        <button onClick={() => open("edit", null)}>+ Create account</button>
      </div>
      <Notice>{notice}</Notice>
      <section className="panel">
        <div className="filters">
          <label className="search-field">
            Search users
            <input
              name="q"
              value={filters.q}
              onChange={filter}
              placeholder="Name, email or student ID…"
            />
          </label>
          <label>
            Role
            <select name="role" value={filters.role} onChange={filter}>
              <option value="">All roles</option>
              {roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </label>
          <label>
            Account
            <select name="active" value={filters.active} onChange={filter}>
              <option value="">All accounts</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <label>
            Sort by
            <select name="sort" value={filters.sort} onChange={filter}>
              <option value="createdAt">Registered date</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="role">Role</option>
              <option value="updatedAt">Last updated</option>
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
                role: "",
                active: "",
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
                    <th>Account</th>
                    <th>Student ID</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.items.map((user) => (
                    <tr key={user._id}>
                      <td>
                        <strong>{user.name}</strong>
                        <small>{user.email}</small>
                      </td>
                      <td>{user.studentId || "—"}</td>
                      <td>
                        <Badge value={user.role} />
                      </td>
                      <td>
                        <Badge
                          value={user.active === false ? "Inactive" : "Active"}
                        />
                      </td>
                      <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="button-row">
                          <button
                            className="table-button"
                            onClick={() => open("view", user)}
                          >
                            Details
                          </button>
                          <button
                            className="table-button"
                            onClick={() => open("edit", user)}
                          >
                            Edit
                          </button>
                          <button
                            className="table-button"
                            disabled={
                              user.role === "admin" || user.active === false
                            }
                            onClick={() => open("role", user)}
                          >
                            Role
                          </button>
                          <button
                            className="table-button danger-text"
                            disabled={user.role === "admin"}
                            onClick={() => open("active", user)}
                          >
                            {user.active === false
                              ? "Reactivate"
                              : "Deactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!resource.data.items.length && (
              <div className="empty-state">No accounts match your filters.</div>
            )}
            <Pagination data={resource.data} page={page} onChange={setPage} />
          </>
        )}
      </section>
      {dialog?.type === "edit" && (
        <UserForm
          user={dialog.user}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog?.type === "view" && (
        <UserDetails
          id={dialog.user._id}
          onClose={() => setDialog(null)}
          onEdit={(user) => open("edit", user)}
        />
      )}
      {dialog?.type === "active" && (
        <Confirm
          title={
            dialog.user.active === false
              ? "Reactivate account?"
              : "Deactivate account?"
          }
          onClose={() => setDialog(null)}
          onConfirm={mutate}
          busy={busy}
          error={error}
        >
          {dialog.user.active === false
            ? "This account will be able to sign in again."
            : "This account will lose access immediately. Historical requests and assignments will remain."}{" "}
          Account: {dialog.user.name}.
        </Confirm>
      )}
      {dialog?.type === "role" && (
        <Modal
          title="Change account role"
          onClose={() => setDialog(null)}
          busy={busy}
        >
          <p>
            Account: <strong>{dialog.user.name}</strong>
          </p>
          <Notice error>{error}</Notice>
          {confirmRole ? (
            <>
              <p>
                Change role from <strong>{dialog.user.role}</strong> to{" "}
                <strong>{role}</strong>?{" "}
                {role === "admin" &&
                  "This grants full administration access. Administrator roles cannot be demoted through the portal."}
              </p>
              <footer className="modal-actions">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setConfirmRole(false)}
                >
                  Back
                </button>
                <button disabled={busy} onClick={mutate}>
                  {busy ? "Saving…" : "Confirm role change"}
                </button>
              </footer>
            </>
          ) : (
            <>
              <label>
                New role
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                >
                  {roles.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <footer className="modal-actions">
                <button
                  disabled={role === dialog.user.role}
                  onClick={() => setConfirmRole(true)}
                >
                  Review role change
                </button>
              </footer>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
