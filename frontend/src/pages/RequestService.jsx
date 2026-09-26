import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import axios from "axios";

function RequestService() {

    const [searchParams] = useSearchParams();

    const selectedService =
        searchParams.get("service") || "";

    const [studentId, setStudentId] = useState("");
    const [description, setDescription] = useState("");

    const handleSubmit = async (e) => {

    e.preventDefault();

    try {

        const token = localStorage.getItem("token");

        const response = await axios.post(
            "http://localhost:5000/api/requests",
            {
                service: selectedService,
                studentId: studentId,
                description: description
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        alert(response.data.message);

        setStudentId("");
        setDescription("");

    } catch (error) {

        alert(
            error.response?.data?.message ||
            "Failed to submit request"
        );

    }
};

    return (
        <div className="request-page">

            <div className="request-container">

                <h1>Request a Service</h1>

                <p className="request-subtitle">
                    Submit a request for a university service.
                </p>


                <form onSubmit={handleSubmit}>

                    {/* Service */}

                    <div className="form-group">

                        <label>
                            Service
                        </label>

                        <input
                            type="text"
                            value={selectedService}
                            readOnly
                        />

                    </div>


                    {/* Student ID */}

                    <div className="form-group">

                        <label>
                            Student ID
                        </label>

                        <input
                            type="text"
                            placeholder="Enter your student ID"
                            value={studentId}
                            onChange={(e) =>
                                setStudentId(e.target.value)
                            }
                            required
                        />

                    </div>


                    {/* Description */}

                    <div className="form-group">

                        <label>
                            Description
                        </label>

                        <textarea
                            placeholder="Explain your request..."
                            value={description}
                            onChange={(e) =>
                                setDescription(e.target.value)
                            }
                            rows="6"
                            required
                        />

                    </div>


                    {/* Submit */}

                    <button
                        type="submit"
                        className="submit-request-button"
                    >
                        Submit Request
                    </button>

                </form>

            </div>

        </div>
    );
}

export default RequestService;