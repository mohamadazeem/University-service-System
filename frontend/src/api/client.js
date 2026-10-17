import axios from "axios";
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 15000,
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !/\/auth\/(login|register)$/.test(error.config?.url || "")
    ) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("session-expired"));
    }
    return Promise.reject(error);
  },
);
export const errorMessage = (error) =>
  error.response?.data?.message ||
  (error.code === "ECONNABORTED"
    ? "The server took too long to respond. Try again."
    : !error.response || [502, 503, 504].includes(error.response.status) ||
        (error.response.status === 500 && !error.response.data?.message)
    ? "The application server is unavailable. If running locally, start the app with npm.cmd start in the project folder, wait for MongoDB to connect, then retry."
    : "Cannot reach the server. Check your connection and try again.");
export default api;
