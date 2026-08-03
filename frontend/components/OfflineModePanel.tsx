"use client";

import { useEffect, useState } from "react";
import { CloudOff, MapPin, Wallet, Users, Phone, Map, Calendar, DollarSign } from "lucide-react";
import {
  getOfflineContacts, getOfflineDestinations, getOfflineExpenses,
  getOfflineItinerary, getOfflineMaps,
} from "@/lib/api";

interface ItineraryPayload {
  cached?: boolean;
  message?: string;
  destination?: string;
  days?: Array<{ day: number; title: string; places?: string[] }>;
}

interface MapsPayload {
  tiles?: string[];
  route_points?: Array<[number, number]>;
}

interface ContactsPayload {
  personal?: { name?: string; phone?: string };
  global?: Record<string, string>;
  cached_at?: string;
}

interface DestinationsPayload {
  favorites?: Array<{ name: string; destination?: string }>;
  recent?: Array<{ name: string; destination?: string }>;
}

interface ExpensesPayload {
  rows_csv?: string;
  count?: number;
  cached_at?: string;
}

export default function OfflineModePanel({ loggedIn }: { loggedIn: boolean }) {
  const [state, setState] = useState<{
    itinerary?: ItineraryPayload;
    maps?: MapsPayload;
    contacts?: ContactsPayload;
    destinations?: DestinationsPayload;
    expenses?: ExpensesPayload;
  }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loggedIn) return;
    async function cache() {
      setBusy(true); setError(null);
      try {
        const [it, mp, ct, ds, ex] = await Promise.all([
          getOfflineItinerary(), getOfflineMaps(), getOfflineContacts(),
          getOfflineDestinations(), getOfflineExpenses(),
        ]);
        setState({ itinerary: it, maps: mp, contacts: ct, destinations: ds, expenses: ex });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Offline cache failed.");
      } finally { setBusy(false); }
    }
    cache();
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <div className="glass-panel rounded-2xl p-6">
        <p className="text-sm text-mist2">Sign in to download an offline bundle for your last trip.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 rise-in">
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <CloudOff size={13} className="text-amber" /> Offline Mode
        </p>
        <p className="text-sm text-mist2 mt-1">
          Pre-cached itinerary, OSM tile priors, emergency contacts, recent destinations and expenses —
          available without internet once loaded.
        </p>
        {busy && <p className="text-xs text-mist2 mt-2">Caching…</p>}
        {error && <p className="text-xs text-alert mt-2">{error}</p>}
      </div>

      {/* 1. Itinerary */}
      <ItinerarySection data={state.itinerary} />

      {/* 2. Map Tile Cache */}
      <MapCacheSection data={state.maps} />

      {/* 3. Emergency Contacts */}
      <ContactsSection data={state.contacts} />

      {/* 4. Recent & Favourite Destinations */}
      <DestinationsSection data={state.destinations} />

      {/* 5. Expenses */}
      <ExpensesSection data={state.expenses} />
    </div>
  );
}

// ---------------- Helper Component Cards ----------------

function PanelHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5 mb-3">
      <Icon size={13} className="text-amber" /> {title}
    </p>
  );
}

