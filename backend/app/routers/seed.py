"""
Development-only seed router.
Creates a full demo organization with realistic attendance data.
"""
import random
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Organization, OrgUser, AttendanceRecord, ActivityLog, AIInsight
from app import auth as auth_utils
from app.routers.insights import _compute_insights

router = APIRouter(tags=["dev"])

DEMO_PASSWORD = "demo123"

DEMO_USERS = [
    {"name": "Alice Admin",      "email": "alice@acme.com",   "role": "admin",  "dept": "Management",  "type": "good"},
    {"name": "Bob Chen",         "email": "bob@acme.com",     "role": "staff",  "dept": "Engineering", "type": "good"},
    {"name": "Carol White",      "email": "carol@acme.com",   "role": "user",   "dept": "Engineering", "type": "good"},
    {"name": "David Park",       "email": "david@acme.com",   "role": "user",   "dept": "Engineering", "type": "poor"},
    {"name": "Eve Johnson",      "email": "eve@acme.com",     "role": "staff",  "dept": "Sales",       "type": "good"},
    {"name": "Frank Wilson",     "email": "frank@acme.com",   "role": "user",   "dept": "Sales",       "type": "average"},
    {"name": "Grace Taylor",     "email": "grace@acme.com",   "role": "user",   "dept": "Sales",       "type": "late"},  # frequent late
    {"name": "Henry Brown",      "email": "henry@acme.com",   "role": "admin",  "dept": "HR",          "type": "good"},
    {"name": "Irene Martinez",   "email": "irene@acme.com",   "role": "user",   "dept": "HR",          "type": "average"},
    {"name": "Jack Thompson",    "email": "jack@acme.com",    "role": "user",   "dept": "Operations",  "type": "poor"},
]

# Probabilities: [present, late, absent]
PROFILES = {
    "good":    [0.88, 0.07, 0.05],
    "average": [0.73, 0.14, 0.13],
    "late":    [0.65, 0.28, 0.07],   # always late but usually shows up
    "poor":    [0.50, 0.15, 0.35],
}


@router.post("/seed")
async def seed_demo(db: AsyncSession = Depends(get_db)):
    # Idempotent: don't re-seed if org exists
    existing = await db.scalar(select(Organization).where(Organization.name == "Acme Corp"))
    if existing:
        return {
            "message": "Demo data already exists",
            "credentials": {
                "admin": {"email": "alice@acme.com", "password": DEMO_PASSWORD},
                "staff": {"email": "bob@acme.com",   "password": DEMO_PASSWORD},
                "user":  {"email": "carol@acme.com", "password": DEMO_PASSWORD},
            },
        }

    # Create org
    org = Organization(name="Acme Corp", plan="pro")
    db.add(org)
    await db.flush()

    # Create users
    members = []
    for u in DEMO_USERS:
        member = OrgUser(
            organization_id=org.id,
            name=u["name"],
            email=u["email"],
            password_hash=auth_utils.hash_password(DEMO_PASSWORD),
            role=u["role"],
            department=u["dept"],
        )
        db.add(member)
        members.append((member, u["type"]))

    await db.flush()

    # Generate 60 days of attendance (skip weekends)
    today = date.today()
    rng = random.Random(42)  # deterministic seed for reproducibility

    for member, profile_type in members:
        probs = PROFILES[profile_type]
        for i in range(60):
            day = today - timedelta(days=i)
            if day.weekday() >= 5:  # skip Saturday(5), Sunday(6)
                continue

            rand = rng.random()
            if rand < probs[2]:
                status = "absent"
                check_in = check_out = None
            elif rand < probs[2] + probs[1]:
                status = "late"
                check_in = datetime.combine(day, time(rng.randint(10, 11), rng.randint(0, 59)), tzinfo=timezone.utc)
                check_out = datetime.combine(day, time(17, rng.randint(0, 59)), tzinfo=timezone.utc)
            else:
                status = "present"
                check_in = datetime.combine(day, time(8, rng.randint(45, 59)), tzinfo=timezone.utc)
                check_out = datetime.combine(day, time(17, rng.randint(0, 59)), tzinfo=timezone.utc)

            db.add(AttendanceRecord(
                user_id=member.id,
                organization_id=org.id,
                date=day,
                status=status,
                check_in=check_in,
                check_out=check_out,
            ))

    # Seed a few activity logs
    admin = members[0][0]
    for action in ["login", "attendance_marked", "user_created", "insight_generated"]:
        db.add(ActivityLog(
            user_id=admin.id,
            organization_id=org.id,
            action=action,
            resource="system",
            details={"seeded": True},
            ip_address="127.0.0.1",
        ))

    await db.flush()

    # Generate AI insights from the seeded data
    raw_insights = await _compute_insights(db, org.id)
    for item in raw_insights:
        db.add(AIInsight(organization_id=org.id, **item))

    await db.commit()

    return {
        "message": "Demo data seeded — 10 users, 60 days of attendance, AI insights generated",
        "organization": "Acme Corp",
        "credentials": {
            "admin": {"email": "alice@acme.com", "password": DEMO_PASSWORD},
            "staff": {"email": "bob@acme.com",   "password": DEMO_PASSWORD},
            "user":  {"email": "carol@acme.com", "password": DEMO_PASSWORD},
        },
    }
