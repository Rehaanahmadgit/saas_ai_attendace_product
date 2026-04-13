"""
models.py — Extended for multi-tenant School + Office SaaS
Safe migration: only ADD new tables/columns, never drop existing ones.
"""
from datetime import datetime, date
from typing import Optional
from sqlalchemy import (
    BigInteger, Integer, SmallInteger, String, Text, Boolean,
    DateTime, Date, Time, JSON, ForeignKey, Index, UniqueConstraint, Enum,
)

from sqlalchemy import Column, Integer, String, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
import enum

from app.database import Base


# ─────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────

class OrgType(str, enum.Enum):
    school  = "school"
    office  = "office"
    college = "college"

class UserType(str, enum.Enum):
    staff   = "staff"    # employee / teacher / admin
    student = "student"

class AttendanceStatus(str, enum.Enum):
    present  = "present"
    absent   = "absent"
    late     = "late"
    half_day = "half_day"
    holiday  = "holiday"
    excused  = "excused"


# ─────────────────────────────────────────────
# EXISTING TABLE — extended with new columns
# ─────────────────────────────────────────────

class Organization(Base):
    __tablename__ = "organizations"

    id         : Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    name       : Mapped[str]           = mapped_column(String(100), nullable=False)
    plan       : Mapped[str]           = mapped_column(String(20), default="free")
    # NEW ↓
    org_type   : Mapped[str]           = mapped_column(String(20), default=OrgType.office.value)
    address    : Mapped[Optional[str]] = mapped_column(String(255))
    logo_url   : Mapped[Optional[str]] = mapped_column(String(500))
    settings   : Mapped[Optional[dict]]= mapped_column(JSON)          # late_threshold, timezone, etc.
    is_active  : Mapped[bool]          = mapped_column(Boolean, default=True)
    created_at : Mapped[datetime]      = mapped_column(DateTime(timezone=True), server_default=func.now())

import enum as python_enum
from sqlalchemy import Enum as SAEnum

class UserRole(str, python_enum.Enum):
       super_admin = "super_admin"
       admin       = "admin"
       staff       = "staff"
       user        = "user"

class OrgUser(Base):
    """Staff, teachers, admins — everyone who logs in."""
    __tablename__ = "org_users"
    __table_args__ = (
        Index("ix_org_users_email", "email"),
        Index("ix_org_users_org",   "organization_id"),
    )

    id              : Mapped[int]           = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    organization_id : Mapped[int]           = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name            : Mapped[str]           = mapped_column(String(100), nullable=False)
    email           : Mapped[str]           = mapped_column(String(100), unique=True, nullable=False)
    password_hash   : Mapped[str]           = mapped_column(Text, nullable=False)
    role = Column(SAEnum(UserRole, name="user_role_enum", create_constraint=True), default=UserRole.user, nullable=False)
    department      : Mapped[Optional[str]] = mapped_column(String(50))
    is_active       : Mapped[bool]          = mapped_column(Boolean, default=True)
    created_at      : Mapped[datetime]      = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login      : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # NEW ↓
    user_type       : Mapped[str]           = mapped_column(String(20), default=UserType.staff)
    phone           : Mapped[Optional[str]] = mapped_column(String(20))
    employee_id     : Mapped[Optional[str]] = mapped_column(String(50))  # staff/teacher ID
    department_id   : Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("departments.id", ondelete="SET NULL"))
    profile_meta    : Mapped[Optional[dict]]= mapped_column(JSON)        # extra fields per org_type

    @property
    def role_str(self) -> str:
        """Safely extract role as plain string from OrgUser (handles Enum or str)."""
        r = self.role
        return r.value if hasattr(r, "value") else str(r)


