import { LogEntry } from "@/lib/api";

const STATUS_STYLE: Record<LogEntry["status"], { icon: string; color: string }> = {
  ok: { icon: "✔", color: "text-signal" },
  retry: { icon: "↻", color: "text-amber" },
  error: { icon: "✕", color: "text-alert" },
  info: { icon: "•", color: "text-mist" },
};

export default function ActionLog({ entries, live }: { entries: LogEntry[]; live: boolean }) {
  return (
    <div className="bg-panel border border-line rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line">
        <span className={`h-2 w-2 rounded-full bg-signal ${live ? "pulse-dot" : ""}`} />
        <span className="text-xs uppercase tracking-[0.2em] text-mist">Action Log</span>
      </div>
      <div className="scanline font-mono text-[13px] leading-relaxed p-4 max-h-80 overflow-y-auto">
        {entries.length === 0 && (
          <p className="text-mist/50">Waiting for a goal to plan…</p>
        )}
        {entries.map((e, i) => {
          const s = STATUS_STYLE[e.status];
          return (
            <div key={i} className="rise-in flex gap-2 py-0.5">
              <span className={s.color}>{s.icon}</span>
              <span className="text-mist/40 shrink-0">
                {new Date(e.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-[#dbe4ec]">{e.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
