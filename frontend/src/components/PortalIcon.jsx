import Icon from "./Icon";
export default function PortalIcon({ admin = false }) { return <Icon name={admin ? "admin" : "student"} size={36} />; }
