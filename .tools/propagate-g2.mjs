import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const rep = [];
const F = (n) => `C:/SICA/docs/${n}`;

// (a) DATA_MODEL — penutupan rujukan API_SPEC baris 102
let dm = readFileSync(F('DATA_MODEL.md'), 'utf8');
const key = 'yang dibutuhkan auditor hanya bukti';
const i = dm.indexOf(key);
if (i < 0) {
  rep.push('dm-18.6: TIDAK KETEMU');
} else {
  const nl = dm.indexOf('\n', i);
  dm = dm.slice(0, nl) +
    '\n\n**Penutupan rujukan API_SPEC.** Pergerakan mustahil **tidak** menambah nilai pada kolom `result` di `attendance_token_uses`; ia adalah sinyal `impossible_travel_m` di `attendance_fraud_findings.signals` dengan vonis `REJECTED_FRAUD_SUSPECT` — dua-duanya sudah ada di blok di atas. Karena itu `API_SPEC` baris 102 (`ATTENDANCE_IMPOSSIBLE_TRAVEL`) tidak menuntut perluasan kosakata DB, dan tidak ada "status presensi" kedua yang hidup hanya di kontrak.' +
    dm.slice(nl);
  rep.push('dm-18.6: OK');
}
writeFileSync(F('DATA_MODEL.md'), dm, 'utf8');

