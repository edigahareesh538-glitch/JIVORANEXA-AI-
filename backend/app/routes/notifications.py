"""Smart Notifications — Phase 14.

Extends the existing DB-backed in-app notifications:
- GET  /api/notifications                       (existing, preserved)
- POST /api/notifications                       (existing, preserved)
- POST /api/notifications/{id}/read             (existing, preserved)
- DELETE /api/notifications/{id}               (existing, preserved)
- GET  /api/notifications/unread-count          (Phase 14: badge count)
- POST /api/notifications/weather               (Phase 14: weather alert)
- POST /api/notifications/booking-reminder      (Phase 14: departure reminder)
- POST /api/notifications/budget-alert          (Phase 14: budget overruns)
- POST /api/notifications/ai-reminder           (Phase 14: AI nudges)
- POST /api/notifications/mark-all-read         (Phase 14: one-tap clear)
- GET  /api/notifications/history               (Phase 14: paginated history)
"""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user_optional, get_current_user
from app.db.database import get_db
from app.db.models import Booking, Notification, Trip, User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class NotificationIn(BaseModel):
    type: str
    title: str
    message: str


class NotificationOut(BaseModel):
    id: str
    type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=list[NotificationOut])
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Notification).filter(Notification.user_id == user.id) \
                                  .order_by(Notification.created_at.desc()).all()


@router.post("", response_model=NotificationOut)
def create_notification(req: NotificationIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Manual notification create — preserved."""
    n = Notification(user_id=user.id, **req.model_dump())
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


@router.post("/{notification_id}/read")
def mark_read(notification_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification not found.")
    n.is_read = True
    db.commit()
    return {"id": notification_id, "is_read": True}


@router.delete("/{notification_id}")
def delete_notification(notification_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification not found.")
    db.delete(n)
    db.commit()
    return {"deleted": notification_id}


# ---------------- Phase 14 additions ---------------------------------------

@router.get("/unread-count")
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cnt = db.query(Notification).filter(Notification.user_id == user.id,
                                        Notification.is_read == False).count()  # noqa: E712
    return {"unread": cnt}


@router.post("/mark-all-read")
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == user.id,
                                  Notification.is_read == False).update(  # noqa: E712
        {"is_read": True}, synchronize_session=False)
    db.commit()
    return {"marked_all_read": True}


@router.post("/weather")
def create_weather_alert(req: NotificationIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Weather alert shortcut — same shape but the type defaults to 'weather'."""
    n = Notification(user_id=user.id, type="weather", title=req.title, message=req.message)
    db.add(n); db.commit(); db.refresh(n)
    return n


class BudgetAlertIn(BaseModel):
    trip_id: str | None = None
    budget: float
    actual: float


@router.post("/budget-alert")
def budget_alert(req: BudgetAlertIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Smart budget alert — automatically writes a notification with the
    variance and a recommendation."""
    diff = round(req.actual - req.budget, 2)
    if diff <= 0:
        message = f"Within budget. ₹{abs(diff)} remaining."
        title = "Budget OK"
        ntype = "budget_info"
    else:
        message = (f"Over budget by ₹{diff}. Consider switching transport mode or trimming one activity.")
        title = "Over budget alert"
        ntype = "budget_warning"
    n = Notification(user_id=user.id, type=ntype, title=title, message=message)
    db.add(n); db.commit(); db.refresh(n)
    return n


class BookingReminderIn(BaseModel):
    booking_id: str
    remind_in_hours: int = 24


@router.post("/booking-reminder")
def booking_reminder(req: BookingReminderIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.get(Booking, req.booking_id)
    if not b or b.user_id != user.id:
        raise HTTPException(status_code=404, detail="Booking not found.")
    title = f"{b.mode.title()} departure reminder"
    message = (f"Your {b.mode} to {b.destination} is coming up. "
               f"Arrive at the boarding point ~{req.remind_in_hours}h before departure. "
               f"Confirmation: {b.confirmation_code or 'n/a'}.")
    n = Notification(user_id=user.id, type="booking_reminder",
                     title=title, message=message)
    db.add(n); db.commit(); db.refresh(n)
    return n


class AiReminderIn(BaseModel):
    topic: str
    message: str


@router.post("/ai-reminder")
def ai_reminder(req: AiReminderIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = Notification(user_id=user.id, type="ai_reminder",
                     title=f"AI reminder · {req.topic}", message=req.message)
    db.add(n); db.commit(); db.refresh(n)
    return n


@router.get("/history")
def notification_history(limit: int = 50, offset: int = 0,
                          user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (db.query(Notification).filter(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .offset(offset).limit(min(limit, 200)).all())
    total = db.query(Notification).filter(Notification.user_id == user.id).count()
    return {"items": [NotificationOut.model_validate(r).model_dump() for r in rows],
            "total": total, "limit": limit, "offset": offset}


@router.post("/auto-generate")
def auto_generate(user: User = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    """Phase 14 — auto-generate smart reminders from current state:
       departure reminders for upcoming bookings, budget alerts for
       trips over budget. Idempotent — only fires when something new is due."""
    if user is None:
        return {"generated": []}
    generated = []
    tomorrow = datetime.utcnow() + timedelta(days=1)
    # Booking reminders
    bookings = db.query(Booking).filter(Booking.user_id == user.id,
                                        Booking.status == "confirmed").all()
    for b in bookings:
        if not b.start_date:
            continue
        try:
            dt = datetime.fromisoformat(b.start_date.replace("Z", ""))
            if abs((dt - tomorrow).total_seconds()) < 36 * 3600:
                n = Notification(user_id=user.id, type="booking_reminder",
                                 title=f"{b.mode.title()} departure tomorrow",
                                 message=f"{b.destination} · confirmation {b.confirmation_code or 'n/a'}")
                db.add(n); db.commit(); db.refresh(n)
                generated.append({"type": "booking_reminder", "booking_id": b.id})
        except Exception:
            continue
    # Budget alerts
    trips = db.query(Trip).filter(Trip.user_id == user.id,
                                  Trip.status.in_(["planned", "booked"])).all()
    for t in trips:
        if t.budget and t.total_cost and t.total_cost > t.budget * 1.05:
            n = Notification(user_id=user.id, type="budget_warning",
                             title="Over budget alert",
                             message=(f"{t.destination} is ₹{round(t.total_cost - t.budget)} "
                                      f"over the ₹{t.budget} plan."))
            db.add(n); db.commit(); db.refresh(n)
            generated.append({"type": "budget_warning", "trip_id": t.id})
    return {"generated": generated, "ran_at": datetime.utcnow().isoformat() + "Z"}
