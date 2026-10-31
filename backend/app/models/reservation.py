from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Index, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Reservation(Base):
    __tablename__ = "reservations"
    __table_args__ = (
        Index("idx_reservations_student_id", "student_id"),
        Index("idx_reservations_pickup_date", "pickup_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    availability_id: Mapped[int] = mapped_column(ForeignKey("menu_availability.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(nullable=False, server_default="1")
    # AED per portion when reserved; kept so later price changes don't alter past orders.
    unit_price: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, server_default="0")
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="reserved")
    reserved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    pickup_date: Mapped[date] = mapped_column(Date, nullable=False)

    student: Mapped["Student"] = relationship(back_populates="reservations")
    availability: Mapped["MenuAvailability"] = relationship(back_populates="reservations")
