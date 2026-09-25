-- ============================================================
-- SSS Parent Dashboard  |  v002 — ORM Gap Fix
-- File   : backend/migrations/v002_missing_columns.sql
-- Target : Local PostgreSQL (mydb_sss)
-- Safe   : Idempotent — re-runnable, never drops, never nullifies data
-- Purpose: Adds every column the updated ORM models.py now declares
--          but the local DB does not yet have, and renames the four
--          physical columns whose names were changed to match RDS.
--
-- WHY THIS SCRIPT EXISTS:
--   v001_rds_alignment.sql was generated before being applied to the
--   local database. The ORM was updated first (models.py), which caused
--   SQLAlchemy to emit SELECT lists containing column names the DB does
--   not recognise yet (e.g. student_master.student_phone).
--   This script closes that gap without touching existing data or types.
--
-- SCOPE:
--   Part 1 — Column renames  (4 physical renames that unblock queries)
--   Part 2 — Add missing columns per table  (46 columns across 10 tables)
--   Part 3 — BigInteger promotions  (non-blocking; integer → bigint)
--             Included for full structural alignment but safe to defer.
--
-- TABLES WITH NO CHANGES REQUIRED (already in sync with ORM):
--   parent_master, parent_student_map, support_tickets,
--   teacher_parent_interaction, ticket_messages
--
-- RUN:
--   psql -U postgres -d mydb_sss -f v002_missing_columns.sql
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1  —  COLUMN RENAMES
--
-- The ORM uses Column('physical_name', Type) aliasing, so the
-- physical PostgreSQL column must match the RDS name.  If the
-- old name still exists the ORM-generated SELECT list will
-- contain e.g. "notice_board.created_datetime" which PostgreSQL
-- rejects with UndefinedColumn.
--
-- Each block is a no-op when the rename has already been applied.
-- ============================================================

-- 1a. assignment_master: created_at → created_datetime
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE  table_schema = 'public'
          AND  table_name   = 'assignment_master'
          AND  column_name  = 'created_at'
    ) THEN
        ALTER TABLE assignment_master RENAME COLUMN created_at TO created_datetime;
        RAISE NOTICE 'assignment_master: renamed created_at → created_datetime';
    ELSE
        RAISE NOTICE 'assignment_master: created_at already renamed, skipping';
    END IF;
END $$;

-- 1b. notice_board: created_at → created_datetime
--     dashboard_service.py uses NoticeBoard.created_at in ORDER BY and
--     notice.created_at for date display — both resolve via the ORM alias.
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE  table_schema = 'public'
          AND  table_name   = 'notice_board'
          AND  column_name  = 'created_at'
    ) THEN
        ALTER TABLE notice_board RENAME COLUMN created_at TO created_datetime;
        RAISE NOTICE 'notice_board: renamed created_at → created_datetime';
    ELSE
        RAISE NOTICE 'notice_board: created_at already renamed, skipping';
    END IF;
END $$;

-- 1c. quiz_master: created_at → created_datetime
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE  table_schema = 'public'
          AND  table_name   = 'quiz_master'
          AND  column_name  = 'created_at'
    ) THEN
        ALTER TABLE quiz_master RENAME COLUMN created_at TO created_datetime;
        RAISE NOTICE 'quiz_master: renamed created_at → created_datetime';
    ELSE
        RAISE NOTICE 'quiz_master: created_at already renamed, skipping';
    END IF;
END $$;

-- 1d. teacher_master: email → email_id
--     ORM maps Python attr `email` to physical col `email_id`.
--     communication.py and dashboard_service.py access teacher.email
--     (Python attr), so no Python code changes are needed.
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE  table_schema = 'public'
          AND  table_name   = 'teacher_master'
          AND  column_name  = 'email'
    ) THEN
        ALTER TABLE teacher_master RENAME COLUMN email TO email_id;
        RAISE NOTICE 'teacher_master: renamed email → email_id';
    ELSE
        RAISE NOTICE 'teacher_master: email already renamed, skipping';
    END IF;
END $$;


