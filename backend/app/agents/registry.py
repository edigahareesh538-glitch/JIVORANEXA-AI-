"""
Multi-Agent Registry.

Wraps the existing tools/workflow modules into 10 explicitly named
agents so the system is a real, inspectable multi-agent architecture
(GET /api/agents lists them) rather than one hidden function.

Each agent is intentionally a thin wrapper -- it doesn't duplicate
logic that already lives in app/tools or app/workflow, it just gives
that logic a name and a place in the pipeline.
"""
from app.agents.base import Agent
from app.tools import (
    weather as weather_tool,
    maps as maps_tool,
    booking as booking_tool,
    search as search_tool,
    calculator as calculator_tool,
    crowd as crowd_tool,
    budget_planner,
    emergency as emergency_tool,
)
from app.workflow import decision as decision_engine
from app.memory.state import memory_store
from app.memory.session import get_or_resume, new_session


class PlannerAgent(Agent):
    name = "PlannerAgent"
    description = "Decomposes a natural-language goal into ordered steps and drives the overall workflow."

    def run(self, session_id: str | None, message: str, **kwargs):
        from app.workflow.executor import run_trip_planner
        sid, _ = get_or_resume(session_id)
        return run_trip_planner(sid, message, **kwargs)


class ReasoningAgent(Agent):
    name = "ReasoningAgent"
    description = "Applies replanning rules: weather-driven attraction swaps, budget-driven hotel downgrades."

    def apply_weather(self, destination: str, weather: dict, logger):
        return decision_engine.apply_weather_decision(destination, weather, logger)

    def apply_budget(self, total: int, budget: int, hotels: list[dict], logger):
        return decision_engine.apply_budget_decision(total, budget, hotels, logger)

    def run(self, **kwargs):
        raise NotImplementedError("Use apply_weather / apply_budget directly.")


class SearchAgent(Agent):
    name = "SearchAgent"
    description = "Finds flights and nearby real-world places (via live OpenStreetMap search)."

    def run(self, destination: str, budget: int, **kwargs):
        return search_tool.search_flights(destination, budget)


class WeatherAgent(Agent):
    name = "WeatherAgent"
    description = "Fetches live/forecast weather and turns it into concrete travel actions."

    def run(self, destination: str, **kwargs):
        weather = weather_tool.get_weather(destination)
        advice = weather_tool.get_weather_advice(weather["condition"], weather.get("temp_c"))
        return {**weather, "advice": advice}


class BudgetAgent(Agent):
    name = "BudgetAgent"
    description = "Splits a total budget across flight/hotel/food/shopping/emergency and checks totals."

    def run(self, total_budget: float, duration_days: int = 3, destination: str | None = None, **kwargs):
        return budget_planner.plan_budget(total_budget, duration_days, destination)

    def check_total(self, total: int, budget: int) -> bool:
        return calculator_tool.within_budget(total, budget)


class BookingAgent(Agent):
    name = "BookingAgent"
    description = "SIMULATED booking engine (demo mode -- no real payment/inventory is touched)."

    def run(self, destination: str, **kwargs):
        hotels = booking_tool.search_hotels(destination)
        return {"hotels": hotels, "mode": "simulated_demo"}

    def book(self, hotel: dict):
        return booking_tool.book(hotel)


class RecommendationAgent(Agent):
    name = "RecommendationAgent"
    description = "Suggests attractions (weather-aware) and predicts crowd levels for a date."

    def run(self, destination: str, weather_condition: str = "clear", travel_date: str | None = None, **kwargs):
        attractions = maps_tool.get_attractions(destination, weather_condition)
        crowd = crowd_tool.predict_crowd(destination, travel_date)
        return {"attractions": attractions, "crowd": crowd}


class NotificationAgent(Agent):
    name = "NotificationAgent"
    description = "Builds live trip alerts (weather changes, transit reminders) from session state."

    def run(self, state: dict, **kwargs):
        from app.tools.alerts import build_alerts
        return build_alerts(state)


class MemoryAgent(Agent):
    name = "MemoryAgent"
    description = "Reads/writes session + trip memory so the agent can resume instead of restarting."

    def run(self, session_id: str | None = None, **kwargs):
        sid, state = get_or_resume(session_id)
        return {"session_id": sid, "state": state}

    def new_session(self) -> str:
        return new_session()


class SafetyAgent(Agent):
    name = "SafetyAgent"
    description = "Emergency SOS: nearest hospitals, police, pharmacies, blood banks, ATMs, EV charging, toilets."

    def run(self, destination: str, current_location: dict | None = None, **kwargs):
        return emergency_tool.get_sos_snapshot(destination, current_location)


AGENTS: dict[str, Agent] = {
    a.name: a
    for a in [
        PlannerAgent(), ReasoningAgent(), SearchAgent(), WeatherAgent(), BudgetAgent(),
        BookingAgent(), RecommendationAgent(), NotificationAgent(), MemoryAgent(), SafetyAgent(),
    ]
}


def list_agents() -> list[dict]:
    return [a.info() for a in AGENTS.values()]
