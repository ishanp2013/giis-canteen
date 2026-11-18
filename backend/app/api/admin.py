import csv
import io
import re
from collections import Counter
from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from openpyxl import load_workbook
from pydantic import ValidationError
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.audit import log_action
from app.core.dependencies import require_role
from app.core.reservations import ACTIVE_STATUSES, reserved_count
from app.core.security import generate_temporary_password, hash_password
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.feedback import Feedback
from app.models.menu_availability import MenuAvailability
from app.models.menu_item import MenuItem
from app.models.reservation import Reservation
from app.models.role import Role
from app.models.setting import Setting
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.user import User
from app.schemas.admin import AnalyticsOut, AuditLogOut, PopularItemOut, SettingsOut, SettingsUpdate
from app.schemas.feedback import AdminFeedbackOut, FeedbackCategory, FeedbackStatus, FeedbackStatusUpdate
from app.schemas.reservation import AdminReservationOut, ReservationStatus
from app.schemas.user import (
    ImportedUserOut,
    ImportRowError,
    PasswordResetOut,
    StudentOut,
    TeacherOut,
    UserCreate,
    UserImportResult,
    UserOut,
    UserUpdate,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_role("school_admin"))])


def _get_role(db: Session, name: str) -> Role:
    role = db.query(Role).filter(Role.name == name).first()
    if role is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown role: {name}")
    return role


def _get_active_user(db: Session, user_id: int) -> User:
    """Deactivated (deleted) accounts are treated as if they don't exist."""
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        login_id=user.login_id,
        email=user.email,
        role=user.role.name,
        created_at=user.created_at,
        student=StudentOut.model_validate(user.student) if user.student else None,
        teacher=TeacherOut.model_validate(user.teacher) if user.teacher else None,
    )


def _employee_id_taken(db: Session, employee_id: str, exclude_user_id: int | None = None) -> bool:
    query = (
        db.query(Teacher)
        .join(User, User.id == Teacher.user_id)
        .filter(Teacher.employee_id == employee_id, User.is_active)
    )
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)
    return db.query(query.exists()).scalar()


def _new_user_problem(db: Session, payload: UserCreate) -> str | None:
    """Why this account can't be created, or None if it can."""
    if not payload.login_id.strip():
        return "login_id is required"
    if not payload.password:
        return "password is required"
    if payload.role == "student" and not all([payload.name, payload.grade, payload.section]):
        return "name, grade, and section are required for student accounts"
    if payload.role == "teacher" and not all([payload.name, payload.employee_id]):
        return "name and employee_id are required for teacher accounts"

    active = db.query(User).filter(User.is_active)
    if active.filter(User.login_id == payload.login_id).first() is not None:
        return f"Login ID '{payload.login_id}' is already in use"
    if active.filter(User.email == payload.email).first() is not None:
        return f"Email '{payload.email}' is already in use"
    if payload.role == "teacher" and _employee_id_taken(db, payload.employee_id):
        return f"Employee ID '{payload.employee_id}' is already in use"
    return None


def _add_user(db: Session, payload: UserCreate) -> User:
    """Stage a validated account and its student or teacher profile; the caller commits."""
    user = User(
        login_id=payload.login_id,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role_id=_get_role(db, payload.role).id,
    )
    db.add(user)
    db.flush()

    if payload.role == "student":
        db.add(Student(user_id=user.id, name=payload.name, grade=payload.grade, section=payload.section))
    elif payload.role == "teacher":
        db.add(
            Teacher(
                user_id=user.id,
                name=payload.name,
                employee_id=payload.employee_id,
                department=payload.department or None,
            )
        )
    return user


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_role("school_admin")),
    db: Session = Depends(get_db),
):
    """FR-A1: add a student, teacher, staff, or admin account."""
    problem = _new_user_problem(db, payload)
    if problem is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, problem)

    user = _add_user(db, payload)
    log_action(db, current_user.id, "user_created", {"created_user_id": user.id, "role": payload.role})
    db.commit()
    db.refresh(user)
    return _user_out(user)


