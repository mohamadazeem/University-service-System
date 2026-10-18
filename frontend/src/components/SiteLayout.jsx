import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function SiteLayout({ children }) {
  const { pathname } = useLocation();
  const publicEntry = ["/admin/login", "/staff/login", "/staff/register"].includes(pathname);
  const workspace = !publicEntry && /^\/(admin|staff)(\/|$)/.test(pathname);
  if (workspace) return <><Navbar />{children}</>;
  return <div className="public-shell"><Navbar /><div className="public-content">{children}</div><Footer /></div>;
}
