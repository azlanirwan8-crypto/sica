import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

const insertBefore = (file, anchor, block, label) => {
  const t = readFileSync(file, 'utf8');
  const first = block.split(NL)[0].slice(0, 44);
  if (t.includes(first)) { console.log('dilewati: ' + label); return; }
  const i = t.indexOf(anchor);
  if (i < 0) { console.error('ANCHOR hilang ' + label + ' @' + file); process.exit(1); }
  writeFileSync(file, t.slice(0, i) + block + NL + NL + t.slice(i), 'utf8');
  console.log('sisip ' + label + ' @' + file);
};

const insertAfterLine = (file, probe, block, label) => {
  const lines = readFileSync(file, 'utf8').split(NL);
  const i = lines.findIndex((l) => l.includes(probe));
  if (i < 0) { console.error('BARIS hilang ' + label + ' @' + file + ' :: ' + probe); process.exit(1); }
  if (lines.join(NL).includes(block.split(NL)[0].slice(0, 44))) { console.log('dilewati: ' + label); return; }
  lines.splice(i + 1, 0, ...block.split(NL));
  writeFileSync(file, lines.join(NL), 'utf8');
  console.log('tambah ' + label + ' @' + file + ' (setelah baris ' + (i + 1) + ')');
};

// ---------- 1. AUDIT_READINESS: dua gap baru ----------
insertAfterLine('docs/AUDIT_READINESS.md', '| `RD-92` |', [
  '| `RD-93` | **Alat ketertelusuran modul salah empat kali, dan semuanya ditemukan SEBELUM angkanya dikutip.** v1 menyemprotkan seluruh `INTEGRATIONS` ke setiap modul sehingga 48/48 tampak "punya regulasi"; v2 mewarisi label heading DDL sehingga satu modul (M-36) tercatat memiliki 45 tabel sementara tetangganya 5; v3 hanya mengenali "53 Tahun 2023" dan kehilangan bentuk "53/2023" sehingga 43 modul tampak tidak menyebut regulasi induknya, dan tidak mengekspansi rentang `M-12…M-19`; penghitung rute/izin memakai kata kunci sehingga baris milik modul lain ("audit", "parameter") dihitung sebagai rujukan modul ini. Perbaikan dilakukan di `.tools/module-provenance.mjs`, bukan di dokumen, karena dokumennya benar. Kelas yang sama dengan `RD-62`/`RD-76`/`RD-86`/`RD-91`. | `AUDIT_READINESS §17.2` (empat cacat didaftar) + `.tools/module-provenance.mjs` (revisi ke-3) + `PROGRESS_REPORT §5.45` |',
  '| `RD-94` | **Pertanyaan "modul X berpedoman ke mana" tidak pernah terjawab per modul.** Rujukan regulasi hidup di baris FR/AC atau `BENCH-*` tanpa atribusi modul, dan hasil pengukuran pertama: satu modul (`M-33`) tidak punya rujukan regulasi apa pun, dan puluhan modul tidak punya satu baris pun yang menyebutnya bersama regulasi. Tidak ada pula peta modul→kelompok seed, sehingga 34 modul tanpa jalur uji data awal. | ditutup siklus ini: `PRD §5.19` (per gugus) + `PRD §5.20` (48 baris per modul, penanda `VERIFIKASI-LEGAL`/`VERIFIKASI-VENDOR`) + `SEED_DATA §8.4` (sebelas kelompok) + `AUDIT_READINESS §17` (matriks) + gate `.tools/pedoman-coverage.mjs` + tiket `PRV-1…PRV-4`/`SED-1` di `ROADMAP §2.25`. **Yang masih terbuka dan dinyatakan:** empat modul tanpa baris rute dan seluruh nomor ber-penanda belum diverifikasi legal |',
].join(NL), 'RD-93/94');

