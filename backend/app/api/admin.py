from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.audit import log_action
from app.core.dependencies import require_role
from app.core.reservations import ACTIVE_STATUSES
from app.core.security import generate_temporary_password, hash_password
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.menu_availability import MenuAvailability
from app.models.menu_item import MenuItem
from app.models.reservation import Reservation
from app.models.role import Role
from app.models.setting import Setting
from app.models.student import Student
from app.models.user import User
from app.schemas.admin import AnalyticsOut, AuditLogOut, PopularItemOut, SettingsOut, SettingsUpdate
from app.schemas.user import PasswordResetOut, StudentOut, UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_role("school_admin"))])


def _get_role(db: Session, name: str) -> Role:
    role = db.query(Role).filter(Role.name == name).first()
    if role is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown role: {name}")
    return role


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
    users = db.query(User).options(joinedload(User.role), joinedload(User.student)).all()
    return [_user_out(u) for u in users]


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return _user_out(user)


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_role("school_admin")),
    db: Session = Depends(get_db),
):
    """FR-A1/FR-A2: edit an account, including assigning/changing its role."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

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
    """FR-A1: remove an account."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    log_action(db, current_user.id, "user_deleted", {"deleted_user_id": user.id})
    if user.student is not None:
        db.delete(user.student)
    db.delete(user)
    db.commit()


@router.post("/users/{user_id}/reset-password", response_model=PasswordResetOut)
def reset_password(
    user_id: int,
    current_user: User = Depends(require_role("school_admin")),
    db: Session = Depends(get_db),
):
    """FR-A2: reset a user's password to a new temporary one."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

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
        db.query(MenuItem.name, func.count(Reservation.id).label("count"))
        .join(MenuAvailability, MenuAvailability.menu_item_id == MenuItem.id)
        .join(Reservation, Reservation.availability_id == MenuAvailability.id)
        .filter(Reservation.status.in_(ACTIVE_STATUSES))
        .group_by(MenuItem.name)
        .order_by(func.count(Reservation.id).desc())
        .limit(5)
        .all()
    )
    popular_items = [PopularItemOut(menu_item_name=name, reservation_count=count) for name, count in popular_rows]

    # "Waste avoided" = meals the canteen knew not to prepare, i.e. the gap
    # between quantity made available and what was actually reserved.
    availability_entries = db.query(MenuAvailability).all()
    waste_avoided = sum(
        max(entry.quantity_available - db.query(func.count(Reservation.id)).filter(
            Reservation.availability_id == entry.id, Reservation.status.in_(ACTIVE_STATUSES)
        ).scalar(), 0)
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
