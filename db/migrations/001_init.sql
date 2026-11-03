-- ============================================================================
-- 001_init.sql
-- Initial PostgreSQL schema for 4thepeople multi-tenant architecture
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Enums
CREATE TYPE club_type_enum AS ENUM ('CENTRAL', 'DEPARTMENTAL');
CREATE TYPE user_role_enum AS ENUM ('COLLEGE_ADMIN', 'USER');
CREATE TYPE membership_role_enum AS ENUM ('MANAGER', 'MEMBER');
CREATE TYPE deletion_target_enum AS ENUM ('USER', 'CLUB');

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
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
        slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 2 AND 63
    ),
    CONSTRAINT chk_colleges_slug_reserved CHECK (
        slug NOT IN ('www', 'api', 'admin', 'mail', 'app', 'static', 'assets', 'public', 'auth')
    )
);

CREATE TRIGGER trg_colleges_updated_at
BEFORE UPDATE ON colleges
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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

CREATE TRIGGER trg_platform_admins_updated_at
BEFORE UPDATE ON platform_admins
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_users_college_invite_hash 
    ON users (college_id, invite_token_hash) 
    WHERE invite_token_hash IS NOT NULL;
CREATE INDEX idx_users_college_active 
    ON users (college_id, is_active);

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

CREATE TRIGGER trg_departments_updated_at
BEFORE UPDATE ON departments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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
    CONSTRAINT fk_clubs_creator FOREIGN KEY (college_id, created_by_user_id)
        REFERENCES users(college_id, id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_clubs_updated_at
BEFORE UPDATE ON clubs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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
    CONSTRAINT fk_club_departments_club FOREIGN KEY (college_id, club_id)
        REFERENCES clubs(college_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_club_departments_dept FOREIGN KEY (college_id, department_id)
        REFERENCES departments(college_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_club_departments_college_dept ON club_departments (college_id, department_id);

-- Enforce: Central clubs cannot have club_departments links
CREATE OR REPLACE FUNCTION check_central_club_links()
RETURNS TRIGGER AS $$
DECLARE
    v_club_type club_type_enum;
BEGIN
    SELECT club_type INTO v_club_type FROM clubs WHERE id = NEW.club_id;
    IF v_club_type = 'CENTRAL' THEN
        RAISE EXCEPTION 'Central clubs cannot be linked to departments (club_id: %)', NEW.club_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_central_club_links
BEFORE INSERT OR UPDATE ON club_departments
FOR EACH ROW EXECUTE FUNCTION check_central_club_links();

-- Enforce: Club cannot be switched to CENTRAL if links exist
CREATE OR REPLACE FUNCTION check_club_type_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.club_type = 'CENTRAL' AND OLD.club_type != 'CENTRAL' THEN
        IF EXISTS (SELECT 1 FROM club_departments WHERE club_id = NEW.id) THEN
            RAISE EXCEPTION 'Cannot change club % to CENTRAL while department links exist', NEW.id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_club_type_update
BEFORE UPDATE OF club_type ON clubs
FOR EACH ROW EXECUTE FUNCTION check_club_type_update();

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
    CONSTRAINT fk_memberships_user FOREIGN KEY (college_id, user_id)
        REFERENCES users(college_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_memberships_club FOREIGN KEY (college_id, club_id)
        REFERENCES clubs(college_id, id) ON DELETE CASCADE
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
    capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
    registered_count INTEGER NOT NULL DEFAULT 0 CHECK (registered_count >= 0),
    cover_image_url TEXT,
    cover_image_public_id TEXT,
    registration_url TEXT,
    legacy_mongo_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_events_college_id UNIQUE (college_id, id),
    CONSTRAINT chk_events_date_range CHECK (end_at IS NULL OR end_at > start_at),
    CONSTRAINT chk_events_capacity_limit CHECK (capacity IS NULL OR registered_count <= capacity),
    CONSTRAINT fk_events_club FOREIGN KEY (college_id, club_id)
        REFERENCES clubs(college_id, id) ON DELETE CASCADE
);

CREATE TRIGGER trg_events_updated_at
BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_events_college_start_at ON events (college_id, start_at ASC);
CREATE INDEX idx_events_college_club_start ON events (college_id, club_id, start_at DESC);
CREATE INDEX idx_events_college_cancelled ON events (college_id, cancelled_at) WHERE cancelled_at IS NOT NULL;

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
    CONSTRAINT fk_event_gallery_event FOREIGN KEY (college_id, event_id)
        REFERENCES events(college_id, id) ON DELETE CASCADE
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
    CONSTRAINT fk_registrations_event FOREIGN KEY (college_id, event_id)
        REFERENCES events(college_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_registrations_user FOREIGN KEY (college_id, user_id)
        REFERENCES users(college_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_event_registrations_college_user ON event_registrations (college_id, user_id);

-- Enforce: Keep registered_count synchronized when registrations are deleted or moved
CREATE OR REPLACE FUNCTION maintain_event_registration_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE events 
        SET registered_count = GREATEST(0, registered_count - 1)
        WHERE id = OLD.event_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' AND OLD.event_id != NEW.event_id THEN
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
AFTER DELETE OR UPDATE OF event_id ON event_registrations
FOR EACH ROW EXECUTE FUNCTION maintain_event_registration_count();

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

    CONSTRAINT fk_del_verif_admin FOREIGN KEY (college_id, admin_id)
        REFERENCES users(college_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_del_verif_lookup ON deletion_verifications (
    college_id, admin_id, target_type, target_id, consumed
) WHERE consumed = false;

-- Enforce: Target belongs to the exact same college
CREATE OR REPLACE FUNCTION check_deletion_verification_target()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.target_type = 'USER' THEN
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.target_id AND college_id = NEW.college_id) THEN
            RAISE EXCEPTION 'Target user % does not exist in college %', NEW.target_id, NEW.college_id
                USING ERRCODE = 'foreign_key_violation';
        END IF;
    ELSIF NEW.target_type = 'CLUB' THEN
        IF NOT EXISTS (SELECT 1 FROM clubs WHERE id = NEW.target_id AND college_id = NEW.college_id) THEN
            RAISE EXCEPTION 'Target club % does not exist in college %', NEW.target_id, NEW.college_id
                USING ERRCODE = 'foreign_key_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_deletion_verification_target
BEFORE INSERT OR UPDATE ON deletion_verifications
FOR EACH ROW EXECUTE FUNCTION check_deletion_verification_target();

-- ============================================================================
-- 3. DERIVED STATUS VIEW (Security Invoker)
-- ============================================================================

CREATE OR REPLACE VIEW events_with_status
WITH (security_invoker = true) AS
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
        WHEN e.cancelled_at IS NOT NULL THEN 'CANCELLED'
        WHEN now() < e.start_at THEN 'UPCOMING'
        WHEN e.end_at IS NOT NULL THEN
            CASE
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