class Role(Base):
    """Organization-scoped role definitions for dynamic RBAC."""
    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_role_org_name"),
        Index("ix_role_org", "organization_id"),
    )

    id              : Mapped[int]  = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id : Mapped[int]  = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name            : Mapped[str]  = mapped_column(String(30), nullable=False)
    label           : Mapped[Optional[str]] = mapped_column(String(100))
    level           : Mapped[int]  = mapped_column(Integer, default=1)
    description     : Mapped[Optional[str]] = mapped_column(String(255))
    created_at      : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (
        Index("ix_att_user_date", "user_id", "date", unique=True),
        Index("ix_att_org_date",  "organization_id", "date"),
        # NEW indexes ↓
        Index("ix_att_section",   "section_id", "date"),
        Index("ix_att_subject",   "subject_id", "date"),
    )

    id              : Mapped[int]             = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id         : Mapped[int]             = mapped_column(BigInteger, ForeignKey("org_users.id", ondelete="CASCADE"), nullable=False)
    organization_id : Mapped[int]             = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    date            : Mapped[date]            = mapped_column(Date, nullable=False)
    status          : Mapped[str]             = mapped_column(String(20), nullable=False)
    check_in        : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    check_out       : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    notes           : Mapped[Optional[str]]   = mapped_column(Text)
    created_at      : Mapped[datetime]        = mapped_column(DateTime(timezone=True), server_default=func.now())
    # NEW ↓
    section_id      : Mapped[Optional[int]]   = mapped_column(Integer, ForeignKey("sections.id", ondelete="SET NULL"))
    subject_id      : Mapped[Optional[int]]   = mapped_column(Integer, ForeignKey("subjects.id",  ondelete="SET NULL"))
    marked_by       : Mapped[Optional[int]]   = mapped_column(BigInteger, ForeignKey("org_users.id", ondelete="SET NULL"))
    period_no       : Mapped[Optional[int]]   = mapped_column(SmallInteger)   # for subject-wise attendance


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    __table_args__ = (Index("ix_logs_org_created", "organization_id", "created_at"),)

    id              : Mapped[int]           = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id         : Mapped[int]           = mapped_column(BigInteger, ForeignKey("org_users.id", ondelete="CASCADE"), nullable=False)
    organization_id : Mapped[int]           = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    action          : Mapped[str]           = mapped_column(String(100), nullable=False)
    resource        : Mapped[Optional[str]] = mapped_column(String(100))
    details         : Mapped[Optional[dict]]= mapped_column(JSON)
    ip_address      : Mapped[Optional[str]] = mapped_column(String(45))
    created_at      : Mapped[datetime]      = mapped_column(DateTime(timezone=True), server_default=func.now())


class AIInsight(Base):
    __tablename__ = "ai_insights"

    id              : Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id : Mapped[int]           = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    insight_type    : Mapped[str]           = mapped_column(String(50), nullable=False)
    title           : Mapped[str]           = mapped_column(String(200), nullable=False)
    description     : Mapped[str]           = mapped_column(Text, nullable=False)
    severity        : Mapped[str]           = mapped_column(String(20), default="info")
    insight_meta    : Mapped[Optional[dict]]= mapped_column(JSON)
    is_read         : Mapped[bool]          = mapped_column(Boolean, default=False)
    created_at      : Mapped[datetime]      = mapped_column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────
# NEW TABLES — Structure hierarchy
# ─────────────────────────────────────────────

class Department(Base):
    """Works for both schools (Science dept) and offices (Engineering team)."""
    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_dept_org_code"),
        Index("ix_dept_org", "organization_id"),
    )

    id              : Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id : Mapped[int]           = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name            : Mapped[str]           = mapped_column(String(100), nullable=False)
    code            : Mapped[str]           = mapped_column(String(20), nullable=False)   # e.g. "CS", "HR"
    description     : Mapped[Optional[str]] = mapped_column(Text)
    head_user_id    : Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("org_users.id", ondelete="SET NULL"))
    is_active       : Mapped[bool]          = mapped_column(Boolean, default=True)
    created_at      : Mapped[datetime]      = mapped_column(DateTime(timezone=True), server_default=func.now())


