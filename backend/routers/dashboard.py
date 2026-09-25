import logging
import os
import uuid

from pathlib import Path
from datetime import datetime, date, timedelta
from typing import List, Dict, Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
)

from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db

UPLOAD_ROOT = Path(
    os.getenv(
        "ASSIGNMENT_UPLOAD_ROOT",
        "uploads"
    )
) / "assignments"

UPLOAD_ROOT.mkdir(
    parents=True,
    exist_ok=True
)

logger = logging.getLogger(__name__)
from services.dashboard_service import get_dashboard_data
# DISABLED: analytics_service only served GET /analytics/ which has no frontend caller
# from services.analytics_service import get_analytics_data
from schemas import (
    DashboardResponse, MappedChildSchema, AssignmentSchema, QuizSchema, QuizDetailResponse,
    RemarkSchema, NoticeSchema, CallRequestCreate, CallRequestResponse,
    AssignmentSubmitRequest, AssignmentAnalyticsResponse, NotificationSchema,
    # DISABLED: AttendanceDataResponse, AttendanceOverviewSchema, AttendanceDaySchema
    #           — attendance module removed from parent portal.
    # DISABLED: LeaveRequestCreate, LeaveRequestResponse, LeaveStatusUpdate
    #           — standalone leave-request endpoints disabled; flow moved to Communication Center.
    # DISABLED: AnalyticsResponse — analytics module removed from frontend.
)
from models import (
    ParentMaster, ParentStudentMap, StudentMaster, ClassMaster, AssignmentMaster, SubjectMaster,
    ChapterMaster, StudentSubmission, QuizMaster, QuizResponse,
    UsersMaster, NoticeBoard,
    SupportTicket, TicketMessage,
    # DISABLED: CallRequest   — call-request routes commented out below.
    # DISABLED: AttendanceMaster — attendance endpoints commented out below.
    # DISABLED: LeaveRequest     — leave-request endpoints commented out below.
    # DISABLED: TeacherParentInteractionV2 — table absent on SSS RDS; remarks
    #           now come from TicketMessage (sender_type='TEACHER') instead.
    # NOTE: TeacherMaster removed — assigned_by / posted_by now FK to
    #       users_master.user_id; all teacher-name JOINs use UsersMaster.
)

router = APIRouter()

