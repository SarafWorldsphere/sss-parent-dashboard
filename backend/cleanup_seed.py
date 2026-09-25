"""
cleanup_seed.py — Safe Seed Data Removal
==========================================
Finds and removes ONLY the TEST_/SEED_ prefixed records that were inserted
by mock_data.py.  Real production data is never touched.

HOW IT IDENTIFIES SEEDED RECORDS
──────────────────────────────────
Every record inserted by mock_data.py carries at least one of these markers:

  full_name    LIKE 'TEST_%'   → ClassMaster, StudentMaster,
                                   ParentMaster, TeacherMaster
  email        LIKE '%_seed@%' → ParentMaster, TeacherMaster  (physical col: email_id)
  notice_title LIKE 'SEED_%'   → NoticeBoard
  ticket_number LIKE 'SEED-%'  → SupportTicket
  subject_name LIKE 'TEST_%'   → SubjectMaster
  chapter_name LIKE 'TEST_%'   → ChapterMaster
  assignment_title LIKE 'TEST_%' → AssignmentMaster
  quiz_title   LIKE 'TEST_%'   → QuizMaster

Child records (StudentSubmission, QuizResponse, TicketMessage,
ParentStudentMap) are cleaned up by matching their parent FKs
against the seeded IDs above — making the cleanup self-contained
and independent of the seed script's runtime variables.

DELETION ORDER (FK dependency chain — children before parents)
───────────────────────────────────────────────────────────────
  1.  TicketMessage    (FK → SupportTicket)
  2.  SupportTicket    (FK → ParentMaster, StudentMaster)
  3.  StudentSubmission(FK → AssignmentMaster, StudentMaster)
  4.  QuizResponse     (FK → QuizMaster, StudentMaster)
  5.  NoticeBoard      (FK → UsersMaster)
  6.  AssignmentMaster (FK → ChapterMaster, UsersMaster)
  7.  QuizMaster       (FK → ChapterMaster)
  8.  ParentStudentMap (FK → ParentMaster, StudentMaster)
  9.  ChapterMaster    (FK → SubjectMaster)
  10. SubjectMaster    (FK → ClassMaster, UsersMaster)
  11. StudentMaster    (FK → ClassMaster)
  12. ParentMaster     (no FK dependencies)
  13. TeacherMaster    (no FK dependencies — standalone after v004)
  14. ClassMaster      (FK → UsersMaster via class_teacher_id)
  15. UsersMaster      (root — no FK dependencies on modeled tables)

NOTE: TeacherParentInteractionV2 removed — sss_teacher_parent_interaction
does NOT exist on the SSS AWS RDS production database.

USAGE
─────
  # Preview what would be deleted (safe — no writes)
  python cleanup_seed.py

  # Actually delete seeded records
  python cleanup_seed.py --confirm

WHY SCHEMA OPERATIONS ARE DANGEROUS ON RDS
───────────────────────────────────────────
  Base.metadata.drop_all()  destroys ALL tables including production data.
  Base.metadata.create_all() can silently corrupt column types or constraints
  on an existing RDS database.  Never run either against a shared database.
  This script uses only DELETE queries filtered by seed markers — 100 % safe.
"""

import sys
import argparse
from typing import List

from sqlalchemy.orm import Session

from database import SessionLocal
from models import (
    UsersMaster,
    ClassMaster,
    StudentMaster,
    ParentMaster,
    ParentStudentMap,
    TeacherMaster,
    SubjectMaster,
    ChapterMaster,
    AssignmentMaster,
    StudentSubmission,
    QuizMaster,
    QuizResponse,
    NoticeBoard,
    SupportTicket,
    TicketMessage,
)

# ── Seed markers — must match constants in mock_data.py exactly ───────────────
SEED_NAME_PREFIX   = "TEST_"
SEED_EMAIL_TAG     = "_seed"
SEED_NOTICE_PREFIX = "SEED_"
SEED_TICKET_PREFIX = "SEED-"


# ── Helper: collect seeded IDs ────────────────────────────────────────────────

def _ids(rows) -> List[int]:
    """Extract primary-key values from a list of ORM objects."""
    if not rows:
        return []
    pk_attr = list(rows[0].__mapper__.primary_key)[0].name
    return [getattr(r, pk_attr) for r in rows]


