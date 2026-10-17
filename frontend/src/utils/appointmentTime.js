export const APPOINTMENT_ZONE = "Asia/Colombo";
export const appointmentDateTime = value => value ? new Intl.DateTimeFormat("en-GB", { timeZone: APPOINTMENT_ZONE, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not specified";
export function appointmentFields(value) {
  if (!value) return { date: "", time: "" };
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: APPOINTMENT_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
export const appointmentInstant = (date, time) => new Date(`${date}T${time}:00+05:30`).toISOString();
