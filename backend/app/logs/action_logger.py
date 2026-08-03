from datetime import datetime, timezone


class ActionLogger:
    """Produces the transparent, judge-friendly action trail, e.g.
    ✔ Goal Received, ✔ Flight Search Started, ✔ Rain Expected, ...
    """

    def __init__(self):
        self.entries: list[dict] = []

    def log(self, message: str, status: str = "ok", data: dict | None = None):
        self.entries.append(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": message,
                "status": status,  # ok | retry | error | info
                "data": data or {},
            }
        )

    def as_list(self) -> list[dict]:
        return self.entries
