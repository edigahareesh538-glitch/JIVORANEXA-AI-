"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Sparkles, Wallet, MapPin, TrainFront, Plane, Bus, Car, Hotel, PiggyBank } from "lucide-react";
import {
  BudgetMode, compareBudgetToActuals, FullBudgetPlan, planBudgetFull,
} from "@/lib/api";

const MODE_PRESETS: { id: BudgetMode; label: string; note: string }[] = [
  { id: "budget",   label: "Budget",   note: "Cheapest transport + budget hotels" },
  { id: "standard", label: "Standard", note: "Balanced comfort and cost" },
  { id: "luxury",   label: "Luxury",   note: "Premium hotels, fine dining" },
];

const MODE_ICONS: Record<string, React.ElementType> = {
  flight: Plane, train: TrainFront, bus: Bus,
  own_vehicle: Car, rental_car: Car,
};

export default function BudgetPlannerPanel({ destination }: { destination?: string }) {
  const [budget, setBudget] = useState(20000);
  const [days, setDays] = useState(3);
  const [mode, setMode] = useState<BudgetMode>("standard");
  const [data, setData] = useState<FullBudgetPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(opts?: { budget?: number; days?: number; mode?: BudgetMode; destination?: string }) {
    setBusy(true); setError(null);
    try {
      const out = await planBudgetFull({
        totalBudget: opts?.budget ?? budget,
        durationDays: opts?.days ?? days,
        destination: opts?.destination ?? destination,
        mode: opts?.mode ?? mode,
      });
      setData(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the budget planner.");
    } finally { setBusy(false); }
  }

  useEffect(() => { load(); /* initial */ }, []);

  const chartData = useMemo(() => data?.visual_chart ?? [], [data]);

  return (
    <div className="space-y-5 rise-in">
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <Sparkles size={13} className="text-amber" /> AI Budget Planner
        </p>
        <p className="text-sm text-mist2 mt-1">
          Pick a mode and a budget — we split it, suggest the cheapest transport and hotel, and
          call out savings opportunities.
        </p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs text-mist2">
            Budget (₹)
            <input type="number" value={budget} min={500} onChange={(e) => setBudget(Number(e.target.value) || 0)}
              className="mt-1 w-full bg-panel border border-line rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-mist2">
            Days
            <input type="number" value={days} min={1} max={30} onChange={(e) => setDays(Number(e.target.value) || 1)}
              className="mt-1 w-full bg-panel border border-line rounded-lg px-3 py-2 text-sm" />
          </label>
          <div className="text-xs text-mist2">
            Mode
            <div className="mt-1 flex gap-1.5 flex-wrap">
              {MODE_PRESETS.map(({ id, label, note }) => (
                <button key={id} onClick={() => { setMode(id); load({ mode: id }); }}
                  title={note}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    mode === id ? "bg-amber text-ink border-amber font-semibold" : "border-line text-mist hover:border-amber/40"
                  }`}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => load()} disabled={busy}
            className="text-xs px-4 py-2 rounded-lg bg-gradient-to-r from-amber to-amberDim text-ink font-semibold disabled:opacity-60">
            {busy ? "Calculating…" : "Recalculate Plan"}
          </button>
          {destination && <p className="text-xs text-mist2 self-center">Trip to <b>{destination}</b></p>}
        </div>
        {error && <p className="text-xs text-alert mt-2">{error}</p>}
      </div>

      {!data && busy && (
        <div className="space-y-3">
          <div className="skeleton h-32 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-panel rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
                <TrainFront size={13} className="text-amber" /> Cheapest Transport
              </p>
              <p className="text-lg font-semibold mt-2">{transportLabel(data.cheapest_transport.recommended)}</p>
              <p className="text-xs text-mist2 mt-1">
                Estimated cost ₹{(data.cheapest_transport.recommended as { price?: number }).price ?? 0}
              </p>
              <ul className="mt-3 space-y-1.5">
                {data.cheapest_transport.alternatives.slice(0, 5).map((alt, idx) => (
                  <li key={idx} className="text-xs flex justify-between border-b border-line2 py-1.5 last:border-0">
                    <span>{(alt as { label?: string }).label}</span>
                    <span className="text-amber">₹{(alt as { price?: number }).price}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
                <Hotel size={13} className="text-amber" /> Hotel Recommendations
              </p>
              <p className="text-lg font-semibold mt-2">{data.cheapest_hotel.recommended.name}</p>
              <p className="text-xs text-mist2 mt-1">
                From ₹{data.cheapest_hotel.recommended.price_per_night}/night
              </p>
              <div className="mt-3 space-y-1.5">
                {data.cheapest_hotel.alternatives.map((h, idx) => (
                  <div key={idx} className="text-xs flex justify-between border-b border-line2 py-1.5 last:border-0">
                    <span>{(h as { label?: string }).label}</span>
                    <span className="text-amber">₹{(h as { min_price_per_night?: number }).min_price_per_night}/night</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
              <Wallet size={13} className="text-amber" /> Budget Split
            </p>
            <div className="mt-3" style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="#9aa3b2" />
                  <YAxis stroke="#9aa3b2" />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e2937" }} />
                  <Legend />
                  <Bar dataKey="value" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 text-xs grid grid-cols-2 sm:grid-cols-3 gap-2 text-mist2">
              {data.notes.map((n, i) => <p key={i}>· {n}</p>)}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-panel rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
                <PiggyBank size={13} className="text-amber" /> Savings Tips
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-mist">
                {data.savings_recommendations.map((tip, i) => <li key={i}>· {tip}</li>)}
              </ul>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
                <MapPin size={13} className="text-amber" /> Cost Prediction
              </p>
              <p className="text-sm mt-2">
                Low: <b>₹{data.travel_cost_prediction.low_estimate}</b> · Expected:{' '}
                <b>₹{data.travel_cost_prediction.expected_estimate}</b> · High:{' '}
                <b>₹{data.travel_cost_prediction.high_estimate}</b>
              </p>
              <p className="text-xs text-mist2 mt-1">
                {data.travel_cost_prediction.basis}
              </p>
              <p className={`mt-3 text-sm ${data.budget_comparison.fits ? "text-emerald-300" : "text-alert"}`}>
                {data.budget_comparison.summary}
              </p>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-3">Daily Spending Plan</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {data.daily_spending_plan.map((d) => (
                <div key={d.day} className="border border-line2 rounded-xl p-3">
                  <p className="text-xs text-mist2">Day {d.day}</p>
                  <p className="text-sm font-semibold mt-1">₹{d.estimated_spend}</p>
                  <p className="text-[11px] text-mist2 mt-0.5">{d.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <button onClick={() => compareBudgetToActuals({ budget, durationDays: days, destination })}
                className="text-xs px-3 py-1.5 rounded-lg border border-line text-mist hover:border-amber/40 hover:text-amber">
                Compare with my actual spending
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function transportLabel(rec: Record<string, unknown>) {
  const label = (rec.label as string) || ((rec.mode as string) || "transport").toString();
  return label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
