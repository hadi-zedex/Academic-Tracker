# Placement Tracker — Stage 5: Admin & Personal Job Tooling
 
Companion to `placement_tracker_spec.md` (product), `placement_tracker_schema.md` (data model), `placement_tracker_techstack.md` (stack), `placement_tracker_stage3_api.md` (Stage 3 CRUD), and `placement_tracker_stage4_auth.md` (Stage 4 auth + Job visibility model). This doc covers Stage 5 as built so far: cascade-delete schema changes, delete routes, the `POST /events` authorization gap that got caught and closed, and edit routes. Merge and admin-promotion are still open — see `placement_tracker_roadmap.md` for current status.
 
## Scope, as finalized this stage (see roadmap doc for the full scoping discussion)
Fuzzy-match-on-create was dropped entirely — duplicates among shared jobs are expected (multiple branch admins posting independently) and are caught by an admin's own judgment, not an algorithm. Merge, edit, and delete on shared jobs are admin-only and apply only to shared (admin-created) jobs; personal jobs get their own edit/delete, scoped to their owner only. See `placement_tracker_schema.md` for the full rationale.
 
## Schema change: cascade deletes
Four FKs got `ondelete="CASCADE"` added so that deleting a `Job` (personal or shared) automatically removes everything that points at it, at the database level, without the app manually deleting each dependent table first:
- `Event.job_id`
- `JobTracking.job_id`
- `Notification.job_id`
- `Notification.event_id` (so a deleted `Event` also cleans up any `Notification` rows pointing at it, not just ones pointing at the `Job` directly)
**SQLAlchemy detail worth remembering:** `ondelete` is an argument to `ForeignKey(...)`, not `Column(...)` — a real bug caught this stage. It describes the constraint itself (what happens on delete), not a property of the column.
```python
job_id = Column(Integer, ForeignKey("jobs.job_id", ondelete="CASCADE"), nullable=False)
```
 
**Getting the change into Postgres:** since these were changes to existing tables' constraints (not new tables), `Base.metadata.create_all()` couldn't apply them — same limitation hit in Stage 4 for the `hashed_password` column. Applied via a full `TRUNCATE ... RESTART IDENTITY CASCADE` reset rather than an in-place `ALTER TABLE`, since test data didn't need preserving at this point.
 
## Routes built this stage
 
