"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { 
  Receipt, Download, FileText, FileSpreadsheet, Camera, Sparkles, 
  CheckCircle2, AlertCircle, Building2, Tag, Calendar, DollarSign, ArrowUpRight 
} from "lucide-react";
import {
  ExpenseReport, exportExpenseCsvUrl, exportExpensePdfUrl, exportExpenseXlsxUrl,
  getBudgetVsActualReport, getExpenseAnalytics, getExpenseMonthlyReport,
  ocrExpenseText,
} from "@/lib/api";
import { authHeaders } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL || "https://jivoranexa-ai.onrender.com";

interface OcrParsedData {
  merchant?: string;
  amount?: number | null;
  currency?: string;
  category?: string;
  date?: string | null;
  line_items?: Array<{ text: string; amount?: number }>;
  confidence?: string;
  saved_expense_id?: string;
}

interface BudgetVsActualData {
  planned_budget?: number;
  total_spent?: number;
  variance?: number;
  status?: string;
  details?: Record<string, unknown>;
}

export default function ExpenseSmart({ loggedIn }: { loggedIn: boolean }) {
  const [data, setData] = useState<ExpenseReport | null>(null);
  const [monthly, setMonthly] = useState<Record<string, number> | null>(null);
  const [budgetVsActual, setBudgetVsActual] = useState<BudgetVsActualData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptText, setReceiptText] = useState("");
  const [ocrResult, setOcrResult] = useState<OcrParsedData | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);

  async function load() {
    if (!loggedIn) return;
    setBusy(true); setError(null);
    try {
      const [a, m] = await Promise.all([getExpenseAnalytics(), getExpenseMonthlyReport()]);
      setData(a); 
      setMonthly((m as { by_month?: Record<string, number> }).by_month as Record<string, number> || {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load analytics.");
    } finally { setBusy(false); }
  }
  
  useEffect(() => { load(); }, [loggedIn]);

  async function runOcr() {
    if (!receiptText.trim()) return;
    setOcrBusy(true);
    try {
      const res = await ocrExpenseText(receiptText.trim());
      setOcrResult(res as OcrParsedData);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR scan failed.");
    } finally { setOcrBusy(false); }
  }

  async function downloadExport(format: "csv" | "xlsx" | "pdf") {
    try {
      setError(null);
      const response = await fetch(`${API}/api/expenses/export/${format}`, {
        method: "GET",
        headers: {
          ...authHeaders(),
          Accept: format === "pdf"
            ? "application/pdf"
            : format === "xlsx"
              ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              : "text/csv",
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(body || `Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `expenses_report.${format === "xlsx" ? "xlsx" : format === "pdf" ? "pdf" : "csv"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    }
  }

  if (!loggedIn) {
    return (
      <div className="glass-panel rounded-2xl p-6">
        <p className="text-sm text-mist2">
          Sign in (email, Google, or Guest Mode) to use OCR receipt scanning and expense analytics.
        </p>
      </div>
    );
  }

  const monthlyRows = monthly ? Object.entries(monthly).map(([k, v]) => ({ month: k, total: v })) : [];

  return (
    <div className="space-y-5 rise-in">
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <Receipt size={13} className="text-amber" /> Smart Expense Manager
        </p>
        <p className="text-sm text-mist2 mt-1">
          OCR receipt scanning, AI categorization, monthly/yearly/category reports,
          and PDF/Excel/CSV exports.
        </p>
        {error && <p className="text-xs text-alert mt-2">{error}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* OCR Section */}
        <div className="glass-panel rounded-2xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
            <Camera size={13} className="text-amber" /> OCR Receipt / Ticket / Hotel Bill
          </p>
          <textarea value={receiptText} onChange={(e) => setReceiptText(e.target.value)}
            rows={5}
            placeholder="Paste receipt text here or click 'Use Camera' to scan an image using browser OCR"
            className="mt-2 w-full bg-panel border border-line rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-amber/50" />
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={runOcr} disabled={ocrBusy || !receiptText.trim()}
              className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber to-amberDim text-ink font-semibold disabled:opacity-60 transition-opacity">
              {ocrBusy ? "Scanning…" : "Scan + Add"}
            </button>
            <label className="text-xs px-3 py-1.5 rounded-lg border border-line text-mist cursor-pointer hover:border-amber/40 hover:text-amber transition-colors">
              <Receipt size={12} className="inline-block mr-1 -mt-0.5" /> Use Camera (browser OCR)
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setOcrBusy(true);
                  setError(null);
                  try {
                    const { createWorker } = await import("tesseract.js");
                    const worker = await createWorker("eng");
                    const { data: { text } } = await worker.recognize(file);
                    await worker.terminate();

                    if (!text.trim()) {
                      setError("No readable text found in image.");
                      return;
                    }

                    const res = await fetch(`${API}/api/expenses/ocr`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", ...authHeaders() },
                      body: JSON.stringify({ text }),
                    });
                    
                    const resData = await res.json();
                    setOcrResult(resData);
                    setReceiptText(text);
                    await load();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Image OCR failed");
                  } finally {
                    setOcrBusy(false);
                  }
                }} />
            </label>
          </div>

          {/* Formatted OCR Result Card */}
          {ocrResult && <OcrResultCard result={ocrResult} />}
        </div>

        {/* AI Category Section */}
        <div className="glass-panel rounded-2xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber" /> AI Category Prediction
          </p>
          <p className="text-xs text-mist2 mt-1">
            Try "Taj Hotel stay 2 nights", "Uber to airport", "Pizza dinner" — we auto-categorize.
          </p>
          <SuggestCategoryForm onAdd={load} />
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPI label="Total spend" value={`₹${data.total.toLocaleString()}`} />
            <KPI label="Entries" value={data.count.toString()} />
            <KPI label="Top category" value={Object.entries(data.by_category || {})[0]?.[0] ?? "—"} />
            <KPI label="Months" value={Object.keys(data.by_month || {}).length.toString()} />
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-3">Monthly spend</p>
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={monthlyRows}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" stroke="#9aa3b2" />
                  <YAxis stroke="#9aa3b2" />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e2937", borderRadius: "8px" }} />
                  <Bar dataKey="total" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-3">By category</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(data.by_category || {}).map(([cat, val]) => (
                <div key={cat} className="flex justify-between text-sm border border-line2 rounded-lg px-3 py-2 bg-panel/50">
                  <span className="capitalize">{cat}</span>
                  <span className="text-amber font-medium">₹{Number(val).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-3">Exports & Reports</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => downloadExport("csv")} className="text-xs px-3 py-2 rounded-lg border border-line text-mist hover:border-amber/40 hover:text-amber flex items-center gap-1.5 transition-colors">
                <Download size={12} /> CSV
              </button>
              <button type="button" onClick={() => downloadExport("xlsx")} className="text-xs px-3 py-2 rounded-lg border border-line text-mist hover:border-amber/40 hover:text-amber flex items-center gap-1.5 transition-colors">
                <FileSpreadsheet size={12} /> Excel
              </button>
              <button type="button" onClick={() => downloadExport("pdf")} className="text-xs px-3 py-2 rounded-lg border border-line text-mist hover:border-amber/40 hover:text-amber flex items-center gap-1.5 transition-colors">
                <FileText size={12} /> PDF
              </button>
              <button onClick={async () => {
                try {
                  const r = await getBudgetVsActualReport(data.total, 3);
                  setBudgetVsActual(r as BudgetVsActualData);
                } catch { /* ignore */ }
              }}
                className="text-xs px-3 py-2 rounded-lg border border-line text-mist hover:border-amber/40 hover:text-amber flex items-center gap-1.5 transition-colors">
                <ArrowUpRight size={12} /> Compare vs my last plan
              </button>
            </div>

            {/* Formatted Budget Comparison UI */}
            {budgetVsActual && <BudgetReportCard report={budgetVsActual} currentTotal={data.total} />}
          </div>
        </>
      )}
      {busy && <div className="skeleton h-32 rounded-2xl" />}
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel rounded-2xl p-4 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-mist2">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  );
}

/* --- OCR Formatted Component --- */
function OcrResultCard({ result }: { result: OcrParsedData }) {
  return (
    <div className="mt-3 p-3.5 bg-panel border border-line/80 rounded-xl space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-line">
        <div className="flex items-center gap-1.5 text-xs text-mist font-medium">
          <CheckCircle2 size={13} className="text-emerald-400" />
          <span>OCR Scanned Successfully</span>
        </div>
        {result.confidence && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-mono tracking-wider ${
            result.confidence === "low" ? "bg-amber/10 text-amber border border-amber/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          }`}>
            {result.confidence} confidence
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-mist2 flex items-center gap-1 text-[11px]"><Building2 size={11} /> Merchant</span>
          <p className="font-semibold text-mist mt-0.5 truncate">{result.merchant || "Unknown Merchant"}</p>
        </div>
        <div>
          <span className="text-mist2 flex items-center gap-1 text-[11px]"><DollarSign size={11} /> Total Amount</span>
          <p className="font-semibold text-amber mt-0.5">
            {result.amount ? `₹${result.amount.toLocaleString()}` : "Not detected"}
          </p>
        </div>
        <div>
          <span className="text-mist2 flex items-center gap-1 text-[11px]"><Tag size={11} /> Category</span>
          <p className="font-medium text-mist mt-0.5 capitalize">{result.category || "General"}</p>
        </div>
        <div>
          <span className="text-mist2 flex items-center gap-1 text-[11px]"><Calendar size={11} /> Date</span>
          <p className="font-medium text-mist mt-0.5">{result.date || "N/A"}</p>
        </div>
      </div>

      {/* Line Items List */}
      {result.line_items && result.line_items.length > 0 && (
        <div className="pt-2 border-t border-line/50">
          <p className="text-[11px] text-mist2 uppercase tracking-wider mb-1.5 font-medium">Line Items</p>
          <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
            {result.line_items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-[11px] bg-line/20 rounded px-2 py-1">
                <span className="text-mist truncate max-w-[70%]">{item.text}</span>
                <span className="text-amber font-mono">{item.amount ? `₹${item.amount}` : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Budget vs Actual Comparison Card --- */
function BudgetReportCard({ report, currentTotal }: { report: BudgetVsActualData; currentTotal: number }) {
  const planned = report.planned_budget || 15000;
  const diff = planned - currentTotal;
  const isUnder = diff >= 0;

  return (
    <div className="mt-3 p-4 bg-panel border border-line rounded-xl space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-mist2">Plan vs Spend Summary</span>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
          isUnder ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
        }`}>
          {isUnder ? `₹${diff.toLocaleString()} Under Budget` : `₹${Math.abs(diff).toLocaleString()} Over Budget`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
        <div className="bg-line/20 p-2 rounded-lg">
          <span className="text-mist2 text-[11px]">Planned Budget</span>
          <p className="text-sm font-semibold text-mist mt-0.5">₹{planned.toLocaleString()}</p>
        </div>
        <div className="bg-line/20 p-2 rounded-lg">
          <span className="text-mist2 text-[11px]">Actual Spend</span>
          <p className="text-sm font-semibold text-amber mt-0.5">₹{currentTotal.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

function SuggestCategoryForm({ onAdd }: { onAdd: () => Promise<void> | void }) {
  const [text, setText] = useState("");
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text || !amount) return;
        setBusy(true);
        try {
          const cat = await fetch(`${API}/api/expenses/categorize?text=${encodeURIComponent(text)}`,
            { method: "POST", headers: authHeaders() }).then((r) => r.json());
          await fetch(`${API}/api/expenses`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ category: cat.category || "General", amount, label: text }),
          });
          setText(""); setAmount(0);
          await onAdd();
        } finally { setBusy(false); }
      }}
      className="mt-3 space-y-2"
    >
      <input value={text} onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Uber to airport"
        className="w-full bg-panel border border-line rounded-lg px-3 py-2 text-xs text-mist placeholder:text-mist2 focus:outline-none focus:border-amber/50" />
      <input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value) || 0)}
        placeholder="Amount (₹)"
        className="w-full bg-panel border border-line rounded-lg px-3 py-2 text-xs text-mist placeholder:text-mist2 focus:outline-none focus:border-amber/50" />
      <button disabled={busy || !text || !amount}
        className="w-full text-xs px-3 py-2 rounded-lg bg-gradient-to-r from-amber to-amberDim text-ink font-semibold disabled:opacity-60 transition-opacity">
        {busy ? "Adding…" : "Add expense"}
      </button>
    </form>
  );
}
