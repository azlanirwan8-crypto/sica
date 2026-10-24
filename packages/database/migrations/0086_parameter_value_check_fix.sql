-- ==============================================================================
-- SICA Database Migration 0086: Perbaikan CHECK `parameter_value` (0049 tidak dapat di-isi)
-- Rujukan: docs/DATA_MODEL.md §21.2 (RALAT 2026-10-23), API_SPEC §4.16.2 (kode 107–109).
--
-- Kenapa berkas terpisah dan bukan sunting `0049`: `0049` sudah tercatat dijalankan di
-- database dev, dan MIGRATION_SOP §5 melarang mengubah migrasi yang sudah diterapkan.
-- Replay dari nol tetap benar: `0049` membuat tabel, `0086` memperbaiki constraint-nya.
--
-- Cacat aslinya: `parameter_value ~ '^[^[:cntrl:]]{0,4000}$'`. Mesin regex PostgreSQL
-- membatasi pengulangan pada 255, jadi ekspresi itu gagal dikompilasi SAAT BARIS
-- pertama dimasukkan (SQLSTATE 2201B `invalid regular expression`). Akibatnya tabel
-- parameter menolak SEMUA nilai — termasuk yang sah. Ini tidak terdeteksi oleh
-- `db:migrate` karena PostgreSQL baru mengompilasi regex CHECK saat evaluasi baris.
--
-- Verifikasi sesudah apply:
--   SELECT count(*) FROM pg_constraint WHERE conname='ck_param_value_shape';        -- 1
--   INSERT INTO master_system_parameters(...parameter_value='30'...) → DITERIMA;
--   INSERT INTO master_system_parameters(...parameter_value=E'x\ny'...) → 23514 (kontrol);
--   INSERT INTO master_system_parameters(... 4001 karakter ...)          → 23514 (panjang).
-- ==============================================================================

ALTER TABLE master_system_parameters
  DROP CONSTRAINT IF EXISTS master_system_parameters_parameter_value_check;

DO $$ BEGIN
  ALTER TABLE master_system_parameters
    ADD CONSTRAINT ck_param_value_shape
    CHECK (parameter_value !~ '[[:cntrl:]]' AND length(parameter_value) <= 4000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
