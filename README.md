# GIIS Canteen Pre-Order System

A web app for reserving next-day canteen meals at school. Students reserve meals for tomorrow before a daily cut-off time. Canteen staff manage the menu, set daily quantities and track orders. School admins manage accounts, settings and analytics.

## Features

**Students**
- Browse tomorrow's menu and see how many portions of each dish are left
- Reserve one or more dishes for tomorrow, choosing how many portions of each, before the cut-off time (15:00 by default)
- Change a reservation's quantity before the cut-off
- Cancel a reservation before the cut-off
- View past reservations

**Canteen staff**
- Keep a catalog of dishes (name and description)
- Choose which dishes are offered on which date, and how many portions each
- See reservations and per-dish counts, and mark orders as `prepared` or `collected`
- View daily and weekly reports

**School admins**
- Create, edit and delete student, staff and admin accounts
- Reset a user's password to a temporary one
- Set the school-wide daily cut-off time
- View usage analytics and the audit log

**Rules the system enforces**
- A student can hold one active reservation per dish per pickup date (with any quantity up to what's left).
- Reservations stop once a dish's quantity for that day is used up.
- Students can't create or cancel reservations after the cut-off time.
- Admin actions are written to the audit log, and every API request is logged.

## Tech stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7 |
| Backend  | FastAPI, SQLAlchemy 2, Pydantic Settings, Alembic |
| Database | PostgreSQL (via `psycopg`) |
| Auth     | JWT access and refresh tokens in HTTP-only cookies, bcrypt password hashing |

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/          # Route handlers: auth, student, canteen, admin
│   │   ├── core/         # Security, role dependencies, reservation rules, audit logging
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic request and response schemas
│   │   ├── config.py     # Settings loaded from .env
│   │   ├── database.py   # Engine and session setup
│   │   └── main.py       # FastAPI app, CORS, request logging
│   ├── alembic/          # Database migrations
│   ├── requirements.txt
│   └── .env.example
├── database/
│   └── schema.sql        # Full schema, roles and default settings
└── frontend/
    ├── src/
    │   ├── api/          # API client and typed endpoint wrappers
    │   ├── components/   # Layout, route guards, shared UI
    │   ├── context/      # Auth context
    │   └── pages/        # login, student/, canteen/, admin/
    ├── package.json
    └── .env.example
```

## Getting started

### Prerequisites

- Python 3.10+
- Node.js 20+
- PostgreSQL 14+

### 1. Create the database

```bash
createdb giis_canteen
psql -d giis_canteen -f database/schema.sql
```

`schema.sql` creates every table and adds the three roles and the default cut-off time (15:00).

### 2. Start the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # then edit DATABASE_URL and JWT_SECRET_KEY
alembic stamp head              # mark the fresh schema as up to date

uvicorn app.main:app --reload
```

The API runs at http://localhost:8000. Interactive docs are at http://localhost:8000/docs.

> If you're upgrading an existing database rather than starting fresh, run `alembic upgrade head` instead of `alembic stamp head`.

### 3. Create the first admin account

Admin accounts are normally created by another admin, so the first one has to be added by hand. From the `backend/` folder, with the virtual environment active:

```bash
python -c "
from app.database import SessionLocal
from app.models.user import User
from app.models.role import Role
from app.core.security import hash_password

db = SessionLocal()
role = db.query(Role).filter_by(name='school_admin').one()
db.add(User(login_id='admin', email='admin@example.com',
            password_hash=hash_password('ChangeMe123!'), role_id=role.id))
db.commit()
"
```

Sign in with `admin` / `ChangeMe123!`, then change the password from the app.

### 4. Start the frontend

```bash
cd frontend
npm install
cp .env.example .env            # VITE_API_BASE_URL defaults to http://localhost:8000
npm run dev
```

Open http://localhost:5173. After you sign in, the app sends you to the portal for your role: `/student`, `/canteen` or `/admin`.

## Configuration

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | *(required)* | SQLAlchemy URL, e.g. `postgresql+psycopg://postgres:postgres@localhost:5432/giis_canteen` |
| `JWT_SECRET_KEY` | *(required)* | Secret used to sign tokens. Use a long random value. |
| `JWT_ALGORITHM` | `HS256` | Token signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | How long an access token lasts |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | How long a refresh token lasts |
| `COOKIE_SECURE` | `false` | Set to `true` in production so cookies are sent over HTTPS only |
| `CORS_ORIGINS` | `["http://localhost:5173","http://localhost:3000"]` | Allowed frontend origins (a JSON list) |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend base URL |

## API overview

Every route except `/auth/login`, `/auth/refresh` and `/health` needs a signed-in user. Routes under `/canteen` and `/admin` also need the matching role. The full reference is at `/docs` while the backend is running.

| Area | Endpoints |
|------|-----------|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, `POST /auth/change-password`, `POST /auth/logout` |
| Student | `GET /menu`, `POST /reservations`, `DELETE /reservations/{id}`, `GET /reservations/mine` |
| Canteen | `GET/POST /canteen/menu`, `PATCH/DELETE /canteen/menu/{id}`, `GET/POST /canteen/availability`, `PATCH/DELETE /canteen/availability/{id}`, `GET /canteen/reservations`, `GET /canteen/reservations/summary`, `PATCH /canteen/reservations/{id}`, `GET /canteen/reports/daily`, `GET /canteen/reports/weekly` |
| Admin | `GET/POST /admin/users`, `GET/PATCH/DELETE /admin/users/{id}`, `POST /admin/users/{id}/reset-password`, `GET/PATCH /admin/settings`, `GET /admin/analytics`, `GET /admin/logs` |

## Database migrations

Migrations are managed with Alembic from the `backend/` folder:

```bash
alembic revision -m "describe the change"   # create a new migration
alembic upgrade head                        # apply pending migrations
```

When you change the schema, update `database/schema.sql` as well so that fresh installs still match.

## Frontend scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |
