-- ============================================================================
-- DBA PROVISIONING SCRIPT: Dedicated User Deletion Executor Role
-- ============================================================================
-- Prerequisites: Must be executed by a verified administrative connection
-- (e.g., neondb_owner, neon_superuser member, or cluster superuser).
-- In PostgreSQL 16+, creating a role with BYPASSRLS requires either SUPERUSER
-- or a role holding CREATEROLE and the BYPASSRLS attribute (such as Neon's
-- neondb_owner or neon_superuser group).
--
-- Purpose: Pre-provisions the dedicated least-privilege role required by
-- Migration 004 without requiring DDL migration runners to hold SUPERUSER/CREATEROLE.
--
-- Safety: Idempotent and fails with descriptive diagnostics if pre-existing
-- role attributes, memberships, object ownerships, or effective privileges deviate.
-- ============================================================================

BEGIN;

-- 1. Capability-Based Preflight Assertion (PostgreSQL Superuser or Neon neon_superuser / neondb_owner)
DO $$
DECLARE
  v_user TEXT := current_user;
  v_is_super BOOLEAN;
  v_can_create_role BOOLEAN;
  v_has_bypassrls BOOLEAN;
  v_is_neon_super BOOLEAN := false;
BEGIN
  SELECT rolsuper, rolcreaterole, rolbypassrls
  INTO v_is_super, v_can_create_role, v_has_bypassrls
  FROM pg_roles
  WHERE rolname = v_user;

  -- Check if neon_superuser role exists and current_user is a member
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'neon_superuser') THEN
    SELECT pg_has_role(v_user, 'neon_superuser', 'MEMBER') INTO v_is_neon_super;
  END IF;

  -- Capability validation:
  -- Creating a role with BYPASSRLS requires:
  -- 1) SUPERUSER (rolsuper = true), OR
  -- 2) CREATEROLE (rolcreaterole = true) AND BYPASSRLS (rolbypassrls = true or member of neon_superuser)
  IF NOT (
    COALESCE(v_is_super, false) OR
    (
      COALESCE(v_can_create_role, false) AND
      (COALESCE(v_has_bypassrls, false) OR COALESCE(v_is_neon_super, false))
    )
  ) THEN
    RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Session user "%" lacks required administrative authority. Creating a role with BYPASSRLS requires SUPERUSER or Neon administrator capabilities (CREATEROLE + BYPASSRLS, such as neondb_owner or neon_superuser membership). Connect using neondb_owner, a neon_superuser member, or a cluster superuser.', v_user;
  END IF;

  -- If caller lacks direct BYPASSRLS but is a neon_superuser member, activate neon_superuser for provisioning
  IF NOT COALESCE(v_is_super, false) AND NOT COALESCE(v_has_bypassrls, false) AND v_is_neon_super THEN
    EXECUTE 'SET LOCAL ROLE neon_superuser';
    RAISE NOTICE 'DBA Provisioning: Activated neon_superuser role for BYPASSRLS role provisioning.';
  END IF;
END $$;

