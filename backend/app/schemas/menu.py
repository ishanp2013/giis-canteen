from datetime import date
from typing import Optional

from pydantic import BaseModel


class MenuItemCreate(BaseModel):
    name: str
    description: Optional[str] = None


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class MenuItemOut(BaseModel):
    id: int
    name: str
    description: Optional[str]

    class Config:
        from_attributes = True


class AvailabilityCreate(BaseModel):
    menu_item_id: int
    available_date: date
    quantity_available: int


class AvailabilityUpdate(BaseModel):
    quantity_available: int


class AvailabilityOut(BaseModel):
    id: int
    menu_item_id: int
    menu_item_name: str
    description: Optional[str]
    available_date: date
    quantity_available: int
    remaining_availability: int
