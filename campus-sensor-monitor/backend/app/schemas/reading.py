
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator


SensorId = Annotated[str, Field(min_length=1, max_length=150)]
ReadingType = Annotated[str, Field(min_length=1, max_length=100)]


class SensorReadingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sensor_id: SensorId = Field(validation_alias="sensorId")
    reading_type: ReadingType = Field(validation_alias="type")
    value: float = Field(allow_inf_nan=False)
    timestamp: datetime

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp must include a timezone")
        return value


class SensorReadingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sensor_id: str = Field(serialization_alias="sensorId")
    reading_type: str = Field(serialization_alias="type")
    value: float
    timestamp: datetime


class ReadingBatchCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    readings: list[SensorReadingCreate] = Field(
        min_length=1,
        max_length=10000,
    )


class ReadingBatchResponse(BaseModel):
    accepted: int
    message: str
