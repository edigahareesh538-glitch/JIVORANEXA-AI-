"""Real Maps: live distance + ETA between the user's current location and a
destination (or any two named/point locations), on top of the existing
OSRM-based route builder in app/tools/geocode.py.

When GOOGLE_MAPS_API_KEY is configured, this upgrades to Google's live
traffic-aware ETA (accounts for current congestion, not just distance),
alternative routes, and toll/fuel cost estimates. Without a key -- or if
Google's API call fails for any reason -- it falls straight back to the
original OSRM-based figures, so the endpoint never breaks."""
from app.tools.geocode import get_distance_eta, resolve_place
from app.tools.google_maps import traffic_aware_route, estimate_toll, estimate_fuel, is_configured


def live_distance_eta(origin: dict, destination_query: str, mode: str = "driving") -> dict:
    dest_point = resolve_place(destination_query)
    if not dest_point:
        return {"error": f"Could not resolve destination '{destination_query}'"}

    destination = {"label": dest_point["label"], "lat": dest_point["lat"], "lng": dest_point["lng"]}

    google_route = traffic_aware_route(origin, dest_point, mode=mode)
    if google_route:
        return {
            "origin": origin,
            "destination": destination,
            "distance_km": google_route["distance_km"],
            "eta_minutes": google_route["eta_minutes"],
            "eta_minutes_no_traffic": google_route["eta_minutes_no_traffic"],
            "traffic_delay_minutes": google_route["traffic_delay_minutes"],
            "toll_estimate": google_route["toll_estimate"],
            "fuel_estimate": google_route["fuel_estimate"],
            "alternatives": google_route["alternatives"],
            "mode": mode,
            "source": google_route["source"],
            "google_maps_configured": True,
        }

    # Fallback: existing free OSRM path (unchanged behaviour).
    eta = get_distance_eta(origin, dest_point, mode=mode) or {}
    distance_km = eta.get("distance_km", 0)
    return {
        "origin": origin,
        "destination": destination,
        **eta,
        "toll_estimate": estimate_toll(distance_km, mode),
        "fuel_estimate": estimate_fuel(distance_km, mode),
        "alternatives": [],
        "google_maps_configured": is_configured(),
    }
