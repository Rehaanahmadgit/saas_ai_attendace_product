# Entry point for uvicorn: `uvicorn main:app --reload`
# Delegates to app/main.py — do NOT duplicate router registrations here.
from app.main import app  # noqa: F401
