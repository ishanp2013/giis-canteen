from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

ReservationStatus = Literal["reserved", "prepared", "collected", "cancelled"]


class ReservationCreate(BaseModel):
    availability_id: int


class ReservationStatusUpdate(BaseModel):
    status: ReservationStatus


class ReservationOut(BaseModel):
    id: int
    student_id: int
    availability_id: int
    menu_item_name: str
    status: ReservationStatus
    reserved_at: datetime
    pickup_date: date

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
    status: ReservationStatus
    reserved_at: datetime
    pickup_date: date

    class Config:
        from_attributes = True
