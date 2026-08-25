from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class JobCreate(BaseModel):
    company_name: str
    role: str
    job_deadline: datetime

class JobOut(BaseModel):
    job_id: int
    company_name: str
    role: str
    job_deadline: datetime
    created_by: int

    class Config:
        from_attributes = True # lets this read directly from a SQLAlchemy object, not just a dict

class JobUpdate(BaseModel):
    company_name: Optional[str] = None
    role: Optional[str] = None
    job_deadline: Optional[datetime] = None
