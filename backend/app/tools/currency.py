"""Currency Converter Tool.

Uses the free, keyless https://open.er-api.com endpoint (real live rates,
updated daily, no signup needed). Falls back to a small static rate table
if the request fails (offline demo / no network), so this never breaks
a live demo.
"""
import httpx

FALLBACK_RATES_FROM_INR = {
    "USD": 0.012, "EUR": 0.011, "GBP": 0.0094, "AED": 0.044,
    "SGD": 0.016, "JPY": 1.78, "AUD": 0.018, "INR": 1.0,
}


def convert(amount: float, from_currency: str, to_currency: str) -> dict:
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()

    try:
        resp = httpx.get(f"https://open.er-api.com/v6/latest/{from_currency}", timeout=5)
        data = resp.json()
        if data.get("result") == "success":
            rate = data["rates"][to_currency]
            return {
                "amount": amount,
                "from": from_currency,
                "to": to_currency,
                "rate": rate,
                "converted": round(amount * rate, 2),
                "source": "live",
            }
    except Exception:
        pass

    # Fallback: only handles INR<->major currencies, good enough for a demo.
    if from_currency == "INR" and to_currency in FALLBACK_RATES_FROM_INR:
        rate = FALLBACK_RATES_FROM_INR[to_currency]
    elif to_currency == "INR" and from_currency in FALLBACK_RATES_FROM_INR:
        rate = 1 / FALLBACK_RATES_FROM_INR[from_currency]
    else:
        rate = 1.0
    return {
        "amount": amount,
        "from": from_currency,
        "to": to_currency,
        "rate": rate,
        "converted": round(amount * rate, 2),
        "source": "fallback_static_table",
    }
