import { Link } from "react-router-dom";

function Dashboard() {

    const user = JSON.parse(localStorage.getItem("user"));

    return (
        <div className="dashboard">

            <div className="dashboard-header">

                <h1>
                    Welcome, {user?.name || "Student"} 👋
                </h1>

                <p>
                    Manage your university services and requests.
                </p>

            </div>


            {/* Statistics */}

            <div className="dashboard-cards">

                <div className="dashboard-card">
                    <h3>Total Services</h3>
                    <h2>5</h2>
                </div>

                <div className="dashboard-card">
                    <h3>Pending Requests</h3>
                    <h2>2</h2>
                </div>

                <div className="dashboard-card">
                    <h3>Approved Requests</h3>
                    <h2>1</h2>
                </div>

                <div className="dashboard-card">
                    <h3>Completed Requests</h3>
                    <h2>3</h2>
                </div>

            </div>


            {/* Quick Actions */}

            <div className="quick-actions">

                <h2>Quick Actions</h2>

                <div className="action-container">

                    <Link to="/services">
                        <button>
                            Browse Services
                        </button>
                    </Link>

                    <Link to="/request-service">
                        <button>
                            Request a Service
                        </button>
                    </Link>

                    <Link to="/my-requests">
                        <button>
                            My Requests
                        </button>
                    </Link>

                    <Link to="/profile">
                        <button>
                            My Profile
                        </button>
                    </Link>

                </div>

            </div>


            {/* Recent Requests */}

            <div className="recent-requests">

                <h2>Recent Requests</h2>

                <table>

                    <thead>
                        <tr>
                            <th>Service</th>
                            <th>Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>

                    <tbody>

                        <tr>
                            <td>Transcript Request</td>
                            <td>24/09/2026</td>
                            <td>
                                <span className="status pending">
                                    Pending
                                </span>
                            </td>
                        </tr>

                        <tr>
                            <td>Student ID Request</td>
                            <td>22/09/2026</td>
                            <td>
                                <span className="status approved">
                                    Approved
                                </span>
                            </td>
                        </tr>

                        <tr>
                            <td>Certificate Request</td>
                            <td>20/09/2026</td>
                            <td>
                                <span className="status completed">
                                    Completed
                                </span>
                            </td>
                        </tr>

                    </tbody>

                </table>

            </div>

        </div>
    );
}

export default Dashboard;