-- 0083_impersonation_grants.sql — dukungan terawasi & break-glass (FR-ADM-13, DoD R-1 §1.7)
-- Sumber kebenaran DDL: DATA_MODEL.md §26.12 (amandemen 2026-10-23: grant_kind + FK ditangguh).
-- Vonis RD-32: `platform_support_grants` KALAH sebagai tabel kedua — satu mekanisme, satu tabel,
-- pembeda `grant_kind`. Registry: MIGRATION_SOP §5.2 (dipindah dari `0029`; sah, belum dieksekusi).
-- Expand-only. Reversibel: DROP balik manual.
--
-- Pernyataan verifikasi (MIGRATION_SOP §5.4 butir 4):
--   SELECT relname FROM pg_class WHERE relname='impersonation_grants' AND relkind='r';      -- 1 baris
--   SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='imperson_state' ORDER BY enumsort_order;
--     -- REQUESTED,GRANTED,ACTIVE,ENDED,EXPIRED,REVOKED
--   SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='impersonation_grants'; -- t/t
--   INSERT tanpa reason >= 15 karakter → ERROR 23514; UPDATE audit trail grant ENDED → tetap append-only di `audit_logs`

BEGIN;

-- CREATE TYPE tidak mengenal IF NOT EXISTS → dibungkus agar replay tetap aman (SOP §5.4 butir 3).
DO $$ BEGIN
  CREATE TYPE imperson_state AS ENUM ('REQUESTED','GRANTED','ACTIVE','ENDED','EXPIRED','REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS impersonation_grants (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  grant_kind      text NOT NULL DEFAULT 'TENANT_IMPERSONATION'
                    CHECK (grant_kind IN ('PLATFORM_SUPPORT','TENANT_IMPERSONATION')),
  actor_user_id   uuid NOT NULL REFERENCES users(id),
  target_user_id  uuid NOT NULL REFERENCES users(id),
  reason          text NOT NULL CHECK (length(reason) >= 15),
  ticket_id       uuid,                       -- FK → helpdesk_tickets DITANGGUH sampai 0051 mendarat
  scope           text NOT NULL DEFAULT 'READ_ONLY'
                    CHECK (scope IN ('READ_ONLY','HELPDESK_REPAIR')),
  mfa_verified_at timestamptz NOT NULL,       -- FR-ADM-13: bukti MFA di KOLOM, bukan di alur aplikasi
  requested_at    timestamptz NOT NULL DEFAULT now(),
  granted_by      uuid REFERENCES users(id),
  granted_at      timestamptz,
  starts_at       timestamptz,
  expires_at      timestamptz NOT NULL,       -- TTL ≤ 30 menit (dienforce service + CHECK di bawah)
  ended_at        timestamptz,
  end_reason      text,
  state           imperson_state NOT NULL DEFAULT 'REQUESTED',
  last_seen_at    timestamptz,
  CHECK (actor_user_id <> target_user_id),                                   -- tidak ada "masuk sebagai diri sendiri"
  CHECK (expires_at > requested_at),
  CHECK (expires_at <= requested_at + interval '30 minutes'),                -- TTL maksimum 30 menit, di DB
  CHECK (state NOT IN ('GRANTED','ACTIVE') OR (granted_by IS NOT NULL AND granted_at IS NOT NULL)),
  CHECK (state <> 'ACTIVE' OR starts_at IS NOT NULL),
  CHECK (state <> 'ENDED' OR (ended_at IS NOT NULL AND end_reason IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_imperson_active
  ON impersonation_grants(tenant_id, state, expires_at)
  WHERE state IN ('GRANTED','ACTIVE');

ALTER TABLE impersonation_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE impersonation_grants FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON impersonation_grants;
CREATE POLICY tenant_isolation ON impersonation_grants AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id()) WITH CHECK (tenant_id = app.tenant_id());

COMMIT;
