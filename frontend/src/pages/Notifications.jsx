import { useState } from "react";
import api, { errorMessage } from "../api/client";
import useResource from "../hooks/useResource";
import { LoadingError, Notice, Pagination } from "../admin/AdminUI";
import { dateTime } from "../admin/adminUtils";
export default function Notifications({
  admin = false
}) {
  const Container = admin ? "section" : "main";
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resource = useResource(`/notifications?page=${page}`);
  const read = async id => {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/notifications/${id}/read`);
      resource.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return <Container className={admin ? "" : "page narrow-page"}>
    <div className="page-heading"><div><p className="eyebrow">STAY INFORMED</p><h1>Notifications</h1><p className="muted">Updates about your requests, appointments, and complaints.</p></div><button className="secondary" onClick={resource.reload}>Refresh</button></div>
    <Notice error>{error}</Notice><LoadingError resource={resource} />
    {!resource.loading && !resource.error && <section className="panel"><h2>{resource.data.unread} unread</h2>{!resource.data.items.length && <div className="empty-state">You’re all caught up. New activity will appear here.</div>}
      {resource.data.items.map(item => <article className={`support-record ${item.isRead ? "" : "notification-unread"}`} key={item._id}><p>{item.message}</p><small>{dateTime(item.createdAt)}</small>{!item.isRead && <button disabled={busy} className="secondary" onClick={() => read(item._id)}>Mark as read</button>}</article>)}
      <Pagination data={resource.data} page={page} onChange={setPage} /></section>}
  </Container>;
}
