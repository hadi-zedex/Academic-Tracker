# Placement Tracker — Spec v0.1
 
*See `placement_tracker_schema.md` for the finalized data model and schema design rationale, and `placement_tracker_techstack.md` for the technology decisions.*
 
## 1. Problem
CCD posts jobs on Superset (open → close window, ~24h). Announcements about OA/PPT/interview dates, and other mandatory events (practice tests, orientations), happen over WhatsApp — high noise, easy to miss something relevant, and missing a mandatory event can get your Superset profile blocked.
 
Goal: a tracker, built on Abdul's 8-month-old journaling system, that surfaces deadlines/events clearly and reminds him (and eventually his batch) before they matter.
 
## 2. Journal System → Software Translation
 
### Views
Only **Yearly** and **Monthly + Daily** are needed for this project. The ad-hoc "weekly backlog" list is explicitly dropped — it exists in the paper system for undated tasks that pop into your head, but every placement item already has a known date (job close time, OA date, etc.), so there's no undated-task case here.
 
### Checkpoints (when data moves)
- **Year start** → yearly view seeded with known far-out dates
- **Month start** → monthly grid seeded from yearly view
- **End of day (daily rollover)** → tomorrow's daily list is generated from: (a) tomorrow's entries in the monthly view, and (b) anything postponed (`>`) from today
- **Ad hoc, any time** → a new job/event arriving mid-month gets placed directly in the current month's grid; if it belongs to a future month, it's placed in the yearly view instead
In software, these checkpoints become **scheduled jobs**, not manual redraws — that's the actual point of digitizing this.
 
### States (per item, per day it appears)
- *(no symbol)* → pending
- `X` → completed
- `>` → postponed (rolls forward to the next day as a new occurrence; the original stays marked postponed, preserving history)
- `—` (strikethrough) → cancelled / no longer relevant
### Color coding (applies to both Monthly and Yearly views)
- **Red** = deadline
- **Black** = task to do that day
- **Blue** = event
### Monthly view day-cells
Diagonal strike-through on a cell = that calendar day has passed. Purely a "how far through the month am I" visual — not tied to task completion.
 
## 3. Domain Entities
 
| Entity | Notes |
|---|---|
| **User** | CCD student, multi-user from day one |
| **JobPosting** | company, role, opened_at, close_time (variable, not fixed 24h — read from Superset), source |
| **Event** | type: `OA`, `PPT`, `Interview`, `PracticeTest`, `Orientation`, `Other`; optional link to a `JobPosting` (practice tests/orientations are standalone); date_time; `is_mandatory` flag |
| **Occurrence** | An item as it appears on a specific day's list (Yearly/Monthly/Daily). Has: category (deadline/task/event), color, state (pending/completed/postponed/cancelled), the day it's placed on, and a link back to its source (JobPosting or Event) |
| **Notification** | scheduled trigger tied to a JobPosting or Event |
 
**Multi-user model — RESOLVED, revised in Stage 4:**
The original plan below assumed every `JobPosting`/`Event` was always a shared/global record, added by an admin. In practice (Stage 4), any authenticated student can add a job — not just admins — because a student may need to track something before it's made it into the shared catalog. What determines whether a posting is visible to the whole batch or just to its creator is the **creator's admin status**, not who's allowed to create it:
- A job added by an admin (currently just Abdul) is shared — the whole batch can see it and attach their own tracking, applied/not, notification prefs, etc. This still mirrors patterns like calendar invites or shared docs, just now scoped to admin-authored entries specifically.
- A job added by a regular student is personal — visible only to them, a fallback for "this hasn't hit the shared catalog yet, but I still want to track it."
Because entry is manual and multiple people may independently notice and add the same *shared* (admin-authored) posting, **duplicates among shared postings are expected** — so dedup handling is in scope for v1, kept lightweight:
- **At creation time:** fuzzy-match (e.g. trigram/ILIKE similarity on company + role) against existing postings before letting a user create a new one; if a likely match is found, they attach their personal tracking to the existing record instead of creating a new one.
- **When duplicates slip through anyway:** a single `is_admin` boolean on `User` (just Abdul, initially) gates a small admin view that can **merge** two postings — reassigning all personal tracking rows from the duplicate onto the original, then archiving the duplicate — and **edit** shared fields (e.g. fix a wrong `close_time`).
- Explicitly *not* in scope: full roles/permissions system, audit trail, or multi-admin workflows. One admin flag, one merge action.
## 4. Notification Rules
*(Revised in Stage 6 planning — see `placement_tracker_progress.md` for the session this changed in. Old values: job deadline was 2hrs-before; events/tests were "morning of the day before," never pinned to a clock time.)*
 
| Trigger | Recipients | Timing | Mechanism |
|---|---|---|---|
| **Job** deadline approaching | `JobTracking` subscribers for that job | **1 hour before** `close_time` | Scheduler poll |
| **Job** newly posted (shared only — creator is admin) | All students | Immediately, at creation | Fired inline in `POST /jobs`, not the scheduler |
| **Event** (OA/PPT/Interview) newly added to a job | `JobTracking` subscribers for the parent job | Immediately, at creation | Fired inline in `POST /events`, not the scheduler |
| **Event** (OA/PPT/Interview) approaching | `JobTracking` subscribers for the parent job | **8pm IST the night before**, **and** 3 hours before | Scheduler poll |
| **PracticeTest** approaching | Every student (no tracking table — mandatory for all) | **8pm IST the night before**, **and** 3 hours before (same rule as Event, as of this revision) | Scheduler poll |
 
Note: a personal (non-shared) job still gets deadline reminders — its only `JobTracking` subscriber is its own creator — it just never gets the "newly posted" broadcast, since that's scoped to shared jobs only.
 
## 5. State Machine (per Occurrence)
```
pending ──X──────────► completed
pending ──>──────────► postponed ──► (new pending Occurrence created on next day)
pending ──cancel─────► cancelled
```
Postponing never deletes history — it closes out today's occurrence as "postponed" and spawns tomorrow's.
 
## 6. Scope Note (2–3 week timeline)
Multi-user + auth + scheduled notifications + full yearly/monthly/daily auto-generation is a lot to *fully* polish in 2–3 weeks. Rather than cut multi-user (you specifically want that learning), I'd suggest cutting **view richness** first:
- **v1 (this sprint):** multi-user auth, shared JobPosting/Event catalog, personal Occurrence tracking, Daily + Monthly views (the ones you actually use minute-to-minute), notifications for job closes + events.
- **v2 (later):** Yearly view, WhatsApp-forward-to-tracker parsing, richer analytics, the rest of your productivity-journal trackers (sleep, habits, etc.)
This keeps the "real system, real users" story intact without you drowning in calendar-rendering edge cases in week one.