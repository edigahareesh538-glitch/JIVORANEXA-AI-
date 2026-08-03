from fastapi import APIRouter
from app.tools.packing import build_packing_list

router = APIRouter(prefix="/api/packing", tags=["packing"])


@router.get("/checklist")
def checklist(destination: str, weather_condition: str = "clear", duration_days: int = 3):
    return {"destination": destination, "items": build_packing_list(destination, weather_condition, duration_days)}
