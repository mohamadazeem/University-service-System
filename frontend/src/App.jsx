import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import AuthProvider from "./auth/AuthProvider";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import PortalSelection from "./pages/PortalSelection";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import RequestService from "./pages/RequestService";
import MyRequests from "./pages/MyRequests";
import Profile from "./pages/Profile";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/AdminDashboard";
import AdminRequests from "./admin/AdminRequests";
import AdminUsers from "./admin/AdminUsers";
import AdminServices from "./admin/AdminServices";
import Support from "./pages/Support";
import Notifications from "./pages/Notifications";
import StaffRegister from "./pages/StaffRegister";
import StaffDashboard from "./pages/StaffDashboard";
import StaffApprovals from "./admin/StaffApprovals";
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<PortalSelection />} />
          <Route path="/student/login" element={<Login key="student" />} />
          <Route path="/admin/login" element={<Login key="admin" adminOnly />} />
          <Route path="/register" element={<Register />} />
          <Route path="/staff/login" element={<Login key="staff" staffOnly />} />
          <Route path="/staff/register" element={<StaffRegister />} />
          <Route element={<ProtectedRoute roles={["staff"]} />}>
            <Route path="/staff" element={<StaffDashboard />} />
          </Route>
          <Route path="/services" element={<Services />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/notifications" element={<Notifications />} />
          </Route>
          <Route element={<ProtectedRoute roles={["student"]} />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/appointments" element={<Support key="student-appointments" kind="appointments" />} />
            <Route path="/complaints" element={<Support key="student-complaints" kind="complaints" />} />
            <Route path="/my-requests" element={<MyRequests />} />
            <Route path="/request-service" element={<RequestService />} />
          </Route>
          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="requests" element={<AdminRequests />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="staff-approvals" element={<StaffApprovals />} />
              <Route path="services" element={<AdminServices />} />
              <Route path="appointments" element={<Support key="admin-appointments" kind="appointments" admin />} />
              <Route path="complaints" element={<Support key="admin-complaints" kind="complaints" admin />} />
              <Route path="notifications" element={<Notifications admin />} />
            </Route>
          </Route>
          <Route
            path="*"
            element={
              <main className="page">
                <h1>Page not found</h1>
                <Link to="/">Return home</Link>
              </main>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
