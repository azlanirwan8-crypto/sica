import { readFileSync, writeFileSync } from 'node:fs';

const file = 'C:/SICA/docs/DATA_MODEL.md';
let s = readFileSync(file, 'utf8');
const rep = [];
const sub = (a, b, label) => {
  const ok = s.includes(a);
  if (ok) s = s.replace(a, b);
  rep.push(`${label}: ${ok ? 'OK' : 'TIDAK KETEMU'}`);
};

// 1) sisipan non-Latin + kata campur
sub('jenis kelamin, status perkawinan,血型→ golongan darah', 'jenis kelamin, status perkawinan, golongan darah', 'cjk-1') /* nonlatin-sampled: kutipan sah, lihat RD-59 */
sub('(cuti, mutasi,考核→penilaian pegawai)', '(cuti, mutasi, penilaian pegawai)', 'cjk-2') /* nonlatin-sampled: kutipan sah, lihat RD-59 */
sub('bila ukuran baju hanyaNeeded untuk mahasiswa', 'bila ukuran baju hanya dibutuhkan untuk mahasiswa', 'campur-1');
sub("pii_level text NOT NULL DEFAULT 'NONE' CHECK (pii_level IN ('NONE','ORDINARY','SPECIFIC','ENCrypted'))",
  "pii_level text NOT NULL DEFAULT 'NONE' CHECK (pii_level IN ('NONE','ORDINARY','SPECIFIC'))", 'pii-level');
sub(`  CHECK (NOT is_system OR approved_by IS NULL OR approved_at IS NULL
         OR (approved_by IS NOT NULL AND version = 1));   -- kind sistem berversi >1 harus lewat baris approval, bukan sunting senyap`,
  `  CHECK (approved_at IS NULL OR approved_by IS NOT NULL);   -- tidak ada "disahkan" tanpa penyetuju tercatat`, 'foureyes');

// 2) register §14.7 dua baris baru
sub('\n**Catatan penomoran (diralat 2026-10-19 — `RD-20`):**',
  '| §20 mesin data master dinamis (DDL **ditulis** 2026-10-20) | ALTER `reference_kinds` + ALTER `reference_items` + `reference_kind_usage` + view `master_lookup_groups`/`master_lookup_items` | ARCHITECTURE §11.1 (nol-API-key), PRD FR-ADM-07, BENCHMARK §2.5/§5 (±30 layar master Sevima), permintaan pemilik "zero-hardcoding" | **ikat keras**: satu fisik = `reference_kinds`/`reference_items`; nama `master_lookup_groups`/`master_lookup_items` **hanya view** dengan `security_invoker = true` (view `security_definer` menembus RLS); `reference_kind_usage` **global** → wajib masuk daftar pengecualian RLS §6.2; pilihan `SELECT`/`RADIO`/`CHECKBOX` **dilarang** disimpan sebagai array literal di mana pun (norma §20.1, gerbang CI m/n/o); urutan baca `sort_order, code` bukan `id`; `is_active=false` tetap terbaca lewat `?at=` (kewajiban arsip BR-R12) | `0047_master_lookup_engine.sql` | usulan ADM-1 / **R-2 (Fase 1B)** |\n' +
    '| §20.5 atribut kustom kampus (DDL **ditulis** 2026-10-20) | `tenant_custom_attributes`, `custom_attribute_history` + ALTER `attributes jsonb` pada `students`/`lecturers`/`staff`/`rooms`/`courses`/`invoices` | permintaan pemilik (EAV/JSONB), PRD FR-ADM-09 | **ikat keras**: EAV murni **ditolak** sebagai penyimpan nilai (JSONB + tabel definisi + riwayat hanya bila `is_tracked`); atribut **tidak boleh** menciptakan keadaan mesin (kelas A); `options_kind` wajib untuk input berpilihan; `feeder_mapping IS NULL` = tidak pernah ikut kirim; `pii_level=SPECIFIC` menolak `student_self_editable`; plafon 40 atribut `is_searchable` per entity (anti GIN menggerus jalur tulis); mengaktifkan butuh empat-mata; `custom_attribute_history` insert-only (`REVOKE` + pemicu §16.3) | `0048_custom_attributes.sql` | usulan ADM-1 / **R-2 (Fase 1B)** |\n' +
    '\n**Catatan penomoran (diralat 2026-10-19 — `RD-20`):**', 'register-20');

// 3) catatan penomoran: 0047/0048 terpakai
sub('Nomor `0047` ke atas masih bebas.',
  'Nomor `0047_master_lookup_engine.sql` dan `0048_custom_attributes.sql` **terpakai** mulai siklus ini (`0047` mendahului `0048` karena `tenant_custom_attributes.options_kind` menunjuk `reference_kinds` hasil `0047`); nomor `0049` ke atas masih bebas.', 'nomor-47-48');

// 4) alias §14.8
sub('\n### 14.9 Aturan field-level access',
  '| `master_lookup_groups` / `master_lookup_items` | permintaan siklus ini (mesin lookup generik) | **KALAH sebagai tabel**, **MENANG sebagai view** di atas `reference_kinds`/`reference_items` (§14.2, fisik tidak berubah) — `metadata` = alias `extra`, `sorting_order` = alias `sort_order`, `label` = alias `name`; view wajib `security_invoker = true` | §20.2 → `0047` |\n' +
    '| `room_wifi_allowlist` | `API_SPEC §4.3.9` butir 2 & baris error 64 | **KALAH** — ejaan final milik DATA_MODEL: `attendance_network_allowlists` (§18.6, `0041`) karena BSSID disimpan sebagai HMAC dan tabel itu dipakai bersama `attendance_fraud_findings`; API_SPEC wajib menunjuk nama ini saat gugus presensi diimplementasi | §18.6 & §14.7 |\n' +
    '| `attributes` / `attrs` / `metadata` (kolom JSONB bebas) | permintaan siklus ini | **`attributes` MENANG** sebagai kolom penyimpan nilai atribut kustom di tabel induk; `reference_items.extra` tetap untuk kamus; `metadata` **hanya** nama kolom di view | §20.5 & §20.2 |\n\n### 14.9 Aturan field-level access', 'alias-20');

// 5) pengecualian RLS §6.2
sub("'reference_kinds','reference_dictionary_entries','audit_logs'",
  "'reference_kinds','reference_kind_usage','reference_dictionary_entries','audit_logs'", 'rls-exception');

writeFileSync(file, s, 'utf8');
console.log(rep.join('\n'));

const lines = s.split('\n');
let bad = 0;
lines.forEach((line, i) => {
  for (let c = 0; c < line.length; c += 1) {
    const code = line.codePointAt(c);
    const hit = (code >= 0x3040 && code <= 0x30ff) || (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xac00 && code <= 0xd7af) || (code >= 0x0e00 && code <= 0x0e7f) || (code >= 0x0400 && code <= 0x04ff);
    if (hit) { bad += 1; console.log(`${i + 1} U+${code.toString(16).toUpperCase()} :: ${line.slice(Math.max(0, c - 45), c + 45)}`); break; }
  }
});
console.log('non-Latin:', bad);
