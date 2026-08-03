"""Attraction suggestions with live OpenStreetMap fallback."""
from app.tools.geocode import find_nearby_places, resolve_place

ATTRACTIONS = {
    "Hyderabad": {
        "indoor": ["Salar Jung Museum", "Birla Planetarium", "Chowmahalla Palace", "Local food court crawl"],
        "outdoor": ["Charminar", "Golconda Fort", "Hussain Sagar", "Tank Bund"],
    },
    "Goa": {
        "indoor": ["Goa State Museum", "Naval Aviation Museum", "Museum of Christian Art", "Beach shack food crawl"],
        "outdoor": ["Baga Beach", "Fort Aguada", "Dudhsagar Falls", "Anjuna Beach"],
    },
    "Delhi": {
        "indoor": ["National Museum", "Nehru Planetarium", "Crafts Museum", "Chandni Chowk food crawl"],
        "outdoor": ["India Gate", "Red Fort", "Qutub Minar", "Lodhi Garden"],
    },
    "Mumbai": {
        "indoor": ["CSMVS Museum", "Nehru Science Centre", "Mani Bhavan", "Colaba food crawl"],
        "outdoor": ["Gateway of India", "Marine Drive", "Juhu Beach", "Elephanta Caves"],
    },
}

DEFAULT_SET = {
    "indoor": ["Local museum", "Art centre", "Indoor heritage site", "Food street"],
    "outdoor": ["Heritage walk", "Main park", "Lakefront", "Popular market"],
}


def get_attractions(destination: str, weather_condition: str) -> list[str]:
    center = resolve_place(destination)
    category = "indoor_attraction" if weather_condition == "rain" else "outdoor_attraction"
    live = find_nearby_places(center, [category], limit=4, radius_m=10000) if center else []
    if live:
        return [item["name"] for item in live]

    city_key = destination.split(",")[0]
    city_set = ATTRACTIONS.get(city_key, DEFAULT_SET)
    return city_set["indoor"] if weather_condition == "rain" else city_set["outdoor"]
