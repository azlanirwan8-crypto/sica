-- ==============================================================================
-- SICA Database Migration 0047: Master Data Engine — kamus menjadi MESIN
-- Rujukan: docs/DATA_MODEL.md §20.3 (DDL), §20.6 (RLS & indeks);
--          norma zero-hardcoding AGENTS §3.10; kontrak baca API_SPEC §4.14.
--
-- Tanpa berkas ini, `reference_items` hanya bisa menyimpan nilai. Kolom di bawah
-- yang memberi tahu aplikasi CARA MERENDER, SUMBER NASIONAL, dan SIAPA PEMAKAI —
-- tiga hal yang membuat "satu layar untuk 30 master" tidak butuh 30 baris kode.
--
-- Verifikasi sesudah apply:
--   SELECT count(*) FROM information_schema.columns
--    WHERE table_name='reference_kinds' AND column_name IN
--      ('api_group_code','input_kind','is_required','max_selections','min_selections',
--       'validation_regex','feeder_dict_path','entity_type','effective_from','effective_to',
--       'version','description','approved_by','approved_at');                      -- 14
--   SELECT count(*) FROM information_schema.columns
--    WHERE table_name='reference_items' AND column_name IN
--      ('short_code','feeder_code','is_system','effective_from','effective_to',
--       'merged_into_id','points','requires_document','code_external');            -- 9
--   SELECT count(*) FROM pg_class WHERE relname='reference_kind_usage';            -- 1
--   SELECT count(*) FROM pg_views WHERE viewname IN ('master_lookup_groups','master_lookup_items');  -- 2
--   SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--    WHERE c.relname='master_lookup_groups' AND c.reloptions @> '{security_invoker=true}';  -- 1
--   ALTER TABLE reference_kinds ADD COLUMN input_kind text;                        -- ERROR duplicate (CHECK sudah ada)
-- ==============================================================================

-- 1. `reference_kinds` — metadata yang dapat menggerakkan formulir.
DO $$ BEGIN ALTER TABLE reference_kinds ADD COLUMN api_group_code text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_kinds ADD COLUMN input_kind text NOT NULL DEFAULT 'SELECT'
  CHECK (input_kind IN ('SELECT','MULTI','RADIO','CHECKBOX','TREE','NUMBER','DECIMAL','DATE','TEXT','TEXTAREA','FILE'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_kinds ADD COLUMN is_required boolean NOT NULL DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_kinds ADD COLUMN max_selections smallint CHECK (max_selections IS NULL OR max_selections BETWEEN 1 AND 50); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_kinds ADD COLUMN min_selections smallint CHECK (min_selections IS NULL OR min_selections >= 0); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_kinds ADD COLUMN validation_regex text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_kinds ADD COLUMN feeder_dict_path text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_kinds ADD COLUMN entity_type text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_kinds ADD COLUMN effective_from date NOT NULL DEFAULT current_date; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_kinds ADD COLUMN effective_to date; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_kinds ADD COLUMN version int NOT NULL DEFAULT 1; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_kinds ADD COLUMN description text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_kinds ADD COLUMN approved_by uuid; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_kinds ADD COLUMN approved_at timestamptz; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE reference_kinds ADD CONSTRAINT uq_refkinds_api_group UNIQUE (api_group_code);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- Tidak ada "disahkan" tanpa penyetuju tercatat.
DO $$ BEGIN
  ALTER TABLE reference_kinds ADD CONSTRAINT ck_refkinds_foureyes CHECK (approved_at IS NULL OR approved_by IS NOT NULL);
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL; END $$;

-- 2. `reference_items` — nilai berversi + jalur merge + poin terhitung.
DO $$ BEGIN ALTER TABLE reference_items ADD COLUMN short_code text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_items ADD COLUMN feeder_code text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_items ADD COLUMN is_system boolean NOT NULL DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_items ADD COLUMN effective_from date NOT NULL DEFAULT current_date; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_items ADD COLUMN effective_to date; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_items ADD COLUMN merged_into_id uuid REFERENCES reference_items(id); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
-- Naik dari `extra->'points'` karena ikut DIPERHITUNGKAN (SKPI, basis UKT) — numeric, bukan float (AGENTS §3.4).
DO $$ BEGIN ALTER TABLE reference_items ADD COLUMN points numeric(6,2); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_items ADD COLUMN requires_document boolean NOT NULL DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE reference_items ADD COLUMN code_external text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE reference_items ADD CONSTRAINT ck_refitems_notself CHECK (merged_into_id IS NULL OR merged_into_id <> id);
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE reference_items ADD CONSTRAINT ck_refitems_window CHECK (effective_to IS NULL OR effective_to > effective_from);
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_refitems_active_window ON reference_items(tenant_id, kind, is_active, effective_from) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_refitems_feeder ON reference_items(tenant_id, feeder_code) WHERE feeder_code IS NOT NULL;

-- 3. Indeks terbalik "master ini dipakai di mana?" — mesin impact-analysis (FR-ADM-12).
--    GLOBAL tanpa `tenant_id` karena ia mendeskripsikan KODE aplikasi: hanya boleh
--    ditulis lewat migrasi/review, bukan lewat UI tenant (masuk daftar §6.2).
CREATE TABLE IF NOT EXISTS reference_kind_usage (
  id uuid PRIMARY KEY,
  kind text NOT NULL REFERENCES reference_kinds(kind),
  surface text NOT NULL,
  entity_type text NOT NULL,
  column_name text,
  attribute_code text,
  required_role text,
  is_deprecated boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Salah satu penampung, bukan keduanya; `COALESCE` masuk lewat indeks unik ekspresi.
  CHECK ((column_name IS NULL) <> (attribute_code IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_refusage_site
  ON reference_kind_usage (kind, surface, entity_type, COALESCE(column_name, attribute_code));
CREATE INDEX IF NOT EXISTS idx_refusage_kind ON reference_kind_usage(kind, is_deprecated);

-- 4. Satu fisik, satu view. Nama alternatif dilayani sebagai VIEW `security_invoker`
--    (view `security_definer` menembus RLS → dilarang); tabel kembar = pola `RD-32`.
CREATE OR REPLACE VIEW master_lookup_groups WITH (security_invoker = true) AS
  SELECT kind AS id, api_group_code AS code, label AS name, description
  FROM reference_kinds;

CREATE OR REPLACE VIEW master_lookup_items WITH (security_invoker = true) AS
  SELECT id, kind AS group_kind, code, name AS label, name_en, sort_order, extra AS metadata, is_active
  FROM reference_items;
