# Placement Tracker — Stage 6: Notifications
 
Companion to `placement_tracker_spec.md` (product — §4 has the authoritative timing/recipient table), `placement_tracker_schema.md` (data model — `Notification.notification_type` rationale), `placement_tracker_techstack.md` (stack — APScheduler choice), and Stages 3–5's docs (the CRUD/auth/admin routes this stage builds on top of). This doc covers Stage 6 end to end: the timing redesign that happened before any code was written, the two-track architecture, all 7 build steps, and every real bug caught along the way.
 
## Scope, as finalized this stage
The original spec (§4, pre-Stage-6) had job deadlines reminding 2hrs-before, and events reminding at an unpinned "morning of the day before" plus 3hrs-before. Before writing any code, this was revised:
 
| Trigger | Recipients | Timing | Mechanism |
|---|---|---|---|
| **Job** deadline approaching | `JobTracking` subscribers | **1 hour before** `job_deadline` | Scheduler poll |
| **Job** newly posted (shared only — creator is admin) | All students | Immediately, at creation | Inline in `POST /jobs` |
| **Event** (OA/PPT/Interview) newly added | `JobTracking` subscribers for the parent job | Immediately, at creation | Inline in `POST /events` |
| **Event** approaching | `JobTracking` subscribers for the parent job | **8pm IST the night before**, and 3 hours before | Scheduler poll |
| **PracticeTest** approaching | Every student (no tracking table) | **8pm IST the night before**, and 3 hours before (unified with Event this stage) | Scheduler poll |
 
This split the work into two genuinely different mechanisms sharing one `Notification` table: **creation-triggered** (fires once, inline, no polling) and **time-based** (needs the scheduler + dedup, since the same tick runs repeatedly against the same rows).
 
## Schema change: `notification_type`
```sql
ALTER TABLE notifications
ADD COLUMN notification_type VARCHAR
CHECK (notification_type IN ('1hr', '3hr', '8pm', 'post'));
```
Same `create_all()`-doesn't-alter-existing-tables gotcha hit in Stages 4/5 (`hashed_password`, the cascade FKs) — `notifications` already existed from Stage 2, so the SQLAlchemy model's new column had to be added via a manual `ALTER TABLE`, not picked up automatically. Unlike those earlier cases, this one used a plain `ALTER TABLE ADD COLUMN` rather than a full `TRUNCATE`/reset, since preserving already-inserted test rows wasn't a concern either way and the simpler statement was sufficient.
 
**Why this column exists at all — the case that broke the simpler approach.** The original idea was to distinguish "which reminder already fired" by comparing how long before the deadline a notification was sent. This breaks for events: the 3hrs-before reminder is a *fixed offset* from the deadline, but the 8pm-the-night-before reminder is a *wall-clock check* ("is it 8pm right now, and is the deadline tomorrow?"), not an offset. For a late-night event (e.g. 11pm), the 8pm-before reminder lands only ~3 hours before it — indistinguishable by time-gap alone from the real 3hr reminder. `notification_type` makes the distinction explicit instead of trying to re-derive it from timestamps after the fact.
 
**Values deliberately don't repeat entity type.** No `event-3hr` vs `job-1hr` as separate strings — which entity a `Notification` is about is already fully determined by which of the three nullable FKs (`job_id`/`event_id`/`practice_test_id`) is populated, so encoding it again in `notification_type` would be redundant. Dedup checks combine both: "does a `Notification` already exist for this `event_id` + this `student_id` + `notification_type = '8pm'`."
 
**`'post'` covers both creation-triggered notifications** (job-just-posted, event-just-added) with one shared value, for the same FK-redundancy reason — which one it is is already visible from the populated FK.
 
## What got built this stage (all 7 steps)
 
| Step | What | Where |
|---|---|---|
| 1 | `create_notification()` — dedup-checked insert helper | `app/utilities/notification.py` |
| 2 | Inline "job newly posted" notification | Added to existing `POST /jobs` |
| 3 | Inline "event newly added" notification | Added to existing `POST /events` |
| 4 | APScheduler wiring (`BackgroundScheduler`, 1-minute interval) | `app/utilities/scheduler.py`, `main.py`'s `lifespan` |
| 5 | Scheduler: job-deadline reminder (1hr) | `poll_notifications()` in `scheduler.py` |
| 6 | Scheduler: event/practice-test reminder (3hr + 8pm) | Same function, same file |
| 7 | `GET /notifications` + `PATCH /notifications/{id}/read` | New routes in `main.py` |
 
