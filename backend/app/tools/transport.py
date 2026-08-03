"""Travel Mode Tool (Priority-1 feature request #2).

Instead of always booking a flight, the agent asks how the user is
travelling and plans accordingly:
  flight        -> existing search_flights path (unchanged)
  train / bus   -> a ticket estimate (no real IRCTC/bus API — heuristic,
                   clearly labeled) instead of a flight
  own_vehicle   -> no ticket at all; fuel + parking estimate instead
  rental_car    -> a rental estimate + fuel, no ticket

Kept deliberately simple/deterministic (like the other AI-planner tools)
so it always works with zero external keys.
"""

TRAIN_BASE_FARE = 550
BUS_BASE_FARE = 350
FUEL_PER_DAY = 900          # heuristic: fuel for a round-trip day of driving
PARKING_PER_DAY = 150
RENTAL_PER_DAY = 1800

MODES = {"flight", "train", "bus", "own_vehicle", "rental_car"}


def plan_transport(mode: str, destination: str, duration_days: int) -> dict:
    mode = mode if mode in MODES else "flight"

    if mode == "train":
        return {
            "mode": "train",
            "label": f"Train to {destination}",
            "price": TRAIN_BASE_FARE,
            "provider": "IRCTC (estimate)",
            "note": "Estimated fare -- connect a real IRCTC/rail API for live seat availability & pricing.",
        }
    if mode == "bus":
        return {
            "mode": "bus",
            "label": f"Bus to {destination}",
            "price": BUS_BASE_FARE,
            "provider": "State/Private Bus (estimate)",
            "note": "Estimated fare -- connect RedBus/AbhiBus API for live seats & pricing.",
        }
    if mode in ("own_vehicle", "rental_car"):
        fuel = FUEL_PER_DAY * max(duration_days, 1)
        parking = PARKING_PER_DAY * max(duration_days, 1)
        rental = RENTAL_PER_DAY * max(duration_days, 1) if mode == "rental_car" else 0
        return {
            "mode": mode,
            "label": "Rental Car" if mode == "rental_car" else "Own Vehicle",
            "price": fuel + parking + rental,
            "breakdown": {"fuel_estimate": fuel, "parking_estimate": parking, "rental_estimate": rental},
            "provider": "Self-drive (estimate)",
            "note": "No ticket booked -- fuel/parking/rental are heuristic estimates, not live pricing.",
        }

    # flight -- caller keeps using search_flights; this branch shouldn't be hit
    return {"mode": "flight"}
