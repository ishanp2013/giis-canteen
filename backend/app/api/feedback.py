from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.database import get_db
from app.models.feedback import Feedback
from app.models.user import User
from app.schemas.feedback import FeedbackCreate, FeedbackOut

router = APIRouter(
    prefix="/feedback",
    tags=["feedback"],
    dependencies=[Depends(require_role("student", "teacher", "canteen_staff"))],
)


@router.post("", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    payload: FeedbackCreate,
    current_user: User = Depends(require_role("student", "teacher", "canteen_staff")),
    db: Session = Depends(get_db),
):
    """Send a suggestion or complaint to the school admins."""
    feedback = Feedback(
        user_id=current_user.id,
        category=payload.category,
        subject=payload.subject.strip(),
        message=payload.message.strip(),
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return FeedbackOut.model_validate(feedback)


@router.get("/mine", response_model=list[FeedbackOut])
def my_feedback(
    current_user: User = Depends(require_role("student", "teacher", "canteen_staff")),
    db: Session = Depends(get_db),
):
    """The suggestions and complaints this user has sent, newest first."""
    items = (
        db.query(Feedback)
        .filter(Feedback.user_id == current_user.id)
        .order_by(Feedback.created_at.desc())
        .all()
    )
    return [FeedbackOut.model_validate(f) for f in items]
