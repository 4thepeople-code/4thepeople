-- ============================================================================
-- setup_test_database.sql
-- Run inside database: yuva_test
-- ============================================================================
-- Safety check: ensure running against yuva_test ONLY
DO $$ BEGIN IF current_database() != 'yuva_test' THEN RAISE EXCEPTION 'Safety check failed: current database is "%". Please switch the database dropdown in Neon SQL Editor to "yuva_test" before running this script.',
current_database();
END IF;
END $$;
-- Clean slate reset of public schema in yuva_test
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
-- ============================================================================
-- 001_init.sql
-- Initial PostgreSQL schema for 4thepeople multi-tenant architecture
-- Run as: migrator
-- ============================================================================
-- Extensions (created by bootstrap or if privileges allow)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
-- Enums
CREATE TYPE club_type_enum AS ENUM ('CENTRAL', 'DEPARTMENTAL');
CREATE TYPE user_role_enum AS ENUM ('COLLEGE_ADMIN', 'USER');
CREATE TYPE membership_role_enum AS ENUM ('MANAGER', 'MEMBER');
CREATE TYPE deletion_target_enum AS ENUM ('USER', 'CLUB');
-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- ============================================================================
-- 1. PLATFORM LEVEL TABLES (No RLS)
-- ============================================================================
-- Colleges (Tenants)
CREATE TABLE colleges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_colleges_slug UNIQUE (slug),
    CONSTRAINT chk_colleges_slug_format CHECK (
        slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        AND length(slug) BETWEEN 2 AND 63
    ),
    CONSTRAINT chk_colleges_slug_reserved CHECK (
        slug NOT IN (
            'www',
            'api',
            'admin',
            'mail',
            'app',
            'static',
            'assets',
            'public',
            'auth'
        )
    )
);
CREATE TRIGGER trg_colleges_updated_at BEFORE
UPDATE ON colleges FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- Platform Admins (Super-admins)
CREATE TABLE platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email CITEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    totp_secret TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_platform_admins_updated_at BEFORE
UPDATE ON platform_admins FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- ============================================================================
-- 2. TENANT-SCOPED TABLES (college_id NOT NULL on every table)
-- ============================================================================
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    email CITEXT NOT NULL,
    password_hash TEXT,
    role user_role_enum NOT NULL DEFAULT 'USER',
    is_active BOOLEAN NOT NULL DEFAULT false,
    invite_token_hash TEXT,
    invite_expires_at TIMESTAMPTZ,
    password_reset_otp_hash TEXT,
    password_reset_otp_expires_at TIMESTAMPTZ,
    password_reset_attempts INTEGER NOT NULL DEFAULT 0,
    avatar_url TEXT,
    avatar_public_id TEXT,
    legacy_mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_college_email UNIQUE (college_id, email),
    CONSTRAINT uq_users_college_id UNIQUE (college_id, id)
);
CREATE TRIGGER trg_users_updated_at BEFORE
UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_users_college_invite_hash ON users (college_id, invite_token_hash)
WHERE invite_token_hash IS NOT NULL;
CREATE INDEX idx_users_college_active ON users (college_id, is_active);
-- Departments
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    short_code TEXT NOT NULL,
    description TEXT,
    legacy_mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_departments_college_name UNIQUE (college_id, name),
    CONSTRAINT uq_departments_college_short_code UNIQUE (college_id, short_code),
    CONSTRAINT uq_departments_college_id UNIQUE (college_id, id)
);
CREATE TRIGGER trg_departments_updated_at BEFORE
UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- Clubs
CREATE TABLE clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    club_type club_type_enum NOT NULL DEFAULT 'DEPARTMENTAL',
    logo_url TEXT,
    logo_public_id TEXT,
    cover_image_url TEXT,
    cover_image_public_id TEXT,
    created_by_user_id UUID NOT NULL,
    legacy_mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_clubs_college_name UNIQUE (college_id, name),
    CONSTRAINT uq_clubs_college_id UNIQUE (college_id, id),
    CONSTRAINT fk_clubs_creator FOREIGN KEY (college_id, created_by_user_id) REFERENCES users(college_id, id) ON DELETE RESTRICT
);
CREATE TRIGGER trg_clubs_updated_at BEFORE
UPDATE ON clubs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_clubs_college_created ON clubs (college_id, created_at DESC);
CREATE INDEX idx_clubs_college_type ON clubs (college_id, club_type);
-- Club Departments (Many-to-Many link)
CREATE TABLE club_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    club_id UUID NOT NULL,
    department_id UUID NOT NULL,
    legacy_mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_club_departments_pair UNIQUE (club_id, department_id),
    CONSTRAINT uq_club_departments_college_id UNIQUE (college_id, id),
    CONSTRAINT fk_club_departments_club FOREIGN KEY (college_id, club_id) REFERENCES clubs(college_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_club_departments_dept FOREIGN KEY (college_id, department_id) REFERENCES departments(college_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_club_departments_college_dept ON club_departments (college_id, department_id);
-- Enforce: Central clubs cannot have club_departments links
CREATE OR REPLACE FUNCTION check_central_club_links() RETURNS TRIGGER AS $$
DECLARE v_club_type club_type_enum;
BEGIN
SELECT club_type INTO v_club_type
FROM clubs
WHERE id = NEW.club_id;
IF v_club_type = 'CENTRAL' THEN RAISE EXCEPTION 'Central clubs cannot be linked to departments (club_id: %)',
NEW.club_id USING ERRCODE = 'check_violation';
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_check_central_club_links BEFORE
INSERT
    OR
UPDATE ON club_departments FOR EACH ROW EXECUTE FUNCTION check_central_club_links();
-- Enforce: Club cannot be switched to CENTRAL if links exist
CREATE OR REPLACE FUNCTION check_club_type_update() RETURNS TRIGGER AS $$ BEGIN IF NEW.club_type = 'CENTRAL'
    AND OLD.club_type != 'CENTRAL' THEN IF EXISTS (
        SELECT 1
        FROM club_departments
        WHERE club_id = NEW.id
    ) THEN RAISE EXCEPTION 'Cannot change club % to CENTRAL while department links exist',
    NEW.id USING ERRCODE = 'check_violation';
END IF;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_check_club_type_update BEFORE
UPDATE OF club_type ON clubs FOR EACH ROW EXECUTE FUNCTION check_club_type_update();
-- Memberships
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    club_id UUID NOT NULL,
    role membership_role_enum NOT NULL DEFAULT 'MEMBER',
    legacy_mongo_id TEXT UNIQUE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_memberships_user_club UNIQUE (user_id, club_id),
    CONSTRAINT uq_memberships_college_id UNIQUE (college_id, id),
    CONSTRAINT fk_memberships_user FOREIGN KEY (college_id, user_id) REFERENCES users(college_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_memberships_club FOREIGN KEY (college_id, club_id) REFERENCES clubs(college_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_memberships_college_club_role ON memberships (college_id, club_id, role);
CREATE INDEX idx_memberships_college_user ON memberships (college_id, user_id);
-- Events
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    club_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    capacity INTEGER CHECK (
        capacity IS NULL
        OR capacity > 0
    ),
    registered_count INTEGER NOT NULL DEFAULT 0 CHECK (registered_count >= 0),
    cover_image_url TEXT,
    cover_image_public_id TEXT,
    registration_url TEXT,
    legacy_mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_events_college_id UNIQUE (college_id, id),
    CONSTRAINT chk_events_date_range CHECK (
        end_at IS NULL
        OR end_at > start_at
    ),
    CONSTRAINT chk_events_capacity_limit CHECK (
        capacity IS NULL
        OR registered_count <= capacity
    ),
    CONSTRAINT fk_events_club FOREIGN KEY (college_id, club_id) REFERENCES clubs(college_id, id) ON DELETE CASCADE
);
CREATE TRIGGER trg_events_updated_at BEFORE
UPDATE ON events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_events_college_start_at ON events (college_id, start_at ASC);
CREATE INDEX idx_events_college_club_start ON events (college_id, club_id, start_at DESC);
CREATE INDEX idx_events_college_cancelled ON events (college_id, cancelled_at)
WHERE cancelled_at IS NOT NULL;
-- Event Gallery Images
CREATE TABLE event_gallery_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    event_id UUID NOT NULL,
    image_url TEXT NOT NULL,
    image_public_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_event_gallery_event_public_id UNIQUE (event_id, image_public_id),
    CONSTRAINT fk_event_gallery_event FOREIGN KEY (college_id, event_id) REFERENCES events(college_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_event_gallery_college_event_pos ON event_gallery_images (college_id, event_id, position ASC);
-- Event Registrations
CREATE TABLE event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    event_id UUID NOT NULL,
    user_id UUID NOT NULL,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_event_registrations_user_event UNIQUE (user_id, event_id),
    CONSTRAINT fk_registrations_event FOREIGN KEY (college_id, event_id) REFERENCES events(college_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_registrations_user FOREIGN KEY (college_id, user_id) REFERENCES users(college_id, id) ON DELETE CASCADE
);
-- Restored index on (college_id, event_id)
CREATE INDEX idx_event_registrations_college_event ON event_registrations (college_id, event_id);
CREATE INDEX idx_event_registrations_college_user ON event_registrations (college_id, user_id);
-- Enforce: Atomically increment registered_count and raise exception when capacity is reached
CREATE OR REPLACE FUNCTION handle_registration_insert() RETURNS TRIGGER AS $$
DECLARE v_capacity INTEGER;
v_registered_count INTEGER;
BEGIN -- Lock the event row FOR UPDATE to serialize concurrent registration inserts
SELECT capacity,
    registered_count INTO v_capacity,
    v_registered_count
FROM events
WHERE id = NEW.event_id
    AND college_id = NEW.college_id FOR
UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Event % not found in college %',
NEW.event_id,
NEW.college_id USING ERRCODE = 'foreign_key_violation';
END IF;
IF v_capacity IS NOT NULL
AND v_registered_count >= v_capacity THEN RAISE EXCEPTION 'Event capacity reached (% / %)',
v_registered_count,
v_capacity USING ERRCODE = 'check_violation';
END IF;
UPDATE events
SET registered_count = registered_count + 1
WHERE id = NEW.event_id;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_handle_registration_insert BEFORE
INSERT ON event_registrations FOR EACH ROW EXECUTE FUNCTION handle_registration_insert();
-- Enforce: Keep registered_count synchronized when registrations are deleted or moved
CREATE OR REPLACE FUNCTION maintain_event_registration_count() RETURNS TRIGGER AS $$ BEGIN IF TG_OP = 'DELETE' THEN
UPDATE events
SET registered_count = GREATEST(0, registered_count - 1)
WHERE id = OLD.event_id;
RETURN OLD;
ELSIF TG_OP = 'UPDATE'
AND OLD.event_id != NEW.event_id THEN
UPDATE events
SET registered_count = GREATEST(0, registered_count - 1)
WHERE id = OLD.event_id;
UPDATE events
SET registered_count = registered_count + 1
WHERE id = NEW.event_id;
RETURN NEW;
END IF;
RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_maintain_event_registration_count
AFTER DELETE
    OR
UPDATE OF event_id ON event_registrations FOR EACH ROW EXECUTE FUNCTION maintain_event_registration_count();
-- Deletion Verifications
CREATE TABLE deletion_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL,
    target_type deletion_target_enum NOT NULL,
    target_id UUID NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_del_verif_admin FOREIGN KEY (college_id, admin_id) REFERENCES users(college_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_del_verif_lookup ON deletion_verifications (
    college_id,
    admin_id,
    target_type,
    target_id,
    consumed
)
WHERE consumed = false;
-- Enforce: Target belongs to the exact same college
CREATE OR REPLACE FUNCTION check_deletion_verification_target() RETURNS TRIGGER AS $$ BEGIN IF NEW.target_type = 'USER' THEN IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE id = NEW.target_id
            AND college_id = NEW.college_id
    ) THEN RAISE EXCEPTION 'Target user % does not exist in college %',
    NEW.target_id,
    NEW.college_id USING ERRCODE = 'foreign_key_violation';
END IF;
ELSIF NEW.target_type = 'CLUB' THEN IF NOT EXISTS (
    SELECT 1
    FROM clubs
    WHERE id = NEW.target_id
        AND college_id = NEW.college_id
) THEN RAISE EXCEPTION 'Target club % does not exist in college %',
NEW.target_id,
NEW.college_id USING ERRCODE = 'foreign_key_violation';
END IF;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_check_deletion_verification_target BEFORE
INSERT
    OR
UPDATE ON deletion_verifications FOR EACH ROW EXECUTE FUNCTION check_deletion_verification_target();
-- ============================================================================
-- 3. DERIVED STATUS VIEW (Security Invoker)
-- ============================================================================
CREATE OR REPLACE VIEW events_with_status WITH (security_invoker = true) AS
SELECT e.id,
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
        WHEN e.cancelled_at IS NOT NULL THEN 'CANCELLED'
        WHEN now() < e.start_at THEN 'UPCOMING'
        WHEN e.end_at IS NOT NULL THEN CASE
            WHEN now() < e.end_at THEN 'ONGOING'
            ELSE 'COMPLETED'
        END
        ELSE -- end_at IS NULL (end-less event: 24-hour fallback)
        CASE
            WHEN e.start_at < (now() - INTERVAL '24 hours') THEN 'COMPLETED'
            ELSE 'ONGOING'
        END
    END AS status
FROM events e;
-- ============================================================================
-- 002_rls.sql
-- Multi-tenant Row-Level Security (RLS) & Role Privileges
-- Run as: migrator (schema owner)
-- ============================================================================
-- Schema usage
GRANT USAGE ON SCHEMA public TO app_user,
    platform_ops;
-- Table permissions for app_user (runtime API pool)
GRANT SELECT ON colleges TO app_user;
GRANT SELECT ON events_with_status TO app_user;
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON users,
    departments,
    clubs,
    club_departments,
    memberships,
    events,
    event_gallery_images,
    event_registrations,
    deletion_verifications TO app_user;
-- Sequence permissions
GRANT USAGE,
    SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- Explicitly block app_user from platform_admins
REVOKE ALL ON platform_admins
FROM app_user;
-- Platform ops permissions (super-admin, BYPASSRLS)
GRANT ALL ON ALL TABLES IN SCHEMA public TO platform_ops;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO platform_ops;
-- Default privileges for future objects created by migrator
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE,
    SELECT ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO platform_ops;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
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
CREATE POLICY tenant_isolation_users ON users FOR ALL TO app_user USING (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
) WITH CHECK (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
);
-- 2. departments
CREATE POLICY tenant_isolation_departments ON departments FOR ALL TO app_user USING (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
) WITH CHECK (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
);
-- 3. clubs
CREATE POLICY tenant_isolation_clubs ON clubs FOR ALL TO app_user USING (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
) WITH CHECK (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
);
-- 4. club_departments
CREATE POLICY tenant_isolation_club_departments ON club_departments FOR ALL TO app_user USING (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
) WITH CHECK (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
);
-- 5. memberships
CREATE POLICY tenant_isolation_memberships ON memberships FOR ALL TO app_user USING (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
) WITH CHECK (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
);
-- 6. events
CREATE POLICY tenant_isolation_events ON events FOR ALL TO app_user USING (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
) WITH CHECK (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
);
-- 7. event_gallery_images
CREATE POLICY tenant_isolation_event_gallery_images ON event_gallery_images FOR ALL TO app_user USING (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
) WITH CHECK (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
);
-- 8. event_registrations
CREATE POLICY tenant_isolation_event_registrations ON event_registrations FOR ALL TO app_user USING (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
) WITH CHECK (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
);
-- 9. deletion_verifications
CREATE POLICY tenant_isolation_deletion_verifications ON deletion_verifications FOR ALL TO app_user USING (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
) WITH CHECK (
    college_id = (
        SELECT NULLIF(current_setting('app.college_id', true), '')::uuid
    )
);
-- Universal Grants for neon/local roles
GRANT ALL ON SCHEMA public TO app_user,
    platform_ops;
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user,
    platform_ops;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_user,
    platform_ops;
REVOKE ALL ON platform_admins
FROM app_user;
-- ============================================================================
-- seed_test_data.sql
-- Run as: platform_ops (or superuser)
-- ============================================================================
-- Database name safety guard
DO $$ BEGIN IF current_database() NOT LIKE '%test%'
AND current_database() NOT LIKE '%yuva_db%' THEN RAISE EXCEPTION 'Safety guard: refusing to seed test data into non-test database "%"',
current_database() USING ERRCODE = 'check_violation';
END IF;
END $$;
DO $$
DECLARE v_col_a UUID;
v_col_b UUID;
v_user_a UUID;
v_user_b UUID;
v_dept_a UUID;
v_dept_b UUID;
v_club_a UUID;
v_club_b UUID;
v_event_a UUID;
v_event_b UUID;
BEGIN -- Clean existing test rows if any
DELETE FROM deletion_verifications;
DELETE FROM event_registrations;
DELETE FROM event_gallery_images;
DELETE FROM events;
DELETE FROM memberships;
DELETE FROM club_departments;
DELETE FROM clubs;
DELETE FROM departments;
DELETE FROM users;
DELETE FROM colleges
WHERE slug IN ('lbrce', 'vrsec');
-- 1. Colleges
INSERT INTO colleges (name, slug)
VALUES ('LBRCE College', 'lbrce')
RETURNING id INTO v_col_a;
INSERT INTO colleges (name, slug)
VALUES ('VRSEC College', 'vrsec')
RETURNING id INTO v_col_b;
-- 2. Users
INSERT INTO users (college_id, name, email, role, is_active)
VALUES (
        v_col_a,
        'Admin A',
        'admin@lbrce.in',
        'COLLEGE_ADMIN',
        true
    )
RETURNING id INTO v_user_a;
INSERT INTO users (college_id, name, email, role, is_active)
VALUES (
        v_col_b,
        'Admin B',
        'admin@vrsec.in',
        'COLLEGE_ADMIN',
        true
    )
RETURNING id INTO v_user_b;
-- 3. Departments
INSERT INTO departments (college_id, name, short_code)
VALUES (v_col_a, 'Computer Science', 'CSE')
RETURNING id INTO v_dept_a;
INSERT INTO departments (college_id, name, short_code)
VALUES (v_col_b, 'Information Technology', 'IT')
RETURNING id INTO v_dept_b;
-- 4. Clubs
INSERT INTO clubs (college_id, name, club_type, created_by_user_id)
VALUES (v_col_a, 'Coding Club', 'DEPARTMENTAL', v_user_a)
RETURNING id INTO v_club_a;
INSERT INTO clubs (college_id, name, club_type, created_by_user_id)
VALUES (
        v_col_b,
        'Robotics Club',
        'DEPARTMENTAL',
        v_user_b
    )
RETURNING id INTO v_club_b;
-- 5. Club Departments
INSERT INTO club_departments (college_id, club_id, department_id)
VALUES (v_col_a, v_club_a, v_dept_a);
INSERT INTO club_departments (college_id, club_id, department_id)
VALUES (v_col_b, v_club_b, v_dept_b);
-- 6. Memberships
INSERT INTO memberships (college_id, user_id, club_id, role)
VALUES (v_col_a, v_user_a, v_club_a, 'MANAGER');
INSERT INTO memberships (college_id, user_id, club_id, role)
VALUES (v_col_b, v_user_b, v_club_b, 'MANAGER');
-- 7. Events (capacity 100 on A, capacity 2 on B for capacity testing)
INSERT INTO events (
        college_id,
        club_id,
        title,
        description,
        location,
        start_at,
        capacity
    )
VALUES (
        v_col_a,
        v_club_a,
        'Hackathon 2026',
        'Code all night',
        'Lab 1',
        now() + INTERVAL '1 day',
        100
    )
RETURNING id INTO v_event_a;
INSERT INTO events (
        college_id,
        club_id,
        title,
        description,
        location,
        start_at,
        capacity
    )
VALUES (
        v_col_b,
        v_club_b,
        'RoboWars 2026',
        'Bot battles',
        'Arena',
        now() + INTERVAL '2 days',
        2
    )
RETURNING id INTO v_event_b;
-- 8. Event Gallery
INSERT INTO event_gallery_images (
        college_id,
        event_id,
        image_url,
        image_public_id,
        position
    )
VALUES (
        v_col_a,
        v_event_a,
        'https://res.cloudinary.com/demo/image/upload/hack1.jpg',
        'hack1_pub',
        0
    );
INSERT INTO event_gallery_images (
        college_id,
        event_id,
        image_url,
        image_public_id,
        position
    )
VALUES (
        v_col_b,
        v_event_b,
        'https://res.cloudinary.com/demo/image/upload/robo1.jpg',
        'robo1_pub',
        0
    );
-- 9. Event Registrations (1 registration on Event A)
INSERT INTO event_registrations (college_id, event_id, user_id)
VALUES (v_col_a, v_event_a, v_user_a);
-- 10. Deletion Verifications
INSERT INTO deletion_verifications (
        college_id,
        admin_id,
        target_type,
        target_id,
        code_hash,
        expires_at
    )
VALUES (
        v_col_a,
        v_user_a,
        'USER',
        v_user_a,
        'hash_abc',
        now() + INTERVAL '10 minutes'
    );
INSERT INTO deletion_verifications (
        college_id,
        admin_id,
        target_type,
        target_id,
        code_hash,
        expires_at
    )
VALUES (
        v_col_b,
        v_user_b,
        'USER',
        v_user_b,
        'hash_xyz',
        now() + INTERVAL '10 minutes'
    );
END $$;