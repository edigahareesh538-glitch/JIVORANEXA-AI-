"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Copy, LocateFixed, MapPinned, Navigation, Phone, Share2, ShieldAlert, Siren } from "lucide-react";
import { CurrentLocation, getEmergencySos, SosResult } from "@/lib/api";
import { getStoredAuth } from "@/lib/auth";

const CATEGORY_ORDER = [
  "hospital",
  "police",
  "fire_station",
  "ambulance",
  "blood_bank",
  "pharmacy",
  "mechanic",
  "ev_charging",
  "hotel",
  "atm",
  "petrol",
  "toilets",
];

export default function EmergencySOS({ destination, currentLocation }: { destination: string; currentLocation?: CurrentLocation }) {
  const [data, setData] = useState<SosResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareState, setShareState] = useState<string | null>(null);

  const auth = getStoredAuth();
  const emergencyContact = useMemo(
    () => ({
      name: auth?.user.emergency_contact_name,
      phone: auth?.user.emergency_contact_phone,
    }),
    [auth?.user.emergency_contact_name, auth?.user.emergency_contact_phone]
  );

  async function load() {
    setBusy(true);
    setError(null);
    try {
      setData(await getEmergencySos(destination, currentLocation));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load emergency info.");
    } finally {
      setBusy(false);
    }
  }

  async function shareLocation() {
    const label = currentLocation?.label || data?.center?.label || destination;
    const url = currentLocation
      ? `https://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lng}`
      : data?.center
        ? `https://www.google.com/maps?q=${data.center.lat},${data.center.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
    const text = `Emergency location: ${label} ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My live location", text, url });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setShareState("Location shared.");
    } catch {
      setShareState("Could not share location.");
    }
  }

  async function copyCoordinates() {
    const lat = currentLocation?.lat ?? data?.center?.lat;
    const lng = currentLocation?.lng ?? data?.center?.lng;
    if (lat == null || lng == null) return;
    try {
      await navigator.clipboard.writeText(`${lat}, ${lng}`);
      setShareState("Coordinates copied.");
    } catch {
      setShareState("Could not copy coordinates.");
    }
  }

  const centerLabel = currentLocation?.label || data?.center?.label || destination;
  const gpsStatus = currentLocation ? "Live GPS connected" : "GPS unavailable — using destination fallback";

  return (
    <div className="space-y-6 rise-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-8 flex flex-col items-center text-center justify-center border-alert/20">
          <button
            onClick={load}
            disabled={busy}
            className="sos-pulse h-32 w-32 rounded-full bg-gradient-to-br from-alert to-[#a83424] flex flex-col items-center justify-center text-white font-display font-bold shadow-2xl hover:scale-105 transition-transform disabled:opacity-70"
          >
            <Siren size={26} />
            <span className="mt-1 text-sm tracking-wide">{busy ? "Loading" : "SOS"}</span>
          </button>
          <p className="mt-5 text-sm font-semibold">Need Immediate Help?</p>
          <p className="text-xs text-mist2 mt-1 max-w-xs">Tap SOS to load emergency services and helplines near {destination}.</p>
        </div>

        <div className="glass-card rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-1 flex items-center gap-1.5">
                <LocateFixed size={13} className="text-gold" /> Location Center
              </p>
              <p className="text-sm font-medium">{centerLabel}</p>
              <p className="text-xs text-mist2 mt-1">{gpsStatus}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={shareLocation} className="text-xs px-3 py-2 rounded-xl bg-gradient-to-r from-gold to-goldDim text-ink font-semibold flex items-center gap-1.5">
                <Share2 size={12} /> Share My Live Location
              </button>
              <button onClick={copyCoordinates} className="text-xs px-3 py-2 rounded-xl border border-line2 text-mist hover:text-gold hover:border-gold/40 transition flex items-center gap-1.5">
                <Copy size={12} /> Copy GPS
              </button>
            </div>
          </div>
          {shareState && <p className="text-xs text-mist2 mt-3">{shareState}</p>}
          {error && <p className="text-xs text-alert mt-3">{error}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-4 flex items-center gap-1.5">
            <Phone size={13} className="text-alert" /> Emergency Numbers
          </p>
          {!data && !busy && <p className="text-sm text-mist2">Tap SOS to load helplines and nearby assistance for {destination}.</p>}
          {busy && (
            <div className="space-y-2">
              <div className="skeleton h-9 rounded-lg" />
              <div className="skeleton h-9 rounded-lg" />
              <div className="skeleton h-9 rounded-lg" />
            </div>
          )}
          {data && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {Object.entries(data.emergency_numbers).map(([label, number]) => (
                <a key={label} href={`tel:${number}`} className="flex items-center justify-between text-sm border border-line2 rounded-xl px-3 py-2.5 hover:border-alert/50 transition glass-card">
                  <span className="text-mist2 text-xs">{label}</span>
                  <span className="text-alert font-mono font-semibold">{number}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-4 flex items-center gap-1.5">
            <MapPinned size={13} className="text-gold" /> Saved Emergency Contact
          </p>
          {emergencyContact.name && emergencyContact.phone ? (
            <div className="border border-line2 rounded-2xl p-4">
              <p className="text-sm font-semibold">{emergencyContact.name}</p>
              <p className="text-xs text-mist2 mt-1">{emergencyContact.phone}</p>
              <div className="flex gap-2 mt-3">
                <a href={`tel:${emergencyContact.phone}`} className="text-xs px-3 py-2 rounded-xl bg-gradient-to-r from-gold to-goldDim text-ink font-semibold flex items-center gap-1.5">
                  <Phone size={12} /> Call Contact
                </a>
              </div>
            </div>
          ) : (
            <p className="text-sm text-mist2">Add an emergency contact in Profile to show it here instantly.</p>
          )}
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-4 flex items-center gap-1.5">
          <ShieldAlert size={13} className="text-gold" /> Nearby Assistance
        </p>
        {!data && !busy && <p className="text-sm text-mist2">Load nearby hospitals, police, fire, pharmacy, ATM, mechanic, EV charging and more.</p>}
        {busy && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
          </div>
        )}
        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CATEGORY_ORDER.filter((key) => data.categories[key]).map((key) => {
              const cat = data.categories[key];
              return (
                <div key={key} className="border border-line2 rounded-xl p-3.5">
                  <p className="text-xs text-mist2 mb-2 font-medium">{cat.label}</p>
                  {cat.places.length === 0 && (
                    <p className="text-xs text-mist2/60 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> None found nearby
                    </p>
                  )}
                  <div className="space-y-2">
                    {cat.places.map((p) => (
                      <div key={`${p.name}-${p.lat}-${p.lng}`} className="rounded-xl bg-white/5 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm truncate">{p.name}</p>
                            <p className="text-xs text-mist2 mt-0.5">{p.distance_km} km away</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            {p.call_number && (
                              <a href={`tel:${p.call_number}`} className="text-xs px-2.5 py-1.5 rounded-lg border border-line2 hover:border-gold/40 hover:text-gold transition flex items-center gap-1">
                                <Phone size={11} /> Call
                              </a>
                            )}
                            <a href={p.maps_link} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-gold to-goldDim text-ink font-semibold flex items-center gap-1">
                              <Navigation size={11} /> Navigate
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
