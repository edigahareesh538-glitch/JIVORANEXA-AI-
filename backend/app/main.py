import os
import json
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware

from app.services.config import settings
from app.services.vision import identify_place
from app.memory.session import get_or_resume
from app.memory.state import memory_store
from app.workflow.executor import run_trip_planner
from app.response.pdf_generator import generate_booking_pdfs, OUTPUT_DIR
from app.tools.places import search_nearby
from app.tools.alerts import build_alerts
from app.db.database import init_db
from app.middleware.security import SecurityHeadersMiddleware, BodySizeLimitMiddleware, limiter

# Routers -- Priority 1 (auth) + new feature routes. Each is a thin
# APIRouter file under app/auth or app/routes; see README for the full list.
from app.auth.routes import router as auth_router
from app.routes.agents import router as agents_router
from app.routes.currency import router as currency_router
from app.routes.emergency import router as emergency_router
from app.routes.budget import router as budget_router
from app.routes.crowd import router as crowd_router
from app.routes.packing import router as packing_router
from app.routes.routing import router as routing_router
from app.routes.expenses import router as expenses_router
from app.routes.favorites import router as favorites_router
from app.routes.notifications import router as notifications_router
from app.routes.trips import router as trips_router
from app.routes.dashboard import router as dashboard_router
from app.routes.preview import router as preview_router
from app.routes.safety import router as safety_router
from app.routes.payment import router as payment_router
from app.routes.weather import router as weather_router
from app.routes.voice import router as voice_router
from app.routes.vision import router as vision_router
from app.routes.group import router as group_router
from app.routes.booking import router as booking_router
from app.routes.offline import router as offline_router
from app.routes.admin import router as admin_router
from app.routes.personalization import router as personalization_router

