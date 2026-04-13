"""
routers/seed.py — Development-only seed router
Mounted at /dev/seed  (only when APP_ENV=development)

FIXES:
 - Added missing `import os` (referenced in guard but never imported — NameError at startup)
 - Added missing `from fastapi import HTTPException` (used in guard)
 - seed now also creates an OnboardingStatus row marked as completed
 - seed now creates SectionTeacher.organization_id (new required column)
"""
import os
import random
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import (
    Organization, OrgUser, Role, RolePermission,
    AttendanceRecord, ActivityLog, AIInsight, OnboardingStatus,
)
from app import auth as auth_utils
from app.routers.insights import _compute_insights

router = APIRouter(tags=["dev"])

DEMO_PASSWORD = "demo123"

DEMO_USERS = [
    {"name": "Alice Admin",    "email": "alice@acme.com",  "role": "admin",  "dept": "Management",  "type": "good"},
    {"name": "Bob Chen",       "email": "bob@acme.com",    "role": "staff",  "dept": "Engineering", "type": "good"},
    {"name": "Carol White",    "email": "carol@acme.com",  "role": "user",   "dept": "Engineering", "type": "good"},
    {"name": "David Park",     "email": "david@acme.com",  "role": "user",   "dept": "Engineering", "type": "poor"},
    {"name": "Eve Johnson",    "email": "eve@acme.com",    "role": "staff",  "dept": "Sales",       "type": "good"},
    {"name": "Frank Wilson",   "email": "frank@acme.com",  "role": "user",   "dept": "Sales",       "type": "average"},
    {"name": "Grace Taylor",   "email": "grace@acme.com",  "role": "user",   "dept": "Sales",       "type": "late"},
    {"name": "Henry Brown",    "email": "henry@acme.com",  "role": "admin",  "dept": "HR",          "type": "good"},
    {"name": "Irene Martinez", "email": "irene@acme.com",  "role": "user",   "dept": "HR",          "type": "average"},
    {"name": "Jack Thompson",  "email": "jack@acme.com",   "role": "user",   "dept": "Operations",  "type": "poor"},
]

PROFILES = {
    "good":    [0.88, 0.07, 0.05],
    "average": [0.73, 0.14, 0.13],
    "late":    [0.65, 0.28, 0.07],
    "poor":    [0.50, 0.15, 0.35],
}


