-- ==============================================================================
-- SICA Database Migration 0010: `tenant_settings` (pengaturan per-tenant, bukan per prodi/periode)
-- Rujukan: docs/DATA_MODEL.md §14.3.1; registry nomor MIGRATION_SOP §5.
--
-- Cakupan `0010` di registry juga menyebut `enrollment_schemes` (§14.3.2). Tabel itu
-- TIDAK ditulis di sini: pemilik layarnya adalah R-3a (BAAK), dan membuatnya sekarang
-- hanya akan menambah tabel tanpa pemanggil.
--
-- Verifikasi sesudah apply:
--   SELECT count(*) FROM pg_class WHERE relname='tenant_settings';                 -- 1
--   SELECT relname FROM pg_class c JOIN pg_policy p ON p.polrelid=c.oid
--    WHERE c.relname='tenant_settings';                                            -- tenant_isolation
--   SELECT nim_format::text FROM tenant_settings LIMIT 1;                          -- jsonb, bukan teks
-- ==============================================================================

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id             uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  locale                text NOT NULL DEFAULT 'id',
  timezone              text NOT NULL DEFAULT 'Asia/Jakarta',
  academic_calendar_style text NOT NULL DEFAULT 'SEMESTER',   -- SEMESTER | TRIWIDASAKI | QUARTER
  nim_format            jsonb NOT NULL DEFAULT '{}'::jsonb,
  document_numbering    jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_blocks      jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcript_policy     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- ejaan lama `transscript_policy` = typo (BENCH-118)
  attendance_ip_allowlist inet[] NOT NULL DEFAULT '{}',
  feature_flags         jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by            uuid,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (academic_calendar_style IN ('SEMESTER','TRIWIDASAKI','QUARTER'))
);

-- 1-tenant-1-baris: `tenant_id` adalah primary key sekaligus kunci isolasi.
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tenant_settings;
CREATE POLICY tenant_isolation ON tenant_settings
  AS PERMISSIVE FOR ALL
  TO public
  USING (tenant_id = app.tenant_id())
  WITH CHECK (tenant_id = app.tenant_id());
