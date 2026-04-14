"""
attendance.py — Attendance management router
Mounted at /api/attendance

Fixes vs original:
  - The DB has a unique index on (user_id, date) when subject_id IS NULL.
    Per-subject records are allowed by also including subject_id in the WHERE.
    The duplicate check now mirrors this: (user_id, date, subject_id).
  - Added PATCH /api/attendance/{id} to update existing records.
  - Section scope check happens before DB writes.
  - period_no included in AttendanceOut.
"""
from datetime import datetime, date, time, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models import OrgUser, AttendanceRecord, ActivityLog, Student, Section, SectionTeacher
from app.schemas import (
    AttendanceMark, AttendanceUpdate, AttendanceOut, TodaySummary,
    BulkAttendanceMark, BulkAttendanceOut,
)
from app.dependencies import enforce_scope_filter, get_current_user, require_permission, AnyRole, _role_str

router = APIRouter(tags=["attendance"])

LATE_THRESHOLD = time(9, 30)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _compute_duration(check_in, check_out) -> Optional[float]:
    if check_in and check_out:
        return round((check_out - check_in).total_seconds() / 3600, 2)
    return None


def _build_out(record: AttendanceRecord, user: OrgUser) -> AttendanceOut:
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
        duration_hours=_compute_duration(record.check_in, record.check_out),
        section_id=record.section_id,
        subject_id=record.subject_id,
        period_no=record.period_no,
        marked_by=record.marked_by,
        created_at=record.created_at,
    )


def _auto_status(check_in: datetime, requested_status: Optional[str]) -> str:
    if requested_status:
        return requested_status
    local_time = check_in.time().replace(tzinfo=None)
    return "late" if local_time > LATE_THRESHOLD else "present"


async def _get_record_or_404(record_id: int, org_id: int, db: AsyncSession) -> AttendanceRecord:
    record = await db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.id == record_id,
            AttendanceRecord.organization_id == org_id,
        )
    )
    if not record:
        raise HTTPException(404, "Attendance record not found")
    return record


# ── Single mark ───────────────────────────────────────────────────────────────

