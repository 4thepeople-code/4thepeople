-- ============================================================================
-- Migration 006: External Registration Integrity and Tenant Isolation
-- ============================================================================
-- Objective:
--   1. Add UNIQUE constraint on (external_participant_id, event_id) in
--      event_registrations to prevent duplicate external registrations.
--   2. Add college_id column to external_auth_otps for tenant scoping.
--   3. Enable Row-Level Security on external_auth_otps with tenant-scoped policies.
--   4. Enable Row-Level Security on external_participants with tenant-scoped policies.
--
-- Strategy: Forward-only, additive, fully idempotent, non-destructive.
-- Execution Role: migrator
-- Target Role: app_user (rolbypassrls = false — never granted BYPASSRLS)
-- Prerequisite: Migrations 003, 004, 005 applied.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. UNIQUE CONSTRAINT: external participant registrations
-- ============================================================================
-- The plain index idx_event_registrations_external_event from migration 003
-- does not prevent concurrent duplicate inserts. This unique constraint does.

ALTER TABLE event_registrations
  DROP CONSTRAINT IF EXISTS uq_event_registrations_external_event;
ALTER TABLE event_registrations
  ADD CONSTRAINT uq_event_registrations_external_event
  UNIQUE (external_participant_id, event_id);

-- ============================================================================
-- 2. ADD college_id TO external_auth_otps
-- ============================================================================
-- external_auth_otps previously had no college scope, which prevented RLS.
-- Adding college_id enables standard tenant-isolation policies.

ALTER TABLE external_auth_otps
  ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES colleges(id) ON DELETE CASCADE;

-- PREFLIGHT CHECK: detect non-expired legacy OTP records that cannot be
-- automatically assigned a college_id. These records predate Phase 3 and
-- have no associated ExternalParticipant record. If any exist, the migration
-- aborts with a clear error rather than silently deleting valid auth data.
DO $$
DECLARE
  v_unexpired_legacy_count INT;
BEGIN
  SELECT COUNT(*) INTO v_unexpired_legacy_count
  FROM external_auth_otps
  WHERE college_id IS NULL
    AND consumed_at IS NULL
    AND expires_at > now();

  IF v_unexpired_legacy_count > 0 THEN
    RAISE EXCEPTION
      'MIGRATION 006 ABORTED: % non-expired external_auth_otps records have '
      'college_id = NULL and cannot be automatically assigned a tenant. '
      'These records must be manually reviewed and deleted or assigned before '
      'this migration can run. Do NOT delete valid OTP records without user consent.',
      v_unexpired_legacy_count;
  END IF;
END $$;

-- Safe to remove expired legacy records (consumed or past expiry, college_id = NULL).
-- These can never be successfully verified and have no active session value.
DELETE FROM external_auth_otps
WHERE college_id IS NULL
  AND (consumed_at IS NOT NULL OR expires_at <= now());

-- Enforce NOT NULL: at this point, all remaining rows either have college_id set
-- (from Phase 3 onwards) or were deleted above. The preflight check above ensures
-- no valid unexpired records remain with NULL.
ALTER TABLE external_auth_otps
  ALTER COLUMN college_id SET NOT NULL;

-- Drop old candidate index; replace with college-scoped composite index
-- which significantly improves OTP candidate lookup performance.
DROP INDEX IF EXISTS idx_external_otps_candidate;
CREATE INDEX IF NOT EXISTS idx_external_otps_candidate
  ON external_auth_otps(email, college_id, consumed_at, expires_at);

-- ============================================================================
-- 3. ROW-LEVEL SECURITY: external_auth_otps
-- ============================================================================
ALTER TABLE external_auth_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS external_auth_otps_select_policy ON external_auth_otps;
DROP POLICY IF EXISTS external_auth_otps_insert_policy ON external_auth_otps;
DROP POLICY IF EXISTS external_auth_otps_update_policy ON external_auth_otps;
DROP POLICY IF EXISTS external_auth_otps_delete_policy ON external_auth_otps;

CREATE POLICY external_auth_otps_select_policy ON external_auth_otps
  FOR SELECT TO app_user
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

CREATE POLICY external_auth_otps_insert_policy ON external_auth_otps
  FOR INSERT TO app_user
  WITH CHECK (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

CREATE POLICY external_auth_otps_update_policy ON external_auth_otps
  FOR UPDATE TO app_user
  USING  (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid)
  WITH CHECK (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

CREATE POLICY external_auth_otps_delete_policy ON external_auth_otps
  FOR DELETE TO app_user
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

-- ============================================================================
-- 4. ROW-LEVEL SECURITY: external_participants
-- ============================================================================
ALTER TABLE external_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS external_participants_select_policy ON external_participants;
DROP POLICY IF EXISTS external_participants_insert_policy ON external_participants;
DROP POLICY IF EXISTS external_participants_update_policy ON external_participants;
DROP POLICY IF EXISTS external_participants_delete_policy ON external_participants;

CREATE POLICY external_participants_select_policy ON external_participants
  FOR SELECT TO app_user
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

CREATE POLICY external_participants_insert_policy ON external_participants
  FOR INSERT TO app_user
  WITH CHECK (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

CREATE POLICY external_participants_update_policy ON external_participants
  FOR UPDATE TO app_user
  USING  (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid)
  WITH CHECK (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

CREATE POLICY external_participants_delete_policy ON external_participants
  FOR DELETE TO app_user
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

-- ============================================================================
-- 5. PRIVILEGE GRANTS (idempotent)
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_participants TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_auth_otps TO app_user;

COMMIT;