| Route | Who | What |
|---|---|---|
| `DELETE /jobs/{job_id}` | Any authenticated student | Deletes a job **they created**. `404` if the job doesn't exist, `403` if they don't own it. Cascade removes its events/trackings/notifications. |
| `DELETE /admin/jobs/{job_id}` | Admin only (`Depends(get_current_admin)`) | Deletes any **shared** job (creator is an admin — checked by looking up the creator's `Student` row and its `is_admin` flag, not the current requester's). `404` if missing, `403` if the target job is actually personal (creator isn't an admin). |
| `PATCH /jobs/{job_id}` | Owner (personal) or any admin (shared) | Partial update — only fields present in the request body are changed. Same shared/personal branching authorization as the routes above. |
| `PATCH /events/{event_id}` | Owner of the parent job (personal) or any admin (parent job is shared) | Partial update, currently just `event_datetime` — built with postponement in mind. Same branching authorization, resolved via the event's `job_id`. |
| `POST /events` *(fix, not new)* | Owner of the parent job (personal) or any admin (parent job is shared) | **Was completely unauthenticated since Stage 3** — this was caught mid-session while discussing the edit routes, not part of the original Stage 5 plan. Retrofitted with `Depends(get_current_student)`, the same branching authorization check, and a duplicate-prevention check (one `OA`/`PPT`/`Interview` per job, enforced for both shared and personal jobs). |
 
`get_current_admin` (documented as already built in the Stage 4 doc, but actually missing from `security.py` when Stage 5 started) was written this stage:
```python
def get_current_admin(current_student: Student = Depends(get_current_student)):
    if not current_student.is_admin:
        raise HTTPException(status_code=403, detail="Not admin")
    return current_student
```
Layers on top of `get_current_student` rather than re-decoding the token — composes the existing dependency instead of duplicating its logic. `placement_tracker_stage4_auth.md` has been corrected to note this discrepancy rather than left stating it as already done.
 
## The recurring authorization pattern this stage
Delete, edit, and event-create all share the same two-branch shape, once the target `Job` (or its parent, for events) has been fetched:
```python
if not current_student.is_admin:
    if db_job.created_by != current_student.student_id:
        raise HTTPException(403, "...")
else:
    if not db.get(Student, db_job.created_by).is_admin:
        raise HTTPException(403, "...")
```
Read as: *if you're not an admin, you must be the exact creator; if you are an admin, the job must actually be shared (its creator must also be an admin) — being an admin doesn't grant blanket access to every job, only to shared ones.* This mirrors the Stage 4 `GET /jobs` visibility logic (shared-ness is derived from the *creator's* `is_admin`, not the requester's) rather than introducing a new rule.
 
One route (`POST /events`) briefly got this reasoning conflated — an early draft compared `db_job.created_by` to `current_student.student_id` unconditionally, which would have incorrectly blocked one admin from adding an event to a different admin's shared job. Caught and fixed before it shipped; a good example of how "the creator of the job" and "who's currently allowed to act on it" are different things once multiple admins exist.
 
## Design decisions & why
 
**`PATCH`, not `PUT`, for edit routes.** `PUT` conventionally means "replace the whole resource" — the client would have to resend every field, including unchanged ones. `PATCH` means "here's what changed" — a client fixing a deadline typo shouldn't have to resend `company_name` and `role` too.
 
**`JobUpdate`/`EventUpdate` schemas: every field `Optional[...]` with an explicit `= None` default.** A real bug was caught here: `Optional[datetime]` alone only allows the value to *be* `None` if sent — it doesn't make the field skippable. Without `= None` as an actual default, Pydantic still treats it as required, and an empty `PATCH` body would fail validation. Both schemas now correctly default every field to `None`.
 
**Applying updates via `.model_dump(exclude_unset=True)` + `setattr` loop, not a manual `db.update().values(...)` construct.** `exclude_unset=True` returns a dict containing only the fields the client actually included in the request — fields left out entirely are absent from the dict, not present as `None`. Looping over that dict with `setattr(db_object, key, value)` mutates only the fields that were actually sent, directly on the already-fetched ORM object, no separate manual "was this field provided" check needed per field (an earlier draft tried `field if field is not None else db_obj.field` for each field individually — works, but doesn't scale, and was based on a broken `if not None` condition originally, a real logic bug since `not None` is always `False` regardless of the field's actual value).
 
**Event duplicate-prevention (`POST /events`) enforced identically for personal and shared jobs** — one `OA`/`PPT`/`Interview` per job, no exception for personal jobs, per explicit instruction this stage. Same query shape as the Stage 3 `JobTracking` duplicate check: `.filter(Event.job_id == ..., Event.event_type == ...).first() is not None`.
 
## Real bugs caught during this stage
- `ondelete="CASCADE"` initially placed as a `Column(...)` keyword argument instead of inside `ForeignKey(...)` — silently wrong location, not a syntax error, so it wouldn't have raised until the cascade failed to actually happen.
- `db.query(Student).filter(...).is_admin` — same "comparing/using an unexecuted `Query` object" mistake as Stage 3 and Stage 4; needed `.first()` before `.is_admin` was valid.
- Admin-delete authorization initially compared `job.created_by != current_student.student_id` (the *personal-job* rule) instead of checking the *job creator's* `is_admin` — would have incorrectly blocked one admin from deleting another admin's shared job.
- A redundant `or db.get(Student, ...).is_admin` clause added to the personal-job branch of an authorization check — logically dead (the two conditions could never differ in outcome) and added an unnecessary extra query; reverted.
- `event.jon_id` — field-name typo in the event duplicate-check query, same category as Stage 3's `job_dealine` and Stage 4's `student_id`/`created_by` mismatches.
- `if not None` used where `if <field> is not None` was intended — always evaluates to `False` regardless of the actual field value, since `not None` is a fixed expression, not a check against a variable.
- `db.update(Job).where(...).values(...)` used directly as if it were valid, executable `Session` usage and as if it returned an ORM object — it's SQLAlchemy Core syntax that needs `db.execute(...)` to run and doesn't behave like an ORM query result the way it was being treated.
- `EventUpdate.event_datetime: Optional[datetime]` missing its `= None` default — field was still effectively required despite being wrapped in `Optional`.
- `get_current_admin` documented in the Stage 4 doc as built and tested, but actually absent from `security.py` — a real doc/code mismatch, caught only because a route needed it. Written this stage; Stage 4 doc corrected to note the discrepancy.
## Status
Stage 5 complete. Delete (personal + admin) and edit (personal + admin, both `Job` and `Event`) fully built and tested. `POST /events` authorization gap closed. **Admin merge deferred to future scope** — design discussion started (which job survives, what happens to dependent rows, route shape) but paused in favor of shipping a working app first; delete + edit on shared jobs are judged sufficient for v1. **Admin-promotion flow also deferred to future scope** — stays a manual `psql UPDATE`, same as it's been since Stage 3/4; a real promotion route wasn't judged worth building yet given there's a small, known set of branch admins for now. Next: Stage 6 (Notifications).