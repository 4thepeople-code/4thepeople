-- ============================================================================
-- bootstrap_roles.sql
-- Run as database superuser / owner
-- Reads passwords from environment variables:
--   MIGRATOR_PASSWORD, APP_USER_PASSWORD, PLATFORM_OPS_PASSWORD
-- ============================================================================

\getenv MIGRATOR_PW MIGRATOR_PASSWORD
\getenv APP_USER_PW APP_USER_PASSWORD
\getenv PLATFORM_OPS_PW PLATFORM_OPS_PASSWORD

-- Required extensions (created by superuser)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Create roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'migrator') THEN
        CREATE ROLE migrator WITH LOGIN NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user WITH LOGIN NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'platform_ops') THEN
        CREATE ROLE platform_ops WITH LOGIN NOCREATEDB NOCREATEROLE BYPASSRLS;
    END IF;
END
$$;

-- Dynamically set passwords from env vars
SELECT format('ALTER ROLE migrator WITH PASSWORD %L;', :'MIGRATOR_PW') \gexec
SELECT format('ALTER ROLE app_user WITH PASSWORD %L;', :'APP_USER_PW') \gexec
SELECT format('ALTER ROLE platform_ops WITH PASSWORD %L;', :'PLATFORM_OPS_PW') \gexec

-- Grant schema ownership to migrator so migrations run as migrator
GRANT ALL ON SCHEMA public TO migrator;
ALTER SCHEMA public OWNER TO migrator;

