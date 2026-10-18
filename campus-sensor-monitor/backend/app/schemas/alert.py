
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


AlertStatus = Literal["open", "acknowledged", "resolved"]


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    rule_id: UUID
    sensor_id: str
    reading_type: str
    message: str
    observed_value: float
    status: AlertStatus
    triggered_at: datetime
    acknowledged_at: datetime | None
    resolved_at: datetime | None
    acknowledged_by: str | None
    resolved_by: str | None
    details: dict | None


class AlertAcknowledgeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    acknowledged_by: str = Field(min_length=1, max_length=150)


class AlertResolveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resolved_by: str = Field(min_length=1, max_length=150)
    resolution_note: str | None = Field(default=None, max_length=2000)
