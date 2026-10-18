import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bell, CheckCheck, Clock3, FileText, LayoutGrid, Plus, Search } from "lucide-react";
import { AvailableAppointments } from "./StudentAppointments";
import useAuth from "../auth/useAuth";
import useResource from "../hooks/useResource";
import useNotifications, { markNotificationRead } from "../hooks/useNotifications";
import NotificationItem from "../components/NotificationItem";
import { Badge, LoadingError, Notice } from "../admin/AdminUI";
import { dateTime } from "../admin/adminUtils";
import { errorMessage } from "../api/client";
import "../styles/dashboard.css";

export default function Dashboard() {
  const { user } = useAuth();
  const requests = useResource("/requests/my");
  const services = useResource("/services");
  const notifications = useNotifications("/notifications?limit=3");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  const rows = requests.data?.requests || [];
  const read = async id => {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError("");
    try { await markNotificationRead(id); return true; }
    catch (err) { setError(errorMessage(err)); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  const metrics = [
    ["Available services", services.data?.services.length, "Explore university support", LayoutGrid, "/services", services],
    ["My requests", rows.length, "All your submitted requests", FileText, "/my-requests", requests],
    ["Pending requests", rows.filter(row => row.status === "Pending").length, "Awaiting university review", Clock3, "/my-requests", requests],
    ["Completed requests", rows.filter(row => row.status === "Completed").length, "Successfully resolved requests", CheckCheck, "/my-requests", requests],
  ];
  return <main className="page student-dashboard">
    <header className="dashboard-welcome">
      <div><p className="eyebrow">YOUR STUDENT PORTAL</p><h1>Welcome, {user.name}</h1><p className="muted">Your university services, requests and appointments in one place.</p></div>
      <div className="dashboard-date"><span>University Services</span><time dateTime={new Date().toISOString().slice(0, 10)}>{new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</time></div>
    </header>
    <section className="dashboard-stats" aria-label="Your statistics">
      {metrics.map(([label, count, description, Icon, to, resource]) => <Link to={to} className="dashboard-stat" key={label} aria-label={`${label}: ${resource.loading ? "Loading" : resource.error ? "Unavailable" : count}`}>
        <div className="dashboard-stat-heading"><span>{label}</span><Icon size={19} aria-hidden="true" /></div><strong>{resource.loading ? "…" : resource.error ? "—" : count}</strong><small>{description}</small>
      </Link>)}
    </section>
    {(requests.error || services.error) && <div className="notice notice-error" role="alert">{requests.error || services.error}<button className="secondary" onClick={() => { requests.reload(); services.reload(); }}>Retry dashboard</button></div>}
    <div className="dashboard-columns">
      <div className="dashboard-main">
        <section aria-labelledby="quick-actions-title" className="dashboard-actions-section"><div className="dashboard-section-heading"><h2 id="quick-actions-title">Quick actions</h2><span className="muted">How can we help?</span></div>
          <div className="dashboard-actions">{[
            ["Browse services", "Find the right university service.", LayoutGrid, "/services"],
            ["Submit a request", "Start a new service request.", Plus, "/request-service"],
            ["Track my requests", "Check progress and updates.", Search, "/my-requests"],
          ].map(([label, description, Icon, to]) => <Link key={to} to={to} className="dashboard-action"><span className="dashboard-action-icon"><Icon size={21} aria-hidden="true" /></span><strong>{label}</strong><p>{description}</p><ArrowRight className="dashboard-action-arrow" size={17} aria-hidden="true" /></Link>)}</div>
        </section>
        <AvailableAppointments preview />
        <div className="dashboard-support"><span>Need more help?</span><Link to="/complaints">Complaints &amp; support <ArrowRight size={15} aria-hidden="true" /></Link><Link to="/profile">My profile</Link></div>
      </div>
      <aside className="dashboard-side" aria-label="Your recent activity">
        <section className="panel dashboard-notifications" aria-labelledby="dashboard-notifications-title">
          <header className="dashboard-section-heading"><h2 id="dashboard-notifications-title"><Bell size={18} aria-hidden="true" />Notifications</h2><Link to="/notifications">View all</Link></header>
          <Notice error>{error}</Notice><LoadingError resource={notifications} />
          {!notifications.loading && !notifications.error && (!notifications.data?.items.length ? <p className="dashboard-empty">You're all caught up. Updates about your requests and appointments will appear here.</p> : notifications.data.items.map(item => <NotificationItem key={item._id} item={item} role={user.role} onRead={read} busy={busy} />))}
        </section>
        <section className="panel dashboard-requests" aria-labelledby="recent-requests-title">
          <header className="dashboard-section-heading"><h2 id="recent-requests-title">Recent requests</h2><Link to="/my-requests">View all</Link></header>
          <LoadingError resource={requests} />
          {!requests.loading && !requests.error && (rows.length ? <ul className="dashboard-request-list">{rows.slice(0, 5).map(row => <li key={row._id}><div><strong>{row.service}</strong><time dateTime={row.createdAt}>{dateTime(row.createdAt)}</time></div><Badge value={row.status} /></li>)}</ul> : <div className="dashboard-empty"><FileText size={25} aria-hidden="true" /><p>You have not submitted a service request yet.</p><Link to="/request-service">Submit your first request</Link></div>)}
        </section>
      </aside>
    </div>
  </main>;
}
