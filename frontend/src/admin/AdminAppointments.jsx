import { useSearchParams } from "react-router-dom";
import Support from "../pages/Support";
import AppointmentAvailability from "../pages/AppointmentAvailability";
export default function AdminAppointments() {
  const [params, setParams] = useSearchParams();
  const availability = params.get("view") === "availability";
  return <><div className="button-row" role="tablist" aria-label="Appointment views" style={{ marginBottom: 24 }}>
    <button role="tab" aria-selected={!availability} className={availability ? "secondary" : ""} onClick={() => setParams({})}>Student Bookings</button>
    <button role="tab" aria-selected={availability} className={availability ? "" : "secondary"} onClick={() => setParams({ view: "availability" })}>Staff Availability</button>
  </div>{availability ? <AppointmentAvailability admin /> : <Support kind="appointments" admin />}</>;
}
