"use client";

import { useState } from "react";
import { CurrentLocation, searchNearby, NearbyPlace } from "@/lib/api";

export default function HelpChat({
  sessionId,
  currentLocation,
}: {
  sessionId: string;
  currentLocation?: CurrentLocation;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NearbyPlace[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const r = await searchNearby(sessionId, query.trim(), currentLocation);
      setResults(r.results);
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-4 rise-in">
      <p className="text-xs uppercase tracking-[0.2em] text-mist mb-3">Help Chat</p>
      <p className="text-sm text-mist mb-3">
        Search nearby places like Google Maps. Try hospitals, schools, ATMs, restaurants, bus stands, or train stations.
      </p>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Try: near hospitals, nearest school, ATM near me, railway station"
          className="flex-1 bg-ink border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-amber transition-colors placeholder:text-mist/50"
        />
        <button
          onClick={handleSearch}
          disabled={busy || !query.trim()}
          className="px-4 py-2 rounded-xl bg-amber text-ink font-semibold text-sm disabled:opacity-40 hover:brightness-110 transition"
        >
          {busy ? "…" : "Search"}
        </button>
      </div>

      {results && (
        <div className="mt-4 space-y-2">
          {results.length === 0 && <p className="text-sm text-mist">No results found.</p>}
          {results.map((r) => (
            <div
              key={`${r.name}-${r.lat}-${r.lng}`}
              className="px-3 py-3 rounded-xl bg-ink border border-line text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p>{r.name}</p>
                  <p className="text-xs text-mist mt-1">
                    {r.category} · {r.distance_km} km from {r.origin_label ?? "your search point"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={r.maps_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2.5 py-1.5 rounded bg-amber text-ink font-semibold hover:brightness-110 transition"
                  >
                    Route
                  </a>
                  <a
                    href={r.transit_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2.5 py-1.5 rounded border border-line text-mist hover:border-amber/50 hover:text-amber transition"
                  >
                    Transit
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
