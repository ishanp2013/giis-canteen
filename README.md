# GIIS Canteen Pre-Order System

A web app for reserving next-day canteen meals at school. Students order dishes for tomorrow before a daily cut-off time, choosing how many portions of each. Canteen staff manage the menu and prices, set daily quantities and track orders. School admins manage accounts, settings and analytics.

## Features

**Students**
- Browse tomorrow's menu with each dish's price (AED) and how many portions are left
- Build an order across several dishes, picking a quantity for each (e.g. 2 samosas and 3 fried rice), see the running total and reserve it all in one step
- Add more portions to a dish they've already reserved
- Change a reservation's quantity or cancel it before the cut-off time (15:00 by default)
- View past and upcoming reservations with what each one costs

**Canteen staff**
- Keep a catalog of dishes with name, description and price in AED
- Choose which dishes are offered on which date, and how many portions each
- See each day's reservations (quantity, student and order total) and per-dish portion counts, and mark orders as `prepared` or `collected`
- Download daily and weekly CSV reports, including quantities, unit prices and totals

**School admins**
- Create, edit and delete student, staff and admin accounts
- Reset a user's password to a temporary one
- Set the school-wide daily cut-off time
- View usage analytics (reservations, cancellations, most-reserved dishes, portions not needed) and the audit log

**Rules the system enforces**
- Students can only order for tomorrow, and can't create, change or cancel reservations after the cut-off time.
- A dish can't be reserved beyond its quantity for that day. Availability counts portions, not reservations.
- A multi-dish order is all or nothing: if any dish doesn't have enough portions left, nothing is reserved.
- A student holds one reservation per dish per day. Ordering the same dish again adds to that reservation.
- Once staff mark an order `prepared`, the student can no longer change or cancel it.
- Each reservation saves the dish's price when it's made, so later price changes don't affect existing orders.
- Logins, password changes and admin actions are written to the audit log, and every API request is logged.

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
│   ├── schema.sql        # Full schema, roles and default settings
│   └── ER_DIAGRAM.md     # Entity-relationship diagram of the schema
└── frontend/
    ├── src/
    │   ├── api/          # API client and typed endpoint wrappers
    │   ├── components/   # Layout, route guards, shared UI
    │   ├── context/      # Auth context
    │   ├── pages/        # login, student/, canteen/, admin/
    │   └── utils/        # Date and AED currency formatting
    ├── package.json
    └── .env.example
```

## Data model

| Table | Holds |
|-------|-------|
| `roles` | The three roles: `student`, `canteen_staff`, `school_admin` |
| `users` | Login accounts, each with one role |
| `students` | Name, grade and section for student accounts |
| `menu_items` | The catalog of dishes and their price in AED |
| `menu_availability` | Which dish is offered on which date, and how many portions |
| `reservations` | A student's order for one dish on one day: quantity, unit price at time of ordering and status |
| `audit_logs` | Logins, password changes and admin actions |
| `settings` | The school-wide daily cut-off time |

See [database/ER_DIAGRAM.md](database/ER_DIAGRAM.md) for the full diagram with columns and relationships.

## Getting started

### Prerequisites

- Python 3.10+
- Node.js 20.19+ or 22.12+ (required by Vite)
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

cp .env.example .env            # Windows: copy .env.example .env  — then edit DATABASE_URL and JWT_SECRET_KEY
alembic stamp head              # mark the fresh schema as up to date

uvicorn app.main:app --reload
```

The API runs at http://localhost:8000. Interactive docs are at http://localhost:8000/docs.

> If you're upgrading an existing database rather than starting fresh, run `alembic upgrade head` instead of `alembic stamp head`.

### 3. Create the first admin account

Admin accounts are normally created by another admin, so the first one has to be added by hand. From the `backend/` folder, with the virtual environment active, run this single line (it works in bash, Command Prompt and PowerShell):