-- ============================================================
-- PART 2  —  ADD MISSING COLUMNS
--
-- Every column is added as nullable with no default value.
-- NULL is the correct sentinel for "not yet populated from RDS".
-- All guards use IF NOT EXISTS — safe to re-run indefinitely.
-- Preserves every existing row and every existing value.
-- ============================================================

-- ── student_master ────────────────────────────────────────────────
-- Root cause of the reported crash.  ORM now declares 10 new fields;
-- none exist in the local table yet.
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

-- ── assignment_master ─────────────────────────────────────────────
-- created_datetime already handled by the rename in Part 1.
-- Seven audit fields are new.
ALTER TABLE assignment_master ADD COLUMN IF NOT EXISTS created_user_id       VARCHAR;
ALTER TABLE assignment_master ADD COLUMN IF NOT EXISTS created_ip_address    VARCHAR;
ALTER TABLE assignment_master ADD COLUMN IF NOT EXISTS modified_datetime     TIMESTAMP;
ALTER TABLE assignment_master ADD COLUMN IF NOT EXISTS modified_user_id      VARCHAR;
ALTER TABLE assignment_master ADD COLUMN IF NOT EXISTS modified_ip_address   VARCHAR;
ALTER TABLE assignment_master ADD COLUMN IF NOT EXISTS record_status         VARCHAR;
ALTER TABLE assignment_master ADD COLUMN IF NOT EXISTS version_no            INTEGER;

-- ── chapter_master ────────────────────────────────────────────────
-- chapter_no and chapter_description already exist in local DB.
-- Five audit fields are new.
ALTER TABLE chapter_master ADD COLUMN IF NOT EXISTS created_datetime  TIMESTAMP;
ALTER TABLE chapter_master ADD COLUMN IF NOT EXISTS created_user_id   VARCHAR;
ALTER TABLE chapter_master ADD COLUMN IF NOT EXISTS modified_datetime TIMESTAMP;
ALTER TABLE chapter_master ADD COLUMN IF NOT EXISTS record_status     VARCHAR;
ALTER TABLE chapter_master ADD COLUMN IF NOT EXISTS version_no        INTEGER;

-- ── class_master ──────────────────────────────────────────────────
-- school_id and class_teacher_id already exist in local DB.
-- Four audit fields are new.
ALTER TABLE class_master ADD COLUMN IF NOT EXISTS created_datetime  TIMESTAMP;
ALTER TABLE class_master ADD COLUMN IF NOT EXISTS modified_datetime TIMESTAMP;
ALTER TABLE class_master ADD COLUMN IF NOT EXISTS record_status     VARCHAR;
ALTER TABLE class_master ADD COLUMN IF NOT EXISTS version_no        INTEGER;

-- ── notice_board ──────────────────────────────────────────────────
-- created_datetime already handled by the rename in Part 1.
-- Three audit fields are new.
ALTER TABLE notice_board ADD COLUMN IF NOT EXISTS modified_datetime TIMESTAMP;
ALTER TABLE notice_board ADD COLUMN IF NOT EXISTS record_status     VARCHAR;
ALTER TABLE notice_board ADD COLUMN IF NOT EXISTS version_no        INTEGER;

-- ── quiz_master ───────────────────────────────────────────────────
-- created_datetime already handled by the rename in Part 1.
-- Three audit fields are new.
ALTER TABLE quiz_master ADD COLUMN IF NOT EXISTS modified_datetime TIMESTAMP;
ALTER TABLE quiz_master ADD COLUMN IF NOT EXISTS record_status     VARCHAR;
ALTER TABLE quiz_master ADD COLUMN IF NOT EXISTS version_no        INTEGER;

-- ── quiz_response ─────────────────────────────────────────────────
ALTER TABLE quiz_response ADD COLUMN IF NOT EXISTS created_datetime  TIMESTAMP;
ALTER TABLE quiz_response ADD COLUMN IF NOT EXISTS modified_datetime TIMESTAMP;
ALTER TABLE quiz_response ADD COLUMN IF NOT EXISTS record_status     VARCHAR;
ALTER TABLE quiz_response ADD COLUMN IF NOT EXISTS version_no        INTEGER;

