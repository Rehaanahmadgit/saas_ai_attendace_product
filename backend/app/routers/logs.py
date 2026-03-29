from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import ActivityLog, OrgUser
from app.schemas import LogOut
from app.dependencies import require_min_role

router = APIRouter(tags=["logs"])

AdminOrAbove = Depends(require_min_role("admin"))


@router.get("/", response_model=List[LogOut])
async def list_logs(
    action: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    limit: int = Query(100, le=500),
    current_user=AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(ActivityLog, OrgUser.name.label("user_name"))
        .join(OrgUser, OrgUser.id == ActivityLog.user_id)
        .where(ActivityLog.organization_id == current_user.organization_id)
    )
    if action:
        stmt = stmt.where(ActivityLog.action == action)
    if start_date:
        stmt = stmt.where(ActivityLog.created_at >= start_date)
    if end_date:
        stmt = stmt.where(ActivityLog.created_at <= end_date)

    stmt = stmt.order_by(ActivityLog.created_at.desc()).limit(limit)
    rows = (await db.execute(stmt)).all()

    return [
        LogOut(
            id=log.id,
            user_id=log.user_id,
            user_name=name,
            action=log.action,
            resource=log.resource,
            details=log.details,
            ip_address=log.ip_address,
            created_at=log.created_at,
        )
        for log, name in rows
    ]
