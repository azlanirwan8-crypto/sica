/**
 * apply-rbac-m02.mjs — menutup empat lubang M-02 di `RBAC_MATRIX.md` dengan bukti, bukan angka:
 *   (1) 31 baris katalog yang SUDAH ada (127–157: kamus, atribut kustom, enam kelas parameter)
 *       tidak menulis modulnya → laporan 48 modul mencetak `Izin = 2` untuk modul yang sebenarnya
 *       punya 31 titik aksi. Ini lubang pelabelan (`PRV-4`), bukan lubang fungsional.
 *   (2) Sepuluh titik aksi yang DITUNTUT rute `API_SPEC §4.14.5`, `§4.16.3`, `§4.16.7`, dan `§4.6.4`
 *       tetapi tidak pernah punya baris katalog: tanpa nomor, grant tidak bisa ditulis dan
 *       implementer akan menciptakan string izin di luar sumber kebenaran (`CRD-5b`, pola `G-15`).
 *   (3) M-02 tidak punya baris partisi §4.5.1 → `crud-matrix` memperlakukannya "CRUD penuh" karena
 *       tidak ada yang menyatakan verba mana yang sah untuk ruang namanya.
 *   (4) Baris menu §6.5 gugus B/E/G tidak menulis `M-02`, jadi kolom `Menu §6` hanya tersambung
 *       lewat kebetulan prefik rute.
 * Semua edit diverifikasi sebelum ditulis; satu jangkar meleset = berkas tidak disentuh.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const T = 'docs/RBAC_MATRIX.md';
let lines = readFileSync(T, 'utf8').split(NL);

/* ── (1) label baris 127–157 pada sel catatan ──────────────────────────────────────── */
const TARGET = new Set();
for (let n = 127; n <= 157; n++) TARGET.add(n);
let labeled = 0;
lines = lines.map((l) => {
  const m = l.match(/^\|\s*(\d{1,3})\s*\|/);
  if (!m || !TARGET.has(Number(m[1]))) return l;
  const c = l.split('|');
  if (c.length !== 9) {
    console.error('MERAH — baris ' + m[1] + ' punya ' + (c.length - 2) + ' sel; diharapkan 7 (bentuk gelombang 1–3).');
    process.exit(1);
  }
  if (/(?<![A-Za-z0-9])M-\d\d(?![0-9])/.test(l)) return l;
  c[7] = c[7].replace(/\s+$/, '') + ' · **M-02**';
  labeled++;
  return c.join('|');
});
if (labeled !== 31) { console.error('MERAH — hanya ' + labeled + ' baris yang dapat dilabeli; diharapkan 31.'); process.exit(1); }

/* ── (3) dua baris partisi (bukan SKU) ─────────────────────────────────────────────── */
const partIdx = lines.findIndex((l) => l.startsWith('| (bukan SKU) `entitlement`'));
if (partIdx < 0) { console.error('MERAH — jangkar partisi `entitlement` tidak ditemukan.'); process.exit(1); }
const partRows = [
  '| (bukan SKU) `master` | M-02 | `READ INSERT UPDATE DELETE VALIDATE OTHER` | kamus & data referensi: **bukan** gerbang jual (termasuk semua paket, PRD §5.12.3) tetapi tetap ruang nama izin yang bisa diagran — titik aksinya ber-nomor 127–136 + 145 + **319–320**; gerbangnya peran `TENANT_ADMIN`/`ADMIN_ACADEMIC`, bukan `tenant_modules.code` |',
  '| (bukan SKU) `settings` | M-02 | `READ INSERT UPDATE DELETE VALIDATE OTHER` | mesin parameter operasional + atribut kustom + meta-konfigurasi + kanal vicon sebagai konfigurasi: baris 137–144, 146–157, 292–294, **321–328**. Supaya tidak tertukar: tiket bantuan M-04 (288–290) memakai kolom resource `settings` tetapi kodenya ber-prefix `helpdesk.*`, dan partisi verba M-04 tetap milik baris `helpdesk` di atas — menambah M-02 di sini TIDAK mengubah tuntutan verba modul lain |',
];
lines.splice(partIdx + 1, 0, ...partRows);

/* ── (4) label M-02 pada sel Modul baris menu §6.5 ─────────────────────────────────── */
const MENU = [
  ['| B. Data Master | `/admin/master/kamus`, `/admin/master/referensi` |', 'academic'],
  ['| B. Data Master | `/admin/master/atribut-kustom` |', 'settings'],
  ['| E. Pengaturan | `/admin/pengaturan/parameter` |', 'settings'],
  ['| E. Pengaturan | `/admin/pengaturan/menu` |', 'tenant_modules'],
  ['| G. Impor | `/admin/impor` |', 'academic'],
];
for (const [prefix, ns] of MENU) {
  const i = lines.findIndex((l) => l.startsWith(prefix));
  if (i < 0) { console.error('MERAH — jangkar §6.5 tidak ditemukan: ' + prefix.slice(0, 58)); process.exit(1); }
  const c = lines[i].split('|');
  if (c[3].trim() !== '`' + ns + '`') {
    console.error('MERAH — sel Modul baris §6.5 bukan `' + ns + '` seperti yang dijanjikan (terbaca: ' + c[3].trim() + ').');
    process.exit(1);
  }
  if (/M-02/.test(lines[i])) { console.error('MERAH — baris §6.5 sudah menyebut M-02; tidak diduplikasi: ' + prefix.slice(0, 58)); process.exit(1); }
  const lain = (lines[i].match(/(?<![A-Za-z0-9])M-\d\d(?![0-9])/g) || []).join(',');
  if (lain) console.log('catatan — baris §6.5 "' + prefix.slice(0, 52) + '" sudah menyebut ' + lain + '; M-02 ditambahkan sebagai pemilik titik aksi, bukan sebagai pengganti.');
  c[3] = ' `' + ns + '` · M-02 ';
  lines[i] = c.join('|');
}

