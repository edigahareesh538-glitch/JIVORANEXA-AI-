from fastapi import APIRouter
from app.agents import list_agents

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("")
def get_agents():
    """Lists the named agents in the multi-agent system."""
    return {"agents": list_agents()}
