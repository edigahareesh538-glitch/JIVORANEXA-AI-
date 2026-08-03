"""
Thin wrapper around Gemini (via google-generativeai).
Falls back to a deterministic mock so the whole pipeline runs
without any API key during development / demos.
"""
import json
import re
from app.services.config import settings
from app.tools.geocode import infer_destination_from_text
from app.tools.destination_suggest import detect_preferences, suggest_destination

_model = None

if not settings.USE_MOCK_LLM and settings.GEMINI_API_KEY:
    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)
    
    # Try model aliases in fallback order to avoid version-pinning 404 errors
    _model_candidates = [
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash-001",
        "gemini-1.5-pro",
        "gemini-pro"
    ]
    for _m in _model_candidates:
        try:
            _candidate = genai.GenerativeModel(_m)
            # Test model initialization
            _model = _candidate
            break
        except Exception:
            continue


def _detect_transport_mode(user_text: str) -> str | None:
    t = user_text.lower()
    if re.search(r"\btrain\b|\birctc\b|\brailway\b", t):
        return "train"
    if re.search(r"\bbus\b", t):
        return "bus"
    if re.search(r"\brental car\b|\brent a car\b|\bself[- ]drive\b", t):
        return "rental_car"
    if re.search(r"\bown (vehicle|car|bike)\b|\bmy (car|bike|vehicle)\b|\bdriving\b|\bby road\b", t):
        return "own_vehicle"
    if re.search(r"\bflight\b|\bflying\b|\bfly\b|\bplane\b", t):
        return "flight"
    return None


def _mock_extract_intent(user_text: str) -> dict:
    budget_match = re.search(r"(?:₹|rs\.?|inr)\s?([\d,]+)", user_text, re.I) or \
        re.search(r"(?:under|within|budget of)\s+(?:₹|rs\.?|inr)?\s?([\d,]+)", user_text, re.I)

    days_match = re.search(r"(\d+)\s*day", user_text, re.I)
    dest_match = re.search(
        r"(?:go to|visit|travel to|trip to|to|in)\s+([a-zA-Z][a-zA-Z\s-]{1,60})",
        user_text,
        re.I,
    )
    destination = dest_match.group(1).strip() if dest_match else None
    if destination:
        destination = re.sub(r"^(?:go to|visit|travel to|trip to|to|in)\s+", "", destination, flags=re.I)
        destination = re.split(
            r"\b(?:under|within|budget|for|from|with|\d+\s*day|\d+\s*nights?)\b",
            destination,
            maxsplit=1,
            flags=re.I,
        )[0].strip(" ,.-")
    if not destination:
        destination = infer_destination_from_text(user_text)

    # Read preferences out of sentence if no explicit place is named
    preferences = detect_preferences(user_text)
    used_preference_match = False
    if not destination:
        suggested = suggest_destination(preferences)
        if suggested:
            destination = suggested
            used_preference_match = True
    destination = destination or "Hyderabad"

    return {
        "goal": f"Plan a trip to {destination}",
        "destination": destination,
        "budget": int(budget_match.group(1).replace(",", "")) if budget_match else 15000,
        "duration_days": int(days_match.group(1)) if days_match else 3,
        "priority": "cheapest",
        "transport_mode": _detect_transport_mode(user_text) or "flight",
        "preferences": preferences,
        "destination_from_preferences": used_preference_match,
    }


# --- Feedback / follow-up messages within an existing session -------------
_FEEDBACK_TRIGGERS = re.compile(
    r"\b(don't want|do not want|no more|instead of|prefer|change to|switch to|"
    r"actually|rather|not\s+\w+\s+anymore|no flights?|no trains?|no buses?)\b",
    re.I,
)


def looks_like_feedback(user_text: str, has_previous_intent: bool) -> bool:
    """Heuristic: short follow-up phrasing + an existing session = treat as
    feedback to merge, not a brand-new trip request."""
    if not has_previous_intent:
        return False
    return bool(_FEEDBACK_TRIGGERS.search(user_text))


def extract_feedback_update(user_text: str, previous_intent: dict) -> dict:
    """Returns ONLY the fields that should change on top of previous_intent."""
    updates: dict = {}

    mode = _detect_transport_mode(user_text)
    if mode:
        updates["transport_mode"] = mode

    budget_match = re.search(r"(?:₹|rs\.?|inr)\s?([\d,]+)", user_text, re.I) or \
        re.search(r"budget(?:\s+is)?\s+(?:₹|rs\.?|inr)?\s?([\d,]+)", user_text, re.I)
    if budget_match:
        updates["budget"] = int(budget_match.group(1).replace(",", ""))

    days_match = re.search(r"(\d+)\s*day", user_text, re.I)
    if days_match:
        updates["duration_days"] = int(days_match.group(1))

    return updates


