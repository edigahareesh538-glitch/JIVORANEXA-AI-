import { PlaceInfo } from "@/lib/api";

export default function PlaceInfoCard({ info }: { info: PlaceInfo }) {
  return (
    <div className="bg-panel border border-line rounded-xl p-4 rise-in">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-[0.2em] text-mist">Recognized From Your Photo</p>
        {info.mock_mode && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber/10 text-amber">
            demo mode
          </span>
        )}
      </div>
      <h3 className="font-display text-lg font-semibold">
        {info.place} <span className="text-mist font-normal text-sm">— {info.city}, {info.country}</span>
      </h3>
      <p className="text-sm text-mist mt-2 leading-relaxed">{info.description}</p>
      {info.mock_mode && (
        <p className="text-xs text-mist/60 mt-3">
          This result is coming from demo mode, so landmark matching can be wrong for real photos.
          Add `GEMINI_API_KEY` and set `USE_MOCK_LLM=false` in the backend for actual photo recognition.
        </p>
      )}
    </div>
  );
}
