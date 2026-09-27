import { useEffect, useState } from "react";
import axios from "axios";

function MyRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const token = localStorage.getItem("token");

                const response = await axios.get(
                    "http://localhost:5000/api/requests/my",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                setRequests(response.data.requests);

            } catch (error) {
                setError(
                    error.response?.data?.message ||
                    "Failed to load requests"
                );

            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
    }, []);

    return (
        <div className="requests-page">

            <div className="requests-container">

                <h1>My Requests</h1>

                <p className="requests-subtitle">
                    View all your submitted university service requests.
                </p>

                {loading && (
                    <p>Loading requests...</p>
                )}

                {error && (
                    <p className="error-message">
                        {error}
                    </p>
                )}

                {!loading && !error && requests.length === 0 && (
                    <p className="no-requests">
                        You have not submitted any requests yet.
                    </p>
                )}

                {!loading && !error && requests.length > 0 && (
                    <div className="requests-table-container">

                        <table className="requests-table">

                            <thead>
                                <tr>
                                    <th>Service</th>
                                    <th>Student ID</th>
                                    <th>Description</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                </tr>
                            </thead>

                            <tbody>

                                {requests.map((request) => (
                                    <tr key={request._id}>

                                        <td>
                                            {request.service}
                                        </td>

                                        <td>
                                            {request.studentId}
                                        </td>

                                        <td>
                                            {request.description}
                                        </td>

                                        <td>
                                            <span
                                                className={`status-badge status-${request.status.toLowerCase()}`}
                                            >
                                                {request.status}
                                            </span>
                                        </td>

                                        <td>
                                            {new Date(
                                                request.createdAt
                                            ).toLocaleDateString()}
                                        </td>

                                    </tr>
                                ))}

                            </tbody>

                        </table>

                    </div>
                )}

            </div>

        </div>
    );
}

export default MyRequests;