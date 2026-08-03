"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudRain, Droplets, Sparkles, Sun, Thermometer, Wind } from "lucide-react";
import { getWeather, WeatherSnapshot } from "@/lib/api";
import { CurrentLocation } from "@/lib/api";

const ICONS = {
  clear: Sun, rain: CloudRain, clouds: Cloud,
};

export default function WeatherSmart({ destination, currentLocation }: {
  destination: string; currentLocation?: CurrentLocation;
}) {
  const [data, setData] = useState<WeatherSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true); setError(null);
    try {
      setData(await getWeather(destination, {
        lat: currentLocation?.lat, lng: currentLocation?.lng, hours: 24,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load weather.");
    } finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [destination]);

  if (busy && !data) return <div className="skeleton h-32 rounded-2xl" />;
  if (error) return <p className="text-xs text-alert">{error}</p>;
  if (!data) return null;

  const Icon = (ICONS as Record<string, React.ElementType>)[data.condition] ?? Cloud;
  return (
    <div className="space-y-5 rise-in">
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <Sparkles size={13} className="text-amber" /> Smart Weather · {destination}
        </p>
        <div className="mt-3 flex items-center gap-4">
          <Icon size={48} className="text-amber" />
          <div>
            <p className="text-3xl font-display font-semibold">{data.temp_c}°C</p>
            <p className="text-xs text-mist2">{data.condition}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat icon={Sun}    label="UV Index"        value={data.uv_index.label + ` (${data.uv_index.index})`} />
          <Stat icon={Wind}   label="AQI"             value={data.aqi.label + ` (${data.aqi.aqi_index})`} />
          <Stat icon={CloudRain} label="Rain prob."    value={`${data.rain_probability_pct}%`} />
          <Stat icon={Droplets}   label="Rain next 24h" value={`${data.rain_next_24h_mm} mm`} />
        </div>
        <p className="text-xs text-mist2 mt-3">{data.uv_index.advice}</p>
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <Thermometer size={13} className="text-amber" /> Weather Timeline (24h)
        </p>
        <div className="mt-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {data.timeline.slice(0, 13).map((h) => (
              <div key={h.datetime} className="border border-line2 rounded-lg px-2 py-2 text-center min-w-[64px]">
                <p className="text-[10px] text-mist2">{h.datetime.slice(11, 16)}</p>
                <p className="text-sm font-semibold mt-0.5">{Math.round(h.temp_c)}°</p>
                <p className="text-[10px] text-mist2 mt-0.5">{h.condition}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data.alerts.length > 0 && (
        <div className="glass-panel rounded-2xl p-5 border-alert/30">
          <p className="text-xs uppercase tracking-[0.2em] text-mist2">Alerts</p>
          <div className="mt-2 space-y-2">
            {data.alerts.map((a, i) => (
              <p key={i} className={`text-sm ${a.severity === "warning" ? "text-alert" : "text-emerald-300"}`}>
                <b>{a.title}:</b> {a.message}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <Sparkles size={13} className="text-amber" /> AI Itinerary Re-Plan
        </p>
        <p className="text-sm font-semibold mt-2">{data.ai_replan.headline}</p>
        <ul className="mt-2 space-y-1 text-sm text-mist">
          {data.ai_replan.actions.map((a, i) => <li key={i}>· {a}</li>)}
        </ul>
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2">Indoor activity recommendations</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.indoor_activities.map((a, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full border border-line text-mist">{a}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="border border-line2 rounded-xl p-2.5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-mist2 flex items-center gap-1">
        <Icon size={11} className="text-amber" /> {label}
      </p>
      <p className="text-sm font-medium mt-1">{value}</p>
    </div>
  );
}
