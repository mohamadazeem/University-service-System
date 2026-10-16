import { useEffect, useState } from "react";
import api, { errorMessage } from "../api/client";
export default function useResource(url) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState({ key: "", data: null, error: "" });
  const key = `${url}:${version}`;
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
          setResult({ key, data: null, error: errorMessage(error) });
      });
    return () => controller.abort();
  }, [url, key]);
  return {
    data: result.data,
    loading: result.key !== key,
    error: result.key === key ? result.error : "",
    reload: () => setVersion((value) => value + 1),
  };
}
