from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.utilities.database import Base

class Job(Base):
    __tablename__="jobs"

    job_id=Column(Integer, primary_key=True)
    company_name=Column(String)
    role=Column(String)
    job_deadline=Column(DateTime)
    created_by=Column(Integer, ForeignKey("students.student_id"), nullable=False)