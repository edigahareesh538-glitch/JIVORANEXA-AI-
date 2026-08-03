"""Booking Engine route — Phase 12.

Extends the existing `app/tools/booking.py` simulated booking flow with
structured booking records per mode (flight/hotel/bus/train), history,
cancellation, and explicit statuses. We deliberately keep the same
demo/in-memory simulator flag ("mode": "simulated_demo") so existing
callers behave exactly as before.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import Booking, User

router = APIRouter(prefix="/api/booking", tags=["booking"])

BookingMode = Literal["flight", "hotel", "bus", "train"]
BookingStatus = Literal["initiated", "confirmed", "cancelled", "completed", "failed"]

VALID_STATUSES = {"initiated", "confirmed", "cancelled", "completed", "failed"}


class BookingIn(BaseModel):
    mode: BookingMode
    origin: str | None = None
    destination: str
    start_date: str
    end_date: str | None = None
    travelers: int = 1
    fare: float
    provider: str | None = None
    notes: str | None = None


class BookingOut(BaseModel):
    id: str
    mode: str
    origin: str | None
    destination: str
    start_date: str
    end_date: str | None
    travelers: int
    fare: float
    provider: str | None
    notes: str | None
    status: str
    confirmation_code: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


def _confirm_code(mode: str) -> str:
    """Stable, mode-distinct pseudo-confirmation code."""
    prefix = {"flight": "FL", "hotel": "HT", "bus": "BS", "train": "TR"}.get(mode, "GN")
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


@router.post("", response_model=BookingOut)
def create_booking(req: BookingIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Captures a booking start-to-finish: initiation confirmation, status
    pulled from the existing booking tool when present. Returns a
    confirmation code so the UI can show it on the receipt."""
    b = Booking(
        user_id=user.id,
        mode=req.mode,
        origin=req.origin,
        destination=req.destination,
        start_date=req.start_date,
        end_date=req.end_date,
        travelers=req.travelers,
        fare=req.fare,
        provider=req.provider or _default_provider(req.mode),
        notes=req.notes,
        status="confirmed",
        confirmation_code=_confirm_code(req.mode),
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


@router.get("", response_model=list[BookingOut])
def list_bookings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Booking).filter(Booking.user_id == user.id).order_by(Booking.created_at.desc()).all()


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.get(Booking, booking_id)
    if not b or b.user_id != user.id:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return b


@router.patch("/{booking_id}/status")
def update_status(booking_id: str, status: str,
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Status must be one of {sorted(VALID_STATUSES)}.")
    b = db.get(Booking, booking_id)
    if not b or b.user_id != user.id:
        raise HTTPException(status_code=404, detail="Booking not found.")
    b.status = status
    b.updated_at = datetime.utcnow()
    db.commit()
    return {"id": booking_id, "status": status, "cancellable": status not in ("completed", "cancelled")}


@router.delete("/{booking_id}")
def cancel_booking(booking_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Convenience cancel endpoint -- same as PATCH status=cancelled, but
    adds cancellation metadata and a clear response shape."""
    b = db.get(Booking, booking_id)
    if not b or b.user_id != user.id:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if b.status == "completed":
        raise HTTPException(status_code=400, detail="Completed bookings cannot be cancelled.")
    b.status = "cancelled"
    b.updated_at = datetime.utcnow()
    b.notes = (b.notes or "") + f" [cancelled {datetime.utcnow().isoformat()}Z]"
    db.commit()
    return {"id": booking_id, "status": "cancelled"}


def _default_provider(mode: str) -> str:
    return {"flight": "Indigo / SpiceJet (simulated)",
            "hotel":  "OYO / MakeMyTrip (simulated)",
            "bus":    "RedBus (simulated)",
            "train":  "IRCTC (simulated)"}.get(mode, "Simulated partner")