def _collect_seed_ids(db: Session) -> dict:
    """
    Query the database once and return a dict of seeded IDs per model.
    No writes are performed — this function is always safe to call.
    """
    # Root tables — identified directly by seed markers on their own columns

    # UsersMaster: teacher-type users seeded by mock_data.py §5b.
    # Identified by full_name LIKE 'TEST_%' (same convention as TeacherMaster).
    seed_users = db.query(UsersMaster).filter(
        UsersMaster.full_name.like(f"{SEED_NAME_PREFIX}%")
    ).all()

    seed_classes  = db.query(ClassMaster).filter(
        ClassMaster.class_name.like(f"{SEED_NAME_PREFIX}%")
    ).all()

    seed_teachers = db.query(TeacherMaster).filter(
        TeacherMaster.full_name.like(f"{SEED_NAME_PREFIX}%")
    ).all()

    seed_parents  = db.query(ParentMaster).filter(
        ParentMaster.full_name.like(f"{SEED_NAME_PREFIX}%")
    ).all()

    seed_students = db.query(StudentMaster).filter(
        StudentMaster.full_name.like(f"{SEED_NAME_PREFIX}%")
    ).all()

    seed_subjects = db.query(SubjectMaster).filter(
        SubjectMaster.subject_name.like(f"{SEED_NAME_PREFIX}%")
    ).all()

    seed_chapters = db.query(ChapterMaster).filter(
        ChapterMaster.chapter_name.like(f"{SEED_NAME_PREFIX}%")
    ).all()

    seed_assignments = db.query(AssignmentMaster).filter(
        AssignmentMaster.assignment_title.like(f"{SEED_NAME_PREFIX}%")
    ).all()

    seed_quizzes = db.query(QuizMaster).filter(
        QuizMaster.quiz_title.like(f"{SEED_NAME_PREFIX}%")
    ).all()

    seed_notices = db.query(NoticeBoard).filter(
        NoticeBoard.notice_title.like(f"{SEED_NOTICE_PREFIX}%")
    ).all()

    seed_tickets = db.query(SupportTicket).filter(
        SupportTicket.ticket_number.like(f"{SEED_TICKET_PREFIX}%")
    ).all()

    # Child tables — identified via FK to seeded parents
    seed_class_ids      = [c.class_id      for c in seed_classes]
    seed_teacher_ids    = [t.teacher_id    for t in seed_teachers]
    seed_parent_ids     = [p.parent_id     for p in seed_parents]
    seed_student_ids    = [s.student_id    for s in seed_students]
    seed_assignment_ids = [a.assignment_id for a in seed_assignments]
    seed_quiz_ids       = [q.quiz_id       for q in seed_quizzes]
    seed_ticket_ids     = [t.ticket_id     for t in seed_tickets]

    # Submissions: either the assignment or the student is seeded
    seed_submissions = []
    if seed_assignment_ids or seed_student_ids:
        q = db.query(StudentSubmission)
        if seed_assignment_ids and seed_student_ids:
            from sqlalchemy import or_
            q = q.filter(or_(
                StudentSubmission.assignment_id.in_(seed_assignment_ids),
                StudentSubmission.student_id.in_(seed_student_ids),
            ))
        elif seed_assignment_ids:
            q = q.filter(StudentSubmission.assignment_id.in_(seed_assignment_ids))
        else:
            q = q.filter(StudentSubmission.student_id.in_(seed_student_ids))
        seed_submissions = q.all()

    # Quiz responses: either the quiz or the student is seeded
    seed_responses = []
    if seed_quiz_ids or seed_student_ids:
        q = db.query(QuizResponse)
        if seed_quiz_ids and seed_student_ids:
            from sqlalchemy import or_
            q = q.filter(or_(
                QuizResponse.quiz_id.in_(seed_quiz_ids),
                QuizResponse.student_id.in_(seed_student_ids),
            ))
        elif seed_quiz_ids:
            q = q.filter(QuizResponse.quiz_id.in_(seed_quiz_ids))
        else:
            q = q.filter(QuizResponse.student_id.in_(seed_student_ids))
        seed_responses = q.all()

    # Parent-student maps: either parent or student is seeded
    seed_maps = []
    if seed_parent_ids or seed_student_ids:
        from sqlalchemy import or_
        conditions = []
        if seed_parent_ids:
            conditions.append(ParentStudentMap.parent_id.in_(seed_parent_ids))
        if seed_student_ids:
            conditions.append(ParentStudentMap.student_id.in_(seed_student_ids))
        seed_maps = db.query(ParentStudentMap).filter(or_(*conditions)).all()

    # Ticket messages: ticket is seeded
    seed_messages = []
    if seed_ticket_ids:
        seed_messages = db.query(TicketMessage).filter(
            TicketMessage.ticket_id.in_(seed_ticket_ids)
        ).all()

    return {
        # Root tables (deleted last — UsersMaster is the true root)
        "UsersMaster":               seed_users,
        "ClassMaster":               seed_classes,
        "TeacherMaster":             seed_teachers,
        "ParentMaster":              seed_parents,
        "StudentMaster":             seed_students,
        # Mid-level tables
        "SubjectMaster":             seed_subjects,
        "ChapterMaster":             seed_chapters,
        "AssignmentMaster":          seed_assignments,
        "QuizMaster":                seed_quizzes,
        "NoticeBoard":               seed_notices,
        "SupportTicket":             seed_tickets,
        # Child tables (deleted first)
        "StudentSubmission":         seed_submissions,
        "QuizResponse":              seed_responses,
        "ParentStudentMap":          seed_maps,
        "TicketMessage":             seed_messages,
    }


