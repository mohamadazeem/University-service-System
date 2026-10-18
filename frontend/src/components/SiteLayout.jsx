import { useLocation } from "react-router-dom";
import useAuth from "../auth/useAuth";
import StaffLayout from "../pages/StaffLayout";
import Navbar from "./Navbar";
import Footer from "./Footer";
import "../styles/auth-fit.css";
import "../styles/auth-forms.css";

export default function SiteLayout({ children }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  if (user?.role === "student" && ["/dashboard", "/services", "/my-requests", "/appointments", "/complaints", "/notifications", "/profile", "/request-service"].includes(pathname)) return <StaffLayout student>{children}</StaffLayout>;
  const publicEntry = ["/admin/login", "/staff/login", "/staff/register"].includes(pathname);
  const workspace = !publicEntry && /^\/(admin|staff)(\/|$)/.test(pathname);
  const authentication = ["/login", "/student/login", "/staff/login", "/admin/login", "/register", "/staff/register"].includes(pathname);
  if (workspace) return <><Navbar />{children}</>;
  return <div className={`public-shell${authentication ? " auth-shell" : ""}`}><Navbar /><div className="public-content">{children}</div>{!authentication && <Footer />}</div>;
}
