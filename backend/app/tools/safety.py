"""AI Safety Score Tool.

Rule-based (not ML) safety snapshot for a destination: overall score,
crowd level, a women's-safety heuristic, and the right emergency number.
Deliberately conservative and clearly heuristic -- this is NOT a
substitute for official travel advisories.
"""
from app.tools.crowd import predict_crowd

# Illustrative tiering -- swap for a real dataset (e.g. NCRB stats, a
# licensed safety-index API) before using this for real travel decisions.
HIGHER_CAUTION_AREAS = {"delhi"}
WOMEN_SAFETY_TIER = {
    "goa": "High", "kerala": "High", "mumbai": "High", "hyderabad": "High",
    "delhi": "Moderate — take standard precautions at night",
}


def get_safety_score(destination: str) -> dict:
    key = destination.split(",")[0].strip().lower()
    crowd = predict_crowd(destination)

    base_score = 4
    if key in HIGHER_CAUTION_AREAS:
        base_score = 3
    if crowd["level"] == "Peak crowd":
        base_score = max(base_score - 1, 1)

    return {
        "destination": destination,
        "safety_score": base_score,          # out of 5
        "safety_score_out_of": 5,
        "crowd_level": crowd["level"],
        "womens_safety": WOMEN_SAFETY_TIER.get(key, "Moderate — standard precautions recommended"),
        "emergency_number": "112",
        "note": "Heuristic score for demo purposes -- not an official safety rating.",
    }
