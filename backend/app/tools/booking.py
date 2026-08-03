"""Booking Tool - hotel search + booking simulation.

Hotel names try to come from nearby real hotels via OpenStreetMap so the UI
feels more grounded even without a paid hotel API.
"""
import random
import hashlib
from app.tools.geocode import find_nearby_places, resolve_place

HOTELS = [
    {"name": "Budget Inn", "price_per_night": 900},
    {"name": "Comfort Stay", "price_per_night": 1600},
    {"name": "Grand Residency", "price_per_night": 3200},
]


def search_hotels(destination: str) -> list[dict]:
    center = resolve_place(destination, allow_fallback=False)
    if center:
        live_hotels = find_nearby_places(center, ["hotel"], limit=5, radius_m=6000)
        if live_hotels:
            results = []
            for item in live_hotels:
                seed = int(hashlib.md5(item["name"].encode()).hexdigest()[:6], 16)
                nightly = 1200 + (seed % 3500)
                results.append({"name": item["name"], "price_per_night": nightly})
            return sorted(results, key=lambda h: h["price_per_night"])
    return sorted(HOTELS, key=lambda h: h["price_per_night"])


def book(hotel: dict, simulate_failure_rate: float = 0.2) -> dict:
    """Simulates a flaky booking API so the Retry & Error Handler has
    something real to do. Deterministic-ish via random but bounded."""
    if random.random() < simulate_failure_rate:
        return {"status": "failed", "reason": "timeout"}
    return {"status": "confirmed", "hotel": hotel["name"], "confirmation_id": f"BK{random.randint(1000,9999)}"}
