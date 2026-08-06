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
            "note": "Translation needs GEMINI_API_KEY configured."
        }
    
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        # Switched from gemini-1.5-flash to gemini-pro for universal compatibility
        model = genai.GenerativeModel("gemini-pro")
        prompt = f"Translate the following text into language code '{req.target_language}'. Reply with ONLY the translated text, no extra notes or quotes:\n\n{req.text}"
        resp = model.generate_content(prompt)
        translated_text = resp.text.strip() if resp and resp.text else req.text
        return {
            "original": req.text, 
            "translated": translated_text, 
            "target_language": req.target_language
        }
    except Exception as e:
        print(f"Translation error: {e}")
        return {
            "original": req.text,
            "translated": req.text,
            "error": str(e)
        }
