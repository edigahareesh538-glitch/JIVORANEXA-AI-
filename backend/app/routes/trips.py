from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import Trip, User

router = APIRouter(prefix="/api/trips", tags=["trips"])


class SaveTripIn(BaseModel):
    session_id: str
    destination: str
    budget: float | None = None
    total_cost: float | None = None
    itinerary_json: dict


class TripOut(BaseModel):
    id: str
    session_id: str
    destination: str
    budget: float | None
    total_cost: float | None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("", response_model=TripOut)
def save_trip(req: SaveTripIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Persists a plan result (from POST /api/plan) into this user's trip
    history so it survives page reloads / logins from another device."""
    trip = Trip(user_id=user.id, **req.model_dump())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.get("", response_model=list[TripOut])
def list_trips(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Trip).filter(Trip.user_id == user.id).order_by(Trip.created_at.desc()).all()


@router.get("/{trip_id}")
def get_trip(trip_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    trip = db.get(Trip, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trip not found.")
    return {
        "id": trip.id, "session_id": trip.session_id, "destination": trip.destination,
        "budget": trip.budget, "total_cost": trip.total_cost, "status": trip.status,
        "itinerary_json": trip.itinerary_json, "created_at": trip.created_at,
    }


@router.get("/{trip_id}/summary")
def trip_summary(trip_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    trip = db.get(Trip, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trip not found.")

    itin = trip.itinerary_json or {}
    route = itin.get("route") or {}
    days = (itin.get("trip_summary") or "").count("Day") or 3

    return {
        "id": trip.id,
        "destination": trip.destination,
        "status": trip.status,
        "days": days,
        "distance_km": _path_length_km(route["path"]) if route.get("path") else None,
        "total_cost": trip.total_cost,
        "budget": trip.budget,
        "places_visited": itin.get("attractions", []),
        "created_at": trip.created_at,
    }


def _path_length_km(path: list[list[float]]) -> float:
    from app.tools.geocode import _haversine_km

    total = 0.0
    for a, b in zip(path, path[1:]):
        total += _haversine_km(a[0], a[1], b[0], b[1])
    return round(total, 1)


@router.patch("/{trip_id}/status")
def update_status(trip_id: str, status: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    trip = db.get(Trip, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trip not found.")
    trip.status = status
    trip.updated_at = datetime.utcnow()
    db.commit()
    return {"id": trip_id, "status": status}


@router.delete("/{trip_id}")
def delete_trip(trip_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    trip = db.get(Trip, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trip not found.")
    db.delete(trip)
    db.commit()
    return {"deleted": trip_id}


@router.post("/{trip_id}/duplicate", response_model=TripOut)
def duplicate_trip(trip_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    trip = db.get(Trip, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status_code=404, detail="Trip not found.")
    duplicate = Trip(
        user_id=user.id,
        session_id=trip.session_id,
        destination=trip.destination,
        budget=trip.budget,
        total_cost=trip.total_cost,
        status="planned",
        itinerary_json=trip.itinerary_json,
    )
    db.add(duplicate)
    db.commit()
    db.refresh(duplicate)
    return duplicate
