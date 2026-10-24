import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

const insertAfterLine = (file, needle, block, label) => {
  const lines = readFileSync(file, 'utf8').split(NL);
  const i = lines.findIndex((l) => l.includes(needle));
  if (i < 0) { console.error('ANCHOR hilang (' + label + ') di ' + file + ': ' + needle.slice(0, 46)); return; }
  lines.splice(i + 1, 0, ...block);
  writeFileSync(file, lines.join(NL), 'utf8');
  console.log('ok ' + label + ' @' + file);
};

// 1. §20.4 — kamus baru dari §23/§24 wajib terdaftar di katalog induk
insertAfterLine('docs/DATA_MODEL.md',
  '| Consent orang tua (dimensi terpisah) | `student_guardians.consent_*` |',
  [
    '| Jenis berkas yang wajib per jalur masuk | kamus `pmb_document_kind` (`reference_items`, C) | baru | §23.2 (`0021`) |',
    '| Sumber pembiayaan/awal masuk (label dirawat kampus) | kamus `funding_source` (`reference_items`, C) | baru | §23.2 (`0021`) |',
  ], 'kamus-PMB');

insertAfterLine('docs/DATA_MODEL.md',
  '| Versi kamus & kapan diambil | `reference_dictionary_versions` + `X-Lookup-Version` |',
  [
    '| Kategori berkas lampiran (bukti bayar, skripsi, legalisir, KTM, berkas impor, PDM/SPTJM, logo) | kamus `attachment_category` (`reference_items`, C) — bukan CHECK tertutup | baru | §23.1 (`0020`) |',
    '| Jenis dokumen terbit (ijazah, transkrip, SKPI, surat keterangan, SK) | kamus `document_type` (`reference_items`, C) + `document_number_sequences` per jenis | baru | §23.1 (`0020`) |',
    '| Jenis run impor massal (mahasiswa, tagihan, aset, nilai) | kamus `import_kind` (`reference_items`, C) | baru | §23.1 (`0020`) |',
    '| Program jaminan sosial (JHT/JKK/JKM/JP/PBU kelas) | `reference_dictionary_entries` (B — kode ditetapkan negara) + tarif berversi basis poin | baru | §24.2 (`0079`) |',
  ], 'kamus-platform');

// 2. AUDIT_READINESS — empat gap siklus ini
insertAfterLine('docs/AUDIT_READINESS.md',
  '| `RD-86` |',
  [
    '| `RD-87` | **Empat dimensi brief pemilik tidak punya rumah dokumen.** `node .tools/dimension-audit.mjs` (alat baru; 38 dimensi) mengukur: `GeoIP` **0**, `active session store` **0**, **`BPJS` 0**, **`EWMP` 0**, `Glassmorphism` **0**, `micro-interaction` hanya 1 berkas, `CLS` hanya 1 berkas. Untuk BPJS/EWMP ini lubang kepatuhan, bukan lubang selera: HRIS dan payroll tidak punya satu pun objek iuran, jadi pengembangan akan menaruh angka regulasi sebagai konstanta. | `PRD §5.17` (FR/BR/AC/NFR) · `DATA_MODEL §24` (`0078`–`0080`) · `ARCHITECTURE §13.8` · `ENV_CONTRACT §8` · `SECURITY_COMPLIANCE §14.2` · `RBAC §4.5.4` · `API_SPEC §7.33` · `UI_UX §19` · `ROADMAP §2.23` | **ditutup sebagai spesifikasi 2026-10-21**; verifikasi visual & angka peta tetap menunggu aplikasi berjalan |',
    '| `RD-88` | **Nomor `0078`–`0080` dan empat kunci parameter lahir di gugus baru tanpa melewati register induk lebih dulu.** Sesuai aturan `MIGRATION_SOP §5.1` butir 1, nomor diukur dari maksimum (bukan ditebak) lalu didaftarkan: `§6.2a` memuat ketiganya, dan katalog §21.3 bertambah baris 30–33 (`analytics.map.enabled`, `analytics.session.active_window_s`, `analytics.map.ip_retention_days`, `analytics.map.geo_source_priority`). | `MIGRATION_SOP §5/§6.2a`, `DATA_MODEL §21.3`/`§24.4`, `ENV_CONTRACT §8` | **ditutup siklus ini** — `heading-dup` + `ref-audit` hijau; `seed-count` membaca katalog dari dokumen, tidak dari angka yang disalin |',
    '| `RD-89` | **Saya menulis katalog §21.3 dengan blok yatim.** Baris 26–28 tercetak **dua kali**: sekali di dalam tabel (5216–5219) dan sekali sesudah catatan "Ralat penomoran" (5226–5228) sebagai baris lepas 6 kolom. `check-docs` hanya memeriksa konsistensi kolom, jadi ia lolos; `seed-count` ikut salah baca (ia melaporkan 34 baris untuk katalog yang seharusnya 29 sebelum §24). Blok yatim dihapus, baris 30–33 ditambahkan, dan angka rekap tidak lagi ditulis sebagai kalimat tapi sebagai keluaran alat. | `DATA_MODEL §21.3`, `.tools/seed-count.mjs`, `.tools/check-docs.mjs` (lubang bentuk, sama seperti `RD-80`) | **ditutup untuk datanya; lubang alat dinyatakan** — gerbang bentuk untuk baris tabel lepas masih PR-terbuka (`RD-80`) |',
  ], 'rd87-89');

