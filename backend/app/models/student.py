from sqlalchemy import Column, Integer, String, Boolean
from app.utilities.database import Base

class Student(Base):
    __tablename__="students"

    student_id=Column(Integer, primary_key=True)
    student_name=Column(String)
    email=Column(String, unique=True)
    is_admin=Column(Boolean, default=False)
    hashed_password=Column(String(60), nullable=False)