-- GIIS Canteen Pre-Order System
-- Schema per SRS v1.0, Section 5 (Data Model), plus a settings table
-- needed to support FR-A3 (school-wide cut-off time configuration).

CREATE TABLE roles (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE
        CHECK (name IN ('student', 'canteen_staff', 'school_admin'))
);

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    login_id      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id       INTEGER      NOT NULL REFERENCES roles(id),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE students (
    id      SERIAL PRIMARY KEY,
    user_id INTEGER     NOT NULL UNIQUE REFERENCES users(id),
    name    VARCHAR(255) NOT NULL,
    grade   VARCHAR(20)  NOT NULL,
    section VARCHAR(20)  NOT NULL
);

-- The reusable catalog of dishes the canteen can serve. Deliberately has
-- no date or quantity: those belong to menu_availability, since the same
-- dish gets offered (and re-stocked) on many different days.
CREATE TABLE menu_items (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    created_by  INTEGER NOT NULL REFERENCES users(id)
);

-- One row per (menu item, day) it's offered on, with that day's quantity.
-- This is what students actually see and reserve against.
CREATE TABLE menu_availability (
    id                 SERIAL PRIMARY KEY,
    menu_item_id       INTEGER NOT NULL REFERENCES menu_items(id),
    available_date     DATE    NOT NULL,
    quantity_available INTEGER NOT NULL CHECK (quantity_available >= 0),
    created_by         INTEGER NOT NULL REFERENCES users(id),
    UNIQUE (menu_item_id, available_date)
);

CREATE TABLE reservations (
    id             SERIAL PRIMARY KEY,
    student_id     INTEGER     NOT NULL REFERENCES students(id),
    availability_id INTEGER    NOT NULL REFERENCES menu_availability(id),
    status         VARCHAR(20) NOT NULL DEFAULT 'reserved'
        CHECK (status IN ('reserved', 'prepared', 'collected', 'cancelled')),
    reserved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    pickup_date    DATE        NOT NULL
);

CREATE TABLE audit_logs (
    id        SERIAL PRIMARY KEY,
    user_id   INTEGER     NOT NULL REFERENCES users(id),
    action    VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata  JSONB
);

-- Not in the SRS Section 5 table list, but required by FR-A3
-- ("configure school-wide settings, including the daily cut-off time").
CREATE TABLE settings (
    id          SERIAL PRIMARY KEY,
    cutoff_time TIME        NOT NULL DEFAULT '15:00:00',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  INTEGER     REFERENCES users(id)
);

CREATE INDEX idx_menu_availability_available_date ON menu_availability(available_date);
CREATE INDEX idx_reservations_student_id ON reservations(student_id);
CREATE INDEX idx_reservations_pickup_date ON reservations(pickup_date);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

INSERT INTO roles (name) VALUES
    ('student'),
    ('canteen_staff'),
    ('school_admin');

-- Singleton settings row.
INSERT INTO settings (cutoff_time) VALUES ('15:00:00');
