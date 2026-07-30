"""add customer fields to transfers

Revision ID: 1d6774bf6696
Revises: 258cee37eca3
Create Date: 2026-07-25 07:41:44.056193
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1d6774bf6696"
down_revision: Union[str, Sequence[str], None] = (
    "258cee37eca3"
)
branch_labels: Union[
    str,
    Sequence[str],
    None,
] = None
depends_on: Union[
    str,
    Sequence[str],
    None,
] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column(
        "transfers",
        sa.Column(
            "customer_name",
            sa.String(length=120),
            nullable=True,
        ),
    )

    op.add_column(
        "transfers",
        sa.Column(
            "customer_phone",
            sa.String(length=30),
            nullable=True,
        ),
    )

    op.add_column(
        "transfers",
        sa.Column(
            "telegram_username",
            sa.String(length=64),
            nullable=True,
        ),
    )

    op.add_column(
        "transfers",
        sa.Column(
            "rejection_reason",
            sa.Text(),
            nullable=True,
        ),
    )

    # نضيف العمود مؤقتًا بحيث يقبل NULL
    op.add_column(
        "transfers",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # نملأ التحويلات القديمة بتاريخ الإنشاء
    op.execute(
        """
        UPDATE transfers
        SET updated_at = created_at
        WHERE updated_at IS NULL
        """
    )

    # بعد ملء البيانات نجعله إجباريًا
    op.alter_column(
        "transfers",
        "updated_at",
        existing_type=sa.DateTime(
            timezone=True,
        ),
        nullable=False,
    )

    op.create_index(
        op.f(
            "ix_transfers_customer_phone"
        ),
        "transfers",
        ["customer_phone"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_transfers_status"
        ),
        "transfers",
        ["status"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_transfers_telegram_username"
        ),
        "transfers",
        ["telegram_username"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_index(
        op.f(
            "ix_transfers_telegram_username"
        ),
        table_name="transfers",
    )

    op.drop_index(
        op.f(
            "ix_transfers_status"
        ),
        table_name="transfers",
    )

    op.drop_index(
        op.f(
            "ix_transfers_customer_phone"
        ),
        table_name="transfers",
    )

    op.drop_column(
        "transfers",
        "updated_at",
    )

    op.drop_column(
        "transfers",
        "rejection_reason",
    )

    op.drop_column(
        "transfers",
        "telegram_username",
    )

    op.drop_column(
        "transfers",
        "customer_phone",
    )

    op.drop_column(
        "transfers",
        "customer_name",
    )