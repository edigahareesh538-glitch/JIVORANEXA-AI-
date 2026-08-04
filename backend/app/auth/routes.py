import uuid
import os
import logging
import requests
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.auth.deps import get_current_user
from app.auth.firebase import FIREBASE_ENABLED, verify_id_token
from app.auth.schemas import GoogleLoginRequest, LoginRequest, ProfileUpdate, RegisterRequest, TokenOut, UserOut
from app.auth.security import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.db.models import User

logger = logging.getLogger("app.auth")

router = APIRouter(tags=["auth"])

# NOTE: Google/Frontend env vars are intentionally NOT read at module scope
# here. Reading them at import time means their values are frozen the
# moment this module is first imported by main.py at process boot -- if
# Render restarts the app after an env var is rotated (or if the var is
# briefly unset during a deploy), stale/empty values would get baked in
# until the next full redeploy. Reading them with os.getenv() inside each
# route function guarantees every request sees the current environment.


@router.post("/register", response_model=TokenOut)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = User(
        email=req.email,
        display_name=req.display_name or req.email.split("@")[0],
        auth_provider="password",
        is_guest=False,
    )
    user.photo_url = None
    db.add(user)
    db.flush()

    _store_password(db, user.id, req.password)
    db.commit()
    db.refresh(user)

    token = create_access_token(user_id=user.id, is_guest=False)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not _check_password(db, user.id, req.password):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    user.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token(user_id=user.id, is_guest=False)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


# --- Google OAuth: browser redirect flow ------------------------------------
# This is the ONLY place /api/auth/google and /api/auth/google/callback
# should be defined. Do not add matching routes directly on the FastAPI
# `app` object in main.py -- that previously created two handlers bound
# to the same path, which is what caused the 404 you were seeing.
@router.get("/google")
def login_google_redirect():
    google_client_id = os.getenv("GOOGLE_CLIENT_ID")
    google_redirect_uri = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "https://jivoranexa-ai.onrender.com/api/auth/google/callback",
    )

    if not google_client_id:
        raise HTTPException(status_code=500, detail="Google Client ID not configured on backend.")

    google_auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={google_client_id}&"
        f"redirect_uri={google_redirect_uri}&"
        f"response_type=code&"
        f"scope=openid%20email%20profile"
    )
    return RedirectResponse(url=google_auth_url)


@router.get("/google/callback")
def google_callback(code: str, db: Session = Depends(get_db)):
    google_client_id = os.getenv("GOOGLE_CLIENT_ID")
    google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    google_redirect_uri = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "https://jivoranexa-ai.onrender.com/api/auth/google/callback",
    )

    if not google_client_id or not google_client_secret:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured on backend.")

    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "code": code,
        "client_id": google_client_id,
        "client_secret": google_client_secret,
        "redirect_uri": google_redirect_uri,
        "grant_type": "authorization_code",
    }

    try:
        token_res = requests.post(token_url, data=token_data, timeout=10)
    except requests.RequestException as e:
        logger.error("Google token exchange request failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not reach Google to exchange token.")

    if token_res.status_code != 200:
        logger.error("Google token exchange failed: %s %s", token_res.status_code, token_res.text)
        raise HTTPException(status_code=400, detail="Failed to fetch token from Google")

    token_info = token_res.json()
    access_token = token_info.get("access_token")

    try:
        user_info_res = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
    except requests.RequestException as e:
        logger.error("Google userinfo request failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not reach Google to fetch user info.")

    if user_info_res.status_code != 200:
        logger.error("Google userinfo fetch failed: %s %s", user_info_res.status_code, user_info_res.text)
        raise HTTPException(status_code=400, detail="Failed to fetch user info from Google")

    user_info = user_info_res.json()
    email = user_info.get("email")
    name = user_info.get("name")
    picture = user_info.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="Google did not return an email for this account.")

    try:
        # Find or create user in database
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                display_name=name,
                photo_url=picture,
                auth_provider="google",
                is_guest=False,
            )
            db.add(user)

        user.last_login_at = datetime.utcnow()
        db.commit()
        db.refresh(user)
    except SQLAlchemyError as e:
        db.rollback()
        logger.error("Database error during Google callback for %s: %s", email, e)
        raise HTTPException(status_code=500, detail="Could not complete Google sign-in. Please try again.")

    # Generate internal app token and pass it via query params back to frontend
    app_token = create_access_token(user_id=user.id, is_guest=False)
    frontend_url = os.getenv("FRONTEND_URL", "https://jivoranexa-ai-1.vercel.app")
    return RedirectResponse(url=f"{frontend_url}/profile?token={app_token}&login_success=true&email={email}")


