from datetime import datetime, date
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, EmailStr, field_validator
from typing import Literal

VALID_ROLES = Literal["super_admin", "admin", "staff", "user"]


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    organization_name: str
    org_type: Optional[str] = "office"  # school | office | college

    @field_validator("password")
    @classmethod
    def pw_min_length(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class AuthUserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department: Optional[str] = None
    organization_id: int
    org_name: Optional[str] = None
    org_plan: Optional[str] = None
    org_type: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: AuthUserOut


# ── Onboarding ────────────────────────────────────────────────────────────────

class OnboardingStep(BaseModel):
    """Tracks which onboarding steps have been completed."""
    has_department: bool = False
    has_class: bool = False
    has_section: bool = False
    has_staff: bool = False
    has_student: bool = False
    is_complete: bool = False


class OnboardingSetupRequest(BaseModel):
    """
    One-shot onboarding payload. Creates the initial structure for an org.
    All fields are optional — frontend can send what it has and skip the rest.
    """
    # Org settings
    org_type: Optional[str] = None           # school | office | college
    settings: Optional[Dict[str, Any]] = None

    # Structure (school mode)
    department_name: Optional[str] = None
    department_code: Optional[str] = None
    class_name: Optional[str] = None
    section_name: Optional[str] = None

    # First staff member (optional)
    staff_name: Optional[str] = None
    staff_email: Optional[EmailStr] = None
    staff_password: Optional[str] = None
    staff_role: Optional[str] = "staff"


# ── Users ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "user"
    department: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department: Optional[str]
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime]
    organization_id: int
    model_config = {"from_attributes": True}


# ── RBAC Roles ────────────────────────────────────────────────────────────────

class RoleCreate(BaseModel):
    name: str
    label: Optional[str] = None
    level: int = 1
    description: Optional[str] = None


class RoleUpdate(BaseModel):
    label: Optional[str] = None
    level: Optional[int] = None
    description: Optional[str] = None


class RoleOut(BaseModel):
    id: int
    organization_id: int
    name: str
    label: Optional[str]
    level: int
    description: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


# ── RBAC Permissions ──────────────────────────────────────────────────────────

class RolePermissionCreate(BaseModel):
    role: str
    resource: str
    can_view: bool = False
    can_create: bool = False
    can_edit: bool = False
    can_delete: bool = False
    scope: str = "org"   # org | section | self


class RolePermissionUpdate(BaseModel):
    can_view: Optional[bool] = None
    can_create: Optional[bool] = None
    can_edit: Optional[bool] = None
    can_delete: Optional[bool] = None
    scope: Optional[str] = None


class RolePermissionOut(BaseModel):
    id: int
    organization_id: int
    role: str
    resource: str
    can_view: bool
    can_create: bool
    can_edit: bool
    can_delete: bool
    scope: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class PermissionMatrixRow(BaseModel):
    """One row in the RBAC matrix: a role's permissions across all resources."""
    role: str
    label: str
    level: int
    resources: Dict[str, Dict[str, Any]]   # resource → {can_view, can_create, ...}


class PermissionMatrixResponse(BaseModel):
    """Full RBAC matrix for an organisation — designed for the permissions management UI."""
    roles: List[PermissionMatrixRow]
    resources: List[str]
    is_default: bool   # True if the org has no custom DB overrides yet


# ── Attendance ────────────────────────────────────────────────────────────────

class AttendanceMark(BaseModel):
    user_id: Optional[int] = None
    date: Optional[date] = None
    status: Optional[str] = None
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    notes: Optional[str] = None
    section_id: Optional[int] = None
    subject_id: Optional[int] = None
    period_no: Optional[int] = None


class AttendanceUpdate(BaseModel):
    status: Optional[str] = None
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    notes: Optional[str] = None


