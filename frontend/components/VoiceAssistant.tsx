"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Languages, Play, Square, Volume2, MapPin, Wallet, Hotel, Plane, ChevronDown } from "lucide-react";
import { getVoiceLanguages, voicePlan, VoiceLanguage } from "@/lib/api";

type VoicePlanResult = {
  session_id?: string;
  destination?: string;
  trip_summary?: string;
  assistant_message?: string;
  voice_summary?: string;
  budget?: number;
  total_cost?: number;
  within_budget?: boolean;
  transport_mode?: string;
  flight?: { airline?: string; label?: string; price?: number } | null;
  hotel?: { name?: string; price_per_night?: number } | null;
  attractions?: Array<{ name?: string } | string> | null;
  action_log?: Array<{ step?: string; status?: string }>;
};

export default function VoiceAssistant({ onPlanResult }: { onPlanResult?: (r: Record<string, unknown>) => void }) {
  const [languages, setLanguages] = useState<VoiceLanguage[]>([]);
  const [language, setLanguage] = useState("en");
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [result, setResult] = useState<VoicePlanResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const recogRef = useRef<unknown>(null);

  useEffect(() => {
    getVoiceLanguages().then((d) => setLanguages(d.languages)).catch(() => setLanguages([]));
  }, []);

  function startListening() {
    type SREvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> };
    type SRErrorEvent = { error: string };
    interface SRCtor { new (): SRCtorInstance; }
    interface SRCtorInstance { lang: string; interimResults: boolean; continuous: boolean;
      onresult: ((e: SREvent) => void) | null; onerror: ((e: SRErrorEvent) => void) | null;
      onend: (() => void) | null; start(): void; stop(): void; }
    const win = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const SpeechRecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError("Speech recognition is not supported in this browser. You can type your plan below.");
      return;
    }
    const selected = languages.find((l) => l.code === language) ?? languages[0];
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = selected?.stt_code ?? "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    setTranscript("");
    setError(null);
    recognition.onresult = (event: SREvent) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
    };
    recognition.onerror = (event: SRErrorEvent) => {
      setError(`Speech recognition error: ${event.error}`);
    };
    recognition.onend = () => { recogRef.current = null; };
    recognition.start();
    recogRef.current = recognition;
  }

  function stopListening() {
    const r = recogRef.current as { stop?: () => void } | null;
    r?.stop?.();
    recogRef.current = null;
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    const selected = languages.find((l) => l.code === language) ?? languages[0];
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = selected?.tts_code ?? "en-US";
    utter.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  }

  function stopSpeaking() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  async function planNow() {
    if (!transcript.trim()) return;
    setBusy(true); setError(null);
    try {
      const r = (await voicePlan(transcript.trim(), language)) as VoicePlanResult;
      setResult(r);
      setShowDetails(false);
      const summary = r.voice_summary || r.assistant_message;
      if (summary) speak(summary);
      onPlanResult?.(r as unknown as Record<string, unknown>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Voice plan failed.");
    } finally { setBusy(false); }
  }

  // BUGFIX (Bug 2): this used to render `JSON.stringify(result)` straight
  // into a <pre> block. The backend already returns a conversational
  // `voice_summary` / `assistant_message` -- we now show that as the
  // headline, with a friendly, collapsible summary card underneath
  // instead of exposing the raw API payload.
  const speakableText = result?.voice_summary || result?.assistant_message;

  return (
    <div className="glass-panel rounded-2xl p-5 space-y-4 rise-in">
      <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
        <Volume2 size={13} className="text-amber" /> Voice AI Assistant
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Languages size={12} className="text-amber" />
        <select value={language} onChange={(e) => setLanguage(e.target.value)}
          className="bg-panel border border-line rounded-lg px-2 py-1 text-xs">
          {languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>

        {!recogRef.current ? (
          <button onClick={startListening}
            className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber to-amberDim text-ink font-semibold flex items-center gap-1.5">
            <Mic size={12} /> Listen
          </button>
        ) : (
          <button onClick={stopListening}
            className="text-xs px-3 py-1.5 rounded-lg bg-alert text-white font-semibold flex items-center gap-1.5">
            <MicOff size={12} /> Stop
          </button>
        )}

        <button onClick={planNow} disabled={busy || !transcript.trim()}
          className="text-xs px-3 py-1.5 rounded-lg border border-amber text-amber disabled:opacity-50">
          {busy ? "Planning…" : "Plan from voice"}
        </button>

        {speaking ? (
          <button onClick={stopSpeaking}
            className="text-xs px-3 py-1.5 rounded-lg border border-line text-mist flex items-center gap-1.5">
            <Square size={11} /> Stop voice
          </button>
        ) : speakableText ? (
          <button onClick={() => speak(speakableText)}
            className="text-xs px-3 py-1.5 rounded-lg border border-line text-mist flex items-center gap-1.5">
            <Play size={11} /> Speak summary
          </button>
        ) : null}
      </div>

      <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)}
        rows={3}
        placeholder="Speak or type: 'Plan a Goa honeymoon trip for 4 days under 30,000 rupees'"
        className="w-full bg-panel border border-line rounded-lg px-3 py-2 text-sm" />

      {error && <p className="text-xs text-alert">{error}</p>}

      {result && (
        <div className="rounded-xl border border-line bg-panel/60 p-4 space-y-3">
          {/* Conversational headline -- never raw JSON */}
          <p className="text-sm leading-relaxed">
            {speakableText || `Here's your trip to ${result.destination || "your destination"}.`}
          </p>

          {(result.destination || result.total_cost !== undefined) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {result.destination && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber/10 text-amber border border-amber/20">
                  <MapPin size={11} /> {result.destination}
                </span>
              )}
              {result.total_cost !== undefined && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-panel2 border border-line text-mist">
                  <Wallet size={11} /> ₹{result.total_cost?.toLocaleString("en-IN")}
                  {result.budget !== undefined && ` of ₹${result.budget.toLocaleString("en-IN")}`}
                </span>
              )}
              {result.hotel?.name && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-panel2 border border-line text-mist">
                  <Hotel size={11} /> {result.hotel.name}
                </span>
              )}
              {(result.flight?.airline || result.flight?.label) && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-panel2 border border-line text-mist">
                  <Plane size={11} /> {result.flight.airline || result.flight.label}
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex items-center gap-1 text-xs text-mist2 hover:text-amber transition"
          >
            <ChevronDown size={12} className={`transition-transform ${showDetails ? "rotate-180" : ""}`} />
            {showDetails ? "Hide details" : "Show trip details"}
          </button>

          {showDetails && (
            <div className="space-y-2 pt-1 border-t border-line/60">
              {result.attractions && result.attractions.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-mist2 mb-1 mt-2">Things to do</p>
                  <ul className="text-xs text-mist list-disc list-inside space-y-0.5">
                    {result.attractions.slice(0, 6).map((a, i) => (
                      <li key={i}>{typeof a === "string" ? a : a.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.action_log && result.action_log.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-mist2 mb-1 mt-2">How the agent got here</p>
                  <ul className="text-xs text-mist2 space-y-0.5">
                    {result.action_log.slice(0, 8).map((entry, i) => (
                      <li key={i}>• {entry.step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
