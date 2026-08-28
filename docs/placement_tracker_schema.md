# Placement Tracker — Schema v1
 
Companion to `placement_tracker_spec.md` (product/problem/journal-translation doc). This doc covers the finalized data model and the reasoning behind the less-obvious decisions.
 
## Tables
 
```
Job
  job_id            INTEGER    PK
  company_name      TEXT
  role              TEXT
  job_deadline      TIMESTAMP
  created_by        INTEGER    FK -> Student.student_id
 
Event
  event_id          INTEGER    PK
  event_type        TEXT       CHECK event_type IN ('OA', 'PPT', 'Interview')
  job_id            INTEGER    FK -> Job.job_id            ON DELETE CASCADE  -- Stage 5
  event_datetime    TIMESTAMP
 
PracticeTest
  test_id           INTEGER    PK
  test_name         TEXT
  test_deadline     TIMESTAMP
 
Student
  student_id        INTEGER    PK
  student_name      TEXT
  email             TEXT       UNIQUE
  is_admin          BOOLEAN
  hashed_password   VARCHAR(60)   -- bcrypt hash, never the raw password; added Stage 4
 
JobTracking
  tracking_id       INTEGER    PK
  applicant_id      INTEGER    FK -> Student.student_id
  job_id            INTEGER    FK -> Job.job_id            ON DELETE CASCADE  -- Stage 5
 
Notification
  notification_id   INTEGER    PK
  student_id        INTEGER    FK -> Student.student_id
  job_id            INTEGER    FK -> Job.job_id             NULLABLE  ON DELETE CASCADE  -- Stage 5
  event_id          INTEGER    FK -> Event.event_id         NULLABLE  ON DELETE CASCADE  -- Stage 5
  practice_test_id  INTEGER    FK -> PracticeTest.test_id   NULLABLE
  notification_type TEXT       CHECK notification_type IN ('1hr', '3hr', '8pm', 'post')   -- Stage 6
  message           TEXT
  created_at        TIMESTAMP
  is_read           BOOLEAN
  -- exactly one of job_id / event_id / practice_test_id is non-null;
  -- enforced in application code, not the DB, since this is 3 separate
  -- nullable FKs rather than a polymorphic ref_type/ref_id pair
```
 
No separate table for the Monthly/Daily calendar views — they're read-only queries over `Job.job_deadline`, `Event.event_deadline`, and `PracticeTest.test_deadline` filtered by month/day. No write path needed for calendar rendering.
 
