-- ==============================================================================
-- SICA Database Migration 0088: Penahan empat-mata nilai parameter + riwayat hanya-tambah
-- Rujukan: docs/DATA_MODEL.md §21.2.1 (DDL & empat keputusan), §21.1 penutup (plafon keamanan
--          sebagai CHECK), API_SPEC §4.16.2/§4.16.3 (`approvalId`, GET antrean),
--          ROADMAP §2.17 `SPE-1` butir (c) + `SPE-5` butir (a), AGENTS §3.10/§3.11.
--
-- Tiga hal yang dikerjakan berkas ini, semuanya temuan pengukuran — bukan perluasan gaya:
--   1. `master_system_parameter_approvals` LAHIR. §4.16.2/§4.16.3 sudah menjawab dengan
--      `approvalId` sejak 2026-10-20, tetapi tidak ada satu pun objek yang menampung draf:
--      satu-satunya tempat menyimpan angka yang belum disetujui adalah `parameter_value`
--      baris itu sendiri — yang justru dilarang norma (`AC-PG-1`). Rute tidak ditulis
--      sebelum objeknya punya pemilik & nomor (AGENTS §3.11).
--   2. Riwayat menjadi hanya-tambah NYATA. Terukur sebelum siklus ini:
--      has_table_privilege('sica_app','master_system_parameter_history','UPDATE') = true dan
--      tidak ada pemicu. `0048` mengklaim hal yang sama untuk `custom_attribute_history`
--      di judulnya tanpa pernah memasang pemicunya; kedua tabel ditutup di sini karena
--      `0048`/`0049` sudah diterapkan dan tidak boleh disunting (MIGRATION_SOP §5).
--   3. Dua aturan yang selama ini hanya berupa komentar menjadi CHECK: kosakata `module_code`
--      (§21.2 menulis delapan nilai tanpa constraint) dan plafon `SECURITY`
--      (rotasi TOTP 5/10/15, window 0/1/2 — §21.1 penutup menuntutnya di DB, bukan transport saja).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS master_system_parameter_approvals (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parameter_id uuid NOT NULL REFERENCES master_system_parameters(id) ON DELETE CASCADE,
  -- Proyeksi identitas pada saat kejadian (bukan salinan nilai): approval & riwayat harus
  -- tetap terbaca walaupun kuncinya berganti modul atau tenant dibersihkan.
  parameter_key text NOT NULL,
  module_code text NOT NULL,
  state text NOT NULL DEFAULT 'PENDING'
    CHECK (state IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  proposed_value text NOT NULL,
  previous_value text NOT NULL,
  proposed_applies_to jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_version int NOT NULL CHECK (previous_version > 0),
  effective_from date,
  effective_to date,
  reason text NOT NULL,
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approver_id uuid,
  decided_at timestamptz,
  decision_reason text,
  ip inet NOT NULL,
  source text NOT NULL DEFAULT 'UI' CHECK (source IN ('UI','API','IMPORT','MIGRATION','SEED')),
  applied_history_id uuid,
  CONSTRAINT ck_param_approval_foureyes
    CHECK (state <> 'APPROVED' OR (approver_id IS NOT NULL AND approver_id <> requested_by)),
  CONSTRAINT ck_param_approval_terminal
    CHECK (state = 'PENDING' OR decided_at IS NOT NULL),
  CONSTRAINT ck_param_approval_reject_reason
    CHECK (state <> 'REJECTED' OR char_length(coalesce(decision_reason, '')) >= 10),
  CONSTRAINT ck_param_approval_reason
    CHECK (char_length(reason) BETWEEN 10 AND 500),
  CONSTRAINT ck_param_approval_window
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from),
  -- Plafon keamanan berlaku juga atas DRAF: nilai yang pasti ditolak tidak boleh masuk
  -- antrean persetujuan (SPE-4 penjaga 2–4 berlaku sebelum approval dibuat).
  CONSTRAINT ck_param_approval_security_floor CHECK (
    (parameter_key <> 'attendance.totp_rotate_seconds' OR proposed_value IN ('5','10','15'))
    AND (parameter_key <> 'attendance.totp_window_steps' OR proposed_value IN ('0','1','2'))
  )
);

