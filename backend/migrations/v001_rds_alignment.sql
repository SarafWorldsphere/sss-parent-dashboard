-- ============================================================
-- SSS Parent Dashboard  |  Local → RDS Schema Alignment
-- File   : backend/migrations/v001_rds_alignment.sql
-- Target : Local PostgreSQL (mydb_sss), plain table names
-- Safe   : Fully idempotent — re-runnable without side effects
-- Scope  : Column renames, bigint promotions, audit columns,
--          and missing-column back-fills for all 13 active tables.
--
-- RUN ORDER:
--   psql -U postgres -d mydb_sss -f v001_rds_alignment.sql
-- ============================================================

BEGIN;

-- ============================================================
-- PHASE 1  —  DROP ALL FK CONSTRAINTS ON AFFECTED TABLES
--
-- Required before bigint type promotions on referenced PKs.
-- Phase 5 recreates them with matching types. The DROP + ADD
-- pattern makes every re-run idempotent automatically.
-- ============================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tc.constraint_name, tc.table_name
        FROM   information_schema.table_constraints tc
        WHERE  tc.constraint_type = 'FOREIGN KEY'
          AND  tc.table_name IN (
                 'assignment_master',
                 'chapter_master',
                 'class_master',
                 'notice_board',
                 'parent_student_map',
                 'quiz_master',
                 'quiz_response',
                 'student_master',
                 'student_submission',
                 'subject_master',
                 'teacher_masters',
                 'teacher_parent_interaction'
               )
    LOOP
        EXECUTE format(
            'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
            r.table_name, r.constraint_name
        );
    END LOOP;
END $$;


-- ============================================================
-- PHASE 2  —  COLUMN RENAMES  (local name → RDS canonical name)
--
-- Idempotent: each block checks information_schema before acting.
-- SQLAlchemy models alias the Python attr back to the old name
-- so no backend code or API response key changes are required.
-- ============================================================

-- assignment_master: created_at → created_datetime
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE  table_name = 'assignment_master' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE assignment_master RENAME COLUMN created_at TO created_datetime;
    END IF;
END $$;

-- notice_board: created_at → created_datetime
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE  table_name = 'notice_board' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE notice_board RENAME COLUMN created_at TO created_datetime;
    END IF;
END $$;

-- quiz_master: created_at → created_datetime
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE  table_name = 'quiz_master' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE quiz_master RENAME COLUMN created_at TO created_datetime;
    END IF;
END $$;

-- teacher_masters: email → email_id
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE  table_name = 'teacher_masters' AND column_name = 'email'
    ) THEN
        ALTER TABLE teacher_masters RENAME COLUMN email TO email_id;
    END IF;
END $$;


-- ============================================================
-- PHASE 3  —  BIGINT TYPE PROMOTIONS
--
-- Order: root PKs first, then every FK column that references
-- them, so recreated constraints in Phase 5 type-check cleanly.
-- Each block is a no-op when the column is already bigint.
-- ============================================================

-- ── Root PKs ────────────────────────────────────────────────────

DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'class_master' AND column_name = 'class_id') = 'integer' THEN
        ALTER TABLE class_master ALTER COLUMN class_id TYPE bigint;
    END IF;
END $$;

DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'teacher_masters' AND column_name = 'teacher_id') = 'integer' THEN
        ALTER TABLE teacher_masters ALTER COLUMN teacher_id TYPE bigint;
    END IF;
END $$;

DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'subject_master' AND column_name = 'subject_id') = 'integer' THEN
        ALTER TABLE subject_master ALTER COLUMN subject_id TYPE bigint;
    END IF;
END $$;

DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'chapter_master' AND column_name = 'chapter_id') = 'integer' THEN
        ALTER TABLE chapter_master ALTER COLUMN chapter_id TYPE bigint;
    END IF;
END $$;

DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'student_master' AND column_name = 'student_id') = 'integer' THEN
        ALTER TABLE student_master ALTER COLUMN student_id TYPE bigint;
    END IF;
