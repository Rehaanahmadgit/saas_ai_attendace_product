from datetime import datetime, date, time, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.database import get_db
from app.models import OrgUser, AttendanceRecord, ActivityLog
from app.schemas import AttendanceMark, AttendanceOut, TodaySummary
from app.dependencies import get_current_user, require_min_role

router = APIRouter(tags=["attendance"])

StaffOrAbove = Depends(require_min_role("staff"))
AnyRole = Depends(get_current_user)

LATE_THRESHOLD = time(9, 30)   # mark late if check-in after 09:30


def _build_out(record: AttendanceRecord, user: OrgUser) -> AttendanceOut:
    duration = None
    if record.check_in and record.check_out:
        delta = record.check_out - record.check_in
        duration = round(delta.total_seconds() / 3600, 2)
    return AttendanceOut(
        id=record.id,
        user_id=record.user_id,
        user_name=user.name,
        user_email=user.email,
        department=user.department,
        date=record.date,
        status=record.status,
        check_in=record.check_in,
        check_out=record.check_out,
        notes=record.notes,
        duration_hours=duration,
        created_at=record.created_at,
    )


@router.post("/mark", response_model=AttendanceOut, status_code=status.HTTP_201_CREATED)
async def mark_attendance(
    data: AttendanceMark,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    # Only staff+ can mark for other users
    target_id = data.user_id or current_user.id
    if target_id != current_user.id:
        if current_user.role not in ("admin", "super_admin", "staff"):
            raise HTTPException(403, "Cannot mark attendance for other users")

    mark_date = data.date or date.today()

    # Validate target user exists in same org
    target_user = await db.scalar(
        select(OrgUser).where(
            OrgUser.id == target_id,
            OrgUser.organization_id == current_user.organization_id,
        )
    )
    if not target_user:
        raise HTTPException(404, "User not found in your organization")

    # Prevent duplicate
    existing = await db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.user_id == target_id,
            AttendanceRecord.date == mark_date,
        )
    )
    if existing:
        raise HTTPException(409, "Attendance already recorded for this date")

    check_in = data.check_in or datetime.now(timezone.utc)

    # Auto-detect status from check-in time
    local_time = check_in.time().replace(tzinfo=None)
    if data.status:
        final_status = data.status
    elif local_time > LATE_THRESHOLD:
        final_status = "late"
    else:
        final_status = "present"

    record = AttendanceRecord(
        user_id=target_id,
        organization_id=current_user.organization_id,
        date=mark_date,
        status=final_status,
        check_in=check_in,
        check_out=data.check_out,
        notes=data.notes,
    )
    db.add(record)

    db.add(ActivityLog(
        user_id=current_user.id,
        organization_id=current_user.organization_id,
        action="attendance_marked",
        resource="attendance",
        details={"target_user": target_id, "date": str(mark_date), "status": final_status},
    ))

    await db.commit()
    await db.refresh(record)
    return _build_out(record, target_user)


@router.get("/", response_model=List[AttendanceOut])
async def list_attendance(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    user_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    department: Optional[str] = Query(None),
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    # Non-staff users can only see their own records
    if current_user.role == "user":
        user_id = current_user.id

    stmt = (
        select(AttendanceRecord, OrgUser)
        .join(OrgUser, OrgUser.id == AttendanceRecord.user_id)
        .where(AttendanceRecord.organization_id == current_user.organization_id)
    )
    if start_date:
        stmt = stmt.where(AttendanceRecord.date >= start_date)
    if end_date:
        stmt = stmt.where(AttendanceRecord.date <= end_date)
    if user_id:
        stmt = stmt.where(AttendanceRecord.user_id == user_id)
    if status_filter:
        stmt = stmt.where(AttendanceRecord.status == status_filter)
    if department:
        stmt = stmt.where(OrgUser.department == department)

    stmt = stmt.order_by(AttendanceRecord.date.desc())

    rows = (await db.execute(stmt)).all()
    return [_build_out(rec, usr) for rec, usr in rows]


@router.get("/today/summary", response_model=TodaySummary)
async def today_summary(
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user.organization_id
    today = date.today()

    total = await db.scalar(
        select(func.count(OrgUser.id)).where(
            OrgUser.organization_id == org_id, OrgUser.is_active == True
        )
    ) or 0

    result = await db.execute(
        select(AttendanceRecord.status, func.count(AttendanceRecord.id).label("cnt"))
        .where(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.date == today,
        )
        .group_by(AttendanceRecord.status)
    )
    counts = {row.status: row.cnt for row in result.all()}

    present = counts.get("present", 0)
    late = counts.get("late", 0)
    absent = counts.get("absent", 0)
    half_day = counts.get("half_day", 0)
    marked = present + late + absent + half_day

    return TodaySummary(
        total_users=total,
        present=present,
        absent=absent,
        late=late,
        half_day=half_day,
        not_marked=max(0, total - marked),
        attendance_rate=round((present + late) / total * 100, 1) if total else 0,
    )
