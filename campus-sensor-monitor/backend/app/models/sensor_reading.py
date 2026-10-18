
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, Float, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    sensor_id: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
    )
    reading_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    value: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index(
            "ix_sensor_readings_sensor_type_timestamp",
            "sensor_id",
            "reading_type",
            "timestamp",
        ),
    )
