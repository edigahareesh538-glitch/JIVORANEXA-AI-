"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, Languages, MapPin, Upload, X, RefreshCcw, Landmark, UtensilsCrossed, Compass, ImageIcon } from "lucide-react";
import { getDestinationInfo, recognizeVision, translateSign } from "@/lib/api";
import { destinationPhoto } from "@/lib/destinations";

type VisionResult = {
  place?: string;
  city?: string;
  country?: string;
  description?: string;
  mock_mode?: boolean;
  kind_hint?: "food" | "landmark" | "demo" | "place";
  landmark_details?: { name?: string; city?: string; description?: string } | null;
  nearby?: Array<{ name?: string; category?: string; distance_km?: number }>;
};

type SignResult = {
  recognized?: string;
  translation?: string | null;
  target_language?: string;
  message?: string;
};

type DestinationResult = {
  destination?: string;
  error?: string;
  resolved?: { label?: string; lat?: number; lng?: number };
  description?: string | null;
  nearby?: Array<{ name?: string; category?: string; distance_km?: number }>;
};

export default function VisionAssistant() {
  const [imageResult, setImageResult] = useState<VisionResult | null>(null);
  const [signText, setSignText] = useState("");
  const [signLang, setSignLang] = useState("hi");
  const [signResult, setSignResult] = useState<SignResult | null>(null);
  const [destResult, setDestResult] = useState<DestinationResult | null>(null);
  const [destQuery, setDestQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Bug 4: upload UX state (drag & drop, preview, progress, retry) ----
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickFile(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPG, PNG, WEBP…).");
      return;
    }
    setError(null);
    setPendingFile(file);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    void runRecognition(file);
  }

  async function runRecognition(file: File) {
    setBusy(true); setError(null); setProgress(10);
    const ticker = window.setInterval(() => {
      setProgress((p) => (p < 85 ? p + Math.random() * 15 : p));
    }, 200);
    try {
      const result = (await recognizeVision(file)) as VisionResult;
      setProgress(100);
      setImageResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image recognition failed. You can try again.");
    } finally {
      window.clearInterval(ticker);
      setBusy(false);
      window.setTimeout(() => setProgress(0), 400);
    }
  }

  function removeImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    setImageResult(null);
    setError(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function retryUpload() {
    if (pendingFile) void runRecognition(pendingFile);
  }

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    pickFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function translate() {
    if (!signText.trim()) return;
    setBusy(true); setError(null);
    try { setSignResult(await translateSign(signText, signLang)); }
    catch (err) { setError(err instanceof Error ? err.message : "Sign translation failed."); }
    finally { setBusy(false); }
  }

  async function destination() {
    if (!destQuery.trim()) return;
    setBusy(true); setError(null);
    try { setDestResult(await getDestinationInfo(destQuery.trim())); }
    catch (err) { setError(err instanceof Error ? err.message : "Destination lookup failed."); }
    finally { setBusy(false); }
  }

  const kindLabel: Record<string, string> = {
    food: "Food", landmark: "Landmark", demo: "Demo recognition", place: "Place",
  };
  const KindIcon = imageResult?.kind_hint === "food" ? UtensilsCrossed
    : imageResult?.kind_hint === "landmark" ? Landmark
    : Compass;

  return (
    <div className="space-y-5 rise-in">
      {/* --- Upload card: drag & drop, preview, progress, remove, retry --- */}
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <Camera size={13} className="text-amber" /> Vision AI
        </p>
        <p className="text-sm text-mist2 mt-1">
          Upload a photo to identify landmarks, recognize food / monuments, and get nearby recommendations.
        </p>

        {!previewUrl ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-4 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition
              ${dragActive ? "border-amber bg-amber/5" : "border-line hover:border-amber/50"}`}
          >
            <ImageIcon className="mx-auto mb-2 text-mist2" size={26} />
            <p className="text-sm text-mist">Drag & drop a photo here, or click to browse</p>
            <p className="text-xs text-mist2 mt-1">JPG, PNG or WEBP, up to 10 MB</p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gradient-to-r from-amber to-amberDim text-ink font-semibold">
              <Upload size={13} /> Upload photo
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-line overflow-hidden relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Uploaded preview" className="w-full max-h-64 object-cover" />
            <div className="absolute top-2 right-2 flex gap-1.5">
              <button
                type="button"
                onClick={retryUpload}
                title="Retry recognition"
                className="h-8 w-8 rounded-lg bg-ink/70 backdrop-blur flex items-center justify-center text-white hover:text-amber transition"
              >
                <RefreshCcw size={14} />
              </button>
              <button
                type="button"
                onClick={removeImage}
                title="Remove image"
                className="h-8 w-8 rounded-lg bg-ink/70 backdrop-blur flex items-center justify-center text-white hover:text-alert transition"
              >
                <X size={14} />
              </button>
            </div>
            {(busy || progress > 0) && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                <div className="h-full bg-amber transition-all duration-200" style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
            )}
          </div>
        )}

        {busy && <p className="text-xs text-mist2 mt-2 flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-amber border-t-transparent animate-spin" /> Analyzing photo…</p>}
        {error && (
          <div className="mt-2 flex items-center gap-2">
            <p className="text-xs text-alert">{error}</p>
            {pendingFile && (
              <button onClick={retryUpload} className="text-xs text-amber underline">Retry</button>
            )}
          </div>
        )}
      </div>

      {/* --- Recognition result: human-readable card, never raw JSON --- */}
      {imageResult && (
        <div className="glass-panel rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-amber/10 text-amber flex items-center justify-center shrink-0">
              <KindIcon size={15} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-mist2">
                {kindLabel[imageResult.kind_hint || "place"]}
                {imageResult.mock_mode && " · demo recognition"}
              </p>
              <p className="text-base font-display font-semibold truncate">
                {imageResult.landmark_details?.name || imageResult.place || "Unrecognized image"}
              </p>
            </div>
          </div>

          {(imageResult.city || imageResult.country || imageResult.landmark_details?.city) && (
            <p className="text-xs text-mist2 flex items-center gap-1.5">
              <MapPin size={12} className="text-amber" />
              {imageResult.landmark_details?.city || [imageResult.city, imageResult.country].filter(Boolean).join(", ")}
            </p>
          )}

          {(imageResult.landmark_details?.description || imageResult.description) && (
            <p className="text-sm text-mist leading-relaxed">
              {imageResult.landmark_details?.description || imageResult.description}
            </p>
          )}

          {imageResult.nearby && imageResult.nearby.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-mist2 mb-1.5">Nearby places</p>
              <div className="flex flex-wrap gap-1.5">
                {imageResult.nearby.slice(0, 6).map((n, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-panel2 border border-line text-mist">
                    {n.name}{n.category ? ` · ${n.category}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- Sign / text translation --- */}
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <Languages size={13} className="text-amber" /> Sign / text translation
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={signText} onChange={(e) => setSignText(e.target.value)}
            placeholder="Text from a sign (e.g. ENTRY)"
            className="flex-1 bg-panel border border-line rounded-lg px-3 py-2 text-xs font-mono" />
          <select value={signLang} onChange={(e) => setSignLang(e.target.value)}
            className="bg-panel border border-line rounded-lg px-2 py-1 text-xs">
            <option value="hi">Hindi</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
          </select>
          <button onClick={translate} disabled={busy || !signText.trim()}
            className="text-xs px-3 py-2 rounded-lg bg-gradient-to-r from-amber to-amberDim text-ink font-semibold disabled:opacity-60">
            Translate
          </button>
        </div>
        {signResult && (
          <div className="mt-3 rounded-lg border border-line bg-panel/60 p-3">
            {signResult.translation ? (
              <p className="text-sm">
                <span className="text-mist2">&ldquo;{signResult.recognized}&rdquo; in {signResult.target_language} is</span>{" "}
                <span className="font-semibold text-amber">{signResult.translation}</span>
              </p>
            ) : (
              <p className="text-sm text-mist2">{signResult.message || "No translation found for that phrase yet."}</p>
            )}
          </div>
        )}
      </div>

      {/* --- Destination information --- */}
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <MapPin size={13} className="text-amber" /> Destination information
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={destQuery} onChange={(e) => setDestQuery(e.target.value)}
            placeholder="Place name (e.g. Taj Mahal)"
            className="flex-1 bg-panel border border-line rounded-lg px-3 py-2 text-xs" />
          <button onClick={destination} disabled={busy || !destQuery.trim()}
            className="text-xs px-3 py-2 rounded-lg bg-gradient-to-r from-amber to-amberDim text-ink font-semibold disabled:opacity-60">
            Look up
          </button>
        </div>
        {destResult && (
          <div className="mt-3 rounded-xl border border-line overflow-hidden">
            {destResult.error ? (
              <p className="text-sm text-alert p-3">{destResult.error}</p>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={destinationPhoto(destResult.resolved?.label || destResult.destination || "", 640, 220)} alt={destResult.destination} className="w-full h-36 object-cover" />
                <div className="p-3.5 space-y-2">
                  <p className="text-sm font-display font-semibold">{destResult.resolved?.label || destResult.destination}</p>
                  {destResult.description && <p className="text-sm text-mist leading-relaxed">{destResult.description}</p>}
                  {destResult.nearby && destResult.nearby.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {destResult.nearby.slice(0, 6).map((n, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-panel2 border border-line text-mist">
                          {n.name}{n.category ? ` · ${n.category}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
