import { useState } from "react";
import axios from "axios";

function Register() {

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        studentId: "",
        phone: ""
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleRegister = async (e) => {
        e.preventDefault();

        try {

            const response = await axios.post(
                "http://localhost:5000/api/auth/register",
                formData
            );

            alert(response.data.message);

        } catch (error) {

            alert(
                error.response?.data?.message ||
                "Registration failed"
            );
        }
    };

    return (
        <div>

            <h1>Student Registration</h1>

            <form onSubmit={handleRegister}>

                <input
                    type="text"
                    name="name"
                    placeholder="Full Name"
                    value={formData.name}
                    onChange={handleChange}
                />

                <br /><br />

                <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleChange}
                />

                <br /><br />

                <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                />

                <br /><br />

                <input
                    type="text"
                    name="studentId"
                    placeholder="Student ID"
                    value={formData.studentId}
                    onChange={handleChange}
                />

                <br /><br />

                <input
                    type="text"
                    name="phone"
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChange={handleChange}
                />

                <br /><br />

                <button type="submit">
                    Register
                </button>

            </form>

        </div>
    );
}

export default Register;