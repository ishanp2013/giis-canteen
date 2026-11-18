from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.reservation import Reservation
from app.models.setting import Setting

# Statuses that hold portions. Rejected and cancelled reservations free theirs.
ACTIVE_STATUSES = ("reserved", "accepted", "prepared", "collected")


def get_cutoff_time(db: Session):
    setting = db.query(Setting).order_by(Setting.id).first()
    return setting.cutoff_time


def is_before_cutoff(db: Session) -> bool:
    now = datetime.now()
    return now.time() < get_cutoff_time(db)


def next_pickup_date():
    return (datetime.now() + timedelta(days=1)).date()


def is_open_for_changes(db: Session, pickup_date) -> bool:
    """Whether a reservation can still be changed or cancelled. The cut-off only
    applies to the day it governs, i.e. reservations for tomorrow's pickup;
    reservations from previous days are never affected by today's cut-off."""
    return pickup_date == next_pickup_date() and is_before_cutoff(db)


def reserved_count(db: Session, availability_id: int) -> int:
    """Number of portions held by active reservations (not the number of reservations)."""
    stmt = select(func.sum(Reservation.quantity)).where(
        Reservation.availability_id == availability_id,
        Reservation.status.in_(ACTIVE_STATUSES),
    )
    return db.scalar(stmt) or 0