-- 2. Role Provisioning & Exhaustive Least-Privilege Surface Audit
DO $$
DECLARE
  v_rec RECORD;
  v_role_oid OID;
  v_unexpected_members TEXT;
  v_unrelated_objects_count INT := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'user_deletion_executor') THEN
    CREATE ROLE user_deletion_executor WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  ELSE
    SELECT *
    INTO v_rec
    FROM pg_roles
    WHERE rolname = 'user_deletion_executor';

    v_role_oid := v_rec.oid;

    -- 2.1 Verify exact role attributes
    IF v_rec.rolcanlogin <> false OR
       v_rec.rolsuper <> false OR
       v_rec.rolcreatedb <> false OR
       v_rec.rolcreaterole <> false OR
       v_rec.rolinherit <> false OR
       v_rec.rolbypassrls <> true THEN
      RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Pre-existing role "user_deletion_executor" has conflicting attributes (canlogin=%, super=%, createdb=%, createrole=%, inherit=%, bypassrls=%); expected (false, false, false, false, false, true). Manual DBA review required.',
        v_rec.rolcanlogin, v_rec.rolsuper, v_rec.rolcreatedb, v_rec.rolcreaterole, v_rec.rolinherit, v_rec.rolbypassrls;
    END IF;

    -- 2.2 Verify no unexpected role memberships are held by user_deletion_executor (direct or inherited)
    IF EXISTS (
      SELECT 1 FROM pg_auth_members am
      WHERE am.member = v_role_oid
    ) THEN
      RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Pre-existing role "user_deletion_executor" holds unexpected memberships in other roles. Manual DBA review required.';
    END IF;

    -- 2.3 Verify no unexpected roles are members of user_deletion_executor
    -- (migrator and the administrative provisioning role are permitted; application roles are strictly forbidden)
    SELECT string_agg(m.rolname, ', ')
    INTO v_unexpected_members
    FROM pg_auth_members am
    JOIN pg_roles m ON am.member = m.oid
    WHERE am.roleid = v_role_oid
      AND m.rolname <> 'migrator'
      AND m.rolname <> current_user
      AND m.rolname NOT IN ('neondb_owner', 'neon_superuser', 'cloud_admin', 'postgres');

    IF v_unexpected_members IS NOT NULL THEN
      RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Pre-existing role "user_deletion_executor" has unexpected members: %. Manual DBA review required.', v_unexpected_members;
    END IF;

    -- 2.4 Verify database-level privileges (no CREATE permitted on any database)
    IF EXISTS (
      SELECT 1 FROM pg_database d
      WHERE has_database_privilege(v_role_oid, d.oid, 'CREATE')
    ) THEN
      RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Role "user_deletion_executor" holds CREATE privilege on a database. Least-privilege violation.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_database d,
      LATERAL aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) acl
      WHERE acl.grantee = v_role_oid
        AND acl.privilege_type <> 'CONNECT'
    ) THEN
      RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Role "user_deletion_executor" holds unexpected explicit database privilege in datacl.';
    END IF;

    -- 2.5 Verify schema-level privileges (no CREATE on any schema; USAGE strictly limited)
    IF EXISTS (
      SELECT 1 FROM pg_namespace n
      WHERE has_schema_privilege(v_role_oid, n.oid, 'CREATE')
    ) THEN
      RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Role "user_deletion_executor" holds CREATE privilege on schema(s). Least-privilege violation.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_namespace n
      WHERE n.nspname NOT IN ('public', 'pg_catalog', 'information_schema', 'pg_toast')
        AND has_schema_privilege(v_role_oid, n.oid, 'USAGE')
    ) THEN
      RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Role "user_deletion_executor" holds USAGE on non-public schema(s).';
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_namespace n,
      LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) acl
      WHERE acl.grantee = v_role_oid
        AND NOT (n.nspname = 'public' AND acl.privilege_type = 'USAGE')
    ) THEN
      RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Role "user_deletion_executor" holds unexpected explicit schema privilege.';
    END IF;

    -- 2.6 Verify table-level privileges (zero whole-table modification or DDL privileges)
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND (
          has_table_privilege(v_role_oid, c.oid, 'INSERT') OR
          has_table_privilege(v_role_oid, c.oid, 'DELETE') OR
          has_table_privilege(v_role_oid, c.oid, 'TRUNCATE') OR
          has_table_privilege(v_role_oid, c.oid, 'REFERENCES') OR
          has_table_privilege(v_role_oid, c.oid, 'TRIGGER')
        )
    ) THEN
      RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Role "user_deletion_executor" holds table-level modification or DDL privileges.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_class c,
      LATERAL aclexplode(c.relacl) acl
      WHERE acl.grantee = v_role_oid
    ) THEN
      RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Role "user_deletion_executor" holds explicit whole-table privilege in relacl.';
    END IF;

    -- 2.7 Verify column-level privileges (strictly permitted columns only)
    IF EXISTS (
      SELECT 1
      FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      CROSS JOIN LATERAL aclexplode(a.attacl) acl
      WHERE acl.grantee = v_role_oid
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND NOT (
          (n.nspname = 'public' AND c.relname = 'event_registrations' AND a.attname = 'user_id' AND acl.privilege_type = 'SELECT') OR
          (n.nspname = 'public' AND c.relname = 'event_registrations' AND a.attname = 'user_id' AND acl.privilege_type = 'UPDATE') OR
          (n.nspname = 'public' AND c.relname = 'event_registrations' AND a.attname = 'is_user_deleted' AND acl.privilege_type = 'UPDATE') OR
          (n.nspname = 'public' AND c.relname = 'event_certificates' AND a.attname = 'user_id' AND acl.privilege_type = 'SELECT') OR
          (n.nspname = 'public' AND c.relname = 'event_certificates' AND a.attname = 'user_id' AND acl.privilege_type = 'UPDATE')
        )
    ) THEN
      RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Role "user_deletion_executor" holds unexpected column-level privilege(s). Manual DBA review required.';
    END IF;

    -- 2.8 Verify sequence privileges (zero sequence privileges)
    IF EXISTS (
      SELECT 1 FROM pg_class c
      WHERE c.relkind = 'S'
        AND (
          has_sequence_privilege(v_role_oid, c.oid, 'USAGE') OR
          has_sequence_privilege(v_role_oid, c.oid, 'SELECT') OR
          has_sequence_privilege(v_role_oid, c.oid, 'UPDATE')
        )
    ) THEN
      RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Role "user_deletion_executor" holds sequence privileges.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_class c,
      LATERAL aclexplode(c.relacl) acl
      WHERE c.relkind = 'S'
        AND acl.grantee = v_role_oid
    ) THEN
      RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Role "user_deletion_executor" holds explicit sequence privileges in relacl.';
    END IF;

    -- 2.9 Verify function and procedure privileges (no explicit execution grants in proacl)
    IF EXISTS (
      SELECT 1 FROM pg_proc p,
      LATERAL aclexplode(p.proacl) acl
      WHERE acl.grantee = v_role_oid
        AND NOT (p.proname = 'handle_user_pre_delete' AND p.pronamespace = 'public'::regnamespace)
    ) THEN
      RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Role "user_deletion_executor" holds explicit execute privileges on unexpected function(s).';
    END IF;

    -- 2.10 Verify default privileges (no pg_default_acl entries configured)
    IF EXISTS (
      SELECT 1 FROM pg_default_acl d
      WHERE d.defaclrole = v_role_oid
    ) OR EXISTS (
      SELECT 1 FROM pg_default_acl d,
      LATERAL aclexplode(d.defaclacl) acl
      WHERE acl.grantee = v_role_oid
    ) THEN
      RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Role "user_deletion_executor" has default privileges configured in pg_default_acl.';
    END IF;

    -- 2.11 Verify object ownership in pg_shdepend by full composite object address
    -- (deptype = 'o', classid = 'pg_proc'::regclass, objid = handle_user_pre_delete, objsubid = 0)
    SELECT count(*)
    INTO v_unrelated_objects_count
    FROM pg_shdepend s
    WHERE s.refobjid = v_role_oid
      AND s.deptype = 'o'
      AND (
        to_regprocedure('public.handle_user_pre_delete()') IS NULL
        OR NOT (
          s.classid = 'pg_proc'::regclass
          AND s.objid = to_regprocedure('public.handle_user_pre_delete()')::oid
          AND s.objsubid = 0
        )
      );

    IF v_unrelated_objects_count > 0 THEN
      RAISE EXCEPTION 'DBA PROVISIONING ABORTED: Role "user_deletion_executor" unexpectedly owns % object(s). Expected only public.handle_user_pre_delete() if post-migration. Manual DBA review required.', v_unrelated_objects_count;
    END IF;
  END IF;
END $$;

-- 3. Grant temporary membership to migrator WITH ADMIN OPTION
-- Allows migrator (the DDL migration runner) to transfer function ownership
-- to user_deletion_executor and execute idempotent reruns.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_auth_members am
    JOIN pg_roles r ON am.roleid = r.oid
    JOIN pg_roles m ON am.member = m.oid
    WHERE r.rolname = 'user_deletion_executor' 
      AND m.rolname = 'migrator' 
      AND am.admin_option = true
  ) THEN
    GRANT user_deletion_executor TO migrator WITH ADMIN OPTION;
  END IF;
END $$;

-- 4. Safety Assertion: Ensure application runtime roles NEVER hold membership
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_auth_members am
    JOIN pg_roles r ON am.roleid = r.oid
    JOIN pg_roles m ON am.member = m.oid
    WHERE r.rolname = 'user_deletion_executor' 
      AND m.rolname IN ('app_user', 'platform_ops')
  ) THEN
    RAISE EXCEPTION 'DBA PROVISIONING ERROR: user_deletion_executor cannot have app_user or platform_ops as members';
  END IF;
END $$;

COMMIT;
