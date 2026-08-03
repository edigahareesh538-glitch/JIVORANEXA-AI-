"use client";

import { useRef, useState } from "react";
import { Mic, Volume2 } from "lucide-react";

// Minimal ambient typing for the Web Speech API (not in default TS lib.dom yet).
type SpeechRecognitionResultLike = { transcript: string };
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: { [i: number]: { [j: number]: SpeechRecognitionResultLike } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;
  return recognition;
}

/** Mic button: "Plan my Hyderabad trip" spoken -> fills the text input. */
export function VoiceInputButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => getRecognition() !== null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  function toggle() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = getRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      onTranscript(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    setListening(true);
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title="Voice input"
      className={`p-2 rounded border ${listening ? "border-alert text-alert animate-pulse" : "border-line text-mist hover:text-amber"}`}
    >
      <Mic size={16} />
    </button>
  );
}

/** Speaker button: reads a block of text aloud (e.g. the trip summary). */
export function VoiceOutputButton({ text }: { text: string }) {
  const [supported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);

  function speak() {
    if (!supported || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    window.speechSynthesis.speak(utterance);
  }

  if (!supported) return null;

  return (
    <button type="button" onClick={speak} title="Read aloud" className="p-2 rounded border border-line text-mist hover:text-amber">
      <Volume2 size={16} />
    </button>
  );
}