// ---------- 2. AUDIT_READINESS: riwayat 1.11 ----------
insertAfterLine('docs/AUDIT_READINESS.md', '| 1.10 | 2026-10-21 |', [
  '| 1.11 | 2026-10-21 | **Siklus keenam — pedoman per modul (Sevima vs regulasi Indonesia) dan matriks ketertelusuran 48 modul.** Gap `RD-93`–`RD-94`. Alat: `.tools/module-provenance.mjs` (revisi ke-3: attribusi DDL tanpa pewarisan, nomor regulasi bentuk "nn/tahun", ekspansi rentang, pemisahan hitung ketat untuk rute/izin) dan `.tools/pedoman-coverage.mjs` (penolak `PRD §5.20`). Dokumen: `PRD §5.19` + `PRD §5.20` (48 baris), `SEED_DATA §8.4` (sebelas kelompok seed), `AUDIT_READINESS §17` (matriks + lima lubang `L-1`…`L-5`), `ROADMAP §2.25` (`PRV-1`…`PRV-4`, `SED-1`), `INDEX` dua baris. Ralat diri: bagian ini TIDAK membandingkan angka "sebelum/sesudah" karena sisi "sebelum" dihasilkan versi alat yang cacat — perbandingan hanya sah pada versi alat yang sama (`RD-62`). |',
].join(NL), 'riwayat 1.11');

// ---------- 3. ROADMAP 2.25 ----------
insertBefore('docs/ROADMAP_TASKS.md', '## Phase 3: Mobile MVP & Dynamic QR Attendance (Minggu 6 - 7)', [
  '### 2.25 Gugus `PRV`/`SED` — pedoman per modul, verifikasi legal/vendor, dan kontrak seed (2026-10-21)',
  '',
  '**Asal tiket.** Permintaan pemilik: "selalu catat kemana pedoman kita ke Sevima dan standar pendidikan Indonesia" + "cek semua modul". `node .tools/module-provenance.mjs` dan `node .tools/pedoman-coverage.mjs` mencetak dasar tiap tiket; nomor di bawah bukan hasil salin dari dokumen lain.',
  '',
  '| Tiket | Tuntutan | Prasyarat | Ukuran selesai (terukur) | Risiko kalau dilewati |',
  '|---|---|---|---|---|',
  '| `PRV-1` | Verifikasi legal terhadap **setiap** nomor regulasi berpenanda `VERIFIKASI-LEGAL` di `PRD §5.20` (PMK 168/2023 PPh 21 TER, UU SJSN/PP 86/2013/Perpres JKN, ketentuan KIP-K, UU 43/2007, PMK BMN, Perpres PBJ, UU 17/2023 + rekam medis, UU ITE ps.15/25/28, PP 71/2019 PSTE, IKU 1–8, SPMI) | pemilik/owner legal memberi keputusan tertulis per nomor | penanda dilepas dari baris yang sudah diverifikasi; `node .tools/pedoman-coverage.mjs` tetap HIJAU dan **0** nomor berpenanda yang dipakai di teks pengguna, brosur, atau AC | SICA menjual "kepatuhan" yang tidak bisa dibuktikan; temuan audit hukum di kemudian hari memaksa skema data berubah di tengah jalan |',
  '| `PRV-2` | Verifikasi vendor terhadap skema yang ditandai `VERIFIKASI-VENDOR` (Feeder/PDID, SISTER 2.0, SIVIL, EWMP, KOHA/SLiMS, OJS) terhadap dokumen teknis resmi masing-masing | akses dokumen + sandbox | setiap field di DDL menunjuk nama field dokumen vendor; field tanpa rujukan vendor **dihapus**, bukan dipertahankan | kolom karangan masuk migrasi; integrasi nyata gagal saat cocokkan skema dan data historis harus dibuang |',
  '| `PRV-3` | Tulis baris rute `API_SPEC §7` untuk `M-01`, `M-15`, `M-26`, `M-37` (hari ini nol baris rute menyebut kode keempatnya) | urutan `AGENTS §3.11`: norma PRD → DDL → izin ber-nomor → rute | kolom `RUTE` `module-provenance` > 0 untuk keempatnya; `route-count.mjs` tidak berubah kecuali bertambah; setiap baris baru menunjuk kode izin yang sudah bernomor | modul dijanjikan tanpa kontrak; kode ditulis sebelum izinnya ada — persis pola izin hantu `CRD-5` |',
  '| `PRV-4` | Buat atribusi modul dapat diukur untuk bagian DDL yang berjudulkan tematik (`DATA_MODEL §5`, `§11`–`§21`) | keputusan pemilik: label di judul bagian atau baris "milik modul" di bawahnya | kolom `DDL-BERLABEL` tidak lagi jadi proxy palsu; penjelasannya dipindah ke catatan alat | "tabelnya tidak ada" disimpulkan dari kolom yang salah baca, dan pekerjaan yang sudah ada dikerjakan ulang |',
  '| `SED-1` | Tulis berkas seed untuk sebelas kelompok `SEED_DATA §8.4` (`S-01`…`S-11`) | objek kelompoknya punya DDL dan dapat dibuat di dev | `node .tools/seed-count.mjs` mencetak sisi nyata = sisi spesifikasi untuk kelompok yang ditulis; **tanpa** fixture untuk modul yang objeknya belum nyata | CI hijau di atas kertas (pola generator `RD-83`); gerbang `CHECK`/`EXCLUDE`/RLS tidak pernah teruji |',
  '',
  '**Definisi selesai gugus ini.** Bukan "semua regulasi terverifikasi", melainkan: (a) tidak ada modul tanpa pedoman tertulis, (b) tidak ada klaim kepatuhan yang melewati penanda verifikasi, (c) jumlah yang tersisa dicetak alat, bukan diklaim narasi. Selama `PRV-1`/`PRV-2` belum diputus manusia, vonis `AUDIT_READINESS §17.2` tetap berlaku: **pedoman sudah tercatat, belum terkunci untuk implementasi**.',
].join(NL), 'ROADMAP 2.25');

