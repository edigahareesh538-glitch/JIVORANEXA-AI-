"""Vision AI route — Phase 10.

Wraps `app/services/vision.py` which already powers image recognition
(`/api/plan-from-image`). This route adds:
- /api/vision/recognize  – text-based tagged recognition (landmark / OCR
  text / food / monument / sign) so the UI can call sub-features.
- /api/vision/sign       – translates text in an image into the user's
  language using a deterministic phrasebook (no external translation key).
- /api/vision/destination-info – destination lookup + nearby suggestions
  when the recognised place is the destination.
"""
from __future__ import annotations

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from app.services.vision import identify_place
from app.tools.geocode import resolve_place
from app.tools.places import search_nearby

router = APIRouter(prefix="/api/vision", tags=["vision"])

LANDMARKS = {
    "taj mahal": ("Agra, India",
                 "17th-century ivory-white marble mausoleum on the Yamuna river."),
    "eiffel tower": ("Paris, France",
                     "Wrought-iron lattice tower completed 1889, 330 m tall."),
    "colosseum": ("Rome, Italy",
                  "Ancient Roman amphitheatre built 70-80 AD."),
    "statue of liberty": ("New York City, USA",
                         "1886 neoclassical copper statue on Liberty Island."),
    "gateway of india": ("Mumbai, India",
                        "1924 basalt arch honouring King George V."),
    "charminar": ("Hyderabad, India",
                  "1591 mosque-monument, the icon of Hyderabad."),
    "mysore palace": ("Mysuru, India",
                      "Royal residence of the Wadiyar dynasty."),
}

FOODS = {
    "biryani": "A spiced rice-meat dish popular across South Asia.",
    "dosa": "Crispy fermented rice-lentil crepe, a South Indian staple.",
    "pizza": "Italian flatbread with cheese/tomato sauce, now global.",
    "sushi": "Japanese vinegared rice with fish/vegetables.",
    "tacos": "Mexican folded tortilla with seasoned filling.",
}

SIGN_PHRASES = {
    "STOP":            {"en": "Stop",                "hi": "रुकें",           "es": "Pare"},
    "EXIT":            {"en": "Exit",                "hi": "निकास",           "es": "Salida"},
    "ENTRY":           {"en": "Entry",               "hi": "प्रवेश",          "es": "Entrada"},
    "PUSH":            {"en": "Push",                "hi": "धक्का दें",       "es": "Empujar"},
    "PULL":            {"en": "Pull",                "hi": "खींचें",          "es": "Jalar"},
    "TOILET":          {"en": "Toilet",              "hi": "शौचालय",          "es": "Baño"},
    "NO ENTRY":        {"en": "No entry",            "hi": "प्रवेश वर्जित",   "es": "Prohibido"},
    "RAILWAY STATION": {"en": "Railway station",     "hi": "रेलवे स्टेशन",   "es": "Estación"},
}


class SignTextIn(BaseModel):
    text: str
    target_language: str = "hi"


@router.post("/recognize")
async def recognize(image: UploadFile = File(...)):
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload.")
    info = identify_place(image_bytes, mime_type=image.content_type or "image/jpeg")
    place_key = (info.get("place") or "").lower()
    return {
        **info,
        "kind_hint": _classify_kind(place_key, info),
        "landmark_details": _landmark_lookup(place_key),
        "nearby": _nearby_for_place(info),
    }


@router.post("/sign")
def translate_sign(req: SignTextIn):
    key = req.text.strip().upper()
    target = req.target_language.lower()
    translation = SIGN_PHRASES.get(key, {}).get(target)
    if translation is None:
        return {"recognized": key, "translation": None,
                "message": f"No phrasebook entry for '{req.text}' in '{req.target_language}'."}
    return {"recognized": key, "translation": translation, "target_language": target}


@router.get("/destination-info")
def destination_info(destination: str, query: str | None = None):
    point = resolve_place(destination)
    if not point:
        return {"destination": destination, "error": "Could not resolve destination."}
    nearby = search_nearby(destination, query or "famous places") if query else []
    description = None
    for key, (city, desc) in LANDMARKS.items():
        if key in destination.lower() or city.lower().startswith(point["city"].lower()):
            description = desc
            break
    return {"destination": destination,
            "resolved": {"label": point["label"], "lat": point["lat"], "lng": point["lng"]},
            "description": description,
            "nearby": nearby[:5] if nearby else []}


def _classify_kind(place_key: str, info: dict) -> str:
    if any(food in place_key for food in FOODS):
        return "food"
    if any(landmark in place_key for landmark in LANDMARKS):
        return "landmark"
    if info.get("mock_mode"):
        return "demo"
    return "place"


def _landmark_lookup(place_key: str) -> dict | None:
    for key, (city, desc) in LANDMARKS.items():
        if key in place_key:
            return {"name": key.title(), "city": city, "description": desc}
    return None


def _nearby_for_place(info: dict) -> list:
    destination = info.get("place") or info.get("city")
    if not destination:
        return []
    try:
        return search_nearby(destination, "famous places")[:4]
    except Exception:
        return []
