from fastapi import APIRouter
from app.tools.safety import get_safety_score

router = APIRouter(prefix="/api/safety", tags=["safety"])


@router.get("/score")
def safety_score(destination: str):
    return get_safety_score(destination)