class AttendanceOut(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_email: str
    department: Optional[str]
    date: date
    status: str
    check_in: Optional[datetime]
    check_out: Optional[datetime]
    notes: Optional[str]
    duration_hours: Optional[float]
    section_id: Optional[int] = None
    subject_id: Optional[int] = None
    period_no: Optional[int] = None
    marked_by: Optional[int] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class TodaySummary(BaseModel):
    total_users: int
    present: int
    absent: int
    late: int
    half_day: int
    not_marked: int
    attendance_rate: float


class BulkAttendanceItem(BaseModel):
    user_id: int
    status: str = "present"
    notes: Optional[str] = None


class BulkAttendanceMark(BaseModel):
    section_id: int
    date: Optional[date] = None
    subject_id: Optional[int] = None
    period_no: Optional[int] = None
    records: List[BulkAttendanceItem]


class BulkAttendanceOut(BaseModel):
    marked: int
    skipped: int
    errors: List[str]


# ── Analytics ─────────────────────────────────────────────────────────────────

class KPIResponse(BaseModel):
    total_users: int
    present_today: int
    attendance_rate: float
    ai_insights_count: int
    weekly_change: float
    monthly_change: float


class TrendPoint(BaseModel):
    date: str
    present: int
    late: int
    absent: int
    rate: float


class TrendResponse(BaseModel):
    trends: List[TrendPoint]
    avg_rate: float
    period_days: int


class DepartmentStat(BaseModel):
    department: str
    total_records: int
    present: int
    late: int
    absent: int
    rate: float


class UserPerformance(BaseModel):
    user_id: int
    name: str
    department: Optional[str]
    present: int
    late: int
    absent: int
    total: int
    rate: float


# ── AI Insights ───────────────────────────────────────────────────────────────

class InsightOut(BaseModel):
    id: int
    insight_type: str
    title: str
    description: str
    severity: str
    insight_meta: Optional[Any]
    is_read: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class InsightsResponse(BaseModel):
    insights: List[InsightOut]
    total: int
    unread: int
    summary: str
    mcp_context: dict


# ── Activity Logs ─────────────────────────────────────────────────────────────

class LogOut(BaseModel):
    id: int
    user_id: int
    user_name: str
    action: str
    resource: Optional[str]
    details: Optional[Any]
    ip_address: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Structure Hierarchy ───────────────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    head_user_id: Optional[int] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    head_user_id: Optional[int] = None
    is_active: Optional[bool] = None


class DepartmentOut(BaseModel):
    id: int
    organization_id: int
    name: str
    code: str
    description: Optional[str]
    head_user_id: Optional[int]
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class ClassCreate(BaseModel):
    department_id: int
    name: str
    grade_level: Optional[int] = None
    academic_year: Optional[str] = None


class ClassUpdate(BaseModel):
    department_id: Optional[int] = None
    name: Optional[str] = None
    grade_level: Optional[int] = None
    academic_year: Optional[str] = None
    is_active: Optional[bool] = None


class ClassOut(BaseModel):
    id: int
    organization_id: int
    department_id: int
    name: str
    grade_level: Optional[int]
    academic_year: Optional[str]
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class SectionCreate(BaseModel):
    class_id: int
    name: str
    capacity: Optional[int] = None
    room_no: Optional[str] = None
    primary_teacher_id: Optional[int] = None


class SectionUpdate(BaseModel):
    class_id: Optional[int] = None
    name: Optional[str] = None
    capacity: Optional[int] = None
    room_no: Optional[str] = None
    primary_teacher_id: Optional[int] = None
    is_active: Optional[bool] = None


class SectionOut(BaseModel):
    id: int
    organization_id: int
    class_id: int
    name: str
    capacity: Optional[int]
    room_no: Optional[str]
    primary_teacher_id: Optional[int]
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class SectionDetail(SectionOut):
    student_count: int = 0


class ClassWithSections(ClassOut):
    sections: List[SectionOut] = []


class SubjectCreate(BaseModel):
    department_id: Optional[int] = None
    name: str
    code: str
    subject_type: str = "theory"


class SubjectUpdate(BaseModel):
    department_id: Optional[int] = None
    name: Optional[str] = None
    code: Optional[str] = None
    subject_type: Optional[str] = None
    is_active: Optional[bool] = None


class SubjectOut(BaseModel):
    id: int
    organization_id: int
    department_id: Optional[int]
    name: str
    code: str
    subject_type: str
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Students ──────────────────────────────────────────────────────────────────

class StudentCreate(BaseModel):
    section_id: int
    name: str
    email: EmailStr
    password: str
    enrollment_no: str
    roll_no: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_email: Optional[str] = None
    address: Optional[str] = None
    admission_date: Optional[date] = None


class StudentUpdate(BaseModel):
    section_id: Optional[int] = None
    name: Optional[str] = None
    enrollment_no: Optional[str] = None
    roll_no: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_email: Optional[str] = None
    address: Optional[str] = None
    admission_date: Optional[date] = None
    is_active: Optional[bool] = None


class StudentOut(BaseModel):
    id: int
    user_id: int
    organization_id: int
    section_id: int
    name: Optional[str] = None
    email: Optional[str] = None
    enrollment_no: str
    roll_no: Optional[str]
    date_of_birth: Optional[date]
    gender: Optional[str]
    guardian_name: Optional[str]
    guardian_phone: Optional[str]
    guardian_email: Optional[str]
    address: Optional[str]
    admission_date: Optional[date]
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class StudentListItem(BaseModel):
    student_id: int
    user_id: int
    name: str
    email: str
    roll_no: Optional[str]
    enrollment_no: str
    section_id: int


# ── Section Teacher Assignment ────────────────────────────────────────────────

class SectionTeacherAssign(BaseModel):
    user_id: int
    subject_id: Optional[int] = None
    is_primary: bool = False


class SectionTeacherOut(BaseModel):
    id: int
    section_id: int
    user_id: int
    subject_id: Optional[int]
    is_primary: bool
    teacher_name: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}
