-- ============================================================
-- v003_teacher_phone_bigint.sql
-- Convert teacher_master.phone  VARCHAR → BIGINT
-- ============================================================
-- WHY THIS IS NEEDED
-- ─────────────────
-- The SQLAlchemy model TeacherMaster.phone was declared as
-- Column(String) while the SSS RDS column is BIGINT.
-- When DB_TABLE_PREFIX="sss_" the app connects to RDS, and
-- any INSERT with a Python str raises:
--
--   psycopg2.errors.DatatypeMismatch: column "phone" is of
--   type bigint but expression is of type character varying
--
-- Fix: change the physical local column to match RDS so both
-- local dev and RDS point to the same type.
--
-- SAFETY GUARANTEES
-- ─────────────────
-- • All DDL is wrapped in a single transaction. ROLLBACK is
--   automatic if anything fails.
-- • Non-numeric phone strings are NULLed first so the type
--   cast never raises an error.
-- • Both the plain (local dev) and sss_ (RDS-aligned) table
--   names are handled via a DO $$ block using the
--   DB_TABLE_PREFIX environment variable approach — but since
--   SQL cannot read env vars, this script handles BOTH table
--   names in one run (the IF EXISTS guard makes whichever
--   is absent a safe no-op).
--
-- HOW TO RUN (local dev only — NEVER run against RDS)
-- ─────────────────────────────────────────────────────
--   Windows PowerShell:
--     $env:PGPASSWORD = "1234"
--     & "C:\Program Files\PostgreSQL\17\bin\psql.exe" `
--         -U postgres -d mydb_sss `
--         -f "backend/migrations/v003_teacher_phone_bigint.sql"
--
--   Linux / macOS:
--     PGPASSWORD=1234 psql -U postgres -d mydb_sss \
--         -f backend/migrations/v003_teacher_phone_bigint.sql
-- ============================================================

BEGIN;

-- ── Helper: convert phone varchar→bigint for ONE table name ──────────────────
-- Runs only when that table actually exists in the current database.

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['teacher_master', 'sss_teacher_master']
    LOOP
        -- Skip if the table does not exist in this database
        IF NOT EXISTS (
            SELECT 1
            FROM   information_schema.tables
            WHERE  table_schema = 'public'
            AND    table_name   = tbl
        ) THEN
            RAISE NOTICE 'Table % does not exist — skipping.', tbl;
            CONTINUE;
        END IF;

        -- Skip if the column is already bigint (idempotent)
        IF EXISTS (
            SELECT 1
            FROM   information_schema.columns
            WHERE  table_schema = 'public'
            AND    table_name   = tbl
            AND    column_name  = 'phone'
            AND    data_type    = 'bigint'
        ) THEN
            RAISE NOTICE 'Column %.phone is already bigint — skipping.', tbl;
            CONTINUE;
        END IF;

        -- Step 1: NULL out any non-numeric phone strings so the
        --         USING cast below never raises an error.
        EXECUTE format(
            'UPDATE %I
             SET    phone = NULL
             WHERE  phone IS NOT NULL
             AND    phone !~ ''^[0-9]+$''',
            tbl
        );
        RAISE NOTICE 'Cleared non-numeric phone values in %.', tbl;

        -- Step 2: Change the column type to BIGINT.
        --         USING phone::bigint converts numeric strings;
        --         NULLs pass through unchanged.
        EXECUTE format(
            'ALTER TABLE %I
             ALTER COLUMN phone TYPE BIGINT
             USING phone::BIGINT',
            tbl
        );
        RAISE NOTICE 'Converted %.phone from VARCHAR to BIGINT.', tbl;
    END LOOP;
END;
$$;

COMMIT;
-- ── End of v003 ──────────────────────────────────────────────────────────────
