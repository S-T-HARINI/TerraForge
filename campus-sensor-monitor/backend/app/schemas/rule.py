
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


RuleType = Literal["threshold", "time_window"]
RuleOperator = Literal[">", ">=", "<", "<=", "==", "!="]


class AlertRuleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    sensor_id: str | None = Field(default=None, min_length=1, max_length=150)
    reading_type: str = Field(min_length=1, max_length=100)
    rule_type: RuleType
    operator: RuleOperator
    threshold: float = Field(allow_inf_nan=False)
    window_seconds: int | None = Field(default=None, ge=1, le=86400)
    enabled: bool = True

    @model_validator(mode="after")
    def validate_window(self):
        if self.rule_type == "time_window" and self.window_seconds is None:
            raise ValueError(
                "window_seconds is required for time_window rules"
            )
        if self.rule_type == "threshold" and self.window_seconds is not None:
            raise ValueError(
                "window_seconds is only allowed for time_window rules"
            )
        return self


class AlertRuleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    sensor_id: str | None = Field(default=None, min_length=1, max_length=150)
    reading_type: str | None = Field(default=None, min_length=1, max_length=100)
    rule_type: RuleType | None = None
    operator: RuleOperator | None = None
    threshold: float | None = Field(default=None, allow_inf_nan=False)
    window_seconds: int | None = Field(default=None, ge=1, le=86400)
    enabled: bool | None = None


class AlertRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    sensor_id: str | None
    reading_type: str
    rule_type: str
    operator: str
    threshold: float
    window_seconds: int | None
    enabled: bool
    created_at: datetime
    updated_at: datetime
