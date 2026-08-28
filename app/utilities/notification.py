from sqlalchemy.orm import Session
from app.schemas.notification import NotificationType
from app.models.notification import Notification
from datetime import datetime


def create_notification(
    db: Session,
    student_id: int,
    notification_type: NotificationType,
    message: str,
    job_id: int | None = None,
    event_id: int | None = None,
    practice_test_id: int | None = None,
):
    # 1. query for an existing Notification matching:
    #    student_id + reminder_type + whichever one FK was passed
    #    (think: how do you write a .filter() that checks "job_id == X"
    #     only when job_id was actually passed, and ignores it otherwise?)
    db_notification = db.query(Notification).filter(Notification.student_id==student_id, Notification.notification_type==notification_type, Notification.job_id==job_id, Notification.event_id==event_id, Notification.practice_test_id==practice_test_id).first()
    
    # 2. if found: return your decided "duplicate" response
    if db_notification:
        return "Already scheduled"

    # 3. if not found: build and insert a new Notification, commit, return it
    now = datetime.now()
    db_notification=Notification(
        student_id=student_id,
        job_id=job_id,
        event_id=event_id,
        practice_test_id=practice_test_id,
        message=message,
        created_at=now,
        is_read=False,
        notification_type=notification_type
    )
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    return db_notification