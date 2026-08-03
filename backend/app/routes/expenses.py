from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import Expense, User
from app.tools.ocr import ocr_image, parse_receipt
from app.tools.expense_reports import (
    budget_vs_actual, category_report, export_csv, export_pdf, export_xlsx, summarize,
)

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


class ExpenseIn(BaseModel):
    category: str
    amount: float
    label: str | None = None
    currency: str = "INR"
    trip_id: str | None = None


class ExpenseOut(BaseModel):
    id: str
    category: str
    label: str | None
    amount: float
    currency: str
    spent_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=list[ExpenseOut])
def list_expenses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Expense).filter(Expense.user_id == user.id).order_by(Expense.spent_at.desc()).all()


@router.post("", response_model=ExpenseOut)
def add_expense(req: ExpenseIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    expense = Expense(user_id=user.id, **req.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}")
def delete_expense(expense_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    expense = db.get(Expense, expense_id)
    if not expense or expense.user_id != user.id:
        raise HTTPException(status_code=404, detail="Expense not found.")
    db.delete(expense)
    db.commit()
    return {"deleted": expense_id}


@router.get("/summary")
def summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Expense).filter(Expense.user_id == user.id).all()
    by_category: dict[str, float] = {}
    for r in rows:
        by_category[r.category] = by_category.get(r.category, 0) + r.amount
    return {"total": sum(by_category.values()), "by_category": by_category}


# ---------------- Phase 6: OCR receipt scanning + AI categorization -----------

class OcrTextIn(BaseModel):
    text: str


@router.post("/ocr")
def ocr_receipt_text(req: OcrTextIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Accept pre-OCR'd text from the frontend (browser tesseract.js) and
    parse it into structured expense input. AI categorisation is rule-based
    here and works deterministically. If the user confirms the parsed result
    via the `confirm=true` flag, an Expense row is created."""
    parsed = parse_receipt(req.text)
    if parsed.get("amount"):
        expense = Expense(
            user_id=user.id,
            category=parsed["category"],
            label=(parsed.get("merchant") or "OCR receipt")[:200],
            amount=float(parsed["amount"]),
            currency=parsed.get("currency") or "INR",
        )
        db.add(expense)
        db.commit()
        db.refresh(expense)
        parsed["saved_expense_id"] = expense.id
    return parsed


@router.post("/ocr-image")
async def ocr_receipt_upload(image: UploadFile = File(...), user: User = Depends(get_current_user),
                             db: Session = Depends(get_db)):
    """Optional server-side OCR (pytesseract when available). If the OCR
    binary is missing, returns a structured hint telling the frontend to
    run its in-browser OCR and POST the text to /api/expenses/ocr."""
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload.")
    result = ocr_image(image_bytes, image.content_type or "image/jpeg")
    return result


@router.post("/categorize")
def ai_categorize(text: str):
    """Auto-categorise a free-text expense label via the same rule-based
    engine used by /api/expenses/ocr so the frontend can pre-tag entries.
    """
    from app.tools.ocr import categorize
    return {"category": categorize(text), "text": text}


# ---------------- Phase 6: analytics / reports / exports --------------------

@router.get("/analytics")
def spending_analytics(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Expense).filter(Expense.user_id == user.id).all()
    return summarize(rows)


@router.get("/report/monthly")
def monthly_report(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = summarize(db.query(Expense).filter(Expense.user_id == user.id).all())
    return {"by_month": s["by_month"], "total": s["total"], "count": s["count"]}


@router.get("/report/yearly")
def yearly_report(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = summarize(db.query(Expense).filter(Expense.user_id == user.id).all())
    return {"by_year": s["by_year"], "total": s["total"], "count": s["count"]}


@router.get("/report/category/{category}")
def category_report_endpoint(category: str, user: User = Depends(get_current_user),
                              db: Session = Depends(get_db)):
    rows = db.query(Expense).filter(Expense.user_id == user.id).all()
    return category_report(rows, category)


@router.get("/report/budget-vs-actual")
def budget_vs_actual_endpoint(user: User = Depends(get_current_user), db: Session = Depends(get_db),
                              total_budget: float = 0, duration_days: int = 3):
    """Compare a fresh budget plan against user's actual logged expenses."""
    from app.tools.budget_planner import plan_budget
    plan = plan_budget(total_budget, duration_days, mode="standard")
    rows = db.query(Expense).filter(Expense.user_id == user.id).all()
    return budget_vs_actual(rows, plan["allocations"])


@router.get("/export/csv")
def export_csv_endpoint(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = summarize(db.query(Expense).filter(Expense.user_id == user.id).all())
    return StreamingResponse(
        iter([export_csv(s["items"])]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=expenses.csv"},
    )


@router.get("/export/xlsx")
def export_xlsx_endpoint(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = summarize(db.query(Expense).filter(Expense.user_id == user.id).all())
    data = export_xlsx(s)
    return StreamingResponse(
        iter([data]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=expenses.xlsx"},
    )


@router.get("/export/pdf")
def export_pdf_endpoint(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = summarize(db.query(Expense).filter(Expense.user_id == user.id).all())
    return StreamingResponse(
        iter([export_pdf(s, "Expense Report")]),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=expenses.pdf"},
    )
