import { Link } from "react-router-dom";
import useResource from "../hooks/useResource";
import useAuth from "../auth/useAuth";
import Icon from "../components/Icon";
export default function Services() {
  const resource = useResource("/services");
  const { user } = useAuth();
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">HERE TO HELP</p>
          <h1>University services</h1>
          <p className="muted">
            Browse the current service catalogue and submit your request.
          </p>
        </div>
      </div>
      {resource.loading && <p role="status">Loading services…</p>}
      {resource.error && (
        <div className="notice notice-error" role="alert">
          {resource.error}{" "}
          <button className="secondary" onClick={resource.reload}>
            Retry
          </button>
        </div>
      )}
      {!resource.loading && !resource.error && (
        <>
          <div className="services-grid">
            {resource.data.services.map((service) => (
              <article className="service-card" key={service._id}>
                <span className="service-symbol" aria-hidden="true">
                  <Icon name="services" size={30} />
                </span>
                <p className="eyebrow">{service.department}</p>
                <h2>{service.name}</h2>
                <p>{service.description}</p>
                <small>
                  Processing time:{" "}
                  {service.processingTime || "Contact the department"}
                </small>
                {(!user || user.role === "student") && (
                  <Link
                    className="button-link"
                    to={`/request-service?serviceId=${service._id}`}
                  >
                    Request service →
                  </Link>
                )}
              </article>
            ))}
          </div>
          {!resource.data.services.length && (
            <div className="panel empty-state">
              No services are currently available. Please check again later.
            </div>
          )}
        </>
      )}
    </main>
  );
}
