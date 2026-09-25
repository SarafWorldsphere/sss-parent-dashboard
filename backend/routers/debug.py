"""
Debug router — LOCAL / STAGING USE ONLY.

Provides two read-only endpoints that reveal the real database IDs
assigned to TEST_ seed rows after seeding against AWS RDS (where the
ID sequences are already well advanced from production data).

  GET /debug/seeded-students  — student_id, full_name, class, parent_id
  GET /debug/seeded-parents   — parent_id, full_name, email, phone

Workflow for dynamic ID setup:
  1. Seed TEST_ rows:  python mock_data.py
  2. Call GET /debug/seeded-parents  → note the real parent_id
  3. In browser DevTools console:
       localStorage.setItem('sss_parent_id', '<parent_id>')
       localStorage.setItem('sss_student_id', '<student_id>')
  4. Refresh the page — ChildSelector loads real children automatically.

NEVER expose this router in a production build.
"""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import StudentMaster, ParentMaster, ParentStudentMap, ClassMaster
from typing import List, Any

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/debug", tags=["Debug (dev-only)"])


@router.get("/seeded-students")
def get_seeded_students(db: Session = Depends(get_db)) -> List[Any]:
    """
    Return all TEST_ student rows with their mapped parent_id and class info.
    Filtered by full_name LIKE 'TEST_%' — matches mock_data.py naming convention.
    """
    rows = (
        db.query(StudentMaster, ParentStudentMap, ClassMaster)
        .join(ParentStudentMap, ParentStudentMap.student_id == StudentMaster.student_id)
        .join(ClassMaster, StudentMaster.class_id == ClassMaster.class_id)
        .filter(StudentMaster.full_name.like("TEST_%"))
        .order_by(StudentMaster.student_id)
        .all()
    )
    result = [
        {
            "student_id": s.student_id,
            "full_name":  s.full_name,
            "class_id":   s.class_id,
            "class_name": c.class_name,
            "section":    s.section,
            "parent_id":  m.parent_id,
        }
        for s, m, c in rows
    ]
    logger.info("[debug/seeded-students] returning %d rows", len(result))
    return result


@router.get("/seeded-parents")
def get_seeded_parents(db: Session = Depends(get_db)) -> List[Any]:
    """
    Return all TEST_ parent rows.
    Filtered by full_name LIKE 'TEST_%' — matches mock_data.py naming convention.
    """
    rows = (
        db.query(ParentMaster)
        .filter(ParentMaster.full_name.like("TEST_%"))
        .order_by(ParentMaster.parent_id)
        .all()
    )
    result = [
        {
            "parent_id": p.parent_id,
            "full_name": p.full_name,
            "email":     p.email,
            "phone":     p.phone,
        }
        for p in rows
    ]
    logger.info("[debug/seeded-parents] returning %d rows", len(result))
    return result
