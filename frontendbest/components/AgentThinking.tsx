"use client";

import { useEffect, useRef, useState } from "react";
import { LogEntry } from "@/lib/api";
import { AGENT_META, AGENT_ORDER, AgentKey, classifyLogEntry } from "@/lib/agentMap";

const STATUS_ICON: Record<LogEntry["status"], string> = { ok: "✔", retry: "↻", error: "✕", info: "•" };

export default function AgentThinking({ entries, live }: { entries: LogEntry[]; live: boolean }) {
  const [revealCount, setRevealCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRevealCount(0);
    if (timerRef.current) clearInterval(timerRef.current);
    if (entries.length === 0) return;

    timerRef.current = setInterval(() => {
      setRevealCount((c) => {
        if (c >= entries.length) {
          if (timerRef.current) clearInterval(timerRef.current);
          return c;
        }
        return c + 1;
      });
    }, 160);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  const revealed = entries.slice(0, revealCount);
  const seenAgents = new Set<AgentKey>(revealed.map(classifyLogEntry));
  const activeAgent = revealCount > 0 && revealCount <= entries.length ? classifyLogEntry(entries[revealCount - 1]) : null;
  const stillWorking = revealCount < entries.length;

  return (
    <div className="glass rounded-xl overflow-hidden fade-scale-in">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line/60">
        <span className={`h-2 w-2 rounded-full bg-signal ${live || stillWorking ? "pulse-dot" : ""}`} />
        <span className="text-xs uppercase tracking-[0.2em] text-mist">Multi-Agent Activity</span>
      </div>

      {/* Agent strip */}
      <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-line/60">
        {AGENT_ORDER.map((key) => {
          const meta = AGENT_META[key];
          const seen = seenAgents.has(key);
          const isActive = activeAgent === key && stillWorking;
          return (
            <div
              key={key}
              title={meta.label}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all duration-300 ${
                seen ? "border-transparent" : "border-line/60 opacity-40"
              } ${isActive ? "ripple-marker" : ""}`}
              style={seen ? { background: `${meta.color}1a`, color: meta.color, borderColor: `${meta.color}55` } : undefined}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${isActive ? "pulse-dot" : ""}`}
                style={{ background: seen ? meta.color : "#8FA1B3" }}
              />
              {meta.label}
            </div>
          );
        })}
      </div>

      {/* Streamed log */}
      <div className="scanline font-mono text-[13px] leading-relaxed p-4 max-h-80 overflow-y-auto">
        {entries.length === 0 && <p className="text-mist/50">Waiting for a goal to plan…</p>}
        {revealed.map((e, i) => {
          const agent = classifyLogEntry(e);
          const meta = AGENT_META[agent];
          return (
            <div key={i} className="rise-in flex gap-2 py-0.5 items-baseline">
              <span style={{ color: meta.color }}>{STATUS_ICON[e.status]}</span>
              <span
                className="text-[10px] font-semibold uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded"
                style={{ background: `${meta.color}22`, color: meta.color }}
              >
                {meta.short}
              </span>
              <span className="text-mist/40 shrink-0">{new Date(e.timestamp).toLocaleTimeString()}</span>
              <span className="text-[#dbe4ec]">{e.message}</span>
            </div>
          );
        })}
        {stillWorking && (
          <div className="flex gap-2 py-0.5 text-mist/50">
            <span className="animate-pulse">▋</span>
            <span className="italic">{activeAgent && AGENT_META[activeAgent].label} agent thinking…</span>
          </div>
        )}
      </div>
    </div>
  );
}
