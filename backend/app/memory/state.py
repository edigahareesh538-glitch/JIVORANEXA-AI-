"""
Memory & State Store.
Uses Postgres via SQLAlchemy when USE_MOCK_DB=false AND a working
DATABASE_URL is configured. Falls back safely to an in-process dict
otherwise (e.g. bad config, unreachable DB) so requests never crash
because of a storage misconfiguration.
"""
from datetime import datetime
from typing import Any
from app.services.config import settings

_MOCK_STORE: dict[str, dict[str, Any]] = {}

DB_ENABLED = False
SessionLocal = None
SessionState = None

if not settings.USE_MOCK_DB and settings.DATABASE_URL:
    try:
        from sqlalchemy import create_engine, Column, String, JSON, DateTime
        from sqlalchemy.orm import declarative_base, sessionmaker

        engine = create_engine(settings.DATABASE_URL)
        Base = declarative_base()
        SessionLocal = sessionmaker(bind=engine)

        class SessionState(Base):
            __tablename__ = "session_state"
            session_id = Column(String, primary_key=True)
            data = Column(JSON)
            updated_at = Column(DateTime, default=datetime.utcnow)

        Base.metadata.create_all(engine)
        DB_ENABLED = True
        print("[memory.state] Postgres connected -- using DB-backed storage.")
    except Exception as e:
        print(f"[memory.state] WARNING: could not initialize Postgres ({e}). "
              f"Falling back to in-memory storage.")
        DB_ENABLED = False
else:
    print("[memory.state] USE_MOCK_DB=true or no DATABASE_URL set -- using in-memory storage.")


class MemoryStore:
    """Tracks: current step, completed steps, budget, destination,
    hotel/flight chosen, weather retrieved, etc. Supports resuming
    from the last completed step instead of restarting from Step 1.
    """

    def get(self, session_id: str) -> dict:
        if not DB_ENABLED:
            return _MOCK_STORE.get(session_id, self._blank())
        db = SessionLocal()
        try:
            row = db.get(SessionState, session_id)
            return row.data if row else self._blank()
        finally:
            db.close()

    def save(self, session_id: str, data: dict) -> None:
        if not DB_ENABLED:
            _MOCK_STORE[session_id] = data
            return
        db = SessionLocal()
        try:
            row = db.get(SessionState, session_id)
            if row:
                row.data = data
                row.updated_at = datetime.utcnow()
            else:
                row = SessionState(session_id=session_id, data=data)
                db.add(row)
            db.commit()
        finally:
            db.close()

    def update_step(self, session_id: str, step_name: str, result: Any) -> dict:
        state = self.get(session_id)
        state.setdefault("completed_steps", []).append(step_name)
        state.setdefault("results", {})[step_name] = result
        state["current_step"] = step_name
        self.save(session_id, state)
        return state

    @staticmethod
    def _blank() -> dict:
        return {"completed_steps": [], "results": {}, "current_step": None}


memory_store = MemoryStore()
