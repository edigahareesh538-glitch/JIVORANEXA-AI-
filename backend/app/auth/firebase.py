"""
Firebase Admin SDK setup, used only to *verify* ID tokens that the
frontend obtained from Firebase Auth (Google login or email/password
login both happen client-side with the Firebase JS SDK -- the backend
never sees passwords, it only verifies the resulting ID token).

If no service account is configured, FIREBASE_ENABLED is False and the
app still runs -- Google/email login endpoints will return a clear 501
error, but Guest Mode keeps working with zero setup, which is what
lets the rest of the app (trips, expenses, favourites...) be developed
and demoed before Firebase credentials exist.
"""
import json

from app.services.config import settings

FIREBASE_ENABLED = False
_firebase_auth = None

try:
    if settings.FIREBASE_SERVICE_ACCOUNT_JSON:
        import firebase_admin
        from firebase_admin import credentials, auth as firebase_auth

        cred_dict = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
        cred = credentials.Certificate(cred_dict)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID or cred_dict.get("project_id")})
        _firebase_auth = firebase_auth
        FIREBASE_ENABLED = True
        print("[auth.firebase] Firebase Admin initialized -- Google/email login is LIVE.")
    else:
        print("[auth.firebase] FIREBASE_SERVICE_ACCOUNT_JSON not set -- "
              "Google/email login disabled, Guest Mode still works.")
except Exception as e:  # pragma: no cover - defensive
    print(f"[auth.firebase] WARNING: Firebase Admin init failed ({e}). "
          f"Falling back to Guest-Mode-only auth.")
    FIREBASE_ENABLED = False


def verify_id_token(id_token: str) -> dict:
    """Returns the decoded Firebase token (uid, email, name, picture, ...).
    Raises ValueError if Firebase isn't configured or the token is invalid.
    """
    if not FIREBASE_ENABLED or _firebase_auth is None:
        raise ValueError(
            "Firebase auth is not configured on this server. "
            "Set FIREBASE_SERVICE_ACCOUNT_JSON in backend/.env, or use Guest Mode."
        )
    return _firebase_auth.verify_id_token(id_token)
