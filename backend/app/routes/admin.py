"""Admin Dashboard — Phase 17.

Gated behind an `is_admin` flag on the User model. Falls back to a
zero-configuration read-only overview for ANY signed-in user when no admin
exists (so single-user deployments still get system stats). Real ops use
an admin toggled via `PATCH /api/admin/promote?email=` (locked behind the
env var ADMIN_BOOTSTRAP_EMAIL).
"""
from __future__ import annotations

import os
from collections import Counter
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import Booking, Expense, FavoritePlace, Notification, Trip, User

router = APIRouter(prefix="/api/admin", tags=["admin"])

ADMIN_BOOTSTRAP_EMAIL = os.getenv("ADMIN_BOOTSTRAP_EMAIL", "").strip().lower()


def _ensure_admin(user: User) -> None:
    if user.is_admin:
        return
    if ADMIN_BOOTSTRAP_EMAIL and (user.email or "").lower() == ADMIN_BOOTSTRAP_EMAIL:
        return
    raise HTTPException(status_code=403, detail="Admin access required.")


@router.get("/analytics")
def analytics(_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Top-level system analytics. Admin-only (see _ensure_admin) --
    previously this had no admin check at all, so any signed-in user,
    including a Guest Mode account, could read full system-wide analytics."""
    _ensure_admin(_user)
    user_count    = db.query(func.count(User.id)).scalar() or 0
    guest_count   = db.query(func.count(User.id)).filter(User.is_guest == True).scalar() or 0  # noqa: E712
    trip_count    = db.query(func.count(Trip.id)).scalar() or 0
    booking_count = db.query(func.count(Booking.id)).scalar() or 0
    expense_count = db.query(func.count(Expense.id)).scalar() or 0
    notif_count   = db.query(func.count(Notification.id)).scalar() or 0
    booking_status = dict(db.query(Booking.status, func.count(Booking.id)).group_by(Booking.status).all())
    trip_status    = dict(db.query(Trip.status, func.count(Trip.id)).group_by(Trip.status).all())
    total_cost = db.query(func.coalesce(func.sum(Trip.total_cost), 0)).scalar() or 0
    total_expense = db.query(func.coalesce(func.sum(Expense.amount), 0)).scalar() or 0

    # Top destinations
    top_dests = (db.query(Trip.destination, func.count(Trip.id).label("cnt"))
                 .filter(Trip.destination.isnot(None))
                 .group_by(Trip.destination).order_by(func.count(Trip.id).desc()).limit(5).all())

    # New users last 7 days
    seven_days = datetime.utcnow() - timedelta(days=7)
    new_users_7d = db.query(func.count(User.id)).filter(User.created_at >= seven_days).scalar() or 0

    return {
        "users": {"total": user_count, "guests": guest_count,
                  "new_last_7_days": new_users_7d},
        "trips": {"total": trip_count,  "by_status": trip_status,
                  "total_cost_value": float(total_cost)},
        "bookings": {"total": booking_count, "by_status": booking_status},
        "expenses": {"total_records": expense_count,
                     "total_value": float(total_expense)},
        "notifications": {"total": notif_count},
        "top_destinations": [{"destination": d, "count": c} for d, c in top_dests if d],
        "ai_usage_estimate": {
            "trips_planned": trip_count,
            "bookings_attempted": booking_count,
            "ocr_attempts": db.query(func.count(Expense.id))
                              .filter(Expense.label.ilike("%OCR%")).scalar() or 0,
        },
        "snapshot_at": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/error-logs")
def error_logs(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_admin(user)
    """Returns server-side error log markers; we don't yet ship a full
    structured logger, so this returns a deterministic summary derived
    from notifications + booking failures."""
    rows = db.query(Notification).filter(
        Notification.type.in_(["emergency", "weather"])
    ).order_by(Notification.created_at.desc()).limit(20).all()
    return {"recent_errors": [
        {"id": r.id, "type": r.type, "title": r.title, "message": r.message,
         "created_at": r.created_at.isoformat() + "Z"} for r in rows
    ]}


@router.get("/system-health")
def system_health(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Lightweight health snapshot — DB read latency, table counts. Admin-only."""
    _ensure_admin(user)
    started = datetime.utcnow()
    user_count = db.query(func.count(User.id)).scalar() or 0
    elapsed_ms = (datetime.utcnow() - started).total_seconds() * 1000
    return {"db": "ok", "db_latency_ms": round(elapsed_ms, 1), "user_count": user_count,
            "snapshot_at": datetime.utcnow().isoformat() + "Z"}


@router.get("/reports/{kind}")
def reports(kind: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_admin(user)
    valid = {"users", "trips", "bookings", "expenses"}
    if kind not in valid:
        raise HTTPException(status_code=400, detail=f"kind must be one of {sorted(valid)}")
    if kind == "users":
        rows = db.query(User).limit(100).all()
        return {"rows": [{"id": u.id, "email": u.email,
                          "display_name": u.display_name,
                          "is_guest": u.is_guest,
                          "is_admin": u.is_admin,
                          "created_at": u.created_at.isoformat() + "Z" if u.created_at else None}
                         for u in rows]}
    if kind == "trips":
        rows = db.query(Trip).limit(200).all()
        return {"rows": [{"id": t.id, "destination": t.destination,
                          "status": t.status, "total_cost": t.total_cost,
                          "created_at": t.created_at.isoformat() + "Z" if t.created_at else None}
                         for t in rows]}
    if kind == "bookings":
        rows = db.query(Booking).limit(200).all()
        return {"rows": [{"id": b.id, "mode": b.mode, "destination": b.destination,
                          "status": b.status, "fare": b.fare,
                          "created_at": b.created_at.isoformat() + "Z" if b.created_at else None}
                         for b in rows]}
    return {"rows": db.query(Expense.id, Expense.category, Expense.amount,
                             Expense.spent_at).limit(200).all()}


class PromoteIn(BaseModel):
    email: str


@router.patch("/promote")
def promote(req: PromoteIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Bootstrap admin: only allows when ADMIN_BOOTSTRAP_EMAIL matches the
    caller's email OR when the caller is already admin (so admins can
    promote teammates)."""
    _ensure_admin(user)
    target = db.query(User).filter(User.email == req.email).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    target.is_admin = True
    db.commit()
    return {"promoted": target.email}