Standard pattern per step: reason through the design/tradeoffs first, Hadi writes the code, Claude reviews for real bugs vs. style, test against the live DB (`psql`) or via Postman before moving on. Every scheduler-related step (4–6) was verified against real ticks and real rows, not just read-through — see bugs section below for what that testing actually caught.
 
## Design decisions & why
 
**Two-track architecture (creation-triggered vs. scheduler-polled), not one unified mechanism.** The "job posted"/"event added" notifications are semantically a one-time event, known exactly when it happens — putting them on the scheduler would mean either polling for "was this ever announced" (an awkward, indirect check) or accepting a delay between creation and notification for no reason. Firing them inline, in the same route that already knows the exact moment of creation, is simpler and immediate.
 
**Event-added notification gated on `is_admin`, but for a different reason than the job-posted broadcast.** Both use the same `if current_student.is_admin:` condition, but the reasoning is distinct: the job broadcast only applies to *shared* jobs by definition (personal jobs have no batch-wide audience). The event notification's audience is always "this job's `JobTracking` subscribers" regardless of shared/personal status — but for a personal job, the only possible subscriber is the job's own creator, who already knows they just added the event. The `is_admin` gate isn't scoping the audience here, it's skipping pointless work that the self-exclusion check would have zeroed out anyway.
 
**Manually-managed `Sessionlocal()` session inside the scheduler, not `Depends(get_db)`.** `get_db` is a generator built for FastAPI's dependency-injection system — it only runs in the context of a request. `poll_notifications()` isn't a route; nothing calls it through FastAPI's DI. It opens its own session directly via the same `Sessionlocal` factory `get_db` is built on, wrapped in `try`/`finally` to guarantee `db.close()` runs even on an exception — the same job `get_db`'s own `finally` does, just written explicitly since there's no framework doing it automatically here.
 
**`BackgroundScheduler`, not `AsyncIOScheduler`.** The whole codebase — every route, `create_notification`, the `Session` object itself — is synchronous SQLAlchemy, not `async`/`await`. `BackgroundScheduler` runs the poll function in its own thread, cleanly separate from FastAPI's request handling, with no async/sync impedance mismatch to manage.
 
**1-minute poll interval.** No precision requirement in the spec drove this — picked as a reasonable balance between reminder timeliness and DB load, for reminders that don't need second-level accuracy (job/interview deadlines, not stock trades).
 
**Two-sided, buffered time windows (e.g. `now + 55min` to `now + 65min` for the 1hr reminder), not an exact-instant check.** A tick only runs once a minute, so it's never checking the literal instant something crosses a threshold — it's checking a window. A window matching the poll interval exactly (e.g. exactly 1 minute wide) is fragile: a slow tick, a brief server restart, or timing drift could let a deadline slip through the gap between two ticks and never get caught. A wider window (10 minutes, centered on the target) costs a few redundant "already scheduled" dedup lookups on consecutive ticks, in exchange for resilience — the existing dedup check in `create_notification` absorbs the redundancy for free, since only the first matching tick actually inserts a row.
 
**Dedup query filters on all three FK columns unconditionally, relying on the "exactly one FK populated" invariant.** Rather than conditionally building a filter that only checks whichever single FK was passed, `create_notification` filters on `job_id`, `event_id`, and `practice_test_id` together every time. Because unset FKs are `None`, and SQLAlchemy compiles `Column == None` to `IS NULL`, this correctly matches "this FK, and the other two are null" — which is exactly right, given the schema's existing invariant that exactly one of the three is ever populated per row. Simpler to read at the cost of being slightly more verbose than a conditionally-built filter; not something that needs changing, just worth knowing it depends on that invariant holding.
 
**Mark-as-read as a dedicated route (`PATCH /notifications/{id}/read`), not a generic `PATCH /notifications/{id}` accepting an arbitrary body.** Unlike `JobUpdate`/`EventUpdate` (genuine multi-field partial updates), `is_read` is the *only* field a client should ever be allowed to mutate on a `Notification` — everything else is system-generated. A generic `PATCH` body inviting arbitrary fields (or `is_read: false`) doesn't fit this resource's actual shape.
 