CREATE INDEX IF NOT EXISTS idx_param_approval_lookup
  ON master_system_parameter_approvals(tenant_id, state, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_param_approval_key
  ON master_system_parameter_approvals(tenant_id, parameter_key, requested_at DESC);

-- Satu draf per kunci: dua PENDING untuk kunci sama = dua angka yang menunggu diterapkan
-- berurutan dan yang kedua menimpa yang pertama tanpa diff terlihat (pola uq_acr_pending_scope).
CREATE UNIQUE INDEX IF NOT EXISTS uq_param_approval_pending
  ON master_system_parameter_approvals(tenant_id, parameter_id)
  WHERE state = 'PENDING';

ALTER TABLE master_system_parameter_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_system_parameter_approvals FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON master_system_parameter_approvals;
CREATE POLICY tenant_isolation ON master_system_parameter_approvals
  AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id())
  WITH CHECK (tenant_id = app.tenant_id());

-- ----------------------------------------------------------------------------
-- (2) Riwayat hanya-tambah: dinding hak + dinding pemicu (pola 0012 `audit_immutable`)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only (% not permitted)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION app.reject_mutation() TO sica_app;
EXCEPTION WHEN others THEN RAISE NOTICE 'grant execute app.reject_mutation dilewati: %', SQLERRM; END $$;

DO $$ BEGIN
  REVOKE UPDATE, DELETE, TRUNCATE ON master_system_parameter_history FROM sica_app;
  GRANT  INSERT, SELECT           ON master_system_parameter_history TO sica_app;
EXCEPTION WHEN others THEN RAISE NOTICE 'grant master_system_parameter_history dilewati (managed DB): %', SQLERRM; END $$;
DO $$ BEGIN
  REVOKE UPDATE, DELETE, TRUNCATE ON custom_attribute_history FROM sica_app;
  GRANT  INSERT, SELECT           ON custom_attribute_history TO sica_app;
EXCEPTION WHEN others THEN RAISE NOTICE 'grant custom_attribute_history dilewati (managed DB): %', SQLERRM; END $$;

DROP TRIGGER IF EXISTS trg_sysparam_hist_immutable ON master_system_parameter_history;
CREATE TRIGGER trg_sysparam_hist_immutable BEFORE UPDATE OR DELETE ON master_system_parameter_history
  FOR EACH STATEMENT EXECUTE FUNCTION app.reject_mutation();

DROP TRIGGER IF EXISTS trg_ca_hist_immutable ON custom_attribute_history;
CREATE TRIGGER trg_ca_hist_immutable BEFORE UPDATE OR DELETE ON custom_attribute_history
  FOR EACH STATEMENT EXECUTE FUNCTION app.reject_mutation();

-- ----------------------------------------------------------------------------
-- (3) Registrasi kosakata + plafon keamanan pada master_system_parameters
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE master_system_parameters
    ADD CONSTRAINT ck_param_module_code
    CHECK (module_code IN
      ('attendance','krs','grading','feeder','finance','pmb','lms','platform',
       'conference','analytics','ai'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE master_system_parameters
    ADD CONSTRAINT ck_param_security_floor CHECK (
      (parameter_key <> 'attendance.totp_rotate_seconds' OR parameter_value IN ('5','10','15'))
      AND (parameter_key <> 'attendance.totp_window_steps' OR parameter_value IN ('0','1','2'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Idempoten terhadap `0086`: CHECK bentuk nilai sudah dipindah ke `ck_param_value_shape`
-- di sana; di sini hanya dipastikan tidak ada lagi constraint lama yang menolak semua baris.
DO $$ BEGIN
  ALTER TABLE master_system_parameters
    DROP CONSTRAINT IF EXISTS master_system_parameters_parameter_value_check;
EXCEPTION WHEN others THEN RAISE NOTICE 'constraint lama tidak ada: %', SQLERRM; END $$;

-- ==============================================================================
-- Verifikasi sesudah apply (dijalankan `pnpm --filter @sica/database db:test:rls`):
--   SELECT count(*) FROM pg_class WHERE relname='master_system_parameter_approvals';   -- 1
--   SELECT count(*) FROM pg_constraint WHERE conname IN
--     ('ck_param_approval_foureyes','ck_param_approval_terminal',
--      'ck_param_approval_reject_reason','ck_param_security_floor','ck_param_module_code');  -- 5
--   UPDATE master_system_parameter_history SET reason='x' WHERE true;                  -- 42501
--   INSERT approvals(state='APPROVED', approver_id=requested_by)                       -- 23514
--   INSERT parameters('attendance.totp_rotate_seconds','7')                             -- 23514
--   SELECT count(*) FROM master_system_parameter_approvals;   -- sebagai tenant B: 0 baris tenant A
-- ==============================================================================
