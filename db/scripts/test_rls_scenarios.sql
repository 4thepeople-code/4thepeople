-- ============================================================================
-- test_rls_scenarios.sql
-- Run as: app_user
-- Must pass with: -v ON_ERROR_STOP=1
-- ============================================================================

\echo '======================================================================'
\echo 'TEST 1: app_user with NO CONTEXT returns 0 rows on all 9 tenant tables'
\echo '======================================================================'
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
\echo '======================================================================'
\echo 'TEST 2: POSITIVE CONTROLS (Own Tenant > 0, Other Tenant = 0)'
\echo '======================================================================'
DO $$
DECLARE
    v_col_a UUID;
    v_col_b UUID;
    v_cnt_users INT;
    v_cnt_depts INT;
    v_cnt_clubs INT;
    v_cnt_club_depts INT;
    v_cnt_memberships INT;
    v_cnt_events INT;
    v_cnt_gallery INT;
    v_cnt_registrations INT;
    v_cnt_deletions INT;
BEGIN
    SELECT id INTO v_col_a FROM colleges WHERE slug = 'lbrce';
    SELECT id INTO v_col_b FROM colleges WHERE slug = 'vrsec';

    -- Set context to College A (lbrce)
    PERFORM set_config('app.college_id', v_col_a::text, true);

    -- Check counts for College A
    SELECT count(*) INTO v_cnt_users FROM users;
    SELECT count(*) INTO v_cnt_depts FROM departments;
    SELECT count(*) INTO v_cnt_clubs FROM clubs;
    SELECT count(*) INTO v_cnt_club_depts FROM club_departments;
    SELECT count(*) INTO v_cnt_memberships FROM memberships;
    SELECT count(*) INTO v_cnt_events FROM events;
    SELECT count(*) INTO v_cnt_gallery FROM event_gallery_images;
    SELECT count(*) INTO v_cnt_registrations FROM event_registrations;
    SELECT count(*) INTO v_cnt_deletions FROM deletion_verifications;

    IF v_cnt_users = 0 OR v_cnt_depts = 0 OR v_cnt_clubs = 0 OR
       v_cnt_club_depts = 0 OR v_cnt_memberships = 0 OR v_cnt_events = 0 OR
       v_cnt_gallery = 0 OR v_cnt_registrations = 0 OR v_cnt_deletions = 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Positive control failed! Expected > 0 rows on all tables under own tenant context.';
    END IF;

    -- Verify no College B rows visible
    IF EXISTS (SELECT 1 FROM users WHERE college_id = v_col_b) OR
       EXISTS (SELECT 1 FROM departments WHERE college_id = v_col_b) OR
       EXISTS (SELECT 1 FROM clubs WHERE college_id = v_col_b) OR
       EXISTS (SELECT 1 FROM club_departments WHERE college_id = v_col_b) OR
       EXISTS (SELECT 1 FROM memberships WHERE college_id = v_col_b) OR
       EXISTS (SELECT 1 FROM events WHERE college_id = v_col_b) OR
       EXISTS (SELECT 1 FROM event_gallery_images WHERE college_id = v_col_b) OR
       EXISTS (SELECT 1 FROM event_registrations WHERE college_id = v_col_b) OR
       EXISTS (SELECT 1 FROM deletion_verifications WHERE college_id = v_col_b) THEN
        RAISE EXCEPTION 'TEST FAILED: Data leakage detected! College B rows visible under College A context.';
    END IF;

    RAISE NOTICE 'SUCCESS: Positive controls passed. All 9 tables returned > 0 rows for own tenant and 0 rows for other tenant.';
END
$$;

\echo ''
\echo '======================================================================'
\echo 'TEST 3: Cross-tenant INSERT fails (catches only insufficient_privilege)'
\echo '======================================================================'
DO $$
DECLARE
    v_col_a UUID;
    v_col_b UUID;
