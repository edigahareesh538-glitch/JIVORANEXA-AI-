"""Location and map helpers.

Uses public OpenStreetMap services where possible:
- Nominatim for geocoding / reverse geocoding
- Overpass for nearby places
- OSRM for route polylines

All calls fall back safely so the UI still works offline or when a service
rate-limits a request.
"""
from __future__ import annotations

import hashlib
import math
import re
from urllib.parse import quote_plus

import httpx

CITY_COORDS = {
    "Hyderabad": (17.3850, 78.4867),
    "Goa": (15.2993, 74.1240),
    "Delhi": (28.6139, 77.2090),
    "Mumbai": (19.0760, 72.8777),
    "Bengaluru": (12.9716, 77.5946),
    "Bangalore": (12.9716, 77.5946),
    "Chennai": (13.0827, 80.2707),
    "Kolkata": (22.5726, 88.3639),
    "Jaipur": (26.9124, 75.7873),
    "Agra": (27.1767, 78.0081),
    "Vijayawada": (16.5062, 80.6480),
}

DEFAULT_CITY = "Hyderabad"
HEADERS = {"User-Agent": "trip-agent/2.0 (local development)"}

_TEXT_STOPWORDS = {
    "i", "want", "go", "to", "this", "that", "place", "plan", "trip", "travel", "a", "an", "the",
    "under", "within", "budget", "for", "day", "days", "night", "nights", "please", "show",
    "me", "my", "need", "help", "find", "from", "current", "location", "book", "ticket",
}


def _offset(seed: str, scale: float = 0.03) -> tuple[float, float]:
    h = hashlib.md5(seed.encode()).hexdigest()
    dx = (int(h[:8], 16) / 0xFFFFFFFF - 0.5) * 2 * scale
    dy = (int(h[8:16], 16) / 0xFFFFFFFF - 0.5) * 2 * scale
    return dx, dy


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def _fallback_point(label: str, lat: float, lng: float, point_type: str, scale: float) -> dict:
    dx, dy = _offset(f"{label}:{point_type}", scale)
    return {
        "label": point_type.replace("_", " ").title(),
        "lat": round(lat + dx, 5),
        "lng": round(lng + dy, 5),
        "type": point_type,
    }


def _clean_candidate(text: str) -> str:
    cleaned = re.sub(r"[^\w\s,-]", " ", text)
    cleaned = re.sub(r"\b\d+\s*(?:day|days|night|nights)\b", " ", cleaned, flags=re.I)
    cleaned = re.sub(r"(?:₹|rs\.?|inr)\s?[\d,]+", " ", cleaned, flags=re.I)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.-")
    return cleaned


def _nominatim_search(query: str) -> dict | None:
    try:
        with httpx.Client(headers=HEADERS, timeout=3.5, follow_redirects=True) as client:
            resp = client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": query, "format": "jsonv2", "limit": 1, "addressdetails": 1},
            )
            resp.raise_for_status()
            data = resp.json()
            return data[0] if data else None
    except Exception:
        return None


def _reverse_lookup(lat: float, lng: float) -> str:
    try:
        with httpx.Client(headers=HEADERS, timeout=3.5, follow_redirects=True) as client:
            resp = client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lng, "format": "jsonv2"},
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("display_name"):
                return data["display_name"].split(",")[0]
    except Exception:
        pass
    return "Current Location"


def _address_city(address: dict) -> str | None:
    return (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("county")
        or address.get("state_district")
        or address.get("state")
    )


def _format_label(item: dict) -> str:
    parts = [item.get("name"), item.get("display_name")]
    for part in parts:
        if part:
            return ", ".join(part.split(",")[:3])
    return "Selected Place"


