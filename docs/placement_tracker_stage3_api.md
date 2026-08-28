# Placement Tracker — Stage 3: Core CRUD API
 
Companion to `placement_tracker_spec.md` (product), `placement_tracker_schema.md` (data model), and `placement_tracker_techstack.md` (stack). This doc covers what got built in Stage 3 — the bare CRUD API, tested entirely via FastAPI's `/docs` with no frontend — and the reasoning behind the non-obvious calls made along the way.
 
## Routes built
 
All routes tested and confirmed working via `/docs` before moving on to the next resource.
 
| Resource | Routes | Notes |
|---|---|---|
| **Student** | `POST /students`, `GET /students/{id}` | First resource; established the create/read/schema pattern reused for everything after. |
| **Job** | `POST /jobs`, `GET /jobs/{id}`, `GET /jobs` | First "list" route. |
| **Event** | `POST /events`, `GET /events/{id}`, `GET /events` | First resource with an FK to validate (`job_id`) and a constrained value set (`event_type`). |
| **PracticeTest** | `POST /practice_tests`, `GET /practice_tests/{id}`, `GET /practice_tests` | Simplest resource — no FK, no constrained values. |
| **JobTracking** | `POST /job_trackings`, `GET /job_trackings/{id}`, `GET /job_trackings` | Two FKs to validate (`applicant_id`, `job_id`) plus a uniqueness rule (a student can't track the same job twice). |
 
Standard pattern per resource: SQLAlchemy model (from Stage 2) → Pydantic `Create`/`Out` schema pair → route using `Depends(get_db)`. Hadi wrote every route; Claude reviewed and flagged bugs/style issues before moving to the next resource.
 
## Design decisions & why
 
**`EventType` as a `str, Enum`, not a plain `str`.**
`Event.event_type` already has a DB-level `CHECK` constraint (`OA`/`PPT`/`Interview`), so a bad value would eventually get rejected either way — but a plain `str` field lets bad data travel all the way to Postgres before failing, surfacing as a raw constraint-violation error. Using a Python `Enum` on the Pydantic schema rejects invalid values immediately, with a clean `422` and a proper message (e.g. `"Input should be 'OA', 'PPT' or 'Interview'"`), before the request ever touches the database. `str` is mixed into the `Enum` base specifically so it serializes as a plain string in JSON responses rather than an `Enum` repr.
 
**FK-existence checks before insert, not try/except around the commit.**
Two options were on the table for handling a bad foreign key (e.g. `POST /events` with a `job_id` that doesn't exist):
- *Check first:* query for the referenced row; if missing, raise a clean `404` before ever building the insert.
- *Try/except:* attempt the insert, catch the DB's `IntegrityError`, roll back the session, then raise.
Check-first was chosen for both `Event.job_id` and `JobTracking`'s `applicant_id`/`job_id`, because the specific FK that can fail is already known in each case — there's no need for a generic catch-all yet. This also avoids a real footgun: an unhandled `IntegrityError` was seen firsthand (a `job_id: 999` POST produced a raw `500 Internal Server Error` with no useful message, and would have left the SQLAlchemy session in a broken state for subsequent requests without an explicit `rollback()`). Try/except-with-rollback remains the better tool for constraints that aren't known in advance — worth remembering as the codebase grows.
 
**Duplicate-tracking prevention on `JobTracking`, returning `409 Conflict`, not `404`.**
A student attempting to track a job they already track hits a real, deliberate check — `404` means "resource not found," which doesn't fit; `409` is the conventional code for "this conflicts with existing state," which is what's actually happening.
 
**`JobTrackingCreate` takes `applicant_id` directly from the client — a known stopgap.**
There's no auth system yet (Stage 4), so there's no server-side concept of "the currently logged-in student" to infer the applicant from. Trusting a client-supplied `applicant_id` is acceptable to unblock testing now, but it's explicitly flagged to be replaced once JWT auth exists — at that point the applicant should be extracted from the verified token, not taken as raw client input.
 
**`EventOut` returns `job_id` only — no embedded company/role.**
Considered embedding job details (via a SQLAlchemy `relationship()` and a nested schema) so a client rendering a list of events doesn't need a follow-up `GET /jobs/{id}` per event (the classic **N+1 query problem** — worth knowing that name). Decided against it for now: the actual shape needed depends on the frontend screen that doesn't exist yet (the Stage 7 calendar view), and building the relationship/nested-schema machinery now would mean guessing at that shape prematurely. Revisit at Stage 7, likely with a purpose-built response type for that view rather than changing `EventOut` itself.
 
**Dropdowns (`event_type`, `job_id`) are a Stage 8 frontend concern — not a substitute for backend validation.**
A `<select>` for `event_type` and a job-picker for `job_id` will make the real "create event" form pleasant to use and prevent accidental bad input. But the backend validation built in Stage 3 (the `Enum`, the FK-existence checks) stays regardless — it's what protects the system against *any* client, not just the one polished UI. General principle: the frontend makes the common case pleasant; the backend is the actual gatekeeper.
 
**Combined ("all problems at once") validation errors deferred in favor of fail-fast.**
Right now every check raises on the first problem found (e.g. bad `applicant_id` is reported before `job_id` is even checked). A response that reports *every* validation problem at once would be a better experience for a real form, but there's no real form driving that requirement yet — all Stage 3 testing has been single hardcoded JSON payloads via `/docs`. Revisit only if a specific Stage 8 screen actually needs it; Pydantic's own multi-error `422` responses (seen when testing the `EventType` enum) are a reasonable model to imitate if so.
 
**`Notification` confirmed out of scope for Stage 3.**
Unlike the other five tables, `Notification` rows aren't meant to be created directly by a client `POST` — per the schema doc and roadmap, they're generated by the Stage 6 APScheduler job based on timing rules (2hrs before job close, day-before-morning + 3hrs-before for events/tests). Building a `POST /notifications` route now would mean exposing a creation path that, in the real system, only the scheduler should ever use. `GET /notifications` and mark-as-read are deferred to Stage 6, alongside the scheduler itself.
 
## Real bugs caught during this stage
Worth keeping as a reference — recurring categories of mistake, not one-offs:
 
- **`.filter(column=value)`** — invalid keyword syntax for SQLAlchemy's `.filter()`. Correct forms: `.filter(Model.column == value)` (general) or `.filter_by(column=value)` (shortcut, no `Model.` prefix).
- **Checking `.filter(...) is not None`** — a `Query` object is *never* `None`, so this check always evaluates true regardless of the query's actual results. Needed `.first() is not None` (or `.all()`, `.count()`, etc.) to actually execute the query and inspect the result.
- **Python's `and` used to combine two filter conditions** — `.filter(A == x and B == y)` doesn't build a combined SQL condition; Python's `and` just returns one of its operands. Correct approach: pass conditions as separate `.filter()` arguments (implicitly ANDed), e.g. `.filter(A == x, B == y)`.
- **`@dataclass` stacked on top of a Pydantic `BaseModel`** — two competing frameworks for the same job; defeats Pydantic's own validation. A `BaseModel` alone is sufficient.
- **A field-name typo (`job_dealine` vs `job_deadline`)** across `JobCreate`/`JobOut` — caught because `Job(**schema.model_dump())` failed immediately when the kwarg didn't match the model's actual column name.
## Status
Stage 3 complete — all five resources built, tested, and reviewed. Next: Stage 4 (Authentication).