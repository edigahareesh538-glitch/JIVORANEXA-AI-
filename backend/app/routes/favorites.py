from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import FavoritePlace, User

router = APIRouter(prefix="/api/favorites", tags=["favorites"])


class FavoriteIn(BaseModel):
    name: str
    category: str | None = None
    lat: float | None = None
    lng: float | None = None
    destination: str | None = None


class FavoriteOut(BaseModel):
    id: str
    name: str
    category: str | None
    lat: float | None
    lng: float | None
    destination: str | None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=list[FavoriteOut])
def list_favorites(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(FavoritePlace).filter(FavoritePlace.user_id == user.id).all()


@router.post("", response_model=FavoriteOut)
def add_favorite(req: FavoriteIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    fav = FavoritePlace(user_id=user.id, **req.model_dump())
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return fav


@router.delete("/{favorite_id}")
def remove_favorite(favorite_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    fav = db.get(FavoritePlace, favorite_id)
    if not fav or fav.user_id != user.id:
        raise HTTPException(status_code=404, detail="Favorite not found.")
    db.delete(fav)
    db.commit()
    return {"deleted": favorite_id}
