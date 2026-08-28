from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from typing import Optional 

class EventType(str, Enum):
    OA= "OA"
    PPT= "PPT"
    Interview= "Interview"

class EventCreate(BaseModel):
    event_type: EventType
    event_datetime: datetime
    job_id: int

class EventOut(BaseModel):
    event_id: int
    event_type: EventType
    event_datetime: datetime
    job_id: int

    class Config:
        from_attributes = True # lets this read directly from a SQLAlchemy object, not just a dict

class EventUpdate(BaseModel):
    event_datetime: Optional[datetime] = None
    
    