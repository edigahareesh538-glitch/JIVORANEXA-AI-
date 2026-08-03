"use client";

import { useState } from "react";
import { Check, Crown, Loader2, Sparkles, Zap } from "lucide-react";
import { demoCharge } from "@/lib/api";

const PERKS = [
  { icon: Zap, text: "Priority AI planning — faster itinerary generation" },
  { icon: Sparkles, text: "Unlimited destination previews & budget optimizations" },
  { icon: Check, text: "Advanced expense analytics & CSV/PDF export" },
  { icon: Crown, text: "Early access to new agents (Restaurant, Safety, Optimization)" },
];

export default function PremiumPage({ loggedIn }: { loggedIn: boolean }) {
  const [status, setStatus] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function upgrade() {
    setStatus("busy");
    setError(null);
    try {
      await demoCharge(499, "Premium Membership (Monthly)");
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't process the demo charge.");
      setStatus("idle");
    }
  }

  return (
    <div className="rise-in max-w-2xl mx-auto space-y-6">
      <div className="glass-panel rounded-3xl p-8 text-center relative overflow-hidden glow-gold">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-gold to-goldDim flex items-center justify-center mb-4">
          <Crown size={26} className="text-ink" />
        </div>
        <h2 className="font-display text-2xl font-semibold text-gradient-hero">Trip Agent Premium</h2>
        <p className="text-sm text-mist2 mt-2">Unlock the full power of your AI travel agent.</p>
        <p className="font-display text-3xl font-semibold mt-4">
          ₹499<span className="text-sm text-mist2 font-normal">/month</span>
        </p>
      </div>

      <div className="glass-panel rounded-3xl p-6 space-y-3.5">
        {PERKS.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3">
            <span className="h-8 w-8 rounded-xl bg-gold/10 text-gold flex items-center justify-center shrink-0">
              <Icon size={15} />
            </span>
            <p className="text-sm">{text}</p>
          </div>
        ))}
      </div>

      {status === "done" ? (
        <div className="glass-panel rounded-3xl p-6 text-center border-signal/30">
          <Check className="mx-auto text-signal mb-2" size={22} />
          <p className="text-sm font-semibold">Demo upgrade complete ✓</p>
          <p className="text-xs text-mist2 mt-1">No real charge was made — this used the same demo payment gateway as trip bookings.</p>
        </div>
      ) : (
        <button
          onClick={upgrade}
          disabled={status === "busy" || !loggedIn}
          className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-gold to-goldDim text-ink font-semibold text-sm disabled:opacity-40 hover:brightness-110 transition"
        >
          {status === "busy" ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}
          {status === "busy" ? "Processing demo charge…" : "Upgrade Now (Demo Payment)"}
        </button>
      )}
      {!loggedIn && <p className="text-xs text-mist2 text-center">Sign in from the Profile tab to try the demo upgrade.</p>}
      {error && <p className="text-xs text-alert text-center">{error}</p>}
      <p className="text-xs text-mist2 text-center">
        This is a demo — no real subscription or billing is created; it reuses the same demo payment endpoint as trip checkout.
      </p>
    </div>
  );
}
