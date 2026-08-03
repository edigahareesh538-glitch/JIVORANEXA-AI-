import os
import json
import requests
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
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

# Routers
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


def DATABASE_URL_STATUS() -> str:  # pragma: no cover - helper for logs
    from app.db.database import USING_SQLITE_FALLBACK, DATABASE_URL
    return ("sqlite:" + DATABASE_URL.split("@")[-1]) if USING_SQLITE_FALLBACK else "postgres"


@app.on_event("startup")
def _startup():
    init_db()
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


# --- Google OAuth Direct Integration Routes ---
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "https://jivoranexa-ai-1.onrender.com/api/auth/google/callback")

@app.get("/api/auth/google")
def login_google():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google Client ID not configured on backend.")
    
    google_auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={GOOGLE_REDIRECT_URI}&"
        f"response_type=code&"
        f"scope=openid%20email%20profile"
    )
    return RedirectResponse(url=google_auth_url)

@app.get("/api/auth/google/callback")
def google_callback(code: str):
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    token_res = requests.post(token_url, data=token_data)
    if token_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch token from Google")
    
    token_info = token_res.json()
    access_token = token_info.get("access_token")

    user_info_res = requests.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    if user_info_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch user info from Google")
    
    user_info = user_info_res.json()
    email = user_info.get("email")
    
    frontend_url = os.getenv("FRONTEND_URL", "https://jivoranexa-ai-1.vercel.app")
    return RedirectResponse(url=f"{frontend_url}/profile?login_success=true&email={email}")


class PlanRequest(BaseModel):
    message: str
    session_id: str | None = None
    current_location: dict | None = None
    transport_mode: str | None = None


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
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload.")

    place_info = identify_place(image_bytes, mime_type=image.content_type or "image/jpeg")
    destination = place_info.get("place") or place_info.get("city")
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
    state = memory_store.get(session_id)
    return {"alerts": build_alerts(state)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)