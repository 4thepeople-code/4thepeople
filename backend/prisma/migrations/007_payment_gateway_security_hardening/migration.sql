-- Migration: 007_payment_gateway_security_hardening
-- Description: Hardened Database Security, Composite Tenant Integrity Constraints, Payment Creation Trigger, and Multi-Gateway Schema.
-- Strategy: Forward-only, additive, fully idempotent, non-destructive, and transaction-wrapped.
-- Execution Role: migrator (owns schema public and all domain tables; rolbypassrls = false).
-- Target Application Roles:
--   - app_user: Application runtime role for student & college manager traffic (rolbypassrls = false).
--   - platform_ops: Platform administrative role for Super Admin & global infrastructure (rolbypassrls = true).
-- Parity: Synchronized byte-for-byte with backend/prisma/migrations/007_payment_gateway_security_hardening/migration.sql.
-- Rollback Strategy: Provided in trailing documentation comments.

BEGIN;

-- ============================================================================
-- 1. SCHEMA EXTENSIONS (Idempotent Column Additions)
-- ============================================================================

-- 1.1 Support Test/Live Gateway Environments & Credential Rotation Timestamp
ALTER TABLE public.college_payment_configs
  ADD COLUMN IF NOT EXISTS is_test_mode BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS credentials_rotated_at TIMESTAMPTZ(6);

-- 1.2 Provider & Configuration Audit Tracking
ALTER TABLE public.college_payment_config_audits
  ADD COLUMN IF NOT EXISTS previous_provider "payment_gateway_provider_enum",
  ADD COLUMN IF NOT EXISTS new_provider "payment_gateway_provider_enum",
  ADD COLUMN IF NOT EXISTS previous_is_test_mode BOOLEAN,
  ADD COLUMN IF NOT EXISTS new_is_test_mode BOOLEAN,
  ADD COLUMN IF NOT EXISTS credentials_rotated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS key_id_preview TEXT;

-- 1.3 Optional Tenant Attribution & Concurrency Claim Token on Inbound Gateway Webhook Events
-- Kept nullable so raw unparsed webhook payloads can be recorded prior to order/tenant resolution.
ALTER TABLE public.payment_webhook_events
  ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES public.colleges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claim_token TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now();

