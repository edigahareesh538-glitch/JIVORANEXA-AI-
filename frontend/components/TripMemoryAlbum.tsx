"use client";
import { useEffect, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { getTripSummary, TripSummary } from "@/lib/api";

export default function TripMemoryAlbum({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const [summary, setSummary] = useState<TripSummary | null>(null);

  useEffect(() => { 
    getTripSummary(tripId).then(setSummary).catch(() => {}); 
  }, [tripId]);

  if (!summary) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center relative bg-slate-900 border border-slate-800 text-white">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-white"><X size={18} /></button>
        <p className="text-3xl">🎉</p>
        <h2 className="font-display text-xl font-bold mt-2">Trip Completed!</h2>
        <p className="text-sm text-amber-400 mt-1">{summary.destination}</p>

        <div className="grid grid-cols-2 gap-3 mt-6 text-left">
          <Stat label="Distance" value={summary.distance_km ? `${summary.distance_km} km` : "—"} />
          <Stat label="Expenses" value={summary.total_cost ? `₹${summary.total_cost}` : "—"} />
          <Stat label="Places Visited" value={String(summary.places_visited.length)} />
          <Stat label="Days" value={String(summary.days || "—")} />
        </div>

        <div className="flex gap-2 mt-6">
          <button className="flex-1 text-xs px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-semibold flex items-center justify-center gap-1.5 hover:opacity-90">
            <Download size={13} /> Download Album
          </button>
          <button className="flex-1 text-xs px-3 py-2.5 rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 hover:bg-slate-800">
            <Share2 size={13} /> Share Story
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-base font-semibold mt-0.5">{value}</p>
    </div>
  );
}