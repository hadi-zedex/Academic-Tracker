# 📱 Placement Tracker (Mobile Web App)

A modern, mobile-first placement tracking and notification platform built for college students to never miss an application deadline, OA (Online Assessment), or interview round.

🚀 **Live Production App**: [https://academic-tracker-indol.vercel.app](https://academic-tracker-indol.vercel.app)  
⚡ **Backend API**: [https://academic-tracker-ac9b.onrender.com](https://academic-tracker-ac9b.onrender.com)

---

## ✨ Features

- 📅 **Integrated Monthly Calendar**:
  - 7-day matrix (Mon–Sun) with real-time colored event indicator dots.
  - Red dots for application deadlines & practice assessments; blue dots for OA and interview rounds.
  - Dynamic scroll-down daily agenda with instant in-memory cache lookup.

- 💼 **Job Profiles & Application Tracking**:
  - Directory of active hiring opportunities with instant search and filtering.
  - `All Jobs` vs `Applied Jobs` underline tabs.
  - One-tap tracking to receive event reminders and timeline schedules.

- 🎯 **Assessment & Events Hub**:
  - Dedicated chronological schedule of scheduled OA rounds, PPT sessions, and Interview rounds for tracked jobs.
  - Filterable by round type (`All`, `OA`, `PPT`, `Interviews`).

- 🔔 **Automated Reminder Notifications**:
  - Smart reminders sent before deadlines: **1 day before (8:00 PM)**, **3 hours before**, and **1 hour before**.
  - Slide-over notification drawer with unread counter badges.

- 👤 **Clean Account Management**:
  - Secure JWT-based registration and authentication.
  - Mobile-first clean white theme inspired by modern enterprise placement apps.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, TypeScript, Vanilla CSS (Design System), Lucide Icons |
| **Backend** | FastAPI (Python 3), SQLAlchemy 2.0, APScheduler, python-jose (JWT), Passlib (bcrypt) |
| **Database** | PostgreSQL |
| **Hosting** | Vercel (Frontend SPA) + Render (FastAPI Web Service & Managed PostgreSQL) |

---

## 🚀 Getting Started Locally

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL database instance

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file inside the `backend/` directory:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/placement_tracker
SECRET_KEY=your_secure_random_jwt_secret_key
```

Run the FastAPI development server:
```bash
uvicorn app.main:app --reload --port 8000
```
Swagger UI docs will be available at `http://localhost:8000/docs`.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser (or use mobile responsive preview).

---

## 📱 Mobile Installation (PWA / Add to Home Screen)

- **Android (Chrome)**: Open the live link $\rightarrow$ Tap `⋮` (menu) $\rightarrow$ Tap **"Install app"** or **"Add to Home screen"**.
- **iOS (Safari)**: Open the live link $\rightarrow$ Tap Share $\uparrow$ $\rightarrow$ Tap **"Add to Home Screen"**.

---

## 📄 License
MIT License. Built for seamless campus placement tracking.
