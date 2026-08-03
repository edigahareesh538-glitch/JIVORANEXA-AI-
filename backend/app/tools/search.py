"""Search Tool - flight recommendations.

This is still a heuristic sample unless you connect a real travel API, but it
now works for arbitrary destinations instead of only a few hard-coded cities.
"""
import random
import hashlib


def search_flights(destination: str, budget: int) -> list[dict]:
    normalized = destination.split(",")[0].strip()
    known = {"Hyderabad": 3200, "Goa": 4200, "Mumbai": 3800, "Delhi": 4500, "Agra": 3600, "Vijayawada": 2800}
    if normalized in known:
        base = known[normalized]
    else:
        seed = int(hashlib.md5(normalized.lower().encode()).hexdigest()[:8], 16)
        base = 2800 + (seed % 3000)
    options = []
    for i in range(3):
        price = int(base * random.uniform(0.85, 1.25))
        options.append(
            {
                "airline": ["IndiGo", "Air India", "SpiceJet"][i],
                "price": price,
                "duration_hr": round(random.uniform(1.2, 3.5), 1),
                "within_budget": price <= budget * 0.4,
            }
        )
    return sorted(options, key=lambda x: x["price"])
