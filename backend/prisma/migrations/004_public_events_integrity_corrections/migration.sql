-- Migration: 004_public_events_integrity_corrections
-- Description: Targeted integrity corrections for Public Events, Cross-Tenant Lifecycle, Dedicated Role Hardening, Certificate Preservation, and Financial Protection.
-- Strategy: Forward-only, additive, fully idempotent, and non-destructive.
-- Prerequisite: Dedicated role user_deletion_executor pre-provisioned via backend/scripts/dba_provision_executor.sql.
-- Execution Role: migrator (owns schema public and all domain tables).
-- Parity: Synchronized byte-for-byte with backend/migrations/004_public_events_integrity_corrections.sql.

BEGIN;

-- ============================================================================
-- 1. RESTORE STRICT REGISTRATION IDENTITY CONSTRAINT
-- ============================================================================
-- Enforces the 3 valid lifecycle states:
-- 1) Active student: participant_type = 'STUDENT', user_id IS NOT NULL, external_participant_id IS NULL, is_user_deleted = false
-- 2) Deleted student: participant_type = 'STUDENT', user_id IS NULL, external_participant_id IS NULL, is_user_deleted = true
-- 3) External participant: participant_type = 'EXTERNAL', external_participant_id IS NOT NULL, user_id IS NULL, is_user_deleted = false

ALTER TABLE event_registrations
  DROP CONSTRAINT IF EXISTS chk_registration_participant_identity;
ALTER TABLE event_registrations
  ADD CONSTRAINT chk_registration_participant_identity
  CHECK (
    NOT (user_id IS NOT NULL AND external_participant_id IS NOT NULL)
    AND
    (
      -- Active student: registered active student in the college system
      (participant_type = 'STUDENT' AND user_id IS NOT NULL AND external_participant_id IS NULL AND is_user_deleted = false)
      OR
      -- Deleted student: historical student registration preserved after account deletion
      (participant_type = 'STUDENT' AND user_id IS NULL AND external_participant_id IS NULL AND is_user_deleted = true)
      OR
      -- External participant: verified external guest
      (participant_type = 'EXTERNAL' AND external_participant_id IS NOT NULL AND user_id IS NULL AND is_user_deleted = false)
    )
  );

-- ============================================================================
-- 2. USER DELETION TRIGGER & DEDICATED ROLE OWNERSHIP LIFECYCLE
-- ============================================================================
-- Solves cross-tenant user deletion under RLS with principle of least privilege.
-- When Student S from College A deletes their account (or is deleted by College A admin),
-- Student S may have event_registrations and event_certificates across other colleges (e.g. College B).
-- Because tenant_isolation_event_registrations restricts app_user to college_id = app.college_id,
-- a standard trigger running as app_user cannot update rows in College B.
-- Executing as user_deletion_executor (which holds BYPASSRLS and column-level UPDATE on user_id/is_user_deleted)
-- allows updating ONLY the rows directly referencing user_id = OLD.id across all colleges,
-- atomically setting user_id = NULL and is_user_deleted = true without exposing or leaking
-- unrelated tenant data, and without executing as a broad platform administrative role.
--
-- Strict execution sequence:
-- 1. Idempotency preflight: drop trigger and drop function under SET ROLE user_deletion_executor if already owned.
-- 2. Create handle_user_pre_delete() as migrator.
-- 3. Create trg_user_pre_delete while migrator owns both the table users and the function.
-- 4. Revoke PUBLIC EXECUTE and grant EXECUTE to app_user while migrator owns the function.
-- 5. Grant the required column-level privileges to user_deletion_executor.
-- 6. Temporarily grant CREATE on public to user_deletion_executor.
-- 7. Transfer function ownership to user_deletion_executor.
-- 8. Revoke temporary CREATE on public (enforcing least privilege).
-- 9. Revoke migrator's temporary membership in user_deletion_executor.

-- Step 1: Idempotency preflight for rerun safety
DROP TRIGGER IF EXISTS trg_user_pre_delete ON users;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    JOIN pg_roles r ON p.proowner = r.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'handle_user_pre_delete'
      AND r.rolname = 'user_deletion_executor'
  ) THEN
    SET ROLE user_deletion_executor;
    DROP FUNCTION public.handle_user_pre_delete();
    RESET ROLE;
  END IF;
END $$;

-- Step 2: Create handle_user_pre_delete() as migrator (search_path locked to pg_catalog, pg_temp)
CREATE OR REPLACE FUNCTION public.handle_user_pre_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  -- Atomically update registrations for the deleted user across all colleges
  UPDATE public.event_registrations
  SET user_id = NULL,
      is_user_deleted = true
  WHERE user_id = OLD.id;

  -- Atomically preserve certificates by decoupling user_id across all colleges
  UPDATE public.event_certificates
  SET user_id = NULL
  WHERE user_id = OLD.id;

  RETURN OLD;
END;
$$;

-- Step 3: Create trg_user_pre_delete while migrator owns both the table users and the function
CREATE TRIGGER trg_user_pre_delete
BEFORE DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION handle_user_pre_delete();