def resolve_place(query: str, allow_fallback: bool = True) -> dict | None:
    """Resolve a destination or landmark to coordinates and a user-friendly label."""
    raw = _clean_candidate(query)
    if not raw:
        raw = query.strip()

    candidates: list[str] = []
    if raw:
        candidates.append(raw)

    lower_raw = raw.lower()
    for city in CITY_COORDS:
        if city.lower() in lower_raw and city not in candidates:
            candidates.insert(0, city)

    for candidate in candidates:
        item = _nominatim_search(candidate)
        if not item:
            continue
        address = item.get("address", {})
        city = _address_city(address)
        label = _format_label(item)
        return {
            "label": label,
            "city": city or label.split(",")[0],
            "lat": round(float(item["lat"]), 5),
            "lng": round(float(item["lon"]), 5),
            "source": "live",
        }

    if not allow_fallback:
        return None

    for city, (lat, lng) in CITY_COORDS.items():
        if city.lower() in lower_raw:
            return {"label": city, "city": city, "lat": lat, "lng": lng, "source": "fallback"}

    lat, lng = CITY_COORDS[DEFAULT_CITY]
    if raw:
        dx, dy = _offset(raw, 0.1)
        lat, lng = lat + dx, lng + dy
    return {
        "label": raw or DEFAULT_CITY,
        "city": raw or DEFAULT_CITY,
        "lat": round(lat, 5),
        "lng": round(lng, 5),
        "source": "fallback",
    }


def infer_destination_from_text(text: str) -> str | None:
    """Extract a likely destination from free-form text, then validate it by geocoding."""
    patterns = [
        r"(?:go to|visit|travel to|trip to|plan(?:\s+a)? trip to|want(?:\s+to)? go to)\s+([a-zA-Z][a-zA-Z\s-]{1,60})",
        r"(?:in|at)\s+([a-zA-Z][a-zA-Z\s-]{1,60})",
    ]
    candidates: list[str] = []
    for pattern in patterns:
        for match in re.findall(pattern, text, flags=re.I):
            candidate = _clean_candidate(match)
            if candidate:
                candidates.append(candidate)

    for city in CITY_COORDS:
        if city.lower() in text.lower():
            candidates.insert(0, city)

    cleaned_text = _clean_candidate(text)
    if cleaned_text:
        tokens = [t for t in cleaned_text.split() if t.lower() not in _TEXT_STOPWORDS]
        if tokens:
            candidates.append(" ".join(tokens[:4]))
        candidates.append(cleaned_text)

    seen = set()
    for candidate in candidates:
        normalized = candidate.strip(" ,.-").title()
        if not normalized or normalized.lower() in seen:
            continue
        seen.add(normalized.lower())
        resolved = resolve_place(normalized, allow_fallback=False)
        if resolved:
            return resolved["label"].split(",")[0]
    return None


def build_directions_link(origin: dict | None, destination: dict, mode: str = "driving") -> str:
    if origin:
        return (
            "https://www.google.com/maps/dir/?api=1"
            f"&origin={origin['lat']},{origin['lng']}"
            f"&destination={destination['lat']},{destination['lng']}"
            f"&travelmode={mode}"
        )
    return "https://www.google.com/maps/search/?api=1&query=" + quote_plus(destination["label"])


def _category_filters(category: str) -> list[dict]:
    return {
        "hospital": [{"amenity": "hospital"}, {"amenity": "clinic"}, {"amenity": "doctors"}],
        "pharmacy": [{"amenity": "pharmacy"}],
        "atm": [{"amenity": "atm"}, {"amenity": "bank"}],
        "restaurant": [{"amenity": "restaurant"}, {"amenity": "cafe"}, {"amenity": "fast_food"}],
        "petrol": [{"amenity": "fuel"}],
        "school": [{"amenity": "school"}, {"amenity": "college"}, {"amenity": "university"}],
        "hotel": [{"tourism": "hotel"}, {"tourism": "guest_house"}],
        "airport": [{"aeroway": "aerodrome"}, {"aeroway": "terminal"}],
        "bus": [{"amenity": "bus_station"}, {"highway": "bus_stop"}],
        "train": [{"railway": "station"}],
        "outdoor_attraction": [{"tourism": "attraction"}, {"leisure": "park"}, {"tourism": "viewpoint"}],
        "indoor_attraction": [{"tourism": "museum"}, {"tourism": "gallery"}, {"amenity": "arts_centre"}],
        "police": [{"amenity": "police"}],
        "fire_station": [{"amenity": "fire_station"}],
        "ambulance": [{"emergency": "ambulance_station"}, {"amenity": "hospital"}],
        "mechanic": [{"shop": "car_repair"}, {"shop": "motorcycle_repair"}],
        "ev_charging": [{"amenity": "charging_station"}],
        "blood_bank": [{"healthcare": "blood_donation"}, {"amenity": "blood_bank"}],
        "toilets": [{"amenity": "toilets"}],
    }.get(category, [{"amenity": category}])


