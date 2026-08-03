"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, CartesianGrid, Legend, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addExpense, deleteExpense, Expense, expenseSummary, listExpenses } from "@/lib/api";

const CATEGORIES = ["flight", "hotel", "food", "shopping", "transport", "emergency", "other"];
const BUDGET_KEY = "trip_agent_expense_budget";
const COLORS = ["#F5B841", "#4FD1A5", "#8B5CF6", "#F0654E", "#3B82F6", "#39E5D6", "#FF9B54"];

function monthKey(date: string) {
  return new Date(date).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

export default function ExpenseTracker({ loggedIn }: { loggedIn: boolean }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [category, setCategory] = useState("food");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [range, setRange] = useState<"monthly" | "yearly">("monthly");
  const [budget, setBudget] = useState("25000");

  async function refresh() {
    try {
      setBusy(true);
      const [items] = await Promise.all([listExpenses(), expenseSummary().catch(() => null)]);
      setExpenses(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load expenses.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (loggedIn) refresh();
    const storedBudget = localStorage.getItem(BUDGET_KEY);
    if (storedBudget) setBudget(storedBudget);
  }, [loggedIn]);

  useEffect(() => {
    localStorage.setItem(BUDGET_KEY, budget);
  }, [budget]);

  async function add() {
    const value = parseFloat(amount);
    if (!value) return;
    setError(null);
    try {
      await addExpense(category, value, label || undefined);
      setAmount("");
      setLabel("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add expense.");
    }
  }

  async function remove(id: string) {
    await deleteExpense(id);
    refresh();
  }

  function exportCsv() {
    const rows = [["Date", "Category", "Label", "Amount", "Currency"], ...filteredExpenses.map((item) => [item.spent_at, item.category, item.label || "", item.amount, item.currency])];
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "expenses.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    const rows = [["Date", "Category", "Label", "Amount", "Currency"], ...filteredExpenses.map((item) => [item.spent_at, item.category, item.label || "", item.amount, item.currency])];
    const blob = new Blob([rows.map((row) => row.join("\t")).join("\n")], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "expenses.xls";
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const reportWindow = window.open("", "_blank", "width=900,height=700");
    if (!reportWindow) return;
    reportWindow.document.write(`<html><head><title>Expense Report</title></head><body><h1>Expense Report</h1><table border="1" cellspacing="0" cellpadding="8"><tr><th>Date</th><th>Category</th><th>Label</th><th>Amount</th></tr>${filteredExpenses.map((item) => `<tr><td>${new Date(item.spent_at).toLocaleDateString("en-IN")}</td><td>${item.category}</td><td>${item.label || ""}</td><td>${item.amount}</td></tr>`).join("")}</table><script>window.print();</script></body></html>`);
    reportWindow.document.close();
  }

  if (!loggedIn) {
    return <p className="text-sm text-mist border border-line rounded-xl p-4">Sign in or continue as guest to track expenses.</p>;
  }

  const filteredExpenses = expenses.filter((item) => filterCategory === "all" || item.category === filterCategory);
  const total = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const budgetValue = parseFloat(budget) || 0;
  const remaining = budgetValue - total;

  const byCategory = CATEGORIES.map((entry) => ({
    name: entry,
    value: filteredExpenses.filter((item) => item.category === entry).reduce((sum, item) => sum + item.amount, 0),
  })).filter((item) => item.value > 0);

  const monthlySeries = Object.entries(filteredExpenses.reduce<Record<string, number>>((acc, item) => {
    const key = monthKey(item.spent_at);
    acc[key] = (acc[key] || 0) + item.amount;
    return acc;
  }, {})).map(([name, value]) => ({ name, value }));

  const yearlySeries = Object.entries(filteredExpenses.reduce<Record<string, number>>((acc, item) => {
    const key = String(new Date(item.spent_at).getFullYear());
    acc[key] = (acc[key] || 0) + item.amount;
    return acc;
  }, {})).map(([name, value]) => ({ name, value }));

  const chartData = range === "monthly" ? monthlySeries : yearlySeries;

  return (
    <div className="space-y-5">
      <div className="border border-line rounded-xl p-4 space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-mist">Expense Tracker</p>
        <div className="flex flex-wrap gap-2">
          <select className="bg-panel border border-line rounded px-2 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="w-28 bg-panel border border-line rounded px-3 py-2 text-sm" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="flex-1 min-w-[120px] bg-panel border border-line rounded px-3 py-2 text-sm" placeholder="Note (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button onClick={add} className="bg-amber text-ink text-sm font-medium rounded px-3 py-2">Add</button>
        </div>
        {error && <p className="text-xs text-alert">{error}</p>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4"><p className="text-xs text-mist2">Total Spent</p><p className="text-xl font-display font-semibold mt-1">₹{total.toLocaleString()}</p></div>
        <div className="glass-card rounded-2xl p-4"><p className="text-xs text-mist2">Budget</p><input value={budget} onChange={(e) => setBudget(e.target.value)} className="mt-2 w-full bg-panel border border-line rounded px-3 py-2 text-sm" /></div>
        <div className="glass-card rounded-2xl p-4"><p className="text-xs text-mist2">Remaining</p><p className={`text-xl font-display font-semibold mt-1 ${remaining >= 0 ? "text-signal" : "text-alert"}`}>₹{remaining.toLocaleString()}</p></div>
        <div className="glass-card rounded-2xl p-4 flex flex-col gap-2"><p className="text-xs text-mist2">Export</p><div className="flex flex-wrap gap-2"><button onClick={exportPdf} className="text-xs px-3 py-2 rounded-lg bg-amber text-ink font-semibold">PDF</button><button onClick={exportExcel} className="text-xs px-3 py-2 rounded-lg border border-line2 hover:border-gold/40 hover:text-gold transition">Excel</button><button onClick={exportCsv} className="text-xs px-3 py-2 rounded-lg border border-line2 hover:border-gold/40 hover:text-gold transition">CSV</button></div></div>
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setRange("monthly")} className={`text-xs px-3 py-1.5 rounded-full border ${range === "monthly" ? "border-gold text-gold bg-gold/10" : "border-line2 text-mist2"}`}>Monthly</button>
          <button onClick={() => setRange("yearly")} className={`text-xs px-3 py-1.5 rounded-full border ${range === "yearly" ? "border-gold text-gold bg-gold/10" : "border-line2 text-mist2"}`}>Yearly</button>
        </div>
        <select className="bg-panel border border-line rounded px-3 py-2 text-sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="all">All categories</option>
          {CATEGORIES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-4 h-80">
          <p className="text-xs uppercase tracking-[0.2em] text-mist mb-3">Statistics</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#243038" />
              <XAxis dataKey="name" stroke="#9AA3B5" fontSize={11} />
              <YAxis stroke="#9AA3B5" fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#F5B841" radius={[8, 8, 0, 0]} name="Spent" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card rounded-2xl p-4 h-80">
          <p className="text-xs uppercase tracking-[0.2em] text-mist mb-3">Categories</p>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {byCategory.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: number) => [`₹${value.toLocaleString()}`, "Spent"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="border border-line rounded-xl p-4 space-y-2 max-h-80 overflow-y-auto">
        <p className="text-xs uppercase tracking-[0.2em] text-mist">Expense Entries {busy ? "· Loading…" : ""}</p>
        {filteredExpenses.map((e) => (
          <div key={e.id} className="flex justify-between text-sm border-b border-line/50 py-2 last:border-0">
            <span className="text-mist">{e.category}{e.label ? ` · ${e.label}` : ""}<span className="block text-[11px] text-mist2 mt-0.5">{new Date(e.spent_at).toLocaleDateString("en-IN")}</span></span>
            <span className="flex items-center gap-2">₹{e.amount.toLocaleString()}<button onClick={() => remove(e.id)} className="text-alert/70 hover:text-alert text-xs">✕</button></span>
          </div>
        ))}
        {filteredExpenses.length === 0 && <p className="text-xs text-mist/50">No expenses logged yet.</p>}
      </div>
    </div>
  );
}
