-- ============================================================================
-- Migration 005: Public Event Discovery & Row-Level Security
-- ============================================================================
-- Objective: Enables platform-wide discovery of eligible public events across
-- active colleges while strictly preserving tenant isolation, row-level write
-- boundaries, and privacy of non-public tenant data.
--
-- Execution Role: migrator (DDL migration runner, owner of public schema & tables)
-- Target Role: app_user (application runtime role, rolbypassrls = false)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. EVENTS: Granular Row-Level Security Policies
-- ----------------------------------------------------------------------------
-- Replace monolithic tenant_isolation_events (cmd = ALL) with separate
-- SELECT, INSERT, UPDATE, DELETE policies.
-- SELECT: Allows tenant-scoped access OR unauthenticated public discovery
--         of eligible public events from active colleges.
-- INSERT, UPDATE, DELETE: Strictly restricted to the caller's tenant college.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS tenant_isolation_events ON public.events;
DROP POLICY IF EXISTS events_select_policy ON public.events;
DROP POLICY IF EXISTS events_insert_policy ON public.events;
DROP POLICY IF EXISTS events_update_policy ON public.events;
DROP POLICY IF EXISTS events_delete_policy ON public.events;

CREATE POLICY events_select_policy ON public.events
  FOR SELECT
  TO app_user
  USING (
    -- Tenant access: user can access all events within their own college
    (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid)
    OR
    -- Platform-wide public discovery: eligible public events only
    (
      visibility = 'PUBLIC'
      AND cancelled_at IS NULL
      AND registration_mode IN ('INTERNAL', 'EXTERNAL')
      AND (
        -- Lifecycle status UPCOMING or ONGOING
        (now() < start_at)
        OR (
          (end_at IS NOT NULL AND now() < end_at)
          OR (end_at IS NULL AND start_at >= (now() - interval '24 hours'))
        )
      )
      AND EXISTS (
        SELECT 1 FROM public.colleges c
        WHERE c.id = events.college_id
          AND c.is_active = true
      )
    )
  );

CREATE POLICY events_insert_policy ON public.events
  FOR INSERT
  TO app_user
  WITH CHECK (
    college_id = NULLIF(current_setting('app.college_id', true), '')::uuid
  );

CREATE POLICY events_update_policy ON public.events
  FOR UPDATE
  TO app_user
  USING (
    college_id = NULLIF(current_setting('app.college_id', true), '')::uuid
  )
  WITH CHECK (
    college_id = NULLIF(current_setting('app.college_id', true), '')::uuid
  );

CREATE POLICY events_delete_policy ON public.events
  FOR DELETE
  TO app_user
  USING (
    college_id = NULLIF(current_setting('app.college_id', true), '')::uuid
  );

-- Partial composite index for optimized public event discovery queries
CREATE INDEX IF NOT EXISTS idx_events_public_discovery 
  ON public.events (visibility, start_at) 
  WHERE (visibility = 'PUBLIC' AND cancelled_at IS NULL);

-- ----------------------------------------------------------------------------
-- 2. CLUBS: Granular Row-Level Security Policies
-- ----------------------------------------------------------------------------
-- Replace monolithic tenant_isolation_clubs with separate granular policies.
-- SELECT: Allows tenant access OR reading the organizer club of an eligible
--         public event.
-- INSERT, UPDATE, DELETE: Strictly restricted to the caller's tenant college.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS tenant_isolation_clubs ON public.clubs;
DROP POLICY IF EXISTS clubs_select_policy ON public.clubs;
DROP POLICY IF EXISTS clubs_insert_policy ON public.clubs;
DROP POLICY IF EXISTS clubs_update_policy ON public.clubs;
DROP POLICY IF EXISTS clubs_delete_policy ON public.clubs;