// ---------- 4. PROGRESS 5.45 ----------
insertBefore('docs/PROGRESS_REPORT.md', '## 11. Riwayat laporan (bagian 3)', [
  '### 5.45 Siklus 2026-10-21 (bagian 6) — "ke mana pedoman kita": registri per modul, dan empat cacat pada alat saya sendiri',
  '',
  '**Permintaan yang dijawab.** "cek semua modul … selalu catat kemana pedoman kita ke sevima dan standar pendidikan indonesia … lakukan revisi jika ada temuan". Ini siklus pertama yang memperlakukan **48 modul sebagai objek yang diaudit satu per satu**, bukan sebagai daftar.',
  '',
  '**Alat yang lahir (dua).** `.tools/module-provenance.mjs` mencetak matriks 48 baris: rujukan Sevima (baris di `BENCHMARK_SEVIMA`/`AUDIT_READINESS` yang menyebut modul), regulasi (baris yang **sendiri** memuat modul + nama regulasi), DDL berlabel heading, baris rute, baris izin, rujukan layar, rujukan seed. `.tools/pedoman-coverage.mjs` menolak `PRD §5.20` bila jumlah barisnya tidak sama dengan registri modul, bila himpunan kode modul berbeda, bila kolom Dasar kosong, atau bila penanda `VERIFIKASI-*` tidak dikenal. Uji negatif dijalankan lebih dulu: sebelum `§5.20` ditulis, alat mencetak `MERAH · PRD 5.20 tidak ditemukan` dan keluar dengan kode 1 — jadi HIJAU hari ini berarti ada sesuatu yang diuji.',
  '',
  '**Empat cacat alat yang saya temukan dan perbaiki sebelum mengutip angkanya (`RD-93`).** (1) Atribusi DDL lengket: heading tanpa label mewarisi label sebelumnya, akibatnya M-36 tercatat "memiliki" 45 tabel dan M-41 hanya 5. (2) Pola nomor regulasi hanya mengenali "53 Tahun 2023": bentuk "53/2023" yang justru dipakai di dokumen kita tidak dikenali, sehingga 43 modul tampak kehilangan regulasi induk. (3) Rentang `M-12…M-19` tidak diekspansi. (4) Penghitung rute/izin cukup dengan kata kunci, jadi baris "audit" milik modul lain dihitung sebagai milik M-05; rute & izin kini menuntut kode modul di baris yang sama. Keempatnya saya perbaiki di alat — tidak satu pun dengan mengoreksi dokumen, dan tidak satu pun temuan awal itu saya publish sebagai kekurangan dokumen.',
  '',
  '**Isi dokumen yang ditulis.** `PRD §5.19` register pedoman per gugus (10 gugus) + empat norma (Sevima = bukti pasar bukan dasar hukum; nomor berpenanda `VERIFIKASI-LEGAL` dilarang naik ke teks pengguna; angka akademik hanya dari sumber yang disebut; satu rujukan satu rumah). `PRD §5.20` registri **per modul** 48 baris dengan penanda `VERIFIKASI-LEGAL`/`VERIFIKASI-VENDOR` dan kolom "batas jujur / konsekuensi desain" per modul — M-33 (Jadwal Darurat) adalah modul yang sebelumnya **tanpa satu pun rujukan regulasi** dan kini punya, dengan pernyataan eksplisit bahwa tidak ada dasar hukum khusus "jadwal darurat". `SEED_DATA §8.4` sebelas kelompok seed (`S-01`…`S-11`), dua di antaranya baru untuk modul non-akademik; `AUDIT_READINESS §17` memuat matriks keluaran alat + lima lubang (`L-1` rute, `L-2` atribusi DDL, `L-3` legal, `L-4` vendor, `L-5` di luar katalog Sevima); `ROADMAP §2.25` tiket `PRV-1…PRV-4` + `SED-1`.',
  '',
  '**Vonis siklus ini.** Empat lubang masih terbuka dan tidak bisa ditutup agen: rute untuk `M-01`/`M-15`/`M-26`/`M-37` belum ada, atribusi DDL tematik belum diputus, dan seluruh nomor ber-penanda menunggu keputusan manusia (legal & vendor). Karena itu pernyataan "48 modul siap develop 100%" **tidak** saya keluarkan; yang benar adalah "pedoman per modul sudah tercatat dan dijaga alat, implementasi masih diblokir `PRV-1`/`PRV-2`/`PRV-3`".',
  '',
  '**Perintah untuk memeriksa ulang sendiri.**',
  '',
  '```bash',
  'node .tools/module-provenance.mjs   # matriks 48 modul + daftar lubang',
  'node .tools/pedoman-coverage.mjs    # penolak PRD 5.20 (HIJAU/MERAH + cakupan 53/2023 + jumlah VERIFIKASI-*)',
  'node .tools/crud-matrix.mjs          # kelengkapan CRUD per modul (sumber kebenaran CRUD, bukan kolom RUTE di atas)',
  'node .tools/perm-phantom.mjs         # izin yang dikutip API_SPEC tapi belum bernomor (masih MERAH, tiket CRD-5)',
  '```',
].join(NL), 'PROGRESS 5.45');