def extract_intent(user_text: str) -> dict:
    """Intent & Goal Extractor component."""
    if _model is None:
        return _mock_extract_intent(user_text)

    preferences = detect_preferences(user_text)
    prompt = f"""Extract structured trip-planning intent from this request.
Return ONLY valid JSON with keys: goal, destination, budget, duration_days, priority.
If the user did NOT name a specific place (e.g. they only said "I love beaches"
or "suggest a honeymoon"), set destination to null instead of guessing.
Request: "{user_text}\""""
    try:
        resp = _model.generate_content(prompt)
        text = resp.text.strip().strip("`").replace("json\n", "")
        intent = json.loads(text)
    except Exception:
        return _mock_extract_intent(user_text)

    intent.setdefault("transport_mode", _detect_transport_mode(user_text) or "flight")
    intent["preferences"] = preferences
    intent["destination_from_preferences"] = False
    if not intent.get("destination"):
        suggested = suggest_destination(preferences) or infer_destination_from_text(user_text)
        intent["destination"] = suggested or "Hyderabad"
        intent["destination_from_preferences"] = bool(suggested)
        intent["goal"] = intent.get("goal") or f"Plan a trip to {intent['destination']}"
    intent.setdefault("budget", 15000)
    intent.setdefault("duration_days", 3)
    intent.setdefault("priority", "cheapest")
    return intent


# --- Conversational follow-up Q&A --------------------------------------
_QUESTION_STARTERS = re.compile(
    r"^\s*(what|when|where|why|how|is|are|does|do|can|could|should|which|any)\b",
    re.I,
)


def looks_like_question(user_text: str) -> bool:
    text = user_text.strip()
    if "?" in text:
        return True
    return bool(_QUESTION_STARTERS.match(text))


def _mock_answer_followup(user_text: str, context: dict) -> str:
    """Rule-based fallback so follow-up Q&A works with zero API keys."""
    t = user_text.lower()
    destination = context.get("destination", "your destination")
    weather = context.get("weather") or {}
    condition = weather.get("condition")
    budget = context.get("budget")
    total_cost = context.get("total_cost")
    attractions = context.get("attractions") or []

    if any(w in t for w in ("weather", "rain", "hot", "cold", "temperature")):
        if condition:
            return f"Current conditions for {destination}: {condition}, {weather.get('temp_c', '—')}°C. I've already adjusted your itinerary for this."
        return f"I don't have live weather for {destination} yet -- ask me to plan the trip first and I'll pull it in."
    if any(w in t for w in ("safe", "safety", "danger")):
        return f"I can pull a dedicated safety score for {destination} -- check the Safety tab, or ask me and I'll fetch it."
    if any(w in t for w in ("vegetarian", "veg food", "food", "eat", "cuisine")):
        return f"{destination} has plenty of local food options near {attractions[0] if attractions else 'the main attractions'} -- ask the Nearby Help chat for \"restaurants\" and I'll list real ones close to you."
    if any(w in t for w in ("budget", "afford", "cost", "expensive", "cheap")):
        if total_cost is not None and budget is not None:
            diff = budget - total_cost
            verdict = f"you're ₹{diff} under budget" if diff >= 0 else f"you're ₹{-diff} over budget"
            return f"Your current plan for {destination} totals ₹{total_cost} against a ₹{budget} budget -- {verdict}."
        return "Tell me your budget and I'll plan within it."
    if any(w in t for w in ("best time", "when to visit", "season")):
        return f"For most Indian destinations like {destination}, October–March (cooler, drier) is generally the best window -- I can factor a travel month into your plan if you give me one."
    if attractions:
        return f"For {destination} I'd start with {', '.join(attractions[:3])}. Ask me anything else about the trip -- weather, budget, or nearby food/hospitals."
    return f"I don't have a trip planned yet for that question -- tell me a destination, budget, and how many days, and I'll plan it, then you can ask follow-ups."


def answer_followup(user_text: str, context: dict) -> str:
    """Answers a question about the CURRENT trip context."""
    if _model is None:
        return _mock_answer_followup(user_text, context)

    grounding = {
        "destination": context.get("destination"),
        "budget": context.get("budget"),
        "total_cost": context.get("total_cost"),
        "weather": context.get("weather"),
        "attractions": context.get("attractions"),
        "hotel": (context.get("hotel") or {}).get("name") if isinstance(context.get("hotel"), dict) else None,
    }
    prompt = (
        "You are a travel assistant. The traveller already has this trip planned "
        f"(real data, do not contradict it): {json.dumps(grounding)}\n"
        f"Answer their follow-up question in 1-3 short, friendly sentences: \"{user_text}\"\n"
        "If the data above doesn't cover the question, say so plainly instead of guessing."
    )
    try:
        resp = _model.generate_content(prompt)
        return resp.text.strip()
    except Exception:
        return _mock_answer_followup(user_text, context)


def decide_next_action(context: dict) -> str:
    """Decision / Replanning Engine's reasoning step (LLM-backed, mock fallback)."""
    if _model is None:
        if context.get("weather") == "rain":
            return "prefer_indoor_attractions"
        if context.get("budget_exceeded"):
            return "choose_cheaper_hotel"
        return "continue"

    try:
        prompt = f"Given this trip-planning context: {json.dumps(context)}, " \
                 f"reply with one short action keyword only."
        resp = _model.generate_content(prompt)
        return resp.text.strip()
    except Exception:
        if context.get("weather") == "rain":
            return "prefer_indoor_attractions"
        if context.get("budget_exceeded"):
            return "choose_cheaper_hotel"
        return "continue"