-- ── student_submission ────────────────────────────────────────────
-- submitted_at already exists; created_datetime is an additional field.
ALTER TABLE student_submission ADD COLUMN IF NOT EXISTS created_datetime  TIMESTAMP;
ALTER TABLE student_submission ADD COLUMN IF NOT EXISTS modified_datetime TIMESTAMP;
ALTER TABLE student_submission ADD COLUMN IF NOT EXISTS record_status     VARCHAR;
ALTER TABLE student_submission ADD COLUMN IF NOT EXISTS version_no        INTEGER;

-- ── subject_master ────────────────────────────────────────────────
-- subject_code already exists in local DB.
ALTER TABLE subject_master ADD COLUMN IF NOT EXISTS created_datetime  TIMESTAMP;
ALTER TABLE subject_master ADD COLUMN IF NOT EXISTS modified_datetime TIMESTAMP;
ALTER TABLE subject_master ADD COLUMN IF NOT EXISTS record_status     VARCHAR;
ALTER TABLE subject_master ADD COLUMN IF NOT EXISTS version_no        INTEGER;

-- ── teacher_master ────────────────────────────────────────────────
-- email_id rename handled in Part 1.
-- subject_name, class_id, section_1, section_2, role already exist in local DB.
ALTER TABLE teacher_master ADD COLUMN IF NOT EXISTS is_active  BOOLEAN;
ALTER TABLE teacher_master ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;


-- ============================================================
-- PART 3  —  BIGINT TYPE PROMOTIONS  (non-blocking — defer if needed)
--
-- SQLAlchemy's BigInteger ORM columns read/write fine against
-- integer DB columns for all values in the normal ERP range,
-- so the backend will start without these changes.  They are
-- included here for full structural RDS alignment.
--
-- Strategy: drop FK constraints, promote PK then FK columns in
-- dependency order, recreate constraints.  Each block is guarded
-- so it is a no-op if the column is already bigint.
-- ============================================================

-- ── Drop all FK constraints on affected tables ────────────────────
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT tc.constraint_name, tc.table_name
        FROM   information_schema.table_constraints tc
        WHERE  tc.constraint_type = 'FOREIGN KEY'
          AND  tc.table_name IN (
                 'assignment_master', 'chapter_master', 'class_master',
                 'notice_board', 'parent_student_map', 'quiz_master',
                 'quiz_response', 'student_master', 'student_submission',
                 'subject_master', 'teacher_master', 'teacher_parent_interaction',
                 'support_tickets', 'ticket_messages'
               )
    LOOP
        EXECUTE format(
            'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
            r.table_name, r.constraint_name
        );
    END LOOP;
    RAISE NOTICE 'FK constraints dropped for type promotion';
END $$;

-- ── Root PKs first ────────────────────────────────────────────────
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='class_master'      AND column_name='class_id')     ='integer' THEN ALTER TABLE class_master      ALTER COLUMN class_id     TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='teacher_master'    AND column_name='teacher_id')   ='integer' THEN ALTER TABLE teacher_master    ALTER COLUMN teacher_id   TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='subject_master'    AND column_name='subject_id')   ='integer' THEN ALTER TABLE subject_master    ALTER COLUMN subject_id   TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='chapter_master'    AND column_name='chapter_id')   ='integer' THEN ALTER TABLE chapter_master    ALTER COLUMN chapter_id   TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='student_master'    AND column_name='student_id')   ='integer' THEN ALTER TABLE student_master    ALTER COLUMN student_id   TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='assignment_master' AND column_name='assignment_id')='integer' THEN ALTER TABLE assignment_master ALTER COLUMN assignment_id TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='quiz_master'       AND column_name='quiz_id')      ='integer' THEN ALTER TABLE quiz_master       ALTER COLUMN quiz_id      TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='notice_board'      AND column_name='notice_id')    ='integer' THEN ALTER TABLE notice_board      ALTER COLUMN notice_id    TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='student_submission' AND column_name='submission_id')='integer' THEN ALTER TABLE student_submission ALTER COLUMN submission_id TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='quiz_response'     AND column_name='response_id')  ='integer' THEN ALTER TABLE quiz_response     ALTER COLUMN response_id  TYPE bigint; END IF; END $$;

