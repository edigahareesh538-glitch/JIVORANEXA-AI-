"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { VoiceInputButton } from "@/components/VoiceInput";

type ChatMsg = { role: "user" | "assistant"; text: string; created_at: string };

const STORAGE_KEY = "trip_agent_messages";
const SUGGESTIONS = [
  "Plan a Goa trip for 4 days under ₹25,000",
  "I want a budget Manali trip by train",
  "Weekend trip near Hyderabad under ₹10,000",
  "Suggest things to pack for Kerala in monsoon",
];

function replyFor(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("pack")) return "For that trip, keep weather-ready layers, chargers, ID proofs, and one small emergency kit. If you want, I can tailor a packing list once you confirm the destination and dates.";
  if (lower.includes("budget")) return "I can help optimize the budget. Share the destination, number of days, and travel mode, and I’ll keep the plan cost-focused without sending you away from this chat.";
  if (lower.includes("goa") || lower.includes("manali") || lower.includes("hyderabad") || lower.includes("kerala")) {
    return "Great choice. I’ve kept your conversation here, and we can continue refining destination, days, budget, weather, and transport step by step.";
  }
  return "Got it. Tell me your destination, budget, days, and travel style, and I’ll continue the conversation here with practical travel guidance.";
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setMessages(JSON.parse(raw) as ChatMsg[]);
        return;
      }
    } catch {
      /* ignore */
    }
    setMessages([
      {
        role: "assistant",
        text: "Hi! I’m your AI trip assistant. Ask about destinations, budget, safety, or packing and I’ll keep the conversation going right here.",
        created_at: new Date().toISOString(),
      },
    ]);
  }, []);

  useEffect(() => {
    if (!messages.length) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const disabled = useMemo(() => !text.trim(), [text]);

  function send(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    setMessages((m) => [
      ...m,
      { role: "user", text: trimmed, created_at: now },
      { role: "assistant", text: replyFor(trimmed), created_at: new Date().toISOString() },
    ]);
    setText("");
  }

  return (
    <div className="rise-in max-w-3xl mx-auto flex flex-col h-[calc(100vh-11rem)]">
      <div className="flex-1 overflow-y-auto glass-panel rounded-3xl p-5 space-y-4">
        {messages.map((m, i) => (
          <div key={`${m.created_at}-${i}`} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                m.role === "assistant" ? "bg-gradient-to-br from-aPurple to-aBlue" : "bg-gradient-to-br from-gold to-goldDim"
              }`}
            >
              {m.role === "assistant" ? <Bot size={15} className="text-white" /> : <User size={15} className="text-ink" />}
            </div>
            <div className={`glass-card rounded-2xl px-4 py-2.5 text-sm max-w-[80%] ${m.role === "user" ? "bg-gold/10 border-gold/30" : ""}`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <p className="text-xs text-mist2 mb-2 flex items-center gap-1.5">
          <Sparkles size={12} className="text-gold" /> Try asking
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-xs px-3 py-1.5 rounded-full border border-line2 text-mist glass-card hover:border-gold/50 hover:text-gold transition"
            >
              {s}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="flex gap-2 glow-input rounded-2xl glass-panel p-1.5"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message your AI trip assistant…"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-mist2"
          />
          <VoiceInputButton onTranscript={(t) => setText(t)} />
          <button
            type="submit"
            disabled={disabled}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-gold to-goldDim text-ink font-semibold text-sm disabled:opacity-40 hover:brightness-110 transition flex items-center gap-1.5"
          >
            <Send size={14} /> Send
          </button>
        </form>
      </div>
    </div>
  );
}
