"""
logs.py — Activity Log router
Mounted at /api/logs
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_db
from app.models import ActivityLog, OrgUser
from app.schemas import LogOut
from app.dependencies import AdminOrAbove

router = APIRouter(tags=["logs"])


@router.get("", response_model=List[LogOut])
async def list_logs(
    action:  Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    limit:   int            = Query(100, ge=1, le=500),
    offset:  int            = Query(0,   ge=0),
    current_user: OrgUser   = AdminOrAbove,
    db: AsyncSession        = Depends(get_db),
):
    stmt = (
        select(ActivityLog, OrgUser.name.label("user_name"))
        .join(OrgUser, OrgUser.id == ActivityLog.user_id)
        .where(ActivityLog.organization_id == current_user.organization_id)
    )

    if action:
        stmt = stmt.where(ActivityLog.action == action)
    if user_id:
        stmt = stmt.where(ActivityLog.user_id == user_id)

    stmt = stmt.order_by(ActivityLog.created_at.desc()).limit(limit).offset(offset)

    rows = (await db.execute(stmt)).all()

    return [
        LogOut(
            id=row.ActivityLog.id,
            user_id=row.ActivityLog.user_id,
            user_name=row.user_name,
            action=row.ActivityLog.action,
            resource=row.ActivityLog.resource,
            details=row.ActivityLog.details,
            ip_address=row.ActivityLog.ip_address,
            created_at=row.ActivityLog.created_at,
        )
        for row in rows
    ]