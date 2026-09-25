-- ============================================================
-- v004_users_master.sql
-- Create local users_master table and re-point four FK columns
-- from teacher_master.teacher_id → users_master.user_id
-- ============================================================
-- WHY THIS IS NEEDED
-- ─────────────────
-- Production SSS RDS schema:
--   sss_subject_master.teacher_id     → sss_users_master(user_id)
--   sss_class_master.class_teacher_id → sss_users_master(user_id)
--   sss_assignment_master.assigned_by → sss_users_master(user_id)
--   sss_notice_board.posted_by        → sss_users_master(user_id)
--
-- The local database previously had these columns pointing at
-- teacher_master.teacher_id.  Inserting seed rows with valid
-- users_master.user_id values against the old FK caused
-- PostgreSQL FK-violation errors.
--
-- This migration:
--   1. Creates the local users_master table (mirrors RDS schema).
--   2. NULLs out the four FK columns (old teacher_id values are
--      not valid users_master.user_id values — the tables have
--      separate ID sequences).
--   3. Drops the old FK constraints that pointed at teacher_master.
--   4. Adds new FK constraints pointing at users_master.user_id.
--
-- SAFETY GUARANTEES
-- ─────────────────
-- • Entire migration runs inside one transaction — ROLLBACK on error.
-- • All DROP CONSTRAINT calls use IF EXISTS — safe to re-run.
-- • CREATE TABLE uses IF NOT EXISTS — idempotent.
-- • NULLing FK columns before adding new constraints prevents
--   "insert or update violates foreign key constraint" on existing rows.
--
-- LOCAL DEV ONLY — NEVER run against AWS RDS.
-- RDS tables already exist with the correct schema.
--
-- HOW TO RUN
-- ──────────
--   Windows PowerShell:
--     $env:PGPASSWORD = "1234"
--     & "C:\Program Files\PostgreSQL\17\bin\psql.exe" `
--         -U postgres -d mydb_sss `
--         -f "backend/migrations/v004_users_master.sql"
--
--   Linux / macOS:
--     PGPASSWORD=1234 psql -U postgres -d mydb_sss \
--         -f backend/migrations/v004_users_master.sql
-- ============================================================

BEGIN;

-- ── Step 1: Create users_master (local, no prefix) ──────────────────────────
-- Mirrors the column layout of sss_users_master on RDS.
-- GENERATED ALWAYS AS IDENTITY gives auto-increment bigint PKs locally,
-- matching the RDS bigint sequence behaviour.

CREATE TABLE IF NOT EXISTS users_master (
    user_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    login_id          VARCHAR UNIQUE,
    password_hash     TEXT,
    full_name         VARCHAR,
    email_id          VARCHAR,           -- physical col name (model aliases to 'email')
    mobile_no         VARCHAR,           -- VARCHAR on RDS (not bigint)
    role_id           BIGINT,            -- FK to sss_roles — not enforced locally
    school_id         BIGINT,            -- FK to sss_schools — not enforced locally
    is_active         BOOLEAN DEFAULT TRUE,
    created_datetime  TIMESTAMP,
    modified_datetime TIMESTAMP,
    record_status     VARCHAR,
    version_no        INTEGER
);

-- Step 1 complete: users_master table created (or already existed).

-- ── Step 2: NULL out FK columns that currently reference teacher_master ───────
-- Existing rows carry teacher_id values that do NOT exist in users_master.
-- NULLing them is safe because all four columns are nullable (no NOT NULL
-- constraint in the local schema), and fresh seed data will repopulate them.

UPDATE subject_master    SET teacher_id      = NULL WHERE teacher_id      IS NOT NULL;
UPDATE class_master      SET class_teacher_id= NULL WHERE class_teacher_id IS NOT NULL;
UPDATE assignment_master SET assigned_by     = NULL WHERE assigned_by      IS NOT NULL;
UPDATE notice_board      SET posted_by       = NULL WHERE posted_by        IS NOT NULL;

-- Step 2 complete: FK columns NULLed on subject_master, class_master, assignment_master, notice_board.

-- ── Step 3: Drop old FK constraints (pointing at teacher_master) ──────────────
-- Constraint names follow PostgreSQL's default naming convention used by
-- SQLAlchemy: {table}_{column}_fkey.  IF EXISTS keeps the script re-runnable.

ALTER TABLE subject_master
    DROP CONSTRAINT IF EXISTS subject_master_teacher_id_fkey;

-- class_master.class_teacher_id had no FK constraint previously (nullable col,
-- no ForeignKey() in the old model), so no DROP is needed here.

ALTER TABLE assignment_master
    DROP CONSTRAINT IF EXISTS assignment_master_assigned_by_fkey;

ALTER TABLE notice_board
    DROP CONSTRAINT IF EXISTS notice_board_posted_by_fkey;

-- Step 3 complete: old FK constraints dropped (IF EXISTS — safe if already absent).

-- ── Step 4: Add new FK constraints pointing at users_master.user_id ─────────

ALTER TABLE subject_master
    ADD CONSTRAINT subject_master_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES users_master(user_id);

ALTER TABLE class_master
    ADD CONSTRAINT class_master_class_teacher_id_fkey
    FOREIGN KEY (class_teacher_id) REFERENCES users_master(user_id);

ALTER TABLE assignment_master
    ADD CONSTRAINT assignment_master_assigned_by_fkey
    FOREIGN KEY (assigned_by) REFERENCES users_master(user_id);

ALTER TABLE notice_board
    ADD CONSTRAINT notice_board_posted_by_fkey
    FOREIGN KEY (posted_by) REFERENCES users_master(user_id);

-- Step 4 complete: new FK constraints added — all four columns now reference users_master(user_id).

COMMIT;

-- ── Verification query (run separately after migration) ───────────────────────
-- SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_col
-- FROM   information_schema.table_constraints AS tc
-- JOIN   information_schema.key_column_usage  AS kcu USING (constraint_name, table_schema)
-- JOIN   information_schema.constraint_column_usage AS ccu USING (constraint_name, table_schema)
-- WHERE  tc.constraint_type = 'FOREIGN KEY'
-- AND    ccu.table_name = 'users_master'
-- ORDER BY tc.table_name;
-- Expected: 4 rows — subject_master, class_master, assignment_master, notice_board
-- ── End of v004 ───────────────────────────────────────────────────────────────
