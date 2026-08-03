from fastapi import APIRouter
from app.tools.destination_preview import get_destination_preview

router = APIRouter(prefix="/api/preview", tags=["preview"])


@router.get("")
def preview(destination: str, lat: float | None = None, lng: float | None = None):
    """Google-Travel-style destination preview: rating, famous places, best
    season, live weather/crowd, distance from you, estimated 3-day cost."""
    current_location = {"lat": lat, "lng": lng} if lat is not None and lng is not None else None
    return get_destination_preview(destination, current_location)