app = FastAPI(title="Autonomous Trip Planner Agent", version="2.0.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    init_db()
    # Phase 16: environment validation.
    #
    # BUGFIX (Phase 5-17 pass): this used to hard-crash the entire server
    # (raise -> uvicorn exits) the moment JWT_SECRET_KEY was left at the
    # value documented in .env.example / the README's "Quick start (zero
    # API keys required)" section. That meant a fresh checkout following
    # the README could never boot the backend at all -- not just Guest
    # Mode, EVERY endpoint was unreachable. Insecure-default checking is
    # now opt-in-to-enforce (ALLOW_INSECURE_DEFAULTS defaults to allowing
    # startup) so local/demo use keeps working out of the box; set
    # ALLOW_INSECURE_DEFAULTS=false explicitly in production to make this
    # a hard failure again once you've set a real JWT_SECRET_KEY.
    try:
        from app.services.env_validator import validate_environment
        allow = os.getenv("ALLOW_INSECURE_DEFAULTS", "true").lower() == "true"
        result = validate_environment(allow_insecure=allow)
        for w in result.get("warnings", []):
            print(f"[env] WARNING: {w}")
    except EnvironmentError as e:
        print(f"[env] FATAL: {e}")
        raise
    from app.services.logging import info
    info("startup", db=DATABASE_URL_STATUS(), routes=len(app.routes))


# Serve generated booking PDFs at /files/<session_id>/<filename>
os.makedirs(OUTPUT_DIR, exist_ok=True)
app.mount("/files", StaticFiles(directory=OUTPUT_DIR), name="files")

app.include_router(auth_router)
app.include_router(agents_router)
app.include_router(currency_router)
app.include_router(emergency_router)
app.include_router(budget_router)
app.include_router(crowd_router)
app.include_router(packing_router)
app.include_router(routing_router)
app.include_router(expenses_router)
app.include_router(favorites_router)
app.include_router(notifications_router)
app.include_router(trips_router)
app.include_router(dashboard_router)
app.include_router(preview_router)
app.include_router(safety_router)
app.include_router(payment_router)
app.include_router(weather_router)
app.include_router(voice_router)
app.include_router(vision_router)
app.include_router(group_router)
app.include_router(booking_router)
app.include_router(offline_router)
app.include_router(admin_router)
app.include_router(personalization_router)


class PlanRequest(BaseModel):
    message: str
    session_id: str | None = None
    current_location: dict | None = None
    transport_mode: str | None = None  # "flight" | "train" | "bus" | "own_vehicle" | "rental_car"


class BookRequest(BaseModel):
    session_id: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/plan")
def plan_trip(req: PlanRequest):
    session_id, _ = get_or_resume(req.session_id)
    if req.current_location:
        state = memory_store.get(session_id)
        state["current_location"] = req.current_location
        memory_store.save(session_id, state)
    result = run_trip_planner(session_id, req.message, current_location=req.current_location,
                               transport_mode_override=req.transport_mode)
    return {"session_id": session_id, **result}


@app.post("/api/plan-from-image")
async def plan_from_image(
    image: UploadFile = File(...),
    message: str = Form(default=""),
    session_id: str | None = Form(default=None),
    current_location_json: str | None = Form(default=None),
    transport_mode: str | None = Form(default=None),
):
    """Upload a photo of a place ('I want to go to this place') -- the agent
    identifies it, then runs the full trip-planning pipeline against it."""
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload.")

    place_info = identify_place(image_bytes, mime_type=image.content_type or "image/jpeg")
    destination = place_info.get("place") or place_info.get("city")

    # Give intent extraction something to parse budget/duration from, even
    # if the user didn't type anything alongside the photo.
    goal_text = message.strip() or f"Plan a trip to {place_info.get('place', destination)} under ₹20,000 for 3 days"

    session_id, _ = get_or_resume(session_id)
    current_location = None
    if current_location_json:
        try:
            current_location = json.loads(current_location_json)
            state = memory_store.get(session_id)
            state["current_location"] = current_location
            memory_store.save(session_id, state)
        except json.JSONDecodeError:
            current_location = None

    result = run_trip_planner(
        session_id,
        goal_text,
        destination_override=destination,
        place_info=place_info,
        current_location=current_location,
        transport_mode_override=transport_mode,
    )
    return {"session_id": session_id, **result}


@app.post("/api/book")
def book_trip(req: BookRequest):
    """Generates one PDF per booking (flight/hotel/bus/food) plus a
    combined zip, using the most recent plan stored for this session."""
    state = memory_store.get(req.session_id)
    plan = state.get("results", {}).get("generate_itinerary")
    if not plan:
        raise HTTPException(status_code=404, detail="No trip plan found for this session. Run the agent first.")

    files = generate_booking_pdfs(req.session_id, plan)
    base = f"/files/{req.session_id}"
    return {
        "session_id": req.session_id,
        "documents": [
            {"label": "Flight Ticket", "url": f"{base}/{files['flight']}"},
            {"label": "Hotel Confirmation", "url": f"{base}/{files['hotel']}"},
            {"label": "Bus Ticket", "url": f"{base}/{files['bus']}"},
            {"label": "Food Order Status", "url": f"{base}/{files['food']}"},
        ],
        "download_all_url": f"{base}/{files['all_zip']}",
    }


@app.get("/api/help/nearby")
def help_nearby(session_id: str, query: str, lat: float | None = None, lng: float | None = None, label: str | None = None):
    """Powers the 'help chat' -- e.g. 'near any hospital of my current destination'."""
    state = memory_store.get(session_id)
    plan = state.get("results", {}).get("generate_itinerary")
    destination = plan["destination"] if plan else "Hyderabad"
    current_location = state.get("current_location")
    if lat is not None and lng is not None:
        current_location = {"lat": lat, "lng": lng, "label": label or "Current Location"}
        state["current_location"] = current_location
        memory_store.save(session_id, state)
    results = search_nearby(destination, query, current_location=current_location)
    return {"query": query, "destination": destination, "results": results}


@app.get("/api/alerts")
def get_alerts(session_id: str):
    """Powers the rotating live alert banner (weather change, transit reminders, etc.)."""
    state = memory_store.get(session_id)
    return {"alerts": build_alerts(state)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)


def DATABASE_URL_STATUS() -> str:  # pragma: no cover - helper for logs
    from app.db.database import USING_SQLITE_FALLBACK, DATABASE_URL
    return ("sqlite:" + DATABASE_URL.split("@")[-1]) if USING_SQLITE_FALLBACK else "postgres"
