"""add manual pricing settings

Revision ID: c4f7a9b2d501
Revises: b1f4e8c92a10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c4f7a9b2d501"
down_revision: Union[str, Sequence[str], None] = "b1f4e8c92a10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pricing_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("instapay_rate", sa.Numeric(10, 4), nullable=False),
        sa.Column("vodafone_rate", sa.Numeric(10, 4), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.execute(
        "INSERT INTO pricing_settings (id, instapay_rate, vodafone_rate, updated_at) "
        "VALUES (1, 1.6500, 1.6300, CURRENT_TIMESTAMP)"
    )


def downgrade() -> None:
    op.drop_table("pricing_settings")
