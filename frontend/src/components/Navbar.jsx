import { Link } from "react-router-dom";

function Navbar() {
    return (
        <nav>
            <div>
                <h2>University Service System</h2>
            </div>

            <div>
                <Link to="/">Home</Link>
                {" | "}
                <Link to="/login">Login</Link>
                {" | "}
                <Link to="/register">Register</Link>
            </div>
        </nav>
    );
}

export default Navbar;