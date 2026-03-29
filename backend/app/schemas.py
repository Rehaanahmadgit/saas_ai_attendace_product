from datetime import datetime, date
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, field_validator


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    organization_name: str

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
    department: Optional[str]
    organization_id: int
    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserOut


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


# ── Attendance ────────────────────────────────────────────────────────────────

class AttendanceMark(BaseModel):
    user_id: Optional[int] = None        # if None, mark for current user
    date: Optional[date] = None          # if None, use today
    status: Optional[str] = None         # if None, auto-detect from check_in time
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


# ── Analytics ─────────────────────────────────────────────────────────────────

class KPIResponse(BaseModel):
    total_users: int
    present_today: int
    attendance_rate: float
    ai_insights_count: int
    weekly_change: float     # percentage change vs last week
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
    """
    MCP-READY response structure.
    AI agents / MCP tools can parse this directly for natural-language queries.
    """
    insights: List[InsightOut]
    total: int
    unread: int
    summary: str                           # human-readable summary
    mcp_context: dict                      # hints for AI agent consumption


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
