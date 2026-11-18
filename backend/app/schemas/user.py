from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr

RoleName = Literal["student", "teacher", "canteen_staff", "school_admin"]


class StudentOut(BaseModel):
    name: str
    grade: str
    section: str

    class Config:
        from_attributes = True


class TeacherOut(BaseModel):
    name: str
    employee_id: str
    department: Optional[str] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    login_id: str
    email: EmailStr
    password: str
    role: RoleName
    # Required when role is "student" or "teacher"
    name: Optional[str] = None
    # Required when role == "student"
    grade: Optional[str] = None
    section: Optional[str] = None
    # Required when role == "teacher" (department is optional)
    employee_id: Optional[str] = None
    department: Optional[str] = None


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[RoleName] = None
    name: Optional[str] = None
    grade: Optional[str] = None
    section: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None


class UserOut(BaseModel):
    id: int
    login_id: str
    email: str
    role: RoleName
    created_at: datetime
    student: Optional[StudentOut] = None
    teacher: Optional[TeacherOut] = None

    class Config:
        from_attributes = True


class PasswordResetOut(BaseModel):
    temporary_password: str


class ImportedUserOut(BaseModel):
    row: int
    login_id: str
    role: RoleName
    # Only set when the file left the password blank and one was generated.
    temporary_password: Optional[str] = None


class ImportRowError(BaseModel):
    row: int
    message: str


class UserImportResult(BaseModel):
    created: list[ImportedUserOut]
    errors: list[ImportRowError]
