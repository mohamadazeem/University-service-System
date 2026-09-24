import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import RequestService from "./pages/RequestService";
import MyRequests from "./pages/MyRequests";
import Profile from "./pages/Profile";

function App() {
    return (
        <BrowserRouter>

            <Navbar />

            <Routes>

                <Route path="/" element={<Home />} />

                <Route path="/login" element={<Login />} />

                <Route path="/register" element={<Register />} />

                <Route path="/dashboard" element={<Dashboard />} />

                <Route
                    path="/services"
                    element={<Services />}
                />

                <Route
                    path="/request-service"
                    element={<RequestService />}
                />

                <Route
                    path="/my-requests"
                    element={<MyRequests />}
                />

                <Route
                    path="/profile"
                    element={<Profile />}
                />

            </Routes>

        </BrowserRouter>
    );
}

export default App;