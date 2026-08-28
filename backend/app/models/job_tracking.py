from sqlalchemy import Column, Integer, ForeignKey
from app.utilities.database import Base

class JobTracking(Base):
    __tablename__="job_trackings"

    tracking_id=Column(Integer, primary_key=True)
    applicant_id=Column(Integer, ForeignKey("students.student_id"), nullable=False)
    job_id=Column(Integer, ForeignKey("jobs.job_id", ondelete="CASCADE"), nullable=False)