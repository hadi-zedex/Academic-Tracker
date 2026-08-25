from pydantic import BaseModel
from datetime import datetime

class PracticeTestCreate(BaseModel):
    test_name: str
    test_deadline: datetime

class PracticeTestOut(BaseModel):
    test_id: int
    test_name: str
    test_deadline: datetime

    class Config:
        from_attributes = True # lets this read directly from a SQLAlchemy object, not just a dict