function ItinerarySection({ data }: { data?: ItineraryPayload }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <PanelHeader icon={Calendar} title="Itinerary" />
      {data?.cached === false || data?.message ? (
        <div className="p-3 bg-panel/50 border border-line rounded-xl text-xs text-mist2">
          {data?.message || "No saved itinerary cached yet."}
        </div>
      ) : data?.destination ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">📍 {data.destination}</p>
          <div className="grid gap-2">
            {data.days?.map((d) => (
              <div key={d.day} className="p-2.5 bg-panel border border-line rounded-lg text-xs">
                <span className="font-medium text-amber">Day {d.day}: </span>
                <span className="text-white">{d.title}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-mist2">—</p>
      )}
    </div>
  );
}

function MapCacheSection({ data }: { data?: MapsPayload }) {
  const tileCount = data?.tiles?.length || 0;
  const pointCount = data?.route_points?.length || 0;

  return (
    <div className="glass-panel rounded-2xl p-5">
      <PanelHeader icon={Map} title="Map Tile Cache" />
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-panel border border-line rounded-xl">
          <p className="text-mist2 text-[11px]">Cached Map Tiles</p>
          <p className="text-base font-semibold text-white mt-0.5">{tileCount}</p>
        </div>
        <div className="p-3 bg-panel border border-line rounded-xl">
          <p className="text-mist2 text-[11px]">Route Points Saved</p>
          <p className="text-base font-semibold text-white mt-0.5">{pointCount}</p>
        </div>
      </div>
    </div>
  );
}

function ContactsSection({ data }: { data?: ContactsPayload }) {
  const globalContacts = data?.global ? Object.entries(data.global) : [];

  return (
    <div className="glass-panel rounded-2xl p-5">
      <PanelHeader icon={Users} title="Emergency Contacts" />
      <div className="space-y-3">
        {data?.personal?.name && (
          <div className="p-3 bg-panel border border-line rounded-xl flex justify-between items-center text-xs">
            <div>
              <p className="text-[10px] text-mist2 uppercase">Personal Emergency Contact</p>
              <p className="font-medium text-white">{data.personal.name}</p>
            </div>
            {data.personal.phone && (
              <a href={`tel:${data.personal.phone}`} className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-lg text-xs">
                <Phone size={12} /> {data.personal.phone}
              </a>
            )}
          </div>
        )}

        {globalContacts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {globalContacts.map(([label, phone]) => (
              <div key={label} className="p-2.5 bg-panel border border-line rounded-lg flex justify-between items-center text-xs">
                <span className="text-mist2 capitalize">{label}</span>
                <a href={`tel:${phone}`} className="font-medium text-amber hover:underline">
                  {phone}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DestinationsSection({ data }: { data?: DestinationsPayload }) {
  const favorites = data?.favorites || [];
  const recents = data?.recent || [];

  return (
    <div className="glass-panel rounded-2xl p-5">
      <PanelHeader icon={MapPin} title="Recent + Favourite Destinations" />
      {favorites.length === 0 && recents.length === 0 ? (
        <p className="text-xs text-mist2">No offline destinations saved.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {favorites.map((item, idx) => (
            <div key={`fav-${idx}`} className="px-3 py-1.5 bg-panel border border-line rounded-lg text-xs flex items-center gap-1.5">
              <span>📍</span>
              <div>
                <p className="font-medium text-white">{item.name}</p>
                {item.destination && <p className="text-[10px] text-mist2">{item.destination}</p>}
              </div>
            </div>
          ))}
          {recents.map((item, idx) => (
            <div key={`rec-${idx}`} className="px-3 py-1.5 bg-panel border border-line rounded-lg text-xs flex items-center gap-1.5">
              <span>🕒</span>
              <div>
                <p className="font-medium text-white">{item.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpensesSection({ data }: { data?: ExpensesPayload }) {
  const rows = data?.rows_csv ? data.rows_csv.split("\n").filter((r) => r.trim()) : [];
  const hasRows = rows.length > 1;

  return (
    <div className="glass-panel rounded-2xl p-5">
      <PanelHeader icon={Wallet} title="Last 100 Expenses" />
      {hasRows ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-panel border-b border-line text-mist2 uppercase text-[10px]">
              <tr>
                <th className="p-2">ID</th>
                <th className="p-2">Category</th>
                <th className="p-2">Label</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {rows.slice(1).map((row, idx) => {
                const cols = row.split(",");
                return (
                  <tr key={idx} className="hover:bg-panel/30">
                    <td className="p-2 font-mono text-[10px] text-mist2">{cols[0]?.slice(0, 8)}...</td>
                    <td className="p-2 capitalize text-white">{cols[1]}</td>
                    <td className="p-2 text-mist2">{cols[2]}</td>
                    <td className="p-2 font-medium text-emerald-400">{cols[3]} {cols[4]}</td>
                    <td className="p-2 text-mist2">{cols[5]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-mist2">No offline expense history available.</p>
      )}
    </div>
  );
}