/* ── (2) gelombang 7: baris 319–328 ────────────────────────────────────────────────── */
const WAVE = [
  '#### 4.5.7 Katalog izin mesin parameter & data master (baris 319–328) — M-02 — 2026-10-21',
  '',
  '**Kenapa gelombang ini ada.** Kajian pakar M-02 (2026-10-21) menemukan sepuluh titik aksi yang **dituntut rute** di `API_SPEC §4.14.5`, `§4.16.3`, `§4.16.7`, dan `§4.6.4` tetapi tidak pernah punya baris katalog: tanpa nomor, grant tidak dapat ditulis dan implementer akan menciptakan string izin di luar sumber kebenaran (`AGENTS §3.8`, pola `G-15`). Sekalian dicatat: baris **127–157 yang sudah ada** kini menulis `M-02` pada kolom catatannya — sebelumnya modul ini dilaporkan memiliki 2 izin padahal 31 titiknya tersedia sejak gelombang 1–3; itu lubang pelabelan (`PRV-4`) dan angkanya sekarang diukur oleh `.tools/module-readiness.mjs`, bukan diketik.',
  '',
  '**Vonis kosakata yang dibuka di sini (ralat menimpa `G-29`).** Jalur impor didaftar sebagai `master.import.*`, **bukan** `platform.import.*` seperti yang tertulis di `ROADMAP §K-2` dan `API_SPEC` baris 1612: mengimpor data master adalah pekerjaan M-02, sedangkan `platform` adalah ruang nama permukaan platform M-01 (`§4.5.3`). Lalu `academic.reference.view` / `.manage` yang dipakai `API_SPEC §4.14` dan hidup di `packages/contracts/src/authz.ts` (baris 185–186) adalah **alias** dari `master.item.view` (129) + `master.kind.manage` (128); kanoniknya tetap yang ber-nomor, dan pemindahan nama di kode adalah task develop (gugus `SPE`), bukan izin baru. Keduanya ditulis di sini supaya tidak menjadi dua sumber kebenaran. Kolom `resource` pada sepuluh baris ini tetap memakai anggota `PERMISSION_MODULES` yang sah (`academic` untuk jalur impor, `settings` untuk mesin parameter) **walaupun** kodenya ber-prefix `master.`/`settings.`: prefix kode adalah ruang nama produk, enum 13 nilai itu adalah carrier lisensi — persis perbedaan yang didaftarkan sebagai `G-29`, dan `rbac-module-union` menolak kalau keduanya dicampur.',
  '',
  '| Nomor | Kode (`resource × verb`) | `resource` | Titik aksi | `verb` | Kebutuhan / modul / AC | Peran sasaran | MFA · SoD · penjaga | Status |',
  '|---|---|---|---|---|---|---|---|---|',
  '| 319 | `master.import.validate` | `academic` | `admin.impor` | `VALIDATE` | FR-ADM-15 · M-02 · **AC-ADM-2** | `TENANT_ADMIN`, `ADMIN_ACADEMIC`, `STAFF` (operator impor) | MFA tidak · **dua aksi berbeda**: yang memvalidasi bukan yang mengomit (`validate` bukan `commit`, SoD satu batch); temuan `BLOCK` berarti nol tulis, laporan memuat `row_number` + `check_code` + `suggested_fix` | usulan |',
  '| 320 | `master.import.commit` | `academic` | `admin.impor` | `INSERT` | FR-ADM-15 · M-02 · **AC-ADM-2** | `TENANT_ADMIN`, `ADMIN_ACADEMIC` | **MFA ya** · hanya batch yang hasil `validate`-nya masih tersimpan dan belum kedaluwarsa; `Idempotency-Key` wajib supaya tombol dua kali tidak berarti dua impor | usulan |',
  '| 321 | `settings.meta.view` | `settings` | `admin.institusi` | `READ` | FR-ADM-09 · M-02 · **AC-MD-10** | `TENANT_ADMIN`, `ADMIN_ACADEMIC`, `ADMIN_FINANCE`, dan peran tugas yang namanya terdaftar di `role_view` definisi atribut | MFA tidak · yang terbaca adalah **definisi** meta (label, urutan, visibilitas kolom, template laporan, blok tanda tangan), bukan nilai PII; proyeksi tetap server-side (`BLUEPRINT_ROLE_BY_ROLE §0.3`) | usulan |',
  '| 322 | `settings.meta.update` | `settings` | `admin.institusi` | `UPDATE` | FR-ADM-09 · M-02 · **AC-MD-10** | `TENANT_ADMIN`, `ADMIN_ACADEMIC` (hanya objek wilayahnya) | MFA ya · meta **tidak boleh** menciptakan keadaan mesin atau membuka kolom `SERVER_ONLY`; perubahan visibilitas kolom PII tercatat di `audit_logs` sebelum/sesudah dan wajib dibacakan ke peran subjek data (UU PDP 27/2022) | usulan |',
  '| 323 | `settings.param.register` | `settings` | `admin.parameters` | `INSERT` | FR-ADM-25 · FR-ADM-27 · M-02 · **AC-PG-9** | `TENANT_ADMIN` (tingkat ke-2 Admin IT Kampus) | MFA ya · kunci baru lahir dengan kelas + `min_value`/`max_value` + unit + modul pemilik; **penolakan enam rumah** tetap berlaku: permintaan yang rumahnya bukan parameter ditolak dengan sebab, bukan disimpan sebagai pasangan kunci-nilai | usulan |',
  '| 324 | `settings.param.pattern.manage` | `settings` | `admin.parameters` | `UPDATE` | FR-ADM-27 · M-02 · **AC-PG-4** | `TENANT_ADMIN` dengan penyetuju kedua yang berbeda dari pemohon | MFA ya · pola grant hanya **mempersempit** kewenangan dan tidak dapat melonggarkan rentang `CHECK` skema (`BR-PG2`); perubahan pola wajib `effective_from` + riwayat | usulan |',
  '| 325 | `settings.param.history.view` | `settings` | `admin.parameters` | `READ` | FR-ADM-24 · FR-ADM-25 · M-02 · **AC-PG-2** | `TENANT_ADMIN`, `COMPLIANCE_OFFICER`, `QUALITY_OFFICER`, peran audit | MFA tidak · riwayat hanya-tambah (`master_system_parameter_history`): nilai lama/baru, actor, waktu, alasan, IP, sumber permintaan, `parameter_version`. Tanpa izin ini tidak ada cara menjawab "ambang mana yang berlaku pada 14 Maret" (BR-R12) | usulan |',
  '| 326 | `settings.param.impact.view` | `settings` | `admin.parameters` | `READ` | FR-ADM-12 · M-02 · **AC-MD-9** | `TENANT_ADMIN`, `ADMIN_ACADEMIC`, `ADMIN_FINANCE`, `HEAD_OF_PROGRAM` | MFA tidak · pratinjau dampak **wajib dibaca sebelum** simpan atau nonaktifkan; isinya `surfaces[]` dari `reference_kind_usage` + pemakaian terhitung di bawah RLS + `offeredRemedy` saat penolakan | usulan |',
  '| 327 | `settings.param.approve.regulatory` | `settings` | `admin.parameter-approval` | `VALIDATE` | FR-ADM-27 · M-02 · **AC-PG-3** | `TENANT_ADMIN` **berbeda dari** `requested_by`; penyetuju kedua untuk kelas `REGULATORY` | **MFA ya** · empat-mata ditegakkan `CHECK` di DB (`0049`), bukan di UI; nilai berkeadaan `pending` tidak dipakai pembaca mana pun sampai disetujui | usulan |',
  '| 328 | `settings.param.approve.security` | `settings` | `admin.parameter-approval` | `VALIDATE` | FR-ADM-27 · BR-PG2 · M-02 · **AC-PG-3** · **AC-PG-4** | `TENANT_ADMIN` yang **tidak** memegang satu pun peran atas objek yang dipengaruhi ambangnya | **MFA ya** · kelas `SECURITY` (umur rotasi QR, radius geofence, ambang akurasi GPS, `totp_rotate_seconds`) tidak dapat dilonggarkan melewati rentang `min/max_value`; penolakan wajib menyebut butir `§4.7(b)` yang gagal | usulan |',
  '',
];
const anchor46 = lines.findIndex((l) => /^### 4\.6 Scope SITE/.test(l));
if (anchor46 < 0) { console.error('MERAH — jangkar `### 4.6 Scope SITE` tidak ditemukan.'); process.exit(1); }
lines.splice(anchor46, 0, ...WAVE, '');

const text = lines.join(NL);
if ((text.match(/^#### 4\.5\.7/gm) || []).length !== 1) { console.error('MERAH — §4.5.7 tidak tepat satu.'); process.exit(1); }
if ((text.match(/^\| 32[0-8] \| `/gm) || []).length !== 9) { console.error('MERAH — baris 320–328 tidak lengkap sembilan.'); process.exit(1); }
const rows = (text.match(/^\|\s*(\d{1,3})\s*\|\s*`/gm) || []).length;
writeFileSync(T, text, 'utf8');
console.log('HIJAU — 31 baris dilabeli M-02 · 2 baris partisi · 5 baris menu §6.5 · gelombang 7 (319–328) ditulis · total baris katalog ber-nomor = ' + rows);