// riwayat PROGRESS
insertAfterLine('docs/PROGRESS_REPORT.md', '| 5.44 | 2026-10-21 |', [
  '| 5.45 | 2026-10-21 | **Siklus keenam — pedoman per modul.** Dua alat baru (`module-provenance.mjs`, `pedoman-coverage.mjs`), empat cacat alat diperbaiki sebelum angkanya dikutip (`RD-93`), registri `PRD §5.19`/`§5.20` 48 baris, sebelas kelompok seed `SEED_DATA §8.4`, matriks + lima lubang `AUDIT_READINESS §17`, tiket `PRV-1…PRV-4`/`SED-1` `ROADMAP §2.25`. Vonis: pedoman tercatat & terjaga, implementasi masih diblokir verifikasi legal/vendor dan empat modul tanpa rute. |',
].join(NL), 'riwayat 5.45');

// ---------- 5. INDEX ----------
insertAfterLine('docs/INDEX.md', '| Peta sebaran sesi real-time (GIS), jaminan sosial + EWMP, mutu gerak & CLS |', [
  '| Pedoman per modul — ke mana SICA berpatokan (Sevima vs regulasi Indonesia) + matriks ketertelusuran 48 modul | PRD.md + AUDIT_READINESS.md + SEED_DATA.md + ROADMAP_TASKS.md | `PRD §5.19` (per gugus) · `PRD §5.20` (48 baris, penanda `VERIFIKASI-LEGAL`/`VERIFIKASI-VENDOR`) · `AUDIT_READINESS §17` (`L-1`…`L-5`) · `SEED_DATA §8.4` (`S-01`…`S-11`) · `ROADMAP §2.25` (`PRV-1…PRV-4`, `SED-1`) · alat `module-provenance.mjs` + `pedoman-coverage.mjs` | spesifikasi — nomor ber-penanda belum diverifikasi manusia; 4 modul tanpa baris rute |',
].join(NL), 'INDEX baris pedoman');

insertAfterLine('docs/INDEX.md', '| Penjaga yang mengukur kelengkapan, bukan mengiklankannya |', [
  '| Penjaga ketertelusuran pedoman per modul | `.tools/module-provenance.mjs` · `.tools/pedoman-coverage.mjs` · `.tools/prov-matrix.md` (keluaran, bukan sumber) | keduanya menolak, bukan memuji: jumlah baris = jumlah modul, himpunan kode identik, dan tidak ada angka yang dikutip tanpa alat |',
].join(NL), 'INDEX alat penjaga');
