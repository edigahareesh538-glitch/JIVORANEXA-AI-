"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, TrendingDown } from "lucide-react";
import { PlanResult, getSafetyScore, SafetyScore, optimizeBudget, BudgetOptimization } from "@/lib/api";

export default function TripInsights({ result }: { result: PlanResult }) {
  const [safety, setSafety] = useState<SafetyScore | null>(null);
  const [optimization, setOptimization] = useState<BudgetOptimization | null>(null);

  useEffect(() => {
    getSafetyScore(result.destination).then(setSafety).catch(() => {});
    optimizeBudget(
      result.total_cost,
      result.budget,
      result.transport_mode,
      result.hotel?.price_per_night
    ).then(setOptimization).catch(() => {});
  }, [result.destination, result.total_cost, result.budget, result.transport_mode, result.hotel?.price_per_night]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="glass card-hover rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={15} className="text-signal" />
          <p className="text-xs uppercase tracking-[0.2em] text-mist">AI Safety Score</p>
        </div>
        {safety ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-display font-semibold text-signal">
                {"★".repeat(safety.safety_score)}
                <span className="text-mist/30">{"★".repeat(safety.safety_score_out_of - safety.safety_score)}</span>
              </span>
            </div>
            <div className="mt-2 text-xs text-mist space-y-1">
              <p>Crowd: <span className="text-[#dbe4ec]">{safety.crowd_level}</span></p>
              <p>Women's Safety: <span className="text-[#dbe4ec]">{safety.womens_safety}</span></p>
              <p>Emergency Number: <span className="text-amber font-semibold">{safety.emergency_number}</span></p>
            </div>
            <p className="text-[10px] text-mist/40 mt-2">{safety.note}</p>
          </>
        ) : (
          <div className="skeleton h-16" />
        )}
      </div>

      <div className="glass card-hover rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown size={15} className="text-amber" />
          <p className="text-xs uppercase tracking-[0.2em] text-mist">AI Budget Optimizer</p>
        </div>
        {optimization ? (
          optimization.over_budget ? (
            <>
              <p className="text-xs text-alert mb-1">
                ₹{optimization.overage?.toLocaleString("en-IN")} over budget
              </p>
              <ul className="text-xs text-mist space-y-1 mb-2">
                {optimization.suggestions.map((s) => (
                  <li key={s}>✓ {s}</li>
                ))}
              </ul>
              <p className="text-sm">
                New estimated cost:{" "}
                <span className={optimization.fits_budget_after ? "text-signal font-semibold" : "text-amber font-semibold"}>
                  ₹{optimization.new_total.toLocaleString("en-IN")}
                </span>
              </p>
            </>
          ) : (
            <p className="text-sm text-signal">✔ Already within budget — no changes needed.</p>
          )
        ) : (
          <div className="skeleton h-16" />
        )}
      </div>
    </div>
  );
}
