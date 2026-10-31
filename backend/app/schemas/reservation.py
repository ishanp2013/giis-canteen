from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

ReservationStatus = Literal["reserved", "prepared", "collected", "cancelled"]


class ReservationCreate(BaseModel):
    availability_id: int
    quantity: int = Field(default=1, ge=1)


class ReservationBatchCreate(BaseModel):
    items: list[ReservationCreate] = Field(min_length=1)


class ReservationQuantityUpdate(BaseModel):
    quantity: int = Field(ge=1)


class ReservationStatusUpdate(BaseModel):
    status: ReservationStatus


class ReservationOut(BaseModel):
    id: int
    student_id: int
    availability_id: int
    menu_item_name: str
    quantity: int
    unit_price: float
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
    quantity: int
    unit_price: float
    status: ReservationStatus
    reserved_at: datetime
    pickup_date: date

    class Config:
        from_attributes = True
