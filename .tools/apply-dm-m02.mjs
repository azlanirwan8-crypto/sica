/**
 * apply-dm-m02.mjs — melabeli heading DDL milik M-02 dengan token modul, supaya kolom `Tabel`
 * pada laporan 48 modul mengukur kebenaran dan bukan ketiadaan label (`PRV-4`).
 *
 * Attributor pemilik angka ini adalah `module-provenance.ddlBernamaModul()`: sebuah `CREATE TABLE`
 * dihitung untuk setiap `M-xx` yang disebut pada HEADING TERDEKAT, dan heading tanpa token MEMUTUS
 * atribusi (tidak mewarisi). Karena itu label harus duduk di heading yang benar-benar membawahi
 * tabel M-02 — dan kalau satu heading membawahi tabel modul lain juga, ia harus dipecah lebih
 * dulu, bukan dilabeli longgar (kelas cacat `RD-104`: menuduh/melebihi karena pelabelan yang salah
 * tempat).
 *
 * Semua edit berbentuk "tempel kalau jangkar persis sama"; satu jangkar tidak cocok = berkas tidak
 * ditulis. Setelah tulis, skrip memverifikasi jumlah heading baru dan tidak mengurangi jumlah baris
 * `CREATE TABLE`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const T = 'docs/DATA_MODEL.md';
const src = readFileSync(T, 'utf8');
const lines = src.split(NL);
const before = lines.filter((l) => /^CREATE TABLE /.test(l.trim())).length;

const edits = [];
const rep = (needle, value, why) => { edits.push({ needle, value, why }); };

/* 1–2. heading tematik yang memang satu pemilik */
rep('### 14.2 Keputusan model: kamus data referensi', '### 14.2 Keputusan model: kamus data referensi (M-02)', 'reference_kinds + reference_items');
rep('### 20.3 Yang kurang dari `reference_kinds` untuk menjadi mesin', '### 20.3 Yang kurang dari `reference_kinds` untuk menjadi mesin (M-02)', 'reference_kind_usage');
rep('### 20.5 Atribut kustom dinamis (EAV vs JSONB)', '### 20.5 Atribut kustom dinamis (EAV vs JSONB) — M-02', 'tenant_custom_attributes + custom_attribute_history');
rep('### 21.2 `master_system_parameters` — `0049_system_parameters.sql`', '### 21.2 `master_system_parameters` — `0049_system_parameters.sql` (M-02)', 'master_system_parameters + riwayatnya');
rep('### 21.7 `menu_items`, `menu_permissions`, `parameter_permissions`', '### 21.7 `menu_items`, `menu_permissions`, `parameter_permissions` (M-02)', 'pohon menu + grant sebagai data');

/* 3. §14.3 membawahi tabel empat modul berbeda → dipecah, bukan dilabeli longgar */
rep('CREATE TABLE tenant_settings (', '#### 14.3.1 Konfigurasi tenant — `tenant_settings` (M-02)' + NL + NL + 'CREATE TABLE tenant_settings (', 'label untuk tenant_settings saja');
rep('CREATE TABLE enrollment_schemes (', '#### 14.3.2 Skema enrollment, ekivalensi, dan riwayat status (objek modul lain — bukan M-02)' + NL + NL + 'CREATE TABLE enrollment_schemes (', 'memutus atribusi M-02 sebelum tabel modul lain');

/* 4. §26.11 membawahi jembatan Feeder DAN kamus nasional → dipecah dua sub-heading berlabel */
rep('CREATE TABLE feeder_environments (', '#### 26.11.1 Jembatan kirim & kredensial (M-34)' + NL + NL + 'CREATE TABLE feeder_environments (', 'objek M-34 tidak boleh dihitung untuk M-02');
rep('CREATE TABLE reference_dictionary_versions (', '#### 26.11.2 Kamus nasional kelas B berversi — M-02 pemilik kode, M-34 pemakai' + NL + NL + 'CREATE TABLE reference_dictionary_versions (', 'class B: dua modul punya kepentingan, pelabelan eksplisit');

let text = lines.join(NL);
for (const e of edits) {
  const n = text.split(e.needle).length - 1;
  if (n !== 1) {
    console.error('MERAH — jangkar "' + e.needle.slice(0, 56) + '" cocok ' + n + ' kali (dijadwalkan 1). Berkas tidak ditulis.');
    process.exit(1);
  }
  text = text.replace(e.needle, e.value);
}
const after = text.split(NL).filter((l) => /^CREATE TABLE /.test(l.trim())).length;
if (after !== before) { console.error('MERAH — jumlah `CREATE TABLE` berubah ' + before + ' → ' + after + '. Tidak ditulis.'); process.exit(1); }
const newHeads = (text.match(/^#{4} (14\.3\.[12]|26\.11\.[12])/gm) || []).length;
if (newHeads !== 4) { console.error('MERAH — empat sub-heading baru tidak semuanya muncul (dapat ' + newHeads + ').'); process.exit(1); }
writeFileSync(T, text, 'utf8');
console.log('HIJAU — 5 heading dilabeli + 4 sub-heading baru; `CREATE TABLE` tetap ' + after + '.');
