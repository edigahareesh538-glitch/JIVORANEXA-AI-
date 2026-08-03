from fastapi import APIRouter, Query
from app.tools.currency import convert

router = APIRouter(prefix="/api/currency", tags=["currency"])


@router.get("/convert")
def convert_currency(amount: float = Query(..., gt=0), from_currency: str = Query(..., alias="from"), to_currency: str = Query(..., alias="to")):
    return convert(amount, from_currency, to_currency)
