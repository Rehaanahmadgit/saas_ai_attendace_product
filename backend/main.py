from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import auth, users, attendance, analytics, insights, logs, seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables (idempotent)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="Nexus Attendance SaaS API",
    version="1.0.0",
    description="MCP-ready attendance & analytics API for Schools/Offices",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,       prefix="/api/auth")
app.include_router(users.router,      prefix="/api/users")
app.include_router(attendance.router, prefix="/api/attendance")
app.include_router(analytics.router,  prefix="/api/analytics")
app.include_router(insights.router,   prefix="/api/insights")
app.include_router(logs.router,       prefix="/api/logs")
app.include_router(seed.router,       prefix="/api/dev")   # dev-only


@app.get("/health")
async def health():
    return {"status": "ok", "service": "Nexus Attendance API"}
