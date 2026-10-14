import { useState } from "react";
import api, { errorMessage } from "../api/client";
import useResource from "../hooks/useResource";
import Modal from "../components/Modal";
import { Badge, Confirm, Notice, Pagination, LoadingError } from "./AdminUI";
import { listUrl, dateTime } from "./adminUtils";

function ServiceForm({ service, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: service?.name || "",
    description: service?.description || "",
    department: service?.department || "",
    processingTime: service?.processingTime || "",
    active: service?.active !== false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = (event) =>
    setForm({
      ...form,
      [event.target.name]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    });
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = service
        ? await api.patch(`/admin/services/${service._id}`, form)
        : await api.post("/admin/services", form);
      onSaved(response.data.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={service ? "Edit university service" : "Create university service"}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <Notice error>{error}</Notice>
        <fieldset disabled={busy}>
          <label>
            Service name
            <input
              name="name"
              value={form.name}
              onChange={change}
              required
              maxLength={120}
            />
          </label>
          <label>
            Department
            <input
              name="department"
              value={form.department}
              onChange={change}
              required
              maxLength={120}
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              value={form.description}
              onChange={change}
              required
              maxLength={2000}
              rows={4}
            />
          </label>
          <label>
            Processing time <span className="muted">(optional)</span>
            <input
              name="processingTime"
              placeholder="e.g. 3–5 working days"
              value={form.processingTime}
              onChange={change}
              maxLength={120}
            />
          </label>
          <label className="checkbox-label">
            <input
              name="active"
              type="checkbox"
              checked={form.active}
              onChange={change}
            />
            Available for new requests
          </label>
        </fieldset>
        <footer className="modal-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button disabled={busy}>{busy ? "Saving…" : "Save service"}</button>
        </footer>
      </form>
    </Modal>
  );
}
export default function AdminServices() {
  const [filters, setFilters] = useState({
    q: "",
    active: "",
    sort: "createdAt",
    order: "desc",
  });
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resource = useResource(listUrl("/admin/services", filters, page));
  const filter = (event) => {
    setFilters({ ...filters, [event.target.name]: event.target.value });
    setPage(1);
  };
  const saved = (message) => {
    setNotice(message);
    setDialog(null);
    setPage(1);
    resource.reload();
  };
  const deactivate = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await api.delete(
        `/admin/services/${dialog.service._id}`,
      );
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
          <p className="eyebrow">SERVICE CATALOGUE</p>
          <h1>University services</h1>
          <p className="muted">
            Maintain the services available to your students.
          </p>
        </div>
        <button onClick={() => setDialog({ type: "edit", service: null })}>
          + Create service
        </button>
      </div>
      <Notice>{notice}</Notice>
      <section className="panel">
        <div className="filters">
          <label className="search-field">
            Search services
            <input
              name="q"
              placeholder="Name, department or description…"
              value={filters.q}
              onChange={filter}
            />
          </label>
          <label>
            Availability
            <select name="active" value={filters.active} onChange={filter}>
              <option value="">All services</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <label>
            Sort by
            <select name="sort" value={filters.sort} onChange={filter}>
              <option value="createdAt">Created date</option>
              <option value="name">Name</option>
              <option value="department">Department</option>
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
                    <th>Service</th>
                    <th>Department</th>
                    <th>Processing time</th>
                    <th>Availability</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.items.map((service) => (
                    <tr key={service._id}>
                      <td>
                        <strong>{service.name}</strong>
                        <small className="truncate">
                          {service.description}
                        </small>
                      </td>
                      <td>{service.department}</td>
                      <td>{service.processingTime || "Not specified"}</td>
                      <td>
                        <Badge
                          value={
                            service.active === false ? "Inactive" : "Active"
                          }
                        />
                      </td>
                      <td>
                        <div className="button-row">
                          <button
                            className="table-button"
                            onClick={() => setDialog({ type: "view", service })}
                          >
                            Details
                          </button>
                          <button
                            className="table-button"
                            onClick={() => setDialog({ type: "edit", service })}
                          >
                            Edit
                          </button>
                          <button
                            className="table-button danger-text"
                            disabled={service.active === false}
                            onClick={() => {
                              setError("");
                              setDialog({ type: "delete", service });
                            }}
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!resource.data.items.length && (
              <div className="empty-state">
                No services match your filters. Create a service or change your
                search.
              </div>
            )}
            <Pagination data={resource.data} page={page} onChange={setPage} />
          </>
        )}
      </section>
      {dialog?.type === "edit" && (
        <ServiceForm
          service={dialog.service}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog?.type === "view" && (
        <Modal title={dialog.service.name} onClose={() => setDialog(null)}>
          <dl className="detail-list">
            <dt>Description</dt>
            <dd className="preserve-lines">{dialog.service.description}</dd>
            <dt>Department</dt>
            <dd>{dialog.service.department}</dd>
            <dt>Processing time</dt>
            <dd>{dialog.service.processingTime || "Not specified"}</dd>
            <dt>Availability</dt>
            <dd>
              <Badge
                value={dialog.service.active === false ? "Inactive" : "Active"}
              />
            </dd>
            <dt>Created</dt>
            <dd>{dateTime(dialog.service.createdAt)}</dd>
            <dt>Updated</dt>
            <dd>{dateTime(dialog.service.updatedAt)}</dd>
          </dl>
          <footer className="modal-actions">
            <button
              onClick={() =>
                setDialog({ type: "edit", service: dialog.service })
              }
            >
              Edit service
            </button>
          </footer>
        </Modal>
      )}
      {dialog?.type === "delete" && (
        <Confirm
          title="Deactivate service?"
          onClose={() => setDialog(null)}
          onConfirm={deactivate}
          busy={busy}
          error={error}
        >
          “{dialog.service.name}” will no longer accept new requests. Historical
          requests will remain available. You can reactivate it using Edit.
        </Confirm>
      )}
    </>
  );
}
