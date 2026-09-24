import { Link } from "react-router-dom";

function Home() {
    return (
        <div className="home">

            <section className="hero">

                <h1>
                    University Student Service Management System
                </h1>

                <p>
                    Access university services, submit requests,
                    and track your requests easily.
                </p>

                <div className="hero-buttons">

                    <Link to="/login">
                        <button>Login</button>
                    </Link>

                    <Link to="/register">
                        <button>Register</button>
                    </Link>

                </div>

            </section>

            <section>

                <h2>Our Services</h2>

                <div>

                    <div>
                        <h3>Document Requests</h3>
                        <p>
                            Request official university documents.
                        </p>
                    </div>

                    <div>
                        <h3>Student Services</h3>
                        <p>
                            Access important student services.
                        </p>
                    </div>

                    <div>
                        <h3>Request Tracking</h3>
                        <p>
                            Track the status of your requests.
                        </p>
                    </div>

                </div>

            </section>

        </div>
    );
}

export default Home;