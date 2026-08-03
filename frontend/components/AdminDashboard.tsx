"use client";

import { useEffect, useState } from "react";
import { Activity, Users, MapPin, Plane, Wallet, ShieldCheck } from "lucide-react";
import {
  getAdminAnalytics, getAdminErrorLogs, getAdminReport, getAdminSystemHealth,
} from "@/lib/api";

export default function AdminDashboard({ loggedIn, isAdmin }: { loggedIn: boolean; isAdmin: boolean }) {
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [errors, setErrors] = useState<unknown>(null);
  const [report, setReport] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // BUGFIX: this only checked loggedIn before, so a Guest Mode account
    // (which is "logged in") could load and view admin-only analytics.
    if (!loggedIn || !isAdmin) return;
    async function load() {
      setBusy(true); setError(null);
      try {
        const [a, h] = await Promise.all([getAdminAnalytics(), getAdminSystemHealth()]);
        setAnalytics(a as unknown as Record<string, unknown>);
        setHealth(h as unknown as Record<string, unknown>);
      } catch (e) { setError(e instanceof Error ? e.message : "Admin load failed."); }
      finally { setBusy(false); }
    }
    load();
  }, [loggedIn, isAdmin]);

  if (!loggedIn) return null;
  if (!isAdmin) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center">
        <ShieldCheck className="mx-auto text-gold mb-3" size={22} />
        <p className="text-sm text-mist">This dashboard is for admin accounts only.</p>
      </div>
    );
  }

  const users = (analytics?.users as Record<string, number>) ?? {};
  const trips = (analytics?.trips as Record<string, unknown>) ?? {};
  const bookings = (analytics?.bookings as Record<string, unknown>) ?? {};
  const expenses = (analytics?.expenses as Record<string, unknown>) ?? {};
  const top = (analytics?.top_destinations as Array<{ destination: string; count: number }>) ?? [];

  return (
    <div className="space-y-5 rise-in">
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-amber" /> Admin Dashboard
        </p>
        {error && <p className="text-xs text-alert mt-2">{error}</p>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI icon={Users} label="Total users" value={String(users.total ?? 0)} />
        <KPI icon={MapPin} label="Trips" value={String((trips.total as number) ?? 0)} />
        <KPI icon={Plane} label="Bookings" value={String((bookings.total as number) ?? 0)} />
        <KPI icon={Wallet} label="Spend logged" value={`₹${((expenses.total_value as number) ?? 0).toLocaleString()}`} />
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-3">Top destinations</p>
        {top.length === 0 ? <p className="text-xs text-mist2">No data yet.</p> :
          <div className="space-y-1">
            {top.map((d) => (
              <div key={d.destination} className="flex justify-between text-sm border-b border-line2 py-1.5 last:border-0">
                <span>{d.destination}</span><span className="text-amber">{d.count}</span>
              </div>
            ))}
          </div>}
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <Activity size={13} className="text-amber" /> System health
        </p>
        <pre className="mt-2 text-xs font-mono bg-panel border border-line rounded-lg p-3 max-h-40 overflow-auto">
{health ? JSON.stringify(health, null, 2) : "—"}
        </pre>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel rounded-2xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-3">Error log feed</p>
          <button onClick={async () => {
            try { setErrors(await getAdminErrorLogs()); }
            catch { /* ignore */ }
          }} className="text-xs px-3 py-1.5 rounded-lg border border-line text-mist hover:border-amber/40 hover:text-amber">
            Refresh
          </button>
          <pre className="mt-3 text-xs font-mono bg-panel border border-line rounded-lg p-3 max-h-72 overflow-auto">
{errors ? JSON.stringify(errors, null, 2) : "Press refresh to load."}
          </pre>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-3">Reports</p>
          <div className="flex flex-wrap gap-2">
            {(["users", "trips", "bookings", "expenses"] as const).map((k) => (
              <button key={k} onClick={async () => {
                try { setReport(await getAdminReport(k)); }
                catch { /* ignore */ }
              }} className="text-xs px-3 py-1.5 rounded-lg border border-line text-mist hover:border-amber/40 hover:text-amber">
                {k}
              </button>
            ))}
          </div>
          <pre className="mt-3 text-xs font-mono bg-panel border border-line rounded-lg p-3 max-h-72 overflow-auto">
{report ? JSON.stringify(report, null, 2) : "Pick a report above."}
          </pre>
        </div>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="glass-panel rounded-2xl p-4 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center justify-center gap-1">
        <Icon size={12} className="text-amber" /> {label}
      </p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  );
}
