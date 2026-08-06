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
        
        # Automatically find a model that supports generateContent for this API key
        model_name = "gemini-1.5-flash"
        try:
            for m in genai.list_models():
                if "generateContent" in m.supported_generation_methods:
                    model_name = m.name.replace("models/", "")
                    break
        except Exception:
            pass

        model = genai.GenerativeModel(model_name)
        prompt = f"Translate the following text into language code '{req.target_language}'. Reply with ONLY the translated text, no extra notes or quotes:\n\n{req.text}"
        resp = model.generate_content(prompt)
        translated_text = resp.text.strip() if resp and resp.text else req.text
        
        return {
            "original": req.text, 
            "translated": translated_text, 
            "target_language": req.target_language,
            "model_used": model_name
        }
    except Exception as e:
        print(f"Translation error: {e}")
        return {
            "original": req.text,
            "translated": req.text,
            "error": str(e)
        }