-- ── FK columns (depend on PKs above) ─────────────────────────────
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='subject_master'    AND column_name='class_id')     ='integer' THEN ALTER TABLE subject_master    ALTER COLUMN class_id     TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='subject_master'    AND column_name='teacher_id')   ='integer' THEN ALTER TABLE subject_master    ALTER COLUMN teacher_id   TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='chapter_master'    AND column_name='subject_id')   ='integer' THEN ALTER TABLE chapter_master    ALTER COLUMN subject_id   TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='assignment_master' AND column_name='chapter_id')   ='integer' THEN ALTER TABLE assignment_master ALTER COLUMN chapter_id   TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='assignment_master' AND column_name='assigned_by')  ='integer' THEN ALTER TABLE assignment_master ALTER COLUMN assigned_by  TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='notice_board'      AND column_name='posted_by')    ='integer' THEN ALTER TABLE notice_board      ALTER COLUMN posted_by    TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='quiz_master'       AND column_name='chapter_id')   ='integer' THEN ALTER TABLE quiz_master       ALTER COLUMN chapter_id   TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='quiz_response'     AND column_name='quiz_id')      ='integer' THEN ALTER TABLE quiz_response     ALTER COLUMN quiz_id      TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='quiz_response'     AND column_name='student_id')   ='integer' THEN ALTER TABLE quiz_response     ALTER COLUMN student_id   TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='student_master'    AND column_name='class_id')     ='integer' THEN ALTER TABLE student_master    ALTER COLUMN class_id     TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='student_submission' AND column_name='assignment_id')='integer' THEN ALTER TABLE student_submission ALTER COLUMN assignment_id TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='student_submission' AND column_name='student_id')  ='integer' THEN ALTER TABLE student_submission ALTER COLUMN student_id   TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='teacher_parent_interaction' AND column_name='teacher_id')='integer' THEN ALTER TABLE teacher_parent_interaction ALTER COLUMN teacher_id TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='teacher_parent_interaction' AND column_name='student_id')='integer' THEN ALTER TABLE teacher_parent_interaction ALTER COLUMN student_id TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='teacher_parent_interaction' AND column_name='class_id')  ='integer' THEN ALTER TABLE teacher_parent_interaction ALTER COLUMN class_id   TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='parent_student_map' AND column_name='student_id') ='integer' THEN ALTER TABLE parent_student_map ALTER COLUMN student_id TYPE bigint; END IF; END $$;
DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name='support_tickets'    AND column_name='student_id') ='integer' THEN ALTER TABLE support_tickets    ALTER COLUMN student_id TYPE bigint; END IF; END $$;

-- ── Recreate FK constraints (with explicit names for idempotency) ─
ALTER TABLE subject_master
    ADD CONSTRAINT subject_master_class_id_fkey
    FOREIGN KEY (class_id) REFERENCES class_master(class_id);

ALTER TABLE subject_master
    ADD CONSTRAINT subject_master_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES teacher_master(teacher_id);

ALTER TABLE chapter_master
    ADD CONSTRAINT chapter_master_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES subject_master(subject_id);

ALTER TABLE assignment_master
    ADD CONSTRAINT assignment_master_chapter_id_fkey
    FOREIGN KEY (chapter_id) REFERENCES chapter_master(chapter_id);

ALTER TABLE assignment_master
    ADD CONSTRAINT assignment_master_assigned_by_fkey
    FOREIGN KEY (assigned_by) REFERENCES teacher_master(teacher_id);

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
    FOREIGN KEY (posted_by) REFERENCES teacher_master(teacher_id);

ALTER TABLE teacher_parent_interaction
    ADD CONSTRAINT teacher_parent_interaction_v2_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES teacher_master(teacher_id);

ALTER TABLE teacher_parent_interaction
    ADD CONSTRAINT teacher_parent_interaction_v2_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES student_master(student_id);

ALTER TABLE teacher_parent_interaction
    ADD CONSTRAINT teacher_parent_interaction_v2_class_id_fkey
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

ALTER TABLE ticket_messages
    ADD CONSTRAINT ticket_messages_ticket_id_fkey
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(ticket_id);

COMMIT;