BEGIN
    SELECT id INTO v_col_a FROM colleges WHERE slug = 'lbrce';
    SELECT id INTO v_col_b FROM colleges WHERE slug = 'vrsec';

    -- Set tenant context to College A
    PERFORM set_config('app.college_id', v_col_a::text, true);

    BEGIN
        INSERT INTO users (college_id, name, email, role, is_active)
        VALUES (v_col_b, 'Intruder User', 'intruder@vrsec.in', 'USER', true);

        -- If execution reaches here, insert succeeded: MUST ABORT SCRIPT
        RAISE EXCEPTION 'TEST FAILED: Cross-tenant INSERT succeeded without error!';
    EXCEPTION
        WHEN insufficient_privilege THEN -- SQLSTATE 42501 (RLS WITH CHECK violation)
            RAISE NOTICE 'SUCCESS: Cross-tenant INSERT blocked by RLS WITH CHECK (insufficient_privilege, SQLSTATE 42501).';
    END;
END
$$;

\echo ''
\echo '======================================================================'
\echo 'TEST 4: UPDATE-to-other-tenant fails (WITH CHECK policy violation)'
\echo '======================================================================'
DO $$
DECLARE
    v_col_a UUID;
    v_col_b UUID;
    v_user_a UUID;
BEGIN
    SELECT id INTO v_col_a FROM colleges WHERE slug = 'lbrce';
    SELECT id INTO v_col_b FROM colleges WHERE slug = 'vrsec';

    PERFORM set_config('app.college_id', v_col_a::text, true);
    SELECT id INTO v_user_a FROM users LIMIT 1;

    BEGIN
        -- Attempt to move user from College A to College B
        UPDATE users SET college_id = v_col_b WHERE id = v_user_a;

        RAISE EXCEPTION 'TEST FAILED: UPDATE college_id to other tenant succeeded!';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'SUCCESS: UPDATE-to-other-tenant blocked by RLS WITH CHECK (insufficient_privilege, SQLSTATE 42501).';
    END;
END
$$;

\echo ''
\echo '======================================================================'
\echo 'TEST 5: Cross-tenant DELETE affects 0 rows'
\echo '======================================================================'
DO $$
DECLARE
    v_col_a UUID;
    v_user_b UUID;
    v_rows_deleted INT;
BEGIN
    SELECT id INTO v_col_a FROM colleges WHERE slug = 'lbrce';
    
    -- In a separate clean context, get College B user id
    PERFORM set_config('app.college_id', (SELECT id::text FROM colleges WHERE slug = 'vrsec'), true);
    SELECT id INTO v_user_b FROM users LIMIT 1;

    -- Switch context to College A
    PERFORM set_config('app.college_id', v_col_a::text, true);

    -- Try to delete College B user while in College A context
    DELETE FROM users WHERE id = v_user_b;
    GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;

    IF v_rows_deleted != 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Cross-tenant DELETE affected % rows!', v_rows_deleted;
    END IF;

    RAISE NOTICE 'SUCCESS: Cross-tenant DELETE affected exactly 0 rows.';
END
$$;

\echo ''
\echo '======================================================================'
\echo 'TEST 6: events_with_status under both contexts & unset context'
\echo '======================================================================'
-- 1. Unset context (expected: 0 rows)
\echo 'Under unset context (expected: 0 rows):'
SELECT count(*) AS events_with_status_unset_count FROM events_with_status;

-- 2. Context College A inside a transaction
\echo 'Under College A context:'
BEGIN;
SELECT set_config('app.college_id', (SELECT id::text FROM colleges WHERE slug = 'lbrce'), true) AS ctx_set_a;
SELECT title, start_at, end_at, capacity, registered_count, status FROM events_with_status;
COMMIT;

-- 3. Context College B inside a transaction
\echo 'Under College B context:'
BEGIN;
SELECT set_config('app.college_id', (SELECT id::text FROM colleges WHERE slug = 'vrsec'), true) AS ctx_set_b;
SELECT title, start_at, end_at, capacity, registered_count, status FROM events_with_status;
COMMIT;

