import { useRef, useState } from "react";
import useAuth from "../auth/useAuth";
import { errorMessage } from "../api/client";
import useNotifications, { markNotificationRead, markAllNotificationsRead } from "../hooks/useNotifications";
import NotificationItem from "../components/NotificationItem";
import { LoadingError, Notice, Pagination } from "../admin/AdminUI";
import "../styles/notifications.css";
export default function Notifications({ admin = false }) {
  const { user } = useAuth();
  return <InboxPage key={user.id || user._id} role={user.role} admin={admin} />;
}
function InboxPage({ role, admin }) {
  const [page, setPage] = useState(1), [filter, setFilter] = useState(""), [type, setType] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const lock = useRef(false);
  const resource = useNotifications(`/notifications?${new URLSearchParams({ page, read: filter, type })}`);
  const read = async id => {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      if (id) await markNotificationRead(id); else await markAllNotificationsRead();
      if (!id) setPage(1);
      else if (filter === "unread" && resource.data?.items.length === 1) setPage(value => Math.max(1, value - 1));
      setNotice(id ? "Notification marked as read." : "All notifications marked as read.");
      return true;
    } catch (err) { setError(errorMessage(err)); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  const Container = admin ? "section" : "main";
  return <Container className={admin || role === "staff" ? "notifications-page" : "page narrow-page notifications-page"}>
    <div className="page-heading"><div><p className="eyebrow">STAY INFORMED</p><h1>Notifications</h1><p className="muted">Updates about your requests, appointments, complaints and approvals.</p></div><div className="button-row"><button className="secondary" onClick={resource.reload}>Refresh</button><button disabled={busy || !resource.data?.unread} onClick={() => read()}>Mark all as read</button></div></div>
    <section className="panel notification-filters"><label>Read status<select aria-label="Read status" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }}><option value="">All notifications</option><option value="unread">Unread</option><option value="read">Read</option></select></label><label>Notification type<select aria-label="Notification type" value={type} onChange={event => { setType(event.target.value); setPage(1); }}><option value="">All types</option>{(resource.data?.types || ["request", "appointment", "complaint", "staff-approval", "general"]).map(value => <option key={value} value={value}>{value.replaceAll("-", " ")}</option>)}</select></label></section>
    <Notice>{notice}</Notice><Notice error>{error}</Notice><LoadingError resource={resource} />
    {!resource.loading && !resource.error && <section className="panel"><h2 className="notification-summary" aria-live="polite">{resource.data.unread} unread</h2>{!resource.data.items.length && <p className="notification-empty">{filter || type ? "No notifications match these filters." : "You're all caught up. No new notifications."}</p>}
      {resource.data.items.map(item => <NotificationItem key={item._id} item={item} role={role} busy={busy} onRead={read} />)}
      <Pagination data={resource.data} page={page} onChange={setPage} />
    </section>}
  </Container>;
}
