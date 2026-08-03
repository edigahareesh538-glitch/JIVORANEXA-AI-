"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

export type CommandAction = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
};

export default function CommandPalette({ actions }: { actions: CommandAction[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q) || a.group.toLowerCase().includes(q) || a.hint?.toLowerCase().includes(q));
  }, [actions, query]);

  function runHighlighted() {
    const action = filtered[highlight];
    if (action) {
      action.run();
      setOpen(false);
    }
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runHighlighted();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 glass rounded-full px-4 py-2.5 text-xs text-mist hover:text-amber hover:border-amber/40 transition flex items-center gap-2 shadow-lg"
      >
        <Search size={13} />
        <span className="hidden sm:inline">Quick actions</span>
        <kbd className="font-mono text-[10px] bg-line/60 rounded px-1.5 py-0.5">⌘K</kbd>
      </button>
    );
  }

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg glass-strong rounded-xl overflow-hidden fade-scale-in shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line/60">
          <Search size={16} className="text-mist" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search actions… (plan a trip, dashboard, currency, SOS)"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-mist/50"
          />
          <kbd className="font-mono text-[10px] text-mist bg-line/60 rounded px-1.5 py-0.5">esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && <p className="px-4 py-6 text-sm text-mist text-center">No matching actions.</p>}
          {filtered.map((a, i) => {
            const showGroup = a.group !== lastGroup;
            lastGroup = a.group;
            return (
              <div key={a.id}>
                {showGroup && (
                  <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-[0.2em] text-mist/50">{a.group}</p>
                )}
                <button
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => {
                    a.run();
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors ${
                    highlight === i ? "bg-amber/10 text-amber" : "text-[#dbe4ec] hover:bg-line/30"
                  }`}
                >
                  <span>{a.label}</span>
                  {a.hint && <span className="text-xs text-mist">{a.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
