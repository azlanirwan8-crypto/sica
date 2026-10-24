/**
 * apply-ui-roadmap-m02.mjs — menutup lubang paling memalukan dari kajian M-02: dua layar yang
 * menjadi daya ungkit utama terhadap Sevima (`Data Pelengkap`/`Setting Prodi`) **belum pernah
 * dispesifikasi di `UI_UX_DESIGN.md` sama sekali**, dan meta-konfigurasi (FR-ADM-09) tidak punya
 * rute layar di berkas mana pun. Terukur 2026-10-21: `/admin/master/kamus` = 0 kemunculan di
 * UI_UX/API_SPEC/ROADMAP; `/admin/master/atribut-kustom` = 0; `/admin/pengaturan/meta` = 0.
 *
 * Aturan yang dijaga di sini: tidak mengarang primitif. Semua komposisi hanya memakai nama yang
 * ada di inventaris `UI_UX §11.3`; dua kekurangan primitif (tab dan sakelar) dinyatakan sebagai
 * task develop, bukan sebagai komponen yang "nanti ada".
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

/* ---------- UI_UX §9.10 ---------- */
const TU = 'docs/UI_UX_DESIGN.md';
let u = readFileSync(TU, 'utf8').split(NL);
const UI = [
  '### 9.10 Cluster Data Master & Parameter (M-02) — `/admin/master/**` dan `/admin/pengaturan/**` — 2026-10-21',
  '',
  '**Kenapa gugus ini ditulis sekarang.** Benchmark Sevima menaruh kekuatan terbesarnya pada `Data Pelengkap` (enam kategori master) dan `Setting Prodi` (sembilan tab per prodi-per-periode) — [BENCHMARK_SEVIMA §2.3 & §2.4(a)](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md). Setelah dipindai, M-02 punya 16 tabel berlabel, 43 baris katalog, dan 52 rute — tetapi **nol spesifikasi layar** untuk Kamus dan Atribut Kustom, dan meta-konfigurasi (FR-ADM-09) tidak punya alamat layar sama sekali. Mesin tanpa layar tidak bisa diuji oleh pengguna pertama, dan itu yang membuat modul ini "siap spesifikasi" tetapi tidak bisa diterima saat review.',
  '',
  '**Aturan komposisi.** Semua komponen di bawah adalah nama yang nyata ada di inventaris §11.3 (`PageHeader`, `VelzonDataGrid`, `Drawer`, `ConfirmDialog`, `Alert`, `Accordion`, `Field`/`Select`, `StatusBadge`, `Skeleton`, `StatCard`, `Toaster`). Yang tidak ada dinyatakan sebagai kekurangan, bukan dipakai seolah ada: **primitif tab belum ada** sehingga "satu layar bertab" (FR-ADM-19) hari ini dirender sebagai `Accordion` per gugus, dan **primitif sakelar belum ada** sehingga nyalakan/matikan parameter memakai `Button` + `StatusBadge` dengan konfirmasi. Membuat `tabs.tsx`/`switch.tsx` adalah task develop (`MDP-0` di [ROADMAP_TASKS.md](file:///c:/SICA/docs/ROADMAP_TASKS.md) §2.28), bukan klaim.',
  '',
  '| Layar | Alamat | Peran & aksi | Komposisi Velzon | State yang wajib ada | Penjaga yang terlihat di layar |',
  '|---|---|---|---|---|---|',
  '| Data Referensi bertab | `/admin/master/kamus` | `TENANT_ADMIN` C R U D · `ADMIN_ACADEMIC` C R U D · `HEAD_OF_PROGRAM` R U (kamus prodi) | `PageHeader` + `Accordion` per gugus (§20.4) → `VelzonDataGrid` (`ColumnDef` dari `reference_kinds`), `Drawer` detail berisi nilai + jendela berlaku + `feederCode`, `Field`/`Select` untuk `input_kind`, `ConfirmDialog` untuk `merge` | kosong ("gugus ini belum punya nilai"), muat (`Skeleton` grid), gagal (`Alert` + `offeredRemedy`), turun (`degraded` saat `reference_kind_usage` belum terbaca) | nonaktif ≠ hapus (AC-MD-3); dampak dibaca sebelum hapus (AC-MD-9) dengan daftar permukaan; `merge` butuh alasan + penyetuju berbeda (AC-MD-8); kode kelas B terkunci, label boleh dipetakan (AC-MD-7) |',
  '| Atribut Kustom | `/admin/master/atribut-kustom` | `TENANT_ADMIN` C R U D · peran lain hanya R/U nilai sesuai `role_view`/`role_edit` | `PageHeader` + `StatCard` (jumlah atribut aktif / terspesialisasi / ber-PII) → `VelzonDataGrid` definisi, `Drawer` form definisi (tipe, regex, wajib, `options_kind`, scope, PII), tab riwayat sebagai `Accordion` | kosong, muat, gagal (`CUSTOM_ATTR_REGEX_FAILED`, `CUSTOM_ATTR_LIMIT_EXCEEDED`, `CUSTOM_ATTR_READONLY_FOR_ROLE`), batas tercapai (plafon 40 terspesialisasi) | atribut tidak dapat menciptakan keadaan mesin (AC-MD-5); berpilihan wajib menunjuk kamus; aktivasi butuh empat-mata + MFA; nilai `SERVER_ONLY` tidak pernah diterima dari body (AC-MD-10) |',
  '| Parameter Sistem | `/admin/pengaturan/parameter` | `TENANT_ADMIN` (Admin IT) R C U + `approve.*` untuk kelas REGULATORY/SECURITY · peran tugas hanya R pada kelasnya | `PageHeader` + filter kelas (`Select` enam nilai enum) + `q` + `VelzonDataGrid` (key, nilai berlaku, unit, rentang `min/max`, modul pemilik, `parameter_version`) → `Drawer` riwayat hanya-tambah + pratinjau dampak | kosong, muat, **`pending`** (badge "menunggu persetujuan" — nilainya tidak dipakai pembaca mana pun), gagal dengan sebab `BR-PG1` ("rumahnya bukan di sini"), turunkan versi (`?at=`) | ambang keamanan tidak dapat dilonggarkan melewati rentang `CHECK` (AC-PG-4); MFA + penyetuju kedua untuk `REGULATORY`/`SECURITY` (AC-PG-3); berlaku tanpa rilis < 60 detik (AC-PG-1) dan itu yang dijanjikan di layar, bukan angka lain |',
  '| Meta Konfigurasi Form & Laporan | `/admin/pengaturan/meta` (alamat baru, sebelumnya tidak ada di dokumen mana pun) | `TENANT_ADMIN` R U · `ADMIN_ACADEMIC` R U (objek wilayahnya) | `PageHeader` + `Accordion` per entitas → daftar kolom (`VelzonDataGrid`: kolom, label ID/EN, urutan, visibilitas per peran), blok tanda tangan & template laporan sebagai `Drawer` | kosong (belum ada meta terspesialisasi → tampilkan bawaan), muat, gagal (`400` bila mencoba membuka kolom `SERVER_ONLY`), berhasil (preview dua bahasa) | visibilitas adalah **proyeksi server**, bukan sembunyikan sel (AC-MD-10); perubahan kolom PII tercatat before/after + dibacakan ke peran subjek data; paritas Web↔Flutter diuji dari satu sumber baca |',
  '| Impor Data Master | `/admin/impor` | `TENANT_ADMIN`/`ADMIN_ACADEMIC` R V C (dua aksi berbeda: `master.import.validate` 319 lalu `.commit` 320) | `PageHeader` + tiga langkah (`StepIndicator` ditulis sebagai `Accordion` tertutup sampai primitif stepper ada) → `StatCard` baris valid/tidak-valid → `VelzonDataGrid` temuan (`row_number`, `check_code`, `suggested_fix`) → `ConfirmDialog` komit | unggah, memeriksa (progress), **BLOCK ditemukan → tombol Komit nonaktif dengan sebab**, komit ganda ditolak `Idempotency-Key` | all-or-nothing pada temuan BLOCK (AC-ADM-2); nol baris tertulis sebelum komitmen; 11 pemeriksaan Feeder ditampilkan apa adanya |',
  '| Editor Menu & Grant | `/admin/pengaturan/menu` | `TENANT_ADMIN` C R U D · `PLATFORM_OPERATOR` R U lintas-tenant (hanya lewat permukaan M-01) | `PageHeader` + `Drawer` pohon dua lapis (WEB/MOBILE) dengan `Badge` per platform, `VelzonDataGrid` grant (`ALLOW`/`DENY`), `Alert` dampak peran sebelum simpan | kosong (tenant baru = pohon bawaan), muat, siklus ditolak, kedalaman > 4 ditolak | **menu bukan kontrol akses** — deny menang dan gerbang server tetap `requireDataPrincipal` + scope (AC-PG-8); kedalaman maksimum empat, tanpa siklus (FR-ADM-26) |',
  '',
  '**Yang sengaja tidak dijanjikan di gugus ini.** (a) Pratinjau "dua panel" untuk template laporan — butuh primitif split-view yang belum ada; (b) penyunting pohon menu dengan drag-drop — belum ada primitif `sortable`, dan urutan kolom kamus sudah aman dengan `sort_order` + tombol naik/turun; (c) pencarian global di header — rutenya belum ada (§11.4), jadi layar ini tidak memakainya seolah sudah hidup.',
  '',
];
const iUi = u.findIndex((l) => /^### 9\.9 / .test(l));
if (iUi < 0) { console.error('MERAH — §9.9 tidak ditemukan sebagai anchor insertion.'); process.exit(1); }
let endUi = u.length;
for (let i = iUi + 1; i < u.length; i++) if (/^#{2,3} [0-9]/.test(u[i])) { endUi = i; break; }
u.splice(endUi, 0, ...UI, '');

/* ---------- ROADMAP §2.28 ---------- */
const TR = 'docs/ROADMAP_TASKS.md';
let r = readFileSync(TR, 'utf8').split(NL);
const RM = [
  '### 2.28 Gugus MDP — layar data master & parameter M-02 (2026-10-21, hasil kajian pakar M-02)',
  '',
  '**Masalah yang ditutup.** M-02 adalah satu-satunya penulis kamus, parameter, atribut kustom, dan pola NIM (`PRD §5.12`), spesifikasinya lengkap (16 tabel, 43 baris katalog, 52 rute) — tetapi tidak satu pun layar Kamus/Atribut/Meta pernah ditulis di `UI_UX_DESIGN.md`. Gugus ini menagih layar, bukan mesinnya. Semua task di bawah **ditahan** `DEV-G2`/`DEV-G3`/`DEV-G7` + `CI-G1…CI-G7` seperti gugus lain: tidak ada kode sebelum tiga lapis penegakan punya pemanggil produksi dan migrasi tertanam di pipeline.',
  '',
  '- [ ] **MDP-0 — Dua primitif yang belum ada: `tabs.tsx` dan `switch.tsx`.** *Kenapa:* FR-ADM-19 menuntut satu layar bertab dan FR-ADM-25 menuntut nyalakan/matikan beralasan, sementara inventaris `UI_UX §11.3` tidak punya keduanya; hari ini keduanya dirender sebagai `Accordion` + `Button` (didokumentasikan, bukan disembunyikan). *DoD:* komponen ada di `apps/web/src/components/ui/`, terdaftar di §11.3 oleh penulisnya, dan dipakai layar kamus/parameter. *Tidak ditagih:* gaya visual baru — token Velzon yang ada dipakai apa adanya.',
  '- [ ] **MDP-1 — `/admin/master/kamus` + `/admin/master/atribut-kustom`.** *Rute API:* `GET/POST/PUT/DELETE /admin/master/lookups`, `GET /admin/master/lookups/impact`, `POST /admin/master/lookups/items/{id}/merge`, `GET/POST /admin/master/custom-attributes`, `PATCH .../{id}/activate|retire`. *Izin:* baris 127–136 + 137–144. *Layar:* `UI_UX §9.10` baris 1–2. *DoD terukur:* menambah satu nilai kamus dari UI mengubah dropdown di dua platform tanpa deploy (AC-MD-2); menonaktifkan nilai terpakai tidak mengubah laporan periode lama (AC-MD-3); `merge` tanpa alasan → `422`, tujuan yang sudah melebur → `409 LOOKUP_MERGE_CYCLE` (AC-MD-8); hapus nilai terpakai → `409 LOOKUP_ITEM_IN_USE` **dengan** `offeredRemedy` (AC-MD-9).',
  '- [ ] **MDP-2 — `/admin/pengaturan/parameter` dengan riwayat + dampak + persetujuan.** *Rute API:* `GET /admin/system-parameters`, `GET /admin/system-parameters/{key}/history|impact`, `POST .../request-approval|revert`, `PATCH .../toggle-active`, `POST /admin/system-parameter-approvals/{id}/approve|reject`. *Izin:* 146–157 + **323–328** (gelombang §4.5.7). *DoD terukur:* nilai `pending` tidak terbaca `GET /settings/effective`; perubahan kelas `SECURITY` di luar rentang `min/max_value` ditolak `CHECK` (AC-PG-4); pemohon = penyetuju ditolak (AC-PG-3); dari setujui sampai terbaca di kedua platform < 60 detik tanpa restart (AC-PG-1).',
  '- [ ] **MDP-3 — `/admin/pengaturan/meta` (layar baru).** *Rute API:* `settings.meta.view` **321** / `.update` **322**. *DoD terukur:* satu perubahan label kolom tampil identik di Web dan Flutter tanpa deploy; permintaan yang menandai kolom `SERVER_ONLY` sebagai dapat-disunting ditolak di transport; perubahan visibilitas kolom PII meninggalkan `audit_logs` before/after dan dapat dibaca oleh peran subjek data (AC-MD-10).',
  '- [ ] **MDP-4 — `/admin/impor` tiga langkah dengan dua izin berbeda.** *Rute API:* `POST /admin/impor/validate`, `POST /admin/impor/commit`, `GET /admin/impor/:id`. *Izin:* **319–320** (`master.import.*`; sebelumnya bernama `platform.import.*` di `§K-2` — ruang namanya dikoreksi, impor data master bukan permukaan platform). *DoD terukur:* satu baris berstatus BLOCK ⇒ **nol** baris tertulis dan laporan memuat `row_number` + `check_code` + `suggested_fix` (AC-ADM-2); komit kedua dengan `Idempotency-Key` sama tidak menghasilkan dobel tulis.',
  '- [ ] **MDP-5 — `/admin/pengaturan/menu` editor pohon + grant.** *Rute API:* `GET/POST/PATCH/DELETE /admin/platform/menus*`, `PUT /admin/platform/menus/{id}/permissions`. *Izin:* 158–161. *DoD terukur:* pohon kedalaman > 4 atau bersiklus ditolak; `DENY` menang atas `ALLOW`; uji penolak "menu tersembunyi tapi rute masih dapat ditulis" wajib gagal di CI — penyaringan menu bukan kontrol akses (AC-PG-8, `SEC-09`).',
  '- [ ] **MDP-6 — Promosi nama izin di kode ke kanonik katalog.** `packages/contracts/src/authz.ts` hari ini memuat `academic.reference.view`/`.manage` (baris 185–186) yang secara katalog adalah `master.item.view` (129) + `master.kind.manage` (128). *DoD:* satu mapper alias yang teruji, tidak ada dua nama hidup untuk satu titik aksi, dan `perm-phantom` tidak menambah hantu baru. *Kenapa ini task, bukan catatan:* `G-29` sudah mendaftar bahwa prefiks baru tidak punya register alias; membiarkan nama di kode berbeda dari katalog adalah cara paling cepat melahirkan dua sumber kebenaran.',
  '',
  '**Yang tidak ditagih gugus ini:** migrasi `0047`–`0050` (sudah terdaftar dan menjadi milik `SPE-*`/`MDE-*`, lihat §2.5 dan §2.11), seed kamus nasional (milik `SEED_DATA §8` + `seed-count`), dan keputusan manusia `CRD-5b` atas izin yang masih berstatus `usulan`.',
  '',
];
const iRmAnchor = r.findIndex((l) => /^### 2\.27 Gugus `PLT`/.test(l));
if (iRmAnchor < 0) { console.error('MERAH — §2.27 tidak ditemukan sebagai anchor.'); process.exit(1); }
let endRm = r.length;
for (let i = iRmAnchor + 1; i < r.length; i++) if (/^## /.test(r[i])) { endRm = i; break; }
r.splice(endRm, 0, ...RM, '');

writeFileSync(TU, u.join(NL), 'utf8');
writeFileSync(TR, r.join(NL), 'utf8');
if ((u.join(NL).match(/^### 9\.10 /gm) || []).length !== 1 || (r.join(NL).match(/^### 2\.28 /gm) || []).length !== 1) {
  console.error('MERAH — penempatan heading tidak tepat satu.'); process.exit(1);
}
console.log('HIJAU — UI_UX §9.10 (enam layar M-02) + ROADMAP §2.28 (MDP-0…MDP-6) ditulis.');
