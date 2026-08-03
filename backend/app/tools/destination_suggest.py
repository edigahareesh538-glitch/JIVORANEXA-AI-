"""Preference-based destination suggestion.

Handles the exact conversational style described in the AI Travel Assistant
spec -- "I have ₹15000.", "Suggest a honeymoon.", "I love beaches.",
"I hate crowded places." -- none of which name a destination. Without this,
extract_intent() had nothing to resolve and silently defaulted every one of
these to Hyderabad, which is a real product bug, not a style choice.

This is a small curated ranking table, not a live recommendation model --
that's an honest tradeoff for something that must work offline and needs no
paid API. It's easy to extend: add more (destination, tags) rows below.
"""
from __future__ import annotations

# (destination, {tags}) -- tags are matched against preferences detected in
# the user's free text. Keep destinations resolvable by app.tools.geocode
# (they're geocoded live via Nominatim, so any real place name works).
_DESTINATIONS: list[tuple[str, set[str]]] = [
    ("Goa", {"beach", "honeymoon", "nightlife", "party", "relaxing"}),
    ("Pondicherry", {"beach", "honeymoon", "relaxing", "quiet", "avoid_crowds", "spiritual"}),
    ("Andaman Islands", {"beach", "honeymoon", "relaxing", "avoid_crowds", "adventure"}),
    ("Ooty", {"hill_station", "honeymoon", "relaxing", "avoid_crowds", "nature"}),
    ("Munnar", {"hill_station", "honeymoon", "relaxing", "avoid_crowds", "nature", "wildlife"}),
    ("Manali", {"hill_station", "adventure", "honeymoon", "nature"}),
    ("Rishikesh", {"spiritual", "adventure", "avoid_crowds", "nature"}),
    ("Udaipur", {"honeymoon", "heritage", "relaxing", "romantic"}),
    ("Jaipur", {"heritage", "family", "shopping", "culture"}),
    ("Hyderabad", {"heritage", "food", "family", "culture", "budget"}),
    ("Mysuru", {"heritage", "family", "relaxing", "avoid_crowds"}),
    ("Jim Corbett National Park", {"wildlife", "adventure", "nature", "avoid_crowds"}),
    ("Coorg", {"hill_station", "nature", "relaxing", "avoid_crowds", "honeymoon"}),
]

_PREFERENCE_KEYWORDS: dict[str, list[str]] = {
    "beach": ["beach", "beaches", "sea", "coast", "coastal"],
    "honeymoon": ["honeymoon", "romantic getaway", "romantic trip", "anniversary trip"],
    "hill_station": ["hill station", "mountains", "hills", "cool weather", "snow"],
    "wildlife": ["wildlife", "safari", "jungle", "national park", "tiger"],
    "spiritual": ["spiritual", "temple", "pilgrimage", "meditation", "ashram"],
    "adventure": ["adventure", "trekking", "trek", "hiking", "rafting", "paragliding"],
    "avoid_crowds": ["avoid crowd", "not crowded", "quiet place", "hate crowded", "less crowded", "peaceful", "no crowds"],
    "nightlife": ["nightlife", "clubbing", "party"],
    "family": ["family trip", "with kids", "with family", "family friendly"],
    "heritage": ["heritage", "historic", "history", "fort", "palace"],
    "relaxing": ["relax", "relaxing", "chill", "peaceful vacation", "unwind"],
}


def detect_preferences(user_text: str) -> list[str]:
    """Return preference tags found in free text, e.g. ["beach", "honeymoon"]."""
    text = user_text.lower()
    found = []
    for tag, phrases in _PREFERENCE_KEYWORDS.items():
        if any(phrase in text for phrase in phrases):
            found.append(tag)
    return found


def suggest_destination(preferences: list[str], exclude: str | None = None) -> str | None:
    """Best-matching destination for the given preference tags, or None if
    no preferences were detected (caller should keep its own default)."""
    if not preferences:
        return None

    pref_set = set(preferences)
    scored = []
    for name, tags in _DESTINATIONS:
        if exclude and name.lower() == exclude.lower():
            continue
        overlap = len(pref_set & tags)
        if overlap:
            scored.append((overlap, name))

    if not scored:
        return None
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return scored[0][1]
