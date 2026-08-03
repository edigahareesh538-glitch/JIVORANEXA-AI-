"""Workflow Engine - the heart of the system.

execute step -> success? -> next step
             -> failure? -> retry -> still failed? -> alternative / ask user
"""
from app.logs.action_logger import ActionLogger
from app.memory.state import memory_store
from app.planner.planner import build_plan
from app.services.llm import (
    extract_intent,
    looks_like_feedback,
    extract_feedback_update,
    looks_like_question,
    answer_followup,
)
from app.workflow.retry import with_retry
from app.workflow import decision
from app.tools import search as search_tool, booking as booking_tool, weather as weather_tool
from app.tools import geocode as geocode_tool
from app.tools import transport as transport_tool
from app.tools.calculator import total_cost as calc_total, within_budget
from app.response.formatter import build_final_response


def run_trip_planner(session_id: str, user_text: str, destination_override: str | None = None,
                      place_info: dict | None = None, current_location: dict | None = None,
                      transport_mode_override: str | None = None) -> dict:
    logger = ActionLogger()
    logger.log("Goal Received", status="ok", data={"input": user_text})

    state = memory_store.get(session_id)
    plan = build_plan({})

    # 0. Conversational Q&A short-circuit -- "what's the best time to visit",
    # "any vegetarian food there", "is it safe" etc. answer a question about
    # the trip that's already planned, instead of re-running the whole
    # pipeline (and instead of being misread as a brand new trip request).
    existing_response = state.get("results", {}).get("generate_itinerary")
    if (
        existing_response
        and not destination_override
        and not transport_mode_override
        and looks_like_question(user_text)
        and not looks_like_feedback(user_text, has_previous_intent=True)
    ):
        logger.log("Follow-up Question Detected", status="ok", data={"input": user_text})
        answer = answer_followup(user_text, existing_response)
        logger.log("Answered From Existing Trip Context", status="ok")
        combined_log = existing_response.get("action_log", []) + logger.as_list()
        response = {**existing_response, "assistant_message": answer, "action_log": combined_log}
        memory_store.update_step(session_id, "generate_itinerary", response)
        return response

    # 1. Intent & Goal Extractor -- with conversational-feedback merging.
    # "I don't want flights, I prefer trains" on an existing session updates
    # the PREVIOUS intent instead of being (mis)parsed as a brand new trip.
    previous_intent = state.get("results", {}).get("intent")
    if looks_like_feedback(user_text, has_previous_intent=bool(previous_intent)):
        updates = extract_feedback_update(user_text, previous_intent)
        intent = {**previous_intent, **updates}
        changed = ", ".join(f"{k}={v}" for k, v in updates.items()) or "no recognizable change"
        logger.log(f"Feedback Received: {changed} — replanning on top of your existing trip", status="ok")
    else:
        intent = extract_intent(user_text)

    if destination_override:
        intent["destination"] = destination_override
        intent["goal"] = f"Plan a trip to {destination_override}"
        logger.log(f"Destination Recognized From Photo: {destination_override}", status="ok")
    if transport_mode_override:
        intent["transport_mode"] = transport_mode_override
    intent.setdefault("transport_mode", "flight")

    resolved_destination = geocode_tool.resolve_place(intent["destination"])
    if resolved_destination:
        intent["destination"] = resolved_destination["label"]
        intent["destination_city"] = resolved_destination["city"]
        logger.log(f"Destination Resolved: {resolved_destination['label']}", status="ok")
    search_target = intent.get("destination_city") or intent["destination"]
    current_location = current_location or state.get("current_location")
    logger.log(f"Budget Detected: ₹{intent['budget']}", status="ok")
    logger.log(f"Travel Mode: {intent['transport_mode'].replace('_', ' ').title()}", status="ok")
    memory_store.update_step(session_id, "intent", intent)

    # 2. search_flights (with retry/error handling) -- OR a ticket/vehicle
    # estimate for train/bus/own_vehicle/rental_car (Priority-1 feature #2).
    mode = intent["transport_mode"]
    if mode == "flight":
        logger.log("Flight Search Started", status="ok")
        flights, needs_input = with_retry(
            lambda: search_tool.search_flights(search_target, intent["budget"]),
            fallback_fn=lambda: search_tool.search_flights(search_target, intent["budget"]),
            step_name="search_flights",
            logger=logger,
        )
        cheapest_flight = flights[0] if flights else None
        if cheapest_flight:
            logger.log(f"Cheapest Flight Found: {cheapest_flight['airline']} ₹{cheapest_flight['price']}", status="ok")
        memory_store.update_step(session_id, "search_flights", flights)
    else:
        logger.log(f"Skipping flight search — travelling by {mode.replace('_', ' ')}", status="info")
        ticket = transport_tool.plan_transport(mode, search_target, intent["duration_days"])
        cheapest_flight = {"airline": ticket["label"], "price": ticket["price"], **ticket}
        logger.log(f"{ticket['label']} estimated: ₹{ticket['price']}", status="ok")
        memory_store.update_step(session_id, "search_flights", [cheapest_flight])

    # 3. search_hotels + booking (flaky -> exercises retry handler)
    hotels = booking_tool.search_hotels(search_target)
    booking_result, needs_input = with_retry(
        lambda: booking_tool.book(hotels[0]),
        fallback_fn=lambda: booking_tool.book(hotels[1] if len(hotels) > 1 else hotels[0]),
        step_name="book_hotel",
        logger=logger,
    )
    memory_store.update_step(session_id, "search_hotels", hotels)

    # 4. compare_prices (Decision Engine: budget check)
    nights = intent["duration_days"] - 1 if intent["duration_days"] > 1 else 1
    running_total = calc_total(cheapest_flight["price"] if cheapest_flight else 3500,
                                hotels[0]["price_per_night"], nights)
    chosen_hotel = decision.apply_budget_decision(running_total, intent["budget"], hotels, logger)
    final_total = calc_total(cheapest_flight["price"] if cheapest_flight else 3500,
                              chosen_hotel["price_per_night"], nights)
    memory_store.update_step(session_id, "compare_prices", {"total": final_total})

    # 5. check_weather (Decision Engine: weather-based replanning)
    logger.log("Weather Retrieved", status="ok")
    weather = weather_tool.get_weather(search_target)
    attractions = decision.apply_weather_decision(search_target, weather, logger)
    memory_store.update_step(session_id, "check_weather", weather)

    # 6. build_route (map points: hotel, airport, bus stand, train station, destination, user)
    route = geocode_tool.get_route(intent["destination"], user_location=current_location, hotel_name=chosen_hotel["name"])
    logger.log("Route & Map Points Resolved", status="ok")
    memory_store.update_step(session_id, "build_route", route)

    # 7. generate_itinerary / Final Response Builder
    logger.log("Final Itinerary Generated", status="ok")
    response = build_final_response(
        intent=intent,
        flight=cheapest_flight,
        hotel={**chosen_hotel, "booking": booking_result},
        weather=weather,
        attractions=attractions,
        total_cost=final_total,
        log_entries=logger.as_list(),
        route=route,
        place_info=place_info,
        transport_mode=mode,
    )
    memory_store.update_step(session_id, "generate_itinerary", response)
    return response
