# Placement Tracker — Stage 4: Authentication
 
Companion to `placement_tracker_spec.md` (product), `placement_tracker_schema.md` (data model), `placement_tracker_techstack.md` (stack), and `placement_tracker_stage3_api.md` (the Stage 3 CRUD build this stage builds on). This doc covers Stage 4: password hashing, hand-rolled JWT auth, protecting routes, and the Job visibility model that grew out of it.
 
## What got built
 
| Piece | Detail |
|---|---|
| **`hashed_password` column** | Added to `Student` (`VARCHAR(60)`, `NOT NULL`) — sized exactly to a bcrypt hash's fixed length. Required dropping/recreating `students` and its dependents (`job_trackings`, `notifications`) via `psql`, since `create_all()` only creates missing tables, never alters existing ones. |
| **`app/security.py`** | New module holding all auth logic: `hash_password`/`verify_password` (via `passlib`'s `CryptContext`), `create_access_token` (JWT issuance), `get_current_student` and `get_current_admin` (FastAPI dependencies for protected routes). |
| **`POST /students`** (signup) | Updated to hash the incoming password via `hash_password()` before storage; never stores or returns raw text. |
| **`POST /login`** | New route + `StudentLogin` schema (`email`, `password`). Looks up by email, verifies password, issues a JWT on success. |
| **`get_current_student`** | Extracts the Bearer token from the request, decodes/verifies it, looks up and returns the `Student` it belongs to. The reusable building block for every protected route from here on. |
| **`get_current_admin`** | Layers on top of `get_current_student`; additionally requires `is_admin = True`. |
| **`JobTracking` retrofit** | `applicant_id` removed from `JobTrackingCreate`; `POST /job_trackings` now derives the applicant from `Depends(get_current_student)` — resolves the stopgap flagged back in Stage 3. |
| **`Job.created_by`** | New required FK (`Student.student_id`), enabling the shared-vs-personal visibility model below. |
| **`GET /jobs` visibility filter** | Now protected (`Depends(get_current_student)`) and filtered: returns jobs whose creator is an admin (shared) **OR** jobs the current student created themselves (personal). |
 
## Design decisions & why
 
**JWTs, structurally: what's actually happening.**
A JWT is header + payload + signature, base64-encoded and dot-joined. The payload is *not* encrypted — anyone holding the token can decode and read it — only the signature is protected by `SECRET_KEY`, and that signature is what lets the server detect tampering. This matters for what's allowed to live in the payload: nothing secret, only identifying/routing information. `SECRET_KEY` itself was generated via `secrets.token_hex(32)` (cryptographically random, not typed by hand) and lives only in `.env`, never committed — anyone who obtains it can forge valid tokens for any `student_id`, so it's the single most sensitive value in the system.
 
**Payload contains `student_id` (as `sub`), not `email`.**
Login (`StudentLogin`) uses `email` + `password`, because that's what a human actually remembers and types. But the JWT payload uses `student_id`, because from the moment a token is issued onward, it's the *server* referencing "who is this" on every future request — and `student_id` is immutable once assigned, where `email` is theoretically editable later. Different consumers (human vs. machine), different identifiers. Note: JWT claims are conventionally strings, so `student_id` (an `int` in the DB) is stringified going into the token (`str(student_id)`) and must be converted back (`int(payload["sub"])`) when read out.
 
**Tokens expire (`exp` claim, 1 hour).**
A token that never expires means a single leaked token grants permanent access, revocable only by rotating `SECRET_KEY` — which would invalidate every token for every user, not just the compromised one. An expiry bounds the damage window of a leaked token. One hour was picked as a reasonable, arbitrary starting point — no strict requirement drove the exact number yet.
 
**`/login` returns a uniform `401` for both "no such email" and "wrong password," with an identical message.**
Distinguishing the two in the response (e.g. `404` for unknown email, a different error for wrong password) would let an attacker probe the endpoint to discover which emails are registered accounts. A single combined check (`student is None or not verify_password(...)`) and one shared `401` response hides that distinction entirely — standard practice for login endpoints.
 
**`403`, not `401`, for admin-gate failures (`get_current_admin`).**
`401 Unauthorized` means "I don't know who you are" (missing/invalid/expired token). `403 Forbidden` means "I know exactly who you are, and you're not allowed to do this." A validly authenticated non-admin student hitting an admin-only route is squarely the second case.
 
**`/docs`'s "Authorize" button doesn't work here — deliberately not fixed.**
`OAuth2PasswordBearer`'s built-in Swagger integration expects the OAuth2 password-grant shape: form-encoded `username`/`password` sent to the token URL. `/login` deliberately uses JSON with `email`/`password` instead, since that's the correct shape for the real app (a future React frontend sends JSON; "email," not "username," is the actual domain concept). Rather than reshaping the real login endpoint just to make a `/docs` convenience button work, protected-route testing switched to `curl.exe` in PowerShell with a manually attached `Authorization: Bearer <token>` header. `OAuth2PasswordBearer` is still used, but purely for its token-extraction behavior on protected routes — its Swagger auto-integration is simply not exercised.
 
**Job creation opened to all authenticated students; visibility, not creation, is what's admin-gated — a genuine mid-session reversal of the original plan.**
The original Stage 4 plan (per the pre-session roadmap) was to gate `POST /jobs`/`POST /events` behind `get_current_admin` entirely. While building this, a real product need surfaced: a student should be able to track a job that hasn't yet been added to the shared catalog by creating their own personal entry for it — meaning *creation* needed to stay open to everyone, not admin-only. The actual distinction that matters is **who can see a given job afterward**, not who was allowed to create it. This required a real schema change (`Job.created_by`, not previously part of the model) rather than just wiring up an already-built check, and it corrects — not just extends — the original "Job/Event are shared/global records" assumption in the spec/schema docs (both have been updated to match).
 
**Job visibility is derived at query time from the creator's current `is_admin` status (a `JOIN`), not stored as a separate `is_shared` flag on `Job`.**
Two options existed: (A) join to `Student` and check `is_admin` live on every read, or (B) store a boolean on `Job` itself, set once at creation. (A) was chosen for correctness — a single source of truth, so a change in someone's admin status is reflected consistently without needing to backfill past rows — accepting the minor cost of a join on every `GET /jobs`, which is negligible at this project's scale.
 
**Known, accepted gap: an admin cannot currently see other students' personal (non-shared) jobs.**
Visibility is symmetric per-student — "shared jobs are visible to everyone, personal jobs are visible only to their own creator" — not "admins see everything." This was surfaced and deliberately left as-is, flagged for Stage 5: the merge/dedup tooling planned there will need admins to see across *all* jobs (shared and personal) to actually merge duplicates, which will likely mean adding an `OR current_student.is_admin` branch to the `GET /jobs` filter at that point.
 
**Correction (Stage 5 planning session):** this turned out not to be a real gap. Stage 5 scoped merge/edit/delete to *shared* jobs only — a personal job is invisible to anyone but its creator, so it was never a valid merge target, and the `GET /jobs` filter already surfaces every shared job to every user regardless of who's asking. No filter change was made. See `placement_tracker_schema.md` and `placement_tracker_roadmap.md` for the corrected, current statement of this.
 
**Admin promotion remains a manual `psql UPDATE`, not a route.**
Same reasoning as when this was first raised in Stage 3: there's exactly one admin today, and building a permission-gated "promote a student" endpoint now would mean building admin tooling before Stage 5 (where it actually belongs) exists to properly scope it. `UPDATE students SET is_admin = true WHERE student_id = ...;` is sufficient for the current single-admin reality.
 
## Real bugs caught during this stage
- `load_dotenv(SECRET_KEY)` — misunderstood `load_dotenv()`'s return value and referenced a variable before defining it; correct pattern is `load_dotenv()` (no args) then `os.getenv("SECRET_KEY")`, matching `database.py`'s existing `DATABASE_URL` handling.
- Missing comma in the JWT payload dict — `SyntaxError`, same category of mistake as several below.
- **`bcrypt`/`passlib` version incompatibility**: `passlib==1.7.4` predates changes in `bcrypt>=4.1`'s internals; surfaced as an internal `passlib` self-test failure (`ValueError: password cannot be longer than 72 bytes...`) on the very first `hash_password()` call. Fixed by pinning `bcrypt==4.0.1` — a known, documented incompatibility between these two specific packages, not a code bug.
- `payload["sub"]` passed directly to `db.get(Student, student_id)` without converting back from `str` to `int` — JWT claims are strings; this "worked" by accidental coercion but was fragile and fixed explicitly.
- Missing comma in `create_job_tracking`'s signature between two `Depends(...)` parameters — `SyntaxError`.
- Redundant/dead existence check left in `create_job_tracking` after adopting `get_current_student` — the check could never fire (existence is already guaranteed by the dependency) and was removed rather than left commented out.
- `db.query(Student).filter(Student.is_admin==True)` used directly as a comparison value against `Job.created_by` — same "comparing a column to an unexecuted `Query` object" mistake as Stage 3's `.filter(...) is not None` bug. Fixed by using the already-`JOIN`ed `Student.is_admin` directly, no subquery needed.
- Missing commas in the `Job(...)` constructor call inside `create_job`.
- `or_` imported from `sqlalchemy.orm` (wrong module) instead of top-level `sqlalchemy`.
- `JobOut` schema referenced a nonexistent `student_id` field; the actual model column is `created_by` — same category as Stage 3's `job_dealine` typo, a schema/model field-name mismatch.
- `SELECT students *` — SQL syntax slip (table name belongs after `FROM`, not before `*`).
## Status
Stage 4 complete — hashing, login, JWT issuance, protected routes, and the (unplanned but necessary) Job visibility model all built and tested end-to-end with two real accounts. Next: Stage 5 (Dedup & Admin Tooling).