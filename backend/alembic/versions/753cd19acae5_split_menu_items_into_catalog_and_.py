"""split menu items into catalog and availability

Revision ID: 753cd19acae5
Revises: 833d686dd94f
Create Date: 2026-07-06 00:15:14.245707

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '753cd19acae5'
down_revision: Union[str, Sequence[str], None] = '833d686dd94f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "menu_availability",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("menu_item_id", sa.Integer(), sa.ForeignKey("menu_items.id"), nullable=False),
        sa.Column("available_date", sa.Date(), nullable=False),
        sa.Column("quantity_available", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.UniqueConstraint("menu_item_id", "available_date"),
    )
    op.create_index(
        "idx_menu_availability_available_date", "menu_availability", ["available_date"]
    )

    # Every existing menu_items row already represents exactly one day's
    # offering, so it becomes both the catalog row (name/description) and
    # its own availability row. Reusing the same id lets existing
    # reservations keep pointing at the right row after the rename below.
    op.execute(
        """
        INSERT INTO menu_availability (id, menu_item_id, available_date, quantity_available, created_by)
        SELECT id, id, available_date, quantity_available, created_by FROM menu_items
        """
    )
    op.execute(
        "SELECT setval('menu_availability_id_seq', (SELECT COALESCE(MAX(id), 1) FROM menu_availability))"
    )

    op.drop_constraint("reservations_menu_item_id_fkey", "reservations", type_="foreignkey")
    op.alter_column("reservations", "menu_item_id", new_column_name="availability_id")
    op.create_foreign_key(
        "reservations_availability_id_fkey",
        "reservations",
        "menu_availability",
        ["availability_id"],
        ["id"],
    )

    op.drop_index("idx_menu_items_available_date", table_name="menu_items")
    op.drop_column("menu_items", "available_date")
    op.drop_column("menu_items", "quantity_available")


def downgrade() -> None:
    op.add_column("menu_items", sa.Column("available_date", sa.Date(), nullable=True))
    op.add_column("menu_items", sa.Column("quantity_available", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE menu_items SET available_date = ma.available_date, quantity_available = ma.quantity_available
        FROM menu_availability ma WHERE ma.menu_item_id = menu_items.id
        """
    )
    op.alter_column("menu_items", "available_date", nullable=False)
    op.alter_column("menu_items", "quantity_available", nullable=False)
    op.create_index("idx_menu_items_available_date", "menu_items", ["available_date"])

    op.drop_constraint("reservations_availability_id_fkey", "reservations", type_="foreignkey")
    op.alter_column("reservations", "availability_id", new_column_name="menu_item_id")
    op.create_foreign_key(
        "reservations_menu_item_id_fkey", "reservations", "menu_items", ["menu_item_id"], ["id"]
    )

    op.drop_index("idx_menu_availability_available_date", table_name="menu_availability")
    op.drop_table("menu_availability")
