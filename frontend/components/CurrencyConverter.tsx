"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, BellRing, TrendingUp } from "lucide-react";
import { convertCurrency, CurrencyResult } from "@/lib/api";
import { getStoredSettings, subscribeToSettings } from "@/lib/settings";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "JPY", "AUD"];
const HISTORY_KEY = "trip_agent_currency_history";
const ALERT_KEY = "trip_agent_currency_alerts";

type AlertItem = { id: string; from: string; to: string; targetRate: number };

export default function CurrencyConverter() {
  const [amount, setAmount] = useState("1000");
  const [from, setFrom] = useState(getStoredSettings().currency || "INR");
  const [to, setTo] = useState("USD");
  const [result, setResult] = useState<CurrencyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<CurrencyResult[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertRate, setAlertRate] = useState("");

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]") as CurrencyResult[]);
      setAlerts(JSON.parse(localStorage.getItem(ALERT_KEY) || "[]") as AlertItem[]);
    } catch {
      /* ignore */
    }
    return subscribeToSettings((settings) => setFrom((prev) => prev || settings.currency || "INR"));
  }, []);

  function persistHistory(next: CurrencyResult[]) {
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, 8)));
  }

  function persistAlerts(next: AlertItem[]) {
    setAlerts(next);
    localStorage.setItem(ALERT_KEY, JSON.stringify(next));
  }

  async function convert() {
    setBusy(true);
    setError(null);
    try {
      const converted = await convertCurrency(parseFloat(amount) || 0, from, to);
      setResult(converted);
      persistHistory([converted, ...history].slice(0, 8));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed.");
    } finally {
      setBusy(false);
    }
  }

  function swap() {
    setFrom(to);
    setTo(from);
  }

  function addAlert() {
    const targetRate = parseFloat(alertRate);
    if (!targetRate) return;
    persistAlerts([{ id: `${from}-${to}-${targetRate}`, from, to, targetRate }, ...alerts.filter((a) => a.id !== `${from}-${to}-${targetRate}`)]);
    setAlertRate("");
  }

  const matchingAlerts = useMemo(() => alerts.filter((item) => item.from === from && item.to === to), [alerts, from, to]);

  return (
    <div className="space-y-5">
      <div className="border border-line rounded-xl p-4 space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-mist flex items-center gap-1.5"><TrendingUp size={12} className="text-gold" /> Currency Converter</p>
        <div className="flex flex-wrap items-center gap-2">
          <input className="w-28 bg-panel border border-line rounded px-3 py-2 text-sm outline-none focus:border-amber" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <select className="bg-panel border border-line rounded px-2 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="button" onClick={swap} className="text-mist hover:text-gold transition p-2 rounded-lg border border-line2">
            <ArrowRightLeft size={14} />
          </button>
          <select className="bg-panel border border-line rounded px-2 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button disabled={busy} onClick={convert} className="bg-amber text-ink text-sm font-medium rounded px-3 py-2 disabled:opacity-40">
            {busy ? "Converting…" : "Convert"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {CURRENCIES.slice(0, 6).map((currency) => (
            <button key={currency} type="button" onClick={() => setTo(currency)} className={`text-xs px-2.5 py-1 rounded-full border ${to === currency ? "border-gold text-gold bg-gold/10" : "border-line2 text-mist2 hover:border-gold/40 hover:text-gold"}`}>
              {currency}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-alert">{error}</p>}
        {result && (
          <div className="space-y-1">
            <p className="text-lg font-display">
              {result.amount} {result.from} = <span className="text-signal">{result.converted} {result.to}</span>
            </p>
            <p className="text-xs text-mist">Rate {result.rate.toFixed(4)} · {result.source === "live" ? "live exchange rate" : "offline fallback"}</p>
            {matchingAlerts.length > 0 && (
              <p className="text-xs text-gold">{matchingAlerts.some((item) => result.rate >= item.targetRate) ? "Rate alert reached." : `Tracking ${matchingAlerts.length} alert(s) for this pair.`}</p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-line rounded-xl p-4 space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-mist">Exchange History</p>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {history.length === 0 && <p className="text-xs text-mist2">No conversions yet.</p>}
            {history.map((item, index) => (
              <button key={`${item.from}-${item.to}-${index}`} type="button" onClick={() => { setAmount(String(item.amount)); setFrom(item.from); setTo(item.to); setResult(item); }} className="w-full text-left rounded-xl border border-line2 px-3 py-2 hover:border-gold/40 transition">
                <p className="text-sm">{item.amount} {item.from} → {item.converted} {item.to}</p>
                <p className="text-[11px] text-mist2 mt-0.5">Rate {item.rate.toFixed(4)} · {item.source}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="border border-line rounded-xl p-4 space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-mist flex items-center gap-1.5"><BellRing size={12} className="text-gold" /> Rate Alerts</p>
          <div className="flex gap-2">
            <input value={alertRate} onChange={(e) => setAlertRate(e.target.value)} placeholder="Target rate" className="flex-1 bg-panel border border-line rounded px-3 py-2 text-sm outline-none focus:border-amber" />
            <button type="button" onClick={addAlert} className="bg-amber text-ink text-sm font-medium rounded px-3 py-2">Add Alert</button>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {alerts.length === 0 && <p className="text-xs text-mist2">Create an alert to track a target exchange rate.</p>}
            {alerts.map((item) => (
              <div key={item.id} className="rounded-xl border border-line2 px-3 py-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm">{item.from} → {item.to}</p>
                  <p className="text-[11px] text-mist2">Notify when rate reaches {item.targetRate}</p>
                </div>
                <button type="button" onClick={() => persistAlerts(alerts.filter((alert) => alert.id !== item.id))} className="text-xs text-alert hover:underline">Remove</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
