from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base

class PracticeTest(Base):
    __tablename__="practice_tests"

    test_id=Column(Integer, primary_key=True)
    test_name=Column(String) 
    test_deadline=Column(DateTime)