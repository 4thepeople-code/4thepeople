-- 4thepeople production reconciliation for migration 007
-- Target: yuva_prod / PostgreSQL 18.7
-- Execute as neondb_owner from Neon SQL Editor.
--
-- This is NOT the original blanket migration 007. It reconciles the observed
-- production state: preserves already-validated composite constraints/indexes,
-- adds only the missing fields/index, and aligns payment object ownership,
-- SECURITY DEFINER functions, RLS policies, and least-privilege grants.
--
-- Preconditions verified from the supplied production inspection:
--   * payment tables and transition/trigger functions are currently owned by neondb_owner
--   * neondb_owner can SET ROLE migrator
--   * migrator is NO BYPASSRLS
--   * PostgreSQL 18.7
--   * existing composite tenant constraints are already present and validated
--
-- IMPORTANT:
--   1. Take a Neon restore point/backup before execution.
--   2. Run the WHOLE script in one SQL Editor session. Do not select fragments.
--   3. Do not run as app_user or platform_ops.
--   4. If any preflight assertion fails, the transaction aborts; do not bypass it.
--   5. This script does not create a Prisma migration-history row.
--
-- Expected changes:
--   * add payment_webhook_events.claim_token, updated_at
--   * add payment_refunds.idempotency_key and its partial unique index
--   * transfer six payment tables and four payment functions to migrator
--   * replace trigger functions with the reviewed 007 definitions
--   * restore exact app_user/platform_ops grants and policies
--
-- No payment rows are deleted or rewritten. Existing validated composite FKs,
-- unique constraints, and existing query indexes are deliberately preserved.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. HARD PREFLIGHT. Fail closed if this is not the expected production state.
-- ---------------------------------------------------------------------------
DO $preflight$
DECLARE
  v_owner text;
  v_missing text;
