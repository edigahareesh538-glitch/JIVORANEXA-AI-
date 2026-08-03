"""
Durable data models.

Phase-1 original tables: users, trip history, saved itineraries, favourite
places, uploaded images, chat history + expenses + notifications.

Phase 5-17 additions:
- User: is_admin flag (Admin Dashboard)
- Booking: flight/hotel/bus/train records with status (Booking Engine)
- GroupTrip / GroupMember: collaborative trip planning
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, Boolean, DateTime, JSON, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.db.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    firebase_uid = Column(String, unique=True, nullable=True, index=True)

    # `unique=True, nullable=True` is exactly what both auth flows need:
    # - Google/password users get a real, unique email.
    # - Guest users get a generated `guest-<hex>@guest.local` placeholder
    #   (set in app/auth/routes.py) which is still unique per row, so it
    #   satisfies the UNIQUE constraint without needing a NULL email.
    # nullable=True is kept (rather than NOT NULL) as a safety margin for
    # any future auth provider that genuinely has no email to offer.
    email = Column(String, unique=True, nullable=True, index=True)

    display_name = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)

    # "google" | "password" | "guest". Nullable=True so a row can never fail
    # to insert on this column alone even if a future code path forgets to
    # set it -- auth_provider is informational, not something worth a hard
    # DB-level constraint given how many call sites construct a User.
    auth_provider = Column(String, nullable=True, default="guest")

    is_guest = Column(Boolean, default=False)
    home_currency = Column(String, default="INR")
    preferred_language = Column(String, default="en")

    # Trip-profile fields (Priority-1 feature: "AI asks for user profile
    # first"). All optional -- planning works fine without them.
    age = Column(Integer, nullable=True)
    phone = Column(String, nullable=True)
    num_travelers = Column(Integer, nullable=True)
    preferred_transport = Column(String, nullable=True)  # flight | train | bus | own_vehicle | rental_car
    food_preference = Column(String, nullable=True)      # veg | non_veg | vegan | jain | no_preference
    hotel_type = Column(String, nullable=True)            # budget | 3_star | 4_star | luxury
    emergency_contact_name = Column(String, nullable=True)
    emergency_contact_phone = Column(String, nullable=True)

    # Phase 17: admin flag
    is_admin = Column(Boolean, default=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    # Nullable=True: a Python-side default fires on INSERT, but keeping the
    # column itself nullable means a bulk import, a manual DB row, or a
    # future migration that skips this field won't violate a NOT NULL
    # constraint -- last_login_at is a "nice to have" timestamp, not
    # something that should be able to block user creation.
    last_login_at = Column(DateTime, nullable=True, default=datetime.utcnow)

    trips = relationship("Trip", back_populates="user", cascade="all, delete-orphan")
    favorites = relationship("FavoritePlace", back_populates="user", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="user", cascade="all, delete-orphan")
    owned_groups = relationship("GroupTrip", back_populates="owner",
                                foreign_keys="GroupTrip.owner_id",
                                cascade="all, delete-orphan")
    memberships = relationship("GroupMember", back_populates="user",
                               cascade="all, delete-orphan")


class Trip(Base):
    """One planning session turned into trip history. Mirrors the
    ephemeral session state in app/memory/state.py but persists it."""
    __tablename__ = "trips"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(String, index=True)
    destination = Column(String)
    budget = Column(Float, nullable=True)
    total_cost = Column(Float, nullable=True)
    status = Column(String, default="planned")  # planned | booked | completed | cancelled
    itinerary_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="trips")


class SavedItinerary(Base):
    __tablename__ = "saved_itineraries"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    trip_id = Column(String, ForeignKey("trips.id"), nullable=True)
    title = Column(String)
    itinerary_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class FavoritePlace(Base):
    __tablename__ = "favorite_places"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String)
    category = Column(String, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    destination = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="favorites")


class UploadedImage(Base):
    __tablename__ = "uploaded_images"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    session_id = Column(String, nullable=True)
    filename = Column(String)
    recognized_place = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(String, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    role = Column(String)  # "user" | "agent"
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    trip_id = Column(String, ForeignKey("trips.id"), nullable=True)
    category = Column(String)  # flight | hotel | food | shopping | transport | emergency | other
    label = Column(String, nullable=True)
    amount = Column(Float)
    currency = Column(String, default="INR")
    spent_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="expenses")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String)  # weather | hotel | bus | flight | trip | emergency | crash | booking
    title = Column(String)
    message = Column(String)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


# ---------------- Phase 12: Booking Engine ---------------------------------

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    mode = Column(String)  # flight | hotel | bus | train
    origin = Column(String, nullable=True)
    destination = Column(String)
    start_date = Column(String)
    end_date = Column(String, nullable=True)
    travelers = Column(Integer, default=1)
    fare = Column(Float)
    provider = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    status = Column(String, default="initiated")  # initiated | confirmed | cancelled | completed | failed
    confirmation_code = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="bookings")


# ---------------- Phase 11: Group Trips -----------------------------------

class GroupTrip(Base):
    __tablename__ = "group_trips"

    id = Column(String, primary_key=True, default=_uuid)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String)
    trip_destination = Column(String, nullable=True)
    trip_start = Column(String, nullable=True)
    trip_end = Column(String, nullable=True)
    share_code = Column(String, index=True)
    itinerary = Column(JSON, nullable=True)
    votes = Column(JSON, nullable=True)
    expense_splits = Column(JSON, nullable=True)
    checklist = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="owned_groups",
                         foreign_keys=[owner_id])
    members = relationship("GroupMember", back_populates="group",
                           cascade="all, delete-orphan")


class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(String, primary_key=True, default=_uuid)
    group_id = Column(String, ForeignKey("group_trips.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String)
    role = Column(String, default="member")  # owner | member | invited
    joined_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("GroupTrip", back_populates="members")
    user = relationship("User", back_populates="memberships")