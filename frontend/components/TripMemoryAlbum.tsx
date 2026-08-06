"use client";
import { useEffect, useState } from "react";
import { X, Download, Share2, Award } from "lucide-react";
import { getTripSummary, TripSummary } from "@/lib/api";
import { computeBadges, Badge } from "@/lib/badges";

export default function TripMemoryAlbum({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    getTripSummary(tripId)
      .then((data) => {
        setSummary(data);
        setBadges(computeBadges([data]));
      })
      .catch(() => {});
  }, [tripId]);

  if (!summary) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-6 max-w-md w-full text-center relative bg-slate-900 border border-slate-800 text-white max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-white">
          <X size={18} />
        </button>

        <p className="text-3xl">🎉</p>
        <h2 className="font-display text-xl font-bold mt-2">Trip Completed!</h2>
        <p className="text-sm text-amber-400 mt-1">{summary.destination}</p>

        <div className="grid grid-cols-2 gap-3 mt-4 text-left">
          <Stat label="Distance" value={summary.distance_km ? `${summary.distance_km} km` : "—"} />
          <Stat label="Expenses" value={summary.total_cost != null ? `₹${summary.total_cost}` : "—"} />
          <Stat label="Places Visited" value={String(summary.places_visited?.length || 0)} />
          <Stat label="Days" value={String(summary.days || "—")} />
        </div>

        <div className="mt-6 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-2">
            <Award size={14} /> Unlocked Badges
          </p>
          <div className="grid grid-cols-2 gap-2">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                  badge.unlocked
                    ? "border-amber-500/40 bg-amber-500/10 text-white"
                    : "border-slate-800 bg-slate-950/30 text-slate-500 opacity-50"
                }`}
              >
                <span className="text-xl">{badge.icon}</span>
                <div>
                  <p className="text-xs font-bold">{badge.title}</p>
                  <p className="text-[10px] text-slate-400">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button className="flex-1 text-xs px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-semibold flex items-center justify-center gap-1.5 hover:opacity-90">
            <Download size={13} /> Download Album
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: "My Trip Summary",
                  text: `I completed a trip to ${summary.destination} using JivoraNexa AI!`,
                });
              }
            }}
            className="flex-1 text-xs px-3 py-2.5 rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 hover:bg-slate-800"
          >
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
