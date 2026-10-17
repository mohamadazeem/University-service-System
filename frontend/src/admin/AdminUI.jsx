import Modal from "../components/Modal";
export function Badge({ value }) {
  return (
    <span className={`badge badge-${String(value).toLowerCase().replaceAll(" ", "-")}`}>
      {value}
    </span>
  );
}
export function Notice({ children, error = false }) {
  return children ? (
    <div
      className={`notice ${error ? "notice-error" : "notice-success"}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  ) : null;
}
export function LoadingError({ resource }) {
  if (resource.loading)
    return (
      <div className="empty-state" role="status">
        Loading university records…
      </div>
    );
  if (resource.error)
    return (
      <div className="empty-state">
        <Notice error>{resource.error}</Notice>
        <button className="secondary" onClick={resource.reload}>
          Try again
        </button>
      </div>
    );
  return null;
}
export function Pagination({ data, page, onChange }) {
  if (!data) return null;
  const pages = Math.max(1, data.pages);
  return (
    <div className="pagination">
      <span>
        {data.total} record{data.total === 1 ? "" : "s"} · Page {page} of{" "}
        {pages}
      </span>
      <div className="button-row">
        <button
          className="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          className="secondary"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
export function Confirm({ title, children, onClose, onConfirm, busy, error }) {
  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <p>{children}</p>
      <Notice error>{error}</Notice>
      <footer className="modal-actions">
        <button className="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button onClick={onConfirm} disabled={busy}>
          {busy ? "Saving…" : "Confirm"}
        </button>
      </footer>
    </Modal>
  );
}
