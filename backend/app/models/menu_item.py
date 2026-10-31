from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MenuItem(Base):
    """The reusable catalog of dishes. No date or quantity here — see MenuAvailability."""

    __tablename__ = "menu_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, server_default="0")  # AED
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    availability: Mapped[list["MenuAvailability"]] = relationship(back_populates="menu_item")