CREATE POLICY clubs_select_policy ON public.clubs
  FOR SELECT
  TO app_user
  USING (
    -- Tenant access: user can access all clubs within their own college
    (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid)
    OR
    -- Public discovery: club organizes an eligible public event
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.colleges c ON c.id = e.college_id
      WHERE e.club_id = clubs.id
        AND e.college_id = clubs.college_id
        AND e.visibility = 'PUBLIC'
        AND e.cancelled_at IS NULL
        AND e.registration_mode IN ('INTERNAL', 'EXTERNAL')
        AND (
          (now() < e.start_at)
          OR (
            (e.end_at IS NOT NULL AND now() < e.end_at)
            OR (e.end_at IS NULL AND e.start_at >= (now() - interval '24 hours'))
          )
        )
        AND c.is_active = true
    )
  );

CREATE POLICY clubs_insert_policy ON public.clubs
  FOR INSERT
  TO app_user
  WITH CHECK (
    college_id = NULLIF(current_setting('app.college_id', true), '')::uuid
  );

CREATE POLICY clubs_update_policy ON public.clubs
  FOR UPDATE
  TO app_user
  USING (
    college_id = NULLIF(current_setting('app.college_id', true), '')::uuid
  )
  WITH CHECK (
    college_id = NULLIF(current_setting('app.college_id', true), '')::uuid
  );

CREATE POLICY clubs_delete_policy ON public.clubs
  FOR DELETE
  TO app_user
  USING (
    college_id = NULLIF(current_setting('app.college_id', true), '')::uuid
  );

-- ----------------------------------------------------------------------------
-- 3. EVENT GALLERY IMAGES: Granular Row-Level Security Policies
-- ----------------------------------------------------------------------------
-- Replace monolithic tenant_isolation_event_gallery_images with separate
-- granular policies to allow displaying gallery images on public event detail.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS tenant_isolation_event_gallery_images ON public.event_gallery_images;
DROP POLICY IF EXISTS event_gallery_images_select_policy ON public.event_gallery_images;
DROP POLICY IF EXISTS event_gallery_images_insert_policy ON public.event_gallery_images;
DROP POLICY IF EXISTS event_gallery_images_update_policy ON public.event_gallery_images;
DROP POLICY IF EXISTS event_gallery_images_delete_policy ON public.event_gallery_images;

CREATE POLICY event_gallery_images_select_policy ON public.event_gallery_images
  FOR SELECT
  TO app_user
  USING (
    (college_id = NULLIF(current_setting('app.college_id', true), '')::uuid)
    OR
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.colleges c ON c.id = e.college_id
      WHERE e.id = event_gallery_images.event_id
        AND e.college_id = event_gallery_images.college_id
        AND e.visibility = 'PUBLIC'
        AND e.cancelled_at IS NULL
        AND e.registration_mode IN ('INTERNAL', 'EXTERNAL')
        AND (
          (now() < e.start_at)
          OR (
            (e.end_at IS NOT NULL AND now() < e.end_at)
            OR (e.end_at IS NULL AND e.start_at >= (now() - interval '24 hours'))
          )
        )
        AND c.is_active = true
    )
  );

CREATE POLICY event_gallery_images_insert_policy ON public.event_gallery_images
  FOR INSERT
  TO app_user
  WITH CHECK (
    college_id = NULLIF(current_setting('app.college_id', true), '')::uuid
  );

CREATE POLICY event_gallery_images_update_policy ON public.event_gallery_images
  FOR UPDATE
  TO app_user
  USING (
    college_id = NULLIF(current_setting('app.college_id', true), '')::uuid
  )
  WITH CHECK (
    college_id = NULLIF(current_setting('app.college_id', true), '')::uuid
  );

CREATE POLICY event_gallery_images_delete_policy ON public.event_gallery_images
  FOR DELETE
  TO app_user
  USING (
    college_id = NULLIF(current_setting('app.college_id', true), '')::uuid
  );

-- ----------------------------------------------------------------------------
-- 4. PRIVILEGE VERIFICATION & GRANTS
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_gallery_images TO app_user;

COMMIT;