# ── Preview (DRY RUN) ─────────────────────────────────────────────────────────

def preview_seed_data(db: Session) -> dict:
    """
    Print a detailed report of all seeded records that would be deleted.
    Does NOT write anything to the database.

    Returns
    -------
    dict
        The seed-ID collection produced by _collect_seed_ids().
    """
    seed = _collect_seed_ids(db)
    total = sum(len(v) for v in seed.values())

    print()
    print("=" * 60)
    print("  DRY RUN — Seeded records found (nothing deleted yet)")
    print("=" * 60)

    # Deletion order — children first so FK constraints are respected.
    # UsersMaster is the FK root (subject/class/assignment/notice all reference
    # users_master.user_id), so it must be deleted after those tables are clear.
    ordered_keys = [
        "TicketMessage",
        "SupportTicket",
        "StudentSubmission",
        "QuizResponse",
        "NoticeBoard",
        "AssignmentMaster",
        "QuizMaster",
        "ParentStudentMap",
        "ChapterMaster",
        "SubjectMaster",
        "StudentMaster",
        "ParentMaster",
        "TeacherMaster",
        "ClassMaster",
        "UsersMaster",   # root — deleted last
    ]

    for key in ordered_keys:
        rows = seed.get(key, [])
        count = len(rows)
        print(f"  {key:<35s} {count:>4} record(s)")

        if count and count <= 10:
            # Show full detail for small sets
            for row in rows:
                label = (
                    getattr(row, "full_name",        None) or
                    getattr(row, "notice_title",     None) or
                    getattr(row, "ticket_number",    None) or
                    getattr(row, "assignment_title", None) or
                    getattr(row, "quiz_title",       None) or
                    getattr(row, "subject_name",     None) or
                    getattr(row, "chapter_name",     None) or
                    getattr(row, "class_name",       None) or
                    getattr(row, "comments",         None) or
                    getattr(row, "message",          None) or
                    f"ID={getattr(row, list(row.__mapper__.primary_key)[0].name)}"
                )
                # Truncate long labels
                if label and len(label) > 60:
                    label = label[:57] + "..."
                print(f"       └─ {label}")

        elif count > 10:
            # Show first 3 and a summary for large sets
            for row in rows[:3]:
                label = (
                    getattr(row, "full_name",        None) or
                    getattr(row, "assignment_title", None) or
                    getattr(row, "quiz_title",       None) or
                    getattr(row, "comments",         None) or
                    getattr(row, "message",          None) or
                    f"ID={getattr(row, list(row.__mapper__.primary_key)[0].name)}"
                )
                if label and len(label) > 60:
                    label = label[:57] + "..."
                print(f"       └─ {label}")
            print(f"       └─ … and {count - 3} more")

    print("-" * 60)
    print(f"  Total records to delete : {total}")
    print("=" * 60)

    if total == 0:
        print("\n  No seeded records found. Nothing to clean up.")
    else:
        print()
        print("  To permanently delete these records, run:")
        print("    python cleanup_seed.py --confirm")
        print()

    return seed


# ── Cleanup (actual deletion) ─────────────────────────────────────────────────

