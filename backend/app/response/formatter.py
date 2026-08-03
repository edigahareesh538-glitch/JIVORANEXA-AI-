def _assistant_message(intent: dict, total_cost: float, within_budget: bool) -> str:
    preferences = intent.get("preferences") or []
    destination = intent["destination"]

    if intent.get("destination_from_preferences") and preferences:
        pretty = ", ".join(p.replace("_", " ") for p in preferences)
        opener = f"Since you mentioned {pretty}, I picked {destination} for you. "
    else:
        opener = ""

    if within_budget:
        money = f"Your {intent['duration_days']}-day trip comes to ₹{total_cost}, within your ₹{intent['budget']} budget."
    else:
        money = f"Heads up -- this plan is ₹{total_cost}, over your ₹{intent['budget']} budget. I can suggest cheaper options if you'd like."

    return opener + money


def build_final_response(intent: dict, flight, hotel, weather, attractions, total_cost, log_entries,
                          route=None, place_info=None, transport_mode="flight"):
    within_budget = total_cost <= intent["budget"]
    return {
        "trip_summary": f"{intent['duration_days']}-day trip to {intent['destination']}",
        "destination": intent["destination"],
        "budget": intent["budget"],
        "total_cost": total_cost,
        "within_budget": within_budget,
        "transport_mode": transport_mode,
        "flight": flight,
        "hotel": hotel,
        "weather": weather,
        "attractions": attractions,
        "action_log": log_entries,
        "route": route,
        "place_info": place_info,
        "assistant_message": _assistant_message(intent, total_cost, within_budget),
        "preferences": intent.get("preferences") or [],
    }
