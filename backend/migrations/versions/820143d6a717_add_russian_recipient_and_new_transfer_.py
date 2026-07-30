"""add russian recipient and new transfer workflow

Revision ID: 820143d6a717
Revises: 1d6774bf6696
Create Date: 2026-07-25 08:36:26.455312
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "820143d6a717"
down_revision: Union[str, Sequence[str], None] = "1d6774bf6696"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "russian_recipients",
        sa.Column(
            "id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "transfer_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "recipient_name",
            sa.String(length=150),
            nullable=False,
        ),
        sa.Column(
            "recipient_phone",
            sa.String(length=30),
            nullable=False,
        ),
        sa.Column(
            "bank_name",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "card_number",
            sa.String(length=30),
            nullable=True,
        ),
        sa.Column(
            "account_number",
            sa.String(length=50),
            nullable=True,
        ),
        sa.Column(
            "sbp_phone",
            sa.String(length=30),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["transfer_id"],
            ["transfers.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_russian_recipients_id"),
        "russian_recipients",
        ["id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_russian_recipients_recipient_phone"),
        "russian_recipients",
        ["recipient_phone"],
        unique=False,
    )

    op.create_index(
        op.f("ix_russian_recipients_transfer_id"),
        "russian_recipients",
        ["transfer_id"],
        unique=True,
    )

    op.alter_column(
        "transfers",
        "status",
        existing_type=sa.VARCHAR(length=20),
        type_=sa.String(length=40),
        existing_nullable=False,
    )

    # Convert old workflow statuses to the new workflow.
    op.execute(
        """
        UPDATE transfers
        SET status = CASE status
            WHEN 'pending' THEN 'pending_payment'
            WHEN 'receipt_uploaded' THEN 'payment_proof_uploaded'
            WHEN 'approved' THEN 'waiting_recipient'
            WHEN 'completed' THEN 'completed'
            WHEN 'rejected' THEN 'rejected'
            ELSE status
        END
        """
    )


def downgrade() -> None:
    # Convert new workflow statuses back to the closest old workflow.
    op.execute(
        """
        UPDATE transfers
        SET status = CASE status
            WHEN 'pending_payment' THEN 'pending'
            WHEN 'payment_proof_uploaded' THEN 'receipt_uploaded'
            WHEN 'payment_confirmed' THEN 'approved'
            WHEN 'waiting_recipient' THEN 'approved'
            WHEN 'ready_to_send' THEN 'approved'
            WHEN 'rub_sent' THEN 'approved'
            WHEN 'completed' THEN 'completed'
            WHEN 'rejected' THEN 'rejected'
            ELSE 'pending'
        END
        """
    )

    op.alter_column(
        "transfers",
        "status",
        existing_type=sa.String(length=40),
        type_=sa.VARCHAR(length=20),
        existing_nullable=False,
    )

    op.drop_index(
        op.f("ix_russian_recipients_transfer_id"),
        table_name="russian_recipients",
    )

    op.drop_index(
        op.f("ix_russian_recipients_recipient_phone"),
        table_name="russian_recipients",
    )

    op.drop_index(
        op.f("ix_russian_recipients_id"),
        table_name="russian_recipients",
    )

    op.drop_table("russian_recipients")