def find_nearby_places(center: dict, categories: list[str], limit: int = 5, radius_m: int = 6000) -> list[dict]:
    if not center:
        return []

    q_parts: list[str] = []
    for category in categories:
        for tags in _category_filters(category):
            filter_str = "".join(f'["{k}"="{v}"]' for k, v in tags.items())
            q_parts.append(f"nwr(around:{radius_m},{center['lat']},{center['lng']}){filter_str};")

    if not q_parts:
        return []

    query = f"""
    [out:json][timeout:12];
    (
      {' '.join(q_parts)}
    );
    out center tags;
    """

    try:
        with httpx.Client(headers=HEADERS, timeout=5.0, follow_redirects=True) as client:
            resp = client.post("https://overpass-api.de/api/interpreter", content=query.encode("utf-8"))
            resp.raise_for_status()
            payload = resp.json()
    except Exception:
        return []

    items = []
    seen = set()
    for element in payload.get("elements", []):
        tags = element.get("tags", {})
        lat = element.get("lat") or element.get("center", {}).get("lat")
        lng = element.get("lon") or element.get("center", {}).get("lon")
        name = tags.get("name")
        if not name or lat is None or lng is None:
            continue
        key = (name.lower(), round(float(lat), 5), round(float(lng), 5))
        if key in seen:
            continue
        seen.add(key)
        items.append(
            {
                "name": name,
                "lat": round(float(lat), 5),
                "lng": round(float(lng), 5),
                "distance_km": round(_haversine_km(center["lat"], center["lng"], float(lat), float(lng)), 1),
                "tags": tags,
            }
        )

    return sorted(items, key=lambda item: item["distance_km"])[:limit]


def find_nearby_places_by_category(
    center: dict, categories: list[str], limit: int = 3, radius_m: int = 8000
) -> dict[str, list[dict]]:
    """Fetch nearby places for multiple categories with one combined Overpass query."""
    if not center or not categories:
        return {category: [] for category in categories}

    q_parts: list[str] = []
    for category in categories:
        for tags in _category_filters(category):
            filter_str = "".join(f'["{k}"="{v}"]' for k, v in tags.items())
            q_parts.append(f"nwr(around:{radius_m},{center['lat']},{center['lng']}){filter_str};")

    if not q_parts:
        return {category: [] for category in categories}

    query = f"""
    [out:json][timeout:25];
    (
      {' '.join(q_parts)}
    );
    out center tags;
    """

    try:
        with httpx.Client(headers=HEADERS, timeout=20.0, follow_redirects=True) as client:
            resp = client.post("https://overpass-api.de/api/interpreter", content=query.encode("utf-8"))
            resp.raise_for_status()
            payload = resp.json()
    except Exception:
        return {category: [] for category in categories}

    all_items = []
    seen = set()
    for element in payload.get("elements", []):
        tags = element.get("tags", {})
        lat = element.get("lat") or element.get("center", {}).get("lat")
        lng = element.get("lon") or element.get("center", {}).get("lon")
        name = tags.get("name")
        if not name or lat is None or lng is None:
            continue

        key = (name.lower(), round(float(lat), 5), round(float(lng), 5))
        if key in seen:
            continue
        seen.add(key)
        all_items.append(
            {
                "name": name,
                "lat": round(float(lat), 5),
                "lng": round(float(lng), 5),
                "distance_km": round(_haversine_km(center["lat"], center["lng"], float(lat), float(lng)), 1),
                "tags": tags,
            }
        )

    out: dict[str, list[dict]] = {category: [] for category in categories}
    for category in categories:
        wanted = _category_filters(category)
        matches = [
            item
            for item in all_items
            if any(all(item["tags"].get(k) == v for k, v in tagset.items()) for tagset in wanted)
        ]
        out[category] = sorted(matches, key=lambda item: item["distance_km"])[:limit]

    return out


def _osrm_route(origin: dict | None, destination: dict) -> list[list[float]]:
    if not origin:
        return []
    try:
        with httpx.Client(headers=HEADERS, timeout=4.0, follow_redirects=True) as client:
            resp = client.get(
                "https://router.project-osrm.org/route/v1/driving/"
                f"{origin['lng']},{origin['lat']};{destination['lng']},{destination['lat']}",
                params={"overview": "full", "geometries": "geojson"},
            )
            resp.raise_for_status()
            routes = resp.json().get("routes", [])
            if not routes:
                return []
            coordinates = routes[0]["geometry"]["coordinates"]
            return [[round(lat, 5), round(lng, 5)] for lng, lat in coordinates]
    except Exception:
        return []


