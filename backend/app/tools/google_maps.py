"""Google Maps upgrade layer.

This sits ALONGSIDE the existing free OpenStreetMap/Overpass/OSRM stack in
app/tools/geocode.py -- it never replaces it. When GOOGLE_MAPS_API_KEY is
configured, callers get live traffic-aware ETA, alternative routes, transit
directions, and higher-quality Places results. When no key is configured
(or a call fails), every function here returns None and callers fall back
to the existing OSM-based path automatically, so nothing that already works
stops working.

Toll and fuel figures are clearly-labeled heuristic estimates (distance x a
configurable rate), not a live pricing feed -- Google's Directions/Routes
APIs do not return toll costs for India, and there is no free, reliable toll
API for Indian highways. This mirrors how app/tools/transport.py already
labels its train/bus/fuel estimates, per the project's "no undisclosed mocks"
rule.
"""
from __future__ import annotations

import httpx
from app.services.config import settings

DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"
PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"

# Heuristic, documented rates for toll/fuel estimates (India, mid-2020s
# ballpark figures). Override via env if you have better local data.
AVG_TOLL_RATE_PER_KM = {
    "driving": 1.75,   # ₹/km on a mix of highway + city roads
    "own_vehicle": 1.75,
    "rental_car": 1.75,
}
AVG_FUEL_RATE_PER_KM = 6.5   # ₹/km at ~15 km/l petrol and ~₹100/l
AVG_CYCLING_WALKING_TOLL = 0.0

_GOOGLE_MODE = {
    "driving": "driving",
    "walking": "walking",
    "cycling": "bicycling",
    "bicycling": "bicycling",
    "transit": "transit",
}


def is_configured() -> bool:
    return bool(settings.GOOGLE_MAPS_API_KEY)


def estimate_toll(distance_km: float, mode: str = "driving") -> dict:
    rate = AVG_TOLL_RATE_PER_KM.get(mode, 0.0) if mode in ("driving", "own_vehicle", "rental_car") else AVG_CYCLING_WALKING_TOLL
    return {
        "amount_inr": round(distance_km * rate),
        "basis": f"₹{rate}/km heuristic estimate -- no live Indian toll-pricing API exists; connect one for exact figures.",
    }


def estimate_fuel(distance_km: float, mode: str = "driving") -> dict:
    if mode not in ("driving", "own_vehicle", "rental_car"):
        return {"amount_inr": 0, "basis": "No fuel cost for this travel mode."}
    return {
        "amount_inr": round(distance_km * AVG_FUEL_RATE_PER_KM),
        "basis": f"₹{AVG_FUEL_RATE_PER_KM}/km heuristic estimate (~15 km/l @ ~₹100/l petrol).",
    }


def traffic_aware_route(origin: dict, destination: dict, mode: str = "driving") -> dict | None:
    """Live traffic ETA + up to 3 alternative routes via Google Directions API.
    Returns None if no API key is set or the call fails, so callers can fall
    back to the existing OSRM-based route builder.
    """
    if not is_configured():
        return None

    g_mode = _GOOGLE_MODE.get(mode, "driving")
    params = {
        "origin": f"{origin['lat']},{origin['lng']}",
        "destination": f"{destination['lat']},{destination['lng']}",
        "mode": g_mode,
        "alternatives": "true",
        "key": settings.GOOGLE_MAPS_API_KEY,
    }
    if g_mode == "driving":
        params["departure_time"] = "now"
        params["traffic_model"] = "best_guess"

    try:
        resp = httpx.get(DIRECTIONS_URL, params=params, timeout=6.0)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return None

    if data.get("status") != "OK" or not data.get("routes"):
        return None

    routes = []
    for route in data["routes"][:3]:
        leg = route["legs"][0]
        duration_s = leg.get("duration_in_traffic", leg["duration"])["value"]
        distance_km = round(leg["distance"]["value"] / 1000, 1)
        routes.append(
            {
                "summary": route.get("summary") or "Route",
                "distance_km": distance_km,
                "eta_minutes": round(duration_s / 60),
                "eta_minutes_no_traffic": round(leg["duration"]["value"] / 60),
                "toll_estimate": estimate_toll(distance_km, mode),
                "fuel_estimate": estimate_fuel(distance_km, mode),
            }
        )
    routes.sort(key=lambda r: r["eta_minutes"])

    best = routes[0]
    return {
        "mode": mode,
        "distance_km": best["distance_km"],
        "eta_minutes": best["eta_minutes"],
        "eta_minutes_no_traffic": best["eta_minutes_no_traffic"],
        "traffic_delay_minutes": max(0, best["eta_minutes"] - best["eta_minutes_no_traffic"]),
        "toll_estimate": best["toll_estimate"],
        "fuel_estimate": best["fuel_estimate"],
        "alternatives": routes[1:],
        "source": "google_directions_live_traffic",
    }


_PLACE_TYPE = {
    "hospital": "hospital",
    "pharmacy": "pharmacy",
    "restaurant": "restaurant",
    "petrol": "gas_station",
    "atm": "atm",
    "school": "school",
    "hotel": "lodging",
    "bus": "bus_station",
    "train": "train_station",
    "police": "police",
    "toilets": "toilet",  # not a real Google place type; falls back to keyword search
    "fire_station": "fire_station",
    "mechanic": "car_repair",
}


def places_nearby(lat: float, lng: float, category: str, radius_m: int = 8000, limit: int = 6) -> list[dict] | None:
    """Google Places Nearby Search. Returns None (not []) on missing key or
    failure so callers know to fall back to the free Overpass search, and
    only return an empty list when Google genuinely found nothing."""
    if not is_configured():
        return None

    place_type = _PLACE_TYPE.get(category)
    params = {
        "location": f"{lat},{lng}",
        "radius": radius_m,
        "key": settings.GOOGLE_MAPS_API_KEY,
    }
    if place_type and place_type != "toilet":
        params["type"] = place_type
    else:
        params["keyword"] = category

    try:
        resp = httpx.get(PLACES_NEARBY_URL, params=params, timeout=6.0)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return None

    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        return None

    from app.tools.geocode import _haversine_km  # local import to avoid a cycle

    results = []
    for item in data.get("results", [])[:limit]:
        loc = item.get("geometry", {}).get("location", {})
        if loc.get("lat") is None or loc.get("lng") is None:
            continue
        results.append(
            {
                "name": item.get("name", "Unnamed place"),
                "lat": loc["lat"],
                "lng": loc["lng"],
                "distance_km": round(_haversine_km(lat, lng, loc["lat"], loc["lng"]), 1),
                "rating": item.get("rating"),
                "open_now": item.get("opening_hours", {}).get("open_now"),
                "address": item.get("vicinity"),
            }
        )
    return sorted(results, key=lambda r: r["distance_km"])
