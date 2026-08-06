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
            "translated": f"[{req.target_language}] {req.text}", 
            "note": "Translation running in mock mode."
        }
    
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        # Try multiple modern models sequentially until one works
        models_to_try = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"]
        resp = None
        used_model = None
        last_err = None
        
        for m_name in models_to_try:
            try:
                model = genai.GenerativeModel(m_name)
                prompt = f"Translate the following text into language code '{req.target_language}'. Reply with ONLY the translated text, no extra notes or quotes:\n\n{req.text}"
                resp = model.generate_content(prompt)
                if resp and resp.text:
                    used_model = m_name
                    break
            except Exception as ex:
                last_err = ex
                continue
        
        if not resp or not resp.text:
            raise last_err or Exception("All Gemini models failed to generate content.")

        return {
            "original": req.text, 
            "translated": resp.text.strip(), 
            "target_language": req.target_language,
            "model_used": used_model
        }
    except Exception as e:
        print(f"Translation error: {e}")
        return {
            "original": req.text,
            "translated": f"[{req.target_language}] {req.text}",
            "error": str(e)
        }
