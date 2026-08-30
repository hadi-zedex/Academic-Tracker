# Placement Tracker — Tech Stack v1
 
Companion to `placement_tracker_spec.md` (product) and `placement_tracker_schema.md` (data model).
 
## Stack
 
| Layer | Choice | Why |
|---|---|---|
| Backend | **Python + FastAPI** | Leverages existing Python fluency; typed request/response models pair naturally with the schema; auto-generated API docs; current/legitimate choice for full-stack roles. |
| Database | **PostgreSQL** | Schema has real FKs, CHECK constraints, and future fuzzy-text dedup search — Postgres handles all of this and is the most commonly expected relational DB in interviews/screens. |
| ORM | **SQLAlchemy** (or SQLModel) | Schema as Python classes instead of raw SQL — but the generated SQL should still be understood, not just trusted, to not lose the DBMS learning goal. |
| Frontend | **React** (plain, no meta-framework yet) | Starting from zero on React; deliberately not adding Next.js concepts (SSR, routing conventions) on top of learning React itself in the same sprint. |
| Auth | **Hand-rolled JWT auth** (not Auth0/Clerk/etc.) | Multi-user was an explicit learning goal — a third-party auth provider would deliver the behavior without the learning. Password hashing, tokens, protected routes done manually. |
| Notifications | **APScheduler**, in-process within FastAPI | Periodically checks upcoming deadlines against `Notification` table, avoids duplicate sends (per the earlier duplicate-reminder gotcha). No external queue/cron infra needed for v1. |
| Hosting | **Vercel** (frontend) + **Render or Railway** (backend + Postgres) | Free, fast to get live for friends to actually use. Docker deliberately deferred to a later "learn it for experience" step, not a blocker to shipping v1. |
 
## Build order (why backend-first)
1. Schema → Postgres tables
2. FastAPI CRUD + auth, fully testable via FastAPI's auto-generated `/docs` — no frontend required to verify the backend works
3. APScheduler notification job on top of a working, tested backend
4. React frontend built against an already-working API
Rationale: given the 2-3 week timeline and React starting from zero, a working/demonstrable backend is a safer fallback than a half-built app on both ends if time runs short.
 
## Explicitly deferred to later (v2 / "for experience")
- Next.js or any meta-framework
- Docker
- Third-party auth providers
- External job queue / cron infra for notifications
## Status
Stack decisions confirmed and, as of Stage 6, exercised end-to-end — every layer in the table above (FastAPI, PostgreSQL, SQLAlchemy, hand-rolled JWT, APScheduler) has real working code behind it. React is the one layer not yet started. See `placement_tracker_progress.md` for exactly where the build stands.