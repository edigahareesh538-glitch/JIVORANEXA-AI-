"""Weather Tool - calls OpenWeather if key present, else mock.
Phase 8: weather timeline (next N hours/days), rain-prediction, AQI + UV
heuristics, weather alerts, AI itinerary re-planning suggestions and
indoor-activity recommendations.
"""
from __future__ import annotations

import math
import random
from datetime import datetime, timedelta

import httpx

from app.services.config import settings


def _openweather_current(destination: str) -> dict | None:
    if not settings.OPENWEATHER_API_KEY:
        return None
    try:
        with httpx.Client(timeout=5.0, follow_redirects=True) as client:
            resp = client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"q": destination, "appid": settings.OPENWEATHER_API_KEY, "units": "metric"},
            )
            resp.raise_for_status()
            data = resp.json()
        condition = data["weather"][0]["main"].lower()
        return {"condition": "rain" if "rain" in condition else condition,
                "temp_c": data["main"]["temp"], "source": "live"}
    except Exception:
        return None


def _openweather_aqi(lat: float, lng: float) -> dict | None:
    """OpenWeather AQI only works for lat/lng, so try that; on miss we
    fall back to a deterministic local function so the API stays keyless."""
    if not settings.OPENWEATHER_API_KEY:
        return None
    try:
        with httpx.Client(timeout=5.0, follow_redirects=True) as client:
            resp = client.get(
                "https://api.openweathermap.org/data/2.5/air_pollution",
                params={"lat": lat, "lon": lng, "appid": settings.OPENWEATHER_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()
        aqi_index = data["list"][0]["main"]["aqi"]  # 1..5
        labels = {1: "Good", 2: "Fair", 3: "Moderate", 4: "Poor", 5: "Very Poor"}
        return {"aqi_index": aqi_index, "label": labels.get(aqi_index, "Unknown"),
                "source": "live"}
    except Exception:
        return None


def _mock_current(destination: str) -> dict:
    rng = random.Random(destination)
    return {"condition": rng.choice(["clear", "clear", "clouds", "rain"]),
            "temp_c": round(rng.uniform(22, 34), 1), "source": "mock"}


def get_weather(destination: str, lat: float | None = None, lng: float | None = None) -> dict:
    """Preserved entry — still returns condition + temp. New keys: source +
    timeline + aqi + uv + alerts + indoor_activities."""
    current = _openweather_current(destination) or _mock_current(destination)
    return {
        **current,
        "uv_index": _uv_index(current["temp_c"], current["condition"]),
        "timeline": _timeline(destination, hours=24),
        "rain_next_24h_mm": round(_rain_probability(destination) * 8, 1),
        "rain_probability_pct": int(_rain_probability(destination) * 100),
        "aqi": _aqi_for(lat, lng),
        "alerts": _weather_alerts(current),
        "indoor_activities": _indoor_activities(current),
        "ai_replan": _ai_itinerary_replan(current),
    }


def _uv_index(temp_c: float, condition: str) -> dict:
    """Rough UV index heuristic — high on clear + hot days."""
    if "rain" in condition or "cloud" in condition:
        uv = 2
    elif temp_c >= 33:
        uv = 9
    elif temp_c >= 28:
        uv = 7
    else:
        uv = 5
    if uv <= 2:
        label, advice = "Low", "No protection needed."
    elif uv <= 5:
        label, advice = "Moderate", "Sunscreen recommended."
    elif uv <= 7:
        label, advice = "High", "SPF 30+, hat, sunglasses."
    else:
        label, advice = "Very High", "Avoid midday sun; reapply sunscreen every 2h."
    return {"index": uv, "label": label, "advice": advice}


def _timeline(destination: str, hours: int = 24) -> list[dict]:
    rng = random.Random(destination + "-timeline")
    out = []
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    base_temp = round(rng.uniform(22, 33), 1)
    for h in range(hours + 1):
        ts = now + timedelta(hours=h)
        swing = math.sin(h / 24.0 * math.pi) * 4
        temp = round(base_temp + swing, 1)
        cond = rng.choices(["clear", "clouds", "rain"], weights=[5, 3, 2])[0]
        out.append({"datetime": ts.strftime("%Y-%m-%dT%H:00:00Z"),
                    "condition": cond, "temp_c": temp,
                    "rain_pct": 80 if cond == "rain" else (30 if cond == "clouds" else 5)})
    return out


def _rain_probability(destination: str) -> float:
    rng = random.Random(destination + "-rain")
    return rng.choice([0.1, 0.2, 0.35, 0.55, 0.8])


def _aqi_for(lat: float | None, lng: float | None) -> dict:
    """Live if key + coords; else deterministic seasonal fallback."""
    if lat is not None and lng is not None:
        live = _openweather_aqi(lat, lng)
        if live:
            return live
    rng = random.Random(f"{round(lat or 0, 1)}-{round(lng or 0, 1)}-aqi")
    idx = rng.choice([1, 2, 2, 3, 3, 4])
    labels = {1: "Good", 2: "Fair", 3: "Moderate", 4: "Poor"}
    return {"aqi_index": idx, "label": labels[idx], "source": "heuristic"}


def _weather_alerts(current: dict) -> list[dict]:
    alerts = []
    if "rain" in current.get("condition", ""):
        alerts.append({"severity": "warning", "title": "Heavy rain expected",
                       "message": "Carry rain gear; outdoor activities may be cancelled."})
    if current.get("temp_c", 0) >= 36:
        alerts.append({"severity": "warning", "title": "Heat wave",
                       "message": "Stay hydrated, plan indoor breaks between noon–4 PM."})
    if not alerts:
        alerts.append({"severity": "info", "title": "All clear",
                       "message": "No severe weather expected for your trip."})
    return alerts


def _indoor_activities(current: dict) -> list[str]:
    base = ["Museums and art galleries", "Local food halls", "Shopping malls",
            "Cinema / theatre", "Spa or wellness centre"]
    if "rain" in current.get("condition", ""):
        base.insert(0, "Covered attractions + cafes")
    if current.get("temp_c", 0) >= 33:
        base.insert(0, "Air-conditioned exhibits (avoid outdoor midday)")
    return base


def _ai_itinerary_replan(current: dict) -> dict:
    """A small, deterministic itinerary-replan generator keyed on weather."""
    condition = (current.get("condition") or "").lower()
    if "rain" in condition:
        return {
            "headline": "Rain expected — flipping day order",
            "actions": [
                "Move outdoor sightseeing to late afternoon (after 4 PM).",
                "Schedule museums, galleries, and food walks in the morning.",
                "Avoid boating, treks, or open-deck experiences.",
                "Keep electronics in a waterproof pouch.",
            ],
            "swap_attractions": True,
        }
    if "cloud" in condition:
        return {
            "headline": "Overcast — great for full-day outdoor plans",
            "actions": [
                "Excellent photography light throughout the day.",
                "Wear light layers for cooler moments.",
                "Keep a compact umbrella as backup.",
            ],
            "swap_attractions": False,
        }
    if current.get("temp_c", 0) >= 33:
        return {
            "headline": "Hot day — split into early + late outdoor slots",
            "actions": [
                "Outdoor activities before 11 AM or after 4 PM only.",
                "Midday indoor slot: museums, cafes, malls.",
                "Carry sunscreen, water, and electrolytes.",
            ],
            "swap_attractions": True,
        }
    return {
        "headline": "Clear skies — keep plan as-is",
        "actions": ["Great conditions for outdoor sightseeing all day."],
        "swap_attractions": False,
    }


def get_weather_advice(condition: str, temp_c: float | None = None) -> dict:
    """AI Weather Planner: turns a raw condition into concrete actions.
    Preserved exactly so existing callers keep working."""
    condition = (condition or "").lower()

    if "rain" in condition:
        return {
            "condition": condition,
            "headline": "Rain expected -- plan around it",
            "actions": [
                "Bring an umbrella or raincoat",
                "Avoid boating, water sports, or open-air treks today",
                "Visit indoor spots first: museums, galleries, malls",
                "Push outdoor sightseeing to after ~4 PM if rain clears",
                "Keep electronics in a waterproof pouch",
            ],
        }
    if "cloud" in condition:
        return {
            "condition": condition,
            "headline": "Overcast -- good for full-day outdoor plans",
            "actions": [
                "Great light for outdoor photography, less harsh sun",
                "Carry a light layer for cooler moments",
                "Still keep a compact umbrella as backup",
            ],
        }
    hot = temp_c is not None and temp_c >= 33
    actions = [
        "Sunny day -- sunscreen and sunglasses recommended",
        "Stay hydrated, carry a water bottle",
    ]
    if hot:
        actions.insert(0, "High heat expected -- plan outdoor activities before 11 AM or after 4 PM")
    else:
        actions.append("Good conditions for outdoor sightseeing all day")
    return {"condition": condition, "headline": "Clear skies", "actions": actions}
