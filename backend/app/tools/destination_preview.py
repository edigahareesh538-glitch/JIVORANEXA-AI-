"""Destination Preview Tool (Google-Travel-style card).

Combines existing tools (weather, attractions, distance/ETA, crowd) into
one heuristic "preview" of a destination before the user commits to full
planning. Rating and best-season are deterministic heuristics (seeded off
the destination name) rather than real review data -- labeled as such.
"""
import hashlib

from app.tools.weather import get_weather
from app.tools.maps import get_attractions
from app.tools.crowd import predict_crowd
from app.tools.geocode import resolve_place, get_distance_eta
from app.tools.budget_planner import plan_budget

HILL_STATIONS = {"manali", "shimla", "ooty", "munnar", "darjeeling", "coorg", "mussoorie"}
BEACH_DESTINATIONS = {"goa", "pondicherry", "gokarna", "andaman", "kovalam"}


def _seeded_rating(destination: str) -> float:
    """Deterministic 4.0-4.9 'rating' so the same place always shows the
    same number in a demo, without pretending to be real review data."""
    h = int(hashlib.sha256(destination.lower().encode()).hexdigest(), 16)
    return round(4.0 + (h % 10) / 10, 1)


def _best_season(destination: str) -> str:
    key = destination.split(",")[0].strip().lower()
    if key in HILL_STATIONS:
        return "Mar-Jun & Sep-Nov (pleasant, avoid peak monsoon)"
    if key in BEACH_DESTINATIONS:
        return "Nov-Feb (cool, dry season)"
    return "Oct-Mar (post-monsoon, cooler across most of India)"


def get_destination_preview(destination: str, current_location: dict | None = None) -> dict:
    center = resolve_place(destination)
    weather = get_weather(destination)
    attractions = get_attractions(destination, weather["condition"])
    crowd = predict_crowd(destination)
    budget_estimate = plan_budget(15000, duration_days=3, destination=destination)  # typical 3-day trip

    distance = None
    if center and current_location and current_location.get("lat") is not None:
        eta = get_distance_eta(
            {"lat": current_location["lat"], "lng": current_location["lng"]},
            {"lat": center["lat"], "lng": center["lng"]},
        )
        distance = eta

    return {
        "destination": center["label"] if center else destination,
        "rating": _seeded_rating(destination),
        "rating_note": "Illustrative score -- not sourced from real reviews yet.",
        "famous_places": attractions,
        "best_season": _best_season(destination),
        "weather_now": weather,
        "crowd_now": {"level": crowd["level"], "advice": crowd["advice"]},
        "distance_from_you": distance,
        "estimated_cost_3_days": budget_estimate["allocations"],
        "estimated_total_3_days": sum(budget_estimate["allocations"].values()),
    }
