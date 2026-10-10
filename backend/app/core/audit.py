from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_action(db: Session, user_id: int, action: str, metadata: Optional[dict[str, Any]] = None) -> None:
    db.add(AuditLog(user_id=user_id, action=action, metadata_json=metadata))
