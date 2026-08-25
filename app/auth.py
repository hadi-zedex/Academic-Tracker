import os
from dotenv import load_dotenv
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from passlib.context import CryptContext

from jose import jwt, JWTError

from sqlalchemy.orm import Session

from app.database import get_db
from app.models.student import Student



load_dotenv() 
SECRET_KEY=os.getenv("SECRET_KEY")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


pwd_context=CryptContext(schemes=["bcrypt"], deprecated="auto")
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(student_id: int) -> str:
    expire=datetime.utcnow()+timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload={
        "sub": str(student_id),
        "exp": expire
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
def get_current_student(token: str= Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        student_id=int(payload["sub"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    student=db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=401, detail="Student not found")
    return student

def get_current_admin(current_student: Student = Depends(get_current_student)):
    if not current_student.is_admin:
        raise HTTPException(status_code=403, detail="Not admin")
    return current_student