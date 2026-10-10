from datetime import date

from sqlalchemy import Date, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MenuAvailability(Base):
    """One row per (menu item, day) it's offered on, with that day's quantity.
    This is what students actually see and reserve against."""

    __tablename__ = "menu_availability"
    __table_args__ = (
        Index("idx_menu_availability_available_date", "available_date"),
        UniqueConstraint("menu_item_id", "available_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    menu_item_id: Mapped[int] = mapped_column(ForeignKey("menu_items.id"), nullable=False)
    available_date: Mapped[date] = mapped_column(Date, nullable=False)
    quantity_available: Mapped[int] = mapped_column(nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    menu_item: Mapped["MenuItem"] = relationship(back_populates="availability")
    reservations: Mapped[list["Reservation"]] = relationship(back_populates="availability")
