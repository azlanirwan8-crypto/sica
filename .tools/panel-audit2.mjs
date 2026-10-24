import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const rep = [];

const sub = (file, label, a, b) => {
  const p = D + file;
  const s = readFileSync(p, 'utf8');
  const n = s.split(a).length - 1;
  if (n === 0) { rep.push(file + ' ' + label + ': MISS'); return; }
  if (n > 1) { rep.push(file + ' ' + label + ': AMBIG (' + n + ')'); return; }
  writeFileSync(p, s.replace(a, b), 'utf8');
  rep.push(file + ' ' + label + ': OK');
};

/* 1 — ROADMAP §2.21: belum memakai legenda penanda status yang berlaku di gugus lain */
sub('ROADMAP_TASKS.md', 'vcn-status-penanda',
  '**Larangan yang berlaku di gugus ini.**',
  [
    '**Penanda status gugus ini (legenda §2.17).** `VCN-1` 📝 — dokumen selesai, kosakata sudah dapat diuji oleh `vocab-audit`, **belum ada berkas migrasi**. `VCN-2` 📋 — penahan: `0073`/`0074` belum berberkas dan nama objek belum dimiliki `§22`. `VCN-3` 📋 — penahan: promosi izin adalah wewenang `RBAC_MATRIX` + `gen-rbac-seed.mjs`, bukan penulis rute. `VCN-4` 📋 — penahan: bentuk muatan Graph/Zoom masih `[VERIFIKASI-VENDOR]` dan SDK belum menjadi dependensi nyata (`AGENTS §3.9`). `VCN-5` 📋 — penahan: dua layar itu tidak boleh dibuka sebagai tiket kode sebelum `VCN-2` dan `VCN-3` hijau (`AGENTS §3.11`).',
    '',
    '**Larangan yang berlaku di gugus ini.**',
  ].join(NL));

/* 2 — AUDIT_READINESS: addendum audit ulang kedua (dimensi yang belum pernah diukur) */
sub('AUDIT_READINESS.md', 'sec15-8',
  '### 15.7 Vonis penguncian:',
  [
    '### 15.8 Addendum audit ulang kedua (2026-10-21) — dimensi yang belum pernah diukur',
    '',
    'Sebuah "audit ulang" yang hanya menjalankan ulang gerbang lama tidak menambah pengetahuan: gerbang hanya menjawab pertanyaan yang sudah ia tahu. Siklus kedua ini karena itu membuka **tiga dimensi baru** dan memasang alatnya, bukan mengulang yang sudah hijau.',
    '',
    '| Dimensi baru | Alat | Temuan pertama | Setelah perbaikan |',
    '|---|---|---|---|',
    '| Integritas rujukan silang: apakah `PRD §5.15` yang dikutip sebelas berkas itu benar-benar ada | `.tools/ref-audit.mjs` (baru) | **2.962** rujukan bernama diperiksa; **7 rumuhnya tidak ada** — `AGENTS §2.0` (nomor fiktif), `BLUEPRINT §4.11` (berkas berhenti di §4.10), `ENV_CONTRACT §6.3`/`§6.4` dan `MIGRATION_SOP §5.1`–`§5.4` (nomor ditulis sebagai teks tebal, bukan heading, jadi tak terlihat alat maupun daftar isi), `MIGRATION_SOP §5.2` (sama), dan **`ROADMAP §2.17` yang heading-nya hilang** | **0 yatim** dari 2.963; 5 heading dipromosikan; §2.17 dipulihkan; dua rujukan salah sasaran dibetulkan |',
    '| Kesiapan ROADMAP dibaca sebagai rundown, bukan esai | `.tools/roadmap-readiness.mjs` (baru) | 4 Phase dengan **333** checkbox (93 selesai · 20 sebagian · 220 belum); **21** gugus tugas `### 2.x`; **274** task; dependensi eksplisit **171 (62 %)**; kriteria selesai/DoD **192 (70 %)**; jangkar "Rujukan induk" hanya **6/21**; blok Larangan 16/21 | tercatat sebagai `RD-80` (bukan dipermaningkan dengan kata-kata); §2.21 mendapat penanda status sesuai legenda |',
    '| Bentuk heading sebagai kontrak (kelas cacat yang lolos dari `check-docs`) | `.tools/heading-dup.mjs` + `ref-audit` | §2.17 hilang sebagai heading (serpihannya menempel di paragraf §2.16) sementara tiga berkas menunjuknya; §2.21 yang saya tulis siklus ini memakai tingkat `##` padahal saudaranya `###` | §2.21 diturunkan ke `###`; `heading-dup` + `ref-audit` kini menjaga dua arah itu |',
    '',
    '**Tiga gap baru hasil dimensi baru.**',
    '',
    '| ID | Temuan | Pemilik | Status |',
    '|---|---|---|---|',
    '| `RD-79` | Tujuh rujukan silang menunjuk rumah yang tidak ada, termasuk dua nomor yang **tidak pernah ada** di berkas sasaran (`AGENTS §2.0`, `BLUEPRINT §4.11`) dan empat nomor yang ada secara manusia tetapi tidak secara mesin (heading tebal, bukan heading) | keenam berkas pemilik + `.tools/ref-audit.mjs` | **ditutup 2026-10-21**; gerbang baru dipasang supaya kelasnya tidak kembali |',
    '| `RD-80` | Rundown belum merata: gugus lama `CE-1`…`CE-5` (§2.6–§2.9) ditulis sebelum norma "tiap task menyatakan dependensi + DoD" sehingga hanya 5 dari 34 barisnya memuat dependensi; 15 dari 21 gugus tidak punya jangkar "Rujukan induk" | `ROADMAP_TASKS` + Principal Business Analyst | **terdaftar, belum dikerjakan** — ini tagihan pra-eksekusi Fase 2, bukan penahan Fase 1 |',
    '| `RD-81` | Alat ukur saya kembali salah: `roadmap-readiness` v1 salah mengiris gugus (memakai `## 2.x` padahal `### 2.x`) sehingga melaporkan "1 gugus", v2 salah menghitung wilayah Phase (terpotong heading pertama) sehingga melaporkan "0 checkbox", dan v3 kehilangan task berbentuk bullet karena satu `continue`. Empat putaran sebelum angkanya layak dikutip | `.tools/*` | **ditutup dalam siklus ini**; norma `RD-76` ditegaskan ulang: sebelum angka dari alat baru dikutip, alat itu diuji ke objek yang jawabannya sudah diketahui (jumlah task §2.17 = 15, jumlah provider = 6) |',
    '',
    '### 15.7 Vonis penguncian:',
  ].join(NL));