## Who gets notified for what
*(Revised in Stage 6 planning — see `placement_tracker_spec.md` §4 for the authoritative table and `placement_tracker_progress.md` for when/why this changed.)*
- **Job deadline** (1hr before): everyone in `JobTracking` for that `job_id`. Scheduler-polled.
- **Job newly posted** (shared jobs only — creator is admin): every `Student`, fired inline in `POST /jobs` at creation time, not by the scheduler.
- **Event newly added** (OA/PPT/Interview): everyone in `JobTracking` for that event's `job_id`, fired inline in `POST /events` at creation time, not by the scheduler.
- **OA / PPT / Interview approaching** (8pm IST the night before, **and** 3hrs before): everyone in `JobTracking` for that event's `job_id`. Scheduler-polled.
- **PracticeTest approaching** (8pm IST the night before, **and** 3hrs before — same rule as Event as of this revision): every `Student` — no tracking table needed since it's mandatory for all, not opt-in. Scheduler-polled.
**`Notification.notification_type` (Stage 6) — why it exists, and why its values look the way they do.**
The four scheduler-polled reminders can't be told apart by "how long before the deadline was this sent" alone: the 3hrs-before reminder is a *fixed offset* from the deadline, but the 8pm-the-night-before reminder is a *wall-clock check* ("is it 8pm and is the deadline tomorrow?"), not an offset — so the gap between them isn't constant. A late-night event (e.g. 11pm) makes the 8pm-before reminder land only ~3 hours before the deadline too, indistinguishable by time-gap alone from the actual 3hr reminder. `notification_type` makes the distinction explicit instead of relying on inferring it from timestamps after the fact: `str, Enum` on the Pydantic side (same pattern as `EventType`), backed by a Postgres `CHECK` — `'1hr'` (job deadline), `'3hr'` / `'8pm'` (event or practice test reminders), `'post'` (the two creation-triggered "just posted"/"just added" notifications — these don't need per-tick dedup since they fire exactly once, at insert time, but still get a type for consistency and for `GET /notifications` to categorize them later).
Values deliberately don't repeat which *entity* they're about (no `event-3hr` vs `job-1hr` as distinct strings) — that's already fully determined by which of the three nullable FKs (`job_id`/`event_id`/`practice_test_id`) is populated on the row, so encoding it again in `notification_type` would be redundant. Dedup checks combine both: e.g. "does a `Notification` already exist for this `event_id` + this `student_id` + `notification_type = '8pm'`."
 
## Key design decisions & why
 
**`JobTracking` instead of putting OA/PPT/interview columns directly on `Job`.**
A job can have a variable number of associated events (some skip PPT, some have OA only), and a mandatory event isn't always tied to a job at all. Modeling events as their own table linked by FK, rather than fixed columns on `Job`, means the schema doesn't break when a company's process doesn't match the "usual" shape. (Same reasoning as `Loan` being separate from `Book` in a library schema — the relationship needs its own row.)
 
**`PracticeTest` as a separate table from `Event`, rather than cramming it into `Event.type`.**
A practice test has no `job_id` — it isn't about any specific company. Forcing it into `Event` would've meant a nullable `job_id` with a conditional CHECK constraint (only required for OA/PPT/Interview), which works but pushes complexity into constraint logic instead of the schema shape. Splitting it into its own table keeps `Event.job_id` a plain required FK, and keeps the "who gets notified" logic simpler too (every `PracticeTest` notifies everyone; no tracking join needed).
 
**`Notification` uses three separate nullable FKs, not a single polymorphic `ref_type` + `ref_id` pair.**
The polymorphic version is more compact and extensible, but the database can't enforce that `ref_id` actually points to a real row — that guarantee moves into application code. Three real FKs are more verbose but let the database itself catch a broken reference. Chosen deliberately as the safer option for a first schema.
 
**Mandatory-ness of `PracticeTest` is implicit (not a stored flag), and `type` on `Event` is a fixed small CHECK set rather than free text.**
Both are simplifications: "not a `Job`-linked event = mandatory for all" is a rule enforced in code, not a column, kept implicit because it's simpler and can be turned into an explicit `is_mandatory` column later without breaking anything if the rule ever needs exceptions. `Event.type` was deliberately kept to a small fixed category set (`OA`/`PPT`/`Interview`) rather than open text, so the notification logic can pattern-match on it reliably; a specific platform/test name lives on `PracticeTest.name` instead.
 
**Job visibility: shared vs. personal, derived from the creator's `is_admin` status (added Stage 4) — corrects the original "always shared" design.**
The original plan (see spec doc history) assumed every `Job` was a shared/global record, since only an admin was expected to create them. In practice, any authenticated student can create a `Job` — not just admins — because a student may need to track a job that hasn't been added to the shared catalog yet. `Job.created_by` (a required FK to `Student`) records who posted it, and visibility is *derived* from that creator's current `is_admin` flag at query time, not stored as a separate flag on `Job` itself:
- If the creator is an admin → the job is visible to **everyone** (`GET /jobs` filters on `Student.is_admin == True` via a join).
- If the creator is a regular student → the job is visible **only to that student** (`GET /jobs` also matches `Job.created_by == current_student.student_id`).
Deriving visibility from `is_admin` at read time (rather than storing a separate `is_shared` boolean set once at creation) was a deliberate choice: it's a single source of truth, and if a student's admin status ever changes, visibility for their past posts stays consistent without needing a backfill. The tradeoff is a `JOIN` to `Student` on every `GET /jobs` — considered acceptable at this project's scale.
 
**Resolved (Stage 5): admins still cannot see other students' personal (non-shared) jobs — this is correct, not a gap.** Visibility remains symmetric per-student: shared jobs are visible to everyone, personal jobs only to their own creator, admin or not. This was originally flagged as a blocker for Stage 5's merge/dedup tooling, but merge was scoped to shared (admin-created) jobs only — a personal job is invisible to everyone but its creator, so it's never a merge candidate in the first place. No filter change was needed.
 
**Delete/merge model (Stage 5) — DB-level cascade, not app-level.**
Deleting a `Job` (personal, by its own creator, or shared, by an admin) must also remove everything that points at it — its `Event`s, `JobTracking`s, and `Notification`s (including notifications pointing at one of its now-deleted `Event`s). This is implemented as `ondelete="CASCADE"` on the relevant FKs (`Event.job_id`, `JobTracking.job_id`, `Notification.job_id`, `Notification.event_id`), so a single `DELETE FROM jobs WHERE job_id = ...` lets Postgres remove the whole dependent chain automatically, rather than the app manually deleting each dependent table first. Chosen for simplicity — v1 has no case where a `Job`'s dependents should ever outlive the `Job` itself.
 
Admin **merge** (two shared `Job`s found to be duplicates) is a different operation from delete: `JobTracking` and `Notification` rows pointing at the duplicate are first reassigned to the original (an `UPDATE`, not a delete), and only then is the duplicate `Job` deleted — at which point the cascade removes the duplicate's own `Event`s (assumed redundant with the original's) but leaves the reassigned `JobTracking`/`Notification` rows intact, since they now point at the original.
 
**Fuzzy-match-on-create, considered and dropped for v1.** The original plan (per the product spec) was to fuzzy-match company+role at `Job` creation time to catch likely duplicates before they're saved. Decided against: with multiple branch admins each independently posting jobs to the shared catalog, occasional duplicates (e.g. "XYZ Inc." vs "XYZ") are expected and are more reliably caught by an admin's own judgment when reviewing the shared list than by a similarity algorithm. Dedup is handled entirely after the fact via admin merge, not prevented at creation time.
 
## Status
Schema considered final for v1 pending tech-stack decisions. Next: choose stack, then move to low-level implementation planning.
 