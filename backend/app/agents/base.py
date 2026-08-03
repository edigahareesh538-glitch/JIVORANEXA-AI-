"""Base class every named agent implements. Each agent is a thin,
purpose-named wrapper around the underlying tools/workflow modules --
this makes the system's multi-agent structure explicit and inspectable
(see GET /api/agents) instead of it being one monolithic planner."""
from abc import ABC, abstractmethod


class Agent(ABC):
    name: str = "BaseAgent"
    description: str = ""

    @abstractmethod
    def run(self, **kwargs):
        ...

    def info(self) -> dict:
        return {"name": self.name, "description": self.description}
