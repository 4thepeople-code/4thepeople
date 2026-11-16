-- ============================================================================
-- 4thepeople — Baseline Outbox Queue Infrastructure & Stored Procedures
-- Script: backend/scripts/provision_outbox_functions.sql
--
-- Provisions:
--   1. email_outbox table (if not exists)
--   2. Queue stored procedures (SECURITY DEFINER, pg_catalog search_path):
--      - public.fn_outbox_claim(p_lease_seconds, p_batch_size)
--      - public.fn_outbox_complete(p_job_id, p_worker_token)
--      - public.fn_outbox_fail(p_job_id, p_worker_token, p_error_message)
--      - public.fn_outbox_expire()
--      - public.fn_outbox_extend_lease(p_job_id, p_worker_token, p_extension_seconds)
--   3. Least-privilege role permissions (yuva_outbox_worker, app_user)
--
-- Invariants:
--   - Worker role yuva_outbox_worker has EXECUTE on functions only;
--     direct SELECT, INSERT, UPDATE, DELETE on email_outbox are strictly revoked.
--   - All procedures enforce strict lease fencing via UUID claim_token.
--   - Functions run as SECURITY DEFINER with fixed search_path to resist hijack.
-- ============================================================================

-- 1. Create email_outbox table
CREATE TABLE IF NOT EXISTS public.email_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    template_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'EXPIRED', 'DEAD_LETTER')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    claim_token UUID,
    locked_until TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    delivered_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ
);

-- Indexes for performance & concurrency
CREATE INDEX IF NOT EXISTS idx_email_outbox_claim 
    ON public.email_outbox (status, attempts, max_attempts, expires_at) 
    WHERE status IN ('PENDING', 'PROCESSING', 'FAILED');

CREATE INDEX IF NOT EXISTS idx_email_outbox_college_recipient 
    ON public.email_outbox (college_id, recipient_email);

