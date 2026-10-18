"""Initial database schema for TerraForge

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-10-19 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Sensor readings table
    op.create_table(
        "sensor_readings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sensor_id", sa.String(150), nullable=False),
        sa.Column("reading_type", sa.String(100), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_sensor_readings_sensor_id",
        "sensor_readings",
        ["sensor_id"],
    )
    op.create_index(
        "ix_sensor_readings_reading_type",
        "sensor_readings",
        ["reading_type"],
    )
    op.create_index(
        "ix_sensor_readings_timestamp",
        "sensor_readings",
        ["timestamp"],
    )
    op.create_index(
        "ix_sensor_readings_sensor_type_timestamp",
        "sensor_readings",
        ["sensor_id", "reading_type", "timestamp"],
    )

    # Alert rules table
    op.create_table(
        "alert_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sensor_id", sa.String(150), nullable=True),
        sa.Column("reading_type", sa.String(100), nullable=False),
        sa.Column("rule_type", sa.String(30), nullable=False),
        sa.Column("operator", sa.String(10), nullable=False),
        sa.Column("threshold", sa.Float(), nullable=False),
        sa.Column("window_seconds", sa.Integer(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_alert_rules_sensor_id",
        "alert_rules",
        ["sensor_id"],
    )
    op.create_index(
        "ix_alert_rules_reading_type",
        "alert_rules",
        ["reading_type"],
    )
    op.create_index(
        "ix_alert_rules_enabled",
        "alert_rules",
        ["enabled"],
    )
    op.create_index(
        "ix_alert_rules_enabled_type",
        "alert_rules",
        ["enabled", "reading_type"],
    )

    # Alerts table
    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("rule_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("alert_rules.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("sensor_id", sa.String(150), nullable=False),
        sa.Column("reading_type", sa.String(100), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("observed_value", sa.Float(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_by", sa.String(150), nullable=True),
        sa.Column("resolved_by", sa.String(150), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
    )
    op.create_index(
        "ix_alerts_rule_id",
        "alerts",
        ["rule_id"],
    )
    op.create_index(
        "ix_alerts_sensor_id",
        "alerts",
        ["sensor_id"],
    )
    op.create_index(
        "ix_alerts_status",
        "alerts",
        ["status"],
    )
    op.create_index(
        "ix_alerts_triggered_at",
        "alerts",
        ["triggered_at"],
    )
    op.create_index(
        "ix_alerts_status_triggered_at",
        "alerts",
        ["status", "triggered_at"],
    )


def downgrade() -> None:
    op.drop_table("alerts")
    op.drop_table("alert_rules")
    op.drop_table("sensor_readings")