\echo ''
\echo '======================================================================'
\echo 'TEST 7: Capacity Invariant (capacity 2: 2 succeed, 3rd fails, delete, retry succeeds)'
\echo '======================================================================'
DO $$
DECLARE
    v_col_b UUID;
    v_event_b UUID;
    v_user_1 UUID;
    v_user_2 UUID;
    v_user_3 UUID;
    v_reg_count INT;
BEGIN
    SELECT id INTO v_col_b FROM colleges WHERE slug = 'vrsec';
    PERFORM set_config('app.college_id', v_col_b::text, true);

    SELECT id INTO v_event_b FROM events WHERE title = 'RoboWars 2026';

    -- Create 3 test users in College B
    INSERT INTO users (college_id, name, email, role, is_active)
    VALUES (v_col_b, 'Student 1', 'student1@vrsec.in', 'USER', true) RETURNING id INTO v_user_1;

    INSERT INTO users (college_id, name, email, role, is_active)
    VALUES (v_col_b, 'Student 2', 'student2@vrsec.in', 'USER', true) RETURNING id INTO v_user_2;

    INSERT INTO users (college_id, name, email, role, is_active)
    VALUES (v_col_b, 'Student 3', 'student3@vrsec.in', 'USER', true) RETURNING id INTO v_user_3;

    -- Clean any existing registrations for this event
    DELETE FROM event_registrations WHERE event_id = v_event_b;
    UPDATE events SET registered_count = 0 WHERE id = v_event_b;

    -- 1. Insert 1: must succeed
    INSERT INTO event_registrations (college_id, event_id, user_id) VALUES (v_col_b, v_event_b, v_user_1);
    SELECT registered_count INTO v_reg_count FROM events WHERE id = v_event_b;
    IF v_reg_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Expected registered_count = 1 after first insert, got %', v_reg_count;
    END IF;

    -- 2. Insert 2: must succeed (reaches capacity = 2)
    INSERT INTO event_registrations (college_id, event_id, user_id) VALUES (v_col_b, v_event_b, v_user_2);
    SELECT registered_count INTO v_reg_count FROM events WHERE id = v_event_b;
    IF v_reg_count != 2 THEN
        RAISE EXCEPTION 'TEST FAILED: Expected registered_count = 2 after second insert, got %', v_reg_count;
    END IF;

    -- 3. Insert 3: must FAIL with check_violation
    BEGIN
        INSERT INTO event_registrations (college_id, event_id, user_id) VALUES (v_col_b, v_event_b, v_user_3);
        RAISE EXCEPTION 'TEST FAILED: Third registration succeeded beyond capacity!';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'SUCCESS: Third registration blocked as expected (% / 2 reached).', v_reg_count;
    END;

    -- 4. Delete 1 registration: registered_count must decrement to 1
    DELETE FROM event_registrations WHERE event_id = v_event_b AND user_id = v_user_1;
    SELECT registered_count INTO v_reg_count FROM events WHERE id = v_event_b;
    IF v_reg_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Expected registered_count = 1 after delete, got %', v_reg_count;
    END IF;

    -- 5. Insert user 3 again: now must succeed!
    INSERT INTO event_registrations (college_id, event_id, user_id) VALUES (v_col_b, v_event_b, v_user_3);
    SELECT registered_count INTO v_reg_count FROM events WHERE id = v_event_b;
    IF v_reg_count != 2 THEN
        RAISE EXCEPTION 'TEST FAILED: Expected registered_count = 2 after re-insert, got %', v_reg_count;
    END IF;

    RAISE NOTICE 'SUCCESS: Capacity test completed: 2 succeeded, 3rd blocked, deleted 1, retry succeeded.';
END
$$;

\echo ''
\echo '======================================================================'
\echo 'TEST 8: set_config outside transaction yields 0 rows'
\echo '======================================================================'
SELECT set_config('app.college_id', (SELECT id::text FROM colleges WHERE slug = 'lbrce'), true) AS autocommit_ctx;
SELECT 'users_after_autocommit' AS check_name, count(*) AS row_count FROM users;
