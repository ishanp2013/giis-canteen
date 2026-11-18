from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
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
from app.models.user import User
from app.schemas.admin import AnalyticsOut, AuditLogOut, PopularItemOut, SettingsOut, SettingsUpdate
from app.schemas.feedback import AdminFeedbackOut, FeedbackCategory, FeedbackStatus, FeedbackStatusUpdate
from app.schemas.reservation import AdminReservationOut, ReservationStatus
from app.schemas.user import PasswordResetOut, StudentOut, UserCreate, UserOut, UserUpdate

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
    )


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_role("school_admin")),
    db: Session = Depends(get_db),
):
    """FR-A1: add a student, staff, or admin account."""
    role = _get_role(db, payload.role)

    if payload.role == "student" and not all([payload.name, payload.grade, payload.section]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "name, grade, and section are required for student accounts")

    user = User(
        login_id=payload.login_id,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role_id=role.id,
    )
    db.add(user)
    db.flush()

    if payload.role == "student":
        db.add(Student(user_id=user.id, name=payload.name, grade=payload.grade, section=payload.section))

    log_action(db, current_user.id, "user_created", {"created_user_id": user.id, "role": payload.role})
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    """FR-A1: list all accounts."""
    users = (
        db.query(User)
        .filter(User.is_active)
        .options(joinedload(User.role), joinedload(User.student))
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

    if payload.email is not None:
        user.email = payload.email

    if payload.role is not None:
        user.role_id = _get_role(db, payload.role).id
        if payload.role == "student" and user.student is None:
            if not all([payload.name, payload.grade, payload.section]):
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "name, grade, and section are required to make this user a student")
            db.add(Student(user_id=user.id, name=payload.name, grade=payload.grade, section=payload.section))

    if user.student is not None and any([payload.name, payload.grade, payload.section]):
        if payload.name is not None:
            user.student.name = payload.name
        if payload.grade is not None:
            user.student.grade = payload.grade
        if payload.section is not None:
            user.student.section = payload.section

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

    # Free up the portions held by the student's upcoming orders. Orders already
    # prepared or collected are left as they are.
    cancelled = 0
    if user.student is not None:
        cancelled = (
            db.query(Reservation)
            .filter(
                Reservation.student_id == user.student.id,
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
            joinedload(Reservation.reviewer),
        )
        .filter(reserved_day >= start, reserved_day <= end)
    )
    if status_filter is not None:
        query = query.filter(Reservation.status == status_filter)

    return [
        AdminReservationOut(
            id=r.id,
            student_id=r.student_id,
            student_name=r.student.name,
            student_grade=r.student.grade,
            student_section=r.student.section,
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
    """Suggestions and complaints sent by students and canteen staff, newest first."""
    query = db.query(Feedback).options(
        joinedload(Feedback.user).joinedload(User.role),
        joinedload(Feedback.user).joinedload(User.student),
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
        student_name=user.student.name if user.student else None,
    )
