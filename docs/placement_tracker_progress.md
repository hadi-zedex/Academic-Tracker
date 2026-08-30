# Placement Tracker — Progress Log
 
Update this at the end of each working session. Newest entry on top. This is what a new chat should read first to catch up.
 
---
 
## Status as of: Session covering Stage 7 — Calendar Views, complete
**Roadmap position:** Stage 7 — Calendar Views (Backend) ✅ **DONE**. Design locked, both routes written, code-reviewed line by line, and live-tested against the real DB — all cases passed, including the month-boundary edge case. Next: Stage 8 — Frontend (React, from zero).
 
### Design decisions made this session (before code was written)
- **Stage 6's live-test gap closed first**: the `GET /notifications` + mark-as-read live confirmation test (outstanding since Stage 6) was run and passed.
- **Calendar stays read-only for v1** — confirmed deliberately, not an oversight. No `X`/postpone/cancel action on calendar items; the existing schema-doc decision ("no separate table for calendar views, pure read-only queries") stands as-is. The app's job is surfacing reminders + a scheduled view, not journal-style state tracking.
- **PracticeTest categorized as Red (deadline)**, not Blue (event) — has a `test_deadline` field and is conceptually closer to a deadline than a scheduled event, despite behaving somewhat like OA/Interview.
- **Calendar visibility rules, asymmetric by design**:
  - Job deadlines: own personal jobs + **all** shared jobs (mirrors `GET /jobs`, not gated by tracking — you can see a shared deadline without tracking it)
  - Events: own personal jobs' events + **only** shared-and-tracked jobs' events (a shared job you're not tracking doesn't clutter your calendar with its events)
  - PracticeTest: everyone (implicit, matches the notification rule — no tracking table)
  - Deliberately diverges from the Stage 6 notification-recipient rules (job deadline reminders go to trackers only) — "what shows on my calendar" and "who gets pinged" are treated as different questions, not required to match.
