from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import Expense, FavoritePlace, Trip, User

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    trips = db.query(Trip).filter(Trip.user_id == user.id).order_by(Trip.created_at.desc()).all()
    favorites = db.query(FavoritePlace).filter(FavoritePlace.user_id == user.id).all()
    expenses = db.query(Expense).filter(Expense.user_id == user.id).all()

    completed = [t for t in trips if t.status in ("completed", "booked")]
    saved = [t for t in trips if t.status == "planned"]
    visited_cities = sorted({t.destination for t in trips if t.destination})
    total_spent = sum(e.amount for e in expenses)

    return {
        "profile": {
            "id": user.id,
            "display_name": user.display_name,
            "email": user.email,
            "is_guest": user.is_guest,
            "member_since": user.created_at,
        },
        "analytics": {
            "total_trips": len(trips),
            "completed_trips": len(completed),
            "saved_trips": len(saved),
            "visited_cities": visited_cities,
            "total_expenses": round(total_spent, 2),
            "favorite_places_count": len(favorites),
        },
        "recent_trips": [
            {"id": t.id, "destination": t.destination, "status": t.status, "total_cost": t.total_cost, "created_at": t.created_at}
            for t in trips[:5]
        ],
        "favorite_places": [{"id": f.id, "name": f.name, "destination": f.destination} for f in favorites[:10]],
    }