END $$;

DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'assignment_master' AND column_name = 'assignment_id') = 'integer' THEN
        ALTER TABLE assignment_master ALTER COLUMN assignment_id TYPE bigint;
    END IF;
END $$;

DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'quiz_master' AND column_name = 'quiz_id') = 'integer' THEN
        ALTER TABLE quiz_master ALTER COLUMN quiz_id TYPE bigint;
    END IF;
END $$;

DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'notice_board' AND column_name = 'notice_id') = 'integer' THEN
        ALTER TABLE notice_board ALTER COLUMN notice_id TYPE bigint;
    END IF;
END $$;

DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'student_submission' AND column_name = 'submission_id') = 'integer' THEN
        ALTER TABLE student_submission ALTER COLUMN submission_id TYPE bigint;
    END IF;
END $$;

DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'quiz_response' AND column_name = 'response_id') = 'integer' THEN
        ALTER TABLE quiz_response ALTER COLUMN response_id TYPE bigint;
    END IF;
END $$;

-- ── FK columns (must follow their referenced PKs above) ──────────

-- subject_master FK columns
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'subject_master' AND column_name = 'class_id') = 'integer' THEN
        ALTER TABLE subject_master ALTER COLUMN class_id TYPE bigint;
    END IF;
END $$;
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'subject_master' AND column_name = 'teacher_id') = 'integer' THEN
        ALTER TABLE subject_master ALTER COLUMN teacher_id TYPE bigint;
    END IF;
END $$;

-- chapter_master FK columns
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'chapter_master' AND column_name = 'subject_id') = 'integer' THEN
        ALTER TABLE chapter_master ALTER COLUMN subject_id TYPE bigint;
    END IF;
END $$;

-- assignment_master FK columns
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'assignment_master' AND column_name = 'chapter_id') = 'integer' THEN
        ALTER TABLE assignment_master ALTER COLUMN chapter_id TYPE bigint;
    END IF;
END $$;
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'assignment_master' AND column_name = 'assigned_by') = 'integer' THEN
        ALTER TABLE assignment_master ALTER COLUMN assigned_by TYPE bigint;
    END IF;
END $$;

-- notice_board FK columns
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'notice_board' AND column_name = 'posted_by') = 'integer' THEN
        ALTER TABLE notice_board ALTER COLUMN posted_by TYPE bigint;
    END IF;
END $$;

-- quiz_master FK columns
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'quiz_master' AND column_name = 'chapter_id') = 'integer' THEN
        ALTER TABLE quiz_master ALTER COLUMN chapter_id TYPE bigint;
    END IF;
END $$;

-- quiz_response FK columns
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'quiz_response' AND column_name = 'quiz_id') = 'integer' THEN
        ALTER TABLE quiz_response ALTER COLUMN quiz_id TYPE bigint;
    END IF;
END $$;
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'quiz_response' AND column_name = 'student_id') = 'integer' THEN
        ALTER TABLE quiz_response ALTER COLUMN student_id TYPE bigint;
    END IF;
END $$;

-- student_master FK columns
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'student_master' AND column_name = 'class_id') = 'integer' THEN
        ALTER TABLE student_master ALTER COLUMN class_id TYPE bigint;
    END IF;
END $$;

-- student_submission FK columns
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'student_submission' AND column_name = 'assignment_id') = 'integer' THEN
        ALTER TABLE student_submission ALTER COLUMN assignment_id TYPE bigint;
    END IF;
END $$;
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'student_submission' AND column_name = 'student_id') = 'integer' THEN
        ALTER TABLE student_submission ALTER COLUMN student_id TYPE bigint;
    END IF;
END $$;

-- teacher_parent_interaction FK columns (local-only table — align with new bigint PKs)
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'teacher_parent_interaction' AND column_name = 'teacher_id') = 'integer' THEN
        ALTER TABLE teacher_parent_interaction ALTER COLUMN teacher_id TYPE bigint;
    END IF;
