-- ==============================================================================
-- SICA Database Migration 0001: Initialization & Multi-Tenant Row-Level Security
-- Architecture: PostgreSQL 16 Single Schema Multi-Tenant with RLS Enforcement
-- ==============================================================================

-- 1. PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- 2. Schema App & Helper Functions
CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_tenant', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- 3. PostgreSQL Enums
DO $$ BEGIN
  CREATE TYPE tenant_status AS ENUM ('ONBOARDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE member_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'LEFT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4. Tabel Tenants & Subscriptions
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  legal_name text NOT NULL,
  status tenant_status NOT NULL DEFAULT 'ONBOARDING',
  timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  taxonomy text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_domains (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hostname citext NOT NULL UNIQUE,
  is_primary boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  CONSTRAINT uq_tenant_domains_host UNIQUE (tenant_id, hostname)
);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant ON tenant_domains(tenant_id);

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  max_active_students int,
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_rupiah_month bigint NOT NULL CHECK (price_rupiah_month >= 0),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id),
  status subscription_status NOT NULL DEFAULT 'TRIAL',
  seats_student int NOT NULL DEFAULT 0,
  billing_anchor date NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);

CREATE TABLE IF NOT EXISTS tenant_quotas (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  max_concurrent_ow_requests int NOT NULL DEFAULT 300,
  max_api_rps int NOT NULL DEFAULT 50,
  max_storage_mb bigint NOT NULL DEFAULT 204800,
  max_export_rows int NOT NULL DEFAULT 100000,
  max_batch_invoice_rows int NOT NULL DEFAULT 20000
);

CREATE TABLE IF NOT EXISTS tenant_usage (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bucket_month date NOT NULL,
  active_students int NOT NULL DEFAULT 0,
  api_calls bigint NOT NULL DEFAULT 0,
  storage_bytes bigint NOT NULL DEFAULT 0,
  jobs_run bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, bucket_month)
);

-- 5. Tabel Identitas Global & Autentikasi
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email citext NOT NULL UNIQUE,
  phone text,
  full_name text NOT NULL,
  password_hash text,
  password_updated_at timestamptz,
  mfa_required boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LOCKED', 'DISABLED')),
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_history (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pw_hist ON password_history(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_code text,
  status member_status NOT NULL DEFAULT 'PENDING',
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  CONSTRAINT uq_memberships_tenant_user UNIQUE (tenant_id, user_id),
  CONSTRAINT uq_memberships_tenant_code UNIQUE (tenant_id, member_code)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON tenant_memberships(tenant_id);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_ctx jsonb NOT NULL DEFAULT '{}'::jsonb,
  auth_method text NOT NULL,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_reason text
);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant_user_active ON sessions(tenant_id, user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  family_id uuid NOT NULL,
  rotated_from uuid REFERENCES refresh_tokens(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_refresh_family ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tenant ON refresh_tokens(tenant_id);

CREATE TABLE IF NOT EXISTS mfa_factors (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  factor_type text NOT NULL,
  secret text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mfa_factors_user ON mfa_factors(user_id);

-- 6. Setup Database Roles
--    Toleran untuk managed Postgres/Supabase: `postgres` non-superuser tidak bisa
--    CREATE ROLE → error `insufficient_privilege` (SQLSTATE 42501), BUKAN duplicate_object.
--    Kita tangkap `others` agar migration tetap lanjut; runtime dev memakai role PEMILIK
--    tabel dengan FORCE RLS + `SET app.current_tenant` (keamanan setara — lihat §7 & ROADMAP §4.5).
--    Di self-hosted (superuser), role dibuat & di-grant normal.
DO $$ BEGIN
  CREATE ROLE sica_app WITH NOLOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER;
EXCEPTION WHEN others THEN RAISE NOTICE 'role sica_app dilewati: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE ROLE sica_owner WITH NOLOGIN BYPASSRLS;
EXCEPTION WHEN others THEN RAISE NOTICE 'role sica_owner dilewati: %', SQLERRM; END $$;

DO $$ BEGIN
  GRANT USAGE ON SCHEMA public TO sica_app;
  GRANT USAGE ON SCHEMA app TO sica_app;
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sica_app';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sica_app';
EXCEPTION WHEN others THEN RAISE NOTICE 'grant sica_app dilewati (managed DB): %', SQLERRM; END $$;

-- 7. Penegakan PostgreSQL Row-Level Security (RLS)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'tenant_domains',
    'subscriptions',
    'tenant_quotas',
    'tenant_usage',
    'tenant_memberships',
    'sessions',
    'refresh_tokens'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I;', t);
    EXECUTE format($pol$
      CREATE POLICY tenant_isolation ON public.%I
      AS PERMISSIVE FOR ALL
      TO public
      USING (tenant_id = app.tenant_id())
      WITH CHECK (tenant_id = app.tenant_id());
    $pol$, t);
  END LOOP;
END $$;
