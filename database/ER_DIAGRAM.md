# Database ER Diagram

Entity-relationship diagram of the GIIS Canteen database (PostgreSQL), matching [`schema.sql`](schema.sql) and the latest Alembic migration (`e8b3f6a2c9d4`).

```mermaid
erDiagram
    roles ||--o{ users : "assigned to"
    users ||--o| students : "has profile"
    users ||--o| teachers : "has profile"
    users ||--o{ menu_items : "creates"
    users ||--o{ menu_availability : "schedules"
    users ||--o{ audit_logs : "performs"
    users |o--o{ settings : "last updated"
    menu_items ||--o{ menu_availability : "offered as"
    menu_availability ||--o{ reservations : "reserved via"
    students |o--o{ reservations : "makes"
    teachers |o--o{ reservations : "makes"
    users |o--o{ reservations : "reviews"
    users ||--o{ feedback : "sends"

    roles {
        int id PK
        varchar name UK "student | teacher | canteen_staff | school_admin"
    }

    users {
        int id PK
        varchar login_id UK "unique among active accounts"
        varchar email UK "unique among active accounts"
        varchar password_hash
        int role_id FK
        timestamptz created_at "default now()"
        boolean is_active "default true; false once deleted"
    }

    students {
        int id PK
        int user_id FK, UK "one profile per user"
        varchar name
        varchar grade
        varchar section
    }

    teachers {
        int id PK
        int user_id FK, UK "one profile per user"
        varchar name
        varchar employee_id "unique among active teachers"
        varchar department "nullable"
    }

    menu_items {
        int id PK
        varchar name
        text description "nullable"
        numeric price "AED, >= 0"
        int created_by FK
    }

    menu_availability {
        int id PK
        int menu_item_id FK "unique with available_date"
        date available_date "unique with menu_item_id"
        int quantity_available ">= 0"
        int created_by FK
    }

    reservations {
        int id PK
        int student_id FK "nullable; set for student orders"
        int teacher_id FK "nullable; set for teacher orders"
        int availability_id FK
        int quantity "> 0, default 1"
        numeric unit_price "AED per portion when reserved"
        varchar status "reserved | accepted | rejected | prepared | collected | cancelled"
        timestamptz reserved_at "default now()"
        date pickup_date
        varchar rejection_reason "nullable; note to the student"
        timestamptz reviewed_at "nullable; when accepted or rejected"
        int reviewed_by FK "nullable; staff user"
    }

    feedback {
        int id PK
        int user_id FK
        varchar category "suggestion | complaint"
        varchar subject
        text message
        varchar status "open | resolved"
        timestamptz created_at "default now()"
    }

    audit_logs {
        int id PK
        int user_id FK
        varchar action
        timestamptz timestamp "default now()"
        jsonb metadata "nullable"
    }

    settings {
        int id PK
        time cutoff_time "default 15:00"
        timestamptz updated_at "default now()"
        int updated_by FK "nullable"
    }
```

## Relationships

| From | To | Cardinality | Via |
|---|---|---|---|
| roles | users | one role, many users | `users.role_id` |
| users | students | one user, at most one student profile | `students.user_id` (unique) |
| users | teachers | one user, at most one teacher profile | `teachers.user_id` (unique) |
| users | menu_items | one staff user creates many dishes | `menu_items.created_by` |
| users | menu_availability | one staff user schedules many day entries | `menu_availability.created_by` |
| users | audit_logs | one user, many log entries | `audit_logs.user_id` |
| users | settings | settings optionally record who last changed them | `settings.updated_by` (nullable) |
| menu_items | menu_availability | one dish, offered on many days (once per day) | `menu_availability.menu_item_id` |
| menu_availability | reservations | one day's dish, many reservations | `reservations.availability_id` |
| students | reservations | one student, many reservations | `reservations.student_id` (nullable) |
| teachers | reservations | one teacher, many reservations | `reservations.teacher_id` (nullable) |
| users | reservations | one staff user accepts or rejects many reservations | `reservations.reviewed_by` (nullable) |
| users | feedback | one student or staff user sends many suggestions and complaints | `feedback.user_id` |

## Notes

- **Catalog vs. availability:** `menu_items` is the reusable list of dishes and their price. `menu_availability` says which dish is offered on which date and how many portions there are. Students reserve against `menu_availability`.
- **Order flow:** a new reservation is `reserved` (waiting for staff). Staff `accept` or `reject` it, then mark it `prepared` and `collected`. Students can only change or cancel it while it is `reserved`.
- **Portions left** for a dish on a date = `quantity_available` minus the sum of `quantity` over its reservations whose status is not `cancelled` or `rejected`.
- **Price snapshot:** `reservations.unit_price` copies `menu_items.price` when the reservation is made, so later price changes don't alter existing orders. Order total = `quantity × unit_price`.
- **Who ordered:** each reservation belongs to exactly one student or teacher (`reservations_one_customer_check`: exactly one of `student_id` and `teacher_id` is set).
- **One reservation per dish:** the API (not a database constraint) keeps a student or teacher to one active reservation per dish per day. Ordering more of the same dish increases its `quantity`.
- **settings** holds a single row with the school-wide daily cut-off time.
- **Indexes:** `menu_availability(available_date)`, `reservations(student_id)`, `reservations(teacher_id)`, `reservations(pickup_date)`, `reservations(reserved_at)`, `audit_logs(user_id)`, `feedback(user_id)`.
