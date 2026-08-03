"""Emergency SOS — Phase 7 expansion.

Extends the existing free, keyless OpenStreetMap snapshot to add:
- Live GPS endpoint (server-side echo + nearest geocode fallback)
- Emergency contact lookup (from user profile)
- Crash detection hooks (exposes a structured endpoint; the client posts
  accelerometer/tilt data, server records a notification)
- One-tap calling instructions + SMS payload preparation
- Better loading/error contract (explicit status fields per category)
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user_optional
from app.db.database import get_db
from app.db.models import Notification, User
from app.tools.emergency import EMERGENCY_CATEGORIES, get_sos_snapshot
from app.tools.geocode import resolve_place

router = APIRouter(prefix="/api/emergency", tags=["emergency"])


@router.get("/sos")
def sos(destination: str, lat: float | None = None, lng: float | None = None,
        label: str | None = None, radius_m: int = 8000):
    """Existing keyless SOS snapshot — preserved.
    `radius_m` lets the client widen the search when nothing is close."""
    current_location = {"lat": lat, "lng": lng, "label": label} if lat is not None and lng is not None else None
    snapshot = get_sos_snapshot(destination, current_location, radius_m=radius_m)
    # --- enrichment: live GPS hint + status field per category ---
    live_gps = bool(lat is not None and lng is not None)
    enriched_categories = {}
    for key, value in snapshot["categories"].items():
        enriched_categories[key] = {
            **value,
            "status": "ok" if value["places"] else "empty",
            "checked_at": datetime.utcnow().isoformat() + "Z",
        }
    return {**snapshot, "categories": enriched_categories, "live_gps": live_gps,
            "radius_m": radius_m}


@router.get("/gps")
def live_gps(lat: float = Query(...), lng: float = Query(...)):
    """Reverse-geocode an arbitrary coordinate to a friendly label so the
    frontend badge 'You are near <place>' updates live."""
    center = resolve_place(f"{round(lat,4)},{round(lng,4)}", allow_fallback=False)
    if not center:
        return {"lat": lat, "lng": lng, "label": "Current Location",
                "source": "no_reverse_geocode"}
    return {"lat": lat, "lng": lng, "label": center["label"], "city": center.get("city"),
            "source": center.get("source", "live")}


@router.get("/contacts")
def emergency_contacts(user: User | None = Depends(get_current_user_optional)):
    """One endpoint that returns the user's saved emergency contact plus our
    built-in India helpline list — the SOS screen calls this once on mount."""
    profile = None
    if user is not None:
        profile = {"name": user.emergency_contact_name, "phone": user.emergency_contact_phone}
    return {
        "profile_contact": profile,
        "global": {
            "India Police": "100",
            "Ambulance": "108",
            "Fire": "101",
            "National Emergency Number": "112",
            "Women's Helpline": "1091",
            "Tourist Helpline": "1363",
            "International Emergency": "112",
        },
        "has_personal_contact": bool(profile and profile.get("name") and profile.get("phone")),
    }


class SmsPayloadIn(BaseModel):
    """Used to prepare an SMS draft to the emergency contact with the user's
    live GPS + destination. The frontend opens the native SMS app with this
    pre-filled body — no SMS is actually sent server-side."""
    contact_name: str | None = None
    contact_phone: str | None = None
    lat: float | None = None
    lng: float | None = None
    label: str | None = None
    destination: str | None = None
    notes: str | None = None


@router.post("/sms-payload")
def sms_payload(req: SmsPayloadIn):
    """Build a one-tap emergency SMS payload (no message is sent)."""
    location = ""
    if req.lat is not None and req.lng is not None:
        maps = f"https://www.google.com/maps?q={req.lat},{req.lng}"
        location = f" {req.label or 'live'} ({maps})" if req.label else f" {maps}"
    elif req.destination:
        location = f" near {req.destination}"
    body = (f"Emergency - I need help{location}."
            + (f"\n\n{req.notes}" if req.notes else ""))
    phone = (req.contact_phone or "").replace(" ", "").replace("-", "")
    if phone and not phone.startswith("+"):
        phone = "+91" + phone if len(phone) == 10 else "+" + phone
    return {"to": phone, "body": body, "sms_uri": f"sms:{phone}?body={body.replace(' ', '%20').replace('\n', '%0A')}"
                                       if phone else None}


class CrashReportIn(BaseModel):
    lat: float | None = None
    lng: float | None = None
    label: str | None = None
    impact_g: float | None = None
    details: str | None = None


@router.post("/crash")
def crash_hook(req: CrashReportIn, user: User | None = Depends(get_current_user_optional),
               db: Session | None = Depends(get_db)):
    """Crash-detection hook: frontend watches accelerometer/tilt; on a hard
    impact it POSTs here. Without auth we still record the alert shape so it
    can be returned to the UI; WITH auth we also drop an in-app notification."""
    payload = {
        "type": "crash",
        "received_at": datetime.utcnow().isoformat() + "Z",
        **req.model_dump(),
    }
    notification_id = None
    if user is not None and db is not None:
        lat = req.lat
        lng = req.lng
        loc = f" @ {req.label}" if req.label else (f" ({lat},{lng})" if lat is not None and lng is not None else "")
        n = Notification(
            user_id=user.id,
            type="emergency",
            title="Crash detection alert",
            message=f"Possible crash detected{loc}. Tap to view SOS options.",
        )
        db.add(n)
        db.commit()
        db.refresh(n)
        notification_id = n.id
    return {"recorded": True, "payload": payload, "notification_id": notification_id}
