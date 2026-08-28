# Placement Tracker — Stage 7: Calendar Views (Backend)
 
Companion to `placement_tracker_spec.md` (product — journal-system → Monthly/Daily view translation), `placement_tracker_schema.md` (data model — confirms no separate calendar table, read-only queries), and Stages 3–6's docs (the CRUD/auth/tracking/notification routes this stage reads from). This doc covers Stage 7 end to end: the design discussion (grounded in Hadi's actual paper journal system), the two routes built, and the live test run that closed it out.
 
## Grounding: the paper system vs. the digital cut
Before any design decisions, three journal-page photos (Weekly/Daily, Monthly, Yearly views) were reviewed against the spec. Confirmed still accurate for v1:
- Only Monthly + Daily are in scope; Yearly stays v2.
- The diagonal "day has passed" strike seen in the Monthly photo is a pure frontend visual (today vs. cell date) — no backend involvement, Stage 8 concern only.
- The `X` / `>` (postponed) / strikethrough (cancelled) states visible throughout the Daily photos are **not** being built into Stage 7. This was flagged explicitly as a real product gap (the paper system's day-to-day usefulness partly comes from those states) and confirmed, not assumed, as the deliberate v1 cut — matching the existing schema-doc line: *"No separate table for the Monthly/Daily calendar views — they're read-only queries... No write path needed."* Revisit only if real usage post-v1 shows this is actually needed.
## Design decisions & why
 
**Two separate routes (`/calendar/monthly`, `/calendar/daily`), not one parameterized endpoint.** Considered a single `GET /calendar?start=&end=` shape, but two distinct routes better match two genuinely distinct frontend screens (Stage 8's Monthly grid vs. Daily list) with different natural response shapes (grouped-by-day vs. flat).
 
**Monthly response grouped by day** (`{"2026-09-15": [...], ...}`), not a flat list with a date field. Chosen because it's directly indexable by a calendar-grid frontend component with no client-side grouping step — and, as it turned out later in the session, this shape is also exactly what makes a same-month client-side daily lookup trivial (see Stage 8 planning note below).
 
**Calendar visibility rules — asymmetric by design, and deliberately different from Stage 6's notification-recipient rules:**
| Item type | Shown if | Color |
|---|---|---|
| Job deadline | Own personal job, **or** any shared job (mirrors `GET /jobs` visibility) — not gated by tracking | Red |
| Event (OA/PPT/Interview) | On own personal job, **or** on a shared job the student is actively tracking (`JobTracking`) | Blue |
| PracticeTest | Everyone, unconditionally (no tracking table — mandatory for all) | Red |
 
The Job-deadline rule intentionally does **not** match Stage 6's "job deadline reminder → `JobTracking` subscribers only" rule. Reasoning: a student should be able to *browse* what's out there on their calendar (all shared deadlines) without that requiring them to formally track every job — but events are a heavier, more specific commitment (an actual OA/interview slot), so those only show for jobs the student has deliberately opted into. "What shows on my calendar" and "who gets notified" are treated as genuinely different questions, not required to stay in sync.
 
**PracticeTest categorized as Red (deadline), not Blue (event).** Has a `test_deadline` field and is conceptually closer to a deadline than a scheduled event, despite superficially resembling OA/Interview in behavior (a fixed date/time you must show up prepared for).
 
**New purpose-built `CalendarEventItem` schema, not a reuse of `EventOut`.** Resolves the tradeoff explicitly deferred back in Stage 3 ("revisit at Stage 7 with a purpose-built response type"). Calendar `Event` items embed `company_name`/`role` directly, avoiding the N+1-query problem a `job_id`-only response would force onto the frontend. `EventOut` itself stays thin and unchanged — this is a new, separate response shape used only by the calendar routes.
 
**`Literal`, not `Enum`, for `CalendarEventItem`'s constrained string fields (`type`, `color`, `event_type`).** `EventType` earlier in the project is a real `Enum` because it's reused across multiple schemas and backed by an actual DB `CHECK` constraint. `CalendarEventItem`'s fields are output-only, used in exactly one schema, with no matching DB column — `Literal["red", "blue"]` gives identical validation and `/docs` behavior with less ceremony. Noted as a style call, correctness is identical either way; `Enum` remains a reasonable alternative if codebase-wide consistency is preferred later.
 
**Shared `_get_calendar_items()` helper, used by both routes — but no cross-request result caching.** The two routes share the three-query logic (Job deadlines, Events, PracticeTests) via one private helper function, avoiding duplicated query code. This is *code* reuse, not *result* reuse: each HTTP request is independent and stateless, so there's no natural place at the API layer to hold onto "the month I already computed" between a `/calendar/monthly` call and a later `/calendar/daily` call — different requests, possibly different users, no guaranteed order. The actual optimization Hadi identified (skip a network call entirely if the frontend already has the requested day's data from an already-loaded month) is real, but belongs client-side — noted in `placement_tracker_roadmap.md`'s Stage 8 section as cache-hit/cache-miss logic to build once the frontend exists, not a backend concern.
 
**Half-open date ranges (`>= start, < end`), not inclusive bounds.** For `/calendar/monthly`: `start` = first of the month, `end` = first of the *following* month — avoids needing `calendar.monthrange()` or similar to compute "last day of month." For `/calendar/daily`: `datetime.combine(date, time.min)` to `datetime.combine(date, time.max)`, covering the full day. Verified via live boundary testing (see below) that this correctly includes both edges of a month without leaking into the adjacent one.
 
## What got built
 
**`app/schemas/calendar.py`** — `CalendarEventItem`: `type` (`Literal["job_deadline", "event", "practice_test"]`), `id`, `label`, `color` (`Literal["red", "blue"]`), `datetime`, plus optional `event_type`/`company_name`/`role` (populated only for `type == "event"`).
 
**`_get_calendar_items(db, current_student, start_dt, end_dt)`** — private helper (not a route), runs the three visibility-scoped queries described above, merges and sorts the results by `datetime`, returns `List[CalendarEventItem]`.
 
**`GET /calendar/monthly?year=&month=`** — computes the half-open month range, calls the helper, groups the result into `{date_string: [items]}` keyed by `"%Y-%m-%d"`.
 
**`GET /calendar/daily?date=`** — computes the single-day range, calls the helper, returns the flat list directly (no grouping needed for one day).
 
Both routes protected via `Depends(get_current_student)`.
 
## Live test run — all cases passed
Tested against the real DB with three accounts (Alice/admin, Bob/student, Carl/student), using `Invoke-RestMethod` (per the Stage 6 testing-methodology note — `curl.exe`'s quote-escaping in PowerShell remains unreliable for this kind of testing):
 
| Case | Result |
|---|---|
| Personal job deadline shows for its creator, absent for others | ✅ `TestCorp Personal` appeared for Bob on its deadline day, absent from Carl's calendar |
| Shared job, untracked: deadline shows, event does not | ✅ Bob saw `SharedCorp`'s deadline but no key at all for its OA event's date, before tracking |
| Shared job, tracked: event now shows, fully populated | ✅ After Bob tracked it, the OA event appeared with `company_name`/`role` correctly embedded |
| PracticeTest visible to a completely uninvolved account | ✅ Carl (no prior interaction) saw `Mock Aptitude` on its deadline day |
| No-auth request rejected | ✅ `401 Not authenticated` with no `Authorization` header |
| Month-boundary correctness (first/last day of month) | ✅ `EdgeStart` (Sept 1, 00:05) and `EdgeEnd` (Sept 30, 23:55) both appeared in September's response; neither appeared in October's or August's — half-open range confirmed not leaking either direction |
| Daily route matches the equivalent monthly slice | ✅ `/calendar/daily?date=2026-09-18` returned the same OA event seen under that date key in the monthly response |
 
One incidental observation during testing, not a bug: Carl's calendar showed `AdminCo3`'s OA/PPT events, meaning Carl already had a pre-existing `JobTracking` row for that job from earlier-stage test data — expected leftover state from reused test accounts, not something this session's testing created.
 
## Status
Stage 7 complete — both routes built, reviewed line-by-line, and live-tested against the real DB with all cases passing, including the month-boundary edge case. Next: Stage 8 (React frontend, from zero) — see `placement_tracker_roadmap.md` for the Stage 8 breakdown, including the daily-view client-side-lookup-first strategy noted during this stage's design discussion.
 