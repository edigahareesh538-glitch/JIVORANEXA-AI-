"use client";

import { useEffect, useState } from "react";
import { Navigation2 } from "lucide-react";
import { CurrentLocation, getRouteEta, RouteEta } from "@/lib/api";

export default function LiveETABadge({ destination, liveLocation }: { destination: string; liveLocation?: CurrentLocation }) {
  const [eta, setEta] = useState<RouteEta | null>(null);

  useEffect(() => {
    if (!liveLocation) return;
    let cancelled = false;

    function fetchEta() {
      getRouteEta(destination, liveLocation!).then((r) => {
        if (!cancelled) setEta(r);
      }).catch(() => {});
    }

    fetchEta();
    const interval = setInterval(fetchEta, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, liveLocation?.lat, liveLocation?.lng]);

  if (!liveLocation || !eta) return null;

  const hasTrafficData = eta.google_maps_configured && typeof eta.traffic_delay_minutes === "number";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 glass rounded-full px-3 py-1.5 text-xs w-fit">
        <span className="h-1.5 w-1.5 rounded-full bg-signal pulse-dot" />
        <Navigation2 size={12} className="text-signal" />
        <span className="text-mist">Live:</span>
        <span className="text-[#dbe4ec] font-semibold">{eta.distance_km} km</span>
        {eta.eta_minutes != null && <span className="text-[#dbe4ec]">· ~{eta.eta_minutes} min</span>}
        {hasTrafficData && (eta.traffic_delay_minutes ?? 0) > 0 && (
          <span className="text-amber">· +{eta.traffic_delay_minutes} min traffic</span>
        )}
      </div>
      {eta.toll_estimate && eta.toll_estimate.amount_inr > 0 && (
        <div className="glass rounded-full px-3 py-1.5 text-xs text-mist" title={eta.toll_estimate.basis}>
          Est. toll ₹{eta.toll_estimate.amount_inr}
        </div>
      )}
      {eta.fuel_estimate && eta.fuel_estimate.amount_inr > 0 && (
        <div className="glass rounded-full px-3 py-1.5 text-xs text-mist" title={eta.fuel_estimate.basis}>
          Est. fuel ₹{eta.fuel_estimate.amount_inr}
        </div>
      )}
    </div>
  );
}
