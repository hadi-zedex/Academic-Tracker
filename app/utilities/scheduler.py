# pyrefly: ignore [missing-import]
from app.models.student import Student
from app.models.practice_test import PracticeTest
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta, time
from app.utilities.database import Sessionlocal
from app.models.job import Job
from app.models.job_tracking import JobTracking
from app.utilities.notification import create_notification
from app.schemas.notification import NotificationType
from app.models.event import Event


# One shared scheduler instance for the whole app.
scheduler = BackgroundScheduler()


def poll_notifications():
    """
    This is the function that runs on every scheduler tick.
    """
    print(f"[scheduler] tick at {datetime.now()}")

    db = Sessionlocal()
    try:
        now = datetime.now()
        OneHr_window_start = now + timedelta(minutes=55)
        OneHr_window_end = now + timedelta(minutes=65)
        jobs=db.query(Job).filter(Job.job_deadline>OneHr_window_start, Job.job_deadline<OneHr_window_end).all()
        for job in jobs:
            job_tracking=db.query(JobTracking).filter(JobTracking.job_id==job.job_id).all()
            for tracking in job_tracking:
                try:
                    create_notification(
                        db=db,
                        student_id=tracking.applicant_id,
                        notification_type=NotificationType.One_hr,
                        message=f"Job of {job.company_name} closes in one hour...",
                        job_id=job.job_id,
                    )
                except Exception as e:
                    print(f"Failed to notify student {tracking.applicant_id}: {e}")
                    db.rollback()


        now = datetime.now()
        ThreeHr_window_start = now + timedelta(minutes=175)
        ThreeHr_window_end = now + timedelta(minutes=185)
        events=db.query(Event).filter(Event.event_datetime>ThreeHr_window_start, Event.event_datetime<ThreeHr_window_end).all()
        for event in events:
            job=db.get(Job, event.job_id)
            job_tracking=db.query(JobTracking).filter(JobTracking.job_id==job.job_id).all()
            for tracking in job_tracking:
                try:
                    create_notification(
                        db=db,
                        student_id=tracking.applicant_id,
                        notification_type=NotificationType.Three_hr,
                        message=f"{event.event_type} of {job.company_name} in three hours...",
                        event_id=event.event_id,
                    )
                except Exception as e:
                    print(f"Failed to notify student {tracking.applicant_id}: {e}")
                    db.rollback()
        
        practice_tests=db.query(PracticeTest).filter(PracticeTest.test_deadline>ThreeHr_window_start, PracticeTest.test_deadline<ThreeHr_window_end).all()
        for practice_test in practice_tests:
            for student in db.query(Student).all():
                try:
                    create_notification(
                        db=db,
                        student_id=student.student_id,
                        notification_type=NotificationType.Three_hr,
                        message=f"{practice_test.test_name} practie test deadline is in three hours...",
                        practice_test_id=practice_test.test_id,
                    )
                except Exception as e:
                    print(f"Failed to notify student {student.student_id}: {e}")
                    db.rollback()


        now = datetime.now()
        today = datetime.now().date()
        tomorrow = today + timedelta(days=1)
        eight_pm_today_start = datetime.combine(today, time(20, 0)) - timedelta(minutes=5)
        eight_pm_today_end = datetime.combine(today, time(20, 0)) + timedelta(minutes=5)
        tomorrow_start = datetime.combine(tomorrow, time(0,0))
        tomorrow_end = tomorrow_start + timedelta(days=1)
        if now < eight_pm_today_end and now > eight_pm_today_start:
            events=db.query(Event).filter(Event.event_datetime>tomorrow_start, Event.event_datetime<tomorrow_end).all()
            for event in events:
                job=db.get(Job, event.job_id)
                job_tracking=db.query(JobTracking).filter(JobTracking.job_id==job.job_id).all()
                for tracking in job_tracking:
                    try:
                        create_notification(
                            db=db,
                            student_id=tracking.applicant_id,
                            notification_type=NotificationType.Eight_pm,
                            message=f"{event.event_type} of {job.company_name} is tomorrow...",
                            event_id=event.event_id,
                        )
                    except Exception as e:
                        print(f"Failed to notify student {tracking.applicant_id}: {e}")
                        db.rollback()
            
            practice_tests=db.query(PracticeTest).filter(PracticeTest.test_deadline>tomorrow_start, PracticeTest.test_deadline<tomorrow_end).all()
            for practice_test in practice_tests:
                for student in db.query(Student).all():
                    try:
                        create_notification(
                            db=db,
                            student_id=student.student_id,
                            notification_type=NotificationType.Eight_pm,
                            message=f"You have a {practice_test.test_name} practie test tomorrow, just reminding...",
                            practice_test_id=practice_test.test_id,
                        )
                    except Exception as e:
                        print(f"Failed to notify student {student.student_id}: {e}")
                        db.rollback()

    finally:
        db.close()


def start_scheduler():
    scheduler.add_job(poll_notifications, "interval", minutes=1, next_run_time=datetime.now())
    scheduler.start()


def stop_scheduler():
    scheduler.shutdown()