@router.post("/mark", response_model=AttendanceOut, status_code=201)
async def mark_attendance(
    data: AttendanceMark,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    target_id = data.user_id or current_user.id
    mark_date = data.date or date.today()
    await enforce_scope_filter("attendance", current_user, db, target_user_id=target_id)

    user_role = _role_str(current_user)
    if target_id != current_user.id and user_role not in ("admin", "super_admin", "staff"):
        raise HTTPException(403, "Cannot mark attendance for other users")

    # Validate target user is in same org
    target_user = await db.scalar(
        select(OrgUser).where(
            OrgUser.id == target_id,
            OrgUser.organization_id == current_user.organization_id,
        )
    )
    if not target_user:
        raise HTTPException(404, "User not found in your organisation")

    # Staff section scope validation
    if user_role == "staff" and data.section_id:
        student = await db.scalar(
            select(Student).where(
                Student.user_id == target_id,
                Student.section_id == data.section_id,
            )
        )
        if not student:
            raise HTTPException(403, "Student not in your section")

    # Duplicate check: (user_id, date, subject_id) — allows per-subject records
    duplicate_check = and_(
        AttendanceRecord.user_id == target_id,
        AttendanceRecord.date == mark_date,
        AttendanceRecord.subject_id == data.subject_id,   # None matches NULL
    )
    existing = await db.scalar(select(AttendanceRecord).where(duplicate_check))
    if existing:
        raise HTTPException(409, "Attendance already recorded for this date/subject")

    check_in = data.check_in or datetime.now(timezone.utc)
    final_status = _auto_status(check_in, data.status)

    record = AttendanceRecord(
        user_id=target_id,
        organization_id=current_user.organization_id,
        date=mark_date,
        status=final_status,
        check_in=check_in,
        check_out=data.check_out,
        notes=data.notes,
        section_id=data.section_id,
        subject_id=data.subject_id,
        period_no=data.period_no,
        marked_by=current_user.id,
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


# ── Update attendance ─────────────────────────────────────────────────────────

@router.patch("/{record_id}", response_model=AttendanceOut)
async def update_attendance(
    record_id: int,
    data: AttendanceUpdate,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing attendance record (status, check_in, check_out, notes)."""
    user_role = _role_str(current_user)
    if user_role not in ("admin", "super_admin", "staff"):
        raise HTTPException(403, "Only staff and above can edit attendance records")

    record = await _get_record_or_404(record_id, current_user.organization_id, db)

    if data.status is not None:
        record.status = data.status
    if data.check_in is not None:
        record.check_in = data.check_in
    if data.check_out is not None:
        record.check_out = data.check_out
    if data.notes is not None:
        record.notes = data.notes

    db.add(ActivityLog(
        user_id=current_user.id,
        organization_id=current_user.organization_id,
        action="attendance_updated",
        resource="attendance",
        details={"record_id": record_id, "changes": data.model_dump(exclude_none=True)},
    ))
    await db.commit()
    await db.refresh(record)

    user = await db.scalar(select(OrgUser).where(OrgUser.id == record.user_id))
    return _build_out(record, user)


# ── Bulk mark ─────────────────────────────────────────────────────────────────

@router.post("/bulk-mark", response_model=BulkAttendanceOut, status_code=201)
async def bulk_mark_attendance(
    data: BulkAttendanceMark,
    current_user: OrgUser = Depends(require_permission("attendance", "can_create")),
    db: AsyncSession = Depends(get_db),
):
    """Mark attendance for all students in a section in one call."""
    section = await db.scalar(
        select(Section).where(
            Section.id == data.section_id,
            Section.organization_id == current_user.organization_id,
        )
    )
    if not section:
        raise HTTPException(404, "Section not found")

    # Staff must be assigned to the section
    user_role = _role_str(current_user)
    if user_role == "staff":
        is_primary = section.primary_teacher_id == current_user.id
        if not is_primary:
            assigned = await db.scalar(
                select(SectionTeacher).where(
                    SectionTeacher.section_id == data.section_id,
                    SectionTeacher.user_id == current_user.id,
                )
            )
            if not assigned:
                raise HTTPException(403, "You are not assigned to this section")

    mark_date = data.date or date.today()
    check_in = datetime.now(timezone.utc)
    marked = 0
    skipped = 0
    errors: List[str] = []

    for rec in data.records:
        uid = rec.user_id
        if uid is None:
            errors.append("Missing user_id in a record")
            continue

        # Validate student is in this section
        student = await db.scalar(
            select(Student).where(
                Student.user_id == uid,
                Student.section_id == data.section_id,
                Student.is_active == True,
            )
        )
        if not student:
            errors.append(f"user_id {uid} is not an active student in section {data.section_id}")
            skipped += 1
            continue

        # Skip duplicates
        existing = await db.scalar(
            select(AttendanceRecord).where(
                AttendanceRecord.user_id == uid,
                AttendanceRecord.date == mark_date,
                AttendanceRecord.subject_id == data.subject_id,
            )
        )
        if existing:
            skipped += 1
            continue

        db.add(AttendanceRecord(
            user_id=uid,
            organization_id=current_user.organization_id,
            date=mark_date,
            status=rec.status,
            check_in=check_in if rec.status in ("present", "late") else None,
            notes=rec.notes,
            section_id=data.section_id,
            subject_id=data.subject_id,
            period_no=data.period_no,
            marked_by=current_user.id,
        ))
        marked += 1

    db.add(ActivityLog(
        user_id=current_user.id,
        organization_id=current_user.organization_id,
        action="bulk_attendance_marked",
        resource="attendance",
        details={"section_id": data.section_id, "date": str(mark_date), "marked": marked},
    ))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Attendance already recorded for one or more students on this date. "
                   "Refresh student list and try again.",
        )
    return BulkAttendanceOut(marked=marked, skipped=skipped, errors=errors)


# ── List attendance ───────────────────────────────────────────────────────────

@router.get("", response_model=List[AttendanceOut])
async def list_attendance(
    start_date:    Optional[date] = Query(None),
    end_date:      Optional[date] = Query(None),
    user_id:       Optional[int]  = Query(None),
    status_filter: Optional[str]  = Query(None, alias="status"),
    department:    Optional[str]  = Query(None),
    section_id:    Optional[int]  = Query(None),
    subject_id:    Optional[int]  = Query(None),
    limit:         int            = Query(500, ge=1, le=2000),
    offset:        int            = Query(0, ge=0),
    current_user:  OrgUser        = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    user_role = _role_str(current_user)

    # Students can only see themselves
    if user_role == "user":
        user_id = current_user.id

    stmt = (
        select(AttendanceRecord, OrgUser)
        .join(OrgUser, OrgUser.id == AttendanceRecord.user_id)
        .where(AttendanceRecord.organization_id == current_user.organization_id)
    )

    if start_date:    stmt = stmt.where(AttendanceRecord.date >= start_date)
    if end_date:      stmt = stmt.where(AttendanceRecord.date <= end_date)
    if user_id:       stmt = stmt.where(AttendanceRecord.user_id == user_id)
    if status_filter: stmt = stmt.where(AttendanceRecord.status == status_filter)
    if department:    stmt = stmt.where(OrgUser.department == department)
    if section_id:    stmt = stmt.where(AttendanceRecord.section_id == section_id)
    if subject_id:    stmt = stmt.where(AttendanceRecord.subject_id == subject_id)

    stmt = stmt.order_by(AttendanceRecord.date.desc()).limit(limit).offset(offset)
    rows = (await db.execute(stmt)).all()
    return [_build_out(rec, usr) for rec, usr in rows]


# ── Today summary ─────────────────────────────────────────────────────────────

@router.get("/today/summary", response_model=TodaySummary)
async def today_summary(
    section_id: Optional[int] = Query(None),
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user.organization_id
    today  = date.today()

    user_q = select(func.count(OrgUser.id)).where(
        OrgUser.organization_id == org_id,
        OrgUser.is_active == True,
    )
    att_q = (
        select(AttendanceRecord.status, func.count(AttendanceRecord.id).label("cnt"))
        .where(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.date == today,
        )
    )

    if section_id:
        student_ids = select(Student.user_id).where(
            Student.section_id == section_id, Student.is_active == True
        )
        user_q = select(func.count(Student.id)).where(
            Student.section_id == section_id, Student.is_active == True
        )
        att_q = att_q.where(AttendanceRecord.user_id.in_(student_ids))

    total  = await db.scalar(user_q) or 0
    result = await db.execute(att_q.group_by(AttendanceRecord.status))
    counts = {row.status: row.cnt for row in result.all()}

    present  = counts.get("present",  0)
    late     = counts.get("late",     0)
    absent   = counts.get("absent",   0)
    half_day = counts.get("half_day", 0)
    marked   = present + late + absent + half_day

    return TodaySummary(
        total_users=total,
        present=present,
        absent=absent,
        late=late,
        half_day=half_day,
        not_marked=max(0, total - marked),
        attendance_rate=round((present + late) / total * 100, 1) if total else 0.0,
    )


# ── Section students (attendance wizard) ──────────────────────────────────────

@router.get("/section/{section_id}/students", response_model=List[dict])
async def get_section_students_for_attendance(
    section_id: int,
    date_param:  Optional[date] = Query(None, alias="date"),
    subject_id:  Optional[int]  = Query(None),
    current_user: OrgUser = Depends(require_permission("attendance", "can_view")),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all students in a section with their attendance status for a given date.
    Used by the frontend attendance wizard.
    """
    mark_date = date_param or date.today()

    section = await db.scalar(
        select(Section).where(
            Section.id == section_id,
            Section.organization_id == current_user.organization_id,
        )
    )
    if not section:
        raise HTTPException(404, "Section not found")

    # Scope check for non-admin staff
    user_role = _role_str(current_user)
    if user_role not in ("admin", "super_admin"):
        is_primary = section.primary_teacher_id == current_user.id
        is_assigned = await db.scalar(
            select(SectionTeacher).where(
                SectionTeacher.section_id == section_id,
                SectionTeacher.user_id == current_user.id,
            )
        )
        if not is_primary and not is_assigned:
            raise HTTPException(403, "You are not assigned to this section")

    result = await db.execute(
        select(Student, OrgUser)
        .join(OrgUser, OrgUser.id == Student.user_id)
        .where(Student.section_id == section_id, Student.is_active == True)
        .order_by(Student.roll_no.nullslast(), OrgUser.name)
    )
    rows = result.all()

    student_user_ids = [row.OrgUser.id for row in rows]
    att_q = select(AttendanceRecord).where(
        AttendanceRecord.user_id.in_(student_user_ids),
        AttendanceRecord.date == mark_date,
    )
    if subject_id:
        att_q = att_q.where(AttendanceRecord.subject_id == subject_id)

    att_result = await db.execute(att_q)
    att_by_user = {rec.user_id: rec for rec in att_result.scalars().all()}

    out = []
    for row in rows:
        student, org_user = row.Student, row.OrgUser
        att = att_by_user.get(org_user.id)
        out.append({
            "student_id":    student.id,
            "user_id":       org_user.id,
            "name":          org_user.name,
            "email":         org_user.email,
            "roll_no":       student.roll_no,
            "enrollment_no": student.enrollment_no,
            "attendance": {
                "id":      att.id       if att else None,
                "status":  att.status   if att else None,
                "check_in": att.check_in if att else None,
                "marked":  att is not None,
            },
        })

    return out
