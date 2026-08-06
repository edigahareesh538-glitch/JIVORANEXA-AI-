from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.config import settings

router = APIRouter(prefix="/api/translate", tags=["translate"])


class TranslateIn(BaseModel):
    text: str
    target_language: str  # e.g. "hi", "te", "ta", "es", "fr"


@router.post("")
def translate_text(req: TranslateIn):
    if not settings.GEMINI_API_KEY or settings.USE_MOCK_LLM:
        return {
            "original": req.text,
            "translated": f"[{req.target_language}] {req.text} (Mock)",
            "note": "Translation is using the mock fallback because GEMINI_API_KEY is not configured.",
        }

    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)

        models_to_try = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"]
        last_error: Exception | None = None
        used_model: str | None = None
        response = None

        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(model_name)
                prompt = (
                    f"Translate the following text into language code '{req.target_language}'. "
                    "Reply with ONLY the translated text, no extra notes or quotes:\n\n"
                    f"{req.text}"
                )
                response = model.generate_content(prompt)
                if getattr(response, "text", None):
                    used_model = model_name
                    break
            except Exception as exc:  # pragma: no cover - defensive fallback
                last_error = exc
                continue

        if not response or not getattr(response, "text", None):
            raise last_error or Exception("All Gemini models failed to generate content.")

        return {
            "original": req.text,
            "translated": response.text.strip(),
            "target_language": req.target_language,
            "model_used": used_model,
        }
    except Exception as exc:
        print(f"Translation error: {exc}")
        return {
            "original": req.text,
            "translated": f"[{req.target_language}] {req.text}",
            "error": str(exc),
        }
