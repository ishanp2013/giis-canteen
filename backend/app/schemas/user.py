from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr

RoleName = Literal["student", "canteen_staff", "school_admin"]


class StudentOut(BaseModel):
    name: str
    grade: str
    section: str

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    login_id: str
    email: EmailStr
    password: str
    role: RoleName
    # Required when role == "student"
    name: Optional[str] = None
    grade: Optional[str] = None
    section: Optional[str] = None


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[RoleName] = None
    name: Optional[str] = None
    grade: Optional[str] = None
    section: Optional[str] = None


class UserOut(BaseModel):
    id: int
    login_id: str
    email: str
    role: RoleName
    created_at: datetime
    student: Optional[StudentOut] = None

    class Config:
        from_attributes = True


class PasswordResetOut(BaseModel):
    temporary_password: str
