from pydantic import BaseModel, EmailStr

class StudentCreate(BaseModel):
    # what a client must send to create a student — think about which
    # fields from your Student model belong here, and which don't
    student_name: str
    email: EmailStr
    password: str

class StudentOut(BaseModel):
    # ... the rest of the fields a client should see back
    student_id: int
    student_name: str
    email: str
    is_admin: bool

    class Config:
        from_attributes = True # lets this read directly from a SQLAlchemy object, not just a dict

class StudentLogin(BaseModel):
    email: EmailStr
    password: str