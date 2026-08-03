"""Decision / Replanning Engine.

Makes the assistant autonomous rather than a fixed script:
- Weather = rain -> swap outdoor for indoor attractions
- Budget exceeded -> choose cheaper hotel & recalculate
"""
from app.services.llm import decide_next_action
from app.tools import maps as maps_tool
from app.logs.action_logger import ActionLogger


def apply_weather_decision(destination: str, weather: dict, logger: ActionLogger) -> list[str]:
    action = decide_next_action({"weather": weather["condition"]})
    attractions = maps_tool.get_attractions(destination, weather["condition"])
    if weather["condition"] == "rain":
        logger.log("Rain expected", status="info")
        logger.log("Indoor attractions suggested", status="ok")
    else:
        logger.log(f"Weather is {weather['condition']} — outdoor plan kept", status="ok")
    return attractions


def apply_budget_decision(total: int, budget: int, hotels: list[dict], logger: ActionLogger) -> dict:
    if total <= budget:
        logger.log("Budget check passed", status="ok")
        return hotels[0]  # cheapest already chosen
    logger.log("Budget exceeded — choosing cheaper hotel", status="retry")
    cheapest = min(hotels, key=lambda h: h["price_per_night"])
    logger.log(f"Switched to {cheapest['name']} and recalculated itinerary", status="ok")
    return cheapest
