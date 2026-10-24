import { readFileSync, writeFileSync } from 'node:fs';

const file = 'C:/SICA/docs/DATA_MODEL.md';
let s = readFileSync(file, 'utf8');
const rep = [];
const sub = (a, b, label) => {
  const ok = s.includes(a);
  if (ok) s = s.replace(a, b);
  rep.push(label + ': ' + (ok ? 'OK' : 'MISS'));
};

sub('Kebijkan (`kebijakan_rekonsiliasi`)', 'Kebijakan (`kebijakan_rekonsiliasi`)', 'typo-kebijakan');
sub('| Kode `F`/`O`/`M` PDDikti | `0049` kolom | **DITOLAH sementara** |', '| Kode `F`/`O`/`M` PDDikti | `0049` kolom | **DITOLAK sementara** |', 'typo-ditolak');
sub("  scope_kind text,                                         -- NULL = warisi penugasan peran; atau TENANT/ORG/PROGRAM/CLASS/SITE (§15.2, RBAC §4.6)",
  "  scope_kind text NOT NULL DEFAULT '',                -- '' = warisi penugasan peran; atau TENANT/ORG/PROGRAM/CLASS/SITE (§15.2, RBAC §4.6)",
  'scope-default');
sub("  UNIQUE (menu_id, permission_code, COALESCE(scope_kind, ''))\n);",
  "  UNIQUE (menu_id, permission_code, scope_kind),\n  CHECK (scope_kind IN ('', 'TENANT', 'ORG', 'SITE', 'PROGRAM', 'CLASS'))  -- penanda '' dipakai karena NULL tidak pernah bertabrakan dengan NULL di UNIQUE\n);",
  'unique-empty-marker');

const regRows = [
  '| §21 mesin parameter dinamis (DDL **ditulis** 2026-10-20) | `master_system_parameters`, `master_system_parameter_history`, `attendance_evidence` + `ALTER TYPE attendance_source` | ARCHITECTURE §12.18 & AGENTS §3.10, PRD FR-ADM-09/FR-ADM-25, UI_UX_DESIGN §14 | **ikat keras**: `CHECK (is_secret = false)` dan `CHECK (source_of_truth <> (ENV))` membuat parameter UI tidak pernah memegang kredensial; nilai wajib di dalam `min/max_value` (gerbang CI §21.8(2)) supaya satu klik tidak dapat melemahkan rotasi TOTP/radius geofence; kelas REGULATORY/SECURITY butuh penyetuju kedua; riwayat insert-only beralasan + ber-IP; **enam permintaan ditolak menjadi key-value** (band SKS per IPK, skala nilai, predikat, diskon, kanal VA, pola NIM) karena sudah punya tabel | `0049_system_parameters.sql` | usulan ADM-1 / R-2 |',
  '| §21.7 otorisasi tingkat mikro (DDL **ditulis** 2026-10-20) | `menu_items`, `menu_permissions`, `parameter_permissions` | RBAC_MATRIX §4.5 (`settings.param.*`, `platform.menu.*`), BLUEPRINT §3 (tree menu), PRD FR-ADM-26 | **ikat keras**: `permission_code` menunjuk katalog `permissions` yang ada — tabel ini **tidak boleh** menciptakan kosakata izin baru; evaluasi DENY-overrides-ALLOW lalu pola terspesifik; `menu_permissions` bersifat allowlist dan **penyaringan menu bukan kontrol akses** (gerbang L1-L6 tetap wajib); pola tanpa `note` ditolak saat review; hierarki menu maksimum kedalaman 4 diuji siklus | `0050_menu_parameter_permissions.sql` | usulan ADM-1 / R-2 |',
  '| §21.4 modus pembelajaran (arbitrase kosakata) | `classes.learning_modality`, `class_sessions.session_kind`, `attendance_source` + `LMS_ACTIVITY`/`WEBHOOK_EVENT` | API_SPEC §4.4 (tiga ejaan terukur), ARCHITECTURE §8 (dual mode), ADR-11 | **ikat keras**: `offline`->`ONSITE`, `hybrid`->`BLENDED`, `delivery_mode`->`learning_modality` (alias dilepas satu rilis setelah migrasi); kode PDDikti `F/O/M` **tidak dikarang** - `[VERIFIKASI-KAMUS]`, NULL berarti tidak ikut kirim (I-14); `attendances` tetap satu baris per (sesi, mahasiswa) apa pun kebijakan rekonsiliasinya | `0049_system_parameters.sql` | usulan R-3a/R-4/R-5 |',
].join('\n');

sub('\n**Catatan penomoran (diralat 2026-10-19 — `RD-20`):**',
  '\n' + regRows + '\n\n**Catatan penomoran (diralat 2026-10-19 — `RD-20`):**', 'register-21');

sub('nomor `0049` ke atas masih bebas.',
  'Nomor `0049_system_parameters.sql` dan `0050_menu_parameter_permissions.sql` **terpakai** sejak siklus berikutnya (`0049` lebih dulu karena `menu_permissions.permission_code` dan `parameter_permissions` sama-sama menunjuk katalog izin yang sudah ada, sementara `master_system_parameters.enum_kind` menunjuk `reference_kinds` hasil `0047`); nomor `0051` ke atas masih bebas.',
  'nomor-49-50');

sub('\n### 14.9 Aturan field-level access',
  '| `offline` / `hybrid` / `delivery_mode` (modus pembelajaran) | `API_SPEC §4.4` lower-case dan `DATA_MODEL §19.2` | **KALAH** — kosakata kanonik `learning_modality` = `ONSITE | ONLINE | BLENDED` (§21.4); `session_kind` adalah konsep berbeda (per pertemuan), bukan sinonim | §21.4 -> `0049` |\n' +
    '| `master_system_parameters` (parameter operasional) | permintaan pemilik | **MENANG sebagai rumah baru** untuk skalar kunci-tunggal; TIDAK memangsa `academic_rules`, `reference_items`, `tenant_custom_attributes`, `tenant_settings`, atau ENV (garis pemisah di §21.1) | §21.1-§21.3 -> `0049` |\n\n### 14.9 Aturan field-level access',
  'alias-21');

writeFileSync(file, s, 'utf8');
console.log(rep.join('\n'));

const lines = s.split('\n');
let bad = 0;
lines.forEach((line, i) => {
  for (let c = 0; c < line.length; c += 1) {
    const code = line.codePointAt(c);
    const hit = (code >= 0x3040 && code <= 0x30ff) || (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xac00 && code <= 0xd7af) || (code >= 0x0e00 && code <= 0x0e7f) || (code >= 0x0400 && code <= 0x04ff);
    if (hit) { bad += 1; console.log((i + 1) + ' U+' + code.toString(16).toUpperCase() + ' :: ' + line.slice(Math.max(0, c - 45), c + 45)); break; }
  }
});
console.log('non-Latin: ' + bad);
