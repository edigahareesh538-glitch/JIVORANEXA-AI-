"""Smart Weather route — Phase 8 surface.

Exposes the weather tool over HTTP so the frontend weather panel can render
live timeline, rain prediction, AQI, UV, alerts and indoor recommendations.
"""
from fastapi import APIRouter, Query
from app.tools.weather import get_weather, get_weather_advice

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("")
def current(destination: str, lat: float | None = Query(default=None),
             lng: float | None = Query(default=None), hours: int = 24):
    out = get_weather(destination, lat=lat, lng=lng)
    # Keep timeline length responsive to the slide-rule widget on the UI.
    out["timeline"] = out["timeline"][: max(1, hours + 1)]
    return out


@router.get("/advice")
def advice(condition: str, temp_c: float | None = None):
    return get_weather_advice(condition, temp_c)


@router.get("/forecast")
def forecast(destination: str, days: int = 3):
    """Multi-day forecast summary. We piggy-back get_weather() so we can
    return the same shape across days without a second upstream call."""
    daily = []
    for d in range(days):
        sample = get_weather(f"{destination} d{d+1}")
        daily.append({
            "day": d + 1,
            "condition": sample["condition"],
            "temp_c": sample["temp_c"],
            "rain_pct": sample["rain_probability_pct"],
            "headline": sample["ai_replan"]["headline"],
        })
    return {"destination": destination, "days": daily}