def get_distance_eta(origin: dict, destination: dict, mode: str = "driving") -> dict | None:
    """Real live distance (km) + ETA (minutes) between two points via OSRM.
    mode: 'driving' | 'walking' | 'cycling' (OSRM public router profiles)."""
    profile = {"driving": "driving", "walking": "foot", "cycling": "bike"}.get(mode, "driving")
    try:
        with httpx.Client(headers=HEADERS, timeout=4.0, follow_redirects=True) as client:
            resp = client.get(
                f"https://router.project-osrm.org/route/v1/{profile}/"
                f"{origin['lng']},{origin['lat']};{destination['lng']},{destination['lat']}",
                params={"overview": "false"},
            )
            resp.raise_for_status()
            routes = resp.json().get("routes", [])
            if not routes:
                return None
            route = routes[0]
            return {
                "distance_km": round(route["distance"] / 1000, 1),
                "eta_minutes": round(route["duration"] / 60),
                "mode": mode,
                "source": "live_osrm",
            }
    except Exception:
        return {
            "distance_km": round(_haversine_km(origin["lat"], origin["lng"], destination["lat"], destination["lng"]), 1),
            "eta_minutes": None,
            "mode": mode,
            "source": "haversine_fallback_no_eta",
        }


def get_route(destination: str, user_location: dict | None = None, hotel_name: str | None = None) -> dict:
    """Build route data using resolved destination, current location, and nearby transit hubs."""
    destination_point = resolve_place(destination) or resolve_place(DEFAULT_CITY)
    center = {"lat": destination_point["lat"], "lng": destination_point["lng"]}

    if user_location and user_location.get("lat") is not None and user_location.get("lng") is not None:
        user_point = {
            "label": user_location.get("label") or _reverse_lookup(user_location["lat"], user_location["lng"]),
            "lat": round(float(user_location["lat"]), 5),
            "lng": round(float(user_location["lng"]), 5),
            "type": "user",
        }
    else:
        user_point = _fallback_point(destination_point["label"], center["lat"], center["lng"], "user", 0.03)
        user_point["label"] = "Current Location unavailable"

    hotel_point = None
    if hotel_name:
        hotel_resolved = resolve_place(f"{hotel_name}, {destination_point['city']}", allow_fallback=False)
        if hotel_resolved:
            hotel_point = {
                "label": hotel_name,
                "lat": hotel_resolved["lat"],
                "lng": hotel_resolved["lng"],
                "type": "hotel",
            }
    if not hotel_point:
        nearby_hotels = find_nearby_places(center, ["hotel"], limit=1, radius_m=5000)
        if nearby_hotels:
            hotel_point = {
                "label": nearby_hotels[0]["name"],
                "lat": nearby_hotels[0]["lat"],
                "lng": nearby_hotels[0]["lng"],
                "type": "hotel",
            }
        else:
            hotel_point = _fallback_point(destination_point["label"], center["lat"], center["lng"], "hotel", 0.02)

    def nearby_or_fallback(category: str, fallback_label: str, scale: float) -> dict:
        nearby = find_nearby_places(center, [category], limit=1, radius_m=10000)
        if nearby:
            return {
                "label": nearby[0]["name"],
                "lat": nearby[0]["lat"],
                "lng": nearby[0]["lng"],
                "type": category,
            }
        point = _fallback_point(destination_point["label"], center["lat"], center["lng"], category, scale)
        point["label"] = fallback_label
        return point

    destination_marker = {
        "label": destination_point["label"],
        "lat": destination_point["lat"],
        "lng": destination_point["lng"],
        "type": "destination",
    }
    airport_point = nearby_or_fallback("airport", "Nearest Airport", 0.08)
    bus_point = nearby_or_fallback("bus", "Nearest Bus Stand", 0.04)
    train_point = nearby_or_fallback("train", "Nearest Railway Station", 0.05)
    path = _osrm_route(user_point, destination_marker)

    return {
        "center": center,
        "path": path,
        "directions": {
            "drive": build_directions_link(user_point, destination_marker, "driving"),
            "walk": build_directions_link(user_point, destination_marker, "walking"),
            "transit": build_directions_link(user_point, destination_marker, "transit"),
        },
        "points": [user_point, destination_marker, hotel_point, airport_point, bus_point, train_point],
    }
