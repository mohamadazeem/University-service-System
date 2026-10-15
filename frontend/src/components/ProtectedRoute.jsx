import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "../auth/useAuth";
export default function ProtectedRoute({ roles }) {
  const { user, loading, error, retry } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <main className="page">
        <p role="status">Verifying your session…</p>
      </main>
    );
  if (error)
    return (
      <main className="page">
        <p role="alert">{error}</p>
        <button onClick={retry}>Retry verification</button>
      </main>
    );
  if (!user)
    return <Navigate to={roles?.includes("admin") ? "/admin/login" : roles?.includes("student") ? "/student/login" : "/login"} state={{ from: location.pathname, sessionRequired: true }} replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to={user.role === "admin" ? "/admin" : user.role === "student" ? "/dashboard" : "/profile"} replace />;
  return <Outlet />;
}
