-- ==============================================================================
-- SICA Database Migration 0082: Kosakata jenis perubahan hak + penjaga empat-mata kedua
-- Rujukan: docs/DATA_MODEL.md §14.3.3 (DDL) + §3 (blok kanonik ada di `0011`);
--          kontrak rute: API_SPEC §4.6.9; izin: RBAC §4.5.8 baris 329–352.
--
-- Kenapa berkas ini ada. `0011` sudah membuat `access_change_requests`, tetapi tanpa
-- `request_kind` tabel itu hanya bisa menyatakan "seseorang akan diberi peran". Empat
-- jalur tulis yang dilarang API_SPEC §4.6.9 (grant, revoke, ubah scope, ubah komposisi
-- izin role) tidak dapat dibedakan, dan penjaga "penyetuju bukan target" belum ada.
--
-- Yang TIDAK dilakukan di sini: menulis `role_permissions` atau
-- `user_role_assignments`. Delta izin hanya SAAT PENGAJUAN; penerapan terjadi di
-- service ketika orang kedua menyetujui, dalam satu transaksi dengan baris keputusan.
--
-- Verifikasi sesudah apply:
--   SELECT count(*) FROM pg_type WHERE typname='access_request_kind';               -- 1
--   SELECT count(*) FROM pg_constraint WHERE conname IN
--     ('chk_acr_target_by_kind','chk_acr_decision_reason','chk_acr_approver_not_target');  -- 3
--   SELECT indexdef FROM pg_indexes WHERE indexname='uq_acr_pending_scope';         -- 1 (parsial WHERE status='PENDING')
--   INSERT ... request_kind='ROLE_PERMISSION_CHANGE' WITH target_user_id NOT NULL   -- 23514
--   INSERT ... status='REJECTED' tanpa decision_reason                              -- 23514
-- ==============================================================================

DO $$ BEGIN
  CREATE TYPE access_request_kind AS ENUM ('GRANT','REVOKE','SCOPE_CHANGE','ROLE_PERMISSION_CHANGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE access_change_requests ADD COLUMN request_kind access_request_kind NOT NULL DEFAULT 'GRANT';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE access_change_requests ADD COLUMN decision_reason text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- `ROLE_PERMISSION_CHANGE` menyunting role, bukan orang → target boleh NULL.
ALTER TABLE access_change_requests ALTER COLUMN target_user_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE access_change_requests
    ADD CONSTRAINT chk_acr_target_by_kind CHECK (
      (request_kind <> 'ROLE_PERMISSION_CHANGE' AND target_user_id IS NOT NULL)
      OR (request_kind = 'ROLE_PERMISSION_CHANGE' AND target_user_id IS NULL)
    ) NOT VALID;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE access_change_requests
    ADD CONSTRAINT chk_acr_decision_reason CHECK (
      status <> 'REJECTED' OR (decision_reason IS NOT NULL AND length(decision_reason) >= 10)
    ) NOT VALID;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE access_change_requests
    ADD CONSTRAINT chk_acr_approver_not_target CHECK (
      approver_id IS NULL OR approver_id <> target_user_id
    ) NOT VALID;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL; END $$;

-- Satu permintaan PENDING per (tenant, target, role, jenis, scope): dua admin yang
-- mengajukan hal sama tidak boleh menghasilkan dua baris yang masing-masing bisa
-- disetujui. `COALESCE` dibutuhkan karena NULL tidak bertabrakan dengan NULL di indeks.
CREATE UNIQUE INDEX IF NOT EXISTS uq_acr_pending_scope
  ON access_change_requests (
    tenant_id,
    COALESCE(target_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    role_id,
    request_kind,
    md5(scope::text)
  )
  WHERE status = 'PENDING';
