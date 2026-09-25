from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from database import engine, Base, DB_PREFIX
import models
from routers import dashboard, translation, communication, debug, assessments
from startup_check import run_startup_checks
import logging
import os
from pathlib import Path

logging.basicConfig(level=logging.INFO)

# ── Startup table validation ──────────────────────────────────────────────────
# Checks that every table the app actively queries exists in the connected DB.
# On SSS RDS (DB_TABLE_PREFIX="sss_") this will warn about absent legacy tables
# (e.g. sss_teacher_parent_interaction) without blocking startup, and will raise
# immediately if a *required* table is missing instead of crashing mid-request.

# Create tables (IF NOT EXISTS — safe for both fresh and existing databases)
Base.metadata.create_all(bind=engine)

run_startup_checks(raise_on_error=True)

# Back-fill recipient_name on existing support_tickets tables.
# Uses DB_PREFIX so this is correct for both local and sss_* RDS targets.
with engine.connect() as _conn:
    _conn.execute(text(
        f"ALTER TABLE {DB_PREFIX}support_tickets "
        "ADD COLUMN IF NOT EXISTS recipient_name VARCHAR"
    ))
    _conn.commit()

app = FastAPI(title="Parent Dashboard API")

# ── Uploaded assignment files ────────────────────────────────────────────────
# Filesystem location is configurable through environment variables.
UPLOAD_ROOT = Path(
    os.getenv("ASSIGNMENT_UPLOAD_ROOT", "uploads")
)

UPLOAD_ROOT.mkdir(
    parents=True,
    exist_ok=True
)

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_ROOT)),
    name="uploads"
)


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from startup_check import run_startup_checks

# Include routers
app.include_router(dashboard.router, tags=["Dashboard"])
app.include_router(translation.router, tags=["Translation"])
app.include_router(communication.router)
app.include_router(debug.router)   # dev-only: GET /debug/seeded-students, /debug/seeded-parents
app.include_router(assessments.router, tags=["Assessments"])

@app.get("/")
def read_root():
    return {"message": "Parent Dashboard API is running"}
