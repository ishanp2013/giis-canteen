"""add prices to menu items and reservations

Revision ID: b7e2d5f81c4a
Revises: a4c1e9b2f7d3
Create Date: 2026-10-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e2d5f81c4a'
down_revision: Union[str, Sequence[str], None] = 'a4c1e9b2f7d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Prices are in AED. Existing dishes start at 0 until staff set a price.
    op.add_column(
        "menu_items",
        sa.Column("price", sa.Numeric(8, 2), nullable=False, server_default="0"),
    )
    op.create_check_constraint("menu_items_price_check", "menu_items", "price >= 0")

    # The price per portion at the time of reserving, so later price changes
    # don't rewrite what a student already ordered.
    op.add_column(
        "reservations",
        sa.Column("unit_price", sa.Numeric(8, 2), nullable=False, server_default="0"),
    )
    op.create_check_constraint("reservations_unit_price_check", "reservations", "unit_price >= 0")


def downgrade() -> None:
    op.drop_constraint("reservations_unit_price_check", "reservations", type_="check")
    op.drop_column("reservations", "unit_price")
    op.drop_constraint("menu_items_price_check", "menu_items", type_="check")
    op.drop_column("menu_items", "price")
