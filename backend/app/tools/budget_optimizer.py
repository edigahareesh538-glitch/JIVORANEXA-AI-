"""AI Budget Optimizer.

Given a plan that came out over-budget, suggests concrete swaps (cheaper
transport mode, lower hotel tier, shared cab instead of a full taxi) and
recomputes a new total -- deterministic, so it always works without a key.
"""


def optimize_budget(current_total: float, budget: float, transport_mode: str = "flight",
                     hotel_price_per_night: float | None = None, nights: int = 2) -> dict:
    if current_total <= budget:
        return {
            "over_budget": False,
            "current_total": current_total,
            "budget": budget,
            "message": "Already within budget -- no changes needed.",
            "suggestions": [],
            "new_total": current_total,
        }

    overage = current_total - budget
    suggestions = []
    savings = 0

    if transport_mode == "flight":
        suggestions.append("Switch flight to train — typically saves ₹2,000-4,000")
        savings += 2500
    if hotel_price_per_night and hotel_price_per_night > 1500:
        suggestions.append("Choose a 3-star hotel instead of your current pick — saves on nightly rate")
        savings += min(nights, 1) * 800
    suggestions.append("Use shared cabs/autos instead of private cabs for local transport")
    savings += 400
    if not suggestions:
        suggestions.append("Trim one discretionary activity or shopping budget line")

    new_total = max(current_total - savings, budget) if savings >= overage else current_total - savings

    return {
        "over_budget": True,
        "current_total": current_total,
        "budget": budget,
        "overage": round(overage),
        "suggestions": suggestions,
        "estimated_savings": savings,
        "new_total": round(new_total),
        "fits_budget_after": new_total <= budget,
    }
