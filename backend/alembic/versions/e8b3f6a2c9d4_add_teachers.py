"""add the teacher role, teacher profiles, and teacher reservations

Revision ID: e8b3f6a2c9d4
Revises: d5a9c2e7f4b1
Create Date: 2026-11-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8b3f6a2c9d4'
down_revision: Union[str, Sequence[str], None] = 'd5a9c2e7f4b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("roles_name_check", "roles", type_="check")
    op.create_check_constraint(
        "roles_name_check", "roles", "name IN ('student', 'teacher', 'canteen_staff', 'school_admin')"
    )
    op.execute("INSERT INTO roles (name) VALUES ('teacher') ON CONFLICT (name) DO NOTHING")

    op.create_table(
        "teachers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("employee_id", sa.String(50), nullable=False),
        sa.Column("department", sa.String(100), nullable=True),
    )

    # A reservation now belongs to either a student or a teacher.
    op.alter_column("reservations", "student_id", nullable=True)
    op.add_column("reservations", sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("teachers.id"), nullable=True))
    op.create_check_constraint(
        "reservations_one_customer_check", "reservations", "num_nonnulls(student_id, teacher_id) = 1"
    )
    op.create_index("idx_reservations_teacher_id", "reservations", ["teacher_id"])


def downgrade() -> None:
    # Teacher orders can't be represented in the old schema, so they are removed.
    op.execute("DELETE FROM reservations WHERE teacher_id IS NOT NULL")
    op.drop_index("idx_reservations_teacher_id", table_name="reservations")
    op.drop_constraint("reservations_one_customer_check", "reservations", type_="check")
    op.drop_column("reservations", "teacher_id")
    op.alter_column("reservations", "student_id", nullable=False)

    op.drop_table("teachers")
    # Teacher accounts lose their role, so deactivate them under the student role.
    op.execute(
        "UPDATE users SET is_active = false, role_id = (SELECT id FROM roles WHERE name = 'student') "
        "WHERE role_id = (SELECT id FROM roles WHERE name = 'teacher')"
    )
    op.execute("DELETE FROM roles WHERE name = 'teacher'")
    op.drop_constraint("roles_name_check", "roles", type_="check")
    op.create_check_constraint("roles_name_check", "roles", "name IN ('student', 'canteen_staff', 'school_admin')")
