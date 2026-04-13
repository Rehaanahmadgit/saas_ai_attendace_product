"""
main.py — FastAPI application entry point
"""
from contextlib import asynccontextmanager
import os
import time
import uuid
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.database import engine, Base
from app.routers import (
    auth,
    users,
    attendance,
    analytics,
    insights,
    logs,
    permissions,
    structure,
    students,
    onboarding,
)

# ─────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
)
logger = logging.getLogger("api")

# ─────────────────────────────────────────────────────────────
# Rate Limiter
# ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


# ─────────────────────────────────────────────────────────────
# Lifespan — DB init + safe column migrations
# ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        async def ensure_column(table: str, name: str, ddl: str):
            result = await conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name=:tbl AND column_name=:col"
                ).bindparams(tbl=table, col=name)
            )
            if result.first() is None:
                await conn.execute(text(ddl))
                logger.info("Migration: added column %s.%s", table, name)

        # org_users additional columns
        await ensure_column("org_users", "user_type",    "ALTER TABLE org_users ADD COLUMN user_type    VARCHAR(20)  DEFAULT 'staff'")
        await ensure_column("org_users", "phone",        "ALTER TABLE org_users ADD COLUMN phone        VARCHAR(20)")
        await ensure_column("org_users", "employee_id",  "ALTER TABLE org_users ADD COLUMN employee_id  VARCHAR(50)")
        await ensure_column("org_users", "department_id","ALTER TABLE org_users ADD COLUMN department_id INTEGER")
        await ensure_column("org_users", "profile_meta", "ALTER TABLE org_users ADD COLUMN profile_meta JSON")

        # organizations additional columns
        await ensure_column("organizations", "org_type", "ALTER TABLE organizations ADD COLUMN org_type VARCHAR(20) DEFAULT 'office'")
        await ensure_column("organizations", "address",  "ALTER TABLE organizations ADD COLUMN address  VARCHAR(255)")
        await ensure_column("organizations", "logo_url", "ALTER TABLE organizations ADD COLUMN logo_url VARCHAR(500)")
        await ensure_column("organizations", "settings", "ALTER TABLE organizations ADD COLUMN settings  JSON")
        await ensure_column("organizations", "is_active","ALTER TABLE organizations ADD COLUMN is_active BOOLEAN DEFAULT TRUE")

        # attendance_records additional columns
        await ensure_column("attendance_records", "section_id", "ALTER TABLE attendance_records ADD COLUMN section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL")
        await ensure_column("attendance_records", "subject_id", "ALTER TABLE attendance_records ADD COLUMN subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL")
        await ensure_column("attendance_records", "marked_by",  "ALTER TABLE attendance_records ADD COLUMN marked_by  BIGINT  REFERENCES org_users(id) ON DELETE SET NULL")
        await ensure_column("attendance_records", "period_no",  "ALTER TABLE attendance_records ADD COLUMN period_no  SMALLINT")

        # onboarding_status additional columns (safe add for schema changes)
        await ensure_column("onboarding_status", "updated_at", "ALTER TABLE onboarding_status ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now()")

    yield


# ─────────────────────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="Nexus Attendance SaaS API",
    version="1.2.0",
    description="Attendance & Analytics API for Schools / Colleges / Offices",
    lifespan=lifespan,
    redirect_slashes=False,
)

# Attach rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


# ─────────────────────────────────────────────────────────────
# CORS
# ─────────────────────────────────────────────────────────────
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────
# Middleware — request logging
# ─────────────────────────────────────────────────────────────
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = round((time.monotonic() - start) * 1000, 1)
    logger.info(
        '{"request_id":"%s","method":"%s","path":"%s","status":%d,"duration_ms":%s}',
        request_id, request.method, request.url.path, response.status_code, duration_ms,
    )
    response.headers["X-Request-ID"] = request_id
    return response


# ─────────────────────────────────────────────────────────────
# Dev debug middleware
# ─────────────────────────────────────────────────────────────
if os.getenv("APP_ENV") == "development":
    @app.middleware("http")
    async def debug_requests(request: Request, call_next):
        logger.debug("PATH: %s", request.url.path)
        return await call_next(request)


# ─────────────────────────────────────────────────────────────
# Global exception handler
# ─────────────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(status_code=500, content={"error": "Internal Server Error"})


# ─────────────────────────────────────────────────────────────
# Routers
# ─────────────────────────────────────────────────────────────
app.include_router(auth.router,        prefix="/api/auth")
app.include_router(onboarding.router,  prefix="/api/onboarding")
app.include_router(users.router,       prefix="/api/users")
app.include_router(attendance.router,  prefix="/api/attendance")
app.include_router(analytics.router,   prefix="/api/analytics")
app.include_router(insights.router,    prefix="/api/insights")
app.include_router(logs.router,        prefix="/api/logs")
app.include_router(permissions.router, prefix="/api/permissions")
app.include_router(structure.router,   prefix="/api/structure")
app.include_router(students.router,    prefix="/api/students")


# ─────────────────────────────────────────────────────────────
# Dev-only routes
# ─────────────────────────────────────────────────────────────
if os.getenv("APP_ENV") == "development":
    from app.routers import seed
    app.include_router(seed.router, prefix="/dev")


# ─────────────────────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "Nexus Attendance API", "version": "1.1.0"}
