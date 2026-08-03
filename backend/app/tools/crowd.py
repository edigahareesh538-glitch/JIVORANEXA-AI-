"""AI Crowd Prediction Tool.

Rule-based (not ML) but genuinely useful: combines weekday/weekend,
a static Indian public-holiday/festival calendar, and destination
popularity tier to output Low / Moderate / Peak crowd + why.

This is intentionally deterministic and explainable (no external API,
no key needed) so it always works in a demo.
"""
from datetime import date, datetime

# Major India-wide holidays/festivals that spike travel crowds.
# (Extend freely -- dates recur yearly with drift for lunar festivals.)
FESTIVAL_DATES_2026 = {
    date(2026, 1, 1): "New Year",
    date(2026, 1, 14): "Makar Sankranti / Pongal",
    date(2026, 1, 26): "Republic Day",
    date(2026, 3, 4): "Holi",
    date(2026, 3, 20): "Ramzan / Eid-related travel",
    date(2026, 4, 14): "Ambedkar Jayanti / Tamil New Year",
    date(2026, 8, 15): "Independence Day",
    date(2026, 8, 26): "Ganesh Chaturthi",
    date(2026, 10, 2): "Gandhi Jayanti",
    date(2026, 10, 20): "Dussehra",
    date(2026, 11, 8): "Diwali",
    date(2026, 12, 25): "Christmas",
}

HIGH_TOURISM_DESTINATIONS = {"goa", "manali", "shimla", "ooty", "munnar", "kashmir", "rishikesh"}


def predict_crowd(destination: str, travel_date: str | None = None) -> dict:
    """travel_date: 'YYYY-MM-DD' string; defaults to today if not given."""
    try:
        d = datetime.strptime(travel_date, "%Y-%m-%d").date() if travel_date else date.today()
    except ValueError:
        d = date.today()

    reasons = []
    score = 0  # 0=low, higher=more crowded

    is_weekend = d.weekday() >= 5  # Sat/Sun
    if is_weekend:
        score += 1
        reasons.append("Falls on a weekend")

    festival = FESTIVAL_DATES_2026.get(d)
    # also flag the 2 days around a festival (travel spikes before/after)
    if not festival:
        for fd, name in FESTIVAL_DATES_2026.items():
            if abs((fd - d).days) <= 2:
                festival = f"Near {name}"
                break
    if festival:
        score += 2
        reasons.append(f"Close to a major holiday: {festival}")

    dest_key = destination.split(",")[0].strip().lower()
    if dest_key in HIGH_TOURISM_DESTINATIONS:
        score += 1
        reasons.append(f"{destination} is a high-tourism destination year-round")

    if score >= 3:
        level = "Peak crowd"
        advice = "Book hotels/transport at least 2-3 weeks ahead; expect higher prices and long queues at attractions."
    elif score >= 1:
        level = "Moderately crowded"
        advice = "Book a few days ahead. Visit popular spots early morning to skip queues."
    else:
        level = "Less crowded"
        advice = "Good time to visit -- flexible booking should be fine, prices likely near baseline."

    if not reasons:
        reasons.append("No weekend or major festival overlap found for this date")

    return {
        "destination": destination,
        "date": d.isoformat(),
        "level": level,
        "score": score,
        "reasons": reasons,
        "advice": advice,
    }
