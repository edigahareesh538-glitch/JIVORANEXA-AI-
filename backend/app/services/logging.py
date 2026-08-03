"""Structured logger (Phase 16).

A thin wrapper that emits JSON lines to stdout when an env flag is set,
falling back to standard logging otherwise. Helps when the app is hosted
in a platform whose log shipper expects JSON.
"""
from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime

USE_JSON_LOGS = os.getenv("JSON_LOGS", "false").lower() == "true"

_logger = logging.getLogger("jivoranexa")
_logger.setLevel(logging.INFO)
if not _logger.handlers:
    _h = logging.StreamHandler(sys.stdout)
    _logger.addHandler(_h)


def _emit(level: str, event: str, **fields: object) -> None:
    payload = {"ts": datetime.utcnow().isoformat() + "Z", "level": level,
               "event": event, **fields}
    if USE_JSON_LOGS:
        sys.stdout.write(json.dumps(payload, default=str) + "\n")
        sys.stdout.flush()
    else:
        msg = f"[{level}] {event} " + " ".join(f"{k}={v}" for k, v in fields.items())
        _logger.info(msg)


def info(event: str, **fields: object) -> None:
    _emit("info", event, **fields)


def warn(event: str, **fields: object) -> None:
    _emit("warning", event, **fields)


def error(event: str, **fields: object) -> None:
    _emit("error", event, **fields)
