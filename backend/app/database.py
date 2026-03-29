import os
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

_raw = os.getenv("DATABASE_URL", "")

# ── Convert to asyncpg-compatible URL ─────────────────────────────────────────
_url = _raw.replace("postgresql://", "postgresql+asyncpg://", 1)
_parsed = urlparse(_url)
_params = parse_qs(_parsed.query, keep_blank_values=True)
_params.pop("sslmode", None)
_params.pop("channel_binding", None)
_clean_query = urlencode({k: v[0] for k, v in _params.items()})
DATABASE_URL = urlunparse(_parsed._replace(query=_clean_query))

engine = create_async_engine(
    DATABASE_URL,
    connect_args={"ssl": True},
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
