import { Link } from "react-router-dom";

function Services() {

    const services = [
        {
            id: 1,
            title: "Transcript Request",
            description: "Request an official academic transcript from the university.",
            icon: "📄"
        },
        {
            id: 2,
            title: "Certificate Request",
            description: "Request official university certificates and documents.",
            icon: "🎓"
        },
        {
            id: 3,
            title: "Student ID Request",
            description: "Request a new or replacement student identification card.",
            icon: "🪪"
        },
        {
            id: 4,
            title: "Letter Request",
            description: "Request official letters required for academic or other purposes.",
            icon: "📝"
        },
        {
            id: 5,
            title: "Library Service",
            description: "Request assistance related to university library services.",
            icon: "📚"
        },
        {
            id: 6,
            title: "Other Service",
            description: "Submit a request for another university service.",
            icon: "🏛️"
        }
    ];

    return (
        <div className="services-page">

            <div className="services-header">

                <h1>University Services</h1>

                <p>
                    Select a service below to submit your request.
                </p>

            </div>


            <div className="services-grid">

                {services.map((service) => (

                    <div
                        className="service-card"
                        key={service.id}
                    >

                        <div className="service-icon">
                            {service.icon}
                        </div>

                        <h2>{service.title}</h2>

                        <p>
                            {service.description}
                        </p>

                        <Link
                            to={`/request-service?service=${encodeURIComponent(service.title)}`}
                        >
                            <button className="service-button">
                                Request Service
                            </button>
                        </Link>

                    </div>

                ))}

            </div>

        </div>
    );
}

export default Services;