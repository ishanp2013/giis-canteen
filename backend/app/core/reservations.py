from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.reservation import Reservation
from app.models.setting import Setting

ACTIVE_STATUSES = ("reserved", "prepared", "collected")


def get_cutoff_time(db: Session):
    setting = db.query(Setting).order_by(Setting.id).first()
    return setting.cutoff_time


def is_before_cutoff(db: Session) -> bool:
    now = datetime.now()
    return now.time() < get_cutoff_time(db)


def next_pickup_date():
    return (datetime.now() + timedelta(days=1)).date()


def reserved_count(db: Session, availability_id: int) -> int:
    """Number of portions held by active reservations (not the number of reservations)."""
    stmt = select(func.sum(Reservation.quantity)).where(
        Reservation.availability_id == availability_id,
        Reservation.status.in_(ACTIVE_STATUSES),
    )
    return db.scalar(stmt) or 0
