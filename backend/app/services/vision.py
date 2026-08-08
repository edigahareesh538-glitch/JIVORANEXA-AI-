"""Vision Service - identifies a place/landmark from an uploaded photo.

Real implementation uses Gemini's multimodal vision (image + text prompt)
when GEMINI_API_KEY is set. Falls back to a deterministic mock (same
photo always resolves to the same demo landmark) so the whole "upload
a photo, plan a trip to it" flow works without any API key.
"""
import hashlib
import json
from app.services.config import settings

_model = None
if not settings.USE_MOCK_LLM and settings.GEMINI_API_KEY:
    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)
    _model = genai.GenerativeModel("gemini-1.5-flash")

_MOCK_LANDMARKS = [
    {"place": "Taj Mahal", "city": "Agra", "country": "India",
     "description": "An ivory-white marble mausoleum built by Emperor Shah Jahan, one of the most recognizable monuments in the world."},
    
]


def _mock_identify(image_bytes: bytes) -> dict:
    h = int(hashlib.md5(image_bytes).hexdigest(), 16)
    landmark = _MOCK_LANDMARKS[h % len(_MOCK_LANDMARKS)]
    return {**landmark, "mock_mode": True}


def identify_place(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """Returns {place, city, country, description, mock_mode}."""
    if _model is None:
        return _mock_identify(image_bytes)

    try:
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(image_bytes))
        prompt = (
            "Analyze this image very carefully for a trip planner app. "
            "Look specifically for unique regional identifiers, license plates (e.g., TS for Telangana/Hyderabad, MH for Maharashtra/Mumbai), "
            "local signboards, or distinct monuments (like Charminar) to accurately identify the city. Do not confuse Hyderabad with Mumbai. "
            "Identify the famous place, landmark, or destination shown in this photo. "
            "Respond with ONLY valid JSON, no markdown fences, in this exact shape: "
            '{"place": "...", "city": "...", "country": "...", "description": "one or two sentence description"}'
        )
        resp = _model.generate_content([prompt, img])
        text = resp.text.strip().strip("`").replace("json\n", "")
        data = json.loads(text)
        data["mock_mode"] = False
        return data
    except Exception:
        # Any vision/parsing failure -> fall back to mock rather than crash the request.
        return _mock_identify(image_bytes)
