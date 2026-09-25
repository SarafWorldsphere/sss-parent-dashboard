"""
mock_data.py — RDS-Safe Seed Script
=====================================
Inserts clearly-labelled TEST_ / SEED_ records into existing RDS tables
so the Parent Dashboard application can be exercised end-to-end against
real infrastructure without touching production data.

WHAT THIS SCRIPT DOES
─────────────────────
• Inserts temporary records into existing tables only.
• Every record is tagged with an unmistakable prefix so cleanup_seed.py
  can find and delete them later without touching anything else.
• Uses a single database transaction — if any insert fails, the whole
  operation rolls back and the database is left exactly as it was.

WHAT THIS SCRIPT INTENTIONALLY DOES NOT DO
───────────────────────────────────────────
• Does NOT call Base.metadata.drop_all()    ← would destroy real data
• Does NOT call Base.metadata.create_all()  ← can corrupt RDS schema
• Does NOT truncate any table               ← would delete production rows
• Does NOT modify any existing row          ← read-only pass on real data

SEED MARKERS (used by cleanup_seed.py)
───────────────────────────────────────
  full_name  starts with  "TEST_"     → ClassMaster, StudentMaster,
                                         ParentMaster, TeacherMaster
  email      contains     "_seed@"    → ParentMaster, TeacherMaster
  notice_title starts with "SEED_"   → NoticeBoard
  ticket_number starts with "SEED-"  → SupportTicket
  All other seeded text fields contain "TEST_" so they are easy to spot.

USAGE
─────
  # Insert seed data
  python mock_data.py

  # Preview what cleanup_seed.py would remove (no deletion)
  python cleanup_seed.py

  # Remove seeded records after testing
  python cleanup_seed.py --confirm
"""

import uuid
import random
from datetime import datetime, date, timedelta
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

# ── Seed-marker constants ─────────────────────────────────────────────────────
# These must stay in sync with the matching constants in cleanup_seed.py.
SEED_NAME_PREFIX   = "TEST_"   # prepended to every full_name / class_name
SEED_EMAIL_TAG     = "_seed"   # inserted before @ in every email address
SEED_NOTICE_PREFIX = "SEED_"  # prepended to every notice_title
SEED_TICKET_PREFIX = "SEED-"  # prepended to every ticket_number


# ── Helper builders ───────────────────────────────────────────────────────────

def _name(raw: str) -> str:
    """Return a name with the seed prefix attached."""
    return f"{SEED_NAME_PREFIX}{raw}"


def _email(local_part: str) -> str:
    """Build a tagged seed email address: local_part_seed@example.com"""
    return f"{local_part}{SEED_EMAIL_TAG}@example.com"


# ── Main seed function ────────────────────────────────────────────────────────

