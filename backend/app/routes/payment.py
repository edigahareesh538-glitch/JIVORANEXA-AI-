"""Demo Payment Gateway.

NOT a real payment integration -- no UPI/card network is touched. This
exists so the booking flow has a realistic "confirm and pay" moment for a
demo, clearly labeled everywhere as Demo Payment. Records a real
in-app Notification + marks the trip as booked so the rest of the app
(dashboard, trip history) reflects it consistently.

To go live: swap this for Razorpay/Stripe/PayU -- the request/response
shape here already matches what a real create-order + confirm flow needs.
"""
import random
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import Notification, Trip, User

router = APIRouter(prefix="/api/payment", tags=["payment"])


class DemoChargeRequest(BaseModel):
    amount: float
    trip_id: str | None = None
    label: str = "Trip Booking"


@router.post("/demo-charge")
def demo_charge(req: DemoChargeRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    transaction_id = f"DEMO-{uuid.uuid4().hex[:10].upper()}"

    notif = Notification(
        user_id=user.id,
        type="trip",
        title="Payment Successful (Demo)",
        message=f"₹{req.amount:,.0f} for {req.label} -- transaction {transaction_id}. This is a simulated payment, no real money moved.",
    )
    db.add(notif)

    if req.trip_id:
        trip = db.get(Trip, req.trip_id)
        if trip and trip.user_id == user.id:
            trip.status = "booked"

    db.commit()

    return {
        "status": "success",
        "mode": "demo_payment",
        "transaction_id": transaction_id,
        "amount": req.amount,
        "message": "Demo Payment Successful — no real charge was made.",
    }
