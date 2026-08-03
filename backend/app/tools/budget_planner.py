"""AI Budget Planner Tool.

Given a total budget (and optionally trip duration / destination tier),
splits it across flight, hotel, food, shopping, and an emergency buffer,
then reports the remaining balance. Percentages shift a little for
short/long trips and near/far destinations so it doesn't feel like a
flat, dumb split.

Extended in Phase 5: luxury / standard / budget modes, cheapest transport
+ hotel suggestions, daily spending planner, AI savings tips, alternative
travel options, travel-cost prediction bands, and budget-comparison rows
for charts.
"""

from __future__ import annotations

# ----- Per-mode category splits ---------------------------------------------
DEFAULT_SPLIT = {"flight": 0.30, "hotel": 0.30, "food": 0.20, "shopping": 0.10, "emergency": 0.10}
LONG_TRIP_SPLIT = {"flight": 0.20, "hotel": 0.35, "food": 0.25, "shopping": 0.10, "emergency": 0.10}

LUXURY_SPLIT = {"flight": 0.20, "hotel": 0.45, "food": 0.18, "shopping": 0.12, "emergency": 0.05}
BUDGET_SPLIT  = {"flight": 0.35, "hotel": 0.20, "food": 0.25, "shopping": 0.08, "emergency": 0.12}

# ----- Cheapest transport suggestions (heuristic estimates, no API) ---------
TRANSPORT_OPTIONS = [
    {"mode": "own_vehicle", "label": "Own Vehicle", "price": 0, "per_day_fuel": 900,
     "parking_per_day": 150, "tag": "cheapest_fuel_only",
     "note": "Drive yourself. Pay only fuel+tolls. Best for distances under 500 km."},
    {"mode": "bus", "label": "State/Private Bus", "price": 350, "provider": "RedBus/AbhiBus (est.)",
     "tag": "cheapest_public",
     "note": "Lowest intercity price. Booking fees may apply."},
    {"mode": "train", "label": "Train", "price": 550, "provider": "IRCTC (est.)",
     "tag": "value",
     "note": "AC chair car / sleeper estimates. Often fastest under 800 km."},
    {"mode": "rental_car", "label": "Rental Car", "price": 1800, "per_day": True,
     "provider": "Zoomcar / similar",
     "tag": "flexible",
     "note": "Pay daily rate + fuel + insurance. Good for 3+ day road-trips."},
    {"mode": "flight", "label": "Flight", "price": 4500, "provider": "Heuristic avg",
     "tag": "fastest",
     "note": "Approximate per-person domestic fare. Variable by date/airline."},
]

# ----- Hotel tier suggestions (deterministic, OSM-tagged price tiers) -------
HOTEL_OPTIONS = [
    {"tier": "budget",    "label": "Budget Lodge / OYO", "min_price": 700,  "max_price": 1200,
     "tag": "cheapest",
     "note": "Clean rooms, basic amenities. Best for short stays and saving."},
    {"tier": "standard",  "label": "3-Star Hotel",       "min_price": 1500, "max_price": 3000,
     "tag": "value",
     "note": "Balanced comfort + cost. Free breakfast and Wi-Fi in most."},
    {"tier": "premium",   "label": "4-Star Hotel",       "min_price": 3500, "max_price": 6500,
     "tag": "comfort",
     "note": "Pool, gym, business services. Worth it on trips of 4+ nights."},
    {"tier": "luxury",    "label": "5-Star / Resort",    "min_price": 7500, "max_price": 15000,
     "tag": "premium",
     "note": "Premium experience. Often includes late checkout + airport pickup."},
]


def _pick_split(duration_days: int, mode: str) -> dict[str, float]:
    if mode == "luxury":
        return LUXURY_SPLIT
    if mode == "budget":
        return BUDGET_SPLIT
    return LONG_TRIP_SPLIT if duration_days >= 6 else DEFAULT_SPLIT


def _cheapest_transport(duration_days: int) -> dict:
    cheapest = sorted(TRANSPORT_OPTIONS, key=lambda o: o["price"])[0]
    return {
        "recommended": cheapest,
        "alternatives": sorted(TRANSPORT_OPTIONS, key=lambda o: o["price"]),
    }


def _cheapest_hotels(duration_days: int) -> dict:
    cheapest_hotel = HOTEL_OPTIONS[0]
    return {
        "recommended": {"name": cheapest_hotel["label"], "price_per_night": cheapest_hotel["min_price"]},
        "alternatives": [
            {"tier": h["tier"], "label": h["label"], "min_price_per_night": h["min_price"],
             "max_price_per_night": h["max_price"], "tag": h["tag"], "note": h["note"]}
            for h in HOTEL_OPTIONS
        ],
    }


