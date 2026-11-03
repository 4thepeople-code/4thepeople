-- ============================================================================
-- 002_rls.sql
-- Multi-tenant Row-Level Security (RLS) & Role Privileges
-- Run as: migrator (schema owner)
-- ============================================================================

-- Schema usage
GRANT USAGE ON SCHEMA public TO app_user, platform_ops;

-- Table permissions for app_user (runtime API pool)
GRANT SELECT ON colleges TO app_user;
GRANT SELECT ON events_with_status TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON
    users,
    departments,
    clubs,
    club_departments,
    memberships,
    events,
    event_gallery_images,
    event_registrations,
    deletion_verifications
TO app_user;

-- Sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Explicitly block app_user from platform_admins
REVOKE ALL ON platform_admins FROM app_user;

-- Platform ops permissions (super-admin, BYPASSRLS)
GRANT ALL ON ALL TABLES IN SCHEMA public TO platform_ops;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO platform_ops;

-- Default privileges for future objects created by migrator
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
    GRANT ALL ON TABLES TO platform_ops;

ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
    GRANT ALL ON SEQUENCES TO platform_ops;

-- ============================================================================
-- ENABLE & FORCE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs FORCE ROW LEVEL SECURITY;

ALTER TABLE club_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_departments FORCE ROW LEVEL SECURITY;

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;

ALTER TABLE event_gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_gallery_images FORCE ROW LEVEL SECURITY;

ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations FORCE ROW LEVEL SECURITY;

ALTER TABLE deletion_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_verifications FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- TENANT ISOLATION POLICIES (Evaluated per query via scalar subquery)
-- When app.college_id is unset or empty, (SELECT NULLIF(...)::uuid) returns NULL,
-- evaluating (college_id = NULL) to UNKNOWN (falsy), returning 0 rows.
-- ============================================================================

-- 1. users
CREATE POLICY tenant_isolation_users ON users
    FOR ALL
    TO app_user
    USING (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid))
    WITH CHECK (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid));

-- 2. departments
CREATE POLICY tenant_isolation_departments ON departments
    FOR ALL
    TO app_user
    USING (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid))
    WITH CHECK (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid));

-- 3. clubs
CREATE POLICY tenant_isolation_clubs ON clubs
    FOR ALL
    TO app_user
    USING (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid))
    WITH CHECK (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid));

-- 4. club_departments
CREATE POLICY tenant_isolation_club_departments ON club_departments
    FOR ALL
    TO app_user
    USING (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid))
    WITH CHECK (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid));

-- 5. memberships
CREATE POLICY tenant_isolation_memberships ON memberships
    FOR ALL
    TO app_user
    USING (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid))
    WITH CHECK (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid));

-- 6. events
CREATE POLICY tenant_isolation_events ON events
    FOR ALL
    TO app_user
    USING (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid))
    WITH CHECK (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid));

-- 7. event_gallery_images
CREATE POLICY tenant_isolation_event_gallery_images ON event_gallery_images
    FOR ALL
    TO app_user
    USING (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid))
    WITH CHECK (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid));

-- 8. event_registrations
CREATE POLICY tenant_isolation_event_registrations ON event_registrations
    FOR ALL
    TO app_user
    USING (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid))
    WITH CHECK (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid));

-- 9. deletion_verifications
CREATE POLICY tenant_isolation_deletion_verifications ON deletion_verifications
    FOR ALL
    TO app_user
    USING (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid))
    WITH CHECK (college_id = (SELECT NULLIF(current_setting('app.college_id', true), '')::uuid));
