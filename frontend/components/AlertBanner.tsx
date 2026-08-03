"use client";

import { useEffect, useState } from "react";
import { fetchAlerts, Alert } from "@/lib/api";

const SEVERITY_STYLE: Record<Alert["severity"], string> = {
  info: "border-signal/30 bg-signal/5 text-signal",
  warning: "border-amber/30 bg-amber/5 text-amber",
};

export default function AlertBanner({ sessionId }: { sessionId: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const r = await fetchAlerts(sessionId);
        if (!cancelled) setAlerts(r.alerts);
      } catch {
        // silently ignore -- alerts are non-critical
      }
    }

    load();
    const interval = setInterval(load, 30_000); // refresh every 30s
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionId]);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 rise-in">
      <p className="text-xs uppercase tracking-[0.2em] text-mist">Live Alerts</p>
      {alerts.map((a, i) => (
        <div key={i} className={`border rounded-xl px-3 py-2.5 text-sm ${SEVERITY_STYLE[a.severity]}`}>
          <span className="font-semibold">{a.title}: </span>
          <span className="text-[#dbe4ec]">{a.message}</span>
        </div>
      ))}
    </div>
  );
}
