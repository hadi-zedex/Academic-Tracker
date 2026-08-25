from sqlalchemy import Column, Integer, String, DateTime, CheckConstraint, ForeignKey
from app.database import Base

class Event(Base):
    __tablename__="events"

    event_id=Column(Integer, primary_key=True)
    event_type=Column(String) 
    job_id=Column(Integer, ForeignKey("jobs.job_id", ondelete="CASCADE"), nullable=False)
    event_datetime=Column(DateTime)

    __table_args__=(
        CheckConstraint("event_type in ('OA', 'PPT', 'Interview')"),
    )