def _daily_spending(total_budget: float, duration_days: int) -> list[dict]:
    """Distribute total spend across days, avoiding zero on day-1 (typically
    has arrival + transport cost) and giving the last day a smaller lunch only."""
    per_day = max(round(total_budget / max(duration_days, 1)), 1)
    days = []
    weights = [1.4] + [1.0] * max(duration_days - 2, 0) + [0.6]
    if len(weights) > duration_days:
        weights = weights[:duration_days]
    total_weights = sum(weights)
    for idx in range(duration_days):
        w = weights[idx] if idx < len(weights) else 1.0
        amount = round(total_budget * (w / total_weights))
        days.append({
            "day": idx + 1,
            "estimated_spend": amount,
            "label": ("Arrival + Settle" if idx == 0
                      else "Departure" if idx == duration_days - 1 and duration_days > 1
                      else f"Full day {idx + 1}"),
        })
    return days


def _savings_recommendations(total_budget: float, mode: str) -> list[str]:
    recs = [
        "Book transport 3-6 weeks ahead for the lowest fares.",
        "Pick hotels 2-3 km away from the main tourist zone — 25-40% cheaper on average.",
        "Eat at local dhabhas/cafes for 2 of 3 meals daily.",
        "Use public transit or shared cabs for local sightseeing.",
    ]
    if mode == "luxury":
        recs.append("Trim one premium experience (e.g. spa) and re-allocate to food.")
    if mode == "budget":
        recs.append("Allocate an extra ₹500/day buffer for spontaneous local experiences.")
    if total_budget >= 50000:
        recs.append("Look into weekend vs weekday hotel pricing — mid-week is typically 20-30% cheaper.")
    return recs


def _predict_cost(destination: str | None, duration_days: int, mode: str) -> dict:
    """Heuristic prediction band: low / expected / high cost for the trip so
    the UI can render a visual cost range chart."""
    base = {"luxury": 7800, "standard": 4500, "budget": 2800}.get(mode, 4500)
    duration_factor = max(duration_days, 1)
    expected = base * duration_factor
    return {
        "low_estimate": round(expected * 0.78),
        "expected_estimate": round(expected),
        "high_estimate": round(expected * 1.28),
        "basis": f"{base}/day × {duration_factor} day(s) for {mode or 'standard'} mode"
                 + (f" to {destination}" if destination else ""),
    }


def _budget_comparison(total_budget: float, mode_total: float, mode: str) -> dict:
    saved = round(total_budget - mode_total)
    return {
        "your_budget": total_budget,
        "estimated_mode_total": round(mode_total),
        "difference": saved,
        "mode": mode,
        "fits": mode_total <= total_budget,
        "summary": (f"Within budget — ₹{saved} spare" if saved >= 0
                    else f"Over budget by ₹{abs(saved)}"),
    }


def plan_budget(total_budget: float, duration_days: int = 3, destination: str | None = None,
                mode: str = "standard") -> dict:
    """Public entry point — preserved name/signature so existing callers
    (`/api/budget/plan` and the workflow executor) still work.
    """
    split = _pick_split(duration_days, mode)

    allocations = {category: round(total_budget * pct) for category, pct in split.items()}
    allocated_sum = sum(allocations.values())
    remaining = round(total_budget - allocated_sum)

    per_day_food = round(allocations["food"] / max(duration_days, 1))

    transport_layer = _cheapest_transport(duration_days)
    hotels_layer = _cheapest_hotels(duration_days)
    daily = _daily_spending(total_budget, max(duration_days, 1))
    savings = _savings_recommendations(total_budget, mode)
    prediction = _predict_cost(destination, duration_days, mode)
    comparison = _budget_comparison(total_budget, prediction["expected_estimate"], mode)

    chart_rows = [
        {"label": "Transport", "value": allocations["flight"]},
        {"label": "Hotel", "value": allocations["hotel"]},
        {"label": "Food", "value": allocations["food"]},
        {"label": "Shopping", "value": allocations["shopping"]},
        {"label": "Buffer", "value": allocations["emergency"]},
    ]

    return {
        "total_budget": total_budget,
        "duration_days": duration_days,
        "destination": destination,
        "mode": mode,
        "allocations": allocations,
        "per_day_food_budget": per_day_food,
        "remaining_balance": remaining,
        "notes": [
            f"Flight/transport: ~{allocations['flight']}",
            f"Hotel: ~{allocations['hotel']} total ({round(allocations['hotel']/max(duration_days,1))}/night)",
            f"Food: ~{allocations['food']} total (~{per_day_food}/day)",
            f"Shopping: ~{allocations['shopping']}",
            f"Emergency buffer (keep untouched): ~{allocations['emergency']}",
        ],
        # --- Phase 5 extensions ---
        "cheapest_transport": transport_layer,
        "cheapest_hotel": hotels_layer,
        "daily_spending_plan": daily,
        "savings_recommendations": savings,
        "travel_cost_prediction": prediction,
        "budget_comparison": comparison,
        "visual_chart": chart_rows,
        "modes_supported": ["budget", "standard", "luxury"],
    }
