"use client";

import { useState } from "react";
import {
  ChevronDown,
  Compass,
  CreditCard,
  LifeBuoy,
  MessageCircle,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";

const FAQS: { q: string; a: string; icon: React.ElementType }[] = [
  {
    icon: Compass,
    q: "How does the AI actually plan a trip?",
    a: "You describe a goal in plain language (destination, budget, duration, travel mode). The agent extracts your intent, then runs a workflow of tools — transport search, hotel search, weather check, budget comparison — and shows every step live in the 'AI Agent Workflow' log on the Plan Trip page.",
  },
  {
    icon: CreditCard,
    q: "Is the payment real?",
    a: "No — the Payment Gateway on the Plan Trip page is a clearly-labeled demo. No real card, UPI, or bank details are processed or stored.",
  },
  {
    icon: Shield,
    q: "How accurate is the Safety Score?",
    a: "It's a heuristic estimate meant as a general travel-safety signal, not an official rating. Always check current government travel advisories for your destination.",
  },
  {
    icon: Sparkles,
    q: "Can I change my mind mid-plan?",
    a: "Yes — just tell the agent what changed (\"I don't want flights, I prefer trains\" or \"increase my budget to ₹20,000\") and it will replan around your existing destination and preferences instead of starting over.",
  },
  {
    icon: MessageCircle,
    q: "Where do I ask something during my trip?",
    a: "Use the Messages tab, or the in-context helper at the bottom of your itinerary — both route your question to the same planning agent.",
  },
];

export default function HelpCenterPage() {
  const [query, setQuery] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filtered = FAQS.filter(
    (f) => f.q.toLowerCase().includes(query.toLowerCase()) || f.a.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6 rise-in max-w-3xl">
      <div className="glass-panel rounded-3xl p-6 text-center">
        <LifeBuoy className="mx-auto text-gold mb-2" size={24} />
        <h2 className="font-display text-xl font-semibold">How can we help?</h2>
        <div className="mt-4 glow-input rounded-2xl glass-card flex items-center gap-2 px-4 py-2.5 max-w-md mx-auto">
          <Search size={15} className="text-mist2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help articles…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-mist2"
          />
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-2 divide-y divide-line2">
        {filtered.map((f, i) => {
          const Icon = f.icon;
          const open = openIndex === i;
          return (
            <div key={f.q} className="p-3.5">
              <button
                onClick={() => setOpenIndex(open ? null : i)}
                className="w-full flex items-center justify-between gap-3 text-left"
              >
                <span className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-xl bg-panel2 border border-line2 flex items-center justify-center text-gold shrink-0">
                    <Icon size={15} />
                  </span>
                  <span className="text-sm font-medium">{f.q}</span>
                </span>
                <ChevronDown size={16} className={`text-mist2 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
              </button>
              {open && <p className="text-sm text-mist2 mt-2.5 pl-11 pr-2">{f.a}</p>}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-mist2 p-4">No articles match "{query}".</p>}
      </div>

      <div className="glass-panel rounded-3xl p-6 text-center">
        <p className="text-sm text-mist2">Still stuck? Head to the Messages tab and ask the AI assistant directly.</p>
      </div>
    </div>
  );
}
