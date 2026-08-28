from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel


class CalendarEventItem(BaseModel):
    type: Literal["job_deadline", "event", "practice_test"]
    id: int
    label: str
    color: Literal["red", "blue"]
    datetime: datetime
    event_type: Optional[str] = None
    company_name: Optional[str] = None
    role: Optional[str] = None

    class Config:
        from_attributes = True