@router.get("/dashboard/{student_id}", response_model=DashboardResponse)
def get_dashboard(student_id: int, db: Session = Depends(get_db)):
    try:
        return get_dashboard_data(db, student_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── DISABLED: Analytics route ─────────────────────────────────────────────
# GET /analytics/{student_id} had no frontend caller after /parent/analytics
# page was removed. analytics_service.py is preserved on disk for reference.
# Restore by uncommenting this block and re-enabling the analytics_service
# import at the top of this file.
#
# @router.get("/analytics/{student_id}", response_model=AnalyticsResponse)
# def get_analytics(student_id: int, db: Session = Depends(get_db)):
#     try:
#         return get_analytics_data(db, student_id)
#     except HTTPException as e:
#         raise e
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
# ──────────────────────────────────────────────────────────────────────────

# ── DISABLED: Communication timeline route ────────────────────────────────
# GET /communication/timeline/{student_id} had no frontend caller. The new
# Communication Center uses /comm/ routes instead. TimelineItemSchema also
# disabled in schemas.py. Restore together if a timeline view is re-added.
#
# from schemas import TimelineItemSchema
#
# @router.get("/communication/timeline/{student_id}", response_model=List[TimelineItemSchema])
# def get_communication_timeline(student_id: int, db: Session = Depends(get_db)):
#     try:
#         timeline = []
#         calls = db.query(CallRequest, TeacherMaster.full_name).outerjoin(...).all()
#         ... (full implementation preserved in git history)
#         return [TimelineItemSchema(**item) for item in timeline]
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
# ──────────────────────────────────────────────────────────────────────────

@router.get("/parents/by-email")
def get_parent_by_email(
    email: str,
    db: Session = Depends(get_db)
):
    parent = (
        db.query(ParentMaster)
        .filter(ParentMaster.email == email)
        .first()
    )

    if not parent:
        raise HTTPException(
            status_code=404,
            detail="Parent not found"
        )

    return {
        "parent_id": parent.parent_id,
        "full_name": parent.full_name or "",
        "email": parent.email or "",
    }

@router.get("/parents/{parent_id}/children", response_model=List[MappedChildSchema])
def get_parent_children(parent_id: int, db: Session = Depends(get_db)):
    children_query = (
        db.query(StudentMaster, ClassMaster)
        .join(
            ParentStudentMap,
            ParentStudentMap.student_id == StudentMaster.student_id
        )
        .outerjoin(
            ClassMaster,
            StudentMaster.class_id == ClassMaster.class_id
        )
        .filter(ParentStudentMap.parent_id == parent_id)
        .all()
    )

    result = []

    for student, class_info in children_query:
        class_name = ""

        if class_info:
            class_name = class_info.class_name or ""
        else:
            class_name = getattr(student, "class_name", "") or ""

        result.append(
            MappedChildSchema(
                student_id=student.student_id,
                full_name=student.full_name,
                class_name=class_name,
                section=student.section or ""
            )
        )

    logger.info(
        "[parents/children] parent_id=%s → %d children found",
        parent_id,
        len(result)
    )

    return result

@router.get(
    "/assignments/history/{student_id}",
    response_model=List[AssignmentSchema]
)
def get_assignments_history(
    student_id: int,
    db: Session = Depends(get_db)
):
    logger.info(
        "[assignments/history] Request received: student_id=%s",
        student_id
    )

    try:

        # =========================================================
        # 1. CHECK STUDENT
        # =========================================================

        student = (
            db.query(StudentMaster)
            .filter(
                StudentMaster.student_id == student_id
            )
            .first()
        )

        if not student:
            logger.warning(
                "[assignments/history] Student not found: %s",
                student_id
            )
            return []

        # =========================================================
        # 2. GET ASSIGNMENTS + SUBMISSIONS
        # =========================================================

        assignments_query = (
            db.query(
                AssignmentMaster,
                SubjectMaster.subject_name,
                ChapterMaster.chapter_name,
                UsersMaster.full_name,
                StudentSubmission
            )
            .select_from(AssignmentMaster)

            .join(
                ChapterMaster,
                AssignmentMaster.chapter_id ==
                ChapterMaster.chapter_id
            )

            .join(
                SubjectMaster,
                ChapterMaster.subject_id ==
                SubjectMaster.subject_id
            )

            .outerjoin(
                UsersMaster,
                AssignmentMaster.assigned_by ==
                UsersMaster.user_id
            )

            .outerjoin(
                StudentSubmission,
                (
                    StudentSubmission.assignment_id ==
                    AssignmentMaster.assignment_id
                )
                &
                (
                    StudentSubmission.student_id ==
                    student_id
                )
            )

            .filter(
                SubjectMaster.class_id ==
                student.class_id
            )

            .order_by(
                AssignmentMaster.due_date.desc()
            )

            .all()
        )

        # =========================================================
        # 3. BUILD RESPONSE
        # =========================================================

        assignment_list = []

        today = date.today()

        for (
            assign,
            subject_name,
            chapter_name,
            teacher_name,
            submission
        ) in assignments_query:

            # =====================================================
            # STATUS
            # =====================================================

            if submission:

                status = (
                    "Graded"
                    if submission.marks_obtained is not None
                    else "Submitted"
                )

            elif (
                assign.due_date
                and assign.due_date < today
            ):

                status = "Overdue"

            elif (
                assign.due_date
                and (assign.due_date - today).days <= 7
            ):

                status = "Ongoing"

            else:

                status = "Upcoming"

            # =====================================================
            # SUBMISSION FILE INFORMATION
            # =====================================================

            submission_file_path = (
                submission.file_path
                if submission
                else None
            )

            file_url = None
            file_name = None
            drive_link = None

            if submission_file_path:

                # -------------------------------------------------
                # Google Drive / Google Docs
                # -------------------------------------------------

                if (
                    submission_file_path.startswith(
                        "https://drive.google.com/"
                    )
                    or
                    submission_file_path.startswith(
                        "https://docs.google.com/"
                    )
                ):

                    drive_link = submission_file_path

                    logger.info(
                        "[assignments/history] "
                        "Drive link found: assignment_id=%s, "
                        "student_id=%s",
                        assign.assignment_id,
                        student_id
                    )

                # -------------------------------------------------
                # Uploaded PDF / Word / Image
                # -------------------------------------------------

                elif submission_file_path.startswith(
                    "/uploads/"
                ):

                    file_url = submission_file_path

                    file_name = Path(
                        submission_file_path
                    ).name

                    logger.info(
                        "[assignments/history] "
                        "Uploaded file found: "
                        "assignment_id=%s, "
                        "student_id=%s, "
                        "file_name=%s",
                        assign.assignment_id,
                        student_id,
                        file_name
                    )

            # =====================================================
            # RESPONSE
            # =====================================================

            assignment_data = AssignmentSchema(

                assignment_id=
                    assign.assignment_id,

                assignment_title=
                    assign.assignment_title,

                assignment_text=
                    assign.assignment_text,

                subject=
                    subject_name or "",

                chapter_name=
                    chapter_name or "",

                teacher_name=
                    teacher_name or "",

                due_date=(
                    assign.due_date.isoformat()
                    if assign.due_date
                    else ""
                ),

                status=status,

                marks_obtained=(
                    submission.marks_obtained
                    if submission
                    else None
                ),

                total_marks=(
                    submission.total_marks
                    if submission
                    and hasattr(
                        submission,
                        "total_marks"
                    )
                    else None
                ),

                submitted_at=(
                    submission.submitted_at.isoformat()
                    if submission
                    and submission.submitted_at
                    else None
                ),

                # =================================================
                # STUDENT SUBMISSION
                # =================================================

                submission_text=(
                    submission.submission_text
                    if submission
                    else None
                ),

                teacher_remarks=(
                    submission.teacher_remarks
                    if submission
                    else None
                ),

                # Original stored value
                file_path=
                    submission_file_path,

                # Uploaded file URL/path
                file_url=
                    file_url,

                # Uploaded file name
                file_name=
                    file_name,

                # Keep compatibility with frontend
                filename=
                    file_name,

                # Attachment value for frontend
                attachment=
                    file_url,

                # Google Drive / Docs
                drive_link=
                    drive_link
            )

            assignment_list.append(
                assignment_data
            )

            logger.info(
                "[assignments/history] "
                "assignment_id=%s, "
                "student_id=%s, "
                "submission_exists=%s, "
                "submission_text=%s, "
                "file_path=%s, "
                "file_url=%s, "
                "file_name=%s, "
                "drive_link=%s",
                assign.assignment_id,
                student_id,
                bool(submission),
                submission.submission_text
                if submission
                else None,
                submission_file_path,
                file_url,
                file_name,
                drive_link
            )

        # =========================================================
        # 4. FINAL LOG
        # =========================================================

        logger.info(
            "[assignments/history] "
            "student_id=%s → %d assignments",
            student_id,
            len(assignment_list)
        )

        return assignment_list

    except Exception as e:

        logger.exception(
            "[assignments/history] Internal error"
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    
@router.get("/assignments/analytics/{student_id}", response_model=AssignmentAnalyticsResponse)
def get_assignment_analytics(student_id: int, db: Session = Depends(get_db)):
    student = db.query(StudentMaster).filter(StudentMaster.student_id == student_id).first()
    if not student:
        logger.warning("[assignments/analytics] student_id=%s not found → returning zeroes", student_id)
        return AssignmentAnalyticsResponse(total=0, submitted=0, pending=0, overdue=0, graded=0, completion_pct=0.0)

    rows = db.query(AssignmentMaster, StudentSubmission)\
        .select_from(AssignmentMaster)\
        .join(ChapterMaster, AssignmentMaster.chapter_id == ChapterMaster.chapter_id)\
        .join(SubjectMaster, ChapterMaster.subject_id == SubjectMaster.subject_id)\
        .outerjoin(StudentSubmission, (StudentSubmission.assignment_id == AssignmentMaster.assignment_id) & (StudentSubmission.student_id == student_id))\
        .filter(SubjectMaster.class_id == student.class_id).all()

    today = date.today()
    total = len(rows)
    submitted = sum(1 for a, s in rows if s and s.marks_obtained is None)
    graded = sum(1 for a, s in rows if s and s.marks_obtained is not None)
    overdue = sum(1 for a, s in rows if not s and a.due_date and a.due_date < today)
    ongoing = sum(1 for a, s in rows if not s and a.due_date and a.due_date >= today and (a.due_date - today).days <= 7)
    upcoming = sum(1 for a, s in rows if not s and (not a.due_date or (a.due_date >= today and (a.due_date - today).days > 7)))
    completion_pct = round((submitted + graded) / total * 100, 1) if total > 0 else 0.0
    return AssignmentAnalyticsResponse(total=total, submitted=submitted, pending=ongoing, overdue=overdue, graded=graded, completion_pct=completion_pct)

# =========================================================
# ASSIGNMENT SUBMISSION
# =========================================================

UPLOAD_DIR = Path("uploads/assignments")

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".jpg",
    ".jpeg",
    ".png",
}

MAX_FILE_SIZE = 10 * 1024 * 1024


@router.post(
    "/assignments/submit",
    response_model=AssignmentSchema
)
async def submit_assignment(
    assignment_id: int = Form(...),
    student_id: int = Form(...),
    submission_text: str = Form(...),

    # Google Drive / Google Docs link
    drive_link: str | None = Form(None),

    # PDF / Word / image attachment
    file: UploadFile | None = File(None),

    db: Session = Depends(get_db)
):
    logger.info(
        "[assignments/submit] Request received: "
        "assignment_id=%s, student_id=%s, "
        "submission_text=%s, drive_link=%s, file=%s",
        assignment_id,
        student_id,
        submission_text,
        drive_link,
        file.filename if file else None
    )

    try:

        # =========================================================
        # 1. VALIDATE SUBMISSION TEXT
        # =========================================================

        submission_text = (
            submission_text.strip()
            if submission_text
            else ""
        )

        if not submission_text:
            raise HTTPException(
                status_code=400,
                detail="Submission text is required."
            )

        # =========================================================
        # 2. VALIDATE FILE / DRIVE LINK
        # =========================================================

        if file and drive_link:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Please upload a file OR provide a "
                    "Google Drive link, not both."
                )
            )

        allowed_extensions = {
            ".pdf",
            ".doc",
            ".docx",
            ".jpg",
            ".jpeg",
            ".png",
        }

        allowed_content_types = {
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/jpeg",
            "image/png",
        }

        if file:

            original_filename = (
                file.filename or ""
            ).strip()

            if not original_filename:
                raise HTTPException(
                    status_code=400,
                    detail="Uploaded file has no filename."
                )

            extension = (
                Path(original_filename)
                .suffix
                .lower()
            )

            if extension not in allowed_extensions:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Only PDF, DOC, DOCX, JPG, "
                        "JPEG and PNG files are allowed."
                    )
                )

            if (
                file.content_type
                and file.content_type
                not in allowed_content_types
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Unsupported file type."
                    )
                )

        # =========================================================
        # 3. CHECK ASSIGNMENT
        # =========================================================

        assign_row = (
            db.query(
                AssignmentMaster,
                SubjectMaster.subject_name,
                ChapterMaster.chapter_name,
                UsersMaster.full_name
            )
            .join(
                ChapterMaster,
                AssignmentMaster.chapter_id
                == ChapterMaster.chapter_id
            )
            .join(
                SubjectMaster,
                ChapterMaster.subject_id
                == SubjectMaster.subject_id
            )
            .outerjoin(
                UsersMaster,
                AssignmentMaster.assigned_by
                == UsersMaster.user_id
            )
            .filter(
                AssignmentMaster.assignment_id
                == assignment_id
            )
            .first()
        )

        if not assign_row:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Assignment {assignment_id} not found"
                )
            )

        (
            assign,
            subject_name,
            chapter_name,
            teacher_name
        ) = assign_row

        # =========================================================
        # 4. CHECK STUDENT
        # =========================================================

        student = (
            db.query(StudentMaster)
            .filter(
                StudentMaster.student_id
                == student_id
            )
            .first()
        )

        if not student:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Student {student_id} not found"
                )
            )

        # =========================================================
        # 5. FIND EXISTING SUBMISSION
        # =========================================================

        existing = (
            db.query(StudentSubmission)
            .filter(
                StudentSubmission.assignment_id
                == assignment_id,

                StudentSubmission.student_id
                == student_id
            )
            .first()
        )

        # =========================================================
        # 6. DETERMINE NEW FILE PATH
        # =========================================================

        new_file_path = None

        if file:

            # -----------------------------------------------------
            # Read file and enforce 10 MB limit
            # -----------------------------------------------------

            max_file_size = (
                10 * 1024 * 1024
            )

            file_content = (
                await file.read()
            )

            if len(file_content) > max_file_size:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "File size should not exceed 10 MB."
                    )
                )

            # -----------------------------------------------------
            # Generate unique filename
            #
            # Original filename is preserved for display.
            # UUID prevents collisions.
            # -----------------------------------------------------

            original_filename = (
                file.filename or "attachment"
            )

            safe_filename = (
                Path(original_filename)
                .name
            )

            unique_filename = (
                f"{uuid.uuid4().hex}_"
                f"{safe_filename}"
            )

            destination = (
                UPLOAD_ROOT /
                unique_filename
            )

            # -----------------------------------------------------
            # Save file
            # -----------------------------------------------------

            with open(
                destination,
                "wb"
            ) as output_file:

                output_file.write(
                    file_content
                )

            # -----------------------------------------------------
            # Store URL-style relative path
            # -----------------------------------------------------

            new_file_path = (
                f"/uploads/assignments/"
                f"{unique_filename}"
            )

            logger.info(
                "[assignments/submit] "
                "File saved: %s",
                destination
            )

        # =========================================================
        # 7. GOOGLE DRIVE LINK
        # =========================================================

        if drive_link:

            drive_link = (
                drive_link.strip()
            )

            if not (
                drive_link.startswith(
                    "https://drive.google.com/"
                )
                or
                drive_link.startswith(
                    "https://docs.google.com/"
                )
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Please enter a valid "
                        "Google Drive or Google Docs link."
                    )
                )

            new_file_path = drive_link

        # =========================================================
        # 8. CREATE / UPDATE SUBMISSION
        # =========================================================

        if existing:

            logger.info(
                "[assignments/submit] "
                "Updating submission_id=%s",
                existing.submission_id
            )

            existing.submission_text = (
                submission_text
            )

            # Only replace the existing attachment
            # when a new attachment/link was supplied.
            if new_file_path:
                existing.file_path = (
                    new_file_path
                )

            existing.submitted_at = (
                datetime.utcnow()
            )

            db.commit()
            db.refresh(existing)

            sub = existing

        else:

            logger.info(
                "[assignments/submit] "
                "Creating new submission"
            )

            sub = StudentSubmission(
                assignment_id=assignment_id,
                student_id=student_id,
                submission_text=submission_text,
                file_path=new_file_path,
                submitted_at=datetime.utcnow()
            )

            db.add(sub)

            db.commit()
            db.refresh(sub)

        # =========================================================
        # 9. DETERMINE STATUS
        # =========================================================

        status = (
            "Graded"
            if sub.marks_obtained is not None
            else "Submitted"
        )

        # =========================================================
        # 10. DETERMINE FILE RESPONSE
        # =========================================================

        file_path = sub.file_path

        file_url = None
        file_name = None
        drive_response = None

        if file_path:

            if (
                file_path.startswith(
                    "https://drive.google.com/"
                )
                or
                file_path.startswith(
                    "https://docs.google.com/"
                )
            ):
                drive_response = file_path

            else:

                file_url = file_path

                file_name = (
                    Path(file_path)
                    .name
                )

                # Remove UUID prefix from display filename
                if "_" in file_name:
                    file_name = (
                        file_name.split(
                            "_",
                            1
                        )[1]
                    )

        # =========================================================
        # 11. BUILD RESPONSE
        # =========================================================

        response = AssignmentSchema(
            assignment_id=(
                assign.assignment_id
            ),

            assignment_title=(
                assign.assignment_title
            ),

            assignment_text=(
                assign.assignment_text
            ),

            subject=(
                subject_name or ""
            ),

            chapter_name=(
                chapter_name or ""
            ),

            teacher_name=(
                teacher_name or ""
            ),

            due_date=(
                assign.due_date.isoformat()
                if assign.due_date
                else ""
            ),

            status=status,

            marks_obtained=(
                sub.marks_obtained
            ),

            total_marks=(
                getattr(
                    sub,
                    "total_marks",
                    None
                )
            ),

            submitted_at=(
                sub.submitted_at.isoformat()
                if sub.submitted_at
                else None
            ),

            submission_text=(
                sub.submission_text
            ),

            teacher_remarks=(
                sub.teacher_remarks
            ),

            file_path=file_path,

            file_url=file_url,

            file_name=file_name,

            filename=file_name,

            attachment=file_path,

            drive_link=drive_response
        )

        logger.info(
            "[assignments/submit] SUCCESS: "
            "assignment_id=%s, "
            "student_id=%s, "
            "submission_id=%s",
            assignment_id,
            student_id,
            sub.submission_id
        )

        return response

    except HTTPException:
        raise

    except Exception as e:

        db.rollback()

        logger.exception(
            "[assignments/submit] Internal error"
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
        
@router.get("/quiz/history/{student_id}", response_model=List[QuizDetailResponse])
def get_quiz_history(student_id: int, db: Session = Depends(get_db)):
    student = db.query(StudentMaster).filter(StudentMaster.student_id == student_id).first()
    if not student:
        logger.warning("[quiz/history] student_id=%s not found → returning []", student_id)
        return []

    quizzes_query = db.query(
        QuizMaster, SubjectMaster.subject_name, QuizResponse
    ).select_from(QuizMaster)\
    .join(ChapterMaster, QuizMaster.chapter_id == ChapterMaster.chapter_id)\
    .join(SubjectMaster, ChapterMaster.subject_id == SubjectMaster.subject_id)\
    .join(QuizResponse, (QuizResponse.quiz_id == QuizMaster.quiz_id) & (QuizResponse.student_id == student_id))\
    .filter(SubjectMaster.class_id == student.class_id).all()
        
    quiz_list = []
    for quiz, subject_name, response in quizzes_query:
        if not response or response.score is None:
            continue
            
        score = float(response.score)
        total = float(quiz.total_marks or 100)
        percentage = round((score / total) * 100, 1) if total > 0 else 0
        
        if percentage >= 85:
            status = "Excellent"
            suggestion = "Excellent consistency."
        elif percentage >= 70:
            status = "Good"
            suggestion = "Good performance. Minor improvement possible."
        elif percentage >= 50:
            status = "Average"
            suggestion = "Needs more revision practice."
        else:
            status = "Needs Improvement"
            suggestion = "Immediate academic attention recommended."
            
        quiz_list.append(QuizDetailResponse(
            subject=subject_name,
            score=str(score),
            total=str(total),
            quiz_id=quiz.quiz_id,
            quiz_title=quiz.quiz_title or f"{subject_name} Quiz",
            percentage=percentage,
            teacher_name="Course Instructor",
            remarks=suggestion,
            quiz_date=quiz.created_at.isoformat() if hasattr(quiz, 'created_at') and quiz.created_at else datetime.utcnow().isoformat(),
            status=status,
            suggestion=suggestion
        ))
    logger.info("[quiz/history] student_id=%s → %d quizzes", student_id, len(quiz_list))
    return quiz_list

@router.get("/remarks/history/{student_id}", response_model=List[RemarkSchema])
def get_remarks_history(student_id: int, db: Session = Depends(get_db)):
    # Source 1: teacher_remarks stored on submitted assignments (graded work).
    # JOIN uses UsersMaster (assigned_by → users_master.user_id on production).
    submissions_remarks = db.query(StudentSubmission, UsersMaster.full_name, SubjectMaster.subject_name)\
        .join(AssignmentMaster, StudentSubmission.assignment_id == AssignmentMaster.assignment_id)\
        .outerjoin(UsersMaster, AssignmentMaster.assigned_by == UsersMaster.user_id)\
        .join(ChapterMaster, AssignmentMaster.chapter_id == ChapterMaster.chapter_id)\
        .join(SubjectMaster, ChapterMaster.subject_id == SubjectMaster.subject_id)\
        .filter(StudentSubmission.student_id == student_id)\
        .filter(StudentSubmission.teacher_remarks.isnot(None))\
        .filter(StudentSubmission.teacher_remarks != '').all()

    # Source 2: teacher replies in Communication Center tickets for this student.
    # Replaces TeacherParentInteractionV2 (table absent on SSS RDS).
    # sender_name is already stored on each TicketMessage; no extra join needed.
    teacher_msgs = db.query(TicketMessage, SupportTicket)\
        .join(SupportTicket, TicketMessage.ticket_id == SupportTicket.ticket_id)\
        .filter(SupportTicket.student_id == student_id)\
        .filter(TicketMessage.sender_type == "TEACHER")\
        .filter(TicketMessage.message.isnot(None))\
        .filter(TicketMessage.message != '').all()

    all_remarks = []
    idx = 1
    for sub, teacher_name, subject_name in submissions_remarks:
        remark_date = sub.submitted_at or datetime.utcnow()
        all_remarks.append({
            "remark_id": idx,
            "teacher_name": teacher_name or "Teacher",
            "subject": subject_name,
            "comment": sub.teacher_remarks.strip(),
            "date_obj": remark_date,
            "date": remark_date.strftime("%d %b %Y"),
            "ticket_id": None,
            "is_read": True,  # submission remarks are always considered read
        })
        idx += 1

    for msg, ticket in teacher_msgs:
        remark_date = msg.created_at or datetime.utcnow()
        all_remarks.append({
            "remark_id": idx,
            "teacher_name": msg.sender_name or "Teacher",
            "subject": ticket.subject or "General",
            "comment": msg.message.strip(),
            "date_obj": remark_date,
            "date": remark_date.strftime("%d %b %Y"),
            "ticket_id": ticket.ticket_id,
            "is_read": bool(msg.is_read),
        })
        idx += 1

    all_remarks.sort(key=lambda x: x["date_obj"], reverse=True)
    logger.info("[remarks/history] student_id=%s → %d remarks", student_id, len(all_remarks))
    return [RemarkSchema(**r) for r in all_remarks]

@router.get("/notices/history/{student_id}", response_model=List[NoticeSchema])
def get_notices_history(student_id: int, db: Session = Depends(get_db)):

    student = db.query(StudentMaster).filter(StudentMaster.student_id == student_id).first()
    if not student:
        logger.warning("[notices/history] student_id=%s not found → returning []", student_id)
        return []

    class_info = db.query(ClassMaster).filter(ClassMaster.class_id == student.class_id).first()
    class_name = class_info.class_name if class_info else None

    notices_query = db.query(NoticeBoard, UsersMaster.full_name)\
        .outerjoin(UsersMaster, NoticeBoard.posted_by == UsersMaster.user_id)\
        .filter(NoticeBoard.notice_text.isnot(None))\
        .filter(NoticeBoard.notice_text != '')

    if class_name:
        notices_query = notices_query.filter(
            or_(
                NoticeBoard.applicable_class == class_name,
                NoticeBoard.applicable_class == 'All',
                NoticeBoard.applicable_class.is_(None),
            )
        )

    notices_query = notices_query.order_by(NoticeBoard.created_at.desc()).all()

    result = [
        NoticeSchema(
            notice_id=n.notice_id,
            notice_title=n.notice_title or "Notice",
            notice_text=n.notice_text.strip(),
            notice_date=n.notice_date.strftime("%d %b %Y") if n.notice_date else (n.created_at.strftime("%d %b %Y") if n.created_at else ""),
            applicable_class=n.applicable_class or "All",
            posted_by_name=t or "Admin"
        ) for n, t in notices_query
    ]
    logger.info("[notices/history] student_id=%s class=%s → %d notices", student_id, class_name, len(result))
    return result

# ── DISABLED: Call-request routes ────────────────────────────────────────
# GET /call-requests/history/{student_id} and POST /request-call had no
# frontend callers (api.ts exported fetchCallRequestsHistory and requestCall
# but no page imported them after the dashboard redesign). The CallRequest
# model and table remain intact. Restore if a PTM-request feature is added.
#
# @router.get("/call-requests/history/{student_id}", response_model=List[CallRequestResponse])
# def get_call_requests_history(student_id: int, db: Session = Depends(get_db)):
#     ...
#
# @router.post("/request-call", response_model=CallRequestResponse)
# def create_call_request(request: CallRequestCreate, db: Session = Depends(get_db)):
#     ...
# ──────────────────────────────────────────────────────────────────────────


# ── DISABLED: Old chat system routes ─────────────────────────────────────
# GET /chat/threads/{parent_id}/{student_id}, GET /chat/messages/{thread_id},
# POST /chat/messages — these served a thread-based Parent↔Teacher chat
# backed by ChatThread + ChatMessage tables. Replaced by the /comm/
# Communication Center (routers/communication.py). The ChatThread and
# ChatMessage DB tables remain intact (data preserved).
# ChatMessageSchema, ChatMessageCreate, ChatThreadSchema are also disabled
# in schemas.py. Restore this entire block to revive the old chat system.
#
# from models import ChatThread, ChatMessage
# from schemas import ChatThreadSchema, ChatMessageSchema, ChatMessageCreate
#
# @router.get("/chat/threads/{parent_id}/{student_id}", ...)
# @router.get("/chat/messages/{thread_id}", ...)
# @router.post("/chat/messages", ...)
# ──────────────────────────────────────────────────────────────────────────

# ── DISABLED: Old support-ticket routes ───────────────────────────────────
# GET /tickets/{parent_id}/{student_id}, POST /tickets,
# GET /tickets/{ticket_id}/messages, POST /tickets/{ticket_id}/messages —
# These were the original customer-support style ticket system. Two issues:
#   1. Route ordering caused 422 errors (FastAPI matched /{parent_id}/{student_id}
#      before /{ticket_id}/messages, failing integer parse on "messages").
#   2. Replaced wholesale by /comm/ routes (routers/communication.py) which
#      reuse the same SupportTicket + TicketMessage tables cleanly.
# SupportTicketSchema, TicketMessageSchema etc. are also disabled in schemas.py.
# The /notifications/ route below still queries SupportTicket/TicketMessage
# models directly, so those model imports remain active.
#
# from schemas import SupportTicketSchema, TicketMessageSchema, TicketCreateSchema, TicketMessageCreateSchema
#
# @router.get("/tickets/{parent_id}/{student_id}", ...)
# @router.post("/tickets", ...)
# @router.get("/tickets/{ticket_id}/messages", ...)
# @router.post("/tickets/{ticket_id}/messages", ...)
# ──────────────────────────────────────────────────────────────────────────

@router.get("/notifications/unread-count/{student_id}")
def get_unread_count(student_id: int, db: Session = Depends(get_db)):
    """Returns total unread teacher messages across all conversations for this student."""
    count = db.query(TicketMessage)\
        .join(SupportTicket, TicketMessage.ticket_id == SupportTicket.ticket_id)\
        .filter(
            SupportTicket.student_id == student_id,
            TicketMessage.sender_type == "TEACHER",
            TicketMessage.is_read == False,
        ).count()
    return {"student_id": student_id, "unread_comm_count": count}


@router.get("/notifications/{student_id}", response_model=List[NotificationSchema])
def get_notifications(student_id: int, db: Session = Depends(get_db)):
    notifications = []
    today = date.today()

    # 1. Unread Teacher messages in Communication Center
    unread_msgs = db.query(TicketMessage, SupportTicket)\
        .join(SupportTicket, TicketMessage.ticket_id == SupportTicket.ticket_id)\
        .filter(
            SupportTicket.student_id == student_id,
            TicketMessage.sender_type == "TEACHER",
            TicketMessage.is_read == False,
        ).order_by(TicketMessage.created_at.desc()).all()

    for msg, ticket in unread_msgs[:5]:
        notifications.append(NotificationSchema(
            id=f"msg_{msg.message_id}",
            type="ticket_reply",
            title=f"Reply from {msg.sender_name or 'Teacher'}",
            message=(msg.message[:80] + "…") if len(msg.message) > 80 else msg.message,
            date=msg.created_at.isoformat() if msg.created_at else "",
            is_read=False,
            link="/parent/communication",
        ))

    # 2. Unread Teacher remarks (new ticket messages of type TEACHER not yet read)
    student = db.query(StudentMaster).filter(StudentMaster.student_id == student_id).first()

    # 3. Recent class notices (is_read tracked client-side via localStorage)
    if student:
    
        class_info = db.query(ClassMaster).filter(ClassMaster.class_id == student.class_id).first()
        class_name = class_info.class_name if class_info else None
        notice_q = db.query(NoticeBoard)\
            .filter(NoticeBoard.notice_text.isnot(None))\
            .filter(NoticeBoard.notice_text != '')
        if class_name:
            notice_q = notice_q.filter(
                or_(
                    NoticeBoard.applicable_class == class_name,
                    NoticeBoard.applicable_class == 'All',
                    NoticeBoard.applicable_class.is_(None),
                )
            )
        notices = notice_q.order_by(NoticeBoard.created_at.desc()).limit(5).all()
        for n in notices:
            notifications.append(NotificationSchema(
                id=f"not_{n.notice_id}",
                type="announcement",
                title=n.notice_title or "New Notice",
                message=(n.notice_text[:80] + "…") if n.notice_text and len(n.notice_text) > 80 else (n.notice_text or ""),
                date=n.created_at.isoformat() if n.created_at else today.isoformat(),
                is_read=False,  # read state tracked client-side
                link=f"/parent/notices?open={n.notice_id}",
            ))

    notifications.sort(key=lambda x: x.date, reverse=True)
    return notifications[:10]


# ── DISABLED: Attendance Endpoints ────────────────────────────────────────
# The Attendance module has been fully removed from the parent portal.
# These four routes (GET /attendance/{student_id},
# POST /attendance/leave-request, GET /attendance/leave-requests/{student_id},
# PATCH /attendance/leave-request/{leave_request_id}) have no frontend callers.
#
# The underlying DB tables (attendance_master, leave_requests) remain intact.
# The AttendanceMaster and LeaveRequest models in models.py are preserved.
# The schemas (AttendanceDaySchema, AttendanceOverviewSchema, AttendanceDataResponse,
# LeaveRequestCreate, LeaveRequestResponse, LeaveStatusUpdate) are disabled in
# schemas.py. The API helpers are disabled in frontend/src/lib/api.ts.
#
# Leave requests now exist ONLY as a Communication Center category/workflow
# routed through /comm/ (routers/communication.py).
#
# To restore the standalone attendance module, uncomment:
#   - These endpoints
#   - AttendanceMaster, LeaveRequest imports at the top of this file
#   - The corresponding schemas in schemas.py
#   - The API helpers in frontend/src/lib/api.ts
#   - The attendance page: frontend/src/app/parent/attendance/page.tsx
# ──────────────────────────────────────────────────────────────────────────
#
# @router.get("/attendance/{student_id}", response_model=AttendanceDataResponse)
# def get_attendance(student_id: int, db: Session = Depends(get_db)):
#     ... (full implementation preserved in git history)
#
# @router.post("/attendance/leave-request", response_model=LeaveRequestResponse)
# def create_leave_request(request: LeaveRequestCreate, db: Session = Depends(get_db)):
#     ... (full implementation preserved in git history)
#
# @router.get("/attendance/leave-requests/{student_id}", response_model=List[LeaveRequestResponse])
# def get_leave_requests(student_id: int, db: Session = Depends(get_db)):
#     ... (full implementation preserved in git history)
#
# @router.patch("/attendance/leave-request/{leave_request_id}", response_model=LeaveRequestResponse)
# def update_leave_status(leave_request_id: int, update: LeaveStatusUpdate, db: Session = Depends(get_db)):
#     ... (full implementation preserved in git history)
# ──────────────────────────────────────────────────────────────────────────
