"use client";

import { useEffect, useState } from "react";
import { Plane, Hotel, Bus, Train, RefreshCw, Trash2 } from "lucide-react";
import {
  Booking, BookingMode, createBooking, listBookings, updateBookingStatus, cancelBooking,
} from "@/lib/api";

const MODE_META: Record<BookingMode, { label: string; icon: React.ElementType; defaultProvider: string }> = {
  flight: { label: "Flight", icon: Plane,  defaultProvider: "Indigo / SpiceJet" },
  hotel:  { label: "Hotel",  icon: Hotel,  defaultProvider: "OYO / MakeMyTrip" },
  bus:    { label: "Bus",    icon: Bus,    defaultProvider: "RedBus" },
  train:  { label: "Train",  icon: Train,  defaultProvider: "IRCTC" },
};

export default function BookingEngine({ loggedIn, defaultDestination }: {
  loggedIn: boolean; defaultDestination?: string;
}) {
  const [mode, setMode] = useState<BookingMode>("flight");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState(defaultDestination ?? "");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [travelers, setTravelers] = useState(1);
  const [fare, setFare] = useState(2500);
  const [items, setItems] = useState<Booking[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!loggedIn) return;
    setBusy(true); setError(null);
    try { setItems(await listBookings()); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load bookings."); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [loggedIn]);

  if (!loggedIn) {
    return (
      <div className="glass-panel rounded-2xl p-6">
        <p className="text-sm text-mist2">Sign in to record flight, hotel, bus and train bookings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 rise-in">
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          {React.createElement(MODE_META[mode].icon, { size: 13, className: "text-amber" })} New Booking
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(MODE_META) as BookingMode[]).map((m) => {
            const Icon = MODE_META[m].icon;
            return (
              <button key={m} onClick={() => setMode(m)}
                className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${
                  mode === m ? "bg-amber text-ink border-amber font-semibold" : "border-line text-mist hover:border-amber/40"
                }`}>
                <Icon size={12} /> {MODE_META[m].label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(mode === "flight" || mode === "train" || mode === "bus") && (
            <input value={origin} onChange={(e) => setOrigin(e.target.value)}
              placeholder="Origin city" className="bg-panel border border-line rounded-lg px-3 py-2 text-xs" />
          )}
          <input value={destination} onChange={(e) => setDestination(e.target.value)}
            placeholder="Destination" className="bg-panel border border-line rounded-lg px-3 py-2 text-xs" />
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="bg-panel border border-line rounded-lg px-3 py-2 text-xs" />
          <input type="number" min={1} value={travelers} onChange={(e) => setTravelers(Number(e.target.value) || 1)}
            placeholder="Travelers" className="bg-panel border border-line rounded-lg px-3 py-2 text-xs" />
          <input type="number" min={0} value={fare} onChange={(e) => setFare(Number(e.target.value) || 0)}
            placeholder="Fare (₹)" className="bg-panel border border-line rounded-lg px-3 py-2 text-xs sm:col-span-2" />
        </div>

        <button onClick={async () => {
          if (!destination.trim()) return;
          try {
            await createBooking({
              mode, origin: origin.trim() || undefined,
              destination: destination.trim(), start_date: startDate,
              travelers, fare, provider: MODE_META[mode].defaultProvider,
            });
            await load();
          } catch (e) { setError(e instanceof Error ? e.message : "Booking failed."); }
        }} disabled={busy}
          className="mt-3 text-xs px-4 py-2 rounded-lg bg-gradient-to-r from-amber to-amberDim text-ink font-semibold disabled:opacity-60">
          {busy ? "Saving…" : `Save ${MODE_META[mode].label} booking`}
        </button>
        {error && <p className="text-xs text-alert mt-2">{error}</p>}
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-3">Booking history</p>
        {items.length === 0 ? <p className="text-xs text-mist2">No bookings yet.</p> :
          <div className="space-y-3">
            {items.map((b) => {
              const Icon = MODE_META[b.mode]?.icon ?? Plane;
              return (
                <div key={b.id} className="border border-line2 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        <Icon size={14} className="text-amber" />
                        {b.mode.toUpperCase()} · {b.destination}
                      </p>
                      <p className="text-xs text-mist2 mt-1">
                        {b.origin ? `${b.origin} → ${b.destination} · ` : ""}
                        {b.start_date} · {b.travelers} traveller(s) · ₹{b.fare}
                      </p>
                      <p className="text-[11px] text-amber mt-1 font-mono">Confirmation: {b.confirmation_code ?? "—"}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] px-2 py-1 rounded-full ${
                        b.status === "confirmed" ? "bg-emerald-500/20 text-emerald-300"
                        : b.status === "cancelled" ? "bg-alert/20 text-alert"
                        : "border border-line text-mist"
                      }`}>{b.status}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {b.status !== "cancelled" && b.status !== "completed" && (
                      <button onClick={async () => {
                        try { await updateBookingStatus(b.id, "completed"); await load(); }
                        catch { /* ignore */ }
                      }} className="text-xs px-2 py-1 rounded border border-emerald-500 text-emerald-300 flex items-center gap-1">
                        <RefreshCw size={11} /> Complete
                      </button>
                    )}
                    {b.status === "confirmed" && (
                      <button onClick={async () => {
                        try { await cancelBooking(b.id); await load(); }
                        catch { /* ignore */ }
                      }} className="text-xs px-2 py-1 rounded border border-alert text-alert flex items-center gap-1">
                        <Trash2 size={11} /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>}
      </div>
    </div>
  );
}

// Avoid a top-level React import by aliasing it here.
import React from "react";