# Bulk import: the columns a CSV or Excel file may have. Spaces, hyphens and
# capitals in headers are ignored, so "Login ID" and "login_id" both work.
IMPORT_COLUMNS = ("login_id", "email", "password", "role", "name", "grade", "section", "employee_id", "department")
IMPORT_ROLES = {"student": "student", "teacher": "teacher", "canteen_staff": "canteen_staff", "staff": "canteen_staff"}
IMPORT_MAX_BYTES = 2 * 1024 * 1024
IMPORT_MAX_ROWS = 500


def _normalize_header(value: object) -> str:
    return re.sub(r"[\s\-]+", "_", str(value or "").strip().lower())


def _cell_text(value: object) -> str:
    # Excel stores numbers like a grade of 5 as 5.0; keep them as "5".
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return "" if value is None else str(value).strip()


def _read_import_rows(filename: str, content: bytes) -> list[dict[str, str]]:
    """Parse an uploaded .csv or .xlsx into one dict per row, keyed by column name."""
    if filename.lower().endswith(".xlsx"):
        try:
            workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        except Exception as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Couldn't read the Excel file") from exc
        rows = [[_cell_text(v) for v in row] for row in workbook.worksheets[0].iter_rows(values_only=True)]
        workbook.close()
    elif filename.lower().endswith(".csv"):
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = content.decode("cp1252", errors="replace")
        rows = [[cell.strip() for cell in row] for row in csv.reader(io.StringIO(text))]
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload a .csv or .xlsx file")

    if not rows:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file is empty")
    headers = [_normalize_header(h) for h in rows[0]]
    missing = [c for c in ("login_id", "email", "role") if c not in headers]
    if missing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Missing required column(s): {', '.join(missing)}")

    return [
        {h: (row[i] if i < len(row) else "") for i, h in enumerate(headers) if h in IMPORT_COLUMNS}
        for row in rows[1:]
    ]


