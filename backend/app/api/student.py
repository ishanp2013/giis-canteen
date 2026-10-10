from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import require_role
from app.core.reservations import is_before_cutoff, next_pickup_date, reserved_count, ACTIVE_STATUSES
from app.database import get_db
from app.models.menu_availability import MenuAvailability
from app.models.reservation import Reservation
from app.models.student import Student
from app.models.user import User
from app.schemas.menu import AvailabilityOut
from app.schemas.reservation import ReservationCreate, ReservationOut

router = APIRouter(tags=["student"], dependencies=[Depends(require_role("student"))])


def _get_student(current_user: User, db: Session) -> Student:
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student profile not found")
    return student


def _to_reservation_out(reservation: Reservation) -> ReservationOut:
    return ReservationOut(
        id=reservation.id,
        student_id=reservation.student_id,
        availability_id=reservation.availability_id,
        menu_item_name=reservation.availability.menu_item.name,
        status=reservation.status,
        reserved_at=reservation.reserved_at,
        pickup_date=reservation.pickup_date,
    )


@router.get("/menu", response_model=list[AvailabilityOut])
def view_next_day_menu(db: Session = Depends(get_db)):
    """FR-S1: view the next day's menu with remaining availability."""
    tomorrow = next_pickup_date()
    entries = (
        db.query(MenuAvailability)
        .options(joinedload(MenuAvailability.menu_item))
        .filter(MenuAvailability.available_date == tomorrow)
        .all()
    )
    return [
        AvailabilityOut(
            id=entry.id,
            menu_item_id=entry.menu_item_id,
            menu_item_name=entry.menu_item.name,
            description=entry.menu_item.description,
            available_date=entry.available_date,
            quantity_available=entry.quantity_available,
            remaining_availability=entry.quantity_available - reserved_count(db, entry.id),
        )
        for entry in entries
    ]


@router.post("/reservations", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
def create_reservation(
    payload: ReservationCreate,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """FR-S2: reserve one meal for the next day before the cut-off time."""
    if not is_before_cutoff(db):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cut-off time has passed for tomorrow's reservations")

    availability = db.get(MenuAvailability, payload.availability_id)
    tomorrow = next_pickup_date()
    if availability is None or availability.available_date != tomorrow:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Menu item is not available for tomorrow")

    student = _get_student(current_user, db)

    existing = (
        db.query(Reservation)
        .filter(
            Reservation.student_id == student.id,
            Reservation.pickup_date == tomorrow,
            Reservation.status.in_(ACTIVE_STATUSES),
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A reservation for tomorrow already exists")

    # FR-C5: prevent reservations beyond the set quantity available.
    if reserved_count(db, availability.id) >= availability.quantity_available:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This item is fully booked for tomorrow")

    reservation = Reservation(
        student_id=student.id,
        availability_id=availability.id,
        pickup_date=tomorrow,
        status="reserved",
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)
    return _to_reservation_out(reservation)


@router.delete("/reservations/{reservation_id}", response_model=ReservationOut)
def cancel_reservation(
    reservation_id: int,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """FR-S3: cancel a reservation before the cut-off time."""
    student = _get_student(current_user, db)
    reservation = (
        db.query(Reservation)
        .options(joinedload(Reservation.availability).joinedload(MenuAvailability.menu_item))
        .filter(Reservation.id == reservation_id, Reservation.student_id == student.id)
        .first()
    )
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reservation not found")
    if reservation.status == "cancelled":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reservation is already cancelled")
    if not is_before_cutoff(db):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cut-off time has passed; reservation can no longer be cancelled")

    reservation.status = "cancelled"
    db.commit()
    db.refresh(reservation)
    return _to_reservation_out(reservation)


@router.get("/reservations/mine", response_model=list[ReservationOut])
def my_reservations(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """FR-S5: view a history of past and upcoming reservations."""
    student = _get_student(current_user, db)
    reservations = (
        db.query(Reservation)
        .options(joinedload(Reservation.availability).joinedload(MenuAvailability.menu_item))
        .filter(Reservation.student_id == student.id)
        .order_by(Reservation.pickup_date.desc())
        .all()
    )
    return [_to_reservation_out(r) for r in reservations]
