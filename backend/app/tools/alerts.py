"""Alerts Tool - generates the small rotating list of live trip alerts
(weather changes, train/bus arrival warnings, etc.) shown in the UI.

Real implementation would hook into live transit + weather webhooks.
For now it derives plausible alerts from the trip's own stored state.
"""
import random


def build_alerts(state: dict) -> list[dict]:
    alerts = []
    results = state.get("results", {})
    weather = results.get("check_weather", {})

    if weather.get("condition") == "rain":
        alerts.append({
            "severity": "warning",
            "title": "Weather change expected",
            "message": "Rain likely in the next hour -- carry an umbrella and keep indoor backups handy.",
        })
    else:
        alerts.append({
            "severity": "info",
            "title": "Weather stable",
            "message": f"Conditions look {weather.get('condition', 'clear')} for the next few hours.",
        })

    alerts.append({
        "severity": "warning",
        "title": "Transit reminder",
        "message": "Your bus/train is arriving within the next 30 minutes -- head to the boarding point.",
    })

    if random.random() < 0.5:
        alerts.append({
            "severity": "info",
            "title": "Booking reminder",
            "message": "Don't forget to check in online for your flight 24 hours before departure.",
        })

    return alerts