const bt = '`';
const tc = [
  '',
  '---',
  '',
  '## 7. Dependensi design-only & gerbang CI nol-API-key / nol-hardcoding — 2026-10-20',
  '',
  'Norma pemilik: **AGENTS §3.9** (nol-API-key) dan **AGENTS §3.10** (nol-hardcoding data master). Tabel ini adalah daftar **yang belum terpasang** — pola pencatatannya sama dengan §6. Tidak ada satu pun baris di bawah yang boleh dikutip sebagai kemampuan berjalan.',
  '',
  '| Kemampuan | Yang akan dipakai | Status terukur di repo | Gerbang sebelum boleh diklaim |',
  '|---|---|---|---|',
  '| Solver penjadwalan (ALG-8) | OR-Tools CP-SAT (Apache-2.0, tanpa API key) di container worker sendiri | belum terpasang; jalur utama = backtracking + propagasi TypeScript (ARCHITECTURE §12.2.3) | commit package.json/lockfile atau image worker terpisah + bukti hasil tidak lebih buruk dari jalur TS pada instance fixtured yang sama |',
  '| Model ML EWS (ALG-10) v2 | ONNX Runtime atau worker Python (scikit-learn/XGBoost hanya untuk pelatihan offline) | belum terpasang; v1 = koefisien/pohon JSONB berversi diskor evaluator deterministik (§12.2.4) | keputusan produk P-11 tercatat + ambang v1 terbukti tidak mencapai AUC/Brier §12.5.5 |',
  '| OCR dokumen (ALG-7) | Tesseract v5 di container milik sendiri (eng+ind) | belum terpasang; Lapis 1 (medan formulir + layer teks PDF) berjalan tanpa OCR | image + kuota CPU per tenant + uji dokumen pindai; tulisan tangan tetap tidak didukung |',
  '| Antrean & Redis (KRS War, engine) | bullmq, ioredis | bukan dependensi (RD-11, keputusan P-6); hari ini antrean berbasis DB engine_runs + FOR UPDATE SKIP LOCKED dengan kontrak identik | commit paket + runbook DLQ + uji beban ARCHITECTURE §10.8 |',
  '| Hash & HMAC di sisi DB | pgcrypto digest() | extension diizinkan di Supabase; kanonisasi SENGAJA tetap di aplikasi | jangan memindahkan kanonisasi ke pemicu tanpa vektor uji yang sama (paritas Flutter) |',
  '',
  '**Utang nol-hardcoding yang terukur hari ini** (dihitung atas kode nyata pada 2026-10-20, bukan taksiran):',
  '',
  '| Area | Berkas | z.enum( | <option> literal | options={[ | font-black/extrabold | biru literal | var(--sica-color- |',
  '|---|---|---|---|---|---|---|---|',
  '| apps/web/src | 87 | 3 | 1 | 0 | 0 | 0 | 0 |',
  '| apps/mobile/lib | 17 | 0 | 0 | 0 | 0 | 0 | 0 |',
  '| packages/contracts/src | 8 | 29 | 0 | 0 | 0 | 0 | 0 |',
  '',
  'Cara membacanya, supaya satu angka tidak dipakai untuk dua klaim: **29 `z.enum(` di `packages/contracts/src` kemungkinan besar kelas A/A-prime** (verba izin, keadaan antrean, status transaksi) dan karena itu sah — tetapi belum ada dokumen yang memisahkan mana kelas A dan mana kelas C/D. Itu dicatat sebagai gap `RD-41` dan menjadi tugas `MDE-*` di ROADMAP §2.13, bukan pekerjaan yang boleh dianggap beres karena angkanya kecil. Tiga `z.enum(` dan satu `<option>` di sisi web adalah kandidat kuat pelanggaran kelas C (pilihan yang seharusnya dibaca dari `/api/v1/master/lookups`) dan wajib di-triage **sebelum** gerbang CI (m) dipasang, kalau tidak gerbang itu merah sejak hari pertama dan akan dimatikan orang.',
  '',
  '**Gerbang CI yang dinormakan siklus ini** (norma; implementasinya adalah task ROADMAP, bukan fakta hari ini):',
  '',
  '| # | Gerbang | Sumber norma |',
  '|---|---|---|',
  '| (g) | egress scan: `fetch(` / `axios` / `https.request` di dalam direktori engine membuat build merah | AGENTS §3.9, ARCHITECTURE §11.1 |',
  '| (h) | golden vector: tiap `engine_code` menghasilkan keluaran byte-identik dari input fixtured; seed PRNG tersimpan di `engine_runs` | ARCHITECTURE §11.2, §12.3 |',
  '| (i) | paritas numerik TypeScript ↔ Dart untuk semua pembobotan (basis poin, bukan float) | AGENTS §3.4, ARCHITECTURE §12.12 |',
  '| (j) | empat titik kegagalan RBAC + uji bahwa keluaran engine tidak dapat menulis tabel domain | AGENTS §3.8, DATA_MODEL §18.9 |',
  '| (k) | verifier rantai audit: satu baris fixture diubah wajib menghasilkan `HASH_MISMATCH` | ARCHITECTURE §12.9, SECURITY §3.6.6 |',
  '| (l) | daftar-terlarang atribut model ML tidak pernah muncul di `ml_model_versions.features` | ARCHITECTURE §12.5, DATA_MODEL §18.9(6) |',
  '| (m) | scanner kosakata literal untuk field kelas C/D (array opsi, `<option>`, `z.enum` pada field berkamus) | AGENTS §3.10, DATA_MODEL §20.1 |',
  '| (n) | setiap `kind` yang dibaca UI wajib punya baris `reference_kind_usage` | DATA_MODEL §20.3 |',
  '| (o) | `CHECK (col IN …)` hanya untuk kolom yang tercatat di register enum §15.1/§15.2/§15.3 | DATA_MODEL §20.1 |',
  '| (p) | scanner nama menolak tabel kamus kembar berbetuk `(code, name)` | DATA_MODEL §14.8, §20.2 |',
  '',
  '**Catatan proses yang jujur.** Siklus 2026-10-20 adalah siklus dokumen: tidak ada paket yang dipasang, tidak ada migrasi yang ditulis, dan `next build` tidak dijalankan ulang untuk membuktikan kode. Yang diverifikasi ulang adalah alat yang memang ada dan masih relevan: `contrast-audit.mjs` menghasilkan **FAILS = 0** pada dua tema dan `purge-check.mjs` menghasilkan **0 dari 59** kelas design-system hilang dari artefak CSS (67.412 byte). Keduanya harus dijalankan dari **akar repo**; dijalankan dari `apps/web` menghasilkan ENOENT pada `globals.css` dan `.next/static/css`, yaitu kegagalan alat, bukan kegagalan desain (terjadi dua kali sebelum dibaca benar).',
  '',
].join('\n');
appendFileSync(F('TECH_CONVENTIONS.md'), tc, 'utf8');
rep.push('tc-7: OK');