class Class(Base):
    """
    For schools: Class 10, Class 11 (linked to department = Science/Commerce).
    For offices: Team / Project group (linked to department).
    """
    __tablename__ = "classes"
    __table_args__ = (
        UniqueConstraint("organization_id", "department_id", "name", name="uq_class_org_dept"),
        Index("ix_class_org", "organization_id"),
        Index("ix_class_dept", "department_id"),
    )

    id              : Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id : Mapped[int]           = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    department_id   : Mapped[int]           = mapped_column(Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    name            : Mapped[str]           = mapped_column(String(50), nullable=False)    # "10th Grade", "Backend Team"
    grade_level     : Mapped[Optional[int]] = mapped_column(SmallInteger)                  # schools only
    academic_year   : Mapped[Optional[str]] = mapped_column(String(20))                    # "2024-25"
    is_active       : Mapped[bool]          = mapped_column(Boolean, default=True)
    created_at      : Mapped[datetime]      = mapped_column(DateTime(timezone=True), server_default=func.now())


class Section(Base):
    """
    For schools: Section A, B, C of Class 10.
    For offices: Sub-team / shift.
    """
    __tablename__ = "sections"
    __table_args__ = (
        UniqueConstraint("class_id", "name", name="uq_section_class"),
        Index("ix_section_class", "class_id"),
        Index("ix_section_org",   "organization_id"),
    )

    id              : Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id : Mapped[int]           = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    class_id        : Mapped[int]           = mapped_column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    name            : Mapped[str]           = mapped_column(String(20), nullable=False)    # "A", "B", "Morning Shift"
    capacity        : Mapped[Optional[int]] = mapped_column(SmallInteger)
    room_no         : Mapped[Optional[str]] = mapped_column(String(20))
    primary_teacher_id : Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("org_users.id", ondelete="SET NULL"))
    is_active       : Mapped[bool]          = mapped_column(Boolean, default=True)
    created_at      : Mapped[datetime]      = mapped_column(DateTime(timezone=True), server_default=func.now())


class Subject(Base):
    """Subjects/courses taught in sections. Optional for office orgs."""
    __tablename__ = "subjects"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_subject_org_code"),
        Index("ix_subject_org",  "organization_id"),
        Index("ix_subject_dept", "department_id"),
    )

    id              : Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id : Mapped[int]           = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    department_id   : Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("departments.id", ondelete="SET NULL"))
    name            : Mapped[str]           = mapped_column(String(100), nullable=False)
    code            : Mapped[str]           = mapped_column(String(20), nullable=False)
    subject_type    : Mapped[str]           = mapped_column(String(20), default="theory")  # theory | practical | elective
    is_active       : Mapped[bool]          = mapped_column(Boolean, default=True)
    created_at      : Mapped[datetime]      = mapped_column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────
# NEW TABLES — People
# ─────────────────────────────────────────────

class Student(Base):
    """
    Extended profile for student users.
    Every student also has an OrgUser record (for login / attendance).
    """
    __tablename__ = "students"
    __table_args__ = (
        UniqueConstraint("section_id", "roll_no", name="uq_student_roll"),
        UniqueConstraint("organization_id", "enrollment_no", name="uq_student_enrollment"),
        Index("ix_student_section", "section_id"),
        Index("ix_student_org",     "organization_id"),
    )

    id              : Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id         : Mapped[int]           = mapped_column(BigInteger, ForeignKey("org_users.id", ondelete="CASCADE"), unique=True, nullable=False)
    organization_id : Mapped[int]           = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    section_id      : Mapped[int]           = mapped_column(Integer, ForeignKey("sections.id", ondelete="RESTRICT"), nullable=False)
    roll_no         : Mapped[Optional[str]] = mapped_column(String(20))
    enrollment_no   : Mapped[str]           = mapped_column(String(50), nullable=False)
    date_of_birth   : Mapped[Optional[date]]= mapped_column(Date)
    gender          : Mapped[Optional[str]] = mapped_column(String(10))
    guardian_name   : Mapped[Optional[str]] = mapped_column(String(100))
    guardian_phone  : Mapped[Optional[str]] = mapped_column(String(20))
    guardian_email  : Mapped[Optional[str]] = mapped_column(String(100))
    address         : Mapped[Optional[str]] = mapped_column(Text)
    admission_date  : Mapped[Optional[date]]= mapped_column(Date)
    is_active       : Mapped[bool]          = mapped_column(Boolean, default=True)
    created_at      : Mapped[datetime]      = mapped_column(DateTime(timezone=True), server_default=func.now())


