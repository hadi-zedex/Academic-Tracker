from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from app.database import Base

class Notification(Base):
    __tablename__="notifications"

    notification_id=Column(Integer, primary_key=True)
    student_id=Column(Integer, ForeignKey("students.student_id"), nullable=False)
    job_id=Column(Integer, ForeignKey("jobs.job_id", ondelete="CASCADE"), nullable=True)
    event_id=Column(Integer,ForeignKey("events.event_id", ondelete="CASCADE"), nullable=True)
    practice_test_id=Column(Integer,ForeignKey("practice_tests.test_id"), nullable=True)
    message=Column(String)
    created_at=Column(DateTime)
    is_read=Column(Boolean, default=False)
    