def seed_data(verbose: bool = True) -> None:
    """
    Insert TEST_/SEED_ prefixed records into the existing database.

    Parameters
    ----------
    verbose : bool
        Print progress messages (default True).

    Raises
    ------
    Exception
        Re-raises any database error after rolling back the transaction.
    """

    db: Session = SessionLocal()
    today = date.today()
    now   = datetime.utcnow()

    try:
        # ══════════════════════════════════════════════════════════════════════
        # 1. CLASSES
        #    class_name prefixed with TEST_ so cleanup can find them.
        #    class_teacher_id is left NULL here and back-filled in section 5
        #    once teacher-user PKs are available (FK → users_master.user_id).
        # ══════════════════════════════════════════════════════════════════════
        if verbose:
            print("[1/12] Seeding classes...")

        class_defs = [
            ("10th Grade", "A"),
            ("10th Grade", "B"),
            ("9th Grade",  "A"),
            ("8th Grade",  "A"),
        ]
        classes = []
        for cname, sec in class_defs:
            c = ClassMaster(
                class_name=_name(cname),
                section_name=sec,
                academic_year=_name("2025-26"),
                # class_teacher_id populated after teacher users are flushed (§5)
            )
            db.add(c)
            classes.append(c)

        # db.flush() assigns auto-generated PKs without committing.
        # All subsequent objects can then reference those PKs safely.
        db.flush()

        # ══════════════════════════════════════════════════════════════════════
        # 2. PARENTS
        #    Identified by full_name LIKE 'TEST_%' AND email LIKE '%_seed@%'
        # ══════════════════════════════════════════════════════════════════════
        if verbose:
            print("[2/12] Seeding parents...")

        parent_defs = [
            ("Priya Sharma", "priya",   "0000000001"),
            ("Rahul Sharma", "rahul",   "0000000002"),
            ("Amit Singh",   "amit",    "0000000003"),
        ]
        parents = []
        for fname, elocal, phone in parent_defs:
            p = ParentMaster(
                full_name=_name(fname),
                email=_email(elocal),
                phone=phone,
            )
            db.add(p)
            parents.append(p)
        db.flush()

        p_priya, p_rahul, p_amit = parents

        # ══════════════════════════════════════════════════════════════════════
        # 3. STUDENTS
        #    Identified by full_name LIKE 'TEST_%'
        # ══════════════════════════════════════════════════════════════════════
        if verbose:
            print("[3/12] Seeding students...")

        student_defs = [
            ("Rohit Sharma", classes[0], "A", "012"),
            ("Riya Sharma",  classes[2], "A", "025"),
            ("Aryan Sharma", classes[3], "A", "005"),
            ("Jane Singh",   classes[0], "A", "014"),
            ("Bob Singh",    classes[1], "B", "002"),
        ]
        students = []
        for fname, cls, sec, roll in student_defs:
            s = StudentMaster(
                full_name=_name(fname),
                class_id=cls.class_id,
                section=sec,
                roll_no=roll,
                admission_no=f"TEST-ADM-{roll}",
            )
            db.add(s)
            students.append(s)
        db.flush()

        s_rohit, s_riya, s_aryan, s_jane, s_bob = students

        # ══════════════════════════════════════════════════════════════════════
        # 4. PARENT ↔ STUDENT MAPPINGS
        # ══════════════════════════════════════════════════════════════════════
        if verbose:
            print("[4/12] Seeding parent-student mappings...")

        mapping_defs = [
            (p_priya, s_rohit, "mother"),
            (p_priya, s_riya,  "mother"),
            (p_priya, s_aryan, "mother"),
            (p_rahul, s_rohit, "father"),   # two parents linked to same child
            (p_amit,  s_jane,  "father"),
            (p_amit,  s_bob,   "father"),
        ]
        for parent, student, rel in mapping_defs:
            db.add(ParentStudentMap(
                parent_id=parent.parent_id,
                student_id=student.student_id,
                relationship_type=rel,
            ))
        db.flush()

        # ══════════════════════════════════════════════════════════════════════
        # 5. TEACHERS
        #    Identified by full_name LIKE 'TEST_%'
        #    NOTE: Python attr is `email` — it writes to the physical `email_id`
        #    column via SQLAlchemy column aliasing (no code change needed).
        # ══════════════════════════════════════════════════════════════════════
        if verbose:
            print("[5/12] Seeding teachers...")

        teacher_defs = [
            ("Mrs. Anjali Verma", "anjali",  "Mathematics"),
            ("Mr. Rahul Mehta",   "rmehta",  "Science"),
            ("Miss Kavita Roy",   "kavita",  "English"),
            ("Mr. Suresh Kumar",  "suresh",  "Social Studies"),
            ("Mrs. Sunita Devi",  "sunita",  "Mathematics"),
        ]
        teachers = []
        for tname, elocal, subj in teacher_defs:
            t = TeacherMaster(
                full_name=_name(tname),
                email=_email(elocal),           # maps to physical col email_id
                phone=random.randint(9_000_000_000, 9_999_999_999),
                subject_name=_name(subj),
                role="Teacher",
            )
            db.add(t)
            teachers.append(t)
        db.flush()

        # ══════════════════════════════════════════════════════════════════════
        # 5b. TEACHER USERS  (UsersMaster)
        #
        #     Production FK hierarchy:
        #       sss_subject_master.teacher_id     → sss_users_master.user_id
        #       sss_class_master.class_teacher_id → sss_users_master.user_id
        #       sss_assignment_master.assigned_by → sss_users_master.user_id
        #       sss_notice_board.posted_by        → sss_users_master.user_id
        #
        #     One UsersMaster row is created for every teacher_def.
        #     After flushing, class_teacher_id is back-filled on existing
        #     ClassMaster rows so all FK columns carry valid user_ids.
        #
        #     Identified by full_name LIKE 'TEST_%' (same prefix as teachers).
        # ══════════════════════════════════════════════════════════════════════
        if verbose:
            print("[5b] Seeding teacher users (UsersMaster)...")

        teacher_users = []
        for tname, elocal, _subj in teacher_defs:
            u = UsersMaster(
                login_id=_email(elocal),          # unique login; seed-tagged email
                password_hash="seed_dummy_hash",
                full_name=_name(tname),
                email=_email(elocal),             # maps to physical col email_id
                mobile_no=str(random.randint(9_000_000_000, 9_999_999_999)),
                is_active=True,
            )
            db.add(u)
            teacher_users.append(u)
        db.flush()   # populates user_id PKs

        # Back-fill class_teacher_id now that user_ids are assigned.
        # Round-robins teacher users across classes (1 teacher user per class).
        for i, cls in enumerate(classes):
            cls.class_teacher_id = teacher_users[i % len(teacher_users)].user_id
        db.flush()

        # ══════════════════════════════════════════════════════════════════════
        # 6. SUBJECTS
        #    teacher_id → users_master.user_id  (production FK target)
        #    Identified by subject_name LIKE 'TEST_%'
        # ══════════════════════════════════════════════════════════════════════
        if verbose:
            print("[6/12] Seeding subjects...")

        subject_names = ["Mathematics", "Science", "English"]
        subjects = []
        for cls in classes:
            # Pair each subject with the corresponding teacher user (by position).
            # teacher_users[i].user_id is the correct FK for users_master.
            for sname, t_user in zip(subject_names, teacher_users[:3]):
                sub = SubjectMaster(
                    class_id=cls.class_id,
                    subject_name=_name(sname),
                    subject_code=f"TEST-{sname[:3].upper()}",
                    teacher_id=t_user.user_id,   # → users_master.user_id
                )
                db.add(sub)
                subjects.append(sub)
        db.flush()

        # ══════════════════════════════════════════════════════════════════════
        # 7. CHAPTERS
        #    Identified by chapter_name LIKE 'TEST_%'
        # ══════════════════════════════════════════════════════════════════════
        if verbose:
            print("[7/12] Seeding chapters...")

        chapters = []
        for sub in subjects:
            for i in range(1, 4):
                ch = ChapterMaster(
                    subject_id=sub.subject_id,
                    chapter_no=i,
                    chapter_name=_name(f"{sub.subject_name} Ch.{i}"),
                    chapter_description=f"TEST_ Chapter {i} description.",
                    chapter_order=i,
                )
                db.add(ch)
                chapters.append(ch)
        db.flush()

        # ══════════════════════════════════════════════════════════════════════
        # 8. ASSIGNMENTS + SUBMISSIONS
        #    Assignments identified by assignment_title LIKE 'TEST_%'
        #    Submissions linked to seeded assignment IDs and student IDs.
        # ══════════════════════════════════════════════════════════════════════
        if verbose:
            print("[8/12] Seeding assignments and submissions...")

        for student in students:
            # Chapters that belong to this student's class
            student_chapters = [
                ch for ch in chapters
                if any(
                    sub.subject_id == ch.subject_id
                    and sub.class_id == student.class_id
                    for sub in subjects
                )
            ]
            if not student_chapters:
                continue

            for _ in range(random.randint(10, 15)):
                ch  = random.choice(student_chapters)
                sub = next(s for s in subjects if s.subject_id == ch.subject_id)
                # sub.teacher_id is already a users_master.user_id (set in §6).
                # No TeacherMaster lookup needed — assigned_by FKs to users_master.

                days_offset = random.randint(-90, 14)
                due_date    = today + timedelta(days=days_offset)

                assignment = AssignmentMaster(
                    chapter_id=ch.chapter_id,
                    assignment_title=_name(
                        f"{sub.subject_name} Assignment: {ch.chapter_name}"
                    ),
                    assignment_text=f"TEST_ Complete all exercises in {ch.chapter_name}.",
                    due_date=due_date,
                    assigned_by=sub.teacher_id,   # user_id → users_master.user_id
                )
                db.add(assignment)
                db.flush()   # need assignment_id for submission FK

                # Submission logic: past-due assignments mostly submitted;
                # future assignments submitted 30 % of the time.
                will_submit = (
                    (due_date < today  and random.random() < 0.85) or
                    (due_date >= today and random.random() < 0.30)
                )
                if will_submit:
                    submit_date = due_date - timedelta(days=random.randint(0, 3))
                    db.add(StudentSubmission(
                        assignment_id=assignment.assignment_id,
                        student_id=student.student_id,
                        submission_text="TEST_ Attached homework PDF.",
                        marks_obtained=round(random.uniform(5.0, 10.0), 1),
                        teacher_remarks=random.choice([
                            "TEST_ Excellent work!",
                            "TEST_ Good effort — review Q3.",
                            "TEST_ Perfect submission.",
                            "TEST_ Needs improvement.",
                        ]),
                        submitted_at=datetime.combine(
                            submit_date, datetime.min.time()
                        ),
                    ))

        db.flush()

        # ══════════════════════════════════════════════════════════════════════
        # 9. QUIZZES + RESPONSES
        #    Quizzes identified by quiz_title LIKE 'TEST_%'
        # ══════════════════════════════════════════════════════════════════════
        if verbose:
            print("[9/12] Seeding quizzes and responses...")

        for student in students:
            student_chapters = [
                ch for ch in chapters
                if any(
                    sub.subject_id == ch.subject_id
                    and sub.class_id == student.class_id
                    for sub in subjects
                )
            ]
            if not student_chapters:
                continue

            for _ in range(random.randint(8, 12)):
                ch = random.choice(student_chapters)
                quiz = QuizMaster(
                    chapter_id=ch.chapter_id,
                    quiz_title=_name(f"Pop Quiz: {ch.chapter_name}"),
                    total_marks=20,
                    duration_minutes=30,
                )
                db.add(quiz)
                db.flush()

                if random.random() < 0.90:   # 90 % completion rate
                    db.add(QuizResponse(
                        quiz_id=quiz.quiz_id,
                        student_id=student.student_id,
                        score=round(random.uniform(5.0, 20.0), 2),
                        completed_flag=True,
                    ))

        db.flush()

        # ══════════════════════════════════════════════════════════════════════
        # 10. NOTICES
        #     posted_by → users_master.user_id  (production FK target)
        #     Identified by notice_title LIKE 'SEED_%'
        # ══════════════════════════════════════════════════════════════════════
        if verbose:
            print("[10/12] Seeding notices...")

        notice_templates = [
            ("PTM Scheduled",   "Parent-Teacher Meeting is scheduled for next week."),
            ("School Closed",   "School will remain closed tomorrow."),
            ("Fee Reminder",    "Please submit the pending fees by month-end."),
            ("Exam Schedule",   "Half-yearly examinations begin from the 15th."),
            ("Sports Day",      "Annual Sports Meet is scheduled."),
            ("Achievement",     "Our school won the inter-school science fair!"),
        ]

        for cls in classes:
            for _ in range(6):
                ntitle, ntext = random.choice(notice_templates)
                days_ago = random.randint(1, 90)

                notice = NoticeBoard(
                    notice_title=f"{SEED_NOTICE_PREFIX}{ntitle} ({cls.class_name})",
                    notice_text=f"TEST_ {ntext}",
                    notice_date=today - timedelta(days=days_ago),
                    applicable_class=cls.class_name,
                    posted_by=random.choice(teacher_users).user_id,  # → users_master
                )
                # created_at is aliased to physical col created_datetime
                notice.created_at = now - timedelta(days=days_ago)
                db.add(notice)

        db.flush()

        # ══════════════════════════════════════════════════════════════════════
        # 11. SUPPORT TICKETS + MESSAGES  (Communication Center)
        #     Tickets identified by ticket_number LIKE 'SEED-%'
        #     Messages identified by ticket_id IN [seeded ticket IDs]
        #
        #     NOTE: TeacherParentInteractionV2 seeding removed — that table
        #     (teacher_parent_interaction) does NOT exist on SSS RDS.
        #     Teacher remarks are now represented by TicketMessage rows with
        #     sender_type='TEACHER' so the Remarks widget still has data.
        # ══════════════════════════════════════════════════════════════════════
        if verbose:
            print("[11/11] Seeding support tickets and messages (incl. teacher remarks)...")

        ticket_subjects = [
            "Academic Progress Query",
            "Quiz Score Clarification",
            "Assignment Extension Request",
            "Fee Structure Inquiry",
            "General Academic Guidance",
        ]

        for student in students:
            # Find this student's parent from the mappings we just inserted
            parent_maps = [           pm for pm in db.query(ParentStudentMap)
                             .filter(ParentStudentMap.student_id == student.student_id)
                             .all()
            ]
            if not parent_maps:
                continue

            chosen_parent_id = random.choice(parent_maps).parent_id
            parent_obj = db.query(ParentMaster).filter(
                ParentMaster.parent_id == chosen_parent_id
            ).first()
            parent_display = (
                parent_obj.full_name.replace(SEED_NAME_PREFIX, "")
                if parent_obj else "Parent"
            )

            for _ in range(3):
                subj       = random.choice(ticket_subjects)
                ticket_ref = f"{SEED_TICKET_PREFIX}{str(uuid.uuid4())[:8].upper()}"
                teacher    = random.choice(teachers)

                ticket = SupportTicket(
                    ticket_number=ticket_ref,
                    parent_id=chosen_parent_id,
                    student_id=student.student_id,
                    subject=_name(subj),
                    category=random.choice(["Academic", "Administrative", "Fee"]),
                    priority=random.choice(["LOW", "MEDIUM", "HIGH"]),
                    status=random.choice(["OPEN", "CLOSED"]),
                    recipient_name=_name(
                        teacher.full_name.replace(SEED_NAME_PREFIX, "")
                    ),
                )
                db.add(ticket)
                db.flush()   # need ticket_id for message FK

                # 2-4 alternating parent / teacher messages per ticket
                for i in range(random.randint(2, 4)):
                    sender = "PARENT" if i % 2 == 0 else "TEACHER"
                    sender_display = (
                        parent_display if sender == "PARENT"
                        else teacher.full_name.replace(SEED_NAME_PREFIX, "")
                    )
                    db.add(TicketMessage(
                        ticket_id=ticket.ticket_id,
                        sender_type=sender,
                        sender_name=_name(sender_display),
                        message=_name(f"Message {i + 1} regarding: {subj}."),
                        is_read=(sender == "PARENT"),
                    ))

        db.flush()

        # ══════════════════════════════════════════════════════════════════════
        # COMMIT — single atomic transaction
        # If anything above raised an exception the except block will roll back.
        # ══════════════════════════════════════════════════════════════════════
        db.commit()

        if verbose:
            print("\n" + "=" * 55)
            print("  ✓  Seed data inserted successfully")
            print("=" * 55)
            print(f"  Teacher users (UsersMaster) : {len(teacher_users)}")
            print(f"  Classes                    : {len(classes)}")
            print(f"  Parents                    : {len(parents)}")
            print(f"  Students                   : {len(students)}")
            print(f"  Teachers (TeacherMaster)   : {len(teachers)}")
            print(f"  Subjects                   : {len(subjects)}")
            print(f"  Chapters                   : {len(chapters)}")
            print()
            print("  Every record carries a TEST_ or SEED_ marker.")
            print("  FK columns (teacher_id / assigned_by / posted_by)")
            print("  reference users_master.user_id — aligned with SSS RDS.")
            print("  Run  python cleanup_seed.py          to preview cleanup.")
            print("  Run  python cleanup_seed.py --confirm  to delete.")
            print("=" * 55)

    except Exception as exc:
        db.rollback()
        print("\n" + "=" * 55)
        print("  ✗  Seed FAILED — transaction rolled back")
        print("=" * 55)
        print(f"  Error : {exc}")
        print("  The database was not modified.")
        raise

    finally:
        db.close()


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    seed_data()
import os

USE_MOCK_DATA = os.getenv("USE_MOCK_DATA", "false").lower() == "true"
