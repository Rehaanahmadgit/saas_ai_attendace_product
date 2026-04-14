"""
Analytics Router — MCP-READY
All endpoints return structured data consumable by AI agents.
"""
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_

from app.database import get_db
from app.models import OrgUser, AttendanceRecord, AIInsight
from app.schemas import KPIResponse, TrendResponse, TrendPoint, DepartmentStat, UserPerformance
from app.dependencies import StaffOrAbove, AnyRole

router = APIRouter(tags=["analytics"])

PRESENT_STATUSES = ("present", "late")


@router.get("/kpis", response_model=KPIResponse)
async def get_kpis(
    current_user=AnyRole,
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user.organization_id
    today = date.today()
    seven_ago = today - timedelta(days=7)
    fourteen_ago = today - timedelta(days=14)
    thirty_ago = today - timedelta(days=30)

    # Total active users
    total = await db.scalar(
        select(func.count(OrgUser.id)).where(
            OrgUser.organization_id == org_id, OrgUser.is_active == True
        )
    ) or 0

    # Present today (present + late)
    present_today = await db.scalar(
        select(func.count(AttendanceRecord.id)).where(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.date == today,
            AttendanceRecord.status.in_(PRESENT_STATUSES),
        )
    ) or 0

    # 30-day attendance rate
    total_30 = await db.scalar(
        select(func.count(AttendanceRecord.id)).where(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.date >= thirty_ago,
        )
    ) or 0
    present_30 = await db.scalar(
        select(func.count(AttendanceRecord.id)).where(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.date >= thirty_ago,
            AttendanceRecord.status.in_(PRESENT_STATUSES),
        )
    ) or 0
    att_rate = round(present_30 / total_30 * 100, 1) if total_30 else 0.0

    # Weekly comparison
    this_week = await db.scalar(
        select(func.count(AttendanceRecord.id)).where(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.date >= seven_ago,
            AttendanceRecord.status.in_(PRESENT_STATUSES),
        )
    ) or 0
    last_week = await db.scalar(
        select(func.count(AttendanceRecord.id)).where(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.date >= fourteen_ago,
            AttendanceRecord.date < seven_ago,
            AttendanceRecord.status.in_(PRESENT_STATUSES),
        )
    ) or 0
    weekly_change = round((this_week - last_week) / max(last_week, 1) * 100, 1)

    # Monthly comparison
    prev_30 = await db.scalar(
        select(func.count(AttendanceRecord.id)).where(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.date >= thirty_ago - timedelta(days=30),
            AttendanceRecord.date < thirty_ago,
            AttendanceRecord.status.in_(PRESENT_STATUSES),
        )
    ) or 0
    monthly_change = round((present_30 - prev_30) / max(prev_30, 1) * 100, 1)

    # Unread AI insights
    insights_count = await db.scalar(
        select(func.count(AIInsight.id)).where(
            AIInsight.organization_id == org_id, AIInsight.is_read == False
        )
    ) or 0

    return KPIResponse(
        total_users=total,
        present_today=present_today,
        attendance_rate=att_rate,
        ai_insights_count=insights_count,
        weekly_change=weekly_change,
        monthly_change=monthly_change,
    )


@router.get("/trends", response_model=TrendResponse)
async def get_trends(
    days: int = Query(30, ge=7, le=90),
    current_user=StaffOrAbove,
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user.organization_id
    today = date.today()
    start = today - timedelta(days=days - 1)

    result = await db.execute(
        select(
            AttendanceRecord.date,
            func.count(AttendanceRecord.id).label("total"),
            func.sum(case((AttendanceRecord.status == "present", 1), else_=0)).label("present"),
            func.sum(case((AttendanceRecord.status == "late", 1), else_=0)).label("late"),
            func.sum(case((AttendanceRecord.status == "absent", 1), else_=0)).label("absent"),
        )
        .where(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.date >= start,
            AttendanceRecord.date <= today,
        )
        .group_by(AttendanceRecord.date)
        .order_by(AttendanceRecord.date)
    )
    rows = result.all()

    trends: List[TrendPoint] = []
    total_rate = 0.0
    for row in rows:
        rate = round((row.present + row.late) / row.total * 100, 1) if row.total else 0.0
        total_rate += rate
        trends.append(TrendPoint(
            date=row.date.strftime("%b %d"),
            present=row.present,
            late=row.late,
            absent=row.absent,
            rate=rate,
        ))

    avg = round(total_rate / len(trends), 1) if trends else 0.0
    return TrendResponse(trends=trends, avg_rate=avg, period_days=days)


@router.get("/departments", response_model=List[DepartmentStat])
async def get_department_stats(
    days: int = Query(30, ge=7, le=90),
    current_user=StaffOrAbove,
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user.organization_id
    start = date.today() - timedelta(days=days)

    result = await db.execute(
        select(
            OrgUser.department,
            func.count(AttendanceRecord.id).label("total"),
            func.sum(case((AttendanceRecord.status == "present", 1), else_=0)).label("present"),
            func.sum(case((AttendanceRecord.status == "late", 1), else_=0)).label("late"),
            func.sum(case((AttendanceRecord.status == "absent", 1), else_=0)).label("absent"),
        )
        .select_from(AttendanceRecord)
        .join(OrgUser, OrgUser.id == AttendanceRecord.user_id)
        .where(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.date >= start,
        )
        .group_by(OrgUser.department)
        .order_by(func.count(AttendanceRecord.id).desc())
    )

    return [
        DepartmentStat(
            department=row.department or "Unassigned",
            total_records=row.total,
            present=row.present,
            late=row.late,
            absent=row.absent,
            rate=round((row.present + row.late) / row.total * 100, 1) if row.total else 0.0,
        )
        for row in result.all()
    ]


@router.get("/user-performance", response_model=List[UserPerformance])
async def get_user_performance(
    days: int = Query(30, ge=7, le=90),
    department: Optional[str] = Query(None),
    current_user=StaffOrAbove,
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user.organization_id
    start = date.today() - timedelta(days=days)

    stmt = (
        select(
            OrgUser.id,
            OrgUser.name,
            OrgUser.department,
            func.count(AttendanceRecord.id).label("total"),
            func.sum(case((AttendanceRecord.status == "present", 1), else_=0)).label("present"),
            func.sum(case((AttendanceRecord.status == "late", 1), else_=0)).label("late"),
            func.sum(case((AttendanceRecord.status == "absent", 1), else_=0)).label("absent"),
        )
        .select_from(OrgUser)
        .join(AttendanceRecord, and_(
            OrgUser.id == AttendanceRecord.user_id,
            AttendanceRecord.date >= start,
        ))
        .where(OrgUser.organization_id == org_id, OrgUser.is_active == True)
        .group_by(OrgUser.id, OrgUser.name, OrgUser.department)
        .order_by(func.count(AttendanceRecord.id).desc())
    )
    if department:
        stmt = stmt.where(OrgUser.department == department)

    result = await db.execute(stmt)
    return [
        UserPerformance(
            user_id=row.id,
            name=row.name,
            department=row.department,
            present=row.present,
            late=row.late,
            absent=row.absent,
            total=row.total,
            rate=round((row.present + row.late) / row.total * 100, 1) if row.total else 0.0,
        )
        for row in result.all()
    ]