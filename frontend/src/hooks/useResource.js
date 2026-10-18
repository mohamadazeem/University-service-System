import { useCallback, useEffect, useState } from "react";
import api, { errorMessage } from "../api/client";
export default function useResource(url, autoRefresh = false) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState({ key: "", data: null, error: "" });
  const key = `${url}:${version}`;
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    if (!url || !autoRefresh) return;
    const refresh = () => { if (document.visibilityState !== "hidden") reload(); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [url, autoRefresh, reload]);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    api
      .get(url, { signal: controller.signal })
      .then(({ data }) => {
        setResult({ key, data, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ key, data: null, error: errorMessage(error), status: error.response?.status });
      });
    return () => controller.abort();
  }, [url, key]);
  return {
    data: result.data,
    loading: result.key !== key,
    error: result.key === key ? result.error : "",
    status: result.key === key ? result.status : undefined,
    reload,
  };
}
