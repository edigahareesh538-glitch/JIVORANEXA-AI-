"""
Database engine + session setup.

Priority:
1. If DATABASE_URL is set (Postgres / Supabase connection string) -> use it.
2. Otherwise -> fall back to a local SQLite file (./trip_agent.db) so the
   whole app (users, trips, expenses, favourites, notifications...) works
   out of the box with zero setup, and can be pointed at real Postgres
   later by just setting DATABASE_URL in .env.

This mirrors the pattern already used in app/memory/state.py for session
state, but this module is for *durable* app data (users, trips, etc.),
not the ephemeral agent workflow state.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.services.config import settings

DATABASE_URL = settings.DATABASE_URL.strip() if settings.DATABASE_URL else ""

if DATABASE_URL:
    connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
    engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
    USING_SQLITE_FALLBACK = DATABASE_URL.startswith("sqlite")
else:
    DATABASE_URL = "sqlite:///./trip_agent.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    USING_SQLITE_FALLBACK = True

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency -- yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables that don't exist yet. Safe to call every startup."""
    from app.db import models  # noqa: F401  (import so models register on Base)

    Base.metadata.create_all(bind=engine)
    mode = "SQLite (local file, no setup needed)" if USING_SQLITE_FALLBACK else "Postgres/Supabase"
    print(f"[db] Ready -- using {mode}: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")