def cleanup_seed_data(dry_run: bool = True) -> None:
    """
    Remove all seeded records from the database.

    Parameters
    ----------
    dry_run : bool
        If True (default) only previews what would be deleted.
        If False, performs the deletion inside a transaction.

    Safety guarantees
    -----------------
    • Only records matching seed markers are deleted.
    • Deletion follows FK dependency order — children first, roots last.
    • Everything runs in a single transaction.  If any DELETE fails the
      whole operation rolls back and the database is unchanged.
    • Real data is never touched.
    """
    db: Session = SessionLocal()

    try:
        # Always show the preview so the user knows what is about to happen.
        seed = preview_seed_data(db)
        total = sum(len(v) for v in seed.values())

        if dry_run:
            print("  DRY RUN complete. No changes were made.")
            print("  Pass --confirm to delete the records shown above.")
            return

        if total == 0:
            print("  Nothing to delete.")
            return

        # ── User confirmation guard ────────────────────────────────────────
        print()
        answer = input(
            f"  ⚠  About to permanently delete {total} seeded record(s).\n"
            "     Type  YES  to confirm, anything else to abort: "
        ).strip()

        if answer != "YES":
            print("  Aborted. No changes made.")
            return

        # ── Deletion — FK-safe order (children before parents) ────────────
        print()
        print("  Deleting seeded records...")

        def _delete_batch(rows, label: str) -> int:
            """Delete a list of ORM objects and return count."""
            if not rows:
                return 0
            for row in rows:
                db.delete(row)
            print(f"    ✓  {label:<35s} {len(rows):>4} deleted")
            return len(rows)

        deleted = 0

        # Step 1 — leaf records first (nothing references them)
        deleted += _delete_batch(seed["TicketMessage"],     "TicketMessage")
        deleted += _delete_batch(seed["SupportTicket"],     "SupportTicket")
        deleted += _delete_batch(seed["StudentSubmission"], "StudentSubmission")
        deleted += _delete_batch(seed["QuizResponse"],      "QuizResponse")
        deleted += _delete_batch(seed["NoticeBoard"],       "NoticeBoard")

        # Step 2 — mid-level records (referenced by submissions/responses above)
        deleted += _delete_batch(seed["AssignmentMaster"],           "AssignmentMaster")
        deleted += _delete_batch(seed["QuizMaster"],                 "QuizMaster")

        # Step 3 — mapping table (before removing parent/student rows)
        deleted += _delete_batch(seed["ParentStudentMap"],           "ParentStudentMap")

        # Step 4 — structural records (subject/chapter chains)
        deleted += _delete_batch(seed["ChapterMaster"],              "ChapterMaster")
        deleted += _delete_batch(seed["SubjectMaster"],              "SubjectMaster")

        # Step 5 — root records (no FK dependencies remain by this point)
        deleted += _delete_batch(seed["StudentMaster"],  "StudentMaster")
        deleted += _delete_batch(seed["ParentMaster"],   "ParentMaster")
        deleted += _delete_batch(seed["TeacherMaster"],  "TeacherMaster")
        deleted += _delete_batch(seed["ClassMaster"],    "ClassMaster")
        # UsersMaster last — it is the FK root for subject/class/assignment/notice
        deleted += _delete_batch(seed["UsersMaster"],    "UsersMaster")

        # ── Commit ────────────────────────────────────────────────────────
        db.commit()

        print()
        print("=" * 60)
        print(f"  ✓  Cleanup complete — {deleted} record(s) permanently removed")
        print("=" * 60)
        print("  All TEST_/SEED_ records have been deleted.")
        print("  Production data was not touched.")
        print()

    except Exception as exc:
        db.rollback()
        print()
        print("=" * 60)
        print("  ✗  Cleanup FAILED — transaction rolled back")
        print("=" * 60)
        print(f"  Error : {exc}")
        print("  The database was not modified.")
        raise

    finally:
        db.close()


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        prog="cleanup_seed",
        description=(
            "Preview or permanently delete TEST_/SEED_ records "
            "inserted by mock_data.py."
        ),
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        default=False,
        help=(
            "Actually delete the seeded records. "
            "Without this flag the script runs in DRY RUN mode (preview only)."
        ),
    )
    args = parser.parse_args()

    # dry_run=True  → safe preview, no writes
    # dry_run=False → interactive confirmation then hard delete
    cleanup_seed_data(dry_run=not args.confirm)
