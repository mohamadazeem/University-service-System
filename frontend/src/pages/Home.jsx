import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import hero from "../assets/home-campus (2).png";

const services = [
  ["services", "University Services", "Browse the service catalogue and submit requests to the right department.", "/services", "Explore services"],
  ["appointments", "Appointments", "Find a published appointment time and follow your booking approval.", "/appointments", "Book an appointment"],
  ["complaints", "Student Support", "Share a concern and receive a response through your student portal.", "/complaints", "Get support"],
  ["requests", "Request Tracking", "Check the current status and updates on your submitted service requests.", "/my-requests", "Track requests"],
];
const steps = [
  ["Find your service", "Browse the catalogue or choose the support you need."],
  ["Submit your details", "Sign in to your student account and send your request."],
  ["Follow your progress", "Check request statuses and read updates in your notification inbox."],
];

export default function Home() {
  return (
    <main className="home">
      <section className="home-hero" aria-labelledby="home-title">
        <div>
          <p className="eyebrow">YOUR CAMPUS. CONNECTED.</p>
          <h1 id="home-title">Connecting Students to University Services.</h1>
          <p className="hero-description">Access university services, submit requests, book appointments, and track your progress &mdash; all in one convenient platform.</p>
          <div className="hero-buttons">
            <Link className="button-link" to="/services">Explore Services <Icon name="arrow" size={18} /></Link>
            <Link className="button-link secondary" to="/login">Sign In</Link>
          </div>
          <p className="hero-caption">New here? <Link to="/register">Create a student account</Link></p>
        </div>
        <figure className="campus-visual">
          <div className="campus-photo"><img src={hero} alt="University campus building" width="1672" height="941" fetchPriority="high" /></div>
          <figcaption>University services, brought together.</figcaption>
        </figure>
      </section>
      <section className="home-section" aria-labelledby="support-title">
        <p className="eyebrow">SUPPORT FOR EVERY NEXT STEP</p>
        <h2 id="support-title">Your student journey, made simpler</h2>
        <p className="muted">Find services, connect with support, and keep things moving.</p>
        <div className="home-cards">
          {services.map(([icon, title, description, to, action]) => (
            <article className="service-card" key={to}>
              <span className="home-card-icon"><Icon name={icon} size={25} /></span>
              <h3>{title}</h3><p>{description}</p>
              <Link to={to}>{action}<Icon name="arrow" size={17} /></Link>
            </article>
          ))}
        </div>
      </section>
      <section className="home-section how-it-works" aria-labelledby="steps-title">
        <div><p className="eyebrow">FROM REQUEST TO RESPONSE</p><h2 id="steps-title">How it works</h2><p className="muted">A clear path to the support you need.</p></div>
        <ol>{steps.map(([title, text]) => <li key={title}><h3>{title}</h3><p>{text}</p></li>)}</ol>
      </section>
      <section className="home-support">
        <div><h2>Need help getting started?</h2><p>Check the service catalogue for department information. For account access, contact your university's usual student support team.</p></div>
        <Link className="button-link secondary" to="/services">Find a service<Icon name="arrow" size={18} /></Link>
      </section>
      <footer className="home-footer">
        <div><strong>University Services</strong><p>One place for your university services and support.</p></div>
        <nav aria-label="Footer navigation"><Link to="/services">Service catalogue</Link><Link to="/student/login">Student portal</Link><Link to="/admin/login">Admin portal</Link></nav>
      </footer>
    </main>
  );
}