@router.post("/users/import", response_model=UserImportResult)
def import_users(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("school_admin")),
    db: Session = Depends(get_db),
):
    """Create many student, teacher and canteen staff accounts from a CSV or
    Excel file. Every row is checked first; if any row has a problem, nothing is
    imported and the errors are returned. Rows with a blank password get a
    generated temporary password, returned in the result."""
    content = file.file.read(IMPORT_MAX_BYTES + 1)
    if len(content) > IMPORT_MAX_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File is too large (2 MB max)")

    # Spreadsheet row numbers: the header is row 1. Fully blank rows are skipped.
    rows = [(i, r) for i, r in enumerate(_read_import_rows(file.filename or "", content), start=2) if any(r.values())]
    if not rows:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file has no user rows")
    if len(rows) > IMPORT_MAX_ROWS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Import at most {IMPORT_MAX_ROWS} users at a time")

    errors: list[ImportRowError] = []
    valid: list[tuple[int, UserCreate, bool]] = []
    seen: dict[str, set[str]] = {"login_id": set(), "email": set(), "employee_id": set()}

    for row_number, row in rows:
        role = IMPORT_ROLES.get(_normalize_header(row.get("role")))
        if _normalize_header(row.get("role")) in ("school_admin", "admin"):
            errors.append(ImportRowError(row=row_number, message="Admin accounts can't be imported; add them one at a time"))
            continue
        if role is None:
            errors.append(ImportRowError(
                row=row_number,
                message=f"Role '{row.get('role', '')}' isn't valid; use student, teacher or canteen_staff",
            ))
            continue

        generated = not row.get("password")
        data = {k: v for k, v in row.items() if v and k in UserCreate.model_fields}
        data.update(role=role, password=row.get("password") or generate_temporary_password())
        try:
            payload = UserCreate.model_validate(data)
        except ValidationError as exc:
            problems = "; ".join(f"{e['loc'][0]}: {e['msg']}" for e in exc.errors())
            errors.append(ImportRowError(row=row_number, message=problems))
            continue

        problem = _new_user_problem(db, payload)
        if problem is None:
            for field in ("login_id", "email", "employee_id"):
                value = getattr(payload, field)
                if value and value in seen[field]:
                    problem = f"{field} '{value}' appears more than once in the file"
                    break
        if problem is not None:
            errors.append(ImportRowError(row=row_number, message=problem))
            continue

        for field in ("login_id", "email", "employee_id"):
            if getattr(payload, field):
                seen[field].add(getattr(payload, field))
        valid.append((row_number, payload, generated))

    if errors:
        return UserImportResult(created=[], errors=errors)

    created = []
    for row_number, payload, generated in valid:
        _add_user(db, payload)
        created.append(ImportedUserOut(
            row=row_number,
            login_id=payload.login_id,
            role=payload.role,
            temporary_password=payload.password if generated else None,
        ))

    roles = Counter(p.role for _, p, _ in valid)
    log_action(db, current_user.id, "users_imported", {"count": len(created), "roles": dict(roles)})
    db.commit()
    return UserImportResult(created=created, errors=[])


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    """FR-A1: list all accounts."""
    users = (
        db.query(User)
        .filter(User.is_active)
        .options(joinedload(User.role), joinedload(User.student), joinedload(User.teacher))
        .all()
    )
    return [_user_out(u) for u in users]


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = _get_active_user(db, user_id)
    return _user_out(user)


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_role("school_admin")),
    db: Session = Depends(get_db),
):
    """FR-A1/FR-A2: edit an account, including assigning/changing its role."""
    user = _get_active_user(db, user_id)

    if payload.email is not None and payload.email != user.email:
        if db.query(User).filter(User.is_active, User.email == payload.email, User.id != user.id).first():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Email '{payload.email}' is already in use")
        user.email = payload.email
    if payload.employee_id and _employee_id_taken(db, payload.employee_id, exclude_user_id=user.id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Employee ID '{payload.employee_id}' is already in use")

    if payload.role is not None:
        user.role_id = _get_role(db, payload.role).id
        if payload.role == "student" and user.student is None:
            if not all([payload.name, payload.grade, payload.section]):
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "name, grade, and section are required to make this user a student")
            db.add(Student(user_id=user.id, name=payload.name, grade=payload.grade, section=payload.section))
        if payload.role == "teacher" and user.teacher is None:
            if not all([payload.name, payload.employee_id]):
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "name and employee_id are required to make this user a teacher")
            db.add(Teacher(user_id=user.id, name=payload.name, employee_id=payload.employee_id, department=payload.department or None))

    # Update the details of the profile that matches the account's role.
    role_name = payload.role or user.role.name
    if role_name == "student" and user.student is not None:
        if payload.name is not None:
            user.student.name = payload.name
        if payload.grade is not None:
            user.student.grade = payload.grade
        if payload.section is not None:
            user.student.section = payload.section
    if role_name == "teacher" and user.teacher is not None:
        if payload.name is not None:
            user.teacher.name = payload.name
        if payload.employee_id is not None:
            user.teacher.employee_id = payload.employee_id
        if payload.department is not None:
            user.teacher.department = payload.department or None

    log_action(db, current_user.id, "user_updated", {"updated_user_id": user.id})
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_user: User = Depends(require_role("school_admin")),
    db: Session = Depends(get_db),
):
    """FR-A1: remove an account.

    The account is deactivated rather than deleted: its reservations and audit
    log entries still reference it, and keeping them preserves order history,
    reports and the audit trail. A deactivated account can't sign in and no
    longer appears in the user list.
    """
    if user_id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't delete your own account")

    user = _get_active_user(db, user_id)
    user.is_active = False

    # Free up the portions held by the student's or teacher's upcoming orders.
    # Orders already prepared or collected are left as they are.
    owners = []
    if user.student is not None:
        owners.append(Reservation.student_id == user.student.id)
    if user.teacher is not None:
        owners.append(Reservation.teacher_id == user.teacher.id)
    cancelled = 0
    if owners:
        cancelled = (
            db.query(Reservation)
            .filter(
                or_(*owners),
                Reservation.status.in_(("reserved", "accepted")),
                Reservation.pickup_date >= date.today(),
            )
            .update({Reservation.status: "cancelled"}, synchronize_session=False)
        )

    log_action(
        db,
        current_user.id,
        "user_deleted",
        {"deleted_user_id": user.id, "login_id": user.login_id, "cancelled_reservations": cancelled},
    )
    db.commit()