# --- Existing Firebase / ID-token Google Login flow (used by native apps) ---
# NOTE: this is POST /api/auth/google, distinct from the GET /api/auth/google
# redirect route above -- FastAPI dispatches these by HTTP method, so having
# both on the same path is fine and is NOT the cause of the 404.
@router.post("/google", response_model=TokenOut)
def google_login(req: GoogleLoginRequest, db: Session = Depends(get_db)):
    if not FIREBASE_ENABLED:
        raise HTTPException(
            status_code=501,
            detail="Google login isn't configured on this server yet. "
                   "Set FIREBASE_SERVICE_ACCOUNT_JSON in backend/.env (see README), "
                   "or use Guest Mode / email login in the meantime.",
        )
    try:
        decoded = verify_id_token(req.id_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {e}")

    firebase_uid = decoded["uid"]
    try:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
        if not user:
            user = User(
                firebase_uid=firebase_uid,
                email=decoded.get("email"),
                display_name=decoded.get("name"),
                photo_url=decoded.get("picture"),
                auth_provider="google",
                is_guest=False,
            )
            db.add(user)
        user.last_login_at = datetime.utcnow()
        db.commit()
        db.refresh(user)
    except SQLAlchemyError as e:
        db.rollback()
        logger.error("Database error during Firebase Google login for uid %s: %s", firebase_uid, e)
        raise HTTPException(status_code=500, detail="Could not complete Google sign-in. Please try again.")

    token = create_access_token(user_id=user.id, is_guest=False)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/guest", response_model=TokenOut)
def guest_login(db: Session = Depends(get_db)):
    """Zero-friction guest mode -- no email, no password, works instantly."""
    guest_tag = uuid.uuid4().hex[:8]

    user = User(
        # Give every guest a unique, harmless placeholder email. If `email`
        # is NOT NULL and/or UNIQUE on the User model (common for auth
        # tables), leaving it unset here is what silently breaks guest
        # signup -- db.commit() raises an IntegrityError, the endpoint
        # 500s, and the frontend just reports "guest login failed".
        email=f"guest-{guest_tag}@guest.local",
        display_name=f"Guest-{guest_tag[:6]}",
        auth_provider="guest",
        is_guest=True,
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except SQLAlchemyError as e:
        db.rollback()
        logger.error("Guest login DB error (tag=%s): %s", guest_tag, e)
        raise HTTPException(
            status_code=500,
            detail="Could not create guest session. Please try again.",
        )

    token = create_access_token(user_id=user.id, is_guest=True)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.patch("/profile", response_model=UserOut)
def update_profile(req: ProfileUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        for field, value in req.model_dump(exclude_unset=True).items():
            setattr(current_user, field, value)
        db.commit()
        db.refresh(current_user)
    except SQLAlchemyError as e:
        db.rollback()
        logger.error("Profile update DB error for user %s: %s", current_user.id, e)
        raise HTTPException(status_code=500, detail="Could not update profile. Please try again.")
    return UserOut.model_validate(current_user)


# --- lightweight password-credential storage --------------------------------
from sqlalchemy import Column, String
from app.db.database import Base, engine


class PasswordCredential(Base):
    __tablename__ = "password_credentials"
    user_id = Column(String, primary_key=True)
    password_hash = Column(String)


def _store_password(db: Session, user_id: str, password: str) -> None:
    PasswordCredential.__table__.create(bind=engine, checkfirst=True)
    db.add(PasswordCredential(user_id=user_id, password_hash=hash_password(password)))


def _check_password(db: Session, user_id: str, password: str) -> bool:
    PasswordCredential.__table__.create(bind=engine, checkfirst=True)
    row = db.get(PasswordCredential, user_id)
    if not row:
        return False
    return verify_password(password, row.password_hash)