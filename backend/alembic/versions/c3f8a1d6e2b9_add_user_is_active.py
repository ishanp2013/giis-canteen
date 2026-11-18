"""add is_active to users so accounts are deactivated instead of deleted

Revision ID: c3f8a1d6e2b9
Revises: b7e2d5f81c4a
Create Date: 2026-11-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f8a1d6e2b9'
down_revision: Union[str, Sequence[str], None] = 'b7e2d5f81c4a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    # Deactivated accounts keep their login_id and email, so uniqueness only
    # applies to active accounts. That lets an admin re-create the same login.
    op.drop_constraint("users_login_id_key", "users", type_="unique")
    op.drop_constraint("users_email_key", "users", type_="unique")
    op.create_index("users_login_id_active_key", "users", ["login_id"], unique=True, postgresql_where=sa.text("is_active"))
    op.create_index("users_email_active_key", "users", ["email"], unique=True, postgresql_where=sa.text("is_active"))


def downgrade() -> None:
    op.drop_index("users_email_active_key", table_name="users")
    op.drop_index("users_login_id_active_key", table_name="users")
    op.create_unique_constraint("users_email_key", "users", ["email"])
    op.create_unique_constraint("users_login_id_key", "users", ["login_id"])
    op.drop_column("users", "is_active")
