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
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
