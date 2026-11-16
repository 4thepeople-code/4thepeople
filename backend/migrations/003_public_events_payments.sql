-- Migration: 003_public_events_payments
-- Description: Foundational database schema and migration for Public Events, Cross-College Registration, and Payment Gateway Integration.
-- Strategy: Additive, non-destructive, strictly backward-compatible, and fully idempotent.
-- Tracking: Authoritative Prisma Migrate migration, synchronized byte-for-byte with backend/migrations/003_public_events_payments.sql.

BEGIN;

-- ============================================================================
-- 1. ENUMS CREATION (Idempotent)
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE "event_visibility_enum" AS ENUM ('COLLEGE', 'PUBLIC');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "participant_type_enum" AS ENUM ('STUDENT', 'EXTERNAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "college_payment_mode_enum" AS ENUM ('COLLEGE_OWNED_GATEWAY', 'PLATFORM_MANAGED_GATEWAY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "payment_gateway_provider_enum" AS ENUM ('RAZORPAY', 'CASHFREE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "payment_config_status_enum" AS ENUM ('NOT_CONFIGURED', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "seat_reservation_status_enum" AS ENUM ('HELD', 'CONFIRMED', 'EXPIRED', 'RELEASED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "transaction_payment_status_enum" AS ENUM ('PENDING', 'PAID', 'FAILED', 'LATE_PAYMENT', 'REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "refund_status_enum" AS ENUM ('INITIATED', 'PROCESSED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "webhook_process_status_enum" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. EXTEND EVENTS TABLE
-- ============================================================================
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS visibility "event_visibility_enum" NOT NULL DEFAULT 'COLLEGE',
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'INR';

ALTER TABLE events 
  DROP CONSTRAINT IF EXISTS chk_events_fee_consistency;
ALTER TABLE events 
  ADD CONSTRAINT chk_events_fee_consistency 
  CHECK ((is_paid = false AND fee = 0) OR (is_paid = true AND fee > 0));

-- ============================================================================
-- 3. EXTERNAL PARTICIPANTS (College-Scoped Uniqueness)
-- ============================================================================
CREATE TABLE IF NOT EXISTS external_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email CITEXT NOT NULL,
  phone TEXT,
  institution_name TEXT,
  is_email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_external_participants_college_email UNIQUE (college_id, email)
);

CREATE INDEX IF NOT EXISTS idx_external_participants_college ON external_participants(college_id);

ALTER TABLE external_participants
  DROP CONSTRAINT IF EXISTS external_participants_email_key;
ALTER TABLE external_participants
  DROP CONSTRAINT IF EXISTS uq_external_participants_college_email;
ALTER TABLE external_participants
  ADD CONSTRAINT uq_external_participants_college_email UNIQUE (college_id, email);

-- ============================================================================
-- 4. SEAT RESERVATIONS (Composite FK & Mutual Exclusion Constraints)
-- ============================================================================
CREATE TABLE IF NOT EXISTS seat_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  participant_type "participant_type_enum" NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  external_participant_id UUID REFERENCES external_participants(id) ON DELETE RESTRICT,
  status "seat_reservation_status_enum" NOT NULL DEFAULT 'HELD',
  expires_at TIMESTAMPTZ(6) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT fk_seat_reservations_event FOREIGN KEY (college_id, event_id) REFERENCES events(college_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_seat_reservations_capacity ON seat_reservations(event_id, status, expires_at);

ALTER TABLE seat_reservations
  DROP CONSTRAINT IF EXISTS fk_seat_reservations_event;
ALTER TABLE seat_reservations
  ADD CONSTRAINT fk_seat_reservations_event
  FOREIGN KEY (college_id, event_id) REFERENCES events(college_id, id) ON DELETE CASCADE;

ALTER TABLE seat_reservations
  DROP CONSTRAINT IF EXISTS chk_reservation_participant_identity;
ALTER TABLE seat_reservations
  ADD CONSTRAINT chk_reservation_participant_identity
  CHECK (
    (participant_type = 'STUDENT' AND user_id IS NOT NULL AND external_participant_id IS NULL)
    OR
    (participant_type = 'EXTERNAL' AND external_participant_id IS NOT NULL AND user_id IS NULL)
  );

-- ============================================================================
-- 5. PAYMENT CONFIGURATION & AUDITS
-- ============================================================================
CREATE TABLE IF NOT EXISTS college_payment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL UNIQUE REFERENCES colleges(id) ON DELETE CASCADE,
  mode "college_payment_mode_enum" NOT NULL DEFAULT 'COLLEGE_OWNED_GATEWAY',
  provider "payment_gateway_provider_enum" NOT NULL DEFAULT 'RAZORPAY',
  status "payment_config_status_enum" NOT NULL DEFAULT 'NOT_CONFIGURED',
  key_id_encrypted TEXT,
  key_secret_encrypted TEXT,
  webhook_secret_encrypted TEXT,
  merchant_account_id_encrypted TEXT,
  display_merchant_name TEXT,
  verified_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS college_payment_config_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES college_payment_configs(id) ON DELETE CASCADE,
  college_id UUID NOT NULL,
  changed_by_admin_id UUID NOT NULL,
  previous_mode "college_payment_mode_enum",
  new_mode "college_payment_mode_enum" NOT NULL,
  previous_status "payment_config_status_enum",
  new_status "payment_config_status_enum" NOT NULL,
  change_reason TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_config_audits ON college_payment_config_audits(college_id, created_at DESC);

-- ============================================================================
-- 6. PAYMENT TRANSACTIONS & REFUNDS (Financial Integrity Protection)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  reservation_id UUID NOT NULL UNIQUE REFERENCES seat_reservations(id) ON DELETE RESTRICT,
  participant_type "participant_type_enum" NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  external_participant_id UUID REFERENCES external_participants(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status "transaction_payment_status_enum" NOT NULL DEFAULT 'PENDING',
  gateway_provider "payment_gateway_provider_enum" NOT NULL DEFAULT 'RAZORPAY',
  payment_mode "college_payment_mode_enum" NOT NULL,
  merchant_account_id TEXT,
  gateway_order_id TEXT UNIQUE,
  gateway_payment_id TEXT UNIQUE,
  gateway_signature TEXT,
  payment_method TEXT,
  vpa_masked TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  registration_payload JSONB,
  failure_reason TEXT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT fk_payment_transactions_event FOREIGN KEY (college_id, event_id) REFERENCES events(college_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_event ON payment_transactions(college_id, event_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions(gateway_order_id);

ALTER TABLE payment_transactions
  DROP CONSTRAINT IF EXISTS fk_payment_transactions_event;
ALTER TABLE payment_transactions
  ADD CONSTRAINT fk_payment_transactions_event
  FOREIGN KEY (college_id, event_id) REFERENCES events(college_id, id) ON DELETE CASCADE;

ALTER TABLE payment_transactions
  DROP CONSTRAINT IF EXISTS chk_transaction_participant_identity;
ALTER TABLE payment_transactions
  ADD CONSTRAINT chk_transaction_participant_identity
  CHECK (
    NOT (user_id IS NOT NULL AND external_participant_id IS NOT NULL)
    AND
    (
      (participant_type = 'STUDENT' AND external_participant_id IS NULL)
      OR
      (participant_type = 'EXTERNAL' AND external_participant_id IS NOT NULL AND user_id IS NULL)
    )
  );

CREATE TABLE IF NOT EXISTS payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE RESTRICT,
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  gateway_refund_id TEXT UNIQUE,
  amount INTEGER NOT NULL,
  status "refund_status_enum" NOT NULL DEFAULT 'INITIATED',
  reason TEXT,
  initiated_by_admin_id UUID,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT fk_payment_refunds_transaction FOREIGN KEY (transaction_id) REFERENCES payment_transactions(id) ON DELETE RESTRICT
);

ALTER TABLE payment_refunds
  DROP CONSTRAINT IF EXISTS payment_refunds_transaction_id_fkey;
ALTER TABLE payment_refunds
  DROP CONSTRAINT IF EXISTS fk_payment_refunds_transaction;
ALTER TABLE payment_refunds
  ADD CONSTRAINT fk_payment_refunds_transaction
  FOREIGN KEY (transaction_id) REFERENCES payment_transactions(id) ON DELETE RESTRICT;

-- ============================================================================
-- 7. WEBHOOK EVENTS & EXTERNAL AUTH OTPS (DPDP / GDPR Retention Standard)
-- ============================================================================
-- Retention & Privacy Policy:
-- payment_webhook_events stores raw third-party gateway notifications that may contain customer PII.
-- Under the Digital Personal Data Protection (DPDP) Act and GDPR standards, raw webhook payloads
-- must be retained for at most 90 days. A scheduled database maintenance job purges records
-- where status IN ('PROCESSED', 'IGNORED') and created_at < NOW() - INTERVAL '90 days'.
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider "payment_gateway_provider_enum" NOT NULL,
  gateway_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status "webhook_process_status_enum" NOT NULL DEFAULT 'RECEIVED',
  error_message TEXT,
  processed_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_webhooks_provider_event 
  ON payment_webhook_events(provider, gateway_event_id);

CREATE TABLE IF NOT EXISTS external_auth_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL,
  salt VARCHAR(32) NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  consumed_at TIMESTAMPTZ(6),
  expires_at TIMESTAMPTZ(6) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_otps_candidate 
  ON external_auth_otps(email, consumed_at, expires_at);

-- ============================================================================
-- 8. EXTEND EVENT_REGISTRATIONS & DATA INTEGRITY BACKFILL
-- ============================================================================
ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS participant_type "participant_type_enum" NOT NULL DEFAULT 'STUDENT',
  ADD COLUMN IF NOT EXISTS home_college_id UUID,
  ADD COLUMN IF NOT EXISTS external_participant_id UUID,
  ADD COLUMN IF NOT EXISTS payment_transaction_id UUID UNIQUE REFERENCES payment_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS participant_name TEXT,
  ADD COLUMN IF NOT EXISTS participant_email TEXT,
  ADD COLUMN IF NOT EXISTS participant_roll_number TEXT,
  ADD COLUMN IF NOT EXISTS participant_college_name TEXT,
  ADD COLUMN IF NOT EXISTS is_user_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registered_by_role TEXT NOT NULL DEFAULT 'SELF',
  ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 8.1 Pre-Backfill Integrity Assertion: Abort if genuine user or college data is missing
DO $$
DECLARE
  v_corrupted_count INT;
BEGIN
  SELECT COUNT(*) INTO v_corrupted_count
  FROM event_registrations er
  LEFT JOIN users u ON er.user_id = u.id
  LEFT JOIN colleges c ON u.college_id = c.id
  WHERE u.id IS NULL 
     OR u.name IS NULL OR TRIM(u.name) = ''
     OR u.email IS NULL OR TRIM(u.email) = ''
     OR c.id IS NULL;

  IF v_corrupted_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: % registration records cannot be safely backfilled with genuine user identity data.', v_corrupted_count;
  END IF;
END $$;

-- 8.2 Backfill Genuine Values from users and colleges
UPDATE event_registrations er
SET 
  participant_type = 'STUDENT',
  home_college_id = u.college_id,
  participant_name = u.name,
  participant_email = u.email,
  participant_roll_number = u.roll_number,
  participant_college_name = c.name,
  is_user_deleted = false
FROM users u
JOIN colleges c ON c.id = u.college_id
WHERE er.user_id = u.id AND er.participant_name IS NULL;

-- 8.3 Post-Backfill Integrity Assertion
DO $$
DECLARE
  v_unresolved_count INT;
BEGIN
  SELECT COUNT(*) INTO v_unresolved_count
  FROM event_registrations
  WHERE participant_name IS NULL 
     OR participant_email IS NULL 
     OR home_college_id IS NULL;

  IF v_unresolved_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: % registration rows have missing participant snapshot data after backfill.', v_unresolved_count;
  END IF;
END $$;

-- Enforce NOT NULL on snapshot identity
ALTER TABLE event_registrations
  ALTER COLUMN participant_name SET NOT NULL,
  ALTER COLUMN participant_email SET NOT NULL;

-- ============================================================================
-- 9. RELAX RESTRICTIVE FOREIGN KEYS & ADD IDENTITY CONSTRAINTS
-- ============================================================================
-- Drop NOT NULL on user_id to permit external participants and preserved registrations
ALTER TABLE event_registrations ALTER COLUMN user_id DROP NOT NULL;

-- Drop compound foreign key constraint safely
ALTER TABLE event_registrations DROP CONSTRAINT IF EXISTS fk_registrations_user;

-- Add direct, modern foreign keys
ALTER TABLE event_registrations
  DROP CONSTRAINT IF EXISTS fk_registrations_user_direct;
ALTER TABLE event_registrations
  ADD CONSTRAINT fk_registrations_user_direct
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE event_registrations
  DROP CONSTRAINT IF EXISTS fk_registrations_home_college;
ALTER TABLE event_registrations
  ADD CONSTRAINT fk_registrations_home_college
  FOREIGN KEY (home_college_id) REFERENCES colleges(id) ON DELETE RESTRICT;

ALTER TABLE event_registrations
  DROP CONSTRAINT IF EXISTS fk_registrations_external_participant;
ALTER TABLE event_registrations
  ADD CONSTRAINT fk_registrations_external_participant
  FOREIGN KEY (external_participant_id) REFERENCES external_participants(id) ON DELETE RESTRICT;

-- Index for external participant registrations
CREATE INDEX IF NOT EXISTS idx_event_registrations_external_event 
  ON event_registrations(external_participant_id, event_id);

-- Enforce strict identity mutual-exclusion compatible with user deletion (ON DELETE SET NULL)
-- Decoupled from is_user_deleted so database-level cascade/set-null executes cleanly
-- while preserving participant snapshots and certificate history.
ALTER TABLE event_registrations
  DROP CONSTRAINT IF EXISTS chk_registration_participant_identity;
ALTER TABLE event_registrations
  ADD CONSTRAINT chk_registration_participant_identity
  CHECK (
    NOT (user_id IS NOT NULL AND external_participant_id IS NOT NULL)
    AND
    (
      (participant_type = 'STUDENT' AND external_participant_id IS NULL)
      OR
      (participant_type = 'EXTERNAL' AND external_participant_id IS NOT NULL AND user_id IS NULL)
    )
  );

-- ============================================================================
-- 10. APPEND-ONLY VIEW REPLACEMENT FOR EVENTS_WITH_STATUS
-- ============================================================================
-- Complies strictly with PostgreSQL 42P16: columns 1-21 maintain exact positions, types, and names.
-- Columns 22-25 (visibility, is_paid, fee, currency) are strictly appended at the end.
CREATE OR REPLACE VIEW events_with_status WITH (security_invoker = true) AS
SELECT
  e.id,
  e.college_id,
  e.club_id,
  e.title,
  e.description,
  e.location,
  e.start_at,
  e.end_at,
  e.capacity,
  e.registered_count,
  e.cancelled_at,
  e.cover_image_url,
  e.cover_image_public_id,
  e.registration_url,
  e.legacy_mongo_id,
  e.created_at,
  e.updated_at,
  CASE
    WHEN (e.cancelled_at IS NOT NULL) THEN 'CANCELLED'::text
    WHEN (now() < e.start_at) THEN 'UPCOMING'::text
    WHEN (e.end_at IS NOT NULL) THEN
      CASE
        WHEN (now() < e.end_at) THEN 'ONGOING'::text
        ELSE 'COMPLETED'::text
      END
    ELSE
      CASE
        WHEN (e.start_at < (now() - '24:00:00'::interval)) THEN 'COMPLETED'::text
        ELSE 'ONGOING'::text
      END
  END AS status,
  e.registration_mode,
  e.custom_form_definition,
  e.registration_deadline,
  -- Appended columns 22-25 strictly at the end:
  e.visibility,
  e.is_paid,
  e.fee,
  e.currency
FROM events e;

GRANT SELECT ON events_with_status TO app_user;

-- ============================================================================
-- 11. RECONCILIATION ASSERTION: ZERO CAPACITY DRIFT
-- ============================================================================
DO $$
DECLARE
  v_drift_count INT;
BEGIN
  SELECT COUNT(*) INTO v_drift_count
  FROM (
    SELECT e.id, e.registered_count, COUNT(er.id) as actual_count
    FROM events e
    LEFT JOIN event_registrations er ON er.event_id = e.id
    GROUP BY e.id, e.registered_count
    HAVING e.registered_count != COUNT(er.id)
  ) t;

  IF v_drift_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Capacity drift detected across % events.', v_drift_count;
  END IF;
END $$;

COMMIT;
