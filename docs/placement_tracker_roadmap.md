# Placement Tracker — Roadmap
 
Companion to `placement_tracker_spec.md` (product), `placement_tracker_schema.md` (data model), and `placement_tracker_techstack.md` (stack). This doc lays out the full build sequence, end to end, so progress can be checked against it at a glance. `placement_tracker_progress.md` tracks exactly where things stand within this roadmap and what the very next step is.
 
Scope = the v1 cut agreed in the spec doc: Daily + Monthly views, shared Job/Event catalog with dedup, multi-user auth, notifications. Yearly view and the rest of the productivity-journal features are explicitly v2, not in this roadmap.
 
## Stage 1 — Environment & Foundations ✅ DONE
- Python, PostgreSQL, Node, Git installed and confirmed on Windows/PowerShell
- `placement_tracker` DB created
- FastAPI project skeleton, venv, `.env`/`.gitignore`, `requirements.txt`
## Stage 2 — Data Model ✅ DONE
- All 6 SQLAlchemy models written (`Student`, `Job`, `Event`, `PracticeTest`, `JobTracking`, `Notification`)
- Tables created and verified live in Postgres
## Stage 3 — Core CRUD API ✅ DONE
Built and tested (via `/docs`, no frontend needed) Create/Read routes for each resource:
1. **Student** — `POST /students`, `GET /students/{id}`
2. **Job** — `POST /jobs`, `GET /jobs/{id}`, `GET /jobs`
3. **Event** — `POST /events` (FK-validated against `job_id`), `GET /events/{id}`, `GET /events`
4. **PracticeTest** — `POST /practice_tests`, `GET /practice_tests/{id}`, `GET /practice_tests`
5. **JobTracking** — `POST /job_trackings` (FK-validated against both `applicant_id` and `job_id`, duplicate-tracking prevented), `GET /job_trackings/{id}`, `GET /job_trackings`
See `placement_tracker_stage3_api.md` for the full route list, request/response shapes, and the design decisions made along the way (enum validation, FK-existence checks, fail-fast error handling, dedup logic, and what was deliberately deferred).
 
## Stage 4 — Authentication ✅ DONE
- Password hashing (bcrypt via `passlib`) on `Student` signup (`hashed_password` column added, `POST /students` doubles as signup)
- Hand-rolled JWT: `POST /login` issues a token (`sub`=`student_id`, `exp`=1hr), protected routes require it via `get_current_student`
- `JobTracking` creation now derives the applicant from the authenticated token, not a client-supplied `applicant_id`
- **Job visibility model** (expanded scope beyond the original plan): any authenticated student can create a `Job` (`created_by` FK added); visibility is shared (everyone sees it) if the creator is an admin, personal (creator-only) otherwise — replaces the original "Job/Event are always shared" assumption
- `is_admin`-based admin dependency (`get_current_admin`) built, though `Job`/`Event` creation itself ended up not needing an admin gate — see `placement_tracker_stage4_auth.md` for full reasoning
See `placement_tracker_stage4_auth.md` for the full route list, design decisions, and bugs caught along the way.
 
## Stage 5 — Admin & Personal Job Tooling ✅ DONE (scope finalized — see notes below)
See `placement_tracker_stage5_admin_tooling.md` for the full route list, design decisions, and bugs caught along the way.
- ✅ **Student: delete own personal job** — cascade-deletes its `Event`s
- ✅ **Admin: delete a shared job** — standalone route, cascade-deletes its `Event`s, `JobTracking`s, and `Notification`s
- ✅ **Admin: edit shared `Job` fields** / **Student: edit own personal job** — one `PATCH /jobs/{job_id}` route, branches internally
- ✅ **Admin: edit event on a shared job** / **Student: edit event on own personal job** — one `PATCH /events/{event_id}` route, same branching
- ✅ *(unplanned, caught this stage)* **`POST /events` authorization fix** — was completely unauthenticated since Stage 3; retrofitted with the same shared/personal branching check plus duplicate-event-type prevention
- ⏭️ **Admin: merge two shared jobs** — deferred to future scope (see note below), not part of Stage 5's working v1
- ⏭️ **Admin-promotion flow** — deferred to future scope; stays a manual `psql UPDATE` for v1 (see note below)
**Deferred to future scope (this session): admin merge.** Design discussion started (which job survives, what moves vs. gets discarded, route shape) but paused before any code was written. Decided to prioritize a working, usable app first — delete and edit on shared jobs are judged sufficient for now, and merge is assumed to be a rare-enough scenario in practice that it doesn't need to block the rest of the build. Revisit post-v1 if duplicate shared jobs turn out to be a recurring real problem once the app is in actual use.
 
**Deferred to future scope (this session): admin-promotion flow.** Stays exactly as it's been since Stage 3/4 — a manual `psql UPDATE students SET is_admin = true WHERE student_id = ...`. A promotion route would need its own design work (who can promote — likely admin-gated, but there's a bootstrap problem since the very first admin has no admin to promote them; promote by email or student_id; whether demotion is in scope too) that wasn't judged worth doing before the rest of the app works end to end, given there's realistically a small, known set of branch admins for now. Revisit once there's a real need to onboard admins without direct DB access.
 
**Dropped from original plan: fuzzy-match-on-create.** See `placement_tracker_schema.md` for the full reasoning — duplicates among shared jobs are expected (multiple branch admins posting independently) and are more reliably caught by an admin's own judgment than a similarity algorithm, so dedup is handled entirely after the fact via merge, not prevented at creation.
 
