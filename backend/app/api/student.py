from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import require_role
from app.core.reservations import is_before_cutoff, next_pickup_date, reserved_count, ACTIVE_STATUSES
from app.database import get_db
from app.models.menu_availability import MenuAvailability
from app.models.reservation import Reservation
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.user import User
from app.schemas.menu import AvailabilityOut
from app.schemas.reservation import (
    ReservationBatchCreate,
    ReservationCreate,
    ReservationOut,
    ReservationQuantityUpdate,
)

# Ordering endpoints shared by students and teachers.
router = APIRouter(tags=["student"],dependencies=[Depends(require_role("student", "teacher"))])


def _get_customer(current_user: User, db: Session) -> dict[str, int]:
    """Identify the signed-in student or teacher as the reservation column that
    points at them, e.g. {"student_id": 4} or {"teacher_id": 2}. It's used both
    to filter their reservations and to create new ones."""
    if current_user.role.name == "teacher":
        teacher = db.query(Teacher).filter(Teacher.user_id == current_user.id).first()
        if teacher is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Teacher profile not found")
        return {"teacher_id": teacher.id}

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student profile not found")
    return {"student_id": student.id}


def _owned_by(customer: dict[str, int]) -> list:
    """Filter conditions matching the reservations of the given customer."""
    return [getattr(Reservation, column) == value for column, value in customer.items()]


def _to_reservation_out(reservation: Reservation) -> ReservationOut:
    return ReservationOut(
        id=reservation.id,
        availability_id=reservation.availability_id,
        menu_item_id=reservation.availability.menu_item_id,
        menu_item_name=reservation.availability.menu_item.name,
        quantity=reservation.quantity,
        unit_price=reservation.unit_price,
        status=reservation.status,
        reserved_at=reservation.reserved_at,
        pickup_date=reservation.pickup_date,
        rejection_reason=reservation.rejection_reason,
    )


def _lock_availability(db: Session, availability_id: int) -> MenuAvailability | None:
    # Row lock so two students can't both take the last portions at the same time.
    return (
        db.query(MenuAvailability)
        .filter(MenuAvailability.id == availability_id)
        .with_for_update()
        .first()
    )


def _not_enough_left(remaining: int, item_name: str = "this item") -> HTTPException:
    if remaining <= 0:
        return HTTPException(status.HTTP_400_BAD_REQUEST, f"{item_name} is fully booked for tomorrow")
    return HTTPException(status.HTTP_400_BAD_REQUEST, f"Only {remaining} left of {item_name}")


def _reserve(db: Session, customer: dict[str, int], item: ReservationCreate) -> Reservation:
    """Validate and stage one dish of an order; the caller commits.
    Ordering a dish the customer already holds adds to that reservation."""
    availability = _lock_availability(db, item.availability_id)
    tomorrow = next_pickup_date()
    if availability is None or availability.available_date != tomorrow:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Menu item is not available for tomorrow")
    item_name = availability.menu_item.name

    existing = (
        db.query(Reservation)
        .filter(
            *_owned_by(customer),
            Reservation.availability_id == availability.id,
            Reservation.status.in_(ACTIVE_STATUSES),
        )
        .first()
    )
    if existing is not None and existing.status != "reserved":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Your {item_name} order has already been accepted by the canteen and can't be changed"
        )

    # FR-C5: prevent reservations beyond the set quantity available.
    remaining = availability.quantity_available - reserved_count(db, availability.id)
    if item.quantity > remaining:
        raise _not_enough_left(remaining, item_name)

    if existing is not None:
        existing.quantity += item.quantity
        return existing

    reservation = Reservation(
        **customer,
        availability_id=availability.id,
        quantity=item.quantity,
        unit_price=availability.menu_item.price,
        pickup_date=tomorrow,
        status="reserved",
    )
    db.add(reservation)
    # Flush so the next dish's reserved_count sees this one within the same order.
    db.flush()
    return reservation


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
        price=entry.menu_item.price,
            available_date=entry.available_date,
            quantity_available=entry.quantity_available,
            remaining_availability=entry.quantity_available - reserved_count(db, entry.id),
        )
        for entry in entries
    ]


