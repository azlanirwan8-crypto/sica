-- ==============================================================================
-- SICA Database Migration 0096: `menu_items.description` / `description_en`
-- Rujukan: docs/DATA_MODEL.md §21.7 butir 4 (label = nama nav, description = keterangan)
--          + §14.7 registrasi nomor; docs/BLUEPRINT_ROLE_BY_ROLE.md §12.7 (38 baris);
--          docs/API_SPEC.md §4.17.1 (baris kontrak `description`) + §4.17.2 (PATCH);
--          docs/UI_UX_DESIGN.md §2.7 butir F-1; docs/AUDIT_READINESS.md RD-183.
--
-- Kenapa berkas baru dan bukan sunting `0050`: `0050` sudah diterapkan di database dev
-- (rantai `_sica_migrations`) dan MIGRATION_SOP §4/§5 butir 3 melarang mengubah migrasi
-- yang berjalan. Replay dari nol tetap benar: `0050` membuat tabel dengan `label NOT NULL`,
-- `0096` menambah dua kolom nullable.
--
-- Celah yang ditutup. Register BLUEPRINT §12 mengunci daun menu "verbatim tanpa disingkat",
-- dan akibatnya terukur: 38 dari 56 daun punya nama lebih panjang dari 30 karakter
-- (`platform.licensing.addons` 138). Velzon/Sevima menamai hal yang sama dengan satu–dua
-- kata (BENCHMARK_SEVIMA §7B.1, bukti [KUAT]). Solusinya bukan membuang teks spesifikasi,
-- melainkan memisahkan dua fungsi yang selama ini satu kolom: `label` = nama navigasi,
-- `description` = keterangan. Keduanya sudah terdaftar di DDL dokumen §21.7; berkas ini
-- membuat kolomnya nyata sehingga `menu-seed.ts` dapat menulisnya.
--
-- Expand-only dan sengaja TIDAK membawa backfill: `description NULL` adalah keadaan sah
-- yang berarti "nama = keterangan" (`DATA_MODEL §21.7` butir 4), jadi migrasi ini tidak
-- mengarang nilai apa pun. Pengisiannya milik seed (`apps/web/src/modules/authz/menu-seed.ts`)
-- yang deklaratif dan drift-aware — `pnpm --filter @sica/web seed:dev` sesudah apply.
-- Tidak ada kontrak CHECK di sini: teks keterangan tidak boleh menjadi keadaan mesin
-- (`AGENTS §3.10` kelas A), dan panjangnya dijaga di kontrak Zod, bukan di DB.
--
-- Yang TIDAK berubah: `label NOT NULL`, `UNIQUE (tenant_id, layer, code)`, RLS
-- `ENABLE`+`FORCE` + policy `tenant_isolation`, seluruh grant `menu_permissions`, dan
-- setiap `route_key`. Tidak satu pun baris dihapus atau diubah nilainya di sini.
--
-- Verifikasi sesudah apply:
--   SELECT count(*) FROM information_schema.columns
--     WHERE table_name = 'menu_items' AND column_name IN ('description','description_en');   -- 2
--   SELECT is_visible, count(*) FROM menu_items GROUP BY 1;                                    -- komposisi daun tetap
--   SELECT count(*) FROM menu_items WHERE description IS NOT NULL;                              -- 0 sebelum seed, > 0 sesudahnya
-- ==============================================================================

BEGIN;

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS description_en text;

COMMIT;