const idx = [
  '',
  '---',
  '',
  '## 6. Peta gelombang kedua (2026-10-20) — engine, data master, entitas institusi',
  '',
  'Tidak ada ADR baru pada siklus ini; **ADR-14 sampai ADR-17** (bagian 5 di atas) diperluas oleh ARCHITECTURE §12 tanpa membalik norma lama.',
  '',
  '| Area | Sumber kebenaran | Bagian | Status |',
  '|---|---|---|---|',
  '| 14 engine nol-API-key (ALG-1 sampai ALG-14) | ARCHITECTURE.md | §11 (gelombang 1) & §12 (gelombang 2) | spesifikasi |',
  '| Dua mekanika (KRS lease + fencing token; Delta Sync Feeder) | ARCHITECTURE.md | §10.3 + §12.2.2, §12.10 | spesifikasi |',
  '| Skema engine gelombang 1 | DATA_MODEL.md | §17 (0036_engine_algorithms.sql) | spesifikasi |',
  '| Skema engine gelombang 2 | DATA_MODEL.md | §18 (0037–0043) | spesifikasi |',
  '| Multi-kampus, jenis program, Tugas Akhir 53/2023, matriks tarif UKT | DATA_MODEL.md | §19 (0044–0046) | spesifikasi |',
  '| Mesin data master dinamis + atribut kustom (nol-hardcoding) | DATA_MODEL.md | §20 (0047–0048) | spesifikasi |',
  '| Register objek & nomor migrasi (satu-satunya pemilik) | DATA_MODEL.md | §14.7, §14.8 | terukur |',
  '| Kontrak endpoint engine & master data | API_SPEC.md | §4.14 (lookup & atribut), §4.15, §6.10 (ALG-8–14) | spesifikasi |',
  '| Register kode error | API_SPEC.md | §2.3 — 106 baris terukur | spesifikasi |',
  '| Titik aksi hak akses | RBAC_MATRIX.md | §4.5 — 145 baris (51–126 engine/entitas, 127–145 master data); §4.6 scope SITE + hak tingkat field | usulan |',
  '| Postur keamanan gelombang 2 | SECURITY_COMPLIANCE.md | §3.6.6 (rantai hash & jangkar), §10.8, §11.1–§11.6 | spesifikasi |',
  '| Sisi integrasi auto-fix & delta sync | INTEGRATIONS.md | §1.11–§1.15 | spesifikasi |',
  '| Kebutuhan bisnis (OBE, 53/2023, multi-kampus, tarif, lookup dinamis, engine) | PRD.md | §5.9 & §5.10; §6.1 (AC-MD, AC-ALG); §6.2 (NFR-Z, NFR-MD) | spesifikasi |',
  '| Standar layar engine + Dynamic Form Generator | UI_UX_DESIGN.md | §11.11 (vonis Velzon), §12 (ALG-8–14), §13 (form dinamis) | spesifikasi |',
  '| Urutan pengerjaan | ROADMAP_TASKS.md | §2.5.15 (crosswalk 6 milestone), §2.13 (Master Data Engine di Fase 1B / R-2), §2.14 (ALG-8–14; W-13.8–W-13.16), §2.15 (entitas), §2.16 (register dokumen) | terjadwal |',
  '| Guardrail agen | AGENTS.md | §3.9 (nol-API-key), §3.10 (nol-hardcoding), §3.11 (urutan dokumen-then-kode) | normatif |',
  '',
].join('\n');
appendFileSync(F('INDEX.md'), idx, 'utf8');
rep.push('index-6: OK');