@router.post("/users/{user_id}/reset-password", response_model=PasswordResetOut)
def reset_password(
    user_id: int,
    current_user: User = Depends(require_role("school_admin")),
    db: Session = Depends(get_db),
):
    """FR-A2: reset a user's password to a new temporary one."""
    user = _get_active_user(db, user_id)

    temporary_password = generate_temporary_password()
    user.password_hash = hash_password(temporary_password)

    log_action(db, current_user.id, "password_reset", {"target_user_id": user.id})
    db.commit()
    return PasswordResetOut(temporary_password=temporary_password)


@router.get("/settings", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    setting = db.query(Setting).order_by(Setting.id).first()
    return SettingsOut.model_validate(setting)


@router.patch("/settings", response_model=SettingsOut)
def update_settings(
    payload: SettingsUpdate,
    current_user: User = Depends(require_role("school_admin")),
    db: Session = Depends(get_db),
):
    """FR-A3: configure school-wide settings, including the daily cut-off time."""
    setting = db.query(Setting).order_by(Setting.id).first()
    setting.cutoff_time = payload.cutoff_time
    setting.updated_by = current_user.id

    log_action(db, current_user.id, "settings_updated", {"cutoff_time": str(payload.cutoff_time)})
    db.commit()
    db.refresh(setting)
    return SettingsOut.model_validate(setting)


@router.get("/analytics", response_model=AnalyticsOut)
def get_analytics(db: Session = Depends(get_db)):
    """FR-A4: analytics on reservations, popular items, and waste avoided."""
    total_reservations = (
        db.query(func.count(Reservation.id)).filter(Reservation.status.in_(ACTIVE_STATUSES)).scalar() or 0
    )
    total_cancelled = (
        db.query(func.count(Reservation.id)).filter(Reservation.status == "cancelled").scalar() or 0
    )

    popular_rows = (
        db.query(MenuItem.name, func.sum(Reservation.quantity).label("count"))
        .join(MenuAvailability, MenuAvailability.menu_item_id == MenuItem.id)
        .join(Reservation, Reservation.availability_id == MenuAvailability.id)
        .filter(Reservation.status.in_(ACTIVE_STATUSES))
        .group_by(MenuItem.name)
        .order_by(func.sum(Reservation.quantity).desc())
        .limit(5)
        .all()
    )
    popular_items = [PopularItemOut(menu_item_name=name, reservation_count=count) for name, count in popular_rows]

    # "Waste avoided" = meals the canteen knew not to prepare, i.e. the gap
    # between quantity made available and what was actually reserved.
    availability_entries = db.query(MenuAvailability).all()
    waste_avoided = sum(
        max(entry.quantity_available - reserved_count(db, entry.id), 0)
        for entry in availability_entries
    )

    return AnalyticsOut(
        total_reservations=total_reservations,
        total_cancelled=total_cancelled,
        popular_items=popular_items,
        waste_avoided=waste_avoided,
    )


@router.get("/logs", response_model=list[AuditLogOut])
def get_audit_logs(
    user_id: int | None = Query(default=None),
    action: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """FR-A5: view an audit log of significant actions across the system."""
    query = db.query(AuditLog)
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    if action is not None:
        query = query.filter(AuditLog.action == action)

    logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    return [AuditLogOut.model_validate(log) for log in logs]


@router.get("/reservations", response_model=list[AdminReservationOut])
def list_reservations(
    start_date: date | None = Query(default=None, description="Reserved on or after this day; defaults to 6 days ago"),
    end_date: date | None = Query(default=None, description="Reserved on or before this day; defaults to today"),
    status_filter: ReservationStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
):
    """Every reservation made in a date range (the past week by default), with
    the exact time it was made and whether staff accepted or rejected it."""
    end = end_date or date.today()
    start = start_date or end - timedelta(days=6)
    if start > end:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "start_date must be on or before end_date")
    if (end - start).days > 92:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Date range can be at most 3 months")

    reserved_day = func.date(Reservation.reserved_at)
    query = (
        db.query(Reservation)
        .options(
            joinedload(Reservation.availability).joinedload(MenuAvailability.menu_item),
            joinedload(Reservation.student),
            joinedload(Reservation.teacher),
            joinedload(Reservation.reviewer),
        )
        .filter(reserved_day >= start, reserved_day <= end)
    )
    if status_filter is not None:
        query = query.filter(Reservation.status == status_filter)

    return [
        AdminReservationOut(
            id=r.id,
            customer_type=r.customer_type,
            customer_name=r.customer_name,
            customer_detail=r.customer_detail,
            availability_id=r.availability_id,
            menu_item_name=r.availability.menu_item.name,
            quantity=r.quantity,
            unit_price=r.unit_price,
            status=r.status,
            reserved_at=r.reserved_at,
            pickup_date=r.pickup_date,
            rejection_reason=r.rejection_reason,
            reviewed_at=r.reviewed_at,
            reviewed_by_login_id=r.reviewer.login_id if r.reviewer else None,
        )
        for r in query.order_by(Reservation.reserved_at.desc()).all()
    ]


@router.get("/feedback", response_model=list[AdminFeedbackOut])
def list_feedback(
    category: FeedbackCategory | None = Query(default=None),
    status_filter: FeedbackStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
):
    """Suggestions and complaints sent by students, teachers and canteen staff, newest first."""
    query = db.query(Feedback).options(
        joinedload(Feedback.user).joinedload(User.role),
        joinedload(Feedback.user).joinedload(User.student),
        joinedload(Feedback.user).joinedload(User.teacher),
    )
    if category is not None:
        query = query.filter(Feedback.category == category)
    if status_filter is not None:
        query = query.filter(Feedback.status == status_filter)

    return [_feedback_out(f) for f in query.order_by(Feedback.created_at.desc()).all()]


@router.patch("/feedback/{feedback_id}", response_model=AdminFeedbackOut)
def update_feedback_status(
    feedback_id: int,
    payload: FeedbackStatusUpdate,
    current_user: User = Depends(require_role("school_admin")),
    db: Session = Depends(get_db),
):
    """Mark a suggestion or complaint as resolved, or reopen it."""
    feedback = db.get(Feedback, feedback_id)
    if feedback is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feedback not found")

    feedback.status = payload.status
    log_action(db, current_user.id, "feedback_status_updated", {"feedback_id": feedback.id, "status": payload.status})
    db.commit()
    db.refresh(feedback)
    return _feedback_out(feedback)


def _feedback_out(feedback: Feedback) -> AdminFeedbackOut:
    user = feedback.user
    return AdminFeedbackOut(
        id=feedback.id,
        category=feedback.category,
        subject=feedback.subject,
        message=feedback.message,
        status=feedback.status,
        created_at=feedback.created_at,
        user_id=user.id,
        login_id=user.login_id,
        role=user.role.name,
        sender_name=(user.teacher or user.student).name if (user.teacher or user.student) else None,
    )