**`GET /notifications` returns unread-only by default, newest-first.** A notification feed is primarily "what haven't I seen yet" — read notifications aren't the common case a student needs surfaced on every check.
 
## Real bugs caught during this stage
Numerous, and each one was caught via actually running the code against the real DB, not just review — worth keeping as a reference:
 
- **Inverted dedup condition** in `create_notification` (`if not db_notification: return "Already scheduled"`) — backwards on both branches; would have blocked every notification from ever being created, including the very first one for any given reminder.
- **`tracking.student_id`** used instead of the actual `JobTracking.applicant_id` field name, inside the event-added notification loop.
- **`job_id` passed instead of `event_id`** into `create_notification` for the event-added notification — caused a false-positive dedup collision with an unrelated "job posted" notification that happened to share the same `student_id` + `notification_type='post'` + `job_id`.
- **`.value` called on `event.event_type` inside the scheduler**, where `event` is a SQLAlchemy-loaded ORM object (plain string column) — not the Pydantic-schema version elsewhere in the codebase, where `event_type` really is an `EventType` enum instance with a `.value`. Threw `'str' object has no attribute 'value'` at runtime.
- **One-sided time-window check** (`job_deadline - now < 1hr`) — matched every already-past deadline on every tick, forever, since a large negative difference still satisfies "`< 1 hour`." Fixed to a proper two-sided window.
- **`time(24, 0)`** — Python's `time()` only accepts hours 0–23; this raised `ValueError` immediately, and — worse — the line sat outside the intended `if` block, so it crashed the entire function on every single tick regardless of time of day.
- **Missing `for event in events:` loop** in an early draft of the 8pm block — the query result was never iterated, so the code silently reused a stale `event` variable left over from an earlier block in the same function.
- **`db.get(Job, event.job_id==Job.job_id)`** — passed a boolean comparison expression as if it were a primary-key value, instead of just `event.job_id`.
- **Copy-pasted window bounds** — an early draft of the 3hr window reused the 1hr window's `55`/`65`-minute values verbatim.
- **Wrong variable referenced inside `except` print statements** (`tracking.applicant_id` used inside a `PracticeTest` loop whose actual loop variable was `student`) — would have thrown its own `NameError` and masked whatever the real underlying error was, had one occurred.
## Testing methodology notes
- **`Invoke-RestMethod` over `curl.exe`** for PATCH requests with JSON bodies in PowerShell — `curl.exe`'s quote-escaping inside PowerShell repeatedly produced malformed-request errors unrelated to any actual backend bug; PowerShell's native HTTP cmdlet sidesteps the issue entirely by taking a real object instead of a hand-escaped string.
- **Temporary, reverted time-shifts** to test wall-clock-dependent logic (the 8pm check) without waiting for the real trigger time — point the check at "a few minutes from now" instead of the hardcoded time, test, then revert. Reusable technique for any future time-of-day-gated logic.
- **AM/PM and date-rollover mixups** cost real debugging time this stage when manually computing "N hours from now" by hand — worth double-checking the system clock immediately before typing an offset, rather than working from a value glanced at a few minutes earlier.
## Known, accepted gaps (not fixed this stage — flagged for later)
- **`POST /job_trackings` validates FK existence, not visibility.** A student could in principle track a personal job belonging to someone else, if they somehow knew its `job_id`, since the route never checks whether the job is actually visible to them (only that it exists). No current path exposes another student's personal `job_id` through normal use, so this isn't exploitable today — flagged in case it matters once a frontend exists.
- **Multi-worker deployment would run one independent `BackgroundScheduler` per process.** If Stage 9 ever scales this app to multiple Uvicorn workers, each would tick independently against the same DB, meaning the same reminder could be triggered redundantly from multiple processes. The existing dedup check in `create_notification` would absorb this safely (later processes just find the row already exists), but it's a single-process assumption baked into the current design — revisit if/when deployment scales beyond one worker.
## Status
Stage 6 complete. All 7 steps built and tested against the live DB and a real running scheduler — every scheduler-related step surfaced and fixed at least one genuine runtime bug, not just code that looked right on read-through. `GET /notifications` and the mark-as-read route were code-reviewed correct but not yet exercised with a live request at the time of this doc; a quick confirmation test is recommended but not blocking. Next: Stage 7 (Calendar Views, backend).