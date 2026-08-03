"use client";

import { useState } from "react";
import { Bus, Hotel, Plane, TrainFront } from "lucide-react";
import { bookTrip, fileUrl, BookingResult } from "@/lib/api";

export default function BookingPanel({ sessionId }: { sessionId: string }) {
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBook() {
    setBusy(true);
    setError(null);
    try {
      const result = await bookTrip(sessionId);
      setBooking(result);
    } catch (e) {
      setError("Couldn't generate booking documents. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  if (!booking) {
    return (
      <div className="rise-in relative">
        {busy && (
          <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center px-6">
            <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 text-center shadow-2xl">
              <div className="relative h-16 overflow-hidden rounded-xl bg-ink/60 border border-line mb-4">
                <Plane className="booking-fly absolute top-5 h-6 w-6 text-amber" />
                <TrainFront className="booking-train absolute top-5 h-6 w-6 text-[#9B8AFB]" />
                <Bus className="booking-bus absolute top-5 h-6 w-6 text-[#F0654E]" />
                <Hotel className="absolute right-4 top-5 h-6 w-6 text-[#4FD1A5]" />
              </div>
              <p className="font-display text-lg font-semibold">Booking your ticket</p>
              <p className="mt-2 text-sm text-mist">
                Preparing route, hotel, and travel documents. Please wait…
              </p>
            </div>
          </div>
        )}
        <button
          onClick={handleBook}
          disabled={busy}
          className="w-full px-5 py-3 rounded-xl bg-amber text-ink font-semibold text-sm disabled:opacity-40 hover:brightness-110 transition"
        >
          {busy ? "Booking…" : "Book My Ticket"}
        </button>
        {error && <p className="mt-2 text-sm text-alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-4 rise-in">
      <p className="text-xs uppercase tracking-[0.2em] text-mist mb-3">Your Booking Documents</p>
      <div className="space-y-2">
        {booking.documents.map((doc) => (
          <a
            key={doc.label}
            href={fileUrl(doc.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-ink border border-line text-sm hover:border-amber/50 transition"
          >
            <span>{doc.label}</span>
            <span className="text-mist text-xs">PDF ↗</span>
          </a>
        ))}
      </div>
      <a
        href={fileUrl(booking.download_all_url)}
        className="mt-4 block text-center px-5 py-3 rounded-xl bg-signal text-ink font-semibold text-sm hover:brightness-110 transition"
      >
        Download All PDFs (.zip)
      </a>
    </div>
  );
}
