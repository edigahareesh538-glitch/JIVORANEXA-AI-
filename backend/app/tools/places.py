"""Nearby-place search for the help chat."""
from __future__ import annotations

from app.tools.geocode import build_directions_link, find_nearby_places, resolve_place
from app.tools.google_maps import places_nearby as google_places_nearby

CATEGORY_SYNONYMS = {
    "hospital": ["hospital", "hospitals", "clinic", "doctor", "medical", "emergency"],
    "pharmacy": ["pharmacy", "chemist", "medicine", "medicines", "medical store"],
    "atm": ["atm", "cash", "money", "bank"],
    "restaurant": ["restaurant", "food", "eat", "cafe", "coffee"],
    "petrol": ["petrol", "fuel", "fuel station", "gas", "diesel", "petrol pump", "gas station"],
    "school": ["school", "schools", "college", "university", "campus"],
    "hotel": ["hotel", "stay", "lodge", "guest house"],
    "bus": ["bus", "bus stand", "bus station"],
    "train": ["train", "railway", "station"],
    # Bug fix: these two categories already existed in the underlying map
    # search (geocode._category_filters, built for Emergency SOS) but had
    # no synonyms wired up here, so typing "toilet" or "police station" in
    # the help chat silently fell through to the "hospital" default.
    "police": ["police", "police station", "cops", "law enforcement"],
    "toilets": ["toilet", "toilets", "restroom", "washroom", "public toilet", "loo"],
}


def _match_categories(query: str) -> list[str]:
    q = query.lower()
    matched = [category for category, words in CATEGORY_SYNONYMS.items() if any(word in q for word in words)]
    return matched or ["hospital"]


def _choose_search_origin(destination: str, query: str, current_location: dict | None) -> tuple[dict, str]:
    q = query.lower()
    destination_center = resolve_place(destination)
    current_center = None
    if current_location and current_location.get("lat") is not None and current_location.get("lng") is not None:
        current_center = {
            "label": current_location.get("label") or "Current Location",
            "lat": round(float(current_location["lat"]), 5),
            "lng": round(float(current_location["lng"]), 5),
        }

    if any(text in q for text in ("destination", "there", "at destination")) or not current_center:
        return destination_center, destination_center["label"]
    return current_center, current_center["label"]


def _google_upgrade(center: dict, category: str) -> list[dict] | None:
    """Try Google Places first (better names/ratings/open-now data) when a
    GOOGLE_MAPS_API_KEY is configured. Returns None on no-key/failure so the
    caller falls back to the existing free Overpass search untouched."""
    google_results = google_places_nearby(center["lat"], center["lng"], category, radius_m=12000, limit=6)
    if not google_results:
        return google_results
    return [
        {
            "name": item["name"],
            "lat": item["lat"],
            "lng": item["lng"],
            "distance_km": item["distance_km"],
            "rating": item.get("rating"),
            "open_now": item.get("open_now"),
        }
        for item in google_results
    ]


def search_nearby(destination: str, query: str, current_location: dict | None = None) -> list[dict]:
    categories = _match_categories(query)
    center, origin_label = _choose_search_origin(destination, query, current_location)

    google_results = _google_upgrade(center, categories[0])
    if google_results:
        formatted = []
        for item in google_results:
            point = {"lat": item["lat"], "lng": item["lng"], "label": item["name"]}
            formatted.append(
                {
                    "name": item["name"],
                    "category": categories[0],
                    "distance_km": item["distance_km"],
                    "lat": item["lat"],
                    "lng": item["lng"],
                    "origin_label": origin_label,
                    "maps_link": build_directions_link(center, point, "driving"),
                    "transit_link": build_directions_link(center, point, "transit"),
                    "rating": item.get("rating"),
                    "open_now": item.get("open_now"),
                }
            )
        return formatted

    results = find_nearby_places(center, categories, limit=6, radius_m=12000)
    if not results and current_location:
        destination_center = resolve_place(destination)
        if destination_center:
            center = destination_center
            origin_label = destination_center["label"]
            results = find_nearby_places(center, categories, limit=6, radius_m=12000)

    formatted = []
    for item in results:
        point = {"lat": item["lat"], "lng": item["lng"], "label": item["name"]}
        formatted.append(
            {
                "name": item["name"],
                "category": categories[0],
                "distance_km": item["distance_km"],
                "lat": item["lat"],
                "lng": item["lng"],
                "origin_label": origin_label,
                "maps_link": build_directions_link(center, point, "driving"),
                "transit_link": build_directions_link(center, point, "transit"),
            }
        )
    return formatted
