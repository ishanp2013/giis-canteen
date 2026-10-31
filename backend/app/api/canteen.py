import csv
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import require_role
from app.core.reservations import ACTIVE_STATUSES, next_pickup_date, reserved_count
from app.database import get_db
from app.models.menu_availability import MenuAvailability
from app.models.menu_item import MenuItem
from app.models.reservation import Reservation
from app.models.user import User
from app.schemas.menu import (
    AvailabilityCreate,
    AvailabilityOut,
    AvailabilityUpdate,
    MenuItemCreate,
    MenuItemOut,
    MenuItemUpdate,
)
from app.schemas.reservation import (
    ReservationCountOut,
    ReservationStatusUpdate,
    StaffReservationOut,
)

router = APIRouter(prefix="/canteen", tags=["canteen"], dependencies=[Depends(require_role("canteen_staff"))])


# --- Menu items: the reusable catalog of dishes ------------------------------

@router.post("/menu", response_model=MenuItemOut, status_code=status.HTTP_201_CREATED)
def create_menu_item(
    payload: MenuItemCreate,
    current_user: User = Depends(require_role("canteen_staff")),
    db: Session = Depends(get_db),
):
    """FR-C1: create a menu item."""
    item = MenuItem(**payload.model_dump(), created_by=current_user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/menu", response_model=list[MenuItemOut])
def list_menu_items(db: Session = Depends(get_db)):
    """FR-C1: view the full catalog of menu items."""
    return db.query(MenuItem).order_by(MenuItem.name).all()


@router.patch("/menu/{item_id}", response_model=MenuItemOut)
def update_menu_item(item_id: int, payload: MenuItemUpdate, db: Session = Depends(get_db)):
    """FR-C1: update a menu item."""
    item = db.get(MenuItem, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Menu item not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/menu/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_menu_item(item_id: int, db: Session = Depends(get_db)):
    """FR-C1: remove a menu item."""
    item = db.get(MenuItem, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Menu item not found")

    has_availability = db.query(MenuAvailability).filter(MenuAvailability.menu_item_id == item_id).first()
    if has_availability is not None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This item has availability entries — remove those from the Availability page first.",
        )

    db.delete(item)
    db.commit()


# --- Availability: per-day quantities students can reserve against ----------

def _availability_out(entry: MenuAvailability, db: Session) -> AvailabilityOut:
    return AvailabilityOut(
        id=entry.id,
        menu_item_id=entry.menu_item_id,
        menu_item_name=entry.menu_item.name,
        description=entry.menu_item.description,
        price=entry.menu_item.price,
        available_date=entry.available_date,
        quantity_available=entry.quantity_available,
        remaining_availability=entry.quantity_available - reserved_count(db, entry.id),
    )


@router.post("/availability", response_model=AvailabilityOut, status_code=status.HTTP_201_CREATED)
def create_availability(
    payload: AvailabilityCreate,
    current_user: User = Depends(require_role("canteen_staff")),
    db: Session = Depends(get_db),
):
    """Set the quantity available for a menu item on a specific day."""
    item = db.get(MenuItem, payload.menu_item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Menu item not found")

    entry = MenuAvailability(**payload.model_dump(), created_by=current_user.id)
    db.add(entry)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This item already has an availability entry for that date — edit it instead.",
        )
    db.refresh(entry)
    return _availability_out(entry, db)


@router.get("/availability", response_model=list[AvailabilityOut])
def list_availability(
    available_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """View what's available on a given day, defaulting to tomorrow."""
    entries = (
        db.query(MenuAvailability)
        .options(joinedload(MenuAvailability.menu_item))
        .filter(MenuAvailability.available_date == (available_date or next_pickup_date()))
        .all()
    )
    return [_availability_out(entry, db) for entry in entries]


@router.patch("/availability/{availability_id}", response_model=AvailabilityOut)
def update_availability(availability_id: int, payload: AvailabilityUpdate, db: Session = Depends(get_db)):
    """Adjust the quantity available for an existing day's entry."""
    entry = db.get(MenuAvailability, availability_id)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Availability entry not found")

    entry.quantity_available = payload.quantity_available
    db.commit()
    db.refresh(entry)
    return _availability_out(entry, db)


@router.delete("/availability/{availability_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_availability(availability_id: int, db: Session = Depends(get_db)):
    entry = db.get(MenuAvailability, availability_id)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Availability entry not found")

    has_reservations = db.query(Reservation).filter(Reservation.availability_id == availability_id).first()
    if has_reservations is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This entry already has reservations against it.")

    db.delete(entry)
    db.commit()


# --- Reservations -------------------------------------------------------

def _staff_reservation_out(r: Reservation) -> StaffReservationOut:
    return StaffReservationOut(
        id=r.id,
        student_id=r.student_id,
        student_name=r.student.name,
        availability_id=r.availability_id,
        menu_item_name=r.availability.menu_item.name,
        quantity=r.quantity,
        unit_price=r.unit_price,
        status=r.status,
        reserved_at=r.reserved_at,
        pickup_date=r.pickup_date,
    )


@router.get("/reservations", response_model=list[StaffReservationOut])
def list_reservations(
    pickup_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """FR-C2/FR-C3 (support): reservations for a given day, defaulting to tomorrow."""
    reservations = (
        db.query(Reservation)
        .options(
            joinedload(Reservation.availability).joinedload(MenuAvailability.menu_item),
            joinedload(Reservation.student),
        )
        .filter(Reservation.pickup_date == (pickup_date or next_pickup_date()))
        .all()
    )
    return [_staff_reservation_out(r) for r in reservations]


@router.get("/reservations/summary", response_model=list[ReservationCountOut])
def reservation_summary(
    pickup_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """FR-C2: total and per-item reservation counts for the next day."""
    target_date = pickup_date or next_pickup_date()
    entries = (
        db.query(MenuAvailability)
        .options(joinedload(MenuAvailability.menu_item))
        .filter(MenuAvailability.available_date == target_date)
        .all()
    )
    return [
        ReservationCountOut(
            menu_item_id=entry.menu_item_id,
            menu_item_name=entry.menu_item.name,
            reserved_count=reserved_count(db, entry.id),
        )
        for entry in entries
    ]


@router.patch("/reservations/{reservation_id}", response_model=StaffReservationOut)
def update_reservation_status(
    reservation_id: int,
    payload: ReservationStatusUpdate,
    db: Session = Depends(get_db),
):
    """FR-C3: mark a reservation as prepared or collected."""
    if payload.status not in ("prepared", "collected"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Staff may only set status to 'prepared' or 'collected'")

    reservation = (
        db.query(Reservation)
        .options(
            joinedload(Reservation.availability).joinedload(MenuAvailability.menu_item),
            joinedload(Reservation.student),
        )
        .filter(Reservation.id == reservation_id)
        .first()
    )
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reservation not found")
    if reservation.status not in ACTIVE_STATUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cancelled reservations cannot be updated")

    reservation.status = payload.status
    db.commit()
    db.refresh(reservation)
    return _staff_reservation_out(reservation)


def _reservations_csv(reservations: list[Reservation]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["reservation_id", "student_name", "menu_item_name", "quantity", "unit_price_aed", "total_aed", "status", "pickup_date"])
    for r in reservations:
        writer.writerow([r.id, r.student.name, r.availability.menu_item.name, r.quantity, r.unit_price, r.quantity * r.unit_price, r.status, r.pickup_date])
    return buffer.getvalue()


def _reservations_for_range(db: Session, start: date, end: date) -> list[Reservation]:
    return (
        db.query(Reservation)
        .options(
            joinedload(Reservation.availability).joinedload(MenuAvailability.menu_item),
            joinedload(Reservation.student),
        )
        .filter(Reservation.pickup_date >= start, Reservation.pickup_date <= end)
        .all()
    )


@router.get("/reports/daily")
def export_daily_report(
    pickup_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """FR-C4: export a daily reservation report as CSV."""
    target_date = pickup_date or next_pickup_date()
    reservations = _reservations_for_range(db, target_date, target_date)
    csv_content = _reservations_csv(reservations)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=reservations_{target_date}.csv"},
    )


@router.get("/reports/weekly")
def export_weekly_report(
    start_date: date = Query(...),
    db: Session = Depends(get_db),
):
    """FR-C4: export a weekly reservation report as CSV."""
    end_date = start_date + timedelta(days=6)
    reservations = _reservations_for_range(db, start_date, end_date)
    csv_content = _reservations_csv(reservations)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=reservations_{start_date}_to_{end_date}.csv"},
    )
