from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

FeedbackCategory = Literal["suggestion", "complaint"]
FeedbackStatus = Literal["open", "resolved"]


class FeedbackCreate(BaseModel):
    category: FeedbackCategory
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=5000)


class FeedbackStatusUpdate(BaseModel):
    status: FeedbackStatus


class FeedbackOut(BaseModel):
    id: int
    category: FeedbackCategory
    subject: str
    message: str
    status: FeedbackStatus
    created_at: datetime

    class Config:
        from_attributes = True


class AdminFeedbackOut(FeedbackOut):
    user_id: int
    login_id: str
    role: str
    # Set for student senders
    student_name: Optional[str] = None