-- 2. Stored Procedure: fn_outbox_claim
-- Claims up to p_batch_size jobs using FOR UPDATE SKIP LOCKED.
-- Stamped with a unique UUID claim_token and locked_until lease timestamp.
CREATE OR REPLACE FUNCTION public.fn_outbox_claim(
    p_lease_seconds INTEGER DEFAULT 120,
    p_batch_size INTEGER DEFAULT 1
)
RETURNS TABLE(
    id UUID,
    college_id UUID,
    recipient_email TEXT,
    recipient_name TEXT,
    template_type TEXT,
    payload JSONB,
    attempts INTEGER,
    claim_token UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
BEGIN
    IF p_lease_seconds IS NULL OR p_lease_seconds < 10 OR p_lease_seconds > 600 THEN
        RAISE EXCEPTION 'p_lease_seconds must be between 10 and 600';
    END IF;
    IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 50 THEN
        RAISE EXCEPTION 'p_batch_size must be between 1 and 50';
    END IF;

    RETURN QUERY
    WITH candidate AS (
        SELECT o.id AS job_id
        FROM public.email_outbox o
        WHERE o.status IN ('PENDING', 'FAILED')
          AND o.attempts < o.max_attempts
          AND o.expires_at > NOW()
          AND (o.locked_until IS NULL OR o.locked_until < NOW())
        ORDER BY o.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_batch_size
    ),
    claimed AS (
        UPDATE public.email_outbox target
        SET status = 'PROCESSING',
            attempts = target.attempts + 1,
            claim_token = gen_random_uuid(),
            locked_until = NOW() + (p_lease_seconds || ' seconds')::interval,
            last_attempt_at = NOW()
        FROM candidate
        WHERE target.id = candidate.job_id
        RETURNING target.id, target.college_id, target.recipient_email,
                  target.recipient_name, target.template_type, target.payload,
                  target.attempts, target.claim_token
    )
    SELECT * FROM claimed;
END;
$$;

-- 3. Stored Procedure: fn_outbox_complete
-- Enforces lease fencing: only the worker holding the exact claim_token can complete the job.
CREATE OR REPLACE FUNCTION public.fn_outbox_complete(
    p_job_id UUID,
    p_worker_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
DECLARE
    v_updated_rows INT;
BEGIN
    IF p_job_id IS NULL OR p_worker_token IS NULL THEN
        RAISE EXCEPTION 'p_job_id and p_worker_token are required';
    END IF;

    UPDATE public.email_outbox
    SET status = 'DELIVERED',
        delivered_at = NOW(),
        claim_token = NULL,
        locked_until = NULL,
        error_message = NULL
    WHERE id = p_job_id
      AND claim_token = p_worker_token
      AND status = 'PROCESSING'
      AND locked_until >= NOW();

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    RETURN (v_updated_rows > 0);
END;
$$;

-- 4. Stored Procedure: fn_outbox_fail
-- Handles attempt failure, dead-lettering, and lease fencing.
CREATE OR REPLACE FUNCTION public.fn_outbox_fail(
    p_job_id UUID,
    p_worker_token UUID,
    p_error_message TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
DECLARE
    v_updated_rows INT;
    v_attempts INT;
    v_max_attempts INT;
BEGIN
    IF p_job_id IS NULL OR p_worker_token IS NULL THEN
        RAISE EXCEPTION 'p_job_id and p_worker_token are required';
    END IF;

    SELECT attempts, max_attempts INTO v_attempts, v_max_attempts
    FROM public.email_outbox
    WHERE id = p_job_id;

    IF v_attempts >= v_max_attempts THEN
        UPDATE public.email_outbox
        SET status = 'DEAD_LETTER',
            claim_token = NULL,
            locked_until = NULL,
            error_message = SUBSTRING(p_error_message FROM 1 FOR 500)
        WHERE id = p_job_id
          AND claim_token = p_worker_token;
    ELSE
        UPDATE public.email_outbox
        SET status = 'FAILED',
            claim_token = NULL,
            locked_until = NULL,
            error_message = SUBSTRING(p_error_message FROM 1 FOR 500)
        WHERE id = p_job_id
          AND claim_token = p_worker_token;
    END IF;

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    RETURN (v_updated_rows > 0);
END;
$$;

-- 5. Stored Procedure: fn_outbox_expire
-- Reaper for expired or timed-out un-sent messages.
CREATE OR REPLACE FUNCTION public.fn_outbox_expire()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
DECLARE
    v_expired_count INT;
BEGIN
    UPDATE public.email_outbox
    SET status = 'EXPIRED',
        claim_token = NULL,
        locked_until = NULL,
        error_message = 'Job expired before delivery could complete'
    WHERE status IN ('PENDING', 'FAILED')
      AND expires_at <= NOW();

    GET DIAGNOSTICS v_expired_count = ROW_COUNT;
    RETURN v_expired_count;
END;
$$;

-- 6. Stored Procedure: fn_outbox_extend_lease
-- Allows long-running sends to renew their lock lease safely.
CREATE OR REPLACE FUNCTION public.fn_outbox_extend_lease(
    p_job_id UUID,
    p_worker_token UUID,
    p_extension_seconds INTEGER DEFAULT 120
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
DECLARE
    v_updated_rows INT;
BEGIN
    IF p_job_id IS NULL OR p_worker_token IS NULL THEN
        RAISE EXCEPTION 'p_job_id and p_worker_token are required';
    END IF;

    UPDATE public.email_outbox
    SET locked_until = NOW() + (p_extension_seconds || ' seconds')::interval
    WHERE id = p_job_id
      AND claim_token = p_worker_token
      AND status = 'PROCESSING'
      AND locked_until >= NOW();

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    RETURN (v_updated_rows > 0);
END;
$$;

-- 7. Grant execution privileges to worker role (if role exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'yuva_outbox_worker') THEN
        GRANT USAGE ON SCHEMA public TO yuva_outbox_worker;
        GRANT EXECUTE ON FUNCTION public.fn_outbox_claim(INTEGER, INTEGER) TO yuva_outbox_worker;
        GRANT EXECUTE ON FUNCTION public.fn_outbox_complete(UUID, UUID) TO yuva_outbox_worker;
        GRANT EXECUTE ON FUNCTION public.fn_outbox_fail(UUID, UUID, TEXT) TO yuva_outbox_worker;
        GRANT EXECUTE ON FUNCTION public.fn_outbox_expire() TO yuva_outbox_worker;
        GRANT EXECUTE ON FUNCTION public.fn_outbox_extend_lease(UUID, UUID, INTEGER) TO yuva_outbox_worker;

        -- Strictly forbid direct table modifications from the worker role
        REVOKE SELECT, INSERT, UPDATE, DELETE ON public.email_outbox FROM yuva_outbox_worker;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        GRANT USAGE ON SCHEMA public TO app_user;
        GRANT INSERT ON public.email_outbox TO app_user;
        GRANT SELECT (id, college_id, recipient_email, recipient_name, template_type, status, created_at, expires_at)
            ON public.email_outbox TO app_user;
        REVOKE UPDATE, DELETE ON public.email_outbox FROM app_user;
    END IF;
END;
$$;
