from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db, Base, engine
from app.auth import hash_password, verify_password, create_access_token, get_current_student, get_current_admin

# import models
from app.models.student import Student
from app.models.job import Job
from app.models.practice_test import PracticeTest
from app.models.event import Event
from app.models.job_tracking import JobTracking
from app.models.notification import Notification

#import schemas
from app.schemas.student import StudentOut, StudentCreate, StudentLogin
from app.schemas.job import JobOut, JobCreate, JobUpdate
from app.schemas.event import EventOut, EventCreate, EventUpdate
from app.schemas.practice_test import PracticeTestOut, PracticeTestCreate
from app.schemas.job_tracking import JobTrackingOut, JobTrackingCreate


# this creates all tables that don't already exist, based on the models above
Base.metadata.create_all(bind=engine)


app=FastAPI()
@app.get("/")
def root():
    return {"status": "ok"}


#students
@app.post("/students", response_model=StudentOut)
def create_student(student: StudentCreate, db: Session = Depends(get_db)):
    db_student=Student(
        student_name=student.student_name,
        email=student.email,
        hashed_password=hash_password(student.password)
    )
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student

@app.get("/students/{student_id}", response_model=StudentOut)
def get_student(student_id: int, db: Session = Depends(get_db)):
    student=db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


#jobs
@app.post("/jobs", response_model=JobOut)
def create_job(job: JobCreate, current_student: Student = Depends(get_current_student), db: Session = Depends(get_db)):
    db_job=Job(
        company_name=job.company_name,
        role=job.role,
        job_deadline=job.job_deadline,
        created_by=current_student.student_id
    )
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    return db_job

@app.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: int,  db: Session = Depends(get_db)):
    job=db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.get("/jobs", response_model=list[JobOut])
def get_jobs(current_student: Student = Depends(get_current_student), db: Session = Depends(get_db)):
    jobs=(
        db.query(Job)
        .join(Student, Job.created_by==Student.student_id)
        .filter(
            or_(
                Student.is_admin==True,
                Job.created_by==current_student.student_id
            )
        )
        .all()
    )
    return jobs


#events
@app.post("/events", response_model=EventOut)
def create_event(event: EventCreate, current_student: Student = Depends(get_current_student), db: Session = Depends(get_db)):
    db_job=db.get(Job, event.job_id)
    if db_job is None:
        raise HTTPException(404, "Job not found")

    if not current_student.is_admin:
        if db_job.created_by != current_student.student_id:
            raise HTTPException(403, "Not authorized to post event")
    else:
        if not db.get(Student, db_job.created_by).is_admin:
             raise HTTPException(403, "Not authorized to post event")
        
    existing = db.query(Event).filter(Event.job_id == event.job_id, Event.event_type == event.event_type).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="An event of this type already exists for this job")

    db_event=Event(**event.model_dump())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

@app.get("/events/{event_id}", response_model=EventOut)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event=db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

@app.get("/events", response_model=list[EventOut])
def get_events(db: Session = Depends(get_db)):
    return db.query(Event).all()


#practice tests
@app.post("/practice_tests", response_model=PracticeTestOut)
def create_practice_test(practice_test: PracticeTestCreate, db: Session = Depends(get_db)):
    db_practice_test=PracticeTest(**practice_test.model_dump())
    db.add(db_practice_test)
    db.commit()
    db.refresh(db_practice_test)
    return db_practice_test

@app.get("/practice_tests/{test_id}", response_model=PracticeTestOut)
def get_practice_test(test_id: int, db: Session = Depends(get_db)):
    practice_test=db.get(PracticeTest, test_id)
    if practice_test is None:
        raise HTTPException(status_code=404, detail="Practice test not found")
    return practice_test

@app.get("/practice_tests", response_model=list[PracticeTestOut])
def get_practice_tests(db: Session = Depends(get_db)):
    return db.query(PracticeTest).all()


