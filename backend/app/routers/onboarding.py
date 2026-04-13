"""
onboarding.py — Setup wizard status for new organisations
Mounted at /api/onboarding

FLOWS:
  1. POST /api/auth/register → creates org + super_admin + OnboardingStatus(all False)
  2. PATCH /api/auth/org-settings  → sets org_type_set = True
  3. POST /api/structure/departments → sets department_added = True
  4. POST /api/structure/classes     → sets class_added = True
  5. POST /api/structure/sections    → sets section_added = True
  6. POST /api/users                 → sets first_user_invited = True
  7. When all flags True → completed = True, completed_at = now()

Endpoints:
  GET  /api/onboarding/status          → current wizard progress
  GET  /api/onboarding/checklist       → alias for /status (frontend compatibility)
  POST /api/onboarding/setup           → one-shot org setup
  POST /api/onboarding/seed-defaults   → seed default roles & permissions
  POST /api/onboarding/complete        → force-mark onboarding complete
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.models import (
    OnboardingStatus, Organization, OrgUser,
    Department, Class, Section,
)
from app.dependencies import get_current_user, require_min_role
from app import auth as auth_utils

router = APIRouter(tags=["onboarding"])

AdminOrAbove = Depends(require_min_role("admin"))
AnyRole      = Depends(get_current_user)


# ── Schemas ────────────────────────────────────────────────────────────────────

class OnboardingOut(BaseModel):
    organization_id:    int
    org_type_set:       bool
    department_added:   bool
    class_added:        bool
    section_added:      bool
    first_user_invited: bool
    completed:          bool
    completed_at:       datetime | None
    next_step:          str
    progress_pct:       int

    model_config = {"from_attributes": True}


class SetupRequest(BaseModel):
    """One-shot onboarding payload — creates initial org structure."""
    org_type:         Optional[str] = None
    department_name:  Optional[str] = None
    department_code:  Optional[str] = None
    class_name:       Optional[str] = None
    section_name:     Optional[str] = None
    staff_name:       Optional[str] = None
    staff_email:      Optional[EmailStr] = None
    staff_password:   Optional[str] = None
    staff_role:       Optional[str] = "staff"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _compute_next_step(row: OnboardingStatus) -> str:
    if not row.org_type_set:
        return "set_org_type"
    if not row.department_added:
        return "add_department"
    if not row.class_added:
        return "add_class"
    if not row.section_added:
        return "add_section"
    if not row.first_user_invited:
        return "invite_user"
    return "completed"


def _compute_progress(row: OnboardingStatus) -> int:
    steps = [
        row.org_type_set,
        row.department_added,
        row.class_added,
        row.section_added,
        row.first_user_invited,
    ]
    done = sum(1 for s in steps if s)
    return round(done / len(steps) * 100)


def _build_out(row: OnboardingStatus) -> OnboardingOut:
    return OnboardingOut(
        organization_id=row.organization_id,
        org_type_set=row.org_type_set,
        department_added=row.department_added,
        class_added=row.class_added,
        section_added=row.section_added,
        first_user_invited=row.first_user_invited,
        completed=row.completed,
        completed_at=row.completed_at,
        next_step=_compute_next_step(row),
        progress_pct=_compute_progress(row),
    )


async def _get_or_create_onboarding(org_id: int, db: AsyncSession) -> OnboardingStatus:
    row = await db.scalar(
        select(OnboardingStatus).where(OnboardingStatus.organization_id == org_id)
    )
    if not row:
        row = OnboardingStatus(organization_id=org_id)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


def _check_all_done(row: OnboardingStatus) -> bool:
    return all([
        row.org_type_set,
        row.department_added,
        row.class_added,
        row.section_added,
        row.first_user_invited,
    ])


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/status", response_model=OnboardingOut)
async def get_onboarding_status(
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    """Returns the onboarding progress for the user's organisation."""
    row = await _get_or_create_onboarding(current_user.organization_id, db)
    return _build_out(row)