BEGIN
  IF current_database() <> 'yuva_prod' THEN
    RAISE EXCEPTION 'Wrong database: expected yuva_prod, got %', current_database();
  END IF;

  IF current_user <> 'neondb_owner' THEN
    RAISE EXCEPTION 'Run as neondb_owner; current_user is %', current_user;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrator' AND rolbypassrls = false) THEN
    RAISE EXCEPTION 'Required role migrator is missing or has BYPASSRLS';
  END IF;

  IF NOT pg_has_role(current_user, 'migrator', 'MEMBER') THEN
    RAISE EXCEPTION 'neondb_owner is not a member of migrator; cannot transfer ownership';
  END IF;

  IF NOT has_schema_privilege('migrator', 'public', 'CREATE')
     OR NOT has_schema_privilege('migrator', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'migrator needs USAGE and CREATE on schema public; have the schema owner grant them, then rerun';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'platform_ops') THEN
    RAISE EXCEPTION 'Required app_user or platform_ops role is missing';
  END IF;

  -- Every payment table must be owned by neondb_owner or already by migrator.
  FOR v_owner IN
    SELECT c.relname || ':' || pg_get_userbyid(c.relowner)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'college_payment_configs',
        'college_payment_config_audits',
        'seat_reservations',
        'payment_transactions',
        'payment_refunds',
        'payment_webhook_events'
      )
      AND c.relkind = 'r'
      AND pg_get_userbyid(c.relowner) NOT IN ('neondb_owner', 'migrator')
  LOOP
    RAISE EXCEPTION 'Unexpected payment table owner: %', v_owner;
  END LOOP;

  SELECT string_agg(t, ', ') INTO v_missing
  FROM unnest(ARRAY[
    'college_payment_configs',
    'college_payment_config_audits',
    'seat_reservations',
    'payment_transactions',
    'payment_refunds',
    'payment_webhook_events'
  ]) AS t
  WHERE to_regclass('public.' || t) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required payment tables: %', v_missing;
  END IF;

  -- The transaction-creation SECURITY DEFINER trigger must read the event
  -- row while events RLS is FORCE-enabled. Its non-BYPASSRLS owner therefore
  -- needs a tenant-scoped SELECT policy on events.
  IF to_regclass('public.events') IS NULL THEN
    RAISE EXCEPTION 'Required public.events table is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'events'
      AND c.relrowsecurity
      AND c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'Expected events RLS ENABLE + FORCE state was not found; inspect before proceeding';
  END IF;

  IF (
    SELECT pg_get_userbyid(c.relowner)
    FROM pg_class c
    WHERE c.oid = 'public.events'::regclass
  ) NOT IN ('neondb_owner', 'migrator') THEN
    RAISE EXCEPTION 'Unexpected owner of public.events; cannot safely add the trigger tenant policy';
  END IF;

  -- Existing payment functions must be owned by neondb_owner or migrator.
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'fn_verify_payment_transaction_creation',
        'fn_verify_payment_refund_creation',
        'fn_complete_payment_transaction',
        'fn_fail_payment_transaction'
      )
      AND pg_get_userbyid(p.proowner) NOT IN ('neondb_owner', 'migrator')
  ) THEN
    RAISE EXCEPTION 'Unexpected owner on an existing payment function; inspect pg_proc before proceeding';
  END IF;

  -- These composite constraints were already confirmed present/validated.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payment_refunds'::regclass
      AND conname = 'fk_payment_refunds_transaction' AND convalidated
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payment_transactions'::regclass
      AND conname = 'fk_payment_transactions_reservation' AND convalidated
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payment_transactions'::regclass
      AND conname = 'fk_payment_transactions_external_participant' AND convalidated
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_registrations'::regclass
      AND conname = 'fk_registrations_payment_transaction' AND convalidated
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_registrations'::regclass
      AND conname = 'fk_registrations_external_participant' AND convalidated
  ) THEN
    RAISE EXCEPTION 'One or more expected validated composite tenant constraints are missing; stop and reconcile manually';
  END IF;

  -- Fail closed on unknown policies. Additional permissive policies could
  -- weaken tenant isolation because PostgreSQL ORs permissive policies.
  IF EXISTS (
    SELECT 1
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'college_payment_configs',
        'college_payment_config_audits',
        'seat_reservations',
        'payment_transactions',
        'payment_refunds',
        'payment_webhook_events'
      )
      AND NOT (
        (c.relname = 'college_payment_configs' AND p.polname = 'college_payment_configs_select_policy') OR
        (c.relname = 'college_payment_config_audits' AND p.polname = 'college_payment_config_audits_deny_policy') OR
        (c.relname = 'seat_reservations' AND p.polname IN (
          'seat_reservations_select_policy','seat_reservations_insert_policy',
          'seat_reservations_update_policy','seat_reservations_delete_policy'
        )) OR
        (c.relname = 'payment_transactions' AND p.polname IN (
          'payment_transactions_select_policy','payment_transactions_insert_policy',
          'payment_transactions_update_policy'
        )) OR
        (c.relname = 'payment_refunds' AND p.polname IN (
          'payment_refunds_select_policy','payment_refunds_insert_policy',
          'payment_refunds_update_policy'
        )) OR
        (c.relname = 'payment_webhook_events' AND p.polname = 'payment_webhook_events_deny_policy')
      )
  ) THEN
    RAISE EXCEPTION 'Unexpected RLS policy exists on a payment table; inspect pg_policies before proceeding';
  END IF;
END
$preflight$;

-- ---------------------------------------------------------------------------
-- 1. TRANSFER OWNERSHIP BEFORE SET ROLE.
-- neondb_owner owns the existing objects and has membership in migrator.
-- The target role has CREATE on public (asserted above).
-- ---------------------------------------------------------------------------
DO $ownership$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'college_payment_configs',
        'college_payment_config_audits',
        'seat_reservations',
        'payment_transactions',
        'payment_refunds',
        'payment_webhook_events'
      )
      AND c.relkind = 'r'
      AND pg_get_userbyid(c.relowner) = 'neondb_owner'
  LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO migrator', r.relname);
  END LOOP;

  -- Transfer existing payment functions. Function owners must be migrator,
  -- not the BYPASSRLS neondb_owner role.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_verify_payment_transaction_creation'
      AND pg_get_userbyid(p.proowner) = 'neondb_owner'
  ) THEN
    ALTER FUNCTION public.fn_verify_payment_transaction_creation() OWNER TO migrator;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_verify_payment_refund_creation'
      AND pg_get_userbyid(p.proowner) = 'neondb_owner'
  ) THEN
    ALTER FUNCTION public.fn_verify_payment_refund_creation() OWNER TO migrator;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_complete_payment_transaction'
      AND pg_get_userbyid(p.proowner) = 'neondb_owner'
  ) THEN
    ALTER FUNCTION public.fn_complete_payment_transaction(uuid,uuid,text,text,text,text) OWNER TO migrator;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_fail_payment_transaction'
      AND pg_get_userbyid(p.proowner) = 'neondb_owner'
  ) THEN
    ALTER FUNCTION public.fn_fail_payment_transaction(uuid,uuid,text) OWNER TO migrator;
  END IF;