/* 3 — PROGRESS_REPORT: catatan siklus kedua (pendek, menunjuk §15.8) */
sub('PROGRESS_REPORT.md', 'sec541',
  '## 11. Riwayat laporan (bagian 3)',
  [
    '### 5.41 Siklus 2026-10-21 (bagian 2) — audit ulang yang membuka dimensi baru, bukan mengulang gerbang',
    '',
    '**Kenapa siklus ini ada.** Permintaan pemilik: "audit ulang lagi oleh semua ahli pakar". Menjalankan ulang sebelas gerbang yang sudah hijau hanya mengulangi jawaban lama, karena sebuah alat hanya menjawab pertanyaan yang sudah ia tahu. Karena itu siklus kedua ini mengukur **tiga dimensi yang belum pernah disentuh**: integritas rujukan silang antar-berkas, kesiapan ROADMAP sebagai rundown, dan bentuk heading sebagai kontrak.',
    '',
    '**Hasil yang mengubah berkas, bukan hanya laporan.** 2.962 rujukan bernama diperiksa oleh `.tools/ref-audit.mjs` (baru) dan **7 di antaranya tidak punya rumah** — termasuk `AGENTS §2.0` dan `BLUEPRINT §4.11` (nomor yang tidak pernah ada), `ENV_CONTRACT §6.3`/`§6.4` + `MIGRATION_SOP §5.1`–`§5.4` (nomor ditulis sebagai teks tebal sehingga tak terlihat alat maupun navigasi), dan **heading `### 2.17` yang hilang** karena serpihannya menempel di paragraf penutup §2.16 selama satu siklus sementara tiga berkas lain menunjuk §2.17. Ketuanya ditutup dan sekarang `0 yatim` dari 2.963 rujukan.',
    '',
    '**Rundown ROADMAP terukur.** 4 Phase, **333** checkbox (93 selesai · 20 sebagian · 220 belum), **21** gugus tugas, **274** baris task: dependensi eksplisit **171 (62 %)**, DoD/kriteria selesai **192 (70 %)**, rujukan izin **117**, penanda status/penahan **155**. Jangkar "Rujukan induk" baru dipakai **6/21** gugus dan blok "Larangan" 16/21. Yang belum merata dinyatakan sebagai tagihan (`RD-80`), bukan diperhalus.',
    '',
    '**Alat yang saya salah lagi, dan itu dicatat (`RD-81`).** `roadmap-readiness` butuh empat putaran sebelum angkanya layak dikutip: v1 mengira gugus ditulis `## 2.x` (padahal `### 2.x`) dan melaporkan "1 gugus"; v2 memotong wilayah Phase pada heading pertama sehingga melaporkan "0 checkbox"; v3 kehilangan task berformat bullet karena satu `continue`. Norma yang kini tertulis di `AUDIT_READINESS §15.8`: sebelum angka dari alat baru dikutip, alat itu diuji pada objek yang jawabannya sudah saya ketahui.',
    '',
    '**Vonis tetap sama.** **BERKUNCI BERSYARAT.** Audit kedua tidak membuka kunci — ia menemukan tujuh rujukan yang selama ini saya kira sudah benar, dan membuatnya jadi benar.',
    '',
    '',
    '## 11. Riwayat laporan (bagian 3)',
  ].join(NL));

const row = [
  '| 5.41 | 2026-10-21 | **Audit ulang kedua (dimensi baru).** `.tools/ref-audit.mjs` dan `.tools/roadmap-readiness.mjs` dipasang; 2.962 rujukan silang diperiksa → 7 yatim (termasuk heading `### 2.17` yang hilang dan empat nomor bagian bertebakan teks tebal) → **0 yatim** setelah perbaikan; 5 heading tebal dipromosikan (ENV_CONTRACT §6.1–6.4, MIGRATION_SOP §5.1–5.4); §2.21 diturunkan ke tingkat heading yang benar + diberi penanda status. Rundown ROADMAP terukur: 333 checkbox Phase (93/20/220), 21 gugus, 274 task (dependensi 62 %, DoD 70 %, jangkar Rujukan induk 6/21). Gap baru `RD-79`…`RD-81`, termasuk pengakuan bahwa alat ukur saya sendiri butuh empat putaran sebelum layak dikutip. Vonis tetap **BERKUNCI BERSYARAT**. |',
  '',
].join(NL);

let s = readFileSync(D + 'PROGRESS_REPORT.md', 'utf8');
s = s.replace(/\s+$/, NL) + row;
writeFileSync(D + 'PROGRESS_REPORT.md', s, 'utf8');
rep.push('PROGRESS_REPORT.md riwayat-5.41: OK');
console.log(rep.join(NL));
