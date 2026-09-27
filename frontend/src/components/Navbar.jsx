import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

function Navbar() {
    const navigate = useNavigate();
    const [token, setToken] = useState(() => localStorage.getItem("token"));

    useEffect(() => {
        const syncToken = () => setToken(localStorage.getItem("token"));

        window.addEventListener("auth-change", syncToken);
        window.addEventListener("storage", syncToken);

        return () => {
            window.removeEventListener("auth-change", syncToken);
            window.removeEventListener("storage", syncToken);
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setToken(null);

        navigate("/login");
    };

    return (
        <nav>

            <div>
                <h2>University Service System</h2>
            </div>

            <div>

                <Link to="/">Home</Link>
                {" | "}

                {!token && (
                    <>
                        <Link to="/login">Login</Link>
                        {" | "}
                        <Link to="/register">Register</Link>
                    </>
                )}

                {token && (
                    <>
                        <Link to="/dashboard">Dashboard</Link>
                        {" | "}
                        <Link to="/services">Services</Link>
                        {" | "}
                        <Link to="/my-requests">My Requests</Link>
                        {" | "}
                        <Link to="/profile">Profile</Link>
                        {" | "}

                        <button
                            onClick={handleLogout}
                            className="logout-button"
                        >
                            Logout
                        </button>
                    </>
                )}

            </div>

        </nav>
    );
}

export default Navbar;