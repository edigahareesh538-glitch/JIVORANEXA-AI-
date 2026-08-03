from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user_optional
from app.db.database import get_db
from app.db.models import Expense, User

from app.tools.budget_planner import plan_budget
from app.tools.budget_optimizer import optimize_budget

router = APIRouter(prefix="/api/budget", tags=["budget"])


class BudgetPlanRequest(BaseModel):
    total_budget: float
    duration_days: int = 3
    destination: str | None = None
    mode: str = "standard"  # budget | standard | luxury (Phase 5)


class BudgetOptimizeRequest(BaseModel):
    current_total: float
    budget: float
    transport_mode: str = "flight"
    hotel_price_per_night: float | None = None
    nights: int = 2


@router.post("/plan")
def plan(req: BudgetPlanRequest):
    """Phase-5 planner: budget split + cheapest transport & hotel, daily
    spending plan, savings tips, cost prediction, comparison vs your budget,
    and visual-chart rows. `mode` is budget | standard | luxury."""
    return plan_budget(req.total_budget, req.duration_days, req.destination, mode=req.mode)


@router.post("/optimize")
def optimize(req: BudgetOptimizeRequest):
    """AI Budget Optimizer: suggests concrete swaps when a plan comes in
    over budget and recomputes a new total."""
    return optimize_budget(req.current_total, req.budget, req.transport_mode, req.hotel_price_per_night, req.nights)


@router.get("/compare")
def compare_to_actuals(user: User | None = Depends(get_current_user_optional),
                       db: Session | None = Depends(get_db),
                       budget: float = 0, duration_days: int = 3,
                       destination: str | None = None):
    """Phase-6 hook: returns the planned split alongside the user's actual
    logged expenses for comparison."""
    plan = plan_budget(budget, duration_days, destination)
    if user is None or db is None:
        plan["actuals"] = None
        plan["variance"] = None
        return plan
    rows = db.query(Expense).filter(Expense.user_id == user.id).all()
    actuals = {}
    for r in rows:
        actuals[r.category] = round(actuals.get(r.category, 0) + r.amount, 2)
    plan["actuals"] = actuals
    plan["variance"] = {
        cat: round(plan["allocations"].get(cat, 0) - actuals.get(cat, 0), 2)
        for cat in set(list(plan["allocations"].keys()) + list(actuals.keys()))
    }
    return plan
