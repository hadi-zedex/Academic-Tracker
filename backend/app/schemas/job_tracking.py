from pydantic import BaseModel

class JobTrackingCreate(BaseModel):
    #applicant_id: int
    job_id: int

class JobTrackingOut(BaseModel):
    tracking_id: int
    applicant_id: int
    job_id: int

    class Config:
        from_attributes = True # lets this read directly from a SQLAlchemy object, not just a dict