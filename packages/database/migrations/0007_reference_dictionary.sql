-- ==============================================================================
-- SICA Database Migration 0007: Kamus Data Master (`reference_kinds` + `reference_items`)
-- Rujukan: docs/DATA_MODEL.md §14.2 (DDL induk), registry nomor §5 MIGRATION_SOP.
--
-- Sebagian dari cakupan `0007` yang terdaftar di registry adalah kalender akademik
-- (`academic_calendars`). Bagian itu TIDAK ada di berkas ini dan tidak diklaim selesai:
-- ia belum dibutuhkan slice manapun yang sudah dibuka. Yang ditulis di sini hanya
-- kamus, karena `0047`/`0048`/`0049` menunjuk `reference_kinds` sebagai FK.
--
-- Verifikasi sesudah apply:
--   SELECT count(*) FROM pg_type WHERE typname='reference_domain';               -- 1
--   SELECT count(*) FROM pg_class WHERE relname IN ('reference_kinds','reference_items');  -- 2
--   SELECT relname FROM pg_class c JOIN pg_policy p ON p.polrelid=c.oid
--    WHERE c.relname='reference_items';                                          -- tenant_isolation
--   INSERT INTO reference_items(tenant_id,kind,code,name) VALUES
--     ('00000000-0000-0000-0000-000000000000','agama','ISLAM','Islam');          -- ERROR (FK tenants)
--   UPDATE reference_kinds SET label='x' WHERE 1=1;                              -- 42501 untuk sica_app (READ ONLY)
-- ==============================================================================

-- 1. Enum domain kamus (idempoten; skip bila sudah ada)
DO $$ BEGIN
  CREATE TYPE reference_domain AS ENUM (
    'BIODATA','AKADEMIK','PEKULIAHAN','KEPEGAWAIAN','WILAYAH','KEUANGAN','KEMAHASISWAAN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Jenis kamus — METADATA, bukan nilai. Global oleh desain (§6.2 pengecualian RLS):
--    satu daftar `kind` untuk seluruh tenant; yang dipisah-per-tenant adalah isinya.
CREATE TABLE IF NOT EXISTS reference_kinds (
  kind          text PRIMARY KEY,
  label         text NOT NULL,
  domain        reference_domain NOT NULL,
  is_system     boolean NOT NULL DEFAULT true,          -- true = edit dibatasi (dipakai pemetaan feeder)
  feeder_code   text,
  has_external_dictionary boolean NOT NULL DEFAULT false
);

-- 3. Nilai kamus per-tenant → ber-RLS + FORCE.
CREATE TABLE IF NOT EXISTS reference_items (
  id         uuid PRIMARY KEY,
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind       text NOT NULL REFERENCES reference_kinds(kind),
  code       text NOT NULL,
  name       text NOT NULL,
  name_en    text,
  parent_id  uuid REFERENCES reference_items(id),
  extra      jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int  NOT NULL DEFAULT 100,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kind, code),
  CHECK (parent_id IS NULL OR parent_id <> id)
);

-- Indeks domain selalu ber-`tenant_id` di depan (AGENTS §3.7).
CREATE INDEX IF NOT EXISTS idx_ref_items_lookup ON reference_items(tenant_id, kind, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_ref_items_parent ON reference_items(tenant_id, parent_id);

-- 4. RLS hanya untuk tabel ber-`tenant_id`; `reference_kinds` global dan karena itu
--    TIDAK diberi policy (daftar pengecualian §6.2).
ALTER TABLE reference_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_items FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON reference_items;
CREATE POLICY tenant_isolation ON reference_items
  AS PERMISSIVE FOR ALL
  TO public
  USING (tenant_id = app.tenant_id())
  WITH CHECK (tenant_id = app.tenant_id());

-- `reference_kinds` sengaja TIDAK di-REVOKE: §14.2 menulis "global boleh, tapi tenant
-- dapat menambah sendiri" sementara §20.3 membatasi penulisan hanya untuk
-- `reference_kind_usage`. Dua bacaan itu belum divonis, jadi migrasi ini tidak
-- mengambil keputusan atas namanya — dicatat sebagai gap, bukan dipaksakan diam-diam.