#job trackings
@app.post("/job_trackings", response_model=JobTrackingOut)
def create_job_tracking(job_tracking: JobTrackingCreate, current_student: Student = Depends(get_current_student), db: Session = Depends(get_db)):
    
    #if db.get(Student, current_student.student_id) is None:
        #raise HTTPException(404, "Applicant not found")

    if db.get(Job, job_tracking.job_id) is None:
        raise HTTPException(404, "Job not found")

    if db.query(JobTracking).filter(JobTracking.applicant_id==current_student.student_id, JobTracking.job_id==job_tracking.job_id).first() is not None:
        raise HTTPException(409, "Already tracking this job")

    db_job_tracking=JobTracking(
        applicant_id=current_student.student_id,
        job_id=job_tracking.job_id
    )
    db.add(db_job_tracking)
    db.commit()
    db.refresh(db_job_tracking)
    return db_job_tracking

@app.get("/job_trackings/{tracking_id}", response_model=JobTrackingOut)
def get_job_tracking(tracking_id: int, db: Session = Depends(get_db)):
    job_tracking=db.get(JobTracking, tracking_id)
    if job_tracking is None:
        raise HTTPException(status_code=404, detail="Job Tracking not found")
    return job_tracking

@app.get("/job_trackings", response_model=list[JobTrackingOut])
def get_job_trackings(db: Session = Depends(get_db)):
    return db.query(JobTracking).all()


#login
@app.post("/login")
def login(credentials: StudentLogin, db: Session = Depends(get_db)):
    student=db.query(Student).filter(Student.email==credentials.email).first()

    if student is None or not verify_password(credentials.password, student.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token=create_access_token(student.student_id)
    return {"access_token": token, "token_type": "bearer"}


#delete
@app.delete("/jobs/{job_id}", status_code=204)
def delete_job(job_id: int,  db: Session = Depends(get_db), current_student: Student = Depends(get_current_student)):
    job=db.query(Job).filter(Job.job_id==job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.created_by != current_student.student_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this job")
    db.delete(job)
    db.commit()

@app.delete("/admin/jobs/{job_id}", status_code=204)
def delete_job_admin(job_id: int,  db: Session = Depends(get_db), current_student: Student = Depends(get_current_admin)):
    job=db.query(Job).filter(Job.job_id==job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if not db.query(Student).filter(Student.student_id==job.created_by).first().is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this job")
    db.delete(job)
    db.commit()


#edit
@app.patch("/jobs/{job_id}", response_model=JobOut)
def edit_job(job_id: int, job: JobUpdate, current_student: Student = Depends(get_current_student), db: Session = Depends(get_db)):
    db_job=db.get(Job, job_id)
    if db_job is None:
        raise HTTPException(404, "Job not Found")
    
    if not current_student.is_admin:
        if db_job.created_by != current_student.student_id:
            raise HTTPException(403, "Not authorized to edit job")
    else:
        if not db.get(Student, db_job.created_by).is_admin:
             raise HTTPException(403, "Not authorized to edit job")

    update_data = job.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_job, key, value)
    
    db.commit()
    db.refresh(db_job)
    return db_job

@app.patch("/events/{event_id}", response_model=EventOut)
def edit_event(event_id: int, event: EventUpdate, current_student: Student = Depends(get_current_student), db: Session = Depends(get_db)):
    db_event=db.get(Event, event_id)
    if db_event is None:
        raise HTTPException(404, "Event not Found")

    db_job=db.get(Job, db_event.job_id)
    
    if db_job is None:
        raise HTTPException(404, "Job not found")

    if not current_student.is_admin:
        if db_job.created_by != current_student.student_id:
            raise HTTPException(403, "Not authorized to edit event")
    else:
        if not db.get(Student, db_job.created_by).is_admin:
             raise HTTPException(403, "Not authorized to edit event")

    update_data = event.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_event, key, value)
    
    db.commit()
    db.refresh(db_event)
    return db_event

