import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import "../styles/auth-fit.css";
import "../styles/auth-forms.css";

export default function SiteLayout({ children }) {
  const { pathname } = useLocation();
  const publicEntry = ["/admin/login", "/staff/login", "/staff/register"].includes(pathname);
  const workspace = !publicEntry && /^\/(admin|staff)(\/|$)/.test(pathname);
  const authentication = ["/login", "/student/login", "/staff/login", "/admin/login", "/register", "/staff/register"].includes(pathname);
  if (workspace) return <><Navbar />{children}</>;
  return <div className={`public-shell${authentication ? " auth-shell" : ""}`}><Navbar /><div className="public-content">{children}</div>{!authentication && <Footer />}</div>;
}
