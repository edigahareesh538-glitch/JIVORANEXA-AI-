"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Route, RoutePoint } from "@/lib/api";

const TYPE_STYLE: Record<RoutePoint["type"], { color: string; label: string }> = {
  destination: { color: "#E8A93A", label: "Destination" },
  hotel: { color: "#4FD1A5", label: "Hotel" },
  airport: { color: "#8FA1B3", label: "Airport" },
  bus: { color: "#F0654E", label: "Bus Stand" },
  train: { color: "#9B8AFB", label: "Train" },
  user: { color: "#5B8DEF", label: "You" },
};

export default function TripMap({ route, liveLocation }: { route: Route; liveLocation?: { lat: number; lng: number } }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const leafletLib = useRef<any>(null);
  const liveMarker = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;
      leafletLib.current = L;

      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
        liveMarker.current = null;
      }

      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([route.center.lat, route.center.lng], 12);
      leafletMap.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      const latlngs: [number, number][] = [];
      route.points.forEach((p) => {
        const style = TYPE_STYLE[p.type];
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            background:${style.color};
            width:16px;height:16px;border-radius:50%;
            border:2px solid #0B0F14;
            box-shadow:0 0 0 2px ${style.color}55;
          "></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        L.marker([p.lat, p.lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${p.label}</b>`);
        latlngs.push([p.lat, p.lng]);
      });

      if (route.path?.length > 1) {
        L.polyline(route.path, { color: "#E8A93A", weight: 4, opacity: 0.8 }).addTo(map);
      }

      if (latlngs.length > 1) {
        const fitPoints = route.path?.length ? [...latlngs, ...route.path] : latlngs;
        L.polyline(latlngs, { color: "#8FA1B3", weight: 2, dashArray: "4 6", opacity: 0.5 }).addTo(map);
        map.fitBounds(fitPoints, { padding: [30, 30] });
      }
    })();

    return () => {
      cancelled = true;
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [route]);

  // Live GPS marker -- updates in place as liveLocation changes, without
  // touching the rest of the map (Priority-1 "wow" feature: live tracking).
  useEffect(() => {
    const L = leafletLib.current;
    const map = leafletMap.current;
    if (!L || !map || !liveLocation) return;

    if (liveMarker.current) {
      liveMarker.current.setLatLng([liveLocation.lat, liveLocation.lng]);
    } else {
      const icon = L.divIcon({
        className: "",
        html: `<div class="ripple-marker" style="
          background:#5B8DEF;width:14px;height:14px;border-radius:50%;
          border:2px solid #0B0F14;box-shadow:0 0 0 2px #5B8DEF88;
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      liveMarker.current = L.marker([liveLocation.lat, liveLocation.lng], { icon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup("<b>You (live)</b>");
    }
  }, [liveLocation]);

  return (
    <div className="glass rounded-xl overflow-hidden fade-scale-in">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
        <span className="text-xs uppercase tracking-[0.2em] text-mist">Route Map</span>
        <div className="flex gap-3 text-[11px] text-mist">
          {Object.values(TYPE_STYLE).map((s) => (
            <span key={s.label} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <div ref={mapRef} className="h-72 w-full" />
      <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-line bg-ink/40">
        <a
          href={route.directions.drive}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 rounded bg-amber text-ink font-semibold hover:brightness-110 transition"
        >
          Drive Route
        </a>
        <a
          href={route.directions.transit}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 rounded border border-line text-mist hover:text-amber hover:border-amber/50 transition"
        >
          Bus / Train Route
        </a>
        <a
          href={route.directions.walk}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 rounded border border-line text-mist hover:text-amber hover:border-amber/50 transition"
        >
          Walk Route
        </a>
      </div>
    </div>
  );
}