const glo = [
  '',
  '---',
  '',
  '## 8. Istilah gelombang kedua (2026-10-20) — engine nol-API-key & mesin data master',
  '',
  '| Istilah | Padanan singkat | Makna operasional |',
  '|---|---|---|',
  '| Nol-API-Key | tanpa kunci vendor | Seluruh fungsi cerdas dijalankan algoritma internal/ML lokal di infrastruktur sendiri; panggilan berkunci dilarang dan data tidak keluar. Normatif di AGENTS §3.9, dibuktikan gerbang CI (g)/(h). |',
  '| Nol-hardcoding data master | kamus adalah data | Nilai yang dapat dikembangkan/dinamai ulang kampus disimpan di mesin reference_kinds/reference_items dan dibaca lewat endpoint lookup, bukan konstanta di kode. Normatif di AGENTS §3.10, DATA_MODEL §20.1. |',
  '| Kelas A / A-prime / B / C / D | pengelompokan kosakata | A = protokol & mesin state (enum tertutup); A-prime = keadaan tetap, label bebas; B = kamus nasional berversi (tenant hanya memetakan label); C = kamus yang dapat dirawat kampus; D = atribut kustom. Menentukan bentuk penyimpanan dan apakah CHECK tertutup diizinkan. |',
  '| Dynamic Master Data Engine | satu mesin kamus | Pengganti sekitar 30 layar master kecil: satu tabel nilai per-tenant + metadata jenis kamus (cara merender, sumber nasional, versi, jendela berlaku) + layar Admin bertab + analisis dampak. |',
  '| reference_kind_usage | siapa memakai kamus ini | Indeks terbalik kind ke layar/kolom/laporan. Menjawab "apa yang rusak kalau nilai ini saya nonaktifkan" dan menjadi target gerbang CI (n). Global (bukan milik tenant) karena mendeskripsikan kode aplikasi. |',
  '| Atribut kustom | field tanpa rilis kode | Definisi di tenant_custom_attributes (tipe, wajib, regex, scope, visibilitas peran, pemetaan Feeder); nilai di kolom attributes jsonb tabel induk; riwayat di custom_attribute_history bila is_tracked. EAV murni ditolak sebagai penyimpan nilai. |',
  '| Pensiun kode (merge) | merged_into_id | Nilai kamus nasional yang berhenti berlaku menunjuk penggantinya; riwayat tetap terbaca lewat parameter ?at= dan tidak pernah dihapus. |',
  '| X-Lookup-Version | versi kamus | Naik setiap kali ada tulis; klien memakai ETag/If-None-Match supaya satu layar biodata tidak menembak endpoint yang sama dua belas kali. |',
  '| Lease epoch / fencing token | nomor generasi pegangan | Pencacah monoton per pegangan kursi (tenant, kelas, mahasiswa). Worker finalis menolak job ber-epoch basi (FAILED_SUPERSEDED) sehingga job lama yang selesai terlambat tidak dapat menulis. Ini pengganti **Redlock**, yang ditolak karena tidak menambah kebenaran ketika penjaga otoritatifnya adalah DB. |',
  '| Golden vector | vektor uji byte-identik | Input fixtured menghasilkan output identik bit-per-bit; membuat angka enam bulan lalu dapat direproduksi di hadapan auditor. |',
  '| Mode turun (degraded) | jujur soal data | Ketika prasyarat (course_prerequisites, ketersediaan pengampu, rubrik indikator) belum terisi, mesin mengembalikan flag dan layar menampilkannya — bukan angka yang tampak meyakinkan. |',
  '| Inti konflik (conflict core) | kenapa mustahil | Himpunan kendala/batas minimal yang membuat penjadwalan tidak layak (mis. "Lab II: kapasitas alat 24, kebutuhan 36"), bukan pesan "tidak ada slot". |',
  '| Delta Sync + airmen kirim | hanya yang berubah | Himpunan berubah = updated_at setelah airmen ATAU transisi audit ATAU koreksi/tombstone; record_digest sama berarti SKIP; airmen hanya maju atas baris yang benar-benar sukses. |',
  '| Akar Merkle jejak audit | jangkar tak-ubah | Akar per 1.000 daun per stream; akar hari ini menunjuk akar kemarin; diekspor ke penyimpanan WORM milik sendiri. TSA RFC 3161 pihak ketiga ditolak (butuh layanan luar). HASH_MISMATCH berarti bekukan + COMPROMISED, bukan dihitung ulang. |',
  '| Coverage capaian (OBE) | berapa yang punya bukti | n_evaluated / n_enrolled dengan n_missing_evidence terpisah. Capaian tinggi dengan coverage rendah adalah temuan mutu, bukan hasil baik. |',
  '| Scope SITE | hak per kampus | Tingkat scope baru untuk multi-kampus: penugasan memegang site_id + valid_to; pelanggaran lintas-site adalah IDOR horizontal. |',
  '| Tantang-balas presensi | QR yang tidak bisa distop | Setelah pemindaian pertama, server menerbitkan tantangan 6 digit yang berganti pada langkah waktu berikutnya dan harus dikirim balik; mematahkan pola "foto QR dikirim ke teman di luar kampus". |',
  '',
].join('\n');
appendFileSync(F('GLOSSARY.md'), glo, 'utf8');
rep.push('glossary-8: OK');

console.log(rep.join('\n'));