-- Step 4: Revoke PUBLIC EXECUTE and grant EXECUTE to app_user while migrator owns the function
REVOKE ALL ON FUNCTION public.handle_user_pre_delete() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_user_pre_delete() TO app_user;

-- Step 5: Grant the required column-level privileges to pre-provisioned user_deletion_executor
GRANT USAGE ON SCHEMA public TO user_deletion_executor;
GRANT SELECT (user_id), UPDATE (user_id, is_user_deleted) ON public.event_registrations TO user_deletion_executor;
GRANT SELECT (user_id), UPDATE (user_id) ON public.event_certificates TO user_deletion_executor;

-- Step 6: Temporarily grant CREATE on public to user_deletion_executor (required to own objects in public)
GRANT CREATE ON SCHEMA public TO user_deletion_executor;

-- Step 7: Transfer function ownership to user_deletion_executor
-- (migrator owns the function and is a member of user_deletion_executor via DBA pre-provisioning)
ALTER FUNCTION public.handle_user_pre_delete() OWNER TO user_deletion_executor;

-- Step 8: Revoke temporary CREATE on schema public to enforce least privilege (retaining strictly USAGE)
REVOKE CREATE ON SCHEMA public FROM user_deletion_executor;

-- Step 9: Revoke migrator's temporary membership in user_deletion_executor
REVOKE user_deletion_executor FROM migrator;

-- ============================================================================
-- 3. PRESERVE EVENT CERTIFICATES DURING USER DELETION
-- ============================================================================
-- Relax user_id NOT NULL constraint on event_certificates so certificates survive student deletion
ALTER TABLE event_certificates
  ALTER COLUMN user_id DROP NOT NULL;

-- Replace compound CASCADE foreign key with modern direct foreign key using ON DELETE SET NULL
ALTER TABLE event_certificates
  DROP CONSTRAINT IF EXISTS fk_certificates_user;
ALTER TABLE event_certificates
  ADD CONSTRAINT fk_certificates_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- 4. PROTECT PAYMENT TRANSACTIONS FROM EVENT DELETION
-- ============================================================================
-- Enforce ON DELETE RESTRICT on events from payment_transactions.
-- Physical deletion of an event is blocked if any payment transactions reference it.
-- Events with financial history must use soft deletion (cancelled_at).
ALTER TABLE payment_transactions
  DROP CONSTRAINT IF EXISTS fk_payment_transactions_event;
ALTER TABLE payment_transactions
  ADD CONSTRAINT fk_payment_transactions_event
  FOREIGN KEY (college_id, event_id) REFERENCES events(college_id, id) ON DELETE RESTRICT;

-- Make reservation_id nullable with ON DELETE SET NULL on payment_transactions.
-- Prevents deletion/cleanup of ephemeral seat reservations from deleting or invalidating financial ledger history.
ALTER TABLE payment_transactions
  ALTER COLUMN reservation_id DROP NOT NULL;

ALTER TABLE payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_reservation_id_fkey;
ALTER TABLE payment_transactions
  DROP CONSTRAINT IF EXISTS fk_payment_transactions_reservation;
ALTER TABLE payment_transactions
  ADD CONSTRAINT fk_payment_transactions_reservation
  FOREIGN KEY (reservation_id) REFERENCES seat_reservations(id) ON DELETE SET NULL;

-- Ensure payment_refunds explicitly RESTRICT payment_transactions deletion
ALTER TABLE payment_refunds
  DROP CONSTRAINT IF EXISTS payment_refunds_transaction_id_fkey;
ALTER TABLE payment_refunds
  DROP CONSTRAINT IF EXISTS fk_payment_refunds_transaction;
ALTER TABLE payment_refunds
  ADD CONSTRAINT fk_payment_refunds_transaction
  FOREIGN KEY (transaction_id) REFERENCES payment_transactions(id) ON DELETE RESTRICT;

-- ============================================================================
-- 5. RESOLVE RESERVATION DELETION BEHAVIOR & PRESERVE IDENTITY CHECK
-- ============================================================================
-- Configure ON DELETE CASCADE on seat_reservations(user_id).
-- An ephemeral held seat reservation represents a temporary checkout lock.
-- When a student user is deleted, their active hold is cascaded, immediately releasing held capacity back to the event.
ALTER TABLE seat_reservations
  DROP CONSTRAINT IF EXISTS seat_reservations_user_id_fkey;
ALTER TABLE seat_reservations
  DROP CONSTRAINT IF EXISTS fk_seat_reservations_user;
ALTER TABLE seat_reservations
  ADD CONSTRAINT fk_seat_reservations_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Enforce strict non-absence and mutual exclusion on seat_reservations
ALTER TABLE seat_reservations
  DROP CONSTRAINT IF EXISTS chk_reservation_participant_identity;
ALTER TABLE seat_reservations
  ADD CONSTRAINT chk_reservation_participant_identity
  CHECK (
    (participant_type = 'STUDENT' AND user_id IS NOT NULL AND external_participant_id IS NULL)
    OR
    (participant_type = 'EXTERNAL' AND external_participant_id IS NOT NULL AND user_id IS NULL)
  );

COMMIT;
