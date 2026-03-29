"""
AI Insights Router — MCP-READY
─────────────────────────────────────────────────────────────────
All responses are structured for AI agent / MCP consumption.
Future: Replace rule-based engine with LLM calls or MCP tool calls.

MCP Integration Points:
  GET  /api/insights          → AI agent reads insights
  POST /api/insights/generate → AI agent triggers analysis
  GET  /api/insights/summary  → Natural-language ready summary
─────────────────────────────────────────────────────────────────
"""
from datetime import date, timedelta, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, delete, and_, desc

from app.database import get_db
from app.models import OrgUser, AttendanceRecord, AIInsight
from app.schemas import InsightOut, InsightsResponse
from app.dependencies import get_current_user, require_min_role

router = APIRouter(tags=["insights"])

AdminOrAbove = Depends(require_min_role("admin"))
AnyRole = Depends(get_current_user)


# ── Rule-based insight engine ─────────────────────────────────────────────────

async def _compute_insights(db: AsyncSession, org_id: int) -> List[dict]:
    today = date.today()
    thirty_ago = today - timedelta(days=30)
    seven_ago = today - timedelta(days=7)
    fourteen_ago = seven_ago - timedelta(days=7)

    total_users = await db.scalar(
        select(func.count(OrgUser.id)).where(
            OrgUser.organization_id == org_id, OrgUser.is_active == True
        )
    ) or 0

    if not total_users:
        return []

    results = []

    # ── 1. Today's attendance rate ─────────────────────────────────────────────
    today_present = await db.scalar(
        select(func.count(AttendanceRecord.id)).where(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.date == today,
            AttendanceRecord.status.in_(["present", "late"]),
        )
    ) or 0
    today_rate = today_present / total_users

    if today_rate < 0.75:
        results.append({
            "insight_type": "low_attendance_today",
            "title": f"Low Attendance Today — {today_rate:.0%}",
            "description": (
                f"Only {today_present} of {total_users} team members are present today "
                f"({today_rate:.0%}). This is below the 75% recommended threshold. "
                "Consider sending reminders or checking for scheduling conflicts."
            ),
            "severity": "critical" if today_rate < 0.55 else "warning",
            "insight_meta": {
                "today_rate": round(today_rate, 3),
                "present": today_present,
                "total": total_users,
                "ai_hint": "Investigate potential causes: illness, weather, scheduling issues",
            },
        })

    # ── 2. Top late users (last 30 days) ──────────────────────────────────────
    late_result = await db.execute(
        select(
            OrgUser.id,
            OrgUser.name,
            OrgUser.department,
            func.count(AttendanceRecord.id).label("late_count"),
        )
        .select_from(OrgUser)
        .join(AttendanceRecord, and_(
            OrgUser.id == AttendanceRecord.user_id,
            AttendanceRecord.date >= thirty_ago,
            AttendanceRecord.status == "late",
        ))
        .where(OrgUser.organization_id == org_id)
        .group_by(OrgUser.id, OrgUser.name, OrgUser.department)
        .order_by(desc("late_count"))
        .limit(5)
    )
    late_users = late_result.all()

    if late_users and late_users[0].late_count >= 4:
        names = [f"{u.name} ({u.late_count}×)" for u in late_users[:3]]
        results.append({
            "insight_type": "frequent_late_arrivals",
            "title": "Frequent Late Arrivals Detected",
            "description": (
                f"Top late arrivals in the last 30 days: {', '.join(names)}. "
                "Repeated lateness impacts team productivity and morale. "
                "Recommend a 1-on-1 check-in with affected team members."
            ),
            "severity": "warning",
            "insight_meta": {
                "top_late_users": [
                    {"name": u.name, "department": u.department, "count": u.late_count}
                    for u in late_users
                ],
                "ai_hint": "Schedule manager review; check commute or health issues",
            },
        })

    # ── 3. Weekly attendance trend ─────────────────────────────────────────────
    this_week = await db.scalar(
        select(func.count(AttendanceRecord.id)).where(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.date >= seven_ago,
            AttendanceRecord.status.in_(["present", "late"]),
        )
    ) or 0
    last_week = await db.scalar(
        select(func.count(AttendanceRecord.id)).where(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.date >= fourteen_ago,
            AttendanceRecord.date < seven_ago,
            AttendanceRecord.status.in_(["present", "late"]),
        )
    ) or 0

    if last_week > 0:
        trend = (this_week - last_week) / last_week
        if trend <= -0.1:
            results.append({
                "insight_type": "attendance_drop",
                "title": f"Attendance Dropped {abs(trend):.0%} This Week",
                "description": (
                    f"Attendance fell by {abs(trend):.0%} compared to last week "
                    f"({this_week} vs {last_week} check-ins). "
                    "Investigate potential causes and communicate expectations to the team."
                ),
                "severity": "warning" if abs(trend) < 0.2 else "critical",
                "insight_meta": {
                    "this_week": this_week,
                    "last_week": last_week,
                    "drop_pct": round(abs(trend) * 100, 1),
                    "ai_hint": "Compare with calendar events; check if holidays or events affected attendance",
                },
            })
        elif trend >= 0.1:
            results.append({
                "insight_type": "attendance_improvement",
                "title": f"Attendance Up {trend:.0%} This Week",
                "description": (
                    f"Great news! Attendance improved by {trend:.0%} this week. "
                    "Keep up the positive momentum."
                ),
                "severity": "info",
                "insight_meta": {"trend_pct": round(trend * 100, 1)},
            })

    # ── 4. Department-level alerts ─────────────────────────────────────────────
    dept_result = await db.execute(
        select(
            OrgUser.department,
            func.count(AttendanceRecord.id).label("total"),
            func.sum(case((AttendanceRecord.status.in_(["present", "late"]), 1), else_=0)).label("present"),
        )
        .select_from(AttendanceRecord)
        .join(OrgUser, OrgUser.id == AttendanceRecord.user_id)
        .where(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.date >= thirty_ago,
        )
        .group_by(OrgUser.department)
    )
    for row in dept_result.all():
        if row.total > 0:
            dept_rate = row.present / row.total
            if dept_rate < 0.70:
                results.append({
                    "insight_type": "department_low_attendance",
                    "title": f"{row.department or 'Unassigned'} Dept. Needs Attention",
                    "description": (
                        f"The {row.department or 'Unassigned'} department recorded only "
                        f"{dept_rate:.0%} attendance over the last 30 days. "
                        "Department managers should investigate and address root causes."
                    ),
                    "severity": "warning",
                    "insight_meta": {
                        "department": row.department,
                        "rate": round(dept_rate, 3),
                        "ai_hint": f"Review {row.department} team schedules and workload",
                    },
                })

    # ── 5. High individual absence rate ───────────────────────────────────────
    absence_result = await db.execute(
        select(
            OrgUser.id,
            OrgUser.name,
            OrgUser.department,
            func.count(AttendanceRecord.id).label("total"),
            func.sum(case((AttendanceRecord.status == "absent", 1), else_=0)).label("absent"),
        )
        .select_from(OrgUser)
        .join(AttendanceRecord, and_(
            OrgUser.id == AttendanceRecord.user_id,
            AttendanceRecord.date >= thirty_ago,
        ))
        .where(OrgUser.organization_id == org_id, OrgUser.is_active == True)
        .group_by(OrgUser.id, OrgUser.name, OrgUser.department)
        .having(func.count(AttendanceRecord.id) >= 8)
    )
    high_absence = [
        row for row in absence_result.all()
        if row.total and row.absent / row.total > 0.25
    ]
    if high_absence:
        names = [f"{u.name} ({u.absent}/{u.total})" for u in high_absence[:3]]
        results.append({
            "insight_type": "high_absence_rate",
            "title": f"{len(high_absence)} User(s) With High Absence Rate",
            "description": (
                f"Users with >25% absence in the last 30 days: {', '.join(names)}. "
                "High absence rates indicate potential disengagement or personal issues. "
                "Consider a supportive check-in conversation."
            ),
            "severity": "warning",
            "insight_meta": {
                "users": [
                    {"name": u.name, "dept": u.department,
                     "absence_rate": round(u.absent / u.total, 3)}
                    for u in high_absence
                ],
                "ai_hint": "Cross-reference with performance reviews and HR records",
            },
        })

    if not results:
        results.append({
            "insight_type": "all_systems_normal",
            "title": "All Systems Normal",
            "description": (
                "Attendance is on track with no critical issues detected. "
                "Overall attendance rate exceeds the 75% threshold. Keep it up!"
            ),
            "severity": "info",
            "insight_meta": {"ai_hint": "Continue current engagement practices"},
        })

    return results


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=InsightsResponse)
async def get_insights(
    current_user=AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    """MCP-READY: Returns AI-generated insights with full MCP context metadata."""
    org_id = current_user.organization_id

    result = await db.execute(
        select(AIInsight)
        .where(AIInsight.organization_id == org_id)
        .order_by(AIInsight.created_at.desc())
    )
    insights = result.scalars().all()
    unread = sum(1 for i in insights if not i.is_read)

    return InsightsResponse(
        insights=[InsightOut.model_validate(i) for i in insights],
        total=len(insights),
        unread=unread,
        summary=(
            f"{unread} unread insight(s) require attention"
            if unread else "All insights reviewed — no pending alerts"
        ),
        mcp_context={
            "data_freshness": "on-demand (call /generate to refresh)",
            "supported_queries": [
                "Who has the worst attendance this month?",
                "Which department is most punctual?",
                "Show me attendance trends for the past week",
                "List users who were late more than 3 times",
            ],
            "endpoints": {
                "generate": "POST /api/insights/generate",
                "raw_data": "GET /api/analytics/trends",
                "user_stats": "GET /api/analytics/user-performance",
            },
        },
    )


@router.post("/generate")
async def generate_insights(
    current_user=AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    """MCP-READY: AI agent trigger — recomputes all insights from current data."""
    org_id = current_user.organization_id

    # Clear old insights for this org
    await db.execute(delete(AIInsight).where(AIInsight.organization_id == org_id))

    raw = await _compute_insights(db, org_id)
    for item in raw:
        db.add(AIInsight(organization_id=org_id, **item))

    await db.commit()
    return {"generated": len(raw), "message": f"{len(raw)} insights computed successfully"}


@router.patch("/{insight_id}/read")
async def mark_read(
    insight_id: int,
    current_user=AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    insight = await db.scalar(
        select(AIInsight).where(
            AIInsight.id == insight_id,
            AIInsight.organization_id == current_user.organization_id,
        )
    )
    if not insight:
        raise HTTPException(404, "Insight not found")
    insight.is_read = True
    await db.commit()
    return {"ok": True}


@router.get("/summary")
async def natural_language_summary(
    current_user=AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    """MCP-READY: Returns a plain-English summary for AI agent narration."""
    org_id = current_user.organization_id
    today = date.today()

    total = await db.scalar(
        select(func.count(OrgUser.id)).where(
            OrgUser.organization_id == org_id, OrgUser.is_active == True
        )
    ) or 0
    present_today = await db.scalar(
        select(func.count(AttendanceRecord.id)).where(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.date == today,
            AttendanceRecord.status.in_(["present", "late"]),
        )
    ) or 0
    rate = round(present_today / total * 100, 1) if total else 0

    return {
        "date": str(today),
        "summary": (
            f"As of today, {present_today} out of {total} team members are present "
            f"({rate}% attendance rate). "
            + ("Attendance is on track." if rate >= 75 else "Attendance is below target — action recommended.")
        ),
        "metrics": {"total": total, "present": present_today, "rate": rate},
        "natural_language_ready": True,
    }