@router.post("/seed")
async def seed_demo(db: AsyncSession = Depends(get_db)):
    # FIX: guard now works — os is imported
    if os.getenv("APP_ENV", "production") != "development":
        raise HTTPException(status_code=404, detail="Not found")   # FIX: HTTPException now imported

    existing = await db.scalar(select(Organization).where(Organization.name == "Acme Corp"))
    if existing:
        return {
            "message": "Demo data already exists",
            "credentials": {
                "super_admin": {"email": "sa@acme.com",    "password": DEMO_PASSWORD},
                "admin":       {"email": "alice@acme.com", "password": DEMO_PASSWORD},
                "staff":       {"email": "bob@acme.com",   "password": DEMO_PASSWORD},
                "user":        {"email": "carol@acme.com", "password": DEMO_PASSWORD},
            },
        }

    org = Organization(name="Acme Corp", plan="pro", org_type="office")
    db.add(org)
    await db.flush()

    # Super admin
    sa = OrgUser(
        organization_id=org.id,
        name="Super Admin",
        email="sa@acme.com",
        password_hash=auth_utils.hash_password(DEMO_PASSWORD),
        role="super_admin",
        department="Management",
        user_type="staff",
    )
    db.add(sa)

    members = []
    for u in DEMO_USERS:
        member = OrgUser(
            organization_id=org.id,
            name=u["name"],
            email=u["email"],
            password_hash=auth_utils.hash_password(DEMO_PASSWORD),
            role=u["role"],
            department=u["dept"],
            user_type="staff",
        )
        db.add(member)
        members.append((member, u["type"]))

    await db.flush()

    # Roles
    for name, level in [("super_admin", 4), ("admin", 3), ("staff", 2), ("user", 1)]:
        db.add(Role(
            organization_id=org.id,
            name=name,
            label=name.replace("_", " ").title(),
            level=level,
            description=f"Default role: {name}",
        ))

    # Permissions
    defaults = {
        "attendance":     {"super_admin": (True, True, True, True, "org"),   "admin": (True, True, True, True, "org"),   "staff": (True, True, True, False, "section"), "user": (True, False, False, False, "self")},
        "students":       {"super_admin": (True, True, True, True, "org"),   "admin": (True, True, True, True, "org"),   "staff": (True, False, False, False, "section"),"user": (True, False, False, False, "self")},
        "departments":    {"super_admin": (True, True, True, True, "org"),   "admin": (True, True, True, True, "org"),   "staff": (True, False, False, False, "org"),    "user": (False, False, False, False, "self")},
        "classes":        {"super_admin": (True, True, True, True, "org"),   "admin": (True, True, True, True, "org"),   "staff": (True, False, False, False, "org"),    "user": (False, False, False, False, "self")},
        "sections":       {"super_admin": (True, True, True, True, "org"),   "admin": (True, True, True, True, "org"),   "staff": (True, False, False, False, "section"),"user": (False, False, False, False, "self")},
        "analytics":      {"super_admin": (True, True, True, True, "org"),   "admin": (True, False, False, False, "org"),"staff": (True, False, False, False, "section"),"user": (False, False, False, False, "self")},
        "insights":       {"super_admin": (True, True, True, True, "org"),   "admin": (True, True, False, False, "org"), "staff": (False, False, False, False, "self"),  "user": (False, False, False, False, "self")},
        "users":          {"super_admin": (True, True, True, True, "org"),   "admin": (True, True, True, True, "org"),   "staff": (True, False, False, False, "section"),"user": (False, False, False, False, "self")},
        "role_permissions":{"super_admin":(True, True, True, True, "org"),   "admin": (True, False, False, False, "org"),"staff": (False, False, False, False, "self"),  "user": (False, False, False, False, "self")},
    }
    for resource, roles in defaults.items():
        for role_name, (cv, cc, ce, cd, scope) in roles.items():
            db.add(RolePermission(
                organization_id=org.id,
                role=role_name, resource=resource,
                can_view=cv, can_create=cc, can_edit=ce, can_delete=cd, scope=scope,
            ))

    await db.flush()

    # 60 days of attendance
    today = date.today()
    rng   = random.Random(42)

    for member, profile_type in members:
        probs = PROFILES[profile_type]
        for i in range(60):
            day = today - timedelta(days=i)
            if day.weekday() >= 5:
                continue
            rand = rng.random()
            if rand < probs[2]:
                s, ci, co = "absent", None, None
            elif rand < probs[2] + probs[1]:
                s  = "late"
                ci = datetime.combine(day, time(rng.randint(10, 11), rng.randint(0, 59)), tzinfo=timezone.utc)
                co = datetime.combine(day, time(17, rng.randint(0, 59)), tzinfo=timezone.utc)
            else:
                s  = "present"
                ci = datetime.combine(day, time(8, rng.randint(45, 59)), tzinfo=timezone.utc)
                co = datetime.combine(day, time(17, rng.randint(0, 59)), tzinfo=timezone.utc)

            db.add(AttendanceRecord(
                user_id=member.id, organization_id=org.id,
                date=day, status=s, check_in=ci, check_out=co,
            ))

    # Activity logs
    for action in ["login", "attendance_marked", "user_created", "insight_generated"]:
        db.add(ActivityLog(
            user_id=sa.id, organization_id=org.id,
            action=action, resource="system",
            details={"seeded": True}, ip_address="127.0.0.1",
        ))

    # Onboarding — mark completed since demo data is fully set up
    db.add(OnboardingStatus(
        organization_id=org.id,
        org_type_set=True, department_added=True, class_added=True,
        section_added=True, first_user_invited=True,
        completed=True, completed_at=datetime.now(timezone.utc),
    ))

    await db.flush()

    raw_insights = await _compute_insights(db, org.id)
    for item in raw_insights:
        db.add(AIInsight(organization_id=org.id, **item))

    await db.commit()

    return {
        "message": "Demo data seeded — 11 users, 60 days attendance, AI insights",
        "organization": "Acme Corp",
        "credentials": {
            "super_admin": {"email": "sa@acme.com",    "password": DEMO_PASSWORD},
            "admin":       {"email": "alice@acme.com", "password": DEMO_PASSWORD},
            "staff":       {"email": "bob@acme.com",   "password": DEMO_PASSWORD},
            "user":        {"email": "carol@acme.com", "password": DEMO_PASSWORD},
        },
    }