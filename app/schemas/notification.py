from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from typing import Optional


class NotificationType(str, Enum):
    One_hr= "1hr"
    Three_hr= "3hr"
    Eight_pm= "8pm"
    Post= "post"

class NotificationCreate(BaseModel):
    student_id: int
    job_id: Optional[int] = None
    event_id: Optional[int] = None
    practice_test_id: Optional[int] = None
    message: str
    created_at: datetime
    is_read: bool
    notification_type: NotificationType

class NotificationOut(BaseModel):
    notification_id: int
    student_id: int
    job_id: Optional[int] = None
    event_id: Optional[int] = None
    practice_test_id: Optional[int] = None
    message: str
    created_at: datetime
    is_read: bool
    notification_type: NotificationType

    class Config:
        from_attributes = True # lets this read directly from a SQLAlchemy object, not just a dict    
    