**Dropped from original plan: the Stage 4 "known gap" (admin visibility into other students' personal jobs).** Moot once merge/delete were scoped to shared jobs only — a personal job is invisible to anyone but its creator, so it's never a merge or admin-delete target. `GET /jobs` needs no filter change.
 
**Clarified product model (this session):** multiple admins exist, one per branch — each posts jobs relevant to their own branch into the shared catalog; students see shared jobs as notifications and opt in/out of tracking. A student who can't find a job they've applied to in the shared list can create a personal (non-shared) entry instead, track it, and manage its events themselves.
 
**Cascade delete, DB-level not app-level.** `ondelete="CASCADE"` added to `Event.job_id`, `JobTracking.job_id`, `Notification.job_id`, and `Notification.event_id` — a `Job` delete (personal or shared) removes its full dependent chain automatically via Postgres, rather than the app deleting each dependent table manually.
 
## Stage 6 — Notifications ✅ DONE
*(Steps revised — see `placement_tracker_stage6_notifications.md` for full detail, and `placement_tracker_progress.md` for the session that changed the timing rules and split this into two tracks.)*
 
Two genuinely different mechanisms feed the same `Notification` table: **creation-triggered** (fires inline in an existing route, no polling involved) and **time-based** (needs the scheduler + dedup logic, since the same tick runs repeatedly). Build order:
 
1. **Notification-creation helper** — shared function used by both tracks below; inserts a `Notification` row, including the dedup check that prevents the same reminder firing twice. Built and tested standalone first, since everything else depends on it.
2. **Inline: job newly posted** — in `POST /jobs`, shared jobs only (creator is admin): notify every `Student` immediately at creation.
3. **Inline: event newly added** — in `POST /events`: notify that job's `JobTracking` subscribers immediately at creation.
4. **APScheduler wiring** — get the scheduler running inside FastAPI's app lifecycle (startup/shutdown), confirmed ticking, before any real reminder logic runs on it.
5. **Scheduler: job-deadline reminder** — 1hr before `Job.job_deadline`, notify `JobTracking` subscribers.
6. **Scheduler: event/practice-test reminder** — 8pm IST the night before, **and** 3hrs before; shared logic, since `Event` and `PracticeTest` now use an identical timing rule.
7. **`GET /notifications` (own) + mark-as-read route.**
See `placement_tracker_spec.md` §4 for the authoritative timing/recipient table.
 
**File placement:** built as `app/utilities/` (`database.py`, `auth.py`, `notification.py`, and now `scheduler.py`) — a deliberate reorganization made during implementation, superseding an earlier suggestion in this doc to keep `notifications.py` standalone. All shared/cross-route logic now lives under this one folder.
 
## Stage 7 — Calendar Views (Backend) ✅ DONE
Design finalized, both routes written, and all live tests passed against the real DB (including month-boundary edge cases) — see `placement_tracker_stage7_calendar.md` for full detail.
- **Read-only for v1** — no completion/postponement/cancellation tracking (no `X`/`>`/strikethrough state), deliberately, per the existing "no separate calendar table" schema decision. Confirmed as the correct v1 cut, not an oversight, this session.
- `GET /calendar/monthly?year=&month=` — returns a dict grouped by day (`{"2026-07-05": [...]}`)
- `GET /calendar/daily?date=` — returns a flat list for a single day
- Both auth-protected (`Depends(get_current_student)`)
- **Visibility rules** (asymmetric by design, distinct from the notification-recipient rules):
  - Job deadlines (Red): own personal jobs + **all** shared jobs (mirrors `GET /jobs` visibility, not gated by tracking)
  - Events (Blue): own personal jobs' events + **tracked** shared jobs' events only
  - PracticeTest (Red — treated as a deadline, not an event): everyone
- New purpose-built `CalendarEventItem` schema (`app/schemas/calendar.py`) — embeds `company_name`/`role` directly on event items rather than just `job_id`, resolving the tradeoff deferred back in Stage 3. `EventOut` itself is untouched.
- Shared `_get_calendar_items()` helper used by both routes — code reuse at the query-logic level; the two routes remain independent per-request queries, not a monthly-result cache (see below).
## Stage 8 — Frontend (React, from zero)
Given React is being learned from scratch, this stage itself is broken into its own steps once we reach it:
1. React fundamentals (components, state, props) via small throwaway exercises tied to this project's actual UI needs
2. Auth pages (login/signup) talking to the Stage 4 API
3. Job/Event list + create forms (dropdowns for `event_type` and `job_id` selection — a UX layer on top of, not a replacement for, the backend validation already built in Stage 3)
4. Monthly view (calendar grid) — `GET /calendar/monthly`
5. Daily view — **should try a client-side lookup into the already-loaded monthly data first** (the monthly response is grouped by date string, e.g. `monthlyData["2026-07-05"]`, so no reshaping needed), falling back to `GET /calendar/daily` only on a cache miss: month boundary (day falls outside the currently-loaded month), cold start/fresh load landing directly on "today," or a deep link straight to a daily URL. Not "always reuse" or "always fetch" — genuine cache-hit/cache-miss logic.
6. Notifications display
## Stage 9 — Deployment
- Backend + Postgres → Render or Railway
- Frontend → Vercel
- Environment variables configured on both platforms (never committing real secrets, same principle as local `.env`)
## Stage 10 — Real Usage
- Get it in front of friends/batch, gather feedback
- Fix real bugs surfaced by real usage (a genuinely good thing to have happen before placements — "here's a bug a user found and how I fixed it" is a strong interview answer)
## Explicitly out of scope for this roadmap (v2 / later)
- Admin merge of duplicate shared jobs — deferred from Stage 5 (see note above); delete + edit on shared jobs cover the immediate need
- Admin-promotion route — deferred from Stage 5 (see note above); stays a manual `psql UPDATE`
- Yearly view
- WhatsApp/Superset auto-integration (not possible without API access)
- Full productivity-journal features (habit tracker, sleep tracker, etc.)
- Docker (planned as a later "for experience" exercise, not required for v1 to ship)