// 3. Riwayat AUDIT_READINESS
insertAfterLine('docs/AUDIT_READINESS.md',
  '| 1.8 | 2026-10-21 |',
  ['| 1.9 | 2026-10-21 | **Siklus keempat — dimensi GIS, jaminan sosial/EWMP, dan mutu gerak.** Empat gap `RD-87`–`RD-89`. Isi: `.tools/dimension-audit.mjs` (38 dimensi brief) mengukur lima dimensi tanpa rumah; `DATA_MODEL §24` menulis `0078` (geografi sesi + view bucket `security_invoker`), `0079` (kepesertaan & iuran, tarif basis poin berversi, nomor peserta terenkripsi), `0080` (jejak EWMP `[VERIFIKASI-VENDOR]`, tanpa field karangan); `PRD §5.17` (`FR-GIS-01…05`, `FR-JAM-01…04`, `FR-MTN-01…06`, `BR-G11…G14`, `AC-GIS-1…6`, `NFR-GIS-1…3`/`NFR-MTN-1`/`NFR-JAM-1`); `ARCHITECTURE §13.8` (vonis 8 & 9: dua sumber koordinat berlabel, SSE bukan WebSocket ketiga, Redis dinyatakan design-only); `ENV_CONTRACT §8` (7 kunci); `SECURITY_COMPLIANCE §14.1`/`§14.2`; `RBAC §4.5.4` (10 nama usulan, sengaja tanpa nomor); `API_SPEC §7.33` (10 baris rute `spec-only`, nol nomor error baru); `UI_UX §19` (6 token gerak, skeleton sebagai kontrak tinggi, CLS 0.0 diukur, batas glassmorphism, widget peta dengan badge sumber); `ROADMAP §2.23` (`GEO-1…3`, `JAM-1`, `MTN-1`). Ralat diri: blok yatim baris 26–28 di katalog §21.3 dihapus (`RD-89`). |'],
  'riwayat-1.9');

// 4. INDEX — dua baris topik baru
insertAfterLine('docs/INDEX.md',
  '| Penjaga yang mengukur kelengkapan, bukan mengiklankannya |',
  [
    '| Peta sebaran sesi real-time (GIS), jaminan sosial + EWMP, mutu gerak & CLS | PRD.md + DATA_MODEL.md + ARCHITECTURE.md + UI_UX_DESIGN.md | `PRD §5.17` · `DATA_MODEL §24` (`0078`–`0080`) + §21.3 baris 30–33 · `ARCHITECTURE §13.8` · `ENV_CONTRACT §8` · `SECURITY §14.2` · `RBAC §4.5.4` (usulan) · `API_SPEC §7.33` · `UI_UX §19` · `ROADMAP §2.23` | spesifikasi — Redis/GeoIP/EWMP dinyatakan belum nyata |',
  ], 'index-baris-baru');