@router.get("/checklist", response_model=OnboardingOut)
async def get_checklist(
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    """Alias for /status — frontend compatibility."""
    row = await _get_or_create_onboarding(current_user.organization_id, db)
    return _build_out(row)


@router.post("/setup", status_code=200)
async def setup_onboarding(
    data: SetupRequest,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    """
    One-shot setup: creates org structure from a single payload.
    Creates department → class → section (and optionally an initial staff user).
    Each field is optional — only creates what is provided.
    """
    org_id = current_user.organization_id
    row = await _get_or_create_onboarding(org_id, db)
    created = {}

    # Update org type
    if data.org_type:
        org = await db.scalar(select(Organization).where(Organization.id == org_id))
        if org:
            org.org_type = data.org_type
            row.org_type_set = True
            created["org_type"] = data.org_type

    # Create department
    dept = None
    if data.department_name and data.department_code:
        from app.models import Department
        existing_dept = await db.scalar(
            select(Department).where(
                Department.organization_id == org_id,
                Department.code == data.department_code.upper(),
            )
        )
        if not existing_dept:
            dept = Department(
                organization_id=org_id,
                name=data.department_name,
                code=data.department_code.upper(),
            )
            db.add(dept)
            await db.flush()
            row.department_added = True
            created["department"] = dept.name
        else:
            dept = existing_dept
            row.department_added = True

    # Create class
    klass = None
    if data.class_name and dept:
        from app.models import Class
        existing_class = await db.scalar(
            select(Class).where(
                Class.organization_id == org_id,
                Class.department_id == dept.id,
                Class.name == data.class_name,
            )
        )
        if not existing_class:
            klass = Class(
                organization_id=org_id,
                department_id=dept.id,
                name=data.class_name,
            )
            db.add(klass)
            await db.flush()
            row.class_added = True
            created["class"] = klass.name
        else:
            klass = existing_class
            row.class_added = True

    # Create section
    if data.section_name and klass:
        from app.models import Section
        existing_section = await db.scalar(
            select(Section).where(
                Section.organization_id == org_id,
                Section.class_id == klass.id,
                Section.name == data.section_name,
            )
        )
        if not existing_section:
            section = Section(
                organization_id=org_id,
                class_id=klass.id,
                name=data.section_name,
            )
            db.add(section)
            await db.flush()
            row.section_added = True
            created["section"] = section.name

    # Create initial staff user
    if data.staff_email and data.staff_name and data.staff_password:
        email = data.staff_email.lower()
        existing_user = await db.scalar(select(OrgUser).where(OrgUser.email == email))
        if not existing_user:
            staff = OrgUser(
                organization_id=org_id,
                name=data.staff_name,
                email=email,
                password_hash=auth_utils.hash_password(data.staff_password),
                role=data.staff_role or "staff",
                user_type="staff",
            )
            db.add(staff)
            await db.flush()
            row.first_user_invited = True
            created["staff_user"] = data.staff_name

    # Check completion
    if _check_all_done(row):
        row.completed = True
        row.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(row)

    return {
        "ok": True,
        "created": created,
        "onboarding": _build_out(row),
    }


@router.post("/seed-defaults", status_code=200)
async def seed_defaults(
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    """
    Seeds default roles and permissions for the organisation.
    Safe to call multiple times — skips already-existing entries.
    """
    from app.rbac_utils import seed_org_defaults
    result = await seed_org_defaults(current_user.organization_id, current_user.id, db)
    await db.commit()
    return {"ok": True, **result}


@router.post("/complete", status_code=200)
async def force_complete_onboarding(
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    """Allows admins to manually mark onboarding as complete."""
    row = await db.scalar(
        select(OnboardingStatus).where(
            OnboardingStatus.organization_id == current_user.organization_id
        )
    )
    if not row:
        raise HTTPException(404, "Onboarding record not found")

    row.org_type_set       = True
    row.department_added   = True
    row.class_added        = True
    row.section_added      = True
    row.first_user_invited = True
    row.completed          = True
    row.completed_at       = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "message": "Onboarding marked as complete"}
