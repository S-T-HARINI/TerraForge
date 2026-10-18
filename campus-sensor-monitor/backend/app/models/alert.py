
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    rule_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("alert_rules.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sensor_id: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
    )
    reading_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    observed_value: Mapped[float] = mapped_column(
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="open",
        index=True,
    )
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    acknowledged_by: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    resolved_by: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    details: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    __table_args__ = (
        Index(
            "ix_alerts_status_triggered_at",
            "status",
            "triggered_at",
        ),
    )
