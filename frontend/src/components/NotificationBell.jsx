import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import useAuth from "../auth/useAuth";
import { errorMessage } from "../api/client";
import useNotifications, { markNotificationRead, markAllNotificationsRead } from "../hooks/useNotifications";
import NotificationItem from "./NotificationItem";
import "../styles/notifications.css";

function popoverPosition(button) {
  const rect = button.getBoundingClientRect();
  const headerBottom = button.closest("header")?.getBoundingClientRect().bottom || rect.bottom;
  const width = Math.min(390, window.innerWidth - 24);
  const top = Math.max(12, Math.min(Math.max(rect.bottom, headerBottom) + 12, window.innerHeight - 200));
  return { left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)), top, width, maxHeight: window.innerHeight - top - 12 };
}
function Inbox({ role }) {
  const page = role === "admin" ? "/admin/notifications" : role === "staff" ? "/staff/notifications" : "/notifications";
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [position, setPosition] = useState({});
  const count = useNotifications("/notifications/unread-count");
  const recent = useNotifications(open ? "/notifications?limit=5" : null);
  const root = useRef(null), button = useRef(null), panel = useRef(null), lock = useRef(false);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } };
    const focus = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const resize = () => setPosition(popoverPosition(button.current));
    window.addEventListener("resize", resize);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    document.addEventListener("focusin", focus);
    return () => { window.removeEventListener("resize", resize); document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); document.removeEventListener("focusin", focus); };
  }, [open]);
  const read = async notificationId => {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError("");
    try { if (notificationId) await markNotificationRead(notificationId); else await markAllNotificationsRead(); return true; }
    catch (err) { setError(errorMessage(err)); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  const unread = count.data?.unread || 0;
  return <div className="notification-bell" ref={root}>
    <button className="secondary notification-trigger" ref={button} aria-label="Notifications" aria-expanded={open} aria-controls={id} onClick={() => { setPosition(popoverPosition(button.current)); if (!open) recent.reload(); setOpen(!open); count.reload(); }} title="Notifications"><Bell size={20} aria-hidden="true" />{unread > 0 && <span className="notification-count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}</button>
    {open && <section id={id} className="notification-popover" style={position} role="region" aria-label="Notifications dropdown" tabIndex={-1} ref={panel}>
      <header><div><h2>Notifications</h2><span aria-live="polite">{count.loading && !count.data ? "Loading unread count..." : `${unread} unread`}</span></div><button className="secondary" disabled={busy || !unread} onClick={() => read()}>Mark all as read</button></header>
      {(error || count.error) && <p role="alert">{error || count.error}<button className="secondary" onClick={count.reload}>Retry</button></p>}
      {recent.loading ? <p role="status">Loading notifications...</p> : recent.error ? <p role="alert">{recent.error}<button className="secondary" onClick={recent.reload}>Retry</button></p> : <div className="notification-recent">{!recent.data?.items.length ? <p className="notification-empty">You're all caught up. No new notifications.</p> : recent.data.items.map(item => <NotificationItem key={item._id} item={item} role={role} onRead={read} busy={busy} onOpened={() => setOpen(false)} />)}</div>}
      <footer><Link to={page} onClick={() => setOpen(false)}>View all notifications</Link></footer>
    </section>}
  </div>;
}
export default function NotificationBell() {
  const { user } = useAuth();
  return user ? <Inbox key={user.id || user._id} role={user.role} /> : null;
}
