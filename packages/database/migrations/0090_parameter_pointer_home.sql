-- ==============================================================================
-- SICA Database Migration 0090: Rumah penemuan `domain_table` untuk baris indeks §21.3
-- Rujukan: docs/DATA_MODEL.md §21.1 (lima rumah) + §21.2 (`source_of_truth`) + §21.3
--          butir 16/17/20, API_SPEC §4.16.1 ("Pointer bukan salinan"), ROADMAP §2.17 `SPE-2`.
--
-- Kenapa berkas baru dan bukan sunting `0049`: `0049` sudah diterapkan di database dev
-- (rantai `_sica_migrations`) dan MIGRATION_SOP §5 melarang mengubah migrasi yang berjalan.
-- Replay dari nol tetap benar: `0049` membuat tabel + CHECK lama, `0090` mengganti CHECK-nya.
--
-- Celah yang ditutup. `SPE-2` butir (a) menuntut **enam** baris katalog §21.3 menjadi
-- indeks penemuan (`4, 13, 16, 17, 20, 21`), dan butir (b) menuntut `PUT` atasnya dijawab
-- `403 PARAM_READONLY` (108) dengan `remedyHref`. Tiga baris punya rumah di kosakata lama
-- (`academic_rules` ×2, `tenant_settings` ×1); tiga sisanya (16/17/20 — komponen biaya,
-- skema potongan, kanal pembayaran) tinggal di **tabel domain** yang sudah punya versi,
-- `gl_account_code`, dan empat-mata sendiri. Kosakata `source_of_truth` 0049 tidak dapat
-- menyatakan itu, sehingga barisnya mustahil di-seed — dan penolakan itu justru norma yang
-- sedang dibuktikan. `domain_table` adalah **penunjuk**, bukan rumah keenam: ia tidak
-- menampung nilai apa pun (kolom nilainya dibekukan string kosong oleh seed).
--
-- Yang TIDAK berubah: `ck_param_not_env` tetap menolak `ENV`, `ck_param_not_secret` tetap
-- menolak rahasia, dan tidak ada satu pun baris yang nilainya dibaca dari `source_of_truth
-- <> 'PARAM'` (`§21.2`, ditegakkan service + diuji `.tools/e2e-fase-1c.mjs`).
--
-- Verifikasi sesudah apply:
--   SELECT count(*) FROM pg_constraint WHERE conname = 'ck_param_source_home';        -- 1
--   INSERT INTO master_system_parameters(... source_of_truth='domain_table' ...)      → DITERIMA
--   INSERT INTO master_system_parameters(... source_of_truth='ENV' ...)               → 23514
--   INSERT INTO master_system_parameters(... source_of_truth='kamar_lain' ...)        → 23514
-- ==============================================================================

DO $$ BEGIN
  ALTER TABLE master_system_parameters
    DROP CONSTRAINT master_system_parameters_source_of_truth_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE master_system_parameters
    ADD CONSTRAINT ck_param_source_home
    CHECK (source_of_truth IN
      ('PARAM','academic_rules','reference_items','tenant_custom_attributes',
       'tenant_settings','domain_table'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
