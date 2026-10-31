from datetime import date
from decimal import Decimal
from typing import Annotated, Optional

from pydantic import BaseModel, Field

# Price in AED: non-negative, at most 2 decimal places (fils).
Price = Annotated[Decimal, Field(ge=0, max_digits=8, decimal_places=2)]


class MenuItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: Price


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Price] = None


class MenuItemOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    price: float

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
    price: float
    available_date: date
    quantity_available: int
    remaining_availability: int
