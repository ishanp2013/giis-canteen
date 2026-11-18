from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Reservation(Base):
    __tablename__ = "reservations"
    __table_args__ = (
        Index("idx_reservations_student_id", "student_id"),
        Index("idx_reservations_teacher_id", "teacher_id"),
        Index("idx_reservations_pickup_date", "pickup_date"),
        Index("idx_reservations_reserved_at", "reserved_at"),
        # Each reservation belongs to exactly one student or teacher.
        CheckConstraint("num_nonnulls(student_id, teacher_id) = 1", name="reservations_one_customer_check"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id"), nullable=True)
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id"), nullable=True)
    availability_id: Mapped[int] = mapped_column(ForeignKey("menu_availability.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(nullable=False, server_default="1")
    # AED per portion when reserved; kept so later price changes don't alter past orders.
    unit_price: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, server_default="0")
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="reserved")
    reserved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    pickup_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Set when canteen staff accept or reject the reservation.
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    student: Mapped["Student | None"] = relationship(back_populates="reservations")
    teacher: Mapped["Teacher | None"] = relationship(back_populates="reservations")
    availability: Mapped["MenuAvailability"] = relationship(back_populates="reservations")
    reviewer: Mapped["User | None"] = relationship(foreign_keys=[reviewed_by])

    # Who placed the order, whether a student or a teacher.
    @property
    def customer_type(self) -> str:
        return "teacher" if self.teacher_id is not None else "student"

    @property
    def customer_name(self) -> str:
        return self.teacher.name if self.teacher is not None else self.student.name

    @property
    def customer_detail(self) -> str:
        """Grade and section for a student; department and employee ID for a teacher."""
        if self.teacher is not None:
            return " · ".join(filter(None, [self.teacher.department, self.teacher.employee_id]))
        return f"Grade {self.student.grade} · {self.student.section}"
