from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

# "reserved" means the order is waiting for canteen staff to accept or reject it.
ReservationStatus = Literal["reserved", "accepted", "rejected", "prepared", "collected", "cancelled"]


class ReservationCreate(BaseModel):
    availability_id: int
    quantity: int = Field(default=1, ge=1)


class ReservationBatchCreate(BaseModel):
    items: list[ReservationCreate] = Field(min_length=1)


class ReservationQuantityUpdate(BaseModel):
    quantity: int = Field(ge=1)


class ReservationStatusUpdate(BaseModel):
    status: ReservationStatus
    # Optional note to the student, only used when rejecting.
    rejection_reason: Optional[str] = Field(default=None, max_length=500)


class ReservationOut(BaseModel):
    id: int
    student_id: int
    availability_id: int
    menu_item_id: int
    menu_item_name: str
    quantity: int
    unit_price: float
    status: ReservationStatus
    reserved_at: datetime
    pickup_date: date
    rejection_reason: Optional[str] = None

    class Config:
        from_attributes = True


class ReservationCountOut(BaseModel):
    menu_item_id: int
    menu_item_name: str
    reserved_count: int


class StaffReservationOut(BaseModel):
    id: int
    student_id: int
    student_name: str
    availability_id: int
    menu_item_name: str
    quantity: int
    unit_price: float
    status: ReservationStatus
    reserved_at: datetime
    pickup_date: date
    rejection_reason: Optional[str] = None
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminReservationOut(StaffReservationOut):
    student_grade: str
    student_section: str
    reviewed_by_login_id: Optional[str] = None
