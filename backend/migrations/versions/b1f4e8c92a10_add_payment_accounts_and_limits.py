"""add payment accounts and limits

Revision ID: b1f4e8c92a10
Revises: 820143d6a717
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b1f4e8c92a10"
down_revision: Union[str, Sequence[str], None] = "820143d6a717"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payment_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("account_type", sa.String(length=20), nullable=False),
        sa.Column("account_number", sa.String(length=80), nullable=False),
        sa.Column("account_holder_name", sa.String(length=150), nullable=False),
        sa.Column("daily_limit", sa.Numeric(12, 2), nullable=False),
        sa.Column("monthly_limit", sa.Numeric(12, 2), nullable=False),
        sa.Column("warning_threshold", sa.Numeric(5, 2), nullable=False, server_default="80"),
        sa.Column("critical_threshold", sa.Numeric(5, 2), nullable=False, server_default="90"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_payment_accounts_account_type", "payment_accounts", ["account_type"])
    op.create_index("ix_payment_accounts_is_active", "payment_accounts", ["is_active"])
    op.add_column("transfers", sa.Column("payment_account_id", sa.Integer(), nullable=True))
    op.add_column("transfers", sa.Column("payment_confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_transfers_payment_account_id", "transfers", ["payment_account_id"])
    op.create_index("ix_transfers_payment_confirmed_at", "transfers", ["payment_confirmed_at"])
    op.create_foreign_key("fk_transfers_payment_account", "transfers", "payment_accounts", ["payment_account_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint("fk_transfers_payment_account", "transfers", type_="foreignkey")
    op.drop_index("ix_transfers_payment_confirmed_at", table_name="transfers")
    op.drop_column("transfers", "payment_confirmed_at")
    op.drop_index("ix_transfers_payment_account_id", table_name="transfers")
    op.drop_column("transfers", "payment_account_id")
    op.drop_index("ix_payment_accounts_is_active", table_name="payment_accounts")
    op.drop_index("ix_payment_accounts_account_type", table_name="payment_accounts")
    op.drop_table("payment_accounts")
