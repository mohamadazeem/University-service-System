import { Link, useNavigate } from "react-router-dom";
import { dateTime } from "../admin/adminUtils";

function destination(item, role) {
  const paths = {
    request: { student: "/my-requests", staff: "/staff/requests", admin: "/admin/requests" },
    appointment: { student: "/appointments", staff: "/staff/bookings", admin: "/admin/appointments" },
    complaint: { student: "/complaints", staff: "/staff/complaints", admin: "/admin/complaints" },
    "staff-approval": { staff: "/staff/profile", admin: "/admin/staff-approvals" },
  };
  return paths[item.entityType || item.type]?.[role];
}
export default function NotificationItem({ item, role, onRead, busy, onOpened }) {
  const navigate = useNavigate();
  const target = destination(item, role);
  const open = async event => {
    event.preventDefault();
    if (busy) return;
    const saved = item.isRead || await onRead(item._id);
    if (saved) { onOpened?.(); if (target) navigate(target); }
  };
  const title = item.title || "University update";
  return <article className={`notification-item ${item.isRead ? "" : "notification-item-unread"}`}>
    <div className="notification-item-heading">{target ? <Link to={target} onClick={open} aria-disabled={busy}>{title}</Link> : <strong>{title}</strong>}<span className="notification-state">{item.isRead ? "Read" : "Unread"}</span></div>
    <p>{item.message}</p><small>{(item.type || "general").replaceAll("-", " ")} · {dateTime(item.createdAt)}</small>
    {!item.isRead && <button className="secondary notification-read" disabled={busy} onClick={() => onRead(item._id)}>Mark as read</button>}
  </article>;
}
