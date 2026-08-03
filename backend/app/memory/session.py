import uuid
from app.memory.state import memory_store


def new_session() -> str:
    return str(uuid.uuid4())


def get_or_resume(session_id: str | None) -> tuple[str, dict]:
    """Returns (session_id, state). Creates a new session if none given,
    otherwise resumes exactly where the last run left off (memory across steps).
    """
    session_id = session_id or new_session()
    state = memory_store.get(session_id)
    return session_id, state