class SectionTeacher(Base):
    """Which teacher teaches which subject in which section."""
    __tablename__ = "section_teachers"
    __table_args__ = (
        UniqueConstraint("section_id", "subject_id", "user_id", name="uq_section_teacher_subject"),
        Index("ix_secteacher_user",    "user_id"),
        Index("ix_secteacher_section", "section_id"),
    )

    id         : Mapped[int]  = mapped_column(Integer, primary_key=True, autoincrement=True)
    section_id : Mapped[int]  = mapped_column(Integer, ForeignKey("sections.id", ondelete="CASCADE"), nullable=False)
    user_id    : Mapped[int]  = mapped_column(BigInteger, ForeignKey("org_users.id", ondelete="CASCADE"), nullable=False)
    subject_id : Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"))
    is_primary : Mapped[bool] = mapped_column(Boolean, default=False)   # class teacher / homeroom
    created_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────
# NEW TABLE — RBAC Permissions
# ─────────────────────────────────────────────

class RolePermission(Base):
    """
    Fine-grained RBAC per organization.
    SuperAdmin can customise per-role permissions beyond the defaults.
    """
    __tablename__ = "role_permissions"
    __table_args__ = (
        UniqueConstraint("organization_id", "role", "resource", name="uq_perm_org_role_resource"),
        Index("ix_perm_org_role", "organization_id", "role"),
    )

    id              : Mapped[int]  = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id : Mapped[int]  = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    role            : Mapped[str]  = mapped_column(String(30), nullable=False)
    resource        : Mapped[str]  = mapped_column(String(50), nullable=False)  # "attendance", "students", "analytics"...
    can_view        : Mapped[bool] = mapped_column(Boolean, default=False)
    can_create      : Mapped[bool] = mapped_column(Boolean, default=False)
    can_edit        : Mapped[bool] = mapped_column(Boolean, default=False)
    can_delete      : Mapped[bool] = mapped_column(Boolean, default=False)
    scope           : Mapped[str]  = mapped_column(String(20), default="org")   # "org" | "section" | "self"
    created_at      : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at      : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ─────────────────────────────────────────────
# NEW TABLE — Onboarding wizard tracking
# ─────────────────────────────────────────────

class OnboardingStatus(Base):
    """
    Tracks setup wizard progress for each organization.
    Created automatically when a new org registers.
    Each step is set to True when the corresponding action is performed.
    """
    __tablename__ = "onboarding_status"
    __table_args__ = (
        Index("ix_onboarding_org", "organization_id"),
    )

    id                  : Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id     : Mapped[int]            = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), unique=True, nullable=False)
    org_type_set        : Mapped[bool]           = mapped_column(Boolean, default=False)
    department_added    : Mapped[bool]           = mapped_column(Boolean, default=False)
    class_added         : Mapped[bool]           = mapped_column(Boolean, default=False)
    section_added       : Mapped[bool]           = mapped_column(Boolean, default=False)
    first_user_invited  : Mapped[bool]           = mapped_column(Boolean, default=False)
    completed           : Mapped[bool]           = mapped_column(Boolean, default=False)
    completed_at        : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at          : Mapped[datetime]       = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at          : Mapped[datetime]       = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())