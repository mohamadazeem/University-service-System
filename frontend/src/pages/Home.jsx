import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import hero from "../assets/campus.svg";
export default function Home() {
  return <main className="home">
    <section className="home-hero" aria-labelledby="home-title">
      <div><p className="eyebrow">UNIVERSITY SERVICE SYSTEM</p><h1 id="home-title">Less paperwork.<br />More possibility.</h1><p className="hero-description">Your university services, connected. Find the support you need, submit a request, and follow its progress from one simple student portal.</p><div className="hero-buttons"><Link className="button-link" to="/services">Explore services <span aria-hidden="true">&rarr;</span></Link><Link className="button-link secondary" to="/login">Sign in</Link></div><p className="hero-caption">New here? <Link to="/register">Create a student account</Link></p></div>
      <figure className="campus-visual"><img src={hero} alt="University campus" /><figcaption>One place for your next step.</figcaption></figure>
    </section>
    <section className="home-section" aria-labelledby="support-title"><p className="eyebrow">HERE TO HELP YOU MOVE FORWARD</p><h2 id="support-title">Support throughout your student journey</h2><p className="muted">Start with the catalogue or go straight to the support you need.</p>
      <div className="home-cards">{[["services", "University services", "Browse the current catalogue and submit a service request.", "/services", "Browse catalogue"], ["appointments", "Appointments", "Choose a published staff appointment time and track approval.", "/appointments", "Book an appointment"], ["complaints", "Student concerns", "Submit a complaint and receive a response through your portal.", "/complaints", "Get support"]].map(([icon, title, description, to, action]) => <article className="service-card" key={to}><span className="home-card-icon"><Icon name={icon} /></span><h3>{title}</h3><p>{description}</p><Link to={to}>{action} <span aria-hidden="true">&rarr;</span></Link></article>)}</div>
    </section>
    <section className="home-section how-it-works" aria-labelledby="steps-title"><div><p className="eyebrow">A CLEAR PATH FROM START TO FINISH</p><h2 id="steps-title">How it works</h2><p className="muted">Spend less time finding your way.</p></div><ol>{[["Find your service", "Explore available services and choose the one you need."], ["Submit your details", "Sign in to your student account and send your request."], ["Stay up to date", "Track real statuses and read updates in your notification inbox."]].map(([title, text]) => <li key={title}><h3>{title}</h3><p>{text}</p></li>)}</ol></section>
    <section className="home-support"><div><h2>Need help getting started?</h2><p>Check the service catalogue for department information. For account access, contact your university's usual student support team.</p></div><Link className="button-link secondary" to="/services">Find a service</Link></section>
    <footer className="home-footer"><div><strong>University Services</strong><p>A simpler way to connect with student support.</p></div><nav aria-label="Footer navigation"><Link to="/services">Service catalogue</Link><Link to="/student/login">Student portal</Link><Link to="/admin/login">Admin portal</Link></nav></footer>
  </main>;
}