- **Two separate routes** (`/calendar/monthly`, `/calendar/daily`), not one parameterized endpoint.
- **Monthly response grouped by day** (`{"2026-07-05": [...]}`), not a flat list — chosen because it's directly usable by a calendar-grid frontend component without a client-side grouping step.
- **Stage 3's deferred decision, resolved**: calendar `Event` items embed `company_name`/`role` directly (new purpose-built `CalendarEventItem` schema), rather than just `job_id`. `EventOut` stays thin and unchanged elsewhere — this is a new schema, not a retrofit.
- **`Literal` used over `Enum`** for `CalendarEventItem`'s `type`/`color`/`event_type` fields — reasoned as: `Enum` (like `EventType`) earns its place when a type is reused across multiple schemas and backed by a DB `CHECK` constraint; `Literal` is the leaner choice for a one-off, output-only, single-schema constrained string with no DB column behind it. Noted as a style call, not a correctness issue either way.
- **Daily-view result reuse discussed and deferred to Stage 8, not built now**: the backend keeps both routes as independent per-request queries (no monthly-result caching at the API level — stateless requests, no natural place to hold a "previous month's result" between calls). The actual optimization (skip `/calendar/daily` when the day is already in an already-loaded month's data, client-side) belongs in the Stage 8 frontend and is now noted in the roadmap's Stage 8 section as cache-hit/cache-miss logic, not a blanket "never call the daily route."
### What got built this session
- **`app/schemas/calendar.py`** — new `CalendarEventItem` schema (`type`, `id`, `label`, `color`, `datetime`, plus optional `event_type`/`company_name`/`role` for event-type items).
- **`_get_calendar_items()`** — shared private helper (not a route) that runs all three queries (Job deadlines, Events, PracticeTests) for a given date range and returns a sorted, merged `List[CalendarEventItem]`. Used by both routes below to avoid duplicating the three-query logic.
- **`GET /calendar/monthly?year=&month=`** — half-open date range (`[first of month, first of next month)`, avoiding needing to know days-in-month), groups `_get_calendar_items()`'s result into a `{date_string: [items]}` dict.
- **`GET /calendar/daily?date=`** — same helper, range narrowed to a single day (`datetime.combine(date, time.min)` to `time.max`), returns the flat list directly (no grouping needed for one day).
- Both routes protected via `Depends(get_current_student)`.
### Live test results — all passed
Tested against the real DB with three accounts (Alice/admin, Bob/student, Carl/student) via `Invoke-RestMethod`:
- Personal job deadline: visible to its creator (Bob), absent for others (Carl) ✅
- Shared job, untracked: deadline visible, its event **not** visible (checked before Bob tracked it) ✅
- Shared job, tracked: event now visible, `company_name`/`role` correctly embedded (checked after Bob tracked it) ✅
- PracticeTest: visible to a completely uninvolved account (Carl, no prior interaction) ✅
- No-auth request: correctly rejected with `401 Not authenticated` ✅
- Month-boundary correctness: a deadline on Sept 1st (00:05) and one on Sept 30th (23:55) both appeared in September's response; neither appeared in October's or August's — half-open range confirmed not leaking either direction ✅
- Daily route consistency: `/calendar/daily?date=` returned the same item seen under that date's key in the monthly response ✅
`placement_tracker_stage7_calendar.md` written up this session with full route detail, design rationale, and the grounding discussion from the journal-page photos.
 
### Immediate next step
Start **Stage 8 — Frontend (React, from zero)**, beginning with React fundamentals via small exercises tied to this project's actual UI needs, then auth pages (login/signup) against the Stage 4 API. See `placement_tracker_roadmap.md`'s Stage 8 breakdown for the full step sequence, including the daily-view client-side-lookup-first strategy noted during this stage's design discussion.
 
### Not yet started
- Stage 8 (React frontend, from zero) — no frontend code written yet
- Stage 9 (Deployment)
- Admin merge (deferred to v2)
- Admin-promotion flow (deferred to v2, stays manual)
---
 
## Status as of: Session covering Stage 6 — Notifications, complete
**Roadmap position:** Stage 6 — Notifications ✅ **DONE** (Step 7 built and code-reviewed correct this session; a live confirmation test is still worth running but isn't blocking). Next: Stage 7 — Calendar Views (Backend).
 
### Timing/design changes made this session, before any code was written
- **Notification rules revised** from the original spec: job deadline reminder moved from 2hrs-before to **1hr-before**; event/practice-test reminders moved from an unpinned "morning of the day before" to a pinned **8pm IST the night before**, and PracticeTest's timing was unified to exactly match Event's (both now: 8pm-night-before + 3hrs-before).
- **Two new creation-triggered notifications added**, distinct from the four time-based ones: "job newly posted" (shared jobs only, broadcast to every student, fired inline in `POST /jobs`) and "event newly added" (fired inline in `POST /events`, to that job's `JobTracking` subscribers only — not gated by admin status, since eligibility comes from who's tracking, not who's allowed to post).
- **`Notification.notification_type` column added** (`str, Enum` + Postgres `CHECK`, values `'1hr'`/`'3hr'`/`'8pm'`/`'post'`) — needed because "time until deadline" alone can't distinguish the two event/test reminders (the 8pm-before reminder is a wall-clock check, not a fixed offset, so it can collapse to the same gap as the 3hr reminder for a late-night event). Values deliberately don't repeat entity type (no `event-3hr`), since that's already implied by which of the three nullable FKs is populated.
- `placement_tracker_spec.md` §4, `placement_tracker_schema.md`, and `placement_tracker_roadmap.md` all updated to reflect the above as current, correct state.
### What got built and tested this session (all 7 Stage 6 steps)
1. **`create_notification()` helper** (`app/utilities/notification.py`) — dedup check (student + notification_type + whichever single FK was passed) before insert. Real bug caught: an inverted `if`/`not` condition that would have blocked every single notification from ever being created — traced and fixed before it shipped.
2. **Inline: job newly posted** (`POST /jobs`) — broadcasts to all students except the admin creator, only for shared jobs. Verified via `psql`: correct rows, self-exclusion working, personal-job creation correctly sends nothing.
3. **Inline: event newly added** (`POST /events`) — notifies the parent job's `JobTracking` subscribers, gated on `is_admin` (correct here, unlike a first draft that mistakenly copied Step 2's gate — reasoned through why personal-job event creation legitimately needs no notification: the only possible subscriber is the creator themselves). Bugs caught: `tracking.student_id` typo (should be `applicant_id`), and a `job_id`-vs-`event_id` mixup that made the dedup check collide with the Step 2 job-post notification.
4. **APScheduler wiring** (`app/utilities/scheduler.py`) — `BackgroundScheduler`, 1-minute poll interval, wired into FastAPI's `lifespan` context manager (replacing the old bare `Base.metadata.create_all()` call). Confirmed clean start/tick/shutdown cycle.
5. **Scheduler: job-deadline reminder (1hr)** — 55–65 minute window around `now`, using a manually-managed `Sessionlocal()` session (not `Depends(get_db)`, since this runs outside FastAPI's request cycle). Real bug caught and fixed: original window was one-sided (`diff < 1hr`), which would have matched every already-past deadline on every tick, forever. Verified live: correct rows inserted on first matching tick, confirmed stable (no duplicates) on a second tick, confirmed zero false positives against other jobs.
6. **Scheduler: event/practice-test reminder (3hr + 8pm)** — shared timing logic across `Event` and `PracticeTest`. Real bugs caught and fixed, in order found: invalid `time(24, 0)` crashing the function on every tick; a missing `for event in events:` loop (referencing a stale `event` variable from an earlier block); `db.get(Job, event.job_id==Job.job_id)` passing a boolean expression instead of an ID; the 3hr window accidentally reusing the 1hr window's bounds; wrong loop-variable name in two `except` prints; and a `.value` call on `event.event_type` that crashes because the SQLAlchemy-loaded value is already a plain string (unlike the Pydantic-schema version elsewhere, which is an actual `EventType` enum). All four sub-paths (1hr excluded, already covered — 3hr-event, 3hr-test, 8pm-event, 8pm-test) verified live against the real DB, including a temporary time-shift trick to test the 8pm wall-clock path without waiting for real 8pm.
7. **`GET /notifications` + `PATCH /notifications/{notification_id}/read`** — unread-only, newest-first feed; dedicated mark-as-read route (chosen over a generic `PATCH` body, since `is_read` is the only client-mutable field on this resource). Code-reviewed correct this session; a live confirmation test is still recommended but not yet run.
### Folder structure note
Built out as `app/utilities/` (`database.py`, `auth.py`, `notification.py`, `scheduler.py`) — supersedes an earlier suggestion in the roadmap doc to keep `notification.py` standalone; roadmap corrected to match.
 
### Real bugs caught this session (full list, for pattern-recognition purposes)
- Inverted `if`/`not` dedup check in `create_notification` — would have blocked all notification creation.
- `tracking.student_id` vs. the actual `JobTracking.applicant_id` field name.
- Passing `job_id` instead of `event_id` into `create_notification`, causing a false-positive dedup collision with an unrelated notification.
- `.value` called on an already-plain-string enum column loaded via SQLAlchemy (vs. the Pydantic-schema version, which is a real `Enum` instance) — same "assumed shape without checking" category as earlier field-name mismatches.
- One-sided time-window comparison (`diff < 1hr`) matching all past deadlines, not just approaching ones.
- `time(24, 0)` — invalid hour value, crashes immediately, was also outside the intended conditional so it ran on every tick.
- Missing `for` loop over a query's `.all()` result, silently reusing a stale loop variable from an earlier block.
- `db.get(Job, event.job_id==Job.job_id)` — passed a boolean comparison expression instead of the actual FK value.
- Copy-pasted window bounds (3hr block reusing the 1hr block's 55/65-minute values).
- Wrong variable referenced inside two `except` print statements, which would have masked the real underlying error if one ever occurred.
### Testing methodology notes worth keeping
- `Invoke-RestMethod` (native PowerShell) proved more reliable than `curl.exe` for PATCH requests with JSON bodies — `curl.exe`'s quote-escaping inside PowerShell was a repeated source of malformed-request errors this session, unrelated to any actual backend bug.
- Testing the scheduler's wall-clock-dependent path (8pm check) via a temporary, reverted time-shift (pointing the check at "5 minutes from now" instead of hardcoded 20:00) is a reusable technique for testing time-of-day logic without waiting for the real trigger time.
### Immediate next step
Run the one remaining live confirmation test for `GET /notifications` + mark-as-read (steps outlined above, not yet executed against the real DB). Then start **Stage 7 — Calendar Views (Backend)**: `GET` endpoint(s) returning a month's worth of deadlines/events/tests for the Daily + Monthly views, plus revisiting whether `EventOut`-style responses need embedded `Job` info (this was explicitly deferred from Stage 3 to be decided here).
 
### Not yet started
- Stage 7 (Calendar Views backend)
- Stage 8 (React frontend, from zero)
- Stage 9 (Deployment)
- Admin merge (deferred to v2)
- Admin-promotion flow (deferred to v2, stays manual)
---
 
## Status as of: Session covering merge + admin-promotion deferral decisions — Stage 5 complete
**Roadmap position:** Stage 5 — Admin & Personal Job Tooling ✅ **DONE**. Next: Stage 6 — Notifications.
 
### Decisions made this session
- **Admin merge (reassigning `JobTracking`/`Notification` from a duplicate shared job onto the original, then deleting the duplicate) deferred to v2/future scope, not built for v1.** Design discussion had started — which job survives on merge, what happens to dependent rows, route shape (single endpoint with both IDs vs. path-based) — but was paused before any code was written. Reasoning: delete + edit on shared jobs already cover the immediate need (an admin who spots a bad/duplicate shared posting can just delete the redundant one outright), and duplicate shared jobs are assumed to be rare enough in practice that a dedicated merge flow isn't worth building before the rest of the app (notifications, calendar views, frontend) is working end to end. Revisit if real usage shows this is actually a frequent pain point.
- **Admin-promotion flow also deferred to v2/future scope.** Stays exactly as it's been since Stage 3/4 — a manual `psql UPDATE students SET is_admin = true WHERE student_id = ...`. A real route would need its own design work (who can promote — likely admin-gated, but the very first admin has no admin to promote them, a real bootstrap problem; promote by email or student_id; whether demotion is in scope) that wasn't judged worth doing yet, given there's a small, known set of branch admins for now.
- `placement_tracker_roadmap.md` and `placement_tracker_stage5_admin_tooling.md` updated to mark Stage 5 as fully done, with both deferred items explicitly listed as future scope (not silently dropped).
### Stage 5 — final summary (see `placement_tracker_stage5_admin_tooling.md` for full detail)
- ✅ Student: delete own personal job (cascade-tested)
- ✅ Admin: delete a shared job (cascade-tested)
- ✅ Admin: edit shared `Job` fields / Student: edit own personal job (`PATCH /jobs/{job_id}`, branching authorization)
- ✅ Admin: edit event on shared job / Student: edit event on own personal job (`PATCH /events/{event_id}`, same branching)
- ✅ *(unplanned, caught this stage)* `POST /events` authorization fix — was unauthenticated since Stage 3
- ⏭️ Admin merge — deferred to future scope
- ⏭️ Admin-promotion flow — deferred to future scope, stays manual
### Immediate next step
Start Stage 6 — Notifications: APScheduler job inside FastAPI checking `job_deadline`/`event_datetime`/`test_deadline` against the timing rules in the spec doc, writing to the `Notification` table, with duplicate-send prevention. Then `GET /notifications` + mark-as-read route. Design discussion not yet started.
 
### Not yet started
- APScheduler notification job + `Notification` routes
- Admin merge (deferred to v2)
- Admin-promotion flow (deferred to v2, stays manual)
- Any React/frontend work
- Deployment (Vercel/Render/Railway)
---
 
## Status as of: Session covering Stage 5 delete + edit routes, event-auth fix
**Roadmap position:** Stage 5 — Admin & Personal Job Tooling 🔶 IN PROGRESS. Delete and edit fully built and tested; merge and admin-promotion still open.
 
Full detail — routes, schemas, design decisions, and every bug caught — is written up in the new `placement_tracker_stage5_admin_tooling.md`; this entry is a summary. Earlier in this same session, Stage 5's scope itself was finalized (see the scoping entry below) before any code was written.
 
### What got built and tested this session
- **Schema:** `ondelete="CASCADE"` added to `Event.job_id`, `JobTracking.job_id`, `Notification.job_id`, `Notification.event_id`. Applied via a full `TRUNCATE ... RESTART IDENTITY CASCADE` reset (test data not preserved).
- **`get_current_admin`** written in `security.py` — turned out to be documented as already-built in the Stage 4 doc but was actually missing; a real doc/code mismatch caught only because this stage needed it. Layers on `get_current_student`, checks `is_admin`, raises `403`.
- **`DELETE /jobs/{job_id}`** (student, own personal job) — `404`/`403`/`204` all tested, cascade confirmed via `psql`.
- **`DELETE /admin/jobs/{job_id}`** (admin, shared job) — authorization checks the *job creator's* `is_admin`, not the requester's ID; `403`/`404`/`204` all tested, cascade confirmed.
- **`POST /events` authorization fix** — discovered to be completely unauthenticated since Stage 3 while discussing edit routes; not part of the original Stage 5 plan. Retrofitted with `Depends(get_current_student)`, the shared/personal branching check, and duplicate-event-type prevention (one `OA`/`PPT`/`Interview` per job — enforced for personal jobs too, per explicit instruction). All 5 test cases (403 outsider, success as admin/owner, 403 on other's personal job, 409 duplicate) passed.
- **`PATCH /jobs/{job_id}`** (`JobUpdate` schema, partial update via `.model_dump(exclude_unset=True)` + `setattr` loop) — same branching authorization as delete; all 5 test cases passed.
- **`PATCH /events/{event_id}`** (`EventUpdate` schema, currently just `event_datetime`, built with postponement in mind) — same pattern; all 5 test cases passed.
### Real bugs caught and fixed this session
- `ondelete="CASCADE"` initially placed on `Column(...)` instead of inside `ForeignKey(...)` — wrong location, not a syntax error.
- `db.query(Student).filter(...).is_admin` used without `.first()` — same unexecuted-`Query`-object mistake as Stage 3/4.
- Admin-delete's first draft compared `job.created_by != current_student.student_id` (the personal-job rule) instead of checking the job creator's `is_admin` — would have blocked one admin from deleting another admin's shared job.
- A redundant `or db.get(Student, ...).is_admin` clause added to a working authorization check — logically dead, reverted.
- `event.jon_id` typo in the duplicate-check query — same category as Stage 3's `job_dealine`.
- `if not None` used instead of `if <field> is not None` — always evaluates `False` regardless of the actual field, since it tests the literal keyword `None` rather than a variable.
- `db.update(Job).where(...).values(...)` used as if it were valid `Session` ORM usage — it's SQLAlchemy Core syntax, doesn't work or return an object the way it was being used.
- `EventUpdate.event_datetime: Optional[datetime]` missing its `= None` default — `Optional[...]` alone doesn't make a field skippable in the request body, only nullable if sent.
- `get_current_admin` documented as built in Stage 4 but absent from the actual codebase (see above).
### Design decisions made this session
- **`PATCH`, not `PUT`**, for both edit routes — partial updates only, client doesn't resend unchanged fields.
- **Update schemas (`JobUpdate`, `EventUpdate`) use `Optional[...] = None` on every field**, and updates are applied via `.model_dump(exclude_unset=True)` + a `setattr` loop over the fetched ORM object — avoids per-field `is not None` checks entirely, since fields the client didn't send are simply absent from the dict.
- **The shared/personal branching authorization check** (first built for `POST /events`, then reused as-is for both delete routes and both edit routes) is now the standard pattern for any route acting on a `Job` or its dependents: non-admins must be the exact creator; admins must confirm the job's creator is *also* an admin (shared), not just check their own `is_admin` status.
- **Event duplicate-prevention applies to personal jobs too**, not just shared ones — one `OA`/`PPT`/`Interview` per job, no exceptions, per explicit instruction.
### Immediate next step
Admin merge action — reassign `JobTracking`/`Notification` rows from a duplicate shared job onto the original, then delete the duplicate. Design discussion not yet started.
 
### Not yet started
- Admin merge functionality
- Admin-promotion flow (still a manual `psql UPDATE`)
- APScheduler notification job + `Notification` routes
- Any React/frontend work
- Deployment (Vercel/Render/Railway)
---
 
## Status as of: Session covering Stage 5 scoping — in progress
**Roadmap position:** Stage 5 — Admin & Personal Job Tooling 🔶 IN PROGRESS. No code written yet — this session was entirely scoping/design; next session starts implementation.
 
### Decisions made this session
- **Fuzzy-match-on-create dropped from Stage 5 entirely.** With multiple branch admins independently posting to the shared catalog, occasional duplicates are expected and are more reliably caught by an admin's own judgment reviewing the list than a similarity algorithm. Dedup is handled entirely after the fact via merge.
- **Clarified product model:** multiple admins, one per branch, each posting branch-relevant jobs to the shared catalog. Students see shared jobs as notifications and opt in/out of tracking. A student who can't find something they've applied to can create a **personal** (non-shared) job instead — visible only to them.
- **Stage 4's "known gap" (admin can't see other students' personal jobs) dropped — resolved as a non-issue.** Merge/delete are scoped to shared jobs only, where a personal job is never a valid target, so the gap never actually blocked anything. `GET /jobs` needs no filter change. (Corrected in `placement_tracker_schema.md` and `placement_tracker_stage4_auth.md`.)
- **Final Stage 5 scope:**
  - Admin: delete a shared job (standalone route, not just via merge)
  - Admin: merge two shared jobs (reassign `JobTracking`/`Notification` to the original, then delete the duplicate)
  - Admin: edit shared `Job` fields
  - Student: edit own personal job (**added** this session)
  - Student: delete own personal job (**added** this session)
  - Admin-promotion flow
- **Cascade delete is DB-level (`ondelete="CASCADE"`), not app-level.** Added to `Event.job_id`, `JobTracking.job_id`, `Notification.job_id`, and `Notification.event_id` — deleting a `Job` (personal or shared) removes its full dependent chain (events, trackings, notifications — including notifications on its now-deleted events) automatically via Postgres.
- **Merge's duplicate-side `Event`s are discarded, not reassigned** — assumed redundant with whatever's already on the original job.
### Immediate next step
Start building — first route to write not yet chosen (candidates: delete shared job, delete personal job, merge, edit, admin-promotion). Schema change needed first regardless: add the four `ondelete="CASCADE"` FKs above to the SQLAlchemy models, which will require a drop/recreate of the affected tables (same pattern as the Stage 4 `hashed_password` column addition).
 
### Not yet started
- Any Stage 5 code (schema cascade FKs, delete/merge/edit routes, admin-promotion route)
- APScheduler notification job + `Notification` routes
- Any React/frontend work
- Deployment (Vercel/Render/Railway)
---
 
## Status as of: Session covering Stage 4 completion (auth, JWT, protected routes, Job visibility model)
**Roadmap position:** Stage 4 — Authentication ✅ **DONE**. Next: Stage 5 — Dedup & Admin Tooling.
 
Full detail — routes, schemas, bugs, and every design decision — is written up in the new `placement_tracker_stage4_auth.md` doc; this entry is a summary. Scope grew beyond the original Stage 4 plan partway through — see below.
 
### What got built this session
- **Password hashing**: `hashed_password VARCHAR(60)` added to `Student` (table dropped/recreated via `psql` CASCADE, since `create_all()` doesn't alter existing tables); `app/security.py` created with `hash_password`/`verify_password` via `passlib`'s `CryptContext`.
- **`POST /students`** updated to hash the incoming password and never store or return it raw — confirmed via direct `psql` inspection of the stored bcrypt hash (`$2b$12$...`).
- **JWT issuance**: `create_access_token()` in `security.py`, signed with `SECRET_KEY` (freshly generated via `secrets.token_hex(32)`, read from `.env`), payload = `{"sub": str(student_id), "exp": <1hr from now>}`.
- **`POST /login`**: new `StudentLogin` schema (`email` + `password`), looks up by email, verifies password, issues a token. Uses a single combined check (`student is None or not verify_password(...)`) and a uniform `401` for both failure cases, deliberately not distinguishing "no such email" from "wrong password."
- **`get_current_student`**: reusable FastAPI dependency (`Depends`) that extracts the Bearer token (`OAuth2PasswordBearer`), decodes/verifies it (`jwt.decode`), and returns the actual `Student` row. This is the building block every protected route now uses.
- **`JobTracking` retrofitted**: `applicant_id` removed from `JobTrackingCreate` entirely; `POST /job_trackings` now derives the applicant from `Depends(get_current_student)` instead of trusting client input — this was the exact stopgap flagged back in Stage 3, now resolved.
- **`get_current_admin`**: a second dependency, layered on top of `get_current_student`, that additionally checks `is_admin` and raises `403` if false.
- **Job visibility model** (scope expansion, see below): `Job.created_by` (FK → `Student`, `NOT NULL`) added; `POST /jobs` now open to any authenticated student (not admin-gated); `GET /jobs` filters to shared (creator is admin) OR personal (creator is you) via a join + `or_()`. Tested end-to-end with two real accounts (one promoted to admin via manual `psql UPDATE`), confirming both branches of the visibility logic.
### Scope expansion mid-session — why
The original Stage 4 plan (per the old roadmap) was going to admin-gate `Job`/`Event` creation entirely (`get_current_admin` blocking non-admins). While implementing that, a real product requirement surfaced: a student should be able to track a job that hasn't made it into the shared catalog yet by creating their own personal entry — meaning creation needed to stay open to everyone, and the real distinction was **visibility** (shared vs. personal), not creation permission. This reversed the original plan for `Job` (`get_current_admin` ended up not gating `POST /jobs` at all) and required a real schema change (`created_by`) rather than just wiring an existing check. `placement_tracker_schema.md` and `placement_tracker_spec.md` have been corrected to reflect this — not just appended to, since the old "Job/Event are always shared" text was actively wrong once this was built.
 
### Real bugs caught and fixed this session
- `load_dotenv(SECRET_KEY)` — tried to read a value before defining it, and misunderstood `load_dotenv()`'s return value (`True`/`False`, not the secret itself). Fixed to the two-step `load_dotenv()` then `os.getenv("SECRET_KEY")` pattern, mirroring `database.py`.
- Missing comma in the JWT payload dict (`SyntaxError`).
- `bcrypt`/`passlib` version incompatibility — `passlib==1.7.4` (unmaintained since 2020) can't talk to `bcrypt>=4.1`'s changed internals; fixed by pinning `bcrypt==4.0.1`.
- `payload["sub"]` used directly as a `student_id` without converting back to `int` (JWT claims are stored as strings — `str(student_id)` going in, needs `int(...)` coming back out).
- Missing comma in `create_job_tracking`'s function signature between two `Depends(...)` parameters (`SyntaxError`).
- Redundant dead code left in `create_job_tracking` (an existence check on `current_student` that `get_current_student` already guarantees) — flagged and removed rather than left commented out.
- `db.query(Student).filter(Student.is_admin==True)` used inline as a value being compared to `Job.created_by` — same "comparing to a Query object" mistake as earlier stages; fixed by using the already-joined `Student.is_admin` directly instead of a subquery.
- Missing commas in the `Job(...)` constructor call in `create_job` (same category as the two above).
- `or_` imported from the wrong module (`sqlalchemy.orm` instead of top-level `sqlalchemy`).
- `JobOut` schema referenced a nonexistent `student_id` field instead of the model's actual `created_by` column.
- `SELECT students *` — SQL syntax slip, table name goes after `FROM`, not before `*`.
### Design decisions made this session
- **`StudentLogin` (email+password) is distinct from what goes in the JWT payload (`student_id`)** — login credentials need to be human-rememberable; the token payload needs to be immutable and machine-referenceable. Different jobs, different fields.
- **Uniform `401` + identical message for both "no such email" and "wrong password"** on `/login` — deliberately doesn't leak which part of the credential pair was wrong, standard security practice.
- **`403`, not `401`, for `get_current_admin` failures** — `401` means "I don't know who you are," `403` means "I know who you are, and the answer is no." A valid, authenticated non-admin hitting an admin-only route is the `403` case.
- **`/docs`'s built-in "Authorize" button doesn't work with this project's `/login`** — `OAuth2PasswordBearer`'s Swagger integration expects the OAuth2 password-grant shape (form-encoded `username`/`password`), but `/login` deliberately uses JSON with `email`/`password` (the correct shape for the real app). Rather than warping the real API to satisfy a `/docs` convenience feature, protected-route testing standardized on `curl.exe` with a manually attached `Authorization: Bearer <token>` header.
- **Job creation open to all authenticated students; visibility (not creation) is what's admin-gated** — see the scope-expansion note above. Visibility is *derived* from the creator's current `is_admin` status via a `JOIN` at query time (not a separate stored `is_shared` flag), chosen for single-source-of-truth correctness over the minor query-cost savings of denormalizing it.
- **Admin promotion stays a manual `psql UPDATE` for now** — consistent with the Stage 3-era decision (only one admin, building a promotion UI now would be permission-gated functionality built before the permission system existed to protect it). Proper admin tooling is Stage 5.
- **Known, accepted gap**: an admin cannot currently see other students' personal jobs (visibility isn't "admin sees everything," it's "shared jobs are visible to everyone, personal jobs are visible only to their creator"). Flagged for Stage 5, since merge/dedup tooling will need admins to see across all jobs, not just shared + their own.
### Immediate next step
Start Stage 5 — Dedup & Admin Tooling:
1. Fuzzy-match check (company + role) on `Job` creation
2. Admin merge action (reassign `JobTracking`/`Notification` rows, archive duplicate)
3. Admin edit on shared `Job`/`Event` fields
4. Revisit `GET /jobs` visibility filter for admin-sees-all
5. Proper admin-promotion flow
### Not yet started
- Fuzzy-match dedup on Job/Event creation
- Admin merge functionality
- APScheduler notification job + `Notification` routes
- Any React/frontend work
- Deployment (Vercel/Render/Railway)
### Known open decisions (as of this entry — since resolved, see the Stage 5 scoping entry above)
- ~~Whether `GET /jobs`'s visibility filter gets an `OR current_student.is_admin` branch now or gets folded into Stage 5's merge-tooling work.~~ Resolved: not needed at all, once merge was scoped to shared jobs only.
- Everything else Stage 5-specific (fuzzy-match threshold/library, merge UX) — not yet discussed at the time of this entry.
---
 
## Status as of: Session covering Stage 3 completion (Job, Event, PracticeTest, JobTracking + full testing)
**Roadmap position:** Stage 3 — Core CRUD API ✅ **DONE**. Next: Stage 4 — Authentication.
 
All five Stage 3 resources built and tested end-to-end via `/docs`: `Student` (carried over from last session), `Job`, `Event`, `PracticeTest`, `JobTracking`. Full detail — routes, schemas, and every design decision made — is written up in `placement_tracker_stage3_api.md`; this entry is a summary.
 
### What got built this session
- `Job`: `POST /jobs`, `GET /jobs/{id}`, `GET /jobs` — schemas + routes, tested including a real caught bug (`job_dealine` typo).
- `Event`: `POST /events`, `GET /events/{id}`, `GET /events` — introduced `Enum` for `event_type` validation, FK-existence check against `job_id` before insert (avoids a raw 500 on bad FK).
- `PracticeTest`: `POST /practice_tests`, `GET /practice_tests/{id}`, `GET /practice_tests` — simplest resource, no FK.
- `JobTracking`: `POST /job_trackings`, `GET /job_trackings/{id}`, `GET /job_trackings` — dual FK-existence check (`applicant_id` + `job_id`) and duplicate-tracking prevention (409 Conflict), including catching a real logic bug (Python `and` vs. proper multi-arg `.filter()`).
### Real bugs caught and fixed this session (see stage3 doc for full detail)
- `@dataclass` incorrectly stacked on top of Pydantic `BaseModel` in the `Event` schemas.
- `.filter(column=value)` invalid keyword syntax (should be `.filter(Model.column == value)` or `.filter_by(...)`).
- `.filter(...)` returning a Query object (never `None`) — checked with `is not None` without calling `.first()`, so the check always fired.
- Python's `and` keyword used to combine two SQLAlchemy filter conditions — doesn't build a combined SQL condition; fixed by passing both conditions as separate `.filter()` args.
- `job_dealine` typo across `JobCreate`/`JobOut` vs. the actual `job_deadline` column.
- Unhandled FK violation on bad `job_id` in `Event` creation surfacing as a raw 500 — fixed with a pre-insert existence check.
### Design decisions made this session
- **`EventType` as a `str, Enum`** instead of plain `str` — rejects invalid `event_type` values at the Pydantic layer with a clean 422, before ever reaching the DB's `CHECK` constraint.
- **FK-existence checks before insert** (Option A: check-then-insert) chosen over try/except-around-commit (Option B) for both `Event.job_id` and `JobTracking`'s two FKs — simpler, and the specific FK that can fail is already known, so a generic catch-all isn't needed yet.
- **`JobTrackingCreate` takes `applicant_id` directly from the client** as a deliberate, known stopgap — there's no auth/JWT yet, so there's no server-side "current user" to infer it from. Flagged to be replaced once Stage 4 auth exists (extract identity from the token instead of trusting a client-supplied ID) — **resolved in the Stage 4 session above.**
- **`EventOut` returns only `job_id`, not embedded company/role.** Considered embedding `Job` data directly (avoids N+1 queries when rendering lists) vs. keeping resource endpoints thin and composing on the client. Decided to keep it thin for now and revisit with a purpose-built response shape at Stage 7 (Calendar Views), once the frontend's actual data needs are known.
- **Dropdowns for `event_type`/`job_id` are a Stage 8 (frontend) concern, not a backend one.** Backend validation (enum, FK checks) stays regardless — a dropdown prevents accidental bad input in the normal UI flow, but isn't a substitute for server-side validation, which is the actual gatekeeper against any client (trusted or not).
- **Combined validation error responses (all problems in one response) deferred**, in favor of fail-fast (one error at a time) — consistent with the rest of Stage 3, and premature to build without a real form driving the requirement. Revisit only if a specific Stage 8 screen needs it.
- **`Notification` confirmed out of scope for Stage 3** — it's generated by the Stage 6 APScheduler job, not created directly via a client `POST`, so no `Notification` routes were built this session.
### Not yet started (as of end of this session)
- Auth (JWT, password hashing)
- Fuzzy-match dedup on Job/Event creation
- Admin merge functionality
- APScheduler notification job + `Notification` routes
- Any React/frontend work
- Deployment (Vercel/Render/Railway)
---
 
## Status as of: Session covering project infrastructure (working agreement, roadmap docs)
**Roadmap position:** Stage 3 — Core CRUD API (still in progress, on the `Student` resource — no code changed this session)
 
This session was documentation/process-focused, not coding. Created `placement_tracker_working_agreement.md` (for Project custom instructions) and `placement_tracker_roadmap.md` (10-stage build plan), and wired cross-references between all docs. Also clarified: Claude proactively updates this progress doc when Hadi signals a session is ending, and reads it automatically at the start of any new chat in this Project — no special trigger phrase needed for either.
 
No schema or code changes this session — see the entry below for the actual state of the code.
 
---
 
## Status as of: Session covering environment setup → first Pydantic schema
**Roadmap position:** Stage 3 — Core CRUD API (in progress, on the `Student` resource)
 
### Environment
- Windows, PowerShell. Python 3.13, PostgreSQL 18.6, Node 24.19, npm 11.17, Git — all installed and confirmed on PATH.
- `placement_tracker` database created in Postgres.
- Backend project at `Placement_Tracker/backend`, Python venv active at `backend/venv`.
- `.env` (DATABASE_URL, SECRET_KEY) and `.gitignore` (venv/, .env, __pycache__/, *.pyc) created — secrets never committed.
- `requirements.txt` frozen after installing: fastapi, uvicorn[standard], sqlalchemy, psycopg2-binary, python-dotenv, python-jose[cryptography], passlib[bcrypt], python-multipart.
### Backend structure so far
```
backend/
  app/
    __init__.py
    database.py       -- engine, SessionLocal, Base, get_db() dependency
    main.py            -- FastAPI app, Base.metadata.create_all(), root route
    models/
      __init__.py
      student.py        -- Student
      job.py             -- Job
      event.py           -- Event (has CheckConstraint via __table_args__)
      practice_test.py   -- PracticeTest
      job_tracking.py    -- JobTracking
      notification.py    -- Notification
    schemas/
      __init__.py
      student.py         -- StudentCreate, StudentOut (IN PROGRESS — see below)
```
 
### Data model (final, matches placement_tracker_schema.md)
All 6 tables created and confirmed live in Postgres via `\dt` and `\d students`:
`students`, `jobs`, `events`, `practice_tests`, `job_trackings`, `notifications`.
 
Field names as actually implemented (some renamed from original schema doc draft — doc has been updated to match):
- `Job`: job_id, company_name, role, job_deadline
- `Event`: event_id, event_type, job_id (FK), event_datetime — CHECK constraint on event_type via `__table_args__`
- `PracticeTest`: test_id, test_name, test_deadline
- `Student`: student_id, student_name, email (unique), is_admin
- `JobTracking`: tracking_id, applicant_id (FK), job_id (FK)
- `Notification`: notification_id, student_id (FK), job_id/event_id/practice_test_id (all nullable FKs, exactly one populated per row — app-enforced, not DB-enforced), message, created_at, is_read
### FastAPI basics covered
Route = `@app.get/post(...)` decorator + function; `/docs` is auto-generated Swagger UI for testing routes without a frontend. Understood and confirmed working.
 
### Known open decisions (not yet made, at time of this entry)
- None currently blocking — schema and stack are both finalized and documented.