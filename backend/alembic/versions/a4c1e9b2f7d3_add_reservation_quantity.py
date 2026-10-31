"""add quantity to reservations

Revision ID: a4c1e9b2f7d3
Revises: 753cd19acae5
Create Date: 2026-10-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4c1e9b2f7d3'
down_revision: Union[str, Sequence[str], None] = '753cd19acae5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing reservations were all for a single portion, so default them to 1.
    op.add_column(
        "reservations",
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_check_constraint("reservations_quantity_check", "reservations", "quantity > 0")


def downgrade() -> None:
    op.drop_constraint("reservations_quantity_check", "reservations", type_="check")
    op.drop_column("reservations", "quantity")
