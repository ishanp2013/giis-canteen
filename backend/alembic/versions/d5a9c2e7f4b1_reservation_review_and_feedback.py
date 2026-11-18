"""staff accept/reject reservations, and suggestion/complaint feedback

Revision ID: d5a9c2e7f4b1
Revises: c3f8a1d6e2b9
Create Date: 2026-11-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5a9c2e7f4b1'
down_revision: Union[str, Sequence[str], None] = 'c3f8a1d6e2b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 'reserved' now means "waiting for staff"; staff accept or reject it first.
    op.drop_constraint("reservations_status_check", "reservations", type_="check")
    op.create_check_constraint(
        "reservations_status_check",
        "reservations",
        "status IN ('reserved', 'accepted', 'rejected', 'prepared', 'collected', 'cancelled')",
    )
    op.add_column("reservations", sa.Column("rejection_reason", sa.String(500), nullable=True))
    op.add_column("reservations", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("reservations", sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.create_index("idx_reservations_reserved_at", "reservations", ["reserved_at"])

    op.create_table(
        "feedback",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("subject", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("category IN ('suggestion', 'complaint')", name="feedback_category_check"),
        sa.CheckConstraint("status IN ('open', 'resolved')", name="feedback_status_check"),
    )
    op.create_index("idx_feedback_user_id", "feedback", ["user_id"])


def downgrade() -> None:
    op.drop_index("idx_feedback_user_id", table_name="feedback")
    op.drop_table("feedback")

    op.drop_index("idx_reservations_reserved_at", table_name="reservations")
    op.drop_column("reservations", "reviewed_by")
    op.drop_column("reservations", "reviewed_at")
    op.drop_column("reservations", "rejection_reason")
    # Fold the new statuses back into the closest old ones.
    op.execute("UPDATE reservations SET status = 'reserved' WHERE status = 'accepted'")
    op.execute("UPDATE reservations SET status = 'cancelled' WHERE status = 'rejected'")
    op.drop_constraint("reservations_status_check", "reservations", type_="check")
    op.create_check_constraint(
        "reservations_status_check",
        "reservations",
        "status IN ('reserved', 'prepared', 'collected', 'cancelled')",
    )
