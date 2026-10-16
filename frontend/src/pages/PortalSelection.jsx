import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import PortalIcon from "../components/PortalIcon";
import "../styles/login.css";

export default function PortalSelection() {
  return (
    <main className="portal-page">
      <header className="portal-header">
        <Link className="auth-brand" to="/">
          <span className="brand-mark">U</span>University Services
        </Link>
        <div className="portal-header-actions"><Link className="portal-home" to="/">Return home <span aria-hidden="true">↗</span></Link><ThemeToggle /></div>
      </header>
      <section className="portal-content" aria-labelledby="portal-title">
        <p className="eyebrow">YOUR CAMPUS. CONNECTED.</p>
        <h1 id="portal-title">Welcome to<br /><span>University Services</span></h1>
        <p className="portal-subtitle">Choose your portal to access university services.</p>
        <div className="portal-grid">
          <article className="portal-option">
            <span className="portal-icon"><PortalIcon /></span>
            <p className="portal-caption">FOR STUDENTS</p>
            <h2>Student Portal</h2>
            <p className="portal-description">Access university services, submit requests, and track their progress.</p>
            <Link className="button-link portal-action" to="/student/login">Student Login <span aria-hidden="true">→</span></Link>
          </article>
          <article className="portal-option portal-option-admin">
            <span className="portal-icon"><PortalIcon admin /></span>
            <p className="portal-caption">FOR ADMINISTRATORS</p>
            <h2>Admin Portal</h2>
            <p className="portal-description">Manage student requests, university services, and administrative operations.</p>
            <Link className="button-link portal-action" to="/admin/login">Admin Login <span aria-hidden="true">→</span></Link>
          </article>
        </div>
        <p className="portal-register">New to the university? <Link to="/register">Create a student account <span aria-hidden="true">↗</span></Link></p>
      </section>
      <footer className="portal-footer"><span>University Service System</span><span>One campus. A simpler experience.</span></footer>
    </main>
  );
}
