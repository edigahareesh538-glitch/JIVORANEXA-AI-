"use client";

import { useEffect, useState } from "react";
import { Briefcase, CheckCircle2, Heart, MapPin, Send, Sparkles, Wallet } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { DashboardData, getDashboard } from "@/lib/api";
import { destinationPhoto, destinationAccent, POPULAR_DESTINATIONS } from "@/lib/destinations";
import { formatCurrency, getStoredSettings, subscribeToSettings } from "@/lib/settings";

const PIE_COLORS = ["#F5B841", "#4FD1A5", "#8B5CF6", "#F0654E", "#3B82F6"];

export default function Dashboard({ loggedIn, name, onPlan }: { loggedIn: boolean; name?: string; onPlan: (destination: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState(getStoredSettings().currency);

  useEffect(() => subscribeToSettings((s) => setCurrency(s.currency)), []);

  useEffect(() => {
    if (!loggedIn) return;
    getDashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load dashboard."));
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center rise-in">
        <Sparkles className="mx-auto text-gold mb-3" size={22} />
        <p className="text-sm text-mist">Sign in or continue as guest (Profile tab) to see your personal dashboard.</p>
      </div>
    );
  }
  if (error) return <p className="text-xs text-alert">{error}</p>;
  if (!data) return <DashboardSkeleton />;

  const stats = [
    { label: "Total Trips", value: data.analytics.total_trips, icon: Briefcase, color: "text-gold" },
    { label: "Completed", value: data.analytics.completed_trips, icon: CheckCircle2, color: "text-signal" },
    { label: "Favorites", value: data.analytics.favorite_places_count, icon: Heart, color: "text-alert" },
    { label: "Cities Visited", value: data.analytics.visited_cities.length, icon: MapPin, color: "text-[#8B5CF6]" },
  ];

  const spendByTrip = data.recent_trips
    .filter((t) => t.total_cost)
    .slice(0, 5)
    .map((t) => ({ name: t.destination, value: t.total_cost as number }));

  return (
    <div className="space-y-6 rise-in">
      <div className="glass-card rounded-2xl p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold">
            Welcome back, <span className="gold-gradient-text">{name || data.profile.display_name || "Traveler"}</span> 👋
          </h2>
          <p className="text-sm text-mist2 mt-1">Here's what's happening with your travel plans today.</p>
        </div>
        <p className="text-xs text-mist2 flex items-center gap-1.5">
          <Wallet size={13} className="text-gold" />
          Total spent <span className="text-gold font-mono font-semibold">{formatCurrency(data.analytics.total_expenses, currency)}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card rounded-2xl p-4 card-hover">
            <div className={`h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center mb-3 ${color}`}>
              <Icon size={16} />
            </div>
            <p className="text-2xl font-display font-semibold">{value}</p>
            <p className="text-xs text-mist2 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 glass-card rounded-2xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-4">Recent Trips</p>
          {data.recent_trips.length === 0 ? (
            <p className="text-sm text-mist2">No trips saved yet — plan one from the Plan Trip tab.</p>
          ) : (
            <div className="space-y-3">
              {data.recent_trips.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onPlan(t.destination)}
                  className="w-full text-left flex items-center gap-3 py-2.5 border-b border-line2 last:border-0 hover:opacity-95 transition"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={destinationPhoto(t.destination, 120, 90)} alt={t.destination} className="h-14 w-20 rounded-xl object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm flex items-center gap-2 font-medium truncate">
                      <MapPin size={13} className="text-gold shrink-0" /> {t.destination}
                    </span>
                    <span className="text-xs text-mist2 flex items-center gap-2 mt-1">
                      <span className="capitalize">{t.status}</span>
                      <span>{new Date(t.created_at).toLocaleDateString("en-IN")}</span>
                    </span>
                  </div>
                  {t.total_cost !== null && <span className="font-mono text-gold text-xs shrink-0">{formatCurrency(t.total_cost, currency)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 glass-card rounded-2xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-2">Spend by Recent Trip</p>
          {spendByTrip.length === 0 ? (
            <p className="text-sm text-mist2 mt-4">No cost data yet.</p>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={spendByTrip} dataKey="value" nameKey="name" innerRadius={40} outerRadius={65} paddingAngle={3}>
                    {spendByTrip.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#12141A", border: "1px solid #22262F", borderRadius: 10, fontSize: 12 }}
                    formatter={(v: number) => [formatCurrency(v, currency), "Cost"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-4">Popular Destinations</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger">
          {POPULAR_DESTINATIONS.slice(0, 4).map((d) => {
            const accent = destinationAccent(d.name);
            return (
              <button key={d.name} type="button" onClick={() => onPlan(d.name)} className="rounded-2xl overflow-hidden glass-card glow-hover group text-left">
                <div className="relative h-24">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={destinationPhoto(d.name, 320, 200)} alt={d.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/10 to-transparent" />
                  <span className={`absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-ink/60 ${accent.text}`}>
                    ★ {d.rating}
                  </span>
                  <div className="absolute bottom-2 left-2.5">
                    <p className="text-sm font-display font-semibold text-white leading-tight">{d.name}</p>
                    <p className="text-[10px] text-white/70 leading-tight">{d.tag}</p>
                  </div>
                </div>
                <div className="px-3 py-2 text-[11px] text-mist2 flex items-center gap-1.5">
                  <Send size={11} className="text-gold" /> Open trip planner
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {data.analytics.visited_cities.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-3">Cities Visited</p>
          <div className="flex flex-wrap gap-2">
            {data.analytics.visited_cities.map((c) => (
              <button key={c} type="button" onClick={() => onPlan(c)} className="text-xs px-3 py-1.5 rounded-full border border-line2 text-mist hover:text-gold hover:border-gold/40 transition">
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-24 rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-56 rounded-2xl" />
    </div>
  );
}
