-- ============================================================================
-- Migration 003: Add persistent failed-attempt tracking to deletion_verifications
-- ============================================================================

ALTER TABLE deletion_verifications
    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5;

