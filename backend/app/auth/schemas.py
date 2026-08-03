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
    home_currency: str
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
    user: UserOut