@router.post("/reservations", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
def create_reservation(
    payload: ReservationCreate,
    current_user: User = Depends(require_role("student", "teacher")),
    db: Session = Depends(get_db),
):
    """FR-S2: reserve a dish for the next day before the cut-off time."""
    if not is_before_cutoff(db):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cut-off time has passed for tomorrow's reservations")

    customer = _get_customer(current_user, db)
    reservation = _reserve(db, customer,payload)
    db.commit()
    db.refresh(reservation)
    return _to_reservation_out(reservation)


@router.post("/reservations/batch", response_model=list[ReservationOut], status_code=status.HTTP_201_CREATED)
def create_reservations(
    payload: ReservationBatchCreate,
    current_user: User = Depends(require_role("student", "teacher")),
    db: Session = Depends(get_db),
):
    """FR-S2: reserve several dishes, each in its own quantity, as one order.
    Either every dish is reserved or none is."""
    if not is_before_cutoff(db):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cut-off time has passed for tomorrow's reservations")

    ids = [item.availability_id for item in payload.items]
    if len(ids) != len(set(ids)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Each dish can only appear once in an order")

    customer = _get_customer(current_user, db)
    # Lock rows in a fixed order so two concurrent orders can't deadlock.
    reservations = [
        _reserve(db, customer,item) for item in sorted(payload.items, key=lambda i: i.availability_id)
    ]
    db.commit()
    for reservation in reservations:
        db.refresh(reservation)
    return [_to_reservation_out(r) for r in reservations]


@router.patch("/reservations/{reservation_id}", response_model=ReservationOut)
def update_reservation_quantity(
    reservation_id: int,
    payload: ReservationQuantityUpdate,
    current_user: User = Depends(require_role("student", "teacher")),
    db: Session = Depends(get_db),
):
    """Change how many portions a reservation is for, before the cut-off time."""
    customer = _get_customer(current_user, db)
    reservation = (
        db.query(Reservation)
        .filter(Reservation.id == reservation_id, *_owned_by(customer))
        .first()
    )
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reservation not found")
    if reservation.status != "reserved":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only reservations the canteen hasn't accepted yet can be changed")
    if not is_before_cutoff(db) or reservation.pickup_date != next_pickup_date():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cut-off time has passed; reservation can no longer be changed")

    availability = _lock_availability(db, reservation.availability_id)
    # This reservation's own portions are already counted, so add them back.
    remaining = availability.quantity_available - reserved_count(db, availability.id) + reservation.quantity
    if payload.quantity > remaining:
        raise _not_enough_left(remaining)

    reservation.quantity = payload.quantity
    db.commit()
    db.refresh(reservation)
    return _to_reservation_out(reservation)


@router.delete("/reservations/{reservation_id}", response_model=ReservationOut)
def cancel_reservation(
    reservation_id: int,
    current_user: User = Depends(require_role("student", "teacher")),
    db: Session = Depends(get_db),
):
    """FR-S3: cancel a reservation before the cut-off time."""
    customer = _get_customer(current_user, db)
    reservation = (
        db.query(Reservation)
        .options(joinedload(Reservation.availability).joinedload(MenuAvailability.menu_item))
        .filter(Reservation.id == reservation_id, *_owned_by(customer))
        .first()
    )
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reservation not found")
    if reservation.status == "cancelled":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reservation is already cancelled")
    if reservation.status != "reserved":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only reservations the canteen hasn't accepted yet can be cancelled")
    if not is_before_cutoff(db):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cut-off time has passed; reservation can no longer be cancelled")

    reservation.status = "cancelled"
    db.commit()
    db.refresh(reservation)
    return _to_reservation_out(reservation)


@router.get("/reservations/mine", response_model=list[ReservationOut])
def my_reservations(
    current_user: User = Depends(require_role("student", "teacher")),
    db: Session = Depends(get_db),
):
    """FR-S5: view a history of past and upcoming reservations."""
    customer = _get_customer(current_user, db)
    reservations = (
        db.query(Reservation)
        .options(joinedload(Reservation.availability).joinedload(MenuAvailability.menu_item))
        .filter(*_owned_by(customer))
        .order_by(Reservation.pickup_date.desc(), Reservation.reserved_at.desc())
        .all()
    )
    return [_to_reservation_out(r) for r in reservations]