END
$ownership$;

-- The payment-creation trigger runs as migrator (NO BYPASSRLS). Give it
-- only tenant-scoped SELECT access to events; FORCE RLS remains enabled.
DROP POLICY IF EXISTS events_payment_trigger_select_policy ON public.events;
CREATE POLICY events_payment_trigger_select_policy ON public.events
  FOR SELECT TO migrator
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);
GRANT SELECT ON public.events TO migrator;

-- From here onward, DDL and SECURITY DEFINER functions are owned by migrator.
SET LOCAL ROLE migrator;

-- ---------------------------------------------------------------------------
-- 2. ADD ONLY THE MISSING COLUMNS AND INDEX.
-- Existing config/audit columns and webhook college_id are preserved.
-- ---------------------------------------------------------------------------
ALTER TABLE public.payment_webhook_events
  ADD COLUMN IF NOT EXISTS claim_token TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now();

ALTER TABLE public.payment_refunds
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_refunds_college_idempotency
  ON public.payment_refunds(college_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. PAYMENT CREATION INTEGRITY TRIGGERS.
-- SECURITY DEFINER owner is migrator (NO BYPASSRLS), and migrator owns the
-- six payment tables. Tenant GUC remains visible to the trigger invocation.
-- ---------------------------------------------------------------------------
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
  IF NEW.status <> 'PENDING' THEN
    RAISE EXCEPTION 'New payment transactions must have status PENDING (got %)', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.gateway_payment_id IS NOT NULL OR NEW.gateway_signature IS NOT NULL THEN
    RAISE EXCEPTION 'gateway_payment_id and gateway_signature must be NULL upon transaction creation'
      USING ERRCODE = 'check_violation';
  END IF;

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

  IF NEW.reservation_id IS NOT NULL THEN
    SELECT status, expires_at
    INTO v_res_status, v_res_expires
    FROM public.seat_reservations
    WHERE college_id = NEW.college_id
      AND id = NEW.reservation_id
      AND event_id = NEW.event_id;

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
  IF NEW.status <> 'INITIATED' THEN
    RAISE EXCEPTION 'New payment refunds must have status INITIATED (got %)', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.gateway_refund_id IS NOT NULL THEN
    RAISE EXCEPTION 'gateway_refund_id must be NULL upon refund creation'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be strictly greater than zero (got %)', NEW.amount
      USING ERRCODE = 'check_violation';
  END IF;

  -- Serialize refund creation per source transaction. This prevents concurrent
  -- distinct refund requests from both passing the aggregate over-refund check.
  SELECT status, amount
  INTO v_txn_status, v_txn_amount
  FROM public.payment_transactions
  WHERE college_id = NEW.college_id AND id = NEW.transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found for college %', NEW.transaction_id, NEW.college_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_txn_status NOT IN ('PAID', 'PARTIALLY_REFUNDED', 'LATE_PAYMENT') THEN
    RAISE EXCEPTION 'Cannot refund transaction %: status is % (expected PAID, PARTIALLY_REFUNDED, or LATE_PAYMENT)',
      NEW.transaction_id, v_txn_status
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

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

DROP TRIGGER IF EXISTS trg_verify_payment_transaction_creation ON public.payment_transactions;
CREATE TRIGGER trg_verify_payment_transaction_creation
  BEFORE INSERT ON public.payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_verify_payment_transaction_creation();

DROP TRIGGER IF EXISTS trg_verify_payment_refund_creation ON public.payment_refunds;
CREATE TRIGGER trg_verify_payment_refund_creation
  BEFORE INSERT ON public.payment_refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_verify_payment_refund_creation();

-- ---------------------------------------------------------------------------
-- 4. TRUSTED PAYMENT STATE TRANSITION FUNCTIONS.
-- ---------------------------------------------------------------------------
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

  SELECT * INTO v_txn
  FROM public.payment_transactions
  WHERE id = p_transaction_id AND college_id = p_college_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found for college %', p_transaction_id, p_college_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_txn.status = 'PAID' THEN
    IF v_txn.gateway_payment_id = p_gateway_payment_id THEN
      RETURN v_txn;
    ELSE
      RAISE EXCEPTION 'Transaction % already PAID with conflicting payment ID', p_transaction_id
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

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

  UPDATE public.payment_transactions
  SET status = 'PAID',
      gateway_payment_id = p_gateway_payment_id,
      gateway_signature = p_gateway_signature,
      payment_method = COALESCE(p_payment_method, payment_method),
      vpa_masked = COALESCE(p_vpa_masked, vpa_masked),
      updated_at = now()
  WHERE id = p_transaction_id AND college_id = p_college_id
  RETURNING * INTO v_txn;

  RETURN v_txn;
END;
$$;

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
  WHERE id = p_transaction_id AND college_id = p_college_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found for college %', p_transaction_id, p_college_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_txn.status = 'FAILED' THEN
    RETURN v_txn;
  END IF;

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
  WHERE id = p_transaction_id AND college_id = p_college_id
  RETURNING * INTO v_txn;

  RETURN v_txn;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS: ENABLE, NOT FORCE. Recreate only the known expected policies.
-- ---------------------------------------------------------------------------
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

DROP POLICY IF EXISTS college_payment_configs_select_policy ON public.college_payment_configs;
CREATE POLICY college_payment_configs_select_policy ON public.college_payment_configs
  FOR SELECT TO app_user
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

DROP POLICY IF EXISTS college_payment_config_audits_deny_policy ON public.college_payment_config_audits;
CREATE POLICY college_payment_config_audits_deny_policy ON public.college_payment_config_audits
  FOR ALL TO app_user
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS seat_reservations_select_policy ON public.seat_reservations;
DROP POLICY IF EXISTS seat_reservations_insert_policy ON public.seat_reservations;
DROP POLICY IF EXISTS seat_reservations_update_policy ON public.seat_reservations;
DROP POLICY IF EXISTS seat_reservations_delete_policy ON public.seat_reservations;

CREATE POLICY seat_reservations_select_policy ON public.seat_reservations
  FOR SELECT TO app_user
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

CREATE POLICY seat_reservations_insert_policy ON public.seat_reservations
  FOR INSERT TO app_user
  WITH CHECK (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

CREATE POLICY seat_reservations_update_policy ON public.seat_reservations
  FOR UPDATE TO app_user
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid)
  WITH CHECK (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

CREATE POLICY seat_reservations_delete_policy ON public.seat_reservations
  FOR DELETE TO app_user
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

DROP POLICY IF EXISTS payment_transactions_select_policy ON public.payment_transactions;
DROP POLICY IF EXISTS payment_transactions_insert_policy ON public.payment_transactions;
DROP POLICY IF EXISTS payment_transactions_update_policy ON public.payment_transactions;

CREATE POLICY payment_transactions_select_policy ON public.payment_transactions
  FOR SELECT TO app_user
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

CREATE POLICY payment_transactions_insert_policy ON public.payment_transactions
  FOR INSERT TO app_user
  WITH CHECK (
    college_id = NULLIF(current_setting('app.college_id', true), '')::uuid
    AND status = 'PENDING'
    AND gateway_payment_id IS NULL
    AND gateway_signature IS NULL
  );

DROP POLICY IF EXISTS payment_refunds_select_policy ON public.payment_refunds;
DROP POLICY IF EXISTS payment_refunds_insert_policy ON public.payment_refunds;
DROP POLICY IF EXISTS payment_refunds_update_policy ON public.payment_refunds;

CREATE POLICY payment_refunds_select_policy ON public.payment_refunds
  FOR SELECT TO app_user
  USING (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid);

CREATE POLICY payment_refunds_insert_policy ON public.payment_refunds
  FOR INSERT TO app_user
  WITH CHECK (
    college_id = NULLIF(current_setting('app.college_id', true), '')::uuid
    AND status = 'INITIATED'
    AND gateway_refund_id IS NULL
  );

DROP POLICY IF EXISTS payment_webhook_events_deny_policy ON public.payment_webhook_events;
CREATE POLICY payment_webhook_events_deny_policy ON public.payment_webhook_events
  FOR ALL TO app_user
  USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 6. LEAST-PRIVILEGE GRANTS.
-- Clear table-level and any existing column-level grants for app_user/PUBLIC
-- before applying the intended column allowlists.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.college_payment_configs FROM PUBLIC, app_user;
REVOKE ALL ON public.college_payment_config_audits FROM PUBLIC, app_user;
REVOKE ALL ON public.seat_reservations FROM PUBLIC, app_user;
REVOKE ALL ON public.payment_transactions FROM PUBLIC, app_user;
REVOKE ALL ON public.payment_refunds FROM PUBLIC, app_user;
REVOKE ALL ON public.payment_webhook_events FROM PUBLIC, app_user;

DO $revoke_columns$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_name, column_name, privilege_type, grantee
    FROM information_schema.column_privileges
    WHERE table_schema = 'public'
      AND table_name IN (
        'college_payment_configs','college_payment_config_audits',
        'seat_reservations','payment_transactions',
        'payment_refunds','payment_webhook_events'
      )
      AND grantee IN ('app_user', 'PUBLIC')
  LOOP
    EXECUTE format(
      'REVOKE %s (%I) ON TABLE public.%I FROM %s',
      r.privilege_type,
      r.column_name,
      r.table_name,
      CASE WHEN r.grantee = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(r.grantee) END
    );
  END LOOP;
END
$revoke_columns$;

GRANT SELECT (
  id, college_id, mode, provider, status, is_test_mode,
  display_merchant_name, created_at, updated_at
) ON public.college_payment_configs TO app_user;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.seat_reservations TO app_user;

GRANT SELECT (
  id, college_id, event_id, reservation_id, participant_type,
  user_id, external_participant_id, amount, currency, status,
  gateway_provider, payment_mode, gateway_order_id, gateway_payment_id,
  payment_method, vpa_masked, failure_reason, created_at, updated_at
) ON public.payment_transactions TO app_user;

GRANT INSERT (
  id, college_id, event_id, reservation_id, participant_type,
  user_id, external_participant_id, amount, currency, status,
  gateway_provider, payment_mode, merchant_account_id, gateway_order_id,
  idempotency_key, registration_payload, failure_reason, created_at, updated_at
) ON public.payment_transactions TO app_user;

GRANT SELECT ON public.payment_refunds TO app_user;

GRANT INSERT (
  id, transaction_id, college_id, amount, status, reason,
  initiated_by_admin_id, idempotency_key, created_at, updated_at
) ON public.payment_refunds TO app_user;

-- Explicitly deny app_user access to config audit and raw webhook rows.
REVOKE ALL ON public.college_payment_config_audits FROM app_user;
REVOKE ALL ON public.payment_webhook_events FROM app_user;

-- Platform operations owns the trusted application-level payment workflows.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.college_payment_configs,
     public.college_payment_config_audits,
     public.seat_reservations,
     public.payment_transactions,
     public.payment_refunds,
     public.payment_webhook_events
  TO platform_ops;

REVOKE ALL ON FUNCTION public.fn_verify_payment_transaction_creation() FROM PUBLIC, app_user, platform_ops;
REVOKE ALL ON FUNCTION public.fn_verify_payment_refund_creation() FROM PUBLIC, app_user, platform_ops;

REVOKE ALL ON FUNCTION public.fn_complete_payment_transaction(uuid,uuid,text,text,text,text) FROM PUBLIC, app_user;
REVOKE ALL ON FUNCTION public.fn_fail_payment_transaction(uuid,uuid,text) FROM PUBLIC, app_user;

GRANT EXECUTE ON FUNCTION public.fn_complete_payment_transaction(uuid,uuid,text,text,text,text) TO platform_ops;
GRANT EXECUTE ON FUNCTION public.fn_fail_payment_transaction(uuid,uuid,text) TO platform_ops;

-- Ensure all four functions are owned by migrator after CREATE OR REPLACE.
ALTER FUNCTION public.fn_verify_payment_transaction_creation() OWNER TO migrator;
ALTER FUNCTION public.fn_verify_payment_refund_creation() OWNER TO migrator;
ALTER FUNCTION public.fn_complete_payment_transaction(uuid,uuid,text,text,text,text) OWNER TO migrator;
ALTER FUNCTION public.fn_fail_payment_transaction(uuid,uuid,text) OWNER TO migrator;

-- ---------------------------------------------------------------------------
-- 7. POSTCONDITION ASSERTIONS. Any failure rolls back the entire transaction.
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
  v_bad text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payment_webhook_events'
      AND column_name='claim_token' AND data_type='text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payment_webhook_events'
      AND column_name='updated_at' AND is_nullable='NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payment_refunds'
      AND column_name='idempotency_key' AND data_type='text'
  ) THEN
    RAISE EXCEPTION 'Postcondition failed: expected missing columns were not created';
  END IF;

  IF to_regclass('public.uq_payment_refunds_college_idempotency') IS NULL THEN
    RAISE EXCEPTION 'Postcondition failed: refund idempotency index missing';
  END IF;

  SELECT string_agg(c.relname || ':' || pg_get_userbyid(c.relowner), ', ')
  INTO v_bad
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public'
    AND c.relname IN (
      'college_payment_configs','college_payment_config_audits',
      'seat_reservations','payment_transactions','payment_refunds',
      'payment_webhook_events'
    )
    AND pg_get_userbyid(c.relowner) <> 'migrator';

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Postcondition failed: payment tables not owned by migrator: %', v_bad;
  END IF;

  SELECT string_agg(p.proname || ':' || pg_get_userbyid(p.proowner), ', ')
  INTO v_bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname IN (
      'fn_verify_payment_transaction_creation',
      'fn_verify_payment_refund_creation',
      'fn_complete_payment_transaction',
      'fn_fail_payment_transaction'
    )
    AND pg_get_userbyid(p.proowner) <> 'migrator';

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Postcondition failed: payment functions not owned by migrator: %', v_bad;
  END IF;

  IF NOT has_column_privilege('app_user','public.payment_refunds','idempotency_key','INSERT') THEN
    RAISE EXCEPTION 'Postcondition failed: app_user lacks INSERT on payment_refunds.idempotency_key';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(
      COALESCE(p.proacl, acldefault('f', p.proowner))
    ) a
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'fn_verify_payment_transaction_creation',
        'fn_verify_payment_refund_creation'
      )
      AND a.grantee = 0
      AND a.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Postcondition failed: PUBLIC can execute a trigger function';
  END IF;

  IF NOT has_function_privilege('platform_ops',
       'public.fn_complete_payment_transaction(uuid,uuid,text,text,text,text)','EXECUTE')
     OR NOT has_function_privilege('platform_ops',
       'public.fn_fail_payment_transaction(uuid,uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Postcondition failed: platform_ops cannot execute payment transition functions';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.payment_transactions'::regclass)
     OR (SELECT relforcerowsecurity FROM pg_class WHERE oid='public.payment_transactions'::regclass) THEN
    RAISE EXCEPTION 'Postcondition failed: payment_transactions RLS must be enabled and not forced';
  END IF;

  IF NOT has_table_privilege('migrator', 'public.events', 'SELECT')
     OR NOT EXISTS (
       SELECT 1 FROM pg_policy
       WHERE polrelid = 'public.events'::regclass
         AND polname = 'events_payment_trigger_select_policy'
     ) THEN
    RAISE EXCEPTION 'Postcondition failed: migrator lacks tenant-scoped SELECT access to events';
  END IF;
END
$verify$;

COMMIT;

-- ---------------------------------------------------------------------------
-- 8. READ-ONLY VERIFICATION QUERIES (run after COMMIT in the same editor).
-- Expected: all six table owners = migrator; four function owners = migrator;
-- missing columns/index present; app_user refund idempotency INSERT = true;
-- trigger function PUBLIC EXECUTE = false; RLS enabled / FORCE false.
-- ---------------------------------------------------------------------------
SELECT
  c.relname AS object_name,
  pg_get_userbyid(c.relowner) AS owner,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN (
    'college_payment_configs','college_payment_config_audits',
    'seat_reservations','payment_transactions','payment_refunds',
    'payment_webhook_events'
  )
ORDER BY c.relname;

SELECT
  p.proname AS function_name,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS security_definer,
  EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
    WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
  ) AS public_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN (
    'fn_verify_payment_transaction_creation',
    'fn_verify_payment_refund_creation',
    'fn_complete_payment_transaction',
    'fn_fail_payment_transaction'
  )
ORDER BY p.proname;

SELECT
  has_column_privilege('app_user','public.payment_refunds','idempotency_key','INSERT')
    AS app_user_can_insert_refund_idempotency_key,
  has_function_privilege('platform_ops',
    'public.fn_complete_payment_transaction(uuid,uuid,text,text,text,text)','EXECUTE')
    AS platform_ops_can_complete_payment,
  has_function_privilege('platform_ops',
    'public.fn_fail_payment_transaction(uuid,uuid,text)','EXECUTE')
    AS platform_ops_can_fail_payment,
  to_regclass('public.uq_payment_refunds_college_idempotency') IS NOT NULL
    AS refund_idempotency_index_exists;
