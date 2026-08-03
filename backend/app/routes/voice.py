"""Voice AI route — Phase 9.

The browser handles speech-to-text and text-to-speech via the Web Speech
API (see `frontendbest/components/VoiceInput.tsx`). This endpoint wires
those transcripts back into the planning workflow:

- POST /api/voice/transcribe  – echoes the recognised text + optional
   language tag so the frontend can confirm transcript correctness.
- POST /api/voice/plan        – same shape as /api/plan but accepts a
   transcript, detects language, and adds voice-narration metadata.
- GET  /api/voice/languages    – list of languages supported by the STT/TTS
   models. Pure data; lets the UI render the language picker.
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.memory.session import get_or_resume
from app.memory.state import memory_store
from app.workflow.executor import run_trip_planner

router = APIRouter(prefix="/api/voice", tags=["voice"])

SUPPORTED_LANGUAGES = [
    {"code": "en", "label": "English",  "tts_code": "en-US", "stt_code": "en-US"},
    {"code": "hi", "label": "Hindi",    "tts_code": "hi-IN", "stt_code": "hi-IN"},
    {"code": "te", "label": "Telugu",   "tts_code": "te-IN", "stt_code": "te-IN"},
    {"code": "ta", "label": "Tamil",    "tts_code": "ta-IN", "stt_code": "ta-IN"},
    {"code": "kn", "label": "Kannada",  "tts_code": "kn-IN", "stt_code": "kn-IN"},
    {"code": "ml", "label": "Malayalam","tts_code": "ml-IN", "stt_code": "ml-IN"},
    {"code": "bn", "label": "Bengali",  "tts_code": "bn-IN", "stt_code": "bn-IN"},
    {"code": "mr", "label": "Marathi",  "tts_code": "mr-IN", "stt_code": "mr-IN"},
    {"code": "gu", "label": "Gujarati", "tts_code": "gu-IN", "stt_code": "gu-IN"},
    {"code": "es", "label": "Spanish",  "tts_code": "es-ES", "stt_code": "es-ES"},
    {"code": "fr", "label": "French",   "tts_code": "fr-FR", "stt_code": "fr-FR"},
    {"code": "de", "label": "German",   "tts_code": "de-DE", "stt_code": "de-DE"},
]


class TranscribeIn(BaseModel):
    transcript: str
    language: str = "en"
    confidence: float | None = None


@router.post("/transcribe")
def transcribe(req: TranscribeIn):
    return {
        "transcript": req.transcript,
        "language": req.language,
        "confidence": req.confidence,
        "ready_for_planning": bool(req.transcript.strip()),
        "tts_code": next((l["tts_code"] for l in SUPPORTED_LANGUAGES if l["code"] == req.language), "en-US"),
        "stt_code": next((l["stt_code"] for l in SUPPORTED_LANGUAGES if l["code"] == req.language), "en-US"),
    }


class VoicePlanIn(BaseModel):
    transcript: str
    language: str = "en"
    session_id: str | None = None
    transport_mode: Literal["flight", "train", "bus", "own_vehicle", "rental_car"] | None = None


@router.post("/plan")
def voice_plan(req: VoicePlanIn):
    """Voice planning endpoint — runs the same workflow as /api/plan but
    adds a voice-friendly summary (short, conversational) the TTS will read."""
    session_id, _ = get_or_resume(req.session_id)
    result = run_trip_planner(
        session_id,
        req.transcript,
        transport_mode_override=req.transport_mode,
    )
    state = memory_store.get(session_id)
    plan = state.get("results", {}).get("generate_itinerary", {})
    voice_summary = _build_voice_summary(plan, req.language)
    return {**result, "voice_summary": voice_summary, "language": req.language,
            "session_id": session_id, "transcript": req.transcript}


@router.get("/languages")
def languages():
    return {"languages": SUPPORTED_LANGUAGES, "default": "en"}


def _build_voice_summary(plan: dict, language: str) -> str:
    destination = plan.get("destination", "your destination")
    budget = plan.get("budget", 0)
    total = plan.get("total_cost", 0)
    transport = (plan.get("flight") or {}).get("mode", "travel")
    hotel = (plan.get("hotel") or {}).get("name", "a hotel")
    nights_text = ""
    if language.startswith("hi"):
        return (f"{destination} के लिए आपकी यात्रा तैयार है। कुल लागत {total} रुपये है। "
                f"हवाई/परिवहन {transport} से होगी और होटल {hotel} में रहेगा।")
    if language == "es":
        return (f"Tu viaje a {destination} está listo. Costo total {total}. "
                f"Transporte en {transport} y hotel en {hotel}.")
    return (f"Your trip to {destination} is ready. Total {total} rupees, "
            f"transport {transport}, hotel {hotel}. Say 'book it' to continue.")
