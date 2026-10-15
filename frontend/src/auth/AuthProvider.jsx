import { useEffect, useState } from "react";
import api from "../api/client";
import { AuthContext } from "./AuthContext";
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    const clear = () => {
      setUser(null);
      setLoading(false);
      setError("");
    };
    const sync = () => {
      setLoading(true);
      setVersion((value) => value + 1);
    };
    window.addEventListener("session-expired", clear);
    window.addEventListener("storage", sync);
    const load = async () => {
      try {
        if (localStorage.getItem("token")) {
          const response = await api.get("/auth/me");
          if (alive) {
            setUser(response.data.user);
            localStorage.setItem("user", JSON.stringify(response.data.user));
          }
        } else if (alive) setUser(null);
        if (alive) setError("");
      } catch (err) {
        if (alive) {
          setUser(null);
          setError(
            err.response?.status === 401
              ? ""
              : "Could not verify your session. Retry when the server is available.",
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
      window.removeEventListener("session-expired", clear);
      window.removeEventListener("storage", sync);
    };
  }, [version]);
  const login = async (email, password, portal) => {
    const { data } = await api.post("/auth/login", { email, password, portal });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    setError("");
    setLoading(false);
    return data.user;
  };
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setError("");
  };
  const retry = () => {
    setLoading(true);
    setVersion((value) => value + 1);
  };
  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, logout, retry }}
    >
      {children}
    </AuthContext.Provider>
  );
}
