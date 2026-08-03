"use client";

import { useState } from "react";
import { Star, MapPin, Sun, Users2 } from "lucide-react";
import { CurrentLocation, getDestinationPreview, DestinationPreview as Preview } from "@/lib/api";
import { destinationPhoto } from "@/lib/destinations";

export default function DestinationPreview({ currentLocation }: { currentLocation?: CurrentLocation }) {
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  async function handlePreview() {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const p = await getDestinationPreview(query.trim(), currentLocation);
      setPreview(p);
    } catch {
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handlePreview()}
          placeholder="Preview a destination first — e.g. Mumbai, Goa, Manali…"
          className="flex-1 bg-panel border border-line rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber transition-colors placeholder:text-mist/50"
        />
        <button
          onClick={handlePreview}
          disabled={busy || !query.trim()}
          className="px-4 py-2.5 rounded-xl border border-line text-sm text-mist hover:text-amber hover:border-amber/50 disabled:opacity-40 transition"
        >
          {busy ? "Loading…" : "Preview"}
        </button>
      </div>

      {preview && (
        <div className="mt-4 glass rounded-xl overflow-hidden fade-scale-in">
          <div className="grid grid-cols-3 gap-0.5 h-40">
            {[0, 1, 2].map((i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={destinationPhoto(`${preview.destination}-${i}`, 600, 400)}
                alt={preview.destination}
                className="w-full h-full object-cover"
              />
            ))}
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">{preview.destination}</h3>
              <span className="flex items-center gap-1 text-amber text-sm font-semibold">
                <Star size={14} className="fill-amber" />
                {preview.rating}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
              <div>
                <p className="text-mist uppercase tracking-wider text-[10px] mb-1 flex items-center gap-1">
                  <Sun size={11} /> Weather
                </p>
                <p>{preview.weather_now.condition}, {preview.weather_now.temp_c}°C</p>
              </div>
              <div>
                <p className="text-mist uppercase tracking-wider text-[10px] mb-1">Best Season</p>
                <p>{preview.best_season}</p>
              </div>
              <div>
                <p className="text-mist uppercase tracking-wider text-[10px] mb-1 flex items-center gap-1">
                  <Users2 size={11} /> Crowd
                </p>
                <p>{preview.crowd_now.level}</p>
              </div>
              <div>
                <p className="text-mist uppercase tracking-wider text-[10px] mb-1">Est. 3-Day Cost</p>
                <p>₹{preview.estimated_total_3_days.toLocaleString("en-IN")}</p>
              </div>
            </div>

            {preview.distance_from_you && (
              <p className="text-xs text-mist mt-3 flex items-center gap-1">
                <MapPin size={12} />
                {preview.distance_from_you.distance_km} km away
                {preview.distance_from_you.eta_minutes && ` · ~${Math.round(preview.distance_from_you.eta_minutes / 60)}h drive`}
              </p>
            )}

            <p className="text-mist uppercase tracking-wider text-[10px] mt-3 mb-1">Famous Places</p>
            <div className="flex flex-wrap gap-1.5">
              {preview.famous_places.map((p) => (
                <span key={p} className="text-xs px-2 py-1 rounded-full bg-line/40 text-[#dbe4ec]">{p}</span>
              ))}
            </div>

            <p className="text-[10px] text-mist/40 mt-3">{preview.rating_note}</p>
          </div>
        </div>
      )}
    </div>
  );
}
