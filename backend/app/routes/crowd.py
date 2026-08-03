from fastapi import APIRouter
from app.tools.crowd import predict_crowd

router = APIRouter(prefix="/api/crowd", tags=["crowd"])


@router.get("/predict")
def predict(destination: str, travel_date: str | None = None):
    return predict_crowd(destination, travel_date)
