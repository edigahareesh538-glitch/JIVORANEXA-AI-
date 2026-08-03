"""Packing Checklist Tool - rule-based, driven by weather + trip length."""

BASE_ITEMS = ["ID proof / passport", "Phone charger", "Power bank", "Basic first-aid kit", "Reusable water bottle"]


def build_packing_list(destination: str, weather_condition: str, duration_days: int = 3) -> list[str]:
    items = list(BASE_ITEMS)

    condition = (weather_condition or "").lower()
    if "rain" in condition:
        items += ["Umbrella / raincoat", "Waterproof bag cover", "Extra pair of footwear"]
    elif "cloud" in condition:
        items += ["Light jacket", "Umbrella (just in case)"]
    else:
        items += ["Sunscreen", "Sunglasses", "Cap / hat"]

    if duration_days >= 5:
        items.append("Laundry bag")
    if duration_days >= 2:
        items += [f"{max(duration_days, 1)} sets of clothing", "Toiletries kit"]

    items.append("Offline map / downloaded itinerary (see Offline Mode)")
    return items
