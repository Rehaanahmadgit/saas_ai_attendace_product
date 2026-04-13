from contextlib import asynccontextmanager
import os
import time
import uuid
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

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
    onboarding,
)

# ─────────────────────────────────────────────────────────────
# 🔹 Logging Configuration (Structured Logs)
# ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
)
logger = logging.getLogger("api")


# ─────────────────────────────────────────────────────────────
# 🔹 Lifespan (DB Init + Safe Migration Helper)
# ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        # Create tables
        await conn.run_sync(Base.metadata.create_all)

        # Safe column creation (only if not exists)
        async def ensure_column(name: str, ddl: str):
            result = await conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name='org_users' AND column_name=:name"
                ).bindparams(name=name)
            )
            if result.first() is None:
                await conn.execute(text(ddl))

        # Add missing columns (temporary solution)
        await ensure_column(
            "user_type",
            "ALTER TABLE org_users ADD COLUMN user_type VARCHAR(20) DEFAULT 'staff'",
        )
        await ensure_column(
            "phone",
            "ALTER TABLE org_users ADD COLUMN phone VARCHAR(20)",
        )
        await ensure_column(
            "employee_id",
            "ALTER TABLE org_users ADD COLUMN employee_id VARCHAR(50)",
        )
        await ensure_column(
            "department_id",
            "ALTER TABLE org_users ADD COLUMN department_id INTEGER",
        )
        await ensure_column(
            "profile_meta",
            "ALTER TABLE org_users ADD COLUMN profile_meta JSON",
        )

    yield


# ─────────────────────────────────────────────────────────────
# 🔹 FastAPI App Initialization
# ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="Nexus Attendance SaaS API",
    version="1.0.0",
    description="MCP-ready attendance & analytics API for Schools/Offices",
    lifespan=lifespan,
    redirect_slashes=False,
)


# ─────────────────────────────────────────────────────────────
# 🔹 Middleware (Request Logging)
# ─────────────────────────────────────────────────────────────
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    start = time.monotonic()

    response = await call_next(request)

    duration_ms = round((time.monotonic() - start) * 1000, 1)

    logger.info(
        '{"request_id":"%s","method":"%s","path":"%s","status":%d,"duration_ms":%s}',
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )

    response.headers["X-Request-ID"] = request_id
    return response


# ─────────────────────────────────────────────────────────────
# 🔹 Dev-only Debug Middleware (SAFE)
# ─────────────────────────────────────────────────────────────
if os.getenv("APP_ENV") == "development":

    @app.middleware("http")
    async def debug_requests(request: Request, call_next):
        print("PATH:", request.url.path)
        return await call_next(request)


# ─────────────────────────────────────────────────────────────
# 🔹 Global Exception Handler
# ─────────────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {str(exc)}")

    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error"},
    )


# ─────────────────────────────────────────────────────────────
# 🔹 CORS Configuration (ENV-based)
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
# 🔹 Routers
# ─────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth")
app.include_router(users.router, prefix="/api/users")
app.include_router(attendance.router, prefix="/api/attendance")
app.include_router(analytics.router, prefix="/api/analytics")
app.include_router(insights.router, prefix="/api/insights")
app.include_router(logs.router, prefix="/api/logs")
app.include_router(permissions.router, prefix="/api/permissions")
app.include_router(structure.router, prefix="/api/structure")
app.include_router(onboarding.router, prefix="/api/onboarding")


# ─────────────────────────────────────────────────────────────
# 🔹 Dev-only Routes
# ─────────────────────────────────────────────────────────────
if os.getenv("APP_ENV") == "development":
    from app.routers import seed

    app.include_router(seed.router, prefix="/dev")


# ─────────────────────────────────────────────────────────────
# 🔹 Health Check
# ─────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "Nexus Attendance API",
    }