import { useEffect } from "react";
import api from "../api/client";
import useResource from "./useResource";

export const refreshNotifications = () => window.dispatchEvent(new Event("notifications-changed"));
export async function markNotificationRead(id) {
  await api.patch(`/notifications/${id}/read`);
  refreshNotifications();
}
export async function markAllNotificationsRead() {
  await api.patch("/notifications/read-all");
  refreshNotifications();
}
export default function useNotifications(url) {
  const resource = useResource(url);
  const { reload } = resource;
  useEffect(() => {
    if (!url) return;
    const update = () => { if (document.visibilityState !== "hidden") reload(); };
    const timer = window.setInterval(update, 30000);
    window.addEventListener("notifications-changed", reload);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("notifications-changed", reload);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [url, reload]);
  return resource;
}
