import { Link } from "react-router-dom";

export default function Footer() {
  return <footer className="site-footer">
    <div className="footer-main">
      <div className="footer-brand"><span className="brand-mark" aria-hidden="true">U</span><div><strong>University Services</strong><p>Your central platform for university services, requests, and support.</p></div></div>
      <nav aria-label="Footer navigation"><h2>Quick Links</h2><div><Link to="/">Home</Link><Link to="/services">Service Catalogue</Link></div></nav>
    </div>
    <div className="footer-copyright">© 2026 University Services. All rights reserved.</div>
  </footer>;
}