```bash
python -c "from app.database import SessionLocal; from app.models.user import User; from app.models.role import Role; from app.core.security import hash_password; db = SessionLocal(); role = db.query(Role).filter_by(name='school_admin').one(); db.add(User(login_id='admin', email='admin@example.com', password_hash=hash_password('ChangeMe123!'), role_id=role.id)); db.commit(); print('admin created')"
```

Sign in with `admin` / `ChangeMe123!`, then change the password from the app.

### 4. Start the frontend

```bash
cd frontend
npm install
cp .env.example .env            # Windows: copy .env.example .env  — VITE_API_BASE_URL defaults to http://localhost:8000
npm run dev
```

Open http://localhost:5173. After you sign in, the app sends you to the portal for your role: `/student`, `/canteen` or `/admin`.

### 5. Set up the menu

New dishes, and any dishes created before prices were added, cost AED 0.00 until a price is set. Sign in as canteen staff, add dishes with their prices on **Menu Items**, then offer them for tomorrow with a portion count on **Availability**. Students only see dishes that have availability for tomorrow.

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

Every route except `/auth/login`, `/auth/refresh` and `/health` needs a signed-in user. Student routes need the `student` role, and routes under `/canteen` and `/admin` need the matching role. Prices are in AED. The full reference is at `/docs` while the backend is running.

| Area | Endpoints |
|------|-----------|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, `POST /auth/change-password`, `POST /auth/logout` |
| Student | `GET /menu`, `POST /reservations`, `POST /reservations/batch`, `PATCH /reservations/{id}`, `DELETE /reservations/{id}`, `GET /reservations/mine` |
| Canteen | `GET/POST /canteen/menu`, `PATCH/DELETE /canteen/menu/{id}`, `GET/POST /canteen/availability`, `PATCH/DELETE /canteen/availability/{id}`, `GET /canteen/reservations`, `GET /canteen/reservations/summary`, `PATCH /canteen/reservations/{id}`, `GET /canteen/reports/daily`, `GET /canteen/reports/weekly` |
| Admin | `GET/POST /admin/users`, `GET/PATCH/DELETE /admin/users/{id}`, `POST /admin/users/{id}/reset-password`, `GET/PATCH /admin/settings`, `GET /admin/analytics`, `GET /admin/logs` |

Student reservation endpoints:

| Endpoint | Body | What it does |
|----------|------|--------------|
| `POST /reservations` | `{"availability_id": 4, "quantity": 2}` | Reserve one dish (quantity defaults to 1) |
| `POST /reservations/batch` | `{"items": [{"availability_id": 4, "quantity": 2}, {"availability_id": 7, "quantity": 3}]}` | Reserve several dishes as one all-or-nothing order |
| `PATCH /reservations/{id}` | `{"quantity": 3}` | Change the number of portions |
| `DELETE /reservations/{id}` | none | Cancel the reservation |

## Database migrations

Migrations are managed with Alembic from the `backend/` folder:

```bash
alembic revision -m "describe the change"   # create a new migration
alembic upgrade head                        # apply pending migrations
alembic current                             # show which migration the database is on
```

When you change the schema, update `database/schema.sql` and `database/ER_DIAGRAM.md` as well so that fresh installs and the docs still match.

## Frontend scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ModuleNotFoundError: No module named 'sqlalchemy'` (or another package) | The virtual environment isn't active. Run `venv\Scripts\activate` (Windows) or `source venv/bin/activate`, or call `venv\Scripts\python.exe` directly. |
| `SyntaxError` when pasting a multi-line `python -c "..."` command | Windows Command Prompt can't take multi-line strings. Use the single-line form above, or save the code to a `.py` file in `backend/` and run it. |
| A backend change seems to have no effect | `uvicorn --reload` can get stuck while reloading, especially on Windows, and keep serving the old code. Stop the server (Ctrl+C) and start it again. |
| `NoResultFound` when creating the admin | The roles table is empty. Load `database/schema.sql` first. |
