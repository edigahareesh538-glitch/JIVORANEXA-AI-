"""Task Planner - breaks one goal into an ordered execution plan."""


def build_plan(intent: dict) -> list[str]:
    return [
        "search_flights",
        "search_hotels",
        "compare_prices",
        "check_weather",
        "generate_itinerary",
    ]
