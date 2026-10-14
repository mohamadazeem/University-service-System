import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import AuthProvider from "./auth/AuthProvider";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
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
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin/login" element={<Login adminOnly />} />
          <Route path="/register" element={<Register />} />
          <Route path="/services" element={<Services />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/my-requests" element={<MyRequests />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route element={<ProtectedRoute roles={["student"]} />}>
            <Route path="/request-service" element={<RequestService />} />
          </Route>
          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="requests" element={<AdminRequests />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="services" element={<AdminServices />} />
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
