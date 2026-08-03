"""Calculator Tool - budget math for the Decision Engine."""


def total_cost(flight_price: int, hotel_price_per_night: int, nights: int, misc: int = 1500) -> int:
    return flight_price + hotel_price_per_night * nights + misc


def within_budget(total: int, budget: int) -> bool:
    return total <= budget