END $$;
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'teacher_parent_interaction' AND column_name = 'student_id') = 'integer' THEN
        ALTER TABLE teacher_parent_interaction ALTER COLUMN student_id TYPE bigint;
    END IF;
END $$;
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'teacher_parent_interaction' AND column_name = 'class_id') = 'integer' THEN
        ALTER TABLE teacher_parent_interaction ALTER COLUMN class_id TYPE bigint;
    END IF;
END $$;

-- parent_student_map: student_id promoted to bigint for FK consistency
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'parent_student_map' AND column_name = 'student_id') = 'integer' THEN
        ALTER TABLE parent_student_map ALTER COLUMN student_id TYPE bigint;
    END IF;
END $$;

-- support_tickets: student_id promoted to bigint for FK consistency
-- (RDS keeps this as integer but we promote locally so the FK constraint
--  to sss_student_master.student_id bigint stays valid on fresh installs)
DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'support_tickets' AND column_name = 'student_id') = 'integer' THEN
        ALTER TABLE support_tickets ALTER COLUMN student_id TYPE bigint;
    END IF;
END $$;


-- ============================================================
-- PHASE 4  —  ADD MISSING COLUMNS  (IF NOT EXISTS — idempotent)
--
-- Includes: RDS-required audit fields, columns present in the
-- physical DB but missing from the prior ORM model, and new
-- RDS-only enrichment fields.  All nullable — zero data impact.
-- ============================================================

-- ── assignment_master ──────────────────────────────────────────────
-- Full audit set required by RDS (created_datetime already handled in Phase 2)
ALTER TABLE assignment_master ADD COLUMN IF NOT EXISTS created_user_id       VARCHAR;
ALTER TABLE assignment_master ADD COLUMN IF NOT EXISTS created_ip_address    VARCHAR;
ALTER TABLE assignment_master ADD COLUMN IF NOT EXISTS modified_datetime     TIMESTAMP;
ALTER TABLE assignment_master ADD COLUMN IF NOT EXISTS modified_user_id      VARCHAR;
ALTER TABLE assignment_master ADD COLUMN IF NOT EXISTS modified_ip_address   VARCHAR;
ALTER TABLE assignment_master ADD COLUMN IF NOT EXISTS record_status         VARCHAR;
ALTER TABLE assignment_master ADD COLUMN IF NOT EXISTS version_no            INTEGER;

-- ── chapter_master ─────────────────────────────────────────────────
-- chapter_no and chapter_description exist in local DB but were absent from model
ALTER TABLE chapter_master ADD COLUMN IF NOT EXISTS chapter_no          INTEGER;
ALTER TABLE chapter_master ADD COLUMN IF NOT EXISTS chapter_description TEXT;
ALTER TABLE chapter_master ADD COLUMN IF NOT EXISTS created_datetime    TIMESTAMP;
ALTER TABLE chapter_master ADD COLUMN IF NOT EXISTS created_user_id     VARCHAR;
ALTER TABLE chapter_master ADD COLUMN IF NOT EXISTS modified_datetime   TIMESTAMP;
ALTER TABLE chapter_master ADD COLUMN IF NOT EXISTS record_status       VARCHAR;
ALTER TABLE chapter_master ADD COLUMN IF NOT EXISTS version_no          INTEGER;

-- ── class_master ───────────────────────────────────────────────────
-- school_id and class_teacher_id exist in local DB but were absent from model
ALTER TABLE class_master ADD COLUMN IF NOT EXISTS school_id         BIGINT;
ALTER TABLE class_master ADD COLUMN IF NOT EXISTS class_teacher_id  BIGINT;
ALTER TABLE class_master ADD COLUMN IF NOT EXISTS created_datetime  TIMESTAMP;
ALTER TABLE class_master ADD COLUMN IF NOT EXISTS modified_datetime TIMESTAMP;
ALTER TABLE class_master ADD COLUMN IF NOT EXISTS record_status     VARCHAR;
ALTER TABLE class_master ADD COLUMN IF NOT EXISTS version_no        INTEGER;

