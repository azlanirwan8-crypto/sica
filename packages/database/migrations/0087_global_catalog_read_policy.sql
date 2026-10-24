-- ==============================================================================
-- SICA Database Migration 0087: Policy BACA untuk katalog GLOBAL
-- Rujukan: docs/DATA_MODEL.md §6.2 (daftar pengecualian RLS), §14.2, §20.3.
--
-- Kenapa ini perlu sekarang. Database uji hosted memasang `relrowsecurity = true`
-- pada SETIAP tabel baru (perilaku default platform), termasuk katalog yang memang
-- TIDAK punya `tenant_id`: `permissions`, `modules`, `reference_kinds`,
-- `reference_kind_usage`. Tabel ber-RLS tanpa policy = default-deny: role aplikasi
-- yang `NOBYPASSRLS` (`sica_app`, SECURITY_COMPLIANCE §3) tidak dapat membaca
-- katalog izin sama sekali — resolver RBAC, layar kamus, dan gerbang entitlement
-- akan mati senyap begitu aplikasi benar-benar memakai `SET LOCAL ROLE sica_app`.
--
-- Vonis yang dipakai: katalog global boleh DIBACA semua tenant, tidak boleh DITULIS
-- dari jalur tenant. Karena itu policy-nya `FOR SELECT USING (true)` dan tidak ada
-- policy tulis; `0011` sudah REVOKE INSERT/UPDATE/DELETE pada `permissions`.
--
-- Verifikasi sesudah apply:
--   SELECT c.relname, pol.polcmd, pol.polqual IS NOT NULL AS punya_qual
--     FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid
--    WHERE c.relname IN ('permissions','modules','reference_kinds','reference_kind_usage');   -- 4 baris, polcmd=r
--   SELECT count(*) FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid
--    WHERE c.relname='reference_kinds' AND pol.polcmd <> 'r';                                  -- 0
--   Sebagai sica_app: SELECT count(*) FROM reference_kinds → ANGKA; INSERT → 42501.
-- ==============================================================================

DO $$
DECLARE
  globals text[] := ARRAY['permissions','modules','reference_kinds','reference_kind_usage'];
  t text;
BEGIN
  FOREACH t IN ARRAY globals LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = t AND relkind = 'r') THEN
      RAISE NOTICE '0087: tabel % tidak ada, dilewati', t;
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS global_read ON public.%I;', t);
    EXECUTE format($pol$
      CREATE POLICY global_read ON public.%I
        AS PERMISSIVE FOR SELECT
        TO public
        USING (true);
    $pol$, t);
  END LOOP;
END $$;

-- Tulis katalog global bukan hak jalur tenant: ditegakkan di privilege, bukan policy.
DO $$
DECLARE
  globals text[] := ARRAY['permissions','modules','reference_kinds','reference_kind_usage'];
  t text;
BEGIN
  FOREACH t IN ARRAY globals LOOP
    BEGIN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM sica_app;', t);
      EXECUTE format('GRANT SELECT ON public.%I TO sica_app;', t);
    EXCEPTION WHEN others THEN
      RAISE NOTICE '0087: grant pada % dilewati (managed DB): %', t, SQLERRM;
    END;
  END LOOP;
END $$;
