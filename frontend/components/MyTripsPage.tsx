"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, Calendar, Copy, Download, Heart, IndianRupee, MapPin, Share2, Trash2 } from "lucide-react";
import { deleteTrip, duplicateTrip, listTrips, TripRecord, updateTripStatus } from "@/lib/api";
import { destinationPhoto } from "@/lib/destinations";
import TripMemoryAlbum from "@/components/TripMemoryAlbum";

const STATUS_TABS = ["all", "planned", "booked", "completed", "cancelled"] as const;
const STATUS_STYLE: Record<string, string> = {
  planned: "bg-gold/15 text-gold border-gold/30",
  booked: "bg-signal/15 text-signal border-signal/30",
  completed: "bg-mist2/15 text-mist border-line2",
  cancelled: "bg-alert/15 text-alert border-alert/30",
};

export default function MyTripsPage({ loggedIn }: { loggedIn: boolean }) {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "oldest" | "budget_high">("recent");
  const [error, setError] = useState<string | null>(null);
  const [selectedAlbumTrip, setSelectedAlbumTrip] = useState<TripRecord | null>(null);

  async function refresh() {
    try {
      setTrips(await listTrips());
    } catch {
      setError("Sign in to see your saved trips.");
    }
  }

  useEffect(() => {
    if (!loggedIn) return;
    refresh();
  }, [loggedIn]);

  async function remove(id: string) {
    await deleteTrip(id);
    refresh();
  }

  async function duplicate(id: string) {
    await duplicateTrip(id);
    refresh();
  }

  async function cycleStatus(trip: TripRecord) {
    const next = trip.status === "planned" ? "booked" : trip.status === "booked" ? "completed" : trip.status === "completed" ? "cancelled" : "planned";
    await updateTripStatus(trip.id, next);
    refresh();
  }

  function share(trip: TripRecord) {
    const text = `Trip to ${trip.destination} · ${trip.status} · ${trip.total_cost ? `₹${trip.total_cost}` : "Budget TBD"}`;
    if (navigator.share) {
      navigator.share({ title: `Trip to ${trip.destination}`, text }).catch(() => undefined);
      return;
    }
    navigator.clipboard.writeText(text).catch(() => undefined);
  }

  function exportTrip(trip: TripRecord) {
    const reportWindow = window.open("", "_blank", "width=900,height=700");
    if (!reportWindow) return;
    reportWindow.document.write(`<html><head><title>${trip.destination}</title></head><body><h1>${trip.destination}</h1><p>Status: ${trip.status}</p><p>Budget: ${trip.budget ?? "—"}</p><p>Total Cost: ${trip.total_cost ?? "—"}</p><p>Created: ${new Date(trip.created_at).toLocaleDateString("en-IN")}</p><script>window.print();</script></body></html>`);
    reportWindow.document.close();
  }

  const filteredTrips = useMemo(() => {
    let next = [...trips];
    if (status !== "all") next = next.filter((trip) => trip.status === status);
    if (search.trim()) next = next.filter((trip) => trip.destination.toLowerCase().includes(search.trim().toLowerCase()));
    if (sort === "recent") next.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (sort === "oldest") next.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    if (sort === "budget_high") next.sort((a, b) => (b.total_cost || 0) - (a.total_cost || 0));
    return next;
  }, [search, sort, status, trips]);

  if (!loggedIn) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center rise-in">
        <Briefcase size={22} className="mx-auto text-mist2 mb-3" />
        <p className="text-sm text-mist">Sign in from the Profile tab to see trips you've planned and saved.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 rise-in">
      {error && <p className="text-sm text-alert">{error}</p>}

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((entry) => (
            <button key={entry} type="button" onClick={() => setStatus(entry)} className={`text-xs px-3 py-1.5 rounded-full border capitalize ${status === entry ? "border-gold text-gold bg-gold/10" : "border-line2 text-mist2"}`}>
              {entry}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search trips" className="bg-panel border border-line rounded px-3 py-2 text-sm" />
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="bg-panel border border-line rounded px-3 py-2 text-sm">
            <option value="recent">Recent</option>
            <option value="oldest">Oldest</option>
            <option value="budget_high">Highest Budget</option>
          </select>
        </div>
      </div>

      {filteredTrips.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-sm text-mist">No trips match the current filters.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {filteredTrips.map((trip) => (
            <div key={trip.id} className="glass-card rounded-2xl overflow-hidden card-hover">
              <div className="relative h-28">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={destinationPhoto(trip.destination, 480, 240)} alt={trip.destination} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
                <span className={`absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full border capitalize ${STATUS_STYLE[trip.status] ?? "bg-line2 text-mist border-line2"}`}>{trip.status}</span>
                <div className="absolute left-3 bottom-3 text-white">
                  <p className="font-display font-semibold text-[15px]">{trip.destination}</p>
                  <p className="text-[11px] text-white/70">Session {trip.session_id.slice(0, 8)}</p>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-mist2 flex items-center gap-1.5"><Calendar size={12} /> {new Date(trip.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-1 text-gold font-mono"><IndianRupee size={12} />{(trip.total_cost || trip.budget || 0).toLocaleString("en-IN")}</span>
                  <button type="button" onClick={() => cycleStatus(trip)} className="text-xs px-2.5 py-1 rounded-lg border border-line2 hover:border-gold/40 hover:text-gold transition">Change Status</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button type="button" onClick={() => exportTrip(trip)} className="rounded-xl border border-line2 px-2.5 py-2 hover:border-gold/40 hover:text-gold transition flex items-center justify-center gap-1"><Download size={12} /> PDF</button>
                  <button type="button" onClick={() => duplicate(trip.id)} className="rounded-xl border border-line2 px-2.5 py-2 hover:border-gold/40 hover:text-gold transition flex items-center justify-center gap-1"><Copy size={12} /> Duplicate</button>
                  <button type="button" onClick={() => share(trip)} className="rounded-xl border border-line2 px-2.5 py-2 hover:border-gold/40 hover:text-gold transition flex items-center justify-center gap-1"><Share2 size={12} /> Share</button>
                  <button type="button" onClick={() => remove(trip.id)} className="rounded-xl border border-alert/30 px-2.5 py-2 text-alert hover:bg-alert/10 transition flex items-center justify-center gap-1"><Trash2 size={12} /> Delete</button>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAlbumTrip(trip)}
                  className="w-full mt-3 py-2 px-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                >
                  <span>🏆</span> View Memory Album & Badges
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {trips.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-3 flex items-center gap-1.5"><Heart size={12} className="text-alert" /> Trip History</p>
          <div className="flex flex-wrap gap-2">
            {trips.slice(0, 8).map((trip) => (
              <span key={trip.id} className="text-xs px-3 py-1.5 rounded-full border border-line2 text-mist glass-card flex items-center gap-1.5"><MapPin size={11} /> {trip.destination}</span>
            ))}
          </div>
        </div>
      )}

      {selectedAlbumTrip && (
        <TripMemoryAlbum
          trip={selectedAlbumTrip}
          onClose={() => setSelectedAlbumTrip(null)}
        />
      )}
    </div>
  );
}
