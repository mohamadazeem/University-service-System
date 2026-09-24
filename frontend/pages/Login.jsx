import { useState } from "react";
import axios from "axios";

function Login() {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();

        try {
            const response = await axios.post(
                "http://localhost:5000/api/auth/login",
                {
                    email,
                    password
                }
            );

            localStorage.setItem(
                "token",
                response.data.token
            );

            localStorage.setItem(
                "user",
                JSON.stringify(response.data.user)
            );

            alert("Login successful!");

        } catch (error) {
            alert(
                error.response?.data?.message ||
                "Login failed"
            );
        }
    };

    return (
        <div>
            <h1>Student Login</h1>

            <form onSubmit={handleLogin}>

                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) =>
                        setEmail(e.target.value)
                    }
                />

                <br /><br />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) =>
                        setPassword(e.target.value)
                    }
                />

                <br /><br />

                <button type="submit">
                    Login
                </button>

            </form>
        </div>
    );
}

export default Login;