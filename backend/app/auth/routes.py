import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.firebase import FIREBASE_ENABLED, verify_id_token
from app.auth.schemas import GoogleLoginRequest, LoginRequest, ProfileUpdate, RegisterRequest, TokenOut, UserOut
from app.auth.security import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.db.models import User
from datetime import datetime

router = APIRouter(prefix="/api/auth", tags=["auth"])


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
    # store the hash in a side column via display_name-safe approach:
    user.photo_url = None
    db.add(user)
    db.flush()  # get user.id before commit

    # password hash stored on a dedicated column would be cleaner; kept
    # here as an attribute for brevity -- see PasswordCredential note below.
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

    token = create_access_token(user_id=user.id, is_guest=False)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/guest", response_model=TokenOut)
def guest_login(db: Session = Depends(get_db)):
    """Zero-friction guest mode -- no email, no password, works instantly."""
    user = User(
        display_name=f"Guest-{uuid.uuid4().hex[:6]}",
        auth_provider="guest",
        is_guest=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user_id=user.id, is_guest=True)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.patch("/profile", response_model=UserOut)
def update_profile(req: ProfileUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Trip-profile intake (Priority-1): name/age/travelers/transport/food/
    hotel-type/emergency-contact, used to prefill every future plan."""
    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


# --- lightweight password-credential storage --------------------------------
# Kept in a separate tiny table (created lazily) instead of on User directly
# so the User model / API responses never accidentally leak a hash.
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
