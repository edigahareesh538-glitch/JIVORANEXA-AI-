"use client";

import { useRef, useState } from "react";
import { ImageIcon, X, Plane, TrainFront, Bus, Car, KeyRound } from "lucide-react";
import { VoiceInputButton } from "@/components/VoiceInput";
import { TransportMode } from "@/lib/api";

const EXAMPLES = [
  "I want to go to Charminar under ₹15,000 for 2 days",
  "Plan a Delhi trip under ₹18,000 for 2 days",
  "Show me a Goa trip for 4 days under ₹25,000",
  "I love beaches, suggest a honeymoon under ₹15,000",
];

const MODES: { id: TransportMode; label: string; icon: React.ElementType }[] = [
  { id: "flight", label: "Flight", icon: Plane },
  { id: "train", label: "Train", icon: TrainFront },
  { id: "bus", label: "Bus", icon: Bus },
  { id: "own_vehicle", label: "Own Vehicle", icon: Car },
  { id: "rental_car", label: "Rental Car", icon: KeyRound },
];

export default function TripForm({
  onSubmit,
  onSubmitImage,
  busy,
}: {
  onSubmit: (text: string, transportMode: TransportMode) => void;
  onSubmitImage: (file: File, message: string, transportMode: TransportMode) => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [transportMode, setTransportMode] = useState<TransportMode>("flight");
  const [travelDate, setTravelDate] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(file: File | undefined) {
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImage(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dateSuffix = travelDate
      ? ` on ${new Date(travelDate).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}`
      : "";
    const fullText = (text.trim() + dateSuffix).trim();

    if (image) {
      onSubmitImage(image, fullText, transportMode);
    } else if (fullText) {
      onSubmit(fullText, transportMode);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rise-in">
      <label className="text-xs uppercase tracking-[0.2em] text-mist">How are you travelling?</label>
      <div className="mt-2 flex flex-wrap gap-2">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTransportMode(id)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition ${
              transportMode === id
                ? "bg-amber text-ink border-amber font-semibold glow-amber"
                : "border-line text-mist hover:text-amber hover:border-amber/50"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <label className="text-xs uppercase tracking-[0.2em] text-mist mt-4 block">Goal</label>

      {preview && (
        <div className="mt-2 flex items-center gap-3 bg-panel border border-line rounded-xl px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Uploaded place" className="h-12 w-12 rounded object-cover" />
          <p className="text-xs text-mist flex-1">
            Photo attached — the agent will identify this place and plan a trip to it.
          </p>
          <button
            type="button"
            onClick={clearImage}
            className="p-1 rounded hover:bg-line transition"
            aria-label="Remove photo"
          >
            <X size={16} className="text-mist" />
          </button>
        </div>
      )}

      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            image
              ? "Optional: add budget/duration, e.g. under ₹20,000 for 3 days"
              : "Search any place, e.g. Charminar, Delhi, Goa trip under ₹25,000"
          }
          className="flex-1 bg-panel border border-line rounded-xl px-4 py-3 text-sm outline-none focus:border-amber transition-colors placeholder:text-mist/50"
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Upload a photo of a place — 'I want to go to this place'"
          className="px-3.5 py-3 rounded-xl bg-panel border border-line text-mist hover:text-amber hover:border-amber/50 transition"
        >
          <ImageIcon size={18} />
        </button>

        <VoiceInputButton onTranscript={(t) => setText(t)} />

        <button
          disabled={busy || (!text.trim() && !image)}
          className="px-5 py-3 rounded-xl bg-amber text-ink font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
        >
          {busy ? "Planning…" : "Search & Plan"}
        </button>
      </div>

      <div className="mt-4">
        <label className="text-xs uppercase tracking-[0.2em] text-mist block">Travel date (optional)</label>
        <input
          type="date"
          min={new Date().toISOString().split("T")[0]}
          value={travelDate}
          onChange={(e) => setTravelDate(e.target.value)}
          className="mt-2 w-full bg-panel border border-line rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber text-white"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            type="button"
            key={ex}
            onClick={() => setText(ex)}
            className="text-xs px-3 py-1.5 rounded-full border border-line text-mist hover:text-amber hover:border-amber/50 transition"
          >
            {ex}
          </button>
        ))}
      </div>
    </form>
  );
}
