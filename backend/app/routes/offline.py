"""Offline Mode support — Phase 13.

The frontend stores a service-worker cache (see frontendbest/public/sw.js
style helpers and the README's offline roadmap). This route gives the
client a stable, deterministic payload to cache:
  /api/offline/itinerary       – the most recent itinerary for the user
  /api/offline/maps-cache      – tile-coordinates for planned route, so
                                 the app shell can prefetch OSM tiles
  /api/offline/contacts        – the user's saved emergency contacts +
                                 global helplines, ready to display offline
  /api/offline/destinations    – top destinations for offline browse
  /api/offline/expenses        – last 100 expenses CSV-style payload

Everything here is keyed by JWT (auth-protected) so the offline cache only
holds the current user's slice.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import Expense, FavoritePlace, Trip, User

router = APIRouter(prefix="/api/offline", tags=["offline"])


@router.get("/itinerary")
def offline_itinerary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    saved = db.query(Trip).filter(Trip.user_id == user.id).order_by(Trip.created_at.desc()).first()
    if not saved or not saved.itinerary_json:
        return {"cached": False, "message": "No saved itinerary yet — plan a trip first."}
    plan = saved.itinerary_json
    return {
        "cached": True,
        "cached_at": datetime.utcnow().isoformat() + "Z",
        "destination": saved.destination,
        "budget": saved.budget,
        "total_cost": saved.total_cost,
        "itinerary": plan,
    }


@router.get("/maps-cache")
def offline_maps_cache(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns tile priors to prefetch: the bounding box covering the
    destination + hotel + nearby hubs from the user's saved itinerary."""
    saved = db.query(Trip).filter(Trip.user_id == user.id).order_by(Trip.created_at.desc()).first()
    if not saved:
        return {"tiles": [], "route_points": []}
    plan = saved.itinerary_json or {}
    route = plan.get("route") or {}
    points = route.get("points", [])
    if not points:
        return {"tiles": [], "route_points": []}
    lats = [p["lat"] for p in points if "lat" in p]
    lngs = [p["lng"] for p in points if "lng" in p]
    bbox = {"min_lat": min(lats), "max_lat": max(lats), "min_lng": min(lngs), "max_lng": max(lngs)}
    # 16 tiles around the bbox; OSM slippy tile coords at zoom 11.
    z = 11
    tiles = []
    seen = set()
    for lat in [bbox["min_lat"], bbox["max_lat"]]:
        for lng in [bbox["min_lng"], bbox["max_lng"]]:
            tx = int((lng + 180) / 360 * (2 ** z))
            ty = int((1 - _log_tan(lat)) * (2 ** (z - 1)))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    key = (tx + dx, ty + dy)
                    if key in seen:
                        continue
                    seen.add(key)
                    tiles.append({"z": z, "x": tx + dx, "y": ty + dy,
                                  "url": f"https://tile.openstreetmap.org/{z}/{tx + dx}/{ty + dy}.png"})
    return {"tiles": tiles[:32], "route_points": points, "bbox": bbox}


@router.get("/contacts")
def offline_contacts(user: User = Depends(get_current_user)):
    return {
        "personal": {"name": user.emergency_contact_name, "phone": user.emergency_contact_phone},
        "global": {
            "India Police": "100", "Ambulance": "108", "Fire": "101",
            "National Emergency": "112", "Women's Helpline": "1091", "Tourist Helpline": "1363",
        },
        "cached_at": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/destinations")
def offline_destinations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    favorites = db.query(FavoritePlace).filter(FavoritePlace.user_id == user.id).all()
    recent = db.query(Trip).filter(Trip.user_id == user.id).order_by(Trip.created_at.desc()).limit(8).all()
    return {
        "favorites": [{"name": f.name, "destination": f.destination} for f in favorites],
        "recent":    [{"destination": t.destination, "created_at": t.created_at.isoformat() + "Z"}
                      for t in recent if t.destination],
    }


@router.get("/expenses")
def offline_expenses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Expense).filter(Expense.user_id == user.id) \
                            .order_by(Expense.spent_at.desc()).limit(100).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "category", "label", "amount", "currency", "spent_at"])
    for r in rows:
        writer.writerow([r.id, r.category, r.label or "", r.amount, r.currency or "INR",
                         r.spent_at.isoformat() if r.spent_at else ""])
    return {"rows_csv": buf.getvalue(), "count": len(rows),
            "cached_at": datetime.utcnow().isoformat() + "Z"}


def _log_tan(lat: float) -> float:
    import math
    s = math.sin(math.radians(lat))
    if s <= 0:
        return 0
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) / math.pi
