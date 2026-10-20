import { useEffect, useState } from "react";

// Anchor the live expiry display to the API clock, even on a misconfigured device.
export default function useAvailabilityClock(data) {
  const [clock, setClock] = useState(() => ({ data: null, now: Date.now() }));
  useEffect(() => {
    const server = Date.parse(data?.serverNow) || Date.now();
    const received = performance.now();
    const tick = () => setClock({ data, now: server + performance.now() - received });
    const initial = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [data]);
  return clock.data === data ? clock.now : Date.parse(data?.serverNow) || clock.now;
}
