from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    id_token: str  # Firebase ID token obtained client-side after Google sign-in


class UserOut(BaseModel):
    id: str
    email: str | None = None
    display_name: str | None = None
    photo_url: str | None = None
    auth_provider: str
    is_guest: bool
    is_admin: bool = False
    # Guest accounts are created without any onboarding step, so home_currency
    # may not be set on the User row yet. Making this optional (with a
    # sensible default) prevents UserOut.model_validate(user) from raising a
    # pydantic ValidationError -- which previously would have turned into an
    # unhandled 500 on /api/auth/guest and /api/auth/google/callback the
    # moment either flow returned a user without that field populated.
    home_currency: str | None = "INR"
    preferred_language: str = "en"
    age: int | None = None
    phone: str | None = None
    num_travelers: int | None = None
    preferred_transport: str | None = None
    food_preference: str | None = None
    hotel_type: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    age: int | None = None
    phone: str | None = None
    num_travelers: int | None = None
    preferred_transport: str | None = None
    food_preference: str | None = None
    hotel_type: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    # Optional so this schema can also describe token-only responses (e.g. a
    # refresh-token endpoint added later) without requiring a full UserOut
    # every time. All current routes (register/login/guest/google) still
    # populate this, so existing frontend code that reads response.user
    # keeps working unchanged.
    user: UserOut | None = None