-- ── notice_board ───────────────────────────────────────────────────
-- created_datetime already added by Phase 2 rename
ALTER TABLE notice_board ADD COLUMN IF NOT EXISTS modified_datetime TIMESTAMP;
ALTER TABLE notice_board ADD COLUMN IF NOT EXISTS record_status     VARCHAR;
ALTER TABLE notice_board ADD COLUMN IF NOT EXISTS version_no        INTEGER;

-- ── quiz_master ────────────────────────────────────────────────────
-- created_datetime already added by Phase 2 rename
ALTER TABLE quiz_master ADD COLUMN IF NOT EXISTS modified_datetime TIMESTAMP;
ALTER TABLE quiz_master ADD COLUMN IF NOT EXISTS record_status     VARCHAR;
ALTER TABLE quiz_master ADD COLUMN IF NOT EXISTS version_no        INTEGER;

-- ── quiz_response ──────────────────────────────────────────────────
ALTER TABLE quiz_response ADD COLUMN IF NOT EXISTS created_datetime  TIMESTAMP;
ALTER TABLE quiz_response ADD COLUMN IF NOT EXISTS modified_datetime TIMESTAMP;
ALTER TABLE quiz_response ADD COLUMN IF NOT EXISTS record_status     VARCHAR;
ALTER TABLE quiz_response ADD COLUMN IF NOT EXISTS version_no        INTEGER;

-- ── student_master ─────────────────────────────────────────────────
-- admission_no exists in local DB but was absent from model
-- New RDS enrichment fields: student contact + guardian info
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS admission_no      VARCHAR;
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS student_phone     VARCHAR;
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS student_email     VARCHAR;
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS guardian_name     VARCHAR;
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS guardian_phone    VARCHAR;
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS guardian_email    VARCHAR;
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS is_active         BOOLEAN;
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS created_datetime  TIMESTAMP;
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS modified_datetime TIMESTAMP;
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS record_status     VARCHAR;
ALTER TABLE student_master ADD COLUMN IF NOT EXISTS version_no        INTEGER;

-- ── student_submission ─────────────────────────────────────────────
-- submitted_at already exists; RDS also carries created_datetime separately
ALTER TABLE student_submission ADD COLUMN IF NOT EXISTS created_datetime  TIMESTAMP;
ALTER TABLE student_submission ADD COLUMN IF NOT EXISTS modified_datetime TIMESTAMP;
ALTER TABLE student_submission ADD COLUMN IF NOT EXISTS record_status     VARCHAR;
ALTER TABLE student_submission ADD COLUMN IF NOT EXISTS version_no        INTEGER;

-- ── subject_master ─────────────────────────────────────────────────
-- subject_code exists in local DB but was absent from model
ALTER TABLE subject_master ADD COLUMN IF NOT EXISTS subject_code      VARCHAR;
ALTER TABLE subject_master ADD COLUMN IF NOT EXISTS created_datetime  TIMESTAMP;
ALTER TABLE subject_master ADD COLUMN IF NOT EXISTS modified_datetime TIMESTAMP;
ALTER TABLE subject_master ADD COLUMN IF NOT EXISTS record_status     VARCHAR;
ALTER TABLE subject_master ADD COLUMN IF NOT EXISTS version_no        INTEGER;

-- ── teacher_masters ─────────────────────────────────────────────────
-- subject_name, class_id, section_1, section_2, role exist in local DB
-- but were absent from the prior model; is_active is new from RDS
-- email_id already added by Phase 2 rename; class_id already bigint in local DB
ALTER TABLE teacher_masters ADD COLUMN IF NOT EXISTS subject_name VARCHAR;
ALTER TABLE teacher_masters ADD COLUMN IF NOT EXISTS class_id     BIGINT;
ALTER TABLE teacher_masters ADD COLUMN IF NOT EXISTS section_1    VARCHAR;
ALTER TABLE teacher_masters ADD COLUMN IF NOT EXISTS section_2    VARCHAR;
ALTER TABLE teacher_masters ADD COLUMN IF NOT EXISTS role         VARCHAR;
ALTER TABLE teacher_masters ADD COLUMN IF NOT EXISTS is_active    BOOLEAN;
ALTER TABLE teacher_masters ADD COLUMN IF NOT EXISTS created_at   TIMESTAMP;

-- ── support_tickets ────────────────────────────────────────────────
-- recipient_name backfill kept here for completeness (also done in main.py startup)
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS recipient_name VARCHAR;


-- ============================================================
-- PHASE 5  —  RECREATE FK CONSTRAINTS
--
-- All types now match; constraints rebuilt with explicit names
-- so Phase 1 can find and drop them on the next re-run.
-- ============================================================

ALTER TABLE subject_master
    ADD CONSTRAINT subject_master_class_id_fkey
    FOREIGN KEY (class_id) REFERENCES class_master(class_id);

ALTER TABLE subject_master
    ADD CONSTRAINT subject_master_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES teacher_masters(teacher_id);

ALTER TABLE chapter_master
    ADD CONSTRAINT chapter_master_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES subject_master(subject_id);

ALTER TABLE assignment_master
    ADD CONSTRAINT assignment_master_chapter_id_fkey
    FOREIGN KEY (chapter_id) REFERENCES chapter_master(chapter_id);

ALTER TABLE assignment_master
    ADD CONSTRAINT assignment_master_assigned_by_fkey
    FOREIGN KEY (assigned_by) REFERENCES teacher_masters(teacher_id);

ALTER TABLE student_master
    ADD CONSTRAINT student_master_class_id_fkey
    FOREIGN KEY (class_id) REFERENCES class_master(class_id);

ALTER TABLE student_submission
    ADD CONSTRAINT student_submission_assignment_id_fkey
    FOREIGN KEY (assignment_id) REFERENCES assignment_master(assignment_id);

ALTER TABLE student_submission
    ADD CONSTRAINT student_submission_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES student_master(student_id);

ALTER TABLE quiz_master
    ADD CONSTRAINT quiz_master_chapter_id_fkey
    FOREIGN KEY (chapter_id) REFERENCES chapter_master(chapter_id);

ALTER TABLE quiz_response
    ADD CONSTRAINT quiz_response_quiz_id_fkey
    FOREIGN KEY (quiz_id) REFERENCES quiz_master(quiz_id);

ALTER TABLE quiz_response
    ADD CONSTRAINT quiz_response_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES student_master(student_id);

ALTER TABLE notice_board
    ADD CONSTRAINT notice_board_posted_by_fkey
    FOREIGN KEY (posted_by) REFERENCES teacher_masters(teacher_id);

ALTER TABLE teacher_parent_interaction
    ADD CONSTRAINT teacher_parent_interaction_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES teacher_masters(teacher_id);

ALTER TABLE teacher_parent_interaction
    ADD CONSTRAINT teacher_parent_interaction_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES student_master(student_id);

ALTER TABLE teacher_parent_interaction
    ADD CONSTRAINT teacher_parent_interaction_class_id_fkey
    FOREIGN KEY (class_id) REFERENCES class_master(class_id);

ALTER TABLE parent_student_map
    ADD CONSTRAINT parent_student_map_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES parent_master(parent_id);

ALTER TABLE parent_student_map
    ADD CONSTRAINT parent_student_map_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES student_master(student_id);

ALTER TABLE support_tickets
    ADD CONSTRAINT support_tickets_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES parent_master(parent_id);

ALTER TABLE support_tickets
    ADD CONSTRAINT support_tickets_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES student_master(student_id);

COMMIT;
