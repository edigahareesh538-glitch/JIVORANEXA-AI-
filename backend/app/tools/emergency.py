"""Emergency SOS Tool.

Reuses the existing OpenStreetMap-based nearby-place search (app/tools/geocode.py)
across every emergency category in one call, so the frontend can render an
SOS screen with hospitals, police, fuel, EV charging, ATMs, pharmacies,
blood banks and toilets in one request.
"""
from app.tools.geocode import find_nearby_places_by_category, resolve_place, build_directions_link

EMERGENCY_CATEGORIES = {
    "hospital": "Nearby Hospitals",
    "police": "Police Stations",
    "fire_station": "Fire Stations",
    "ambulance": "Ambulance Assistance",
    "blood_bank": "Blood Banks",
    "pharmacy": "Pharmacies",
    "mechanic": "Mechanics",
    "ev_charging": "EV Charging",
    "hotel": "Nearby Hotels",
    "atm": "Nearby ATM",
    "petrol": "Petrol Pumps",
    "toilets": "Public Toilets",
}


def get_sos_snapshot(destination: str, current_location: dict | None = None, radius_m: int = 8000) -> dict:
    if current_location and current_location.get("lat") is not None:
        center = {
            "label": current_location.get("label") or "Current Location",
            "lat": round(float(current_location["lat"]), 5),
            "lng": round(float(current_location["lng"]), 5),
        }
    else:
        center = resolve_place(destination)

    if not center:
        return {"center": None, "categories": {}}

    results_by_category = find_nearby_places_by_category(
        center,
        list(EMERGENCY_CATEGORIES.keys()),
        limit=3,
        radius_m=radius_m,
    )

    categories_out = {}
    for category, display_name in EMERGENCY_CATEGORIES.items():
        results = results_by_category.get(category, [])
        categories_out[category] = {
            "label": display_name,
            "places": [
                {
                    "name": item["name"],
                    "distance_km": item["distance_km"],
                    "lat": item["lat"],
                    "lng": item["lng"],
                    "maps_link": build_directions_link(
                        center,
                        {"lat": item["lat"], "lng": item["lng"], "label": item["name"]},
                        "driving",
                    ),
                    "call_number": item.get("tags", {}).get("phone") or item.get("tags", {}).get("contact:phone"),
                }
                for item in results
            ],
        }

    return {
        "center": center,
        "categories": categories_out,
        "emergency_numbers": {
            "India Police": "100",
            "Ambulance": "108",
            "Fire": "101",
            "National Emergency Number": "112",
            "Women's Helpline": "1091",
            "Tourist Helpline": "1363",
        },
    }
