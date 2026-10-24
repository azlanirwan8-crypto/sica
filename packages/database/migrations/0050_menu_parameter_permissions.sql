-- ==============================================================================
-- SICA Database Migration 0050: Tata Kelola Menu Dinamis + Pola Izin Parameter
-- Rujukan: docs/DATA_MODEL.md §21.7 (DDL), RBAC_MATRIX §4.5 baris 158–161,
--          API_SPEC §4.17 (`GET /me/menu`) + kode error 114–116.
--
-- Yang ditambahkan di sini adalah DUA PETA, bukan kosakata izin baru:
--   menu → izin (`menu_permissions`, allowlist) dan parameter → izin (pola).
-- `permission_code` menunjuk katalog `permissions` yang sudah lahir di `0011`/`0085`;
-- penyaringan menu BUKAN kontrol akses — L1–L6 tetap wajib di setiap rute tulis.
--
-- Verifikasi sesudah apply:
--   SELECT count(*) FROM pg_class WHERE relname IN ('menu_items','menu_permissions','parameter_permissions');  -- 3
--   SELECT count(*) FROM pg_constraint WHERE conname IN ('ck_menuperm_scope','ck_paramperm_pattern','ck_paramperm_foureyes');  -- 3
--   INSERT INTO menu_permissions(id,tenant_id,menu_id,permission_code,scope_kind)
--     VALUES (gen_random_uuid(),'<t>','<m>','izin.tidak.ada','');      -- ERROR FK permissions
--   INSERT INTO parameter_permissions(...,parameter_pattern,...) VALUES (..., 'Attendance.TOTP', ...);  -- ERROR regex
--   SELECT count(*) FROM menu_items WHERE parent_id = id;              -- 0 (CHECK anti siklus langsung)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  parent_id uuid REFERENCES menu_items(id),
  label text NOT NULL,
  label_en text,
  route_key text,                              -- 'admin.master.periode' → path dibangun dari sini, bukan string bebas
  layer text NOT NULL DEFAULT 'WEB' CHECK (layer IN ('WEB','MOBILE','BOTH')),
  module_code text,                            -- gerbang entitlement (ADR-13)
  icon text,
  sort_order int NOT NULL DEFAULT 100,
  is_visible boolean NOT NULL DEFAULT true,
  requires_mfa boolean NOT NULL DEFAULT false, -- menu tulis-admin (FR-IDT-01)
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, layer, code),
  CHECK (parent_id IS NULL OR parent_id <> id),        -- siklus panjang dijaga query CI §21.8(3)
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX IF NOT EXISTS idx_menu_tree ON menu_items(tenant_id, layer, parent_id, sort_order);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON menu_items;
CREATE POLICY tenant_isolation ON menu_items
  AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id())
  WITH CHECK (tenant_id = app.tenant_id());

-- Allowlist menu × izin. `scope_kind` memakai '' (bukan NULL) karena NULL tidak pernah
-- bertabrakan dengan NULL di UNIQUE — tanpa itu dua baris "tanpa scope" boleh dobel.
CREATE TABLE IF NOT EXISTS menu_permissions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  menu_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES permissions(code),
  effect text NOT NULL DEFAULT 'ALLOW' CHECK (effect IN ('ALLOW','DENY')),
  scope_kind text NOT NULL DEFAULT '',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_id, permission_code, scope_kind),
  CONSTRAINT ck_menuperm_scope CHECK (scope_kind IN ('', 'TENANT', 'ORG', 'SITE', 'PROGRAM', 'CLASS'))
);

CREATE INDEX IF NOT EXISTS idx_menuperm_menu ON menu_permissions(tenant_id, menu_id);

ALTER TABLE menu_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_permissions FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON menu_permissions;
CREATE POLICY tenant_isolation ON menu_permissions
  AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id())
  WITH CHECK (tenant_id = app.tenant_id());

-- Pola, bukan satu baris per (peran × parameter): katalog akan meledak jadi ribuan baris
-- dan — lebih buruk — kode izin baru akan terus tercipta tanpa review.
CREATE TABLE IF NOT EXISTS parameter_permissions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parameter_pattern text NOT NULL,             -- 'attendance.totp_*', 'finance.*', 'grading.publish_deadline'
  permission_code text NOT NULL REFERENCES permissions(code),
  effect text NOT NULL DEFAULT 'ALLOW' CHECK (effect IN ('ALLOW','DENY')),
  min_scope text NOT NULL DEFAULT 'TENANT' CHECK (min_scope IN ('TENANT','ORG','SITE','PROGRAM')),
  requires_mfa boolean NOT NULL DEFAULT false,
  requires_second_approver boolean NOT NULL DEFAULT false,
  valid_from date NOT NULL DEFAULT current_date,
  valid_to date,
  note text NOT NULL,                          -- pola tanpa keterangan ditolak saat review
  requested_by uuid NOT NULL,
  approved_by uuid, approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  UNIQUE (tenant_id, parameter_pattern, permission_code, effect),
  CONSTRAINT ck_paramperm_pattern CHECK (parameter_pattern ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_*$]+)+$'),
  CONSTRAINT ck_paramperm_foureyes CHECK (approved_by IS NULL OR approved_by <> requested_by),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_paramperm_lookup
  ON parameter_permissions(tenant_id, effect, parameter_pattern);

ALTER TABLE parameter_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE parameter_permissions FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON parameter_permissions;
CREATE POLICY tenant_isolation ON parameter_permissions
  AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id())
  WITH CHECK (tenant_id = app.tenant_id());
