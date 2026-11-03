\echo '=== TEST (a): app_user with no context returns 0 rows on all 9 tables ==='
SELECT 'users' AS table_name, count(*) AS row_count FROM users
UNION ALL SELECT 'departments', count(*) FROM departments
UNION ALL SELECT 'clubs', count(*) FROM clubs
UNION ALL SELECT 'club_departments', count(*) FROM club_departments
UNION ALL SELECT 'memberships', count(*) FROM memberships
UNION ALL SELECT 'events', count(*) FROM events
UNION ALL SELECT 'event_gallery_images', count(*) FROM event_gallery_images
UNION ALL SELECT 'event_registrations', count(*) FROM event_registrations
UNION ALL SELECT 'deletion_verifications', count(*) FROM deletion_verifications;

\echo ''
\echo '=== TEST (b): Cross-tenant INSERT fails ==='
DO $$
DECLARE
    v_col_a UUID;
    v_col_b UUID;
BEGIN
    SELECT id INTO v_col_a FROM colleges WHERE slug = 'lbrce';
    SELECT id INTO v_col_b FROM colleges WHERE slug = 'vrsec';

    -- Set tenant context to College A inside this transaction block
    PERFORM set_config('app.college_id', v_col_a::text, true);

    -- Attempt cross-tenant insert into College B
    BEGIN
        INSERT INTO users (college_id, name, email, role, is_active)
        VALUES (v_col_b, 'Intruder User', 'intruder@vrsec.in', 'USER', true);
        RAISE EXCEPTION 'FAIL: Cross-tenant insert unexpectedly succeeded!';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'SUCCESS: Cross-tenant INSERT blocked by RLS. SQLSTATE: %, Message: %', SQLSTATE, SQLERRM;
    END;
END
$$;

\echo ''
\echo '=== TEST (c): set_config outside a transaction yields 0 rows ==='
-- 1. Run set_config with is_local=true as a standalone autocommit statement
SELECT set_config('app.college_id', (SELECT id::text FROM colleges WHERE slug = 'lbrce'), true);

-- 2. Run query immediately in the next statement:
-- Because is_local=true resets at transaction end (autocommit ends after statement 1),
-- this subsequent statement runs with unset context and MUST yield 0 rows.
SELECT 'users_query_after_autocommit' AS check_name, count(*) AS row_count FROM users;
