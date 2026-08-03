from fastapi import APIRouter
from app.tools.routing import live_distance_eta

router = APIRouter(prefix="/api/route", tags=["routing"])


@router.get("/eta")
def eta(destination: str, lat: float, lng: float, mode: str = "driving"):
    """Real Maps: live distance + ETA from the user's current lat/lng to a destination."""
    return live_distance_eta({"lat": lat, "lng": lng}, destination, mode)
