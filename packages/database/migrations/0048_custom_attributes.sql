-- ==============================================================================
-- SICA Database Migration 0048: Atribut Kustom (definisi + nilai JSONB + riwayat)
-- Rujukan: docs/DATA_MODEL.md §20.5 (DDL + tujuh aturan), AGENTS §3.10 kelas D.
--
-- Vonis bentuk yang diambil dokumen: EAV murni DITOLAK sebagai penyimpan; JSONB di
-- baris induk DIPAKAI; definisi + validasi di service DIPAKAI; riwayat HANYA untuk
-- atribut `is_tracked`. Berkas ini tidak mengulang vonis, hanya mengeksekusinya.
--
-- Verifikasi sesudah apply:
--   SELECT count(*) FROM pg_class WHERE relname IN ('tenant_custom_attributes','custom_attribute_history');  -- 2
--   SELECT count(*) FROM pg_constraint WHERE conname IN
--     ('ck_ca_options_from_dictionary','ck_ca_no_dual_container','ck_ca_pii_self_edit','ck_ca_foureyes');    -- 4
--   SELECT count(*) FROM information_schema.columns
--    WHERE table_name='students' AND column_name='attributes';                  -- 1
--   INSERT INTO tenant_custom_attributes(tenant_id,entity_type,code,label,input_kind,data_type,requested_by)
--     VALUES ('…','student','x','X','SELECT','ENUM',gen_random_uuid());         -- ERROR (options_kind wajib)
--   UPDATE custom_attribute_history SET new_value='{}' WHERE 1=1;               -- 42501 (insert-only oleh gerbang app)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS tenant_custom_attributes (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN
    ('student','student_guardian','lecturer','staff','user','course','class','room','invoice','document','activity')),
  code text NOT NULL,                       -- kunci di dalam `attributes`; stabil, bukan label
  label text NOT NULL,
  label_en text,
  help_text text,
  input_kind text NOT NULL CHECK (input_kind IN
    ('TEXT','TEXTAREA','NUMBER','DECIMAL','DATE','BOOL','SELECT','MULTI','RADIO','CHECKBOX','URL','EMAIL','PHONE','FILE')),
  options_kind text REFERENCES reference_kinds(kind),   -- PILIHAN SELALU dari kamus; array literal dilarang
  data_type text NOT NULL CHECK (data_type IN
    ('STRING','INT','DECIMAL','DATE','BOOL','ENUM','MULTI','URL','EMAIL','PHONE')),
  is_required boolean NOT NULL DEFAULT false,
  max_length int CHECK (max_length IS NULL OR max_length BETWEEN 1 AND 4000),
  validation_regex text,
  min_value numeric, max_value numeric, decimal_scale smallint, unit text,
  applies_to jsonb NOT NULL DEFAULT '{}'::jsonb,
  role_view text[] NOT NULL DEFAULT '{}',
  role_edit text[] NOT NULL DEFAULT '{}',
  student_self_editable boolean NOT NULL DEFAULT false,
  show_in_transcript boolean NOT NULL DEFAULT false,
  is_searchable boolean NOT NULL DEFAULT false,
  is_tracked boolean NOT NULL DEFAULT false,
  pii_level text NOT NULL DEFAULT 'NONE' CHECK (pii_level IN ('NONE','ORDINARY','SPECIFIC')),
  feeder_mapping jsonb,                     -- NULL = TIDAK PERNAH ikut kirim ke pusat
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  sort_order int NOT NULL DEFAULT 100,
  version int NOT NULL DEFAULT 1,
  requested_by uuid NOT NULL,
  approved_by uuid, approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, code),
  CONSTRAINT ck_ca_options_from_dictionary CHECK (
    input_kind NOT IN ('SELECT','MULTI','RADIO','CHECKBOX') OR options_kind IS NOT NULL),
  CONSTRAINT ck_ca_no_dual_container CHECK (
    input_kind IN ('SELECT','MULTI','RADIO','CHECKBOX') OR options_kind IS NULL),
  -- Aturan 4: PII spesifik tidak dapat diisi sendiri oleh klien tanpa gerbang.
  CONSTRAINT ck_ca_pii_self_edit CHECK (pii_level = 'NONE' OR student_self_editable = false),
  -- Aturan 7: empat-mata saat mengaktifkan — satu atribut "wajib" bisa memblokir registrasi seangkatan.
  CONSTRAINT ck_ca_foureyes CHECK (status <> 'ACTIVE' OR (approved_by IS NOT NULL AND approved_by <> requested_by))
);

CREATE INDEX IF NOT EXISTS idx_customattr_form
  ON tenant_custom_attributes(tenant_id, entity_type, status, sort_order) WHERE status = 'ACTIVE';

ALTER TABLE tenant_custom_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_custom_attributes FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_custom_attributes;
CREATE POLICY tenant_isolation ON tenant_custom_attributes
  AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id())
  WITH CHECK (tenant_id = app.tenant_id());

-- Riwayat nilai: insert-only oleh desain (aturan 6 — nilai lama & riwayat tinggal agar
-- laporan periode sebelumnya dapat direkonstruksi, BR-R12).
CREATE TABLE IF NOT EXISTS custom_attribute_history (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  attribute_code text NOT NULL,
  old_value jsonb,
  new_value jsonb NOT NULL,
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('UI','IMPORT','API','MOBILE','MIGRATION')),
  reason text,
  request_id text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cah_entity
  ON custom_attribute_history(tenant_id, entity_type, entity_id, attribute_code, occurred_at DESC);

ALTER TABLE custom_attribute_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_attribute_history FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON custom_attribute_history;
CREATE POLICY tenant_isolation ON custom_attribute_history
  AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id())
  WITH CHECK (tenant_id = app.tenant_id());

-- Penampung nilai: ALTER expand-only pada tabel induk yang SUDAH ADA. `invoices`
-- terdaftar di §20.5 tetapi belum pernah dimigrasikan (rumahnya `0015`/`0022`,
-- slice BAUK) — karena itu keberadaannya diperiksa dulu dan yang dilewati dicetak,
-- bukan didiamkan.
DO $$
DECLARE
  parents text[] := ARRAY['students','lecturers','staff','rooms','courses','invoices'];
  p text;
  skipped text[] := '{}';
BEGIN
  FOREACH p IN ARRAY parents LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=p) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT %L::jsonb', p, '{}');
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_attrs ON %I USING gin (attributes jsonb_path_ops)', p, p);
    ELSE
      skipped := array_append(skipped, p);
    END IF;
  END LOOP;
  IF array_length(skipped, 1) IS NOT NULL THEN
    RAISE NOTICE '0048: kolom attributes DILEWATI untuk % (tabel belum dimigrasikan)', array_to_string(skipped, ', ');
  END IF;
END $$;
