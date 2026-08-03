"use client";

import { useState } from "react";
import { CheckCircle2, QrCode } from "lucide-react";
import { demoCharge } from "@/lib/api";

type Stage = "idle" | "processing" | "success" | "error";

export default function PaymentGateway({ amount, label, loggedIn }: { amount: number; label: string; loggedIn: boolean }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [transactionId, setTransactionId] = useState<string | null>(null);

  async function handlePay() {
    setStage("processing");
    // Small artificial delay so the "processing" animation is visible --
    // this is a demo gateway, not a real payment network call.
    setTimeout(async () => {
      try {
        if (loggedIn) {
          const result = await demoCharge(amount, label);
          setTransactionId(result.transaction_id);
        } else {
          setTransactionId(`DEMO-${Math.random().toString(36).slice(2, 10).toUpperCase()}`);
        }
        setStage("success");
      } catch {
        setStage("error");
      }
    }, 1400);
  }

  return (
    <div className="glass card-hover rounded-xl p-4 fade-scale-in">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-[0.2em] text-mist">Payment</p>
        <span className="text-[10px] uppercase tracking-wider bg-amber/15 text-amber px-2 py-0.5 rounded-full font-semibold">
          Demo Payment — no real charge
        </span>
      </div>

      {stage === "idle" && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-display font-semibold">₹{amount.toLocaleString("en-IN")}</p>
            <p className="text-xs text-mist mt-0.5">{label}</p>
          </div>
          <button
            onClick={handlePay}
            className="px-5 py-2.5 rounded-xl bg-amber text-ink font-semibold text-sm hover:brightness-110 transition"
          >
            Pay Now
          </button>
        </div>
      )}

      {stage === "processing" && (
        <div className="flex flex-col items-center py-4 gap-3">
          <div className="relative">
            <QrCode size={64} className="text-mist/60" />
            <div className="absolute inset-0 border-2 border-amber rounded spin-slow" />
          </div>
          <p className="text-xs text-mist">Simulating UPI transaction…</p>
        </div>
      )}

      {stage === "success" && (
        <div className="flex flex-col items-center py-3 gap-2 fade-scale-in">
          <CheckCircle2 size={40} className="text-signal" />
          <p className="text-sm font-semibold text-signal">Payment Successful (Demo)</p>
          <p className="text-[11px] text-mist font-mono">{transactionId}</p>
          <p className="text-[11px] text-mist/60 text-center max-w-xs">
            Simulated for demo purposes — no real money moved. Swap in Razorpay/Stripe to go live.
          </p>
        </div>
      )}

      {stage === "error" && (
        <div className="text-center py-3">
          <p className="text-sm text-alert">Couldn't record the demo payment.</p>
          <button onClick={() => setStage("idle")} className="mt-2 text-xs text-mist hover:text-amber">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
