from datetime import datetime, date, time
from typing import Dict, List
from fastapi import FastAPI, Depends, HTTPException
from contextlib import asynccontextmanager

# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
# pyrefly: ignore [missing-import]
from sqlalchemy import or_, and_

#utilities
from app.utilities.database import get_db, Base, engine
from app.utilities.auth import hash_password, verify_password, create_access_token, get_current_student, get_current_admin
from app.utilities.notification import create_notification 
from app.utilities.scheduler import start_scheduler, stop_scheduler

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
from app.schemas.notification import NotificationType, NotificationCreate, NotificationOut
from app.schemas.calendar import CalendarEventItem
from fastapi.middleware.cors import CORSMiddleware


# this creates all tables that don't already exist, based on the models above
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

    if current_student.is_admin:
        all_students = db.query(Student).all()
        for student in all_students:
            if student.student_id==current_student.student_id:
                continue
            try:
                create_notification(
                    db=db,
                    student_id=student.student_id,
                    notification_type=NotificationType.Post,
                    message=f"New job of {db_job.company_name} opened, track it if you have applied",
                    job_id=db_job.job_id,
                )
            except Exception as e:
                print(f"Failed to notify student {student.student_id}: {e}")
                db.rollback()

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

    if current_student.is_admin:
        job_tracking=db.query(JobTracking).filter(JobTracking.job_id==event.job_id).all()
        for tracking in job_tracking:
            if tracking.applicant_id==current_student.student_id:
                continue
            try:
                create_notification(
                    db=db,
                    student_id=tracking.applicant_id,
                    notification_type=NotificationType.Post,
                    message=f"{event.event_type.value} of {db_job.company_name} is scheduled on {event.event_datetime}",
                    event_id=db_event.event_id,
                )
            except Exception as e:
                print(f"Failed to notify student {tracking.applicant_id}: {e}")
                db.rollback()
            
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


#edit job and event
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


#notification
@app.get("/notifications", response_model=list[NotificationOut])
def get_notifications(current_student: Student = Depends(get_current_student), db: Session = Depends(get_db)):
    return (
        db.query(Notification)
        .filter(Notification.student_id == current_student.student_id, Notification.is_read == False)
        .order_by(Notification.created_at.desc())
        .all()
    )

@app.patch("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(notification_id: int, current_student: Student = Depends(get_current_student), db: Session = Depends(get_db)):
    db_notification = db.get(Notification, notification_id)
    if db_notification is None:
        raise HTTPException(404, "Notification not found")
    if db_notification.student_id != current_student.student_id:
        raise HTTPException(403, "Not authorized to modify this notification")

    db_notification.is_read = True
    db.commit()
    db.refresh(db_notification)
    return db_notification


#calender
def _get_calendar_items(
    db: Session,
    current_student: Student,
    start_dt: datetime,
    end_dt: datetime,
) -> List[CalendarEventItem]:
    items: List[CalendarEventItem] = []

    # --- Job deadlines: own personal jobs + all shared jobs ---
    job_rows = (
        db.query(Job)
        .join(Student, Job.created_by == Student.student_id)
        .filter(
            Job.job_deadline >= start_dt,
            Job.job_deadline < end_dt,
            or_(
                Student.is_admin == True,
                Job.created_by == current_student.student_id,
            ),
        )
        .all()
    )

    for job in job_rows:
        items.append(
            CalendarEventItem(
                type="job_deadline",
                id=job.job_id,
                label=f"{job.company_name} - {job.role}",
                color="red",
                datetime=job.job_deadline,
            )
        )

    # --- Events: own personal jobs' events + tracked shared jobs' events ---
    tracked_job_ids = (
        db.query(JobTracking.job_id)
        .filter(JobTracking.applicant_id == current_student.student_id)
    )

    event_rows = (
        db.query(Event, Job)
        .join(Job, Event.job_id == Job.job_id)
        .join(Student, Job.created_by == Student.student_id)
        .filter(
            Event.event_datetime >= start_dt,
            Event.event_datetime < end_dt,
            or_(
                Job.created_by == current_student.student_id,
                and_(
                    Student.is_admin == True,
                    Job.job_id.in_(tracked_job_ids),
                ),
            ),
        )
        .all()
    )
    for event, job in event_rows:
        items.append(
            CalendarEventItem(
                type="event",
                id=event.event_id,
                label=f"{event.event_type} - {job.company_name}",
                color="blue",
                datetime=event.event_datetime,
                event_type=event.event_type,
                company_name=job.company_name,
                role=job.role,
            )
        )

    # --- PracticeTests: everyone ---
    test_rows = (
        db.query(PracticeTest)
        .filter(
            PracticeTest.test_deadline >= start_dt,
            PracticeTest.test_deadline < end_dt,
        )
        .all()
    )
    for test in test_rows:
        items.append(
            CalendarEventItem(
                type="practice_test",
                id=test.test_id,
                label=test.test_name,
                color="red",
                datetime=test.test_deadline,
            )
        )

    items.sort(key=lambda i: i.datetime)
    return items

@app.get("/calendar/monthly")
def get_monthly_calendar(
    year: int,
    month: int,
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
) -> Dict[str, List[CalendarEventItem]]:
    start = date(year, month, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end, time.min)

    all_items = _get_calendar_items(db, current_student, start_dt, end_dt)

    grouped: Dict[str, List[CalendarEventItem]] = {}
    for item in all_items:
        key = item.datetime.strftime("%Y-%m-%d")
        grouped.setdefault(key, []).append(item)

    return grouped

@app.get("/calendar/daily")
def get_daily_calendar(
    date: date,
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
) -> List[CalendarEventItem]:
    start_dt = datetime.combine(date, time.min)
    end_dt = datetime.combine(date, time.max)

    return _get_calendar_items(db, current_student, start_dt, end_dt)