-- 1.4 Refund Idempotency Tracking & Scoped Uniqueness
ALTER TABLE public.payment_refunds
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_refunds_college_idempotency
  ON public.payment_refunds(college_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;


-- ============================================================================
-- 2. COMPOSITE TENANT INTEGRITY CONSTRAINTS
-- ============================================================================
-- Enforces cross-table tenant isolation at the DDL constraint level.
-- Prevents records belonging to College A from referencing events, reservations,
-- transactions, or participants belonging to College B.

-- 2.1 Composite Unique Keys (Prerequisites for Composite Foreign Keys)
ALTER TABLE public.external_participants
  DROP CONSTRAINT IF EXISTS uq_external_participants_college_id;
ALTER TABLE public.external_participants
  ADD CONSTRAINT uq_external_participants_college_id UNIQUE (college_id, id);

ALTER TABLE public.seat_reservations
  DROP CONSTRAINT IF EXISTS uq_seat_reservations_college_id;
ALTER TABLE public.seat_reservations
  ADD CONSTRAINT uq_seat_reservations_college_id UNIQUE (college_id, id);

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS uq_payment_transactions_college_id;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT uq_payment_transactions_college_id UNIQUE (college_id, id);

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS uq_payment_transactions_college_reservation;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT uq_payment_transactions_college_reservation UNIQUE (college_id, reservation_id);

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS uq_event_registrations_college_payment_txn;
ALTER TABLE public.event_registrations
  ADD CONSTRAINT uq_event_registrations_college_payment_txn UNIQUE (college_id, payment_transaction_id);

-- 2.2 Composite Foreign Key: payment_refunds -> payment_transactions
-- Guarantees a refund row for College A can ONLY reference a transaction belonging to College A.
ALTER TABLE public.payment_refunds
  DROP CONSTRAINT IF EXISTS payment_refunds_transaction_id_fkey;
ALTER TABLE public.payment_refunds
  DROP CONSTRAINT IF EXISTS fk_payment_refunds_transaction;
ALTER TABLE public.payment_refunds
  ADD CONSTRAINT fk_payment_refunds_transaction
  FOREIGN KEY (college_id, transaction_id)
  REFERENCES public.payment_transactions(college_id, id)
  ON DELETE RESTRICT;

-- 2.3 Composite Foreign Key: payment_transactions -> seat_reservations
-- Guarantees a transaction for College A can ONLY reference a reservation belonging to College A.
-- Uses PostgreSQL 15+ column-list syntax ON DELETE SET NULL (reservation_id) so only reservation_id
-- is set to NULL upon deletion, preserving the NOT NULL tenant anchor (college_id).
ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_reservation_id_fkey;
ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS fk_payment_transactions_reservation;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT fk_payment_transactions_reservation
  FOREIGN KEY (college_id, reservation_id)
  REFERENCES public.seat_reservations(college_id, id)
  ON DELETE SET NULL (reservation_id);

-- 2.4 Composite Foreign Key: payment_transactions -> external_participants
ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_external_participant_id_fkey;
ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS fk_payment_transactions_external_participant;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT fk_payment_transactions_external_participant
  FOREIGN KEY (college_id, external_participant_id)
  REFERENCES public.external_participants(college_id, id)
  ON DELETE RESTRICT;

-- 2.5 Composite Foreign Key: seat_reservations -> external_participants
ALTER TABLE public.seat_reservations
  DROP CONSTRAINT IF EXISTS seat_reservations_external_participant_id_fkey;
ALTER TABLE public.seat_reservations
  DROP CONSTRAINT IF EXISTS fk_seat_reservations_external_participant;
ALTER TABLE public.seat_reservations
  ADD CONSTRAINT fk_seat_reservations_external_participant
  FOREIGN KEY (college_id, external_participant_id)
  REFERENCES public.external_participants(college_id, id)
  ON DELETE RESTRICT;

-- 2.6 Composite Foreign Key: event_registrations -> payment_transactions
-- Uses PostgreSQL 15+ column-list syntax ON DELETE SET NULL (payment_transaction_id) so only
-- payment_transaction_id is set to NULL upon deletion, preserving the NOT NULL tenant anchor (college_id).
ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_payment_transaction_id_fkey;
ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS fk_registrations_payment_transaction;
ALTER TABLE public.event_registrations
  ADD CONSTRAINT fk_registrations_payment_transaction
  FOREIGN KEY (college_id, payment_transaction_id)
  REFERENCES public.payment_transactions(college_id, id)
  ON DELETE SET NULL (payment_transaction_id);

-- 2.7 Composite Foreign Key: event_registrations -> external_participants
ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_external_participant_id_fkey;
ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS fk_registrations_external_participant;
ALTER TABLE public.event_registrations
  ADD CONSTRAINT fk_registrations_external_participant
  FOREIGN KEY (college_id, external_participant_id)
  REFERENCES public.external_participants(college_id, id)
  ON DELETE RESTRICT;


-- ============================================================================
-- 3. QUERY OPTIMIZATION INDEXES (Idempotent)
-- ============================================================================

-- 3.1 Student transaction history & receipt lookup: WHERE college_id = $1 AND user_id = $2
CREATE INDEX IF NOT EXISTS idx_payment_transactions_college_user
  ON public.payment_transactions(college_id, user_id, created_at DESC);

-- 3.2 Payment status monitoring, reconciliation & sweeper: WHERE college_id = $1 AND status = $2
CREATE INDEX IF NOT EXISTS idx_payment_transactions_college_status
  ON public.payment_transactions(college_id, status);

-- 3.3 Ephemeral seat hold lookup: WHERE college_id = $1 AND user_id = $2
CREATE INDEX IF NOT EXISTS idx_seat_reservations_college_user
  ON public.seat_reservations(college_id, user_id);

-- 3.4 Refund lookup by transaction within tenant: WHERE college_id = $1 AND transaction_id = $2
CREATE INDEX IF NOT EXISTS idx_payment_refunds_college_txn
  ON public.payment_refunds(college_id, transaction_id);

-- 3.5 Webhook event attribution lookup by college
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_college
  ON public.payment_webhook_events(college_id, created_at DESC);

-- 3.6 Webhook queue processing & retry sweeper: WHERE status = 'RECEIVED'
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_status
  ON public.payment_webhook_events(status, created_at);


-- ============================================================================
-- 4. PAYMENT CREATION INTEGRITY TRIGGER
-- ============================================================================
-- Enforces that values inserted into payment_transactions are derived strictly
-- from trusted database records (events and college_payment_configs).
-- The browser/client CANNOT determine or override amount, currency, provider, or mode.

CREATE OR REPLACE FUNCTION public.fn_verify_payment_transaction_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_event_fee INT;
  v_event_currency TEXT;
  v_event_is_paid BOOLEAN;
  v_cfg_provider public.payment_gateway_provider_enum;
  v_cfg_mode public.college_payment_mode_enum;
  v_cfg_status public.payment_config_status_enum;
  v_res_status public.seat_reservation_status_enum;
  v_res_expires TIMESTAMPTZ;
BEGIN
  -- 1. Must always be created in PENDING status
  IF NEW.status <> 'PENDING' THEN
    RAISE EXCEPTION 'New payment transactions must have status PENDING (got %)', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- 2. Gateway payment ID and signature must be NULL on creation
  IF NEW.gateway_payment_id IS NOT NULL OR NEW.gateway_signature IS NOT NULL THEN
    RAISE EXCEPTION 'gateway_payment_id and gateway_signature must be NULL upon transaction creation'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 3. Verify Event and derive trusted amount & currency
  SELECT fee, currency, is_paid
  INTO v_event_fee, v_event_currency, v_event_is_paid
  FROM public.events
  WHERE college_id = NEW.college_id AND id = NEW.event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event % not found for college %', NEW.event_id, NEW.college_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NOT COALESCE(v_event_is_paid, false) THEN
    RAISE EXCEPTION 'Cannot create payment transaction for a free event (is_paid is false)'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.amount <> v_event_fee THEN
    RAISE EXCEPTION 'Transaction amount (%) does not match event fee (%)', NEW.amount, v_event_fee
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.currency <> v_event_currency THEN
    RAISE EXCEPTION 'Transaction currency (%) does not match event currency (%)', NEW.currency, v_event_currency
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Verify Active College Payment Configuration & Provider/Mode
  SELECT provider, mode, status
  INTO v_cfg_provider, v_cfg_mode, v_cfg_status
  FROM public.college_payment_configs
  WHERE college_id = NEW.college_id;

  IF NOT FOUND OR v_cfg_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Payments are not currently active for college %', NEW.college_id
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF NEW.gateway_provider <> v_cfg_provider THEN
    RAISE EXCEPTION 'Transaction gateway provider (%) does not match active college configuration (%)',
      NEW.gateway_provider, v_cfg_provider
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.payment_mode <> v_cfg_mode THEN
    RAISE EXCEPTION 'Transaction payment mode (%) does not match active college configuration (%)',
      NEW.payment_mode, v_cfg_mode
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5. If seat reservation is attached, verify it belongs to same college and event and is HELD
  IF NEW.reservation_id IS NOT NULL THEN
    SELECT status, expires_at
    INTO v_res_status, v_res_expires
    FROM public.seat_reservations
    WHERE college_id = NEW.college_id AND id = NEW.reservation_id AND event_id = NEW.event_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Seat reservation % not found for college % and event %',
        NEW.reservation_id, NEW.college_id, NEW.event_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_res_status <> 'HELD' THEN
      RAISE EXCEPTION 'Seat reservation % is not in HELD status (current: %)',
        NEW.reservation_id, v_res_status
        USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;

    IF v_res_expires <= clock_timestamp() THEN
      RAISE EXCEPTION 'Seat reservation % has already expired at %',
        NEW.reservation_id, v_res_expires
        USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verify_payment_transaction_creation ON public.payment_transactions;
CREATE TRIGGER trg_verify_payment_transaction_creation
  BEFORE INSERT ON public.payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_verify_payment_transaction_creation();

-- 4.2 Refund Creation Integrity Trigger
-- Enforces financial integrity when a refund record is initiated.
-- Asserts valid source transaction status (PAID or PARTIALLY_REFUNDED), positive amount,
-- NULL gateway_refund_id upon creation, and strictly prevents over-refunding beyond the paid amount.
CREATE OR REPLACE FUNCTION public.fn_verify_payment_refund_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_txn_status public.transaction_payment_status_enum;
  v_txn_amount INT;
  v_already_refunded BIGINT;
BEGIN
  -- 1. Status must always be created in INITIATED status
  IF NEW.status <> 'INITIATED' THEN
    RAISE EXCEPTION 'New payment refunds must have status INITIATED (got %)', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- 2. Gateway refund ID must be NULL on creation
  IF NEW.gateway_refund_id IS NOT NULL THEN
    RAISE EXCEPTION 'gateway_refund_id must be NULL upon refund creation'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 3. Refund amount must be positive
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be strictly greater than zero (got %)', NEW.amount
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Verify transaction exists for this college and lock it in share mode
  SELECT status, amount
  INTO v_txn_status, v_txn_amount
  FROM public.payment_transactions
  WHERE college_id = NEW.college_id AND id = NEW.transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found for college %', NEW.transaction_id, NEW.college_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- 5. Transaction must be PAID, PARTIALLY_REFUNDED, or LATE_PAYMENT
  IF v_txn_status NOT IN ('PAID', 'PARTIALLY_REFUNDED', 'LATE_PAYMENT') THEN
    RAISE EXCEPTION 'Cannot refund transaction %: status is % (expected PAID, PARTIALLY_REFUNDED, or LATE_PAYMENT)',
      NEW.transaction_id, v_txn_status
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  -- 6. Ensure total refund amount does not exceed transaction amount
  SELECT COALESCE(SUM(amount), 0)
  INTO v_already_refunded
  FROM public.payment_refunds
  WHERE college_id = NEW.college_id
    AND transaction_id = NEW.transaction_id
    AND status IN ('INITIATED', 'PROCESSED');

  IF (v_already_refunded + NEW.amount) > v_txn_amount THEN
    RAISE EXCEPTION 'Total refund amount (% existing + % requested) exceeds transaction amount (%)',
      v_already_refunded, NEW.amount, v_txn_amount
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verify_payment_refund_creation ON public.payment_refunds;
CREATE TRIGGER trg_verify_payment_refund_creation
  BEFORE INSERT ON public.payment_refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_verify_payment_refund_creation();


-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY (Without FORCE RLS)
-- ============================================================================

-- Enable RLS on all six payment and checkout hold tables.
-- FORCE ROW LEVEL SECURITY is intentionally omitted (and explicitly disabled)
-- because the table owner role "migrator" possesses NOBYPASSRLS. Under FORCE RLS, table owners
-- without BYPASSRLS are constrained by RLS policies, breaking schema migrations, catalog
-- inspections, and DBA maintenance scripts that execute outside of an active tenant context.
-- ENABLE ROW LEVEL SECURITY strictly and fully constrains the runtime role "app_user"
-- because app_user is NOT the table owner and possesses rolbypassrls = false.

ALTER TABLE public.college_payment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_payment_configs NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.college_payment_config_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_payment_config_audits NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.seat_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_reservations NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_refunds NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events NO FORCE ROW LEVEL SECURITY;


-- ============================================================================
-- 6. ROW-LEVEL SECURITY POLICIES (Idempotent Drop & Recreate)
-- ============================================================================

-- 6.1 college_payment_configs: SELECT only for app_user
DROP POLICY IF EXISTS college_payment_configs_select_policy ON public.college_payment_configs;
CREATE POLICY college_payment_configs_select_policy ON public.college_payment_configs
  FOR SELECT
  TO app_user
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

-- 6.2 college_payment_config_audits: NO ACCESS for app_user (Default Deny)
DROP POLICY IF EXISTS college_payment_config_audits_deny_policy ON public.college_payment_config_audits;
CREATE POLICY college_payment_config_audits_deny_policy ON public.college_payment_config_audits
  FOR ALL
  TO app_user
  USING (false);

-- 6.3 seat_reservations: Full Tenant Lifecycle for app_user
DROP POLICY IF EXISTS seat_reservations_select_policy ON public.seat_reservations;
DROP POLICY IF EXISTS seat_reservations_insert_policy ON public.seat_reservations;
DROP POLICY IF EXISTS seat_reservations_update_policy ON public.seat_reservations;
DROP POLICY IF EXISTS seat_reservations_delete_policy ON public.seat_reservations;

CREATE POLICY seat_reservations_select_policy ON public.seat_reservations
  FOR SELECT
  TO app_user
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

CREATE POLICY seat_reservations_insert_policy ON public.seat_reservations
  FOR INSERT
  TO app_user
  WITH CHECK (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

CREATE POLICY seat_reservations_update_policy ON public.seat_reservations
  FOR UPDATE
  TO app_user
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid)
  WITH CHECK (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

CREATE POLICY seat_reservations_delete_policy ON public.seat_reservations
  FOR DELETE
  TO app_user
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

-- 6.4 payment_transactions: Tenant Isolation for app_user (SELECT & INSERT only)
DROP POLICY IF EXISTS payment_transactions_select_policy ON public.payment_transactions;
DROP POLICY IF EXISTS payment_transactions_insert_policy ON public.payment_transactions;
DROP POLICY IF EXISTS payment_transactions_update_policy ON public.payment_transactions;

CREATE POLICY payment_transactions_select_policy ON public.payment_transactions
  FOR SELECT
  TO app_user
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

CREATE POLICY payment_transactions_insert_policy ON public.payment_transactions
  FOR INSERT
  TO app_user
  WITH CHECK (
    college_id = NULLIF(current_setting('app.college_id', true), '')::uuid
    AND status = 'PENDING'
    AND gateway_payment_id IS NULL
    AND gateway_signature IS NULL
  );

-- 6.5 payment_refunds: Tenant Isolation for app_user (SELECT & INSERT only)
DROP POLICY IF EXISTS payment_refunds_select_policy ON public.payment_refunds;
DROP POLICY IF EXISTS payment_refunds_insert_policy ON public.payment_refunds;
DROP POLICY IF EXISTS payment_refunds_update_policy ON public.payment_refunds;

CREATE POLICY payment_refunds_select_policy ON public.payment_refunds
  FOR SELECT
  TO app_user
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

CREATE POLICY payment_refunds_insert_policy ON public.payment_refunds
  FOR INSERT
  TO app_user
  WITH CHECK (
    college_id = NULLIF(current_setting('app.college_id', true), '')::uuid
    AND status = 'INITIATED'
    AND gateway_refund_id IS NULL
  );

-- 6.6 payment_webhook_events: Default Deny for app_user
DROP POLICY IF EXISTS payment_webhook_events_deny_policy ON public.payment_webhook_events;
CREATE POLICY payment_webhook_events_deny_policy ON public.payment_webhook_events
  FOR ALL
  TO app_user
  USING (false);


-- ============================================================================
-- 7. TRUSTED STATE MACHINE FUNCTIONS (Restricted to platform_ops)
-- ============================================================================
-- Note: These functions do NOT perform cryptographic HMAC signature verification;
-- cryptographic verification MUST be completed by the backend in Node.js before
-- invoking this transition. app_user is explicitly denied execution privileges.

CREATE OR REPLACE FUNCTION public.fn_complete_payment_transaction(
  p_college_id UUID,
  p_transaction_id UUID,
  p_gateway_payment_id TEXT,
  p_gateway_signature TEXT,
  p_payment_method TEXT DEFAULT NULL,
  p_vpa_masked TEXT DEFAULT NULL
)
RETURNS public.payment_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_txn public.payment_transactions%ROWTYPE;
BEGIN
  IF p_college_id IS NULL THEN
    RAISE EXCEPTION 'college_id is required to complete transaction'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_gateway_payment_id IS NULL OR trim(p_gateway_payment_id) = '' THEN
    RAISE EXCEPTION 'gateway_payment_id is required to complete transaction'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_gateway_signature IS NULL OR trim(p_gateway_signature) = '' THEN
    RAISE EXCEPTION 'gateway_signature is required to complete transaction'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Row lock the transaction, strictly asserting college_id
  SELECT * INTO v_txn
  FROM public.payment_transactions
  WHERE id = p_transaction_id
    AND college_id = p_college_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found for college %', p_transaction_id, p_college_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Idempotency check: if already confirmed PAID with identical payment ID, return safely
  IF v_txn.status = 'PAID' THEN
    IF v_txn.gateway_payment_id = p_gateway_payment_id THEN
      RETURN v_txn;
    ELSE
      RAISE EXCEPTION 'Transaction % already PAID with conflicting payment ID', p_transaction_id
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  -- Strict terminal state protection: a FAILED transaction CANNOT transition to PAID
  IF v_txn.status = 'FAILED' THEN
    RAISE EXCEPTION 'Cannot complete transaction %: transaction is in terminal FAILED state. Ordinary retry rejected.',
      p_transaction_id
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF v_txn.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Cannot complete transaction %: current status is % (expected PENDING)',
      p_transaction_id, v_txn.status
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  -- Atomically advance status to PAID with verified gateway data
  UPDATE public.payment_transactions
  SET status = 'PAID',
      gateway_payment_id = p_gateway_payment_id,
      gateway_signature = p_gateway_signature,
      payment_method = COALESCE(p_payment_method, payment_method),
      vpa_masked = COALESCE(p_vpa_masked, vpa_masked),
      updated_at = now()
  WHERE id = p_transaction_id
    AND college_id = p_college_id
  RETURNING * INTO v_txn;

  RETURN v_txn;
END;
$$;

-- 7.2 Mark transaction FAILED (invoked strictly by trusted backend / webhook processing)
CREATE OR REPLACE FUNCTION public.fn_fail_payment_transaction(
  p_college_id UUID,
  p_transaction_id UUID,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS public.payment_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_txn public.payment_transactions%ROWTYPE;
BEGIN
  IF p_college_id IS NULL THEN
    RAISE EXCEPTION 'college_id is required to fail transaction'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_txn
  FROM public.payment_transactions
  WHERE id = p_transaction_id
    AND college_id = p_college_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found for college %', p_transaction_id, p_college_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_txn.status = 'FAILED' THEN
    RETURN v_txn;
  END IF;

  -- Cannot fail an already paid, late, or refunded transaction
  IF v_txn.status IN ('PAID', 'REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED', 'LATE_PAYMENT') THEN
    RAISE EXCEPTION 'Cannot fail transaction %: transaction is already in % state',
      p_transaction_id, v_txn.status
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF v_txn.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Cannot fail transaction %: current status is % (expected PENDING)',
      p_transaction_id, v_txn.status
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  UPDATE public.payment_transactions
  SET status = 'FAILED',
      failure_reason = COALESCE(p_failure_reason, failure_reason, 'Payment failed or cancelled'),
      updated_at = now()
  WHERE id = p_transaction_id
    AND college_id = p_college_id
  RETURNING * INTO v_txn;

  RETURN v_txn;
END;
$$;


-- ============================================================================
-- 8. PRIVILEGE MANAGEMENT & LEAST-PRIVILEGE GRANTS (Idempotent)
-- ============================================================================

-- 8.1 Revoke all default/public permissions on payment tables & functions
REVOKE ALL ON public.college_payment_configs FROM PUBLIC;
REVOKE ALL ON public.college_payment_config_audits FROM PUBLIC;
REVOKE ALL ON public.seat_reservations FROM PUBLIC;
REVOKE ALL ON public.payment_transactions FROM PUBLIC;
REVOKE ALL ON public.payment_refunds FROM PUBLIC;
REVOKE ALL ON public.payment_webhook_events FROM PUBLIC;

REVOKE ALL ON FUNCTION public.fn_complete_payment_transaction(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_fail_payment_transaction(UUID, UUID, TEXT) FROM PUBLIC;

-- 8.2 Application Runtime Role (app_user) Grants: Strict Least-Privilege Separation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    -- Credential Protection: Grant SELECT strictly on non-secret metadata columns.
    -- Encrypted secrets (key_secret_encrypted, webhook_secret_encrypted,
    -- merchant_account_id_encrypted, key_id_encrypted) are STRICTLY BLOCKED.
    REVOKE ALL ON public.college_payment_configs FROM app_user;
    GRANT SELECT (
      id,
      college_id,
      mode,
      provider,
      status,
      is_test_mode,
      display_merchant_name,
      created_at,
      updated_at
    ) ON public.college_payment_configs TO app_user;

    -- Zero access to platform configuration audit trail
    REVOKE ALL ON public.college_payment_config_audits FROM app_user;

    -- Ephemeral seat reservation lifecycle
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.seat_reservations TO app_user;

    -- Financial Ledger Protection: app_user can SELECT non-sensitive columns and INSERT PENDING transactions.
    -- Internal secrets (gateway_signature, idempotency_key, merchant_account_id, registration_payload)
    -- are EXCLUDED from app_user SELECT to prevent client/tenant exposure.
    -- Direct UPDATE and DELETE on payment_transactions are REVOKED from app_user.
    REVOKE ALL ON public.payment_transactions FROM app_user;
    GRANT SELECT (
      id,
      college_id,
      event_id,
      reservation_id,
      participant_type,
      user_id,
      external_participant_id,
      amount,
      currency,
      status,
      gateway_provider,
      payment_mode,
      gateway_order_id,
      gateway_payment_id,
      payment_method,
      vpa_masked,
      failure_reason,
      created_at,
      updated_at
    ) ON public.payment_transactions TO app_user;
    GRANT INSERT (
      id,
      college_id,
      event_id,
      reservation_id,
      participant_type,
      user_id,
      external_participant_id,
      amount,
      currency,
      status,
      gateway_provider,
      payment_mode,
      merchant_account_id,
      gateway_order_id,
      idempotency_key,
      registration_payload,
      failure_reason,
      created_at,
      updated_at
    ) ON public.payment_transactions TO app_user;

    -- Refunds: app_user can SELECT and INSERT refund requests in INITIATED status.
    -- Direct UPDATE and DELETE on payment_refunds are REVOKED from app_user.
    REVOKE ALL ON public.payment_refunds FROM app_user;
    GRANT SELECT ON public.payment_refunds TO app_user;
    GRANT INSERT (
      id,
      transaction_id,
      college_id,
      amount,
      status,
      reason,
      initiated_by_admin_id,
      created_at,
      updated_at
    ) ON public.payment_refunds TO app_user;

    -- Zero access to raw inbound gateway webhooks (handled via platform_ops)
    REVOKE ALL ON public.payment_webhook_events FROM app_user;

    -- State transition functions are STRICTLY REVOKED from app_user.
    -- Only trusted backend processing (via platform_ops) can execute state changes.
    REVOKE ALL ON FUNCTION public.fn_complete_payment_transaction(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM app_user;
    REVOKE ALL ON FUNCTION public.fn_fail_payment_transaction(UUID, UUID, TEXT) FROM app_user;
  END IF;
END $$;

-- 8.3 Platform Operations Role (platform_ops) Grants
-- platform_ops operates with BYPASSRLS for global Super Admin management & trusted webhook/verification processing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'platform_ops') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.college_payment_configs TO platform_ops;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.college_payment_config_audits TO platform_ops;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.seat_reservations TO platform_ops;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_transactions TO platform_ops;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_refunds TO platform_ops;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_webhook_events TO platform_ops;

    GRANT EXECUTE ON FUNCTION public.fn_complete_payment_transaction(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO platform_ops;
    GRANT EXECUTE ON FUNCTION public.fn_fail_payment_transaction(UUID, UUID, TEXT) TO platform_ops;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK STRATEGY (FOR DBA EMERGENCY USE ONLY)
-- ============================================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_verify_payment_refund_creation ON public.payment_refunds;
-- DROP FUNCTION IF EXISTS public.fn_verify_payment_refund_creation();
-- DROP TRIGGER IF EXISTS trg_verify_payment_transaction_creation ON public.payment_transactions;
-- DROP FUNCTION IF EXISTS public.fn_verify_payment_transaction_creation();
-- DROP FUNCTION IF EXISTS public.fn_complete_payment_transaction(UUID, UUID, TEXT, TEXT, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS public.fn_fail_payment_transaction(UUID, UUID, TEXT);
--
-- DROP POLICY IF EXISTS college_payment_configs_select_policy ON public.college_payment_configs;
-- DROP POLICY IF EXISTS college_payment_config_audits_deny_policy ON public.college_payment_config_audits;
-- DROP POLICY IF EXISTS seat_reservations_select_policy ON public.seat_reservations;
-- DROP POLICY IF EXISTS seat_reservations_insert_policy ON public.seat_reservations;
-- DROP POLICY IF EXISTS seat_reservations_update_policy ON public.seat_reservations;
-- DROP POLICY IF EXISTS seat_reservations_delete_policy ON public.seat_reservations;
-- DROP POLICY IF EXISTS payment_transactions_select_policy ON public.payment_transactions;
-- DROP POLICY IF EXISTS payment_transactions_insert_policy ON public.payment_transactions;
-- DROP POLICY IF EXISTS payment_refunds_select_policy ON public.payment_refunds;
-- DROP POLICY IF EXISTS payment_refunds_insert_policy ON public.payment_refunds;
-- DROP POLICY IF EXISTS payment_webhook_events_deny_policy ON public.payment_webhook_events;
--
-- ALTER TABLE public.college_payment_configs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.college_payment_config_audits DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.seat_reservations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.payment_transactions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.payment_refunds DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.payment_webhook_events DISABLE ROW LEVEL SECURITY;
--
-- ALTER TABLE public.payment_refunds DROP CONSTRAINT IF EXISTS fk_payment_refunds_transaction;
-- ALTER TABLE public.payment_refunds ADD CONSTRAINT fk_payment_refunds_transaction
--   FOREIGN KEY (transaction_id) REFERENCES public.payment_transactions(id) ON DELETE RESTRICT;
--
-- ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS fk_payment_transactions_reservation;
-- ALTER TABLE public.payment_transactions ADD CONSTRAINT fk_payment_transactions_reservation
--   FOREIGN KEY (reservation_id) REFERENCES public.seat_reservations(id) ON DELETE SET NULL;
--
-- ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS fk_payment_transactions_external_participant;
-- ALTER TABLE public.seat_reservations DROP CONSTRAINT IF EXISTS fk_seat_reservations_external_participant;
-- ALTER TABLE public.event_registrations DROP CONSTRAINT IF EXISTS fk_registrations_payment_transaction;
-- ALTER TABLE public.event_registrations DROP CONSTRAINT IF EXISTS fk_registrations_external_participant;
--
-- ALTER TABLE public.event_registrations DROP CONSTRAINT IF EXISTS uq_event_registrations_college_payment_txn;
-- ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS uq_payment_transactions_college_reservation;
-- ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS uq_payment_transactions_college_id;
-- ALTER TABLE public.seat_reservations DROP CONSTRAINT IF EXISTS uq_seat_reservations_college_id;
-- ALTER TABLE public.external_participants DROP CONSTRAINT IF EXISTS uq_external_participants_college_id;
--
-- DROP INDEX IF EXISTS public.idx_payment_transactions_college_user;
-- DROP INDEX IF EXISTS public.idx_payment_transactions_college_status;
-- DROP INDEX IF EXISTS public.idx_seat_reservations_college_user;
-- DROP INDEX IF EXISTS public.idx_payment_refunds_college_txn;
-- DROP INDEX IF EXISTS public.idx_payment_webhooks_college;
-- DROP INDEX IF EXISTS public.idx_payment_webhooks_status;
--
-- DROP INDEX IF EXISTS public.uq_payment_refunds_college_idempotency;
-- ALTER TABLE public.payment_refunds DROP COLUMN IF EXISTS idempotency_key;
-- ALTER TABLE public.payment_webhook_events DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE public.payment_webhook_events DROP COLUMN IF EXISTS claim_token;
-- ALTER TABLE public.payment_webhook_events DROP COLUMN IF EXISTS college_id;
-- ALTER TABLE public.college_payment_config_audits
--   DROP COLUMN IF EXISTS key_id_preview,
--   DROP COLUMN IF EXISTS credentials_rotated,
--   DROP COLUMN IF EXISTS new_is_test_mode,
--   DROP COLUMN IF EXISTS previous_is_test_mode,
--   DROP COLUMN IF EXISTS new_provider,
--   DROP COLUMN IF EXISTS previous_provider;
-- ALTER TABLE public.college_payment_configs
--   DROP COLUMN IF EXISTS credentials_rotated_at,
--   DROP COLUMN IF EXISTS is_test_mode;
-- COMMIT;
