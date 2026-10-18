-- ==============================================================================
-- SICA Database Migration 0006: RBAC per-tenant (member_role) utk alur login
-- Menegakkan `AuthUserRoleSchema` (@sica/contracts) pada tenant_memberships.role.
-- Expand-only, idempoten. (DATA_MODEL §12/SECURITY §3)
-- ==============================================================================

SET lock_timeout = '10s';

DO $$ BEGIN
  CREATE TYPE member_role AS ENUM ('super_admin','tenant_admin','dosen','mahasiswa','staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE tenant_memberships
  ADD COLUMN IF NOT EXISTS role member_role NOT NULL DEFAULT 'mahasiswa';

CREATE INDEX IF NOT EXISTS idx_memberships_tenant_role ON tenant_memberships(tenant_id, role);
