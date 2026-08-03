"""Group Trips — Phase 11.

Lightweight collaboration without a real-time websocket layer — invites go
through share codes + DB-backed membership tables. All endpoints are
auth-protected because they mutate user-specific trip data.
"""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import GroupMember, GroupTrip, User, Notification

router = APIRouter(prefix="/api/group", tags=["group"])


def _share_code(group_id: str) -> str:
    """Stable 8-char join code derived from the group id so the same invite
    keeps working even after server restarts (no regenerations)."""
    h = hashlib.sha256(group_id.encode()).hexdigest()[:8].upper()
    return h


class CreateGroupIn(BaseModel):
    name: str
    trip_destination: str | None = None
    trip_start: str | None = None
    trip_end: str | None = None


class VoteIn(BaseModel):
    voter_name: str | None = None
    option: str
    note: str | None = None


class ExpenseSplitIn(BaseModel):
    member_name: str
    amount: float
    label: str | None = None


class ChecklistItemIn(BaseModel):
    label: str


def _get_group(db: Session, user: User, group_id: str) -> GroupTrip:
    g = db.get(GroupTrip, group_id)
    if not g or (g.owner_id != user.id and not any(m.user_id == user.id for m in g.members)):
        raise HTTPException(status_code=404, detail="Group not found or you don't have access.")
    return g


@router.post("/create")
def create_group(req: CreateGroupIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    group_id = str(uuid.uuid4())
    g = GroupTrip(
        id=group_id, owner_id=user.id, name=req.name,
        trip_destination=req.trip_destination,
        trip_start=req.trip_start, trip_end=req.trip_end,
        itinerary={}, votes=[], expense_splits=[], checklist=[],
        share_code=_share_code(group_id),
    )
    db.add(g)
    db.add(GroupMember(group_id=group_id, user_id=user.id, role="owner", name=user.display_name or "Owner"))
    db.commit()
    db.refresh(g)
    return {"group": _serialize(g)}


@router.post("/{group_id}/join")
def join_group(group_id: str, display_name: str | None = None,
              join_code: str | None = None,
              user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    g = db.get(GroupTrip, group_id)
    if not g:
        # Allow joining by share code (8-char string) since it's friendlier.
        g = db.query(GroupTrip).filter(GroupTrip.share_code == (join_code or "").upper()).first()
        if not g:
            raise HTTPException(status_code=404, detail="Group not found.")
    if any(m.user_id == user.id for m in g.members):
        return {"already_member": True, "group": _serialize(g)}
    name = (display_name or user.display_name or user.email or "Member").split("@")[0]
    db.add(GroupMember(group_id=g.id, user_id=user.id, name=name, role="member"))
    db.commit()
    return {"joined": True, "group": _serialize(g)}


@router.get("")
def list_groups(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned = db.query(GroupTrip).filter(GroupTrip.owner_id == user.id).all()
    member = (db.query(GroupTrip).join(GroupMember, GroupMember.group_id == GroupTrip.id)
              .filter(GroupMember.user_id == user.id, GroupTrip.owner_id != user.id).all())
    return {"owned": [_serialize(g) for g in owned], "joined": [_serialize(g) for g in member]}


@router.get("/{group_id}")
def get_group(group_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _serialize(_get_group(db, user, group_id))


@router.post("/{group_id}/invite")
def invite_friends(group_id: str, names: list[str],
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    g = _get_group(db, user, group_id)
    for nm in names:
        nm = nm.strip()
        if not nm:
            continue
        existing_names = {m.name.lower() for m in g.members}
        if nm.lower() in existing_names:
            continue
        pid = str(uuid.uuid4())
        db.add(GroupMember(group_id=g.id, user_id=pid, name=nm, role="invited"))
    db.commit()
    db.refresh(g)
    return {"group": _serialize(g), "share_code": g.share_code}


@router.post("/{group_id}/itinerary")
def update_itinerary(group_id: str, body: dict,
                     user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    g = _get_group(db, user, group_id)
    g.itinerary = body
    db.commit()
    return {"group": _serialize(g)}


@router.get("/{group_id}/vote")
def list_votes(group_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"votes": _get_group(db, user, group_id).votes or []}


@router.post("/{group_id}/vote")
def add_vote(group_id: str, vote: VoteIn,
             user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    g = _get_group(db, user, group_id)
    votes = list(g.votes or [])
    votes.append({"voter": vote.voter_name or user.display_name or "Member",
                  "option": vote.option, "note": vote.note,
                  "at": datetime.utcnow().isoformat() + "Z"})
    g.votes = votes
    db.commit()
    return {"votes": votes}


@router.post("/{group_id}/expenses")
def add_expense_split(group_id: str, exp: ExpenseSplitIn,
                      user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    g = _get_group(db, user, group_id)
    splits = list(g.expense_splits or [])
    splits.append({**exp.model_dump(), "added_by": user.display_name or "Member",
                   "at": datetime.utcnow().isoformat() + "Z"})
    g.expense_splits = splits
    db.commit()
    total = sum(s["amount"] for s in splits)
    per_member = round(total / max(len(g.members), 1), 2)
    return {"splits": splits, "total": total, "per_member": per_member}


@router.post("/{group_id}/checklist")
def add_checklist_item(group_id: str, item: ChecklistItemIn,
                       user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    g = _get_group(db, user, group_id)
    checklist = list(g.checklist or [])
    checklist.append({"id": str(uuid.uuid4()), "label": item.label, "done": False,
                      "added_by": user.display_name or "Member",
                      "at": datetime.utcnow().isoformat() + "Z"})
    g.checklist = checklist
    db.commit()
    return {"checklist": checklist}


@router.patch("/{group_id}/checklist/{item_id}")
def toggle_checklist_item(group_id: str, item_id: str, done: bool,
                          user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    g = _get_group(db, user, group_id)
    checklist = list(g.checklist or [])
    for entry in checklist:
        if entry.get("id") == item_id:
            entry["done"] = done
    g.checklist = checklist
    db.commit()
    return {"checklist": checklist}


@router.delete("/{group_id}")
def delete_group(group_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    g = db.get(GroupTrip, group_id)
    if not g or g.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the owner can delete the group.")
    db.query(GroupMember).filter(GroupMember.group_id == group_id).delete()
    db.delete(g)
    db.commit()
    return {"deleted": group_id}


def _serialize(g: GroupTrip) -> dict:
    return {
        "id": g.id, "name": g.name, "owner_id": g.owner_id,
        "share_code": g.share_code, "trip_destination": g.trip_destination,
        "trip_start": g.trip_start, "trip_end": g.trip_end,
        "members": [{"name": m.name, "role": m.role, "user_id": m.user_id} for m in g.members],
        "itinerary": g.itinerary or {}, "votes": g.votes or [],
        "expense_splits": g.expense_splits or [], "checklist": g.checklist or [],
        "created_at": g.created_at.isoformat() + "Z" if g.created_at else None,
    }
