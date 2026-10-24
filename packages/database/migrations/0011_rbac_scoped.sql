-- ==============================================================================
-- SICA Database Migration 0011: RBAC Ber-scope (Slice ADM-8 / W-12.1)
-- Sumber norma: docs/RBAC_MATRIX.md §2 (peran), §4 (katalog izin), §3.1 (model),
--                docs/DATA_MODEL.md §3 + §9 (seed 15 role) + §14.4 (6 aksi FR-IDT-04)
-- Sifat: EXPAND-ONLY (tidak mengubah tabel/baris yang sudah ada), idempoten.
-- RLS dipasang SETELAH seed karena seed membaca & menulis lintas tenant.
-- ==============================================================================

SET lock_timeout = '10s';

-- ------------------------------------------------------------------------------
-- 1. Enum typed (DATA_MODEL §14: "enum = kolom typed wajib", bukan text+CHECK)
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE permission_verb AS ENUM ('READ','INSERT','UPDATE','DELETE','VALIDATE','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE role_scope_kind AS ENUM ('TENANT','ORG','PROGRAM','CLASS','PERIOD','SELF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE access_request_status AS ENUM ('PENDING','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------------------------
-- 2. Katalog izin GLOBAL — satu baris = satu titik aksi atomik.
--    Tanpa tenant_id (sumber kebenaran bersama seluruh tenant) => di luar
--    generator RLS; aplikasi hanya boleh SELECT (lihat bagian 9).
--    Ralat norma: `UNIQUE (resource, verb)` yang diusulkan DATA_MODEL §14.4 TIDAK
--    dapat dipenuhi katalog (222 kode -> 169 pasangan resource|verb; 37 pasangan
--    memuat >1 kode, mis. `admin.pengguna|UPDATE` = user.update, user.deactivate,
--    membership.update). Kunci atomik tetap `code`; (resource, verb) menjadi
--    indeks render matriks FR-IDT-04, bukan kunci.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,              -- 'enrollment.krs.submit'
  module      text NOT NULL,                     -- 'enrollment' — gerbang entitlement
  resource    text NOT NULL,                     -- 'admin.pengguna' — titik menu
  verb        permission_verb NOT NULL,          -- READ/INSERT/UPDATE/DELETE/VALIDATE/OTHER
  description text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_permissions_module      ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_verb ON permissions(resource, verb);

-- ------------------------------------------------------------------------------
-- 3. Peran per-tenant. `scope_kind` = lingkup tempat peran itu dirancang;
--    lingkup KONKRET sebuah penugasan selalu di `user_role_assignments`,
--    tidak pernah di role (RBAC_MATRIX §3.1).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code         text NOT NULL CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  display_name text NOT NULL,
  scope_kind   role_scope_kind NOT NULL,
  is_system    boolean NOT NULL DEFAULT false,   -- true = preset, tidak boleh dihapus tenant
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_roles_tenant_code UNIQUE (tenant_id, code),
  -- kunci komposit untuk FK "type-locked" dari tabel anak (menegakkan satu tenant)
  CONSTRAINT uq_roles_tenant_id  UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id, code);

-- ------------------------------------------------------------------------------
-- 4. Grant izin → peran. `tenant_id` didenormalisasi agar RLS langsung menempel
--    (AGENTS §3.2) dan FK komposit menjamin baris tidak pernah menunjuk role
--    milik tenant lain.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id       uuid NOT NULL,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by    uuid REFERENCES users(id),
  granted_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (tenant_id, role_id)
    REFERENCES roles(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant ON role_permissions(tenant_id, role_id);

-- ------------------------------------------------------------------------------
-- 5. Penugasan peran ber-scope + masa berlaku. Tabel paling menentukan hak
--    akses nyata: satu user dapat memegang peran yang sama di banyak scope.
--    `origin='SEED'` = turunan enum carrier lama (bukan grant manusia), sehingga
--    `assigned_by` boleh kosong; tanpa pembeda ini jejak audit akan memalsukan
--    adanya pemberi hak.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_role_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id          uuid NOT NULL,
  scope_org_id     uuid REFERENCES organizations(id) ON DELETE CASCADE,
  scope_program_id uuid REFERENCES study_programs(id) ON DELETE CASCADE,
  scope_class_id   uuid REFERENCES classes(id) ON DELETE CASCADE,
  scope_period_id  uuid REFERENCES academic_periods(id) ON DELETE CASCADE,
  scope_student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  valid_from       timestamptz NOT NULL DEFAULT now(),
  valid_to         timestamptz,                  -- NULL = berlaku terus (masih harus dicek valid_from)
  origin           text NOT NULL DEFAULT 'GRANT'
                     CHECK (origin IN ('SEED','GRANT','IMPORT')),
  assigned_by      uuid REFERENCES users(id),
  reason           text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_ura_role FOREIGN KEY (tenant_id, role_id)
    REFERENCES roles(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_ura_valid_window CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT chk_ura_grant_has_grantor CHECK (origin = 'SEED' OR assigned_by IS NOT NULL)
);
-- Satu penugasan (user, role, scope) hanya boleh ada satu. Ditulis sebagai indeks
-- ekspresi karena pseudo-DDL DATA_MODEL §3 memakai UNIQUE(...) berisi COALESCE,
-- bentuk yang tidak sah sebagai constraint tabel.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ura_scope ON user_role_assignments (
  user_id, role_id,
  COALESCE(scope_org_id,     '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(scope_program_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(scope_class_id,   '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(scope_period_id,  '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(scope_student_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
-- Indeks lookup TANPA predikat: pseudo-DDL DATA_MODEL §3 memakai `WHERE valid_to IS
-- NULL OR valid_to > now()`, tetapi PostgreSQL menolak fungsi non-IMMUTABLE pada
-- predikat indeks. Jendela berlaku disaring saat query, bukan di indeks.
CREATE INDEX IF NOT EXISTS idx_ura_lookup ON user_role_assignments(tenant_id, user_id, role_id);
CREATE INDEX IF NOT EXISTS idx_ura_role ON user_role_assignments(tenant_id, role_id);

-- ------------------------------------------------------------------------------
-- 6. Empat-mata: tidak ada self-escalation (RBAC_MATRIX §7, PRD P2).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS access_change_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requester_id   uuid NOT NULL REFERENCES users(id),
  target_user_id uuid NOT NULL REFERENCES users(id),
  role_id        uuid NOT NULL,
  scope          jsonb NOT NULL,                 -- {orgId?, programId?, classId?, periodId?, studentId?}
  reason         text NOT NULL CHECK (length(reason) >= 10),
  status         access_request_status NOT NULL DEFAULT 'PENDING',
  approver_id    uuid REFERENCES users(id),
  requested_at   timestamptz NOT NULL DEFAULT now(),
  decided_at     timestamptz,
  CONSTRAINT fk_acr_role FOREIGN KEY (tenant_id, role_id)
    REFERENCES roles(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT chk_acr_no_self_approval CHECK (approver_id IS NULL OR approver_id <> requester_id),
  CONSTRAINT chk_acr_decided_by CHECK (status = 'PENDING' OR approver_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_acr_tenant_status ON access_change_requests(tenant_id, status, requested_at DESC);

-- ------------------------------------------------------------------------------
-- 7. Seed katalog izin GLOBAL (222 kode). generated-file: blok ini ditulis oleh
--    `node packages/database/scripts/gen-rbac-seed.mjs` dari
--    packages/contracts/src/authz.ts — JANGAN sunting manual.
-- ------------------------------------------------------------------------------
-- >>> GEN:PERMISSIONS
-- Diturunkan dari PERMISSION_SPECS (262 izin atomik).
INSERT INTO permissions (code, module, resource, verb, description) VALUES
  ('identity.profile.view', 'identity', 'identity.profile', 'READ', 'Baca ''identity.profile'' [modul identity]'),
  ('identity.profile.update', 'identity', 'identity.profile', 'UPDATE', 'Ubah ''identity.profile'' [modul identity]'),
  ('identity.password.reset', 'identity', 'identity.profile', 'UPDATE', 'Ubah ''identity.profile'' [modul identity]'),
  ('identity.session.view', 'identity', 'identity.session', 'READ', 'Baca ''identity.session'' [modul identity]'),
  ('identity.session.revoke', 'identity', 'identity.session', 'DELETE', 'Hapus ''identity.session'' [modul identity]'),
  ('identity.mfa.manage', 'identity', 'identity.mfa', 'UPDATE', 'Ubah ''identity.mfa'' [modul identity]'),
  ('identity.loginstats.view', 'identity', 'admin.monitoring', 'READ', 'Baca ''admin.monitoring'' [modul identity]'),
  ('identity.user.view', 'identity', 'admin.pengguna', 'READ', 'Baca ''admin.pengguna'' [modul identity]'),
  ('identity.user.create', 'identity', 'admin.pengguna', 'INSERT', 'Tambah ''admin.pengguna'' [modul identity]'),
  ('identity.user.update', 'identity', 'admin.pengguna', 'UPDATE', 'Ubah ''admin.pengguna'' [modul identity]'),
  ('identity.user.deactivate', 'identity', 'admin.pengguna', 'UPDATE', 'Ubah ''admin.pengguna'' [modul identity]'),
  ('identity.membership.view', 'identity', 'admin.pengguna', 'READ', 'Baca ''admin.pengguna'' [modul identity]'),
  ('identity.membership.create', 'identity', 'admin.pengguna', 'INSERT', 'Tambah ''admin.pengguna'' [modul identity]'),
  ('identity.membership.update', 'identity', 'admin.pengguna', 'UPDATE', 'Ubah ''admin.pengguna'' [modul identity]'),
  ('identity.role.view', 'identity', 'admin.hak-akses', 'READ', 'Baca ''admin.hak-akses'' [modul identity]'),
  ('identity.role.create', 'identity', 'admin.hak-akses', 'INSERT', 'Tambah ''admin.hak-akses'' [modul identity]'),
  ('identity.role.update', 'identity', 'admin.hak-akses', 'UPDATE', 'Ubah ''admin.hak-akses'' [modul identity]'),
  ('identity.role.delete', 'identity', 'admin.hak-akses', 'DELETE', 'Hapus ''admin.hak-akses'' [modul identity]'),
  ('identity.permission.view', 'identity', 'admin.hak-akses', 'READ', 'Baca ''admin.hak-akses'' [modul identity]'),
  ('identity.assignment.view', 'identity', 'admin.hak-akses', 'READ', 'Baca ''admin.hak-akses'' [modul identity]'),
  ('identity.assignment.grant', 'identity', 'admin.hak-akses', 'INSERT', 'Tambah ''admin.hak-akses'' [modul identity]'),
  ('identity.assignment.revoke', 'identity', 'admin.hak-akses', 'DELETE', 'Hapus ''admin.hak-akses'' [modul identity]'),
  ('identity.accessrequest.view', 'identity', 'admin.hak-akses', 'READ', 'Baca ''admin.hak-akses'' [modul identity]'),
  ('identity.accessrequest.approve', 'identity', 'admin.hak-akses', 'VALIDATE', 'Setujui ''admin.hak-akses'' [modul identity]'),
  ('identity.impersonation.grant', 'identity', 'admin.pengguna.impersonate', 'OTHER', 'Aksi khusus ''admin.pengguna.impersonate'' [modul identity]'),
  ('identity.impersonation.revoke', 'identity', 'admin.pengguna.impersonate', 'OTHER', 'Aksi khusus ''admin.pengguna.impersonate'' [modul identity]'),
  ('academic.organization.view', 'academic', 'admin.organisasi', 'READ', 'Baca ''admin.organisasi'' [modul academic]'),
  ('academic.organization.create', 'academic', 'admin.organisasi', 'INSERT', 'Tambah ''admin.organisasi'' [modul academic]'),
  ('academic.organization.update', 'academic', 'admin.organisasi', 'UPDATE', 'Ubah ''admin.organisasi'' [modul academic]'),
  ('academic.organization.delete', 'academic', 'admin.organisasi', 'DELETE', 'Hapus ''admin.organisasi'' [modul academic]'),
  ('academic.period.view', 'academic', 'admin.master.periode', 'READ', 'Baca ''admin.master.periode'' [modul academic]'),
  ('academic.period.create', 'academic', 'admin.master.periode', 'INSERT', 'Tambah ''admin.master.periode'' [modul academic]'),
  ('academic.period.update', 'academic', 'admin.master.periode', 'UPDATE', 'Ubah ''admin.master.periode'' [modul academic]'),
  ('academic.period.close', 'academic', 'admin.master.periode', 'UPDATE', 'Ubah ''admin.master.periode'' [modul academic]'),
  ('academic.periodreopen.request', 'academic', 'admin.master.periode', 'INSERT', 'Tambah ''admin.master.periode'' [modul academic]'),
  ('academic.periodreopen.approve', 'academic', 'admin.master.periode', 'VALIDATE', 'Setujui ''admin.master.periode'' [modul academic]'),
  ('academic.calendar.view', 'academic', 'admin.master.kalender', 'READ', 'Baca ''admin.master.kalender'' [modul academic]'),
  ('academic.calendar.create', 'academic', 'admin.master.kalender', 'INSERT', 'Tambah ''admin.master.kalender'' [modul academic]'),
  ('academic.calendar.update', 'academic', 'admin.master.kalender', 'UPDATE', 'Ubah ''admin.master.kalender'' [modul academic]'),
  ('academic.calendar.delete', 'academic', 'admin.master.kalender', 'DELETE', 'Hapus ''admin.master.kalender'' [modul academic]'),
  ('academic.program.view', 'academic', 'admin.master.prodi', 'READ', 'Baca ''admin.master.prodi'' [modul academic]'),
  ('academic.program.create', 'academic', 'admin.master.prodi', 'INSERT', 'Tambah ''admin.master.prodi'' [modul academic]'),
  ('academic.program.update', 'academic', 'admin.master.prodi', 'UPDATE', 'Ubah ''admin.master.prodi'' [modul academic]'),
  ('academic.program.delete', 'academic', 'admin.master.prodi', 'DELETE', 'Hapus ''admin.master.prodi'' [modul academic]'),
  ('academic.curriculum.view', 'academic', 'admin.master.kurikulum', 'READ', 'Baca ''admin.master.kurikulum'' [modul academic]'),
  ('academic.curriculum.create', 'academic', 'admin.master.kurikulum', 'INSERT', 'Tambah ''admin.master.kurikulum'' [modul academic]'),
  ('academic.curriculum.update', 'academic', 'admin.master.kurikulum', 'UPDATE', 'Ubah ''admin.master.kurikulum'' [modul academic]'),
  ('academic.curriculum.publish', 'academic', 'admin.master.kurikulum', 'UPDATE', 'Ubah ''admin.master.kurikulum'' [modul academic]'),
  ('academic.course.view', 'academic', 'admin.master.matakuliah', 'READ', 'Baca ''admin.master.matakuliah'' [modul academic]'),
  ('academic.course.create', 'academic', 'admin.master.matakuliah', 'INSERT', 'Tambah ''admin.master.matakuliah'' [modul academic]'),
  ('academic.course.update', 'academic', 'admin.master.matakuliah', 'UPDATE', 'Ubah ''admin.master.matakuliah'' [modul academic]'),
  ('academic.course.delete', 'academic', 'admin.master.matakuliah', 'DELETE', 'Hapus ''admin.master.matakuliah'' [modul academic]'),
  ('academic.prerequisite.view', 'academic', 'admin.master.prasyarat', 'READ', 'Baca ''admin.master.prasyarat'' [modul academic]'),
  ('academic.prerequisite.create', 'academic', 'admin.master.prasyarat', 'INSERT', 'Tambah ''admin.master.prasyarat'' [modul academic]'),
  ('academic.prerequisite.delete', 'academic', 'admin.master.prasyarat', 'DELETE', 'Hapus ''admin.master.prasyarat'' [modul academic]'),
  ('academic.equivalency.view', 'academic', 'admin.master.ekivalensi', 'READ', 'Baca ''admin.master.ekivalensi'' [modul academic]'),
  ('academic.equivalency.manage', 'academic', 'admin.master.ekivalensi', 'UPDATE', 'Ubah ''admin.master.ekivalensi'' [modul academic]'),
  ('academic.reference.view', 'academic', 'admin.master.referensi', 'READ', 'Baca ''admin.master.referensi'' [modul academic]'),
  ('academic.reference.manage', 'academic', 'admin.master.referensi', 'UPDATE', 'Ubah ''admin.master.referensi'' [modul academic]'),
  ('academic.room.view', 'academic', 'admin.master.ruang', 'READ', 'Baca ''admin.master.ruang'' [modul academic]'),
  ('academic.room.create', 'academic', 'admin.master.ruang', 'INSERT', 'Tambah ''admin.master.ruang'' [modul academic]'),
  ('academic.room.update', 'academic', 'admin.master.ruang', 'UPDATE', 'Ubah ''admin.master.ruang'' [modul academic]'),
  ('academic.room.delete', 'academic', 'admin.master.ruang', 'DELETE', 'Hapus ''admin.master.ruang'' [modul academic]'),
  ('academic.rule.view', 'academic', 'admin.pengaturan.akademik', 'READ', 'Baca ''admin.pengaturan.akademik'' [modul academic]'),
  ('academic.rule.create', 'academic', 'admin.pengaturan.akademik', 'INSERT', 'Tambah ''admin.pengaturan.akademik'' [modul academic]'),
  ('academic.rule.update', 'academic', 'admin.pengaturan.akademik', 'UPDATE', 'Ubah ''admin.pengaturan.akademik'' [modul academic]'),
  ('academic.gate.view', 'academic', 'admin.pengaturan.gerbang', 'READ', 'Baca ''admin.pengaturan.gerbang'' [modul academic]'),
  ('academic.gate.configure', 'academic', 'admin.pengaturan.gerbang', 'UPDATE', 'Ubah ''admin.pengaturan.gerbang'' [modul academic]'),
  ('academic.blockade.view', 'academic', 'admin.pengaturan.cekal', 'READ', 'Baca ''admin.pengaturan.cekal'' [modul academic]'),
  ('academic.blockade.create', 'academic', 'admin.pengaturan.cekal', 'INSERT', 'Tambah ''admin.pengaturan.cekal'' [modul academic]'),
  ('academic.blockade.release', 'academic', 'admin.pengaturan.cekal', 'DELETE', 'Hapus ''admin.pengaturan.cekal'' [modul academic]'),
  ('academic.student.view', 'academic', 'admin.personel.mahasiswa', 'READ', 'Baca ''admin.personel.mahasiswa'' [modul academic]'),
  ('academic.student.create', 'academic', 'admin.personel.mahasiswa', 'INSERT', 'Tambah ''admin.personel.mahasiswa'' [modul academic]'),
  ('academic.student.update', 'academic', 'admin.personel.mahasiswa', 'UPDATE', 'Ubah ''admin.personel.mahasiswa'' [modul academic]'),
  ('academic.student.archive', 'academic', 'admin.personel.mahasiswa', 'DELETE', 'Hapus ''admin.personel.mahasiswa'' [modul academic]'),
  ('academic.studentstatus.view', 'academic', 'admin.personel.status', 'READ', 'Baca ''admin.personel.status'' [modul academic]'),
  ('student.status.change', 'academic', 'admin.personel.status', 'UPDATE', 'Ubah ''admin.personel.status'' [modul academic]'),
  ('academic.transfer.request', 'academic', 'admin.personel.status', 'INSERT', 'Tambah ''admin.personel.status'' [modul academic]'),
  ('academic.transfer.approve', 'academic', 'admin.personel.status', 'VALIDATE', 'Setujui ''admin.personel.status'' [modul academic]'),
  ('academic.lecturer.view', 'academic', 'admin.personel.dosen', 'READ', 'Baca ''admin.personel.dosen'' [modul academic]'),
  ('academic.lecturer.create', 'academic', 'admin.personel.dosen', 'INSERT', 'Tambah ''admin.personel.dosen'' [modul academic]'),
  ('academic.lecturer.update', 'academic', 'admin.personel.dosen', 'UPDATE', 'Ubah ''admin.personel.dosen'' [modul academic]'),
  ('academic.guardian.view', 'academic', 'admin.personel.ortu', 'READ', 'Baca ''admin.personel.ortu'' [modul academic]'),
  ('academic.guardian.create', 'academic', 'admin.personel.ortu', 'INSERT', 'Tambah ''admin.personel.ortu'' [modul academic]'),
  ('academic.guardian.update', 'academic', 'admin.personel.ortu', 'UPDATE', 'Ubah ''admin.personel.ortu'' [modul academic]'),
  ('academic.clearance.view', 'academic', 'admin.pengaturan.clearance', 'READ', 'Baca ''admin.pengaturan.clearance'' [modul academic]'),
  ('academic.clearance.update', 'academic', 'admin.pengaturan.clearance', 'VALIDATE', 'Setujui ''admin.pengaturan.clearance'' [modul academic]'),
  ('academic.document.view', 'academic', 'admin.dokumen', 'READ', 'Baca ''admin.dokumen'' [modul academic]'),
  ('academic.document.print', 'academic', 'admin.dokumen', 'OTHER', 'Aksi khusus ''admin.dokumen'' [modul academic]'),
  ('academic.transcript.view', 'academic', 'academic.transkrip', 'READ', 'Baca ''academic.transkrip'' [modul academic]'),
  ('academic.transcript.issue', 'academic', 'admin.dokumen.transkrip', 'INSERT', 'Tambah ''admin.dokumen.transkrip'' [modul academic]'),
  ('academic.feedercode.view', 'academic', 'admin.feeder', 'READ', 'Baca ''admin.feeder'' [modul academic]'),
  ('academic.feedercode.update', 'academic', 'admin.feeder', 'UPDATE', 'Ubah ''admin.feeder'' [modul academic]'),
  ('academic.export.own', 'academic', 'academic.ekspor', 'OTHER', 'Aksi khusus ''academic.ekspor'' [modul academic]'),
  ('academic.export.bulk', 'academic', 'admin.ekspor.massal', 'OTHER', 'Aksi khusus ''admin.ekspor.massal'' [modul academic]'),
  ('academic.report.view', 'academic', 'admin.laporan', 'READ', 'Baca ''admin.laporan'' [modul academic]'),
  ('academic.monitoring.view', 'academic', 'admin.monitoring', 'READ', 'Baca ''admin.monitoring'' [modul academic]'),
  ('academic.health.view', 'academic', 'admin.kesehatan-data', 'READ', 'Baca ''admin.kesehatan-data'' [modul academic]'),
  ('academic.health.run', 'academic', 'admin.kesehatan-data', 'INSERT', 'Tambah ''admin.kesehatan-data'' [modul academic]'),
  ('academic.denialreason.view', 'academic', 'admin.diagnostik', 'READ', 'Baca ''admin.diagnostik'' [modul academic]'),
  ('academic.impact.view', 'academic', 'admin.impact-hapus', 'READ', 'Baca ''admin.impact-hapus'' [modul academic]'),
  ('teaching.class.view', 'teaching', 'admin.penyelenggaraan.kelas', 'READ', 'Baca ''admin.penyelenggaraan.kelas'' [modul teaching]'),
  ('teaching.class.create', 'teaching', 'admin.penyelenggaraan.kelas', 'INSERT', 'Tambah ''admin.penyelenggaraan.kelas'' [modul teaching]'),
  ('teaching.class.update', 'teaching', 'admin.penyelenggaraan.kelas', 'UPDATE', 'Ubah ''admin.penyelenggaraan.kelas'' [modul teaching]'),
  ('teaching.class.delete', 'teaching', 'admin.penyelenggaraan.kelas', 'DELETE', 'Hapus ''admin.penyelenggaraan.kelas'' [modul teaching]'),
  ('teaching.assignment.view', 'teaching', 'admin.penyelenggaraan.pengampu', 'READ', 'Baca ''admin.penyelenggaraan.pengampu'' [modul teaching]'),
  ('teaching.assignment.create', 'teaching', 'admin.penyelenggaraan.pengampu', 'INSERT', 'Tambah ''admin.penyelenggaraan.pengampu'' [modul teaching]'),
  ('teaching.assignment.update', 'teaching', 'admin.penyelenggaraan.pengampu', 'UPDATE', 'Ubah ''admin.penyelenggaraan.pengampu'' [modul teaching]'),
  ('teaching.assignment.delete', 'teaching', 'admin.penyelenggaraan.pengampu', 'DELETE', 'Hapus ''admin.penyelenggaraan.pengampu'' [modul teaching]'),
  ('teaching.schedule.view', 'teaching', 'admin.penyelenggaraan.jadwal', 'READ', 'Baca ''admin.penyelenggaraan.jadwal'' [modul teaching]'),
  ('teaching.schedule.create', 'teaching', 'admin.penyelenggaraan.jadwal', 'INSERT', 'Tambah ''admin.penyelenggaraan.jadwal'' [modul teaching]'),
  ('teaching.schedule.update', 'teaching', 'admin.penyelenggaraan.jadwal', 'UPDATE', 'Ubah ''admin.penyelenggaraan.jadwal'' [modul teaching]'),
  ('teaching.schedule.delete', 'teaching', 'admin.penyelenggaraan.jadwal', 'DELETE', 'Hapus ''admin.penyelenggaraan.jadwal'' [modul teaching]'),
  ('teaching.session.view', 'teaching', 'akademik.jadwal', 'READ', 'Baca ''akademik.jadwal'' [modul teaching]'),
  ('teaching.session.generate', 'teaching', 'admin.penyelenggaraan.pertemuan', 'INSERT', 'Tambah ''admin.penyelenggaraan.pertemuan'' [modul teaching]'),
  ('teaching.session.update', 'teaching', 'admin.penyelenggaraan.pertemuan', 'UPDATE', 'Ubah ''admin.penyelenggaraan.pertemuan'' [modul teaching]'),
  ('teaching.roster.view', 'teaching', 'dosen.kelas', 'READ', 'Baca ''dosen.kelas'' [modul teaching]'),
  ('teaching.workload.view', 'teaching', 'admin.penyelenggaraan.pengampu', 'READ', 'Baca ''admin.penyelenggaraan.pengampu'' [modul teaching]'),
  ('teaching.waitlist.view', 'teaching', 'admin.penyelenggaraan.kelas', 'READ', 'Baca ''admin.penyelenggaraan.kelas'' [modul teaching]'),
  ('teaching.waitlist.manage', 'teaching', 'admin.penyelenggaraan.kelas', 'UPDATE', 'Ubah ''admin.penyelenggaraan.kelas'' [modul teaching]'),
  ('teaching.virtualroom.view', 'teaching', 'admin.penyelenggaraan.jadwal', 'READ', 'Baca ''admin.penyelenggaraan.jadwal'' [modul teaching]'),
  ('teaching.virtualroom.create', 'teaching', 'admin.penyelenggaraan.jadwal', 'INSERT', 'Tambah ''admin.penyelenggaraan.jadwal'' [modul teaching]'),
  ('teaching.roomutilization.view', 'teaching', 'admin.monitoring', 'READ', 'Baca ''admin.monitoring'' [modul teaching]'),
  ('enrollment.krs.view', 'enrollment', 'akademik.krs', 'READ', 'Baca ''akademik.krs'' [modul enrollment]'),
  ('enrollment.krs.submit', 'enrollment', 'akademik.krs', 'INSERT', 'Tambah ''akademik.krs'' [modul enrollment]'),
  ('enrollment.krs.approve', 'enrollment', 'dpa.approval', 'VALIDATE', 'Setujui ''dpa.approval'' [modul enrollment]'),
  ('enrollment.krs.reject', 'enrollment', 'dpa.approval', 'VALIDATE', 'Setujui ''dpa.approval'' [modul enrollment]'),
  ('enrollment.krs.batchapprove', 'enrollment', 'dpa.approval', 'VALIDATE', 'Setujui ''dpa.approval'' [modul enrollment]'),
  ('enrollment.krs.withdraw', 'enrollment', 'akademik.krs', 'UPDATE', 'Ubah ''akademik.krs'' [modul enrollment]'),
  ('enrollment.krsedit.request', 'enrollment', 'admin.krs.sunting', 'INSERT', 'Tambah ''admin.krs.sunting'' [modul enrollment]'),
  ('enrollment.krsedit.approve', 'enrollment', 'admin.krs.sunting', 'VALIDATE', 'Setujui ''admin.krs.sunting'' [modul enrollment]'),
  ('enrollment.krs.recommend', 'enrollment', 'dpa.approval', 'UPDATE', 'Ubah ''dpa.approval'' [modul enrollment]'),
  ('enrollment.waitlist.join', 'enrollment', 'akademik.krs', 'INSERT', 'Tambah ''akademik.krs'' [modul enrollment]'),
  ('enrollment.waitlist.leave', 'enrollment', 'akademik.krs', 'DELETE', 'Hapus ''akademik.krs'' [modul enrollment]'),
  ('enrollment.effective.view', 'enrollment', 'akademik.krs', 'READ', 'Baca ''akademik.krs'' [modul enrollment]'),
  ('enrollment.scheme.view', 'enrollment', 'admin.pengaturan.sistem-kuliah', 'READ', 'Baca ''admin.pengaturan.sistem-kuliah'' [modul enrollment]'),
  ('enrollment.scheme.manage', 'enrollment', 'admin.pengaturan.sistem-kuliah', 'UPDATE', 'Ubah ''admin.pengaturan.sistem-kuliah'' [modul enrollment]'),
  ('enrollment.pack.view', 'enrollment', 'admin.pengaturan.pemaketan', 'READ', 'Baca ''admin.pengaturan.pemaketan'' [modul enrollment]'),
  ('enrollment.pack.apply', 'enrollment', 'admin.pengaturan.pemaketan', 'UPDATE', 'Ubah ''admin.pengaturan.pemaketan'' [modul enrollment]'),
  ('attendance.qr.generate', 'attendance', 'dosen.presensi', 'INSERT', 'Tambah ''dosen.presensi'' [modul attendance]'),
  ('attendance.qr.scan', 'attendance', 'akademik.presensi', 'UPDATE', 'Ubah ''akademik.presensi'' [modul attendance]'),
  ('attendance.record.view', 'attendance', 'dosen.presensi', 'READ', 'Baca ''dosen.presensi'' [modul attendance]'),
  ('attendance.record.create', 'attendance', 'dosen.presensi', 'INSERT', 'Tambah ''dosen.presensi'' [modul attendance]'),
  ('attendance.record.update', 'attendance', 'dosen.presensi', 'UPDATE', 'Ubah ''dosen.presensi'' [modul attendance]'),
  ('attendance.call.view', 'attendance', 'dosen.presensi', 'READ', 'Baca ''dosen.presensi'' [modul attendance]'),
  ('attendance.call.write', 'attendance', 'dosen.presensi', 'INSERT', 'Tambah ''dosen.presensi'' [modul attendance]'),
  ('attendance.summary.view', 'attendance', 'akademik.presensi', 'READ', 'Baca ''akademik.presensi'' [modul attendance]'),
  ('assessment.composition.view', 'assessment', 'admin.master.komposisi-nilai', 'READ', 'Baca ''admin.master.komposisi-nilai'' [modul assessment]'),
  ('assessment.composition.create', 'assessment', 'admin.master.komposisi-nilai', 'INSERT', 'Tambah ''admin.master.komposisi-nilai'' [modul assessment]'),
  ('assessment.composition.update', 'assessment', 'admin.master.komposisi-nilai', 'UPDATE', 'Ubah ''admin.master.komposisi-nilai'' [modul assessment]'),
  ('assessment.scale.view', 'assessment', 'admin.master.skala-nilai', 'READ', 'Baca ''admin.master.skala-nilai'' [modul assessment]'),
  ('assessment.scale.manage', 'assessment', 'admin.master.skala-nilai', 'UPDATE', 'Ubah ''admin.master.skala-nilai'' [modul assessment]'),
  ('assessment.grade.view', 'assessment', 'akademik.khs', 'READ', 'Baca ''akademik.khs'' [modul assessment]'),
  ('grading.value.write', 'assessment', 'dosen.nilai', 'UPDATE', 'Ubah ''dosen.nilai'' [modul assessment]'),
  ('assessment.grade.publish', 'assessment', 'dosen.nilai', 'UPDATE', 'Ubah ''dosen.nilai'' [modul assessment]'),
  ('assessment.grade.lock', 'assessment', 'dosen.nilai', 'UPDATE', 'Ubah ''dosen.nilai'' [modul assessment]'),
  ('assessment.grade.lockbulk', 'assessment', 'dosen.nilai', 'UPDATE', 'Ubah ''dosen.nilai'' [modul assessment]'),
  ('grading.unlock', 'assessment', 'kaprodi.koreksi-nilai', 'UPDATE', 'Ubah ''kaprodi.koreksi-nilai'' [modul assessment]'),
  ('assessment.correction.request', 'assessment', 'dosen.nilai', 'INSERT', 'Tambah ''dosen.nilai'' [modul assessment]'),
  ('assessment.correction.approve', 'assessment', 'kaprodi.koreksi-nilai', 'VALIDATE', 'Setujui ''kaprodi.koreksi-nilai'' [modul assessment]'),
  ('assessment.recompute', 'assessment', 'admin.monitoring', 'OTHER', 'Aksi khusus ''admin.monitoring'' [modul assessment]'),
  ('assessment.examcard.view', 'assessment', 'akademik.kartu-ujian', 'READ', 'Baca ''akademik.kartu-ujian'' [modul assessment]'),
  ('assessment.examcard.issue', 'assessment', 'admin.dokumen.kartu-ujian', 'INSERT', 'Tambah ''admin.dokumen.kartu-ujian'' [modul assessment]'),
  ('assessment.yudisium.eligibility.view', 'assessment', 'admin.yudisium', 'READ', 'Baca ''admin.yudisium'' [modul assessment]'),
  ('assessment.export.bulk', 'assessment', 'admin.ekspor.massal', 'OTHER', 'Aksi khusus ''admin.ekspor.massal'' [modul assessment]'),
  ('finance.tariff.view', 'finance', 'admin.keuangan.tarif', 'READ', 'Baca ''admin.keuangan.tarif'' [modul finance]'),
  ('finance.tariff.create', 'finance', 'admin.keuangan.tarif', 'INSERT', 'Tambah ''admin.keuangan.tarif'' [modul finance]'),
  ('finance.tariff.update', 'finance', 'admin.keuangan.tarif', 'UPDATE', 'Ubah ''admin.keuangan.tarif'' [modul finance]'),
  ('finance.invoice.view', 'finance', 'keuangan.tagihan', 'READ', 'Baca ''keuangan.tagihan'' [modul finance]'),
  ('finance.invoice.create', 'finance', 'admin.keuangan.tagihan', 'INSERT', 'Tambah ''admin.keuangan.tagihan'' [modul finance]'),
  ('finance.invoice.generate', 'finance', 'admin.keuangan.tagihan', 'INSERT', 'Tambah ''admin.keuangan.tagihan'' [modul finance]'),
  ('finance.invoice.update', 'finance', 'admin.keuangan.tagihan', 'UPDATE', 'Ubah ''admin.keuangan.tagihan'' [modul finance]'),
  ('finance.invoice.void', 'finance', 'bendahara.persetujuan', 'VALIDATE', 'Setujui ''bendahara.persetujuan'' [modul finance]'),
  ('finance.invoice.voidrequest', 'finance', 'admin.keuangan.tagihan', 'INSERT', 'Tambah ''admin.keuangan.tagihan'' [modul finance]'),
  ('finance.installment.view', 'finance', 'keuangan.tagihan', 'READ', 'Baca ''keuangan.tagihan'' [modul finance]'),
  ('finance.installment.create', 'finance', 'admin.keuangan.pembayaran', 'INSERT', 'Tambah ''admin.keuangan.pembayaran'' [modul finance]'),
  ('finance.payment.view', 'finance', 'keuangan.pembayaran', 'READ', 'Baca ''keuangan.pembayaran'' [modul finance]'),
  ('finance.payment.confirm', 'finance', 'bendahara.persetujuan', 'VALIDATE', 'Setujui ''bendahara.persetujuan'' [modul finance]'),
  ('finance.payment.record', 'finance', 'admin.keuangan.pembayaran', 'INSERT', 'Tambah ''admin.keuangan.pembayaran'' [modul finance]'),
  ('finance.deposit.view', 'finance', 'admin.keuangan.pembayaran', 'READ', 'Baca ''admin.keuangan.pembayaran'' [modul finance]'),
  ('finance.deposit.manage', 'finance', 'admin.keuangan.pembayaran', 'UPDATE', 'Ubah ''admin.keuangan.pembayaran'' [modul finance]'),
  ('finance.waiver.request', 'finance', 'admin.keuangan.keringanan', 'INSERT', 'Tambah ''admin.keuangan.keringanan'' [modul finance]'),
  ('finance.waiver.approve', 'finance', 'bendahara.persetujuan', 'VALIDATE', 'Setujui ''bendahara.persetujuan'' [modul finance]'),
  ('finance.ledger.view', 'finance', 'admin.keuangan.rekonsiliasi', 'READ', 'Baca ''admin.keuangan.rekonsiliasi'' [modul finance]'),
  ('finance.reconcile.run', 'finance', 'admin.keuangan.rekonsiliasi', 'UPDATE', 'Ubah ''admin.keuangan.rekonsiliasi'' [modul finance]'),
  ('finance.gate.view', 'finance', 'admin.pengaturan.gerbang', 'READ', 'Baca ''admin.pengaturan.gerbang'' [modul finance]'),
  ('finance.gate.override', 'finance', 'admin.pengaturan.gerbang', 'OTHER', 'Aksi khusus ''admin.pengaturan.gerbang'' [modul finance]'),
  ('finance.report.view', 'finance', 'admin.laporan', 'READ', 'Baca ''admin.laporan'' [modul finance]'),
  ('feeder.mapping.view', 'feeder_pddikti', 'admin.feeder', 'READ', 'Baca ''admin.feeder'' [modul feeder_pddikti]'),
  ('feeder.mapping.manage', 'feeder_pddikti', 'admin.feeder', 'UPDATE', 'Ubah ''admin.feeder'' [modul feeder_pddikti]'),
  ('feeder.validate.run', 'feeder_pddikti', 'admin.feeder', 'UPDATE', 'Ubah ''admin.feeder'' [modul feeder_pddikti]'),
  ('feeder.sync.run', 'feeder_pddikti', 'admin.feeder', 'UPDATE', 'Ubah ''admin.feeder'' [modul feeder_pddikti]'),
  ('feeder.sync.view', 'feeder_pddikti', 'admin.feeder', 'READ', 'Baca ''admin.feeder'' [modul feeder_pddikti]'),
  ('feeder.period.send', 'feeder_pddikti', 'admin.feeder', 'UPDATE', 'Ubah ''admin.feeder'' [modul feeder_pddikti]'),
  ('feeder.correction.request', 'feeder_pddikti', 'admin.feeder', 'INSERT', 'Tambah ''admin.feeder'' [modul feeder_pddikti]'),
  ('feeder.correction.approve', 'feeder_pddikti', 'admin.feeder', 'VALIDATE', 'Setujui ''admin.feeder'' [modul feeder_pddikti]'),
  ('feeder.credential.manage', 'feeder_pddikti', 'admin.feeder.kredensial', 'UPDATE', 'Ubah ''admin.feeder.kredensial'' [modul feeder_pddikti]'),
  ('audit.log.view', 'audit', 'admin.audit', 'READ', 'Baca ''admin.audit'' [modul audit]'),
  ('audit.chain.verify', 'audit', 'admin.audit', 'READ', 'Baca ''admin.audit'' [modul audit]'),
  ('audit.export', 'audit', 'admin.audit', 'OTHER', 'Aksi khusus ''admin.audit'' [modul audit]'),
  ('entitlement.module.view', 'entitlement', 'admin.modul', 'READ', 'Baca ''admin.modul'' [modul entitlement]'),
  ('entitlement.catalog.view', 'entitlement', 'admin.modul', 'READ', 'Baca ''admin.modul'' [modul entitlement]'),
  ('entitlement.module.activate', 'entitlement', 'admin.modul', 'UPDATE', 'Ubah ''admin.modul'' [modul entitlement]'),
  ('entitlement.module.deactivate', 'entitlement', 'admin.modul', 'UPDATE', 'Ubah ''admin.modul'' [modul entitlement]'),
  ('entitlement.seat.view', 'entitlement', 'admin.modul', 'READ', 'Baca ''admin.modul'' [modul entitlement]'),
  ('entitlement.seat.manage', 'entitlement', 'admin.modul', 'UPDATE', 'Ubah ''admin.modul'' [modul entitlement]'),
  ('entitlement.trial.grant', 'entitlement', 'admin.modul', 'INSERT', 'Tambah ''admin.modul'' [modul entitlement]'),
  ('platform.plan.view', 'platform', 'platform.paket', 'READ', 'Baca ''platform.paket'' [modul platform]'),
  ('platform.plan.manage', 'platform', 'platform.paket', 'UPDATE', 'Ubah ''platform.paket'' [modul platform]'),
  ('platform.tenant.view', 'platform', 'platform.tenant', 'READ', 'Baca ''platform.tenant'' [modul platform]'),
  ('platform.tenant.provision', 'platform', 'platform.tenant', 'INSERT', 'Tambah ''platform.tenant'' [modul platform]'),
  ('platform.tenant.suspend', 'platform', 'platform.tenant', 'UPDATE', 'Ubah ''platform.tenant'' [modul platform]'),
  ('platform.quota.manage', 'platform', 'platform.kuota', 'UPDATE', 'Ubah ''platform.kuota'' [modul platform]'),
  ('platform.flag.manage', 'platform', 'platform.kuota', 'UPDATE', 'Ubah ''platform.kuota'' [modul platform]'),
  ('platform.usage.view', 'platform', 'platform.utilisasi', 'READ', 'Baca ''platform.utilisasi'' [modul platform]'),
  ('platform.breakglass.use', 'platform', 'platform.breakglass', 'OTHER', 'Aksi khusus ''platform.breakglass'' [modul platform]'),
  ('settings.meta.view', 'settings', 'admin.meta-konfigurasi', 'READ', 'Baca ''admin.meta-konfigurasi'' [modul settings]'),
  ('settings.meta.update', 'settings', 'admin.meta-konfigurasi', 'UPDATE', 'Ubah ''admin.meta-konfigurasi'' [modul settings]'),
  ('document.letter.view', 'document', 'admin.persuratan', 'READ', 'Baca ''admin.persuratan'' [modul document]'),
  ('document.letter.create', 'document', 'admin.persuratan', 'INSERT', 'Tambah ''admin.persuratan'' [modul document]'),
  ('document.numbering.manage', 'document', 'admin.persuratan', 'UPDATE', 'Ubah ''admin.persuratan'' [modul document]'),
  ('document.tte.sign', 'document', 'admin.persuratan', 'UPDATE', 'Ubah ''admin.persuratan'' [modul document]'),
  ('master.kind.view', 'academic', 'admin.master.kamus', 'READ', 'Baca ''admin.master.kamus'' [modul academic]'),
  ('master.kind.manage', 'academic', 'admin.master.kamus', 'UPDATE', 'Ubah ''admin.master.kamus'' [modul academic]'),
  ('master.item.view', 'academic', 'admin.master.referensi', 'READ', 'Baca ''admin.master.referensi'' [modul academic]'),
  ('master.item.create', 'academic', 'admin.master.referensi', 'INSERT', 'Tambah ''admin.master.referensi'' [modul academic]'),
  ('master.item.update', 'academic', 'admin.master.referensi', 'UPDATE', 'Ubah ''admin.master.referensi'' [modul academic]'),
  ('master.item.deactivate', 'academic', 'admin.master.referensi', 'DELETE', 'Hapus ''admin.master.referensi'' [modul academic]'),
  ('master.item.reorder', 'academic', 'admin.master.referensi', 'UPDATE', 'Ubah ''admin.master.referensi'' [modul academic]'),
  ('master.item.merge', 'academic', 'admin.master.referensi', 'VALIDATE', 'Setujui ''admin.master.referensi'' [modul academic]'),
  ('master.impact.view', 'academic', 'admin.master.dampak', 'READ', 'Baca ''admin.master.dampak'' [modul academic]'),
  ('master.usage.view', 'academic', 'admin.master.pemakaian', 'READ', 'Baca ''admin.master.pemakaian'' [modul academic]'),
  ('master.lookup.consume', 'academic', 'master.lookup', 'READ', 'Baca ''master.lookup'' [modul academic]'),
  ('settings.customattr.view', 'settings', 'admin.atribut-kustom', 'READ', 'Baca ''admin.atribut-kustom'' [modul settings]'),
  ('settings.customattr.create', 'settings', 'admin.atribut-kustom', 'INSERT', 'Tambah ''admin.atribut-kustom'' [modul settings]'),
  ('settings.customattr.update', 'settings', 'admin.atribut-kustom', 'UPDATE', 'Ubah ''admin.atribut-kustom'' [modul settings]'),
  ('settings.customattr.activate', 'settings', 'admin.atribut-kustom', 'VALIDATE', 'Setujui ''admin.atribut-kustom'' [modul settings]'),
  ('settings.customattr.retire', 'settings', 'admin.atribut-kustom', 'DELETE', 'Hapus ''admin.atribut-kustom'' [modul settings]'),
  ('settings.customattr.value.view', 'settings', 'admin.atribut-nilai', 'READ', 'Baca ''admin.atribut-nilai'' [modul settings]'),
  ('settings.customattr.value.update', 'settings', 'admin.atribut-nilai', 'UPDATE', 'Ubah ''admin.atribut-nilai'' [modul settings]'),
  ('settings.customattr.history.view', 'settings', 'admin.atribut-riwayat', 'READ', 'Baca ''admin.atribut-riwayat'' [modul settings]'),
  ('settings.param.view.technical', 'settings', 'admin.parameters', 'READ', 'Baca ''admin.parameters'' [modul settings]'),
  ('settings.param.edit.technical', 'settings', 'admin.parameters', 'UPDATE', 'Ubah ''admin.parameters'' [modul settings]'),
  ('settings.param.view.ops', 'settings', 'admin.parameters', 'READ', 'Baca ''admin.parameters'' [modul settings]'),
  ('settings.param.edit.ops', 'settings', 'admin.parameters', 'UPDATE', 'Ubah ''admin.parameters'' [modul settings]'),
  ('settings.param.view.academic', 'settings', 'admin.parameters', 'READ', 'Baca ''admin.parameters'' [modul settings]'),
  ('settings.param.edit.academic', 'settings', 'admin.parameters', 'UPDATE', 'Ubah ''admin.parameters'' [modul settings]'),
  ('settings.param.view.financial', 'settings', 'admin.parameters', 'READ', 'Baca ''admin.parameters'' [modul settings]'),
  ('settings.param.edit.financial', 'settings', 'admin.parameters', 'UPDATE', 'Ubah ''admin.parameters'' [modul settings]'),
  ('settings.param.view.regulatory', 'settings', 'admin.parameters', 'READ', 'Baca ''admin.parameters'' [modul settings]'),
  ('settings.param.edit.regulatory', 'settings', 'admin.parameters', 'UPDATE', 'Ubah ''admin.parameters'' [modul settings]'),
  ('settings.param.view.security', 'settings', 'admin.parameters', 'READ', 'Baca ''admin.parameters'' [modul settings]'),
  ('settings.param.edit.security', 'settings', 'admin.parameters', 'UPDATE', 'Ubah ''admin.parameters'' [modul settings]'),
  ('settings.param.approve.regulatory', 'settings', 'admin.parameters', 'VALIDATE', 'Setujui ''admin.parameters'' [modul settings]'),
  ('settings.param.approve.security', 'settings', 'admin.parameters', 'VALIDATE', 'Setujui ''admin.parameters'' [modul settings]'),
  ('settings.param.register', 'settings', 'admin.parameters', 'INSERT', 'Tambah ''admin.parameters'' [modul settings]'),
  ('settings.param.history.view', 'settings', 'admin.parameter-history', 'READ', 'Baca ''admin.parameter-history'' [modul settings]'),
  ('settings.param.pattern.manage', 'settings', 'admin.parameter-grant', 'UPDATE', 'Ubah ''admin.parameter-grant'' [modul settings]'),
  ('platform.menu.view', 'entitlement', 'admin.menu', 'READ', 'Baca ''admin.menu'' [modul entitlement]'),
  ('platform.menu.manage', 'entitlement', 'admin.menu', 'UPDATE', 'Ubah ''admin.menu'' [modul entitlement]'),
  ('platform.menu.grant', 'entitlement', 'admin.menu', 'INSERT', 'Tambah ''admin.menu'' [modul entitlement]'),
  ('platform.menu.revoke', 'entitlement', 'admin.menu', 'DELETE', 'Hapus ''admin.menu'' [modul entitlement]')
ON CONFLICT (code) DO NOTHING;
-- <<< GEN:PERMISSIONS

-- ------------------------------------------------------------------------------
-- 8. Seed peran sistem per-tenant (DATA_MODEL §9: 15 role; `PLATFORM_OPERATOR`
--    hidup di lapisan platform sehingga TIDAK di-seed ke roles(tenant_id);
--    7 peran 🟡 RBAC_MATRIX §2 dibuat on-demand lewat /admin/pengguna/hak-akses).
-- ------------------------------------------------------------------------------
INSERT INTO roles (tenant_id, code, display_name, scope_kind, is_system)
SELECT t.id, v.code, v.display_name, v.scope_kind::role_scope_kind, true
FROM tenants t
CROSS JOIN (VALUES
  ('TENANT_ADMIN',      'Administrator Kampus',                  'TENANT'),
  ('ADMIN_ACADEMIC',    'Admin Akademik (BAAK)',                 'ORG'),
  ('HEAD_OF_PROGRAM',   'Ketua Program Studi',                   'PROGRAM'),
  ('LECTURER',          'Dosen Pengampu',                        'CLASS'),
  ('ADVISER',           'Dosen Pembimbing Akademik',             'PERIOD'),
  ('ADMIN_FINANCE',     'Admin Keuangan / UKT',                  'TENANT'),
  ('TREASURER',         'Bendahara (penyetuju void & keringanan)','TENANT'),
  ('LEADER',            'Pimpinan (Rektor/Warek/Dekan)',         'ORG'),
  ('FEEDER_OPERATOR',   'Operator Feeder PDDIKTI',               'TENANT'),
  ('STAFF',             'Tenaga Kependidikan',                   'ORG'),
  ('QUALITY_OFFICER',   'Penjaminan Mutu (SPMI/AMI)',             'ORG'),
  ('STUDENT',           'Mahasiswa',                             'SELF'),
  ('APPLICANT',         'Pendaftar PMB',                         'SELF'),
  ('GUARDIAN',          'Orang Tua/Wali',                        'SELF'),
  ('ALUMNI',            'Alumni',                                'SELF')
) AS v(code, display_name, scope_kind)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 8b. Grant peran → izin (607 pasangan, terhitung dari 17 blok di bawah). Sumber: SYSTEM_ROLE_GRANTS di
--     packages/contracts/src/authz.ts. Peran tanpa baris `roles` tenant
--     (PLATFORM_OPERATOR) otomatis terlewati oleh JOIN.
-- ------------------------------------------------------------------------------
-- >>> GEN:GRANTS
-- Diturunkan dari SYSTEM_ROLE_GRANTS (17 peran, 262 katalog).
-- PLATFORM_OPERATOR (38 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'PLATFORM_OPERATOR'
  AND p.code = ANY(ARRAY[
    'academic.denialreason.view',
    'academic.health.run',
    'academic.health.view',
    'academic.report.view',
    'audit.chain.verify',
    'audit.export',
    'audit.log.view',
    'entitlement.catalog.view',
    'entitlement.module.activate',
    'entitlement.module.deactivate',
    'entitlement.module.view',
    'entitlement.seat.manage',
    'entitlement.trial.grant',
    'identity.impersonation.grant',
    'identity.impersonation.revoke',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.profile.update',
    'identity.profile.view',
    'identity.session.revoke',
    'identity.session.view',
    'master.lookup.consume',
    'platform.breakglass.use',
    'platform.flag.manage',
    'platform.menu.grant',
    'platform.menu.manage',
    'platform.menu.revoke',
    'platform.menu.view',
    'platform.plan.manage',
    'platform.plan.view',
    'platform.quota.manage',
    'platform.tenant.provision',
    'platform.tenant.suspend',
    'platform.tenant.view',
    'platform.usage.view',
    'settings.customattr.value.view',
    'settings.param.view.security',
    'settings.param.view.technical'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- TENANT_ADMIN (97 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'TENANT_ADMIN'
  AND p.code = ANY(ARRAY[
    'academic.calendar.create',
    'academic.calendar.delete',
    'academic.calendar.update',
    'academic.calendar.view',
    'academic.denialreason.view',
    'academic.gate.configure',
    'academic.organization.create',
    'academic.organization.delete',
    'academic.organization.update',
    'academic.organization.view',
    'academic.period.close',
    'academic.period.create',
    'academic.period.update',
    'academic.period.view',
    'academic.periodreopen.request',
    'academic.program.create',
    'academic.program.update',
    'academic.program.view',
    'academic.rule.create',
    'academic.rule.update',
    'academic.rule.view',
    'academic.studentstatus.view',
    'audit.export',
    'audit.log.view',
    'entitlement.catalog.view',
    'entitlement.module.activate',
    'entitlement.module.deactivate',
    'entitlement.module.view',
    'feeder.credential.manage',
    'feeder.sync.view',
    'identity.accessrequest.approve',
    'identity.accessrequest.view',
    'identity.assignment.grant',
    'identity.assignment.revoke',
    'identity.assignment.view',
    'identity.impersonation.revoke',
    'identity.loginstats.view',
    'identity.membership.create',
    'identity.membership.update',
    'identity.membership.view',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.permission.view',
    'identity.profile.update',
    'identity.profile.view',
    'identity.role.create',
    'identity.role.delete',
    'identity.role.update',
    'identity.role.view',
    'identity.session.revoke',
    'identity.session.view',
    'identity.user.create',
    'identity.user.deactivate',
    'identity.user.update',
    'identity.user.view',
    'master.impact.view',
    'master.item.create',
    'master.item.deactivate',
    'master.item.merge',
    'master.item.reorder',
    'master.item.update',
    'master.item.view',
    'master.kind.manage',
    'master.kind.view',
    'master.lookup.consume',
    'platform.menu.grant',
    'platform.menu.manage',
    'platform.menu.revoke',
    'platform.menu.view',
    'settings.customattr.activate',
    'settings.customattr.create',
    'settings.customattr.history.view',
    'settings.customattr.retire',
    'settings.customattr.update',
    'settings.customattr.value.update',
    'settings.customattr.value.view',
    'settings.customattr.view',
    'settings.meta.update',
    'settings.meta.view',
    'settings.param.approve.regulatory',
    'settings.param.approve.security',
    'settings.param.edit.academic',
    'settings.param.edit.financial',
    'settings.param.edit.ops',
    'settings.param.edit.regulatory',
    'settings.param.edit.security',
    'settings.param.edit.technical',
    'settings.param.history.view',
    'settings.param.pattern.manage',
    'settings.param.register',
    'settings.param.view.academic',
    'settings.param.view.financial',
    'settings.param.view.ops',
    'settings.param.view.regulatory',
    'settings.param.view.security',
    'settings.param.view.technical',
    'student.status.change'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ADMIN_ACADEMIC (120 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN_ACADEMIC'
  AND p.code = ANY(ARRAY[
    'academic.blockade.create',
    'academic.blockade.release',
    'academic.blockade.view',
    'academic.calendar.create',
    'academic.calendar.delete',
    'academic.calendar.update',
    'academic.calendar.view',
    'academic.clearance.update',
    'academic.clearance.view',
    'academic.course.create',
    'academic.course.delete',
    'academic.course.update',
    'academic.course.view',
    'academic.curriculum.view',
    'academic.denialreason.view',
    'academic.document.print',
    'academic.document.view',
    'academic.equivalency.manage',
    'academic.equivalency.view',
    'academic.export.bulk',
    'academic.feedercode.update',
    'academic.feedercode.view',
    'academic.gate.view',
    'academic.guardian.create',
    'academic.guardian.update',
    'academic.guardian.view',
    'academic.health.run',
    'academic.health.view',
    'academic.impact.view',
    'academic.lecturer.create',
    'academic.lecturer.update',
    'academic.lecturer.view',
    'academic.monitoring.view',
    'academic.organization.create',
    'academic.organization.delete',
    'academic.organization.update',
    'academic.organization.view',
    'academic.period.view',
    'academic.prerequisite.create',
    'academic.prerequisite.delete',
    'academic.prerequisite.view',
    'academic.program.create',
    'academic.program.update',
    'academic.program.view',
    'academic.reference.manage',
    'academic.reference.view',
    'academic.report.view',
    'academic.room.create',
    'academic.room.delete',
    'academic.room.update',
    'academic.room.view',
    'academic.rule.create',
    'academic.rule.update',
    'academic.rule.view',
    'academic.student.archive',
    'academic.student.create',
    'academic.student.update',
    'academic.student.view',
    'academic.studentstatus.view',
    'academic.transcript.issue',
    'academic.transcript.view',
    'academic.transfer.approve',
    'academic.transfer.request',
    'assessment.export.bulk',
    'assessment.grade.view',
    'assessment.recompute',
    'attendance.record.update',
    'attendance.record.view',
    'attendance.summary.view',
    'enrollment.krs.view',
    'enrollment.krsedit.approve',
    'enrollment.krsedit.request',
    'enrollment.pack.apply',
    'enrollment.pack.view',
    'enrollment.scheme.view',
    'entitlement.module.view',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.profile.update',
    'identity.profile.view',
    'identity.session.revoke',
    'identity.session.view',
    'master.impact.view',
    'master.item.create',
    'master.item.deactivate',
    'master.item.merge',
    'master.item.reorder',
    'master.item.update',
    'master.item.view',
    'master.kind.manage',
    'master.kind.view',
    'master.lookup.consume',
    'master.usage.view',
    'platform.menu.view',
    'settings.customattr.history.view',
    'settings.customattr.value.update',
    'settings.customattr.value.view',
    'settings.customattr.view',
    'settings.param.edit.ops',
    'settings.param.view.academic',
    'settings.param.view.ops',
    'settings.param.view.regulatory',
    'student.status.change',
    'teaching.assignment.create',
    'teaching.assignment.update',
    'teaching.assignment.view',
    'teaching.class.create',
    'teaching.class.delete',
    'teaching.class.update',
    'teaching.class.view',
    'teaching.roomutilization.view',
    'teaching.schedule.create',
    'teaching.schedule.update',
    'teaching.schedule.view',
    'teaching.session.generate',
    'teaching.session.update',
    'teaching.session.view',
    'teaching.waitlist.manage',
    'teaching.waitlist.view',
    'teaching.workload.view'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HEAD_OF_PROGRAM (87 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'HEAD_OF_PROGRAM'
  AND p.code = ANY(ARRAY[
    'academic.course.create',
    'academic.course.delete',
    'academic.course.update',
    'academic.course.view',
    'academic.curriculum.create',
    'academic.curriculum.publish',
    'academic.curriculum.update',
    'academic.curriculum.view',
    'academic.denialreason.view',
    'academic.equivalency.manage',
    'academic.equivalency.view',
    'academic.export.bulk',
    'academic.guardian.view',
    'academic.health.view',
    'academic.impact.view',
    'academic.prerequisite.create',
    'academic.prerequisite.delete',
    'academic.prerequisite.view',
    'academic.program.view',
    'academic.rule.update',
    'academic.rule.view',
    'assessment.composition.create',
    'assessment.composition.update',
    'assessment.composition.view',
    'assessment.correction.approve',
    'assessment.correction.request',
    'assessment.examcard.view',
    'assessment.grade.lock',
    'assessment.grade.publish',
    'assessment.grade.view',
    'assessment.recompute',
    'assessment.scale.manage',
    'assessment.scale.view',
    'assessment.yudisium.eligibility.view',
    'attendance.call.view',
    'attendance.call.write',
    'attendance.qr.generate',
    'attendance.record.create',
    'attendance.record.update',
    'attendance.record.view',
    'attendance.summary.view',
    'enrollment.krs.approve',
    'enrollment.krs.batchapprove',
    'enrollment.krs.reject',
    'enrollment.krs.view',
    'enrollment.krsedit.approve',
    'enrollment.pack.apply',
    'enrollment.pack.view',
    'entitlement.module.view',
    'grading.unlock',
    'grading.value.write',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.profile.update',
    'identity.profile.view',
    'identity.session.revoke',
    'identity.session.view',
    'master.impact.view',
    'master.item.create',
    'master.item.reorder',
    'master.item.update',
    'master.item.view',
    'master.kind.view',
    'master.lookup.consume',
    'master.usage.view',
    'platform.menu.view',
    'settings.param.view.academic',
    'teaching.assignment.create',
    'teaching.assignment.delete',
    'teaching.assignment.update',
    'teaching.class.create',
    'teaching.class.delete',
    'teaching.class.update',
    'teaching.class.view',
    'teaching.roster.view',
    'teaching.schedule.create',
    'teaching.schedule.delete',
    'teaching.schedule.update',
    'teaching.schedule.view',
    'teaching.session.generate',
    'teaching.session.update',
    'teaching.session.view',
    'teaching.virtualroom.create',
    'teaching.virtualroom.view',
    'teaching.waitlist.manage',
    'teaching.waitlist.view',
    'teaching.workload.view'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- LECTURER (35 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'LECTURER'
  AND p.code = ANY(ARRAY[
    'academic.course.view',
    'academic.curriculum.view',
    'academic.denialreason.view',
    'academic.guardian.view',
    'assessment.composition.view',
    'assessment.correction.request',
    'assessment.examcard.view',
    'assessment.grade.lock',
    'assessment.grade.publish',
    'assessment.grade.view',
    'assessment.scale.view',
    'attendance.call.view',
    'attendance.call.write',
    'attendance.qr.generate',
    'attendance.record.create',
    'attendance.record.update',
    'attendance.record.view',
    'attendance.summary.view',
    'entitlement.module.view',
    'grading.value.write',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.profile.update',
    'identity.profile.view',
    'identity.session.revoke',
    'identity.session.view',
    'master.lookup.consume',
    'platform.menu.view',
    'teaching.class.view',
    'teaching.roster.view',
    'teaching.schedule.view',
    'teaching.session.update',
    'teaching.session.view',
    'teaching.virtualroom.view',
    'teaching.workload.view'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ADVISER (19 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADVISER'
  AND p.code = ANY(ARRAY[
    'academic.denialreason.view',
    'academic.student.view',
    'academic.studentstatus.view',
    'academic.transcript.view',
    'assessment.grade.view',
    'enrollment.krs.approve',
    'enrollment.krs.batchapprove',
    'enrollment.krs.recommend',
    'enrollment.krs.reject',
    'enrollment.krs.view',
    'entitlement.module.view',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.profile.update',
    'identity.profile.view',
    'identity.session.revoke',
    'identity.session.view',
    'master.lookup.consume',
    'platform.menu.view'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- FEEDER_OPERATOR (28 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'FEEDER_OPERATOR'
  AND p.code = ANY(ARRAY[
    'academic.calendar.view',
    'academic.denialreason.view',
    'academic.export.bulk',
    'academic.feedercode.update',
    'academic.feedercode.view',
    'academic.lecturer.view',
    'academic.program.view',
    'academic.report.view',
    'academic.student.view',
    'entitlement.module.view',
    'feeder.correction.request',
    'feeder.credential.manage',
    'feeder.mapping.manage',
    'feeder.mapping.view',
    'feeder.period.send',
    'feeder.sync.run',
    'feeder.sync.view',
    'feeder.validate.run',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.profile.update',
    'identity.profile.view',
    'identity.session.revoke',
    'identity.session.view',
    'master.lookup.consume',
    'platform.menu.view',
    'settings.param.view.academic',
    'settings.param.view.regulatory'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ADMIN_FINANCE (41 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN_FINANCE'
  AND p.code = ANY(ARRAY[
    'academic.blockade.create',
    'academic.blockade.view',
    'academic.denialreason.view',
    'academic.feedercode.view',
    'academic.gate.view',
    'academic.student.view',
    'academic.studentstatus.view',
    'entitlement.module.view',
    'finance.deposit.view',
    'finance.gate.override',
    'finance.gate.view',
    'finance.installment.create',
    'finance.installment.view',
    'finance.invoice.create',
    'finance.invoice.generate',
    'finance.invoice.update',
    'finance.invoice.view',
    'finance.invoice.voidrequest',
    'finance.ledger.view',
    'finance.payment.view',
    'finance.report.view',
    'finance.tariff.create',
    'finance.tariff.update',
    'finance.tariff.view',
    'finance.waiver.request',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.profile.update',
    'identity.profile.view',
    'identity.session.revoke',
    'identity.session.view',
    'master.item.view',
    'master.kind.view',
    'master.lookup.consume',
    'platform.menu.view',
    'settings.customattr.value.update',
    'settings.customattr.value.view',
    'settings.customattr.view',
    'settings.param.edit.ops',
    'settings.param.view.financial',
    'settings.param.view.ops'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- TREASURER (24 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'TREASURER'
  AND p.code = ANY(ARRAY[
    'academic.denialreason.view',
    'entitlement.module.view',
    'finance.deposit.manage',
    'finance.deposit.view',
    'finance.gate.view',
    'finance.installment.view',
    'finance.invoice.view',
    'finance.invoice.void',
    'finance.ledger.view',
    'finance.payment.confirm',
    'finance.payment.record',
    'finance.payment.view',
    'finance.reconcile.run',
    'finance.report.view',
    'finance.tariff.view',
    'finance.waiver.approve',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.profile.update',
    'identity.profile.view',
    'identity.session.revoke',
    'identity.session.view',
    'master.lookup.consume',
    'settings.param.view.financial'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- LEADER (31 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'LEADER'
  AND p.code = ANY(ARRAY[
    'academic.denialreason.view',
    'academic.document.print',
    'academic.document.view',
    'academic.export.bulk',
    'academic.organization.view',
    'academic.period.view',
    'academic.program.view',
    'academic.report.view',
    'assessment.yudisium.eligibility.view',
    'audit.log.view',
    'document.letter.view',
    'document.tte.sign',
    'enrollment.scheme.view',
    'entitlement.module.view',
    'feeder.sync.view',
    'finance.gate.view',
    'finance.invoice.view',
    'finance.report.view',
    'finance.waiver.approve',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.profile.update',
    'identity.profile.view',
    'identity.session.revoke',
    'identity.session.view',
    'master.lookup.consume',
    'platform.menu.view',
    'settings.customattr.activate',
    'settings.param.view.financial',
    'settings.param.view.ops',
    'settings.param.view.regulatory'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- STAFF (22 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'STAFF'
  AND p.code = ANY(ARRAY[
    'academic.denialreason.view',
    'academic.document.print',
    'academic.document.view',
    'academic.guardian.view',
    'academic.student.view',
    'attendance.record.update',
    'attendance.record.view',
    'document.letter.create',
    'document.letter.view',
    'enrollment.krs.view',
    'enrollment.krsedit.request',
    'entitlement.module.view',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.profile.update',
    'identity.profile.view',
    'identity.session.revoke',
    'identity.session.view',
    'master.lookup.consume',
    'platform.menu.view',
    'settings.customattr.value.update',
    'settings.customattr.value.view'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- STUDENT (32 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'STUDENT'
  AND p.code = ANY(ARRAY[
    'academic.blockade.view',
    'academic.denialreason.view',
    'academic.document.print',
    'academic.document.view',
    'academic.export.own',
    'academic.transcript.view',
    'assessment.grade.view',
    'attendance.qr.scan',
    'attendance.summary.view',
    'enrollment.effective.view',
    'enrollment.krs.submit',
    'enrollment.krs.view',
    'enrollment.krs.withdraw',
    'enrollment.waitlist.join',
    'enrollment.waitlist.leave',
    'entitlement.module.view',
    'finance.installment.view',
    'finance.invoice.view',
    'finance.payment.view',
    'finance.waiver.request',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.profile.update',
    'identity.profile.view',
    'identity.session.revoke',
    'identity.session.view',
    'master.lookup.consume',
    'platform.menu.view',
    'settings.customattr.value.update',
    'settings.customattr.value.view',
    'teaching.class.view',
    'teaching.session.view'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- APPLICANT (12 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'APPLICANT'
  AND p.code = ANY(ARRAY[
    'academic.denialreason.view',
    'entitlement.module.view',
    'finance.invoice.view',
    'finance.payment.view',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.profile.update',
    'identity.profile.view',
    'identity.session.revoke',
    'identity.session.view',
    'master.lookup.consume',
    'platform.menu.view'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- GUARDIAN (17 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'GUARDIAN'
  AND p.code = ANY(ARRAY[
    'academic.denialreason.view',
    'academic.transcript.view',
    'assessment.grade.view',
    'attendance.summary.view',
    'enrollment.krs.view',
    'entitlement.module.view',
    'finance.invoice.view',
    'finance.payment.view',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.profile.update',
    'identity.profile.view',
    'identity.session.revoke',
    'identity.session.view',
    'master.lookup.consume',
    'platform.menu.view',
    'teaching.session.view'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ALUMNI (12 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ALUMNI'
  AND p.code = ANY(ARRAY[
    'academic.denialreason.view',
    'academic.document.print',
    'academic.document.view',
    'academic.transcript.view',
    'entitlement.module.view',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.profile.update',
    'identity.profile.view',
    'identity.session.revoke',
    'identity.session.view',
    'platform.menu.view'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- QUALITY_OFFICER (27 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'QUALITY_OFFICER'
  AND p.code = ANY(ARRAY[
    'academic.curriculum.view',
    'academic.denialreason.view',
    'academic.export.bulk',
    'academic.program.view',
    'academic.report.view',
    'academic.rule.view',
    'assessment.grade.view',
    'assessment.yudisium.eligibility.view',
    'attendance.summary.view',
    'entitlement.module.view',
    'feeder.mapping.view',
    'feeder.sync.view',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.profile.update',
    'identity.profile.view',
    'identity.session.revoke',
    'identity.session.view',
    'master.item.view',
    'master.kind.view',
    'master.lookup.consume',
    'master.usage.view',
    'platform.menu.view',
    'settings.customattr.view',
    'settings.param.view.academic',
    'settings.param.view.regulatory',
    'teaching.class.view'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- COMPLIANCE_OFFICER (30 izin)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'COMPLIANCE_OFFICER'
  AND p.code = ANY(ARRAY[
    'academic.blockade.view',
    'academic.clearance.view',
    'academic.denialreason.view',
    'academic.period.view',
    'academic.report.view',
    'academic.rule.view',
    'audit.chain.verify',
    'audit.export',
    'audit.log.view',
    'entitlement.module.view',
    'feeder.sync.view',
    'finance.report.view',
    'identity.assignment.view',
    'identity.mfa.manage',
    'identity.password.reset',
    'identity.permission.view',
    'identity.profile.update',
    'identity.profile.view',
    'identity.role.view',
    'identity.session.revoke',
    'identity.session.view',
    'master.lookup.consume',
    'platform.menu.view',
    'settings.customattr.history.view',
    'settings.customattr.value.view',
    'settings.param.view.academic',
    'settings.param.view.ops',
    'settings.param.view.regulatory',
    'settings.param.view.security',
    'settings.param.view.technical'
  ]::text[])
ON CONFLICT (role_id, permission_id) DO NOTHING;
-- <<< GEN:GRANTS

-- ------------------------------------------------------------------------------
-- 8c. Backfill penugasan dari enum carrier `tenant_memberships.role`
--     (peta CARRIER_TO_ROLES RBAC_MATRIX §2.4) supaya resolver berbasis tabel
--     langsung punya data. Bukan grant manusia => origin='SEED'.
-- ------------------------------------------------------------------------------
INSERT INTO user_role_assignments
  (tenant_id, user_id, role_id, scope_student_id, origin, reason, valid_from)
SELECT tm.tenant_id, tm.user_id, r.id,
       CASE WHEN r.code = 'STUDENT' THEN s.id ELSE NULL END,
       'SEED',
       'migrasi 0011: perluasan carrier member_role ' || tm.role::text || ' -> ' || r.code,
       tm.joined_at
FROM tenant_memberships tm
JOIN (VALUES
  ('super_admin',  'PLATFORM_OPERATOR'),   -- tidak di-seed sebagai role tenant => 0 baris
  ('tenant_admin', 'TENANT_ADMIN'),
  ('tenant_admin', 'ADMIN_ACADEMIC'),
  ('tenant_admin', 'LEADER'),
  ('dosen',        'LECTURER'),
  ('dosen',        'ADVISER'),
  ('mahasiswa',    'STUDENT'),
  ('staff',        'STAFF'),
  ('staff',        'FEEDER_OPERATOR'),
  ('staff',        'QUALITY_OFFICER'),
  ('staff',        'COMPLIANCE_OFFICER')   -- role 🟡: baru terisi bila tenant membuatnya
) AS map(carrier, role_code) ON map.carrier = tm.role::text
JOIN roles r ON r.tenant_id = tm.tenant_id AND r.code = map.role_code
LEFT JOIN students s ON s.tenant_id = tm.tenant_id AND s.membership_id = tm.id
WHERE tm.status = 'ACTIVE'
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 9. RLS untuk tabel ber-tenant (generator §6.2) + katalog global SELECT-only.
-- ------------------------------------------------------------------------------
ALTER TABLE roles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles                   FORCE  ROW LEVEL SECURITY;
ALTER TABLE role_permissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions        FORCE  ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments   FORCE  ROW LEVEL SECURITY;
ALTER TABLE access_change_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_change_requests  FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON roles;
CREATE POLICY tenant_isolation ON roles
  AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id())
  WITH CHECK (tenant_id = app.tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON role_permissions;
CREATE POLICY tenant_isolation ON role_permissions
  AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id())
  WITH CHECK (tenant_id = app.tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON user_role_assignments;
CREATE POLICY tenant_isolation ON user_role_assignments
  AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id())
  WITH CHECK (tenant_id = app.tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON access_change_requests;
CREATE POLICY tenant_isolation ON access_change_requests
  AS PERMISSIVE FOR ALL TO public
  USING (tenant_id = app.tenant_id())
  WITH CHECK (tenant_id = app.tenant_id());

-- Katalog izin dibaca runtime, ditulis hanya lewat migrasi/operator.
-- Toleran managed DB: role sica_app mungkin tidak ada (Supabase) => dilewati.
DO $$ BEGIN
  GRANT  SELECT ON permissions TO sica_app;
  REVOKE INSERT, UPDATE, DELETE ON permissions FROM sica_app;
EXCEPTION WHEN others THEN RAISE NOTICE 'grant permissions ke sica_app dilewati (managed DB): %', SQLERRM; END $$;
