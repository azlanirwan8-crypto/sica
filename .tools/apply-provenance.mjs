import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

const insertBefore = (file, anchor, block, label) => {
  let t = readFileSync(file, 'utf8');
  const first = block.split(NL)[0].slice(0, 48);
  if (t.includes(first)) { console.log('dilewati: ' + label); return; }
  const i = t.indexOf(anchor);
  if (i < 0) { console.error('ANCHOR hilang ' + label + ' @' + file + ': ' + anchor.slice(0, 40)); return; }
  writeFileSync(file, t.slice(0, i) + block + NL + NL + t.slice(i), 'utf8');
  console.log('sisip ' + label + ' @' + file);
};

const appendTail = (file, block, label) => {
  let t = readFileSync(file, 'utf8');
  const first = block.split(NL)[0].slice(0, 48);
  if (t.includes(first)) { console.log('dilewati: ' + label); return; }
  if (!t.endsWith(NL)) t += NL;
  writeFileSync(file, t + NL + block + NL, 'utf8');
  console.log('tambah ' + label + ' @' + file);
};

// ============ 1. PRD 5.19 — REGISTER PEDOMAN (Sevima vs regulasi RI) ============
const prdRows = [
  ['M-01…M-05', 'Tata kelola platform, parameter, RBAC, helpdesk, audit', 'Sevima: Admin area, modul & role, log aktivitas (`BENCHMARK_SEVIMA §2/§4`, baris `BENCH-*`)', 'UU PDP 27/2022; UU ITE 11/2008 ps.15/28 (jejak elektronik — `VERIFIKASI-LEGAL`); PP 71/2019 PSTE (penyelenggaraan & audit)', 'sudah cited: `SECURITY §3/§7`, `RBAC §4.5`'],
  ['M-06…M-08', 'HRIS & payroll, BKD, SISTER', 'Sevima: SDM & Kepegawaian, penggajian, lembur (`BENCHMARK_SEVIMA §2`, `BENCH-40…74`)', 'UU Ketenagakerjaan 13/2003 + Cipta Kerja; **PPh 21 TER** (PMK 168/2023 — `VERIFIKASI-LEGAL`); **BPJS**: UU SJSN 40/2004 + PP 86/2013 (Ketenagakerjaan) & Perpres kepesertaan JKN (Kesehatan) — `VERIFIKASI-LEGAL`; SISTER 2.0 (PUSDIAT)', 'BPJS/EWMP **baru** ditulis siklus ini (`DATA_MODEL §24`, `0079`/`0080`); nomor regulasi wajib dicek legal sebelum jadi teks pengguna'],
  ['M-09…M-11', 'PMB/OCR/CBT, keuangan & billing, beasiswa', 'Sevima: PMB (jalur, gelombang, seleksi, daftar ulang, NIM), tagihan/VA/konfirmasi, beasiswa (`BENCH-01…34`)', 'Permendikbudristek **53/2023** (SN-Dikti); **59/2018** + turunan (pelaporan); UU PDP 27/2022 untuk NIK & nama ibu; peraturan terkait KIP-K (— `VERIFIKASI-LEGAL`)', 'KIP-K kelas B sudah dirujuk `PRD §5.12`; dasar hukum biaya pendidikan tinggi = keputusan pemilik'],
  ['M-12…M-19', 'Kurikulum OBE, KRS, jadwal, moda, LMS, ujian, presensi, penilaian', 'Sevima: akademik (KRS, kelas, jadwal, presensi, nilai, transkrip, yudisium) — 9 alur (`BENCHMARK_SEVIMA §6`)', '53/2023 (CPL/CPMK/Sub-CPMK, SKS, asesmen); 30/2021 (PPKS, untuk M-17 proctoring & M-36); PDDikti Feeder (kode CP1/CP2, tag hadir)', 'semua sudah cited di `PRD §5.4/§5.5`, `INTEGRATIONS §1`; `ALG-*` mengikuti vonis `ARCHITECTURE §11`'],
  ['M-20…M-23', 'Tugas akhir, publikasi, HKI, riset mahasiswa', 'Sevima: PPI/penelitian & publikasi (`BENCH-100…118`)', '53/2023 ps. bentuk TA non-skripsi; UU 28/2014 Hak Cipta & UU 20/2016 Merek (DJKI — `VERIFIKASI-LEGAL`); SISTER PDD/SINTA', 'HKI tercatat `PRD §5.12` M-22; pemetaan SINTA/IKU masih **design-only**'],
  ['M-24…M-29, M-47', 'Kemahasiswaan, KKN/MBKM, karier, mobilitas, endowment', 'Sevima: kemahasiswaan (aktivitas, poin, SKKM) sebagian; **karier/tracer/endowment tidak ada padanannya**', '53/2023 (MBKM, konversi SKS); IKU 1/2/5 untuk tracer & karier; UU PDP untuk data alumni', '**sebagian modul tanpa kemunculan Sevima** (terukur `module-provenance`) — bukan lubang, tapi harus dinyatakan sebagai "di luar katalog Sevima" agar benchmark tidak dipakai sebagai justifikasi'],
  ['M-30…M-38', 'Dokumen & yudisium, akreditasi, IKU, SPMI, PPKS, kepatuhan', 'Sevima: laporan & legalisir/SKL; akreditasi/IKU tidak punya modul setara', 'BAN-PT/LAM 9 kriteria; **SPMI** internal; 30/2021 (PPKS); UU PDP 27/2022; IKU 1–8 (Permenristekdikti/Permendikbudristek — `VERIFIKASI-LEGAL`)', 'auto-borang & proyeksi IKU = `PRD §5.14` M-31/M-32; angka IKU hanya dari tabel bersumber, bukan taksiran'],
  ['M-39…M-43', 'Perpustakaan, aset/BMN, klinik, asrama/kantin, humas/event', 'Sevima: sarpras & aset sebagian; klinik & perpustakaan **tidak** ada padanan', '**UU 43/2007** Perpustakaan (`VERIFIKASI-LEGAL`); UU 43/2009 Kearsipan; PMK pengelolaan BMN untuk PTN (`VERIFIKASI-LEGAL`); UU 17/2023 Kesehatan + ketentuan rekam medis (`VERIFIKASI-LEGAL`)', 'M-41 klinik memakai enkripsi beramplop + access-log (`DATA_MODEL §22.8`); klaim "sesuai Permenkes" **belum** diverifikasi legal'],
  ['M-44…M-46', 'SIM-LPPM/hibah, CRM PMB, e-procurement PBJ', 'Sevima: **ketiganya tidak punya padanan** (modul enterprise di luar Sevima)', 'Perpres PBJ (untuk PT badan hukum: statuta + kebijakan internal — `VERIFIKASI-LEGAL`); HPS/PPK/e-katalog LKPP; SISTER hibah', 'dinyatakan eksplisit: standar yang dipakai = praktik PBJ kampus, bukan angka Sevima'],
  ['APP', 'SuperApp Mobile (mahasiswa/dosen/staff)', 'Sevima: aplikasi mobile kampus (absensi, KRS, tagihan, pengumuman)', '53/2023 & UU PDP berlaku identik dengan Web; paritas fungsi = `AGENTS §3.4`', 'read-model luring wajib `SERVER_ONLY` untuk vonis; tidak ada perhitungan akademik di perangkat'],
];

const prd519 = [
  '### 5.19 Register pedoman per gugus modul — ke mana SICA berpatokan (Sevima vs regulasi Indonesia) — 2026-10-21',
  '',
  '**Kenapa register ini ada.** Permintaan pemilik: "selalu catat kemana pedoman kita ke Sevima dan standar pendidikan Indonesia". Sampai siklus ini rujukan itu **tersebar** (baris `BENCH-*` di AUDIT_READINESS, nomor regulasi di PRD/INTEGRATIONS/SECURITY) sehingga tidak ada satu tempat yang menjawab "modul X patokannya apa, dan mana yang sudah diverifikasi". Angka pembuka dihitung oleh `node .tools/module-provenance.mjs` dan **tidak boleh disalin** ke dokumen lain (norma `RD-55`/`RD-62`): yang tetap adalah namanya, angkanya dicetak ulang setiap siklus. Hasil pengukuran pertama: ada modul yang tidak muncul di `BENCHMARK_SEVIMA` dan modul yang tidak punya satu pun token regulasi di teks miliknya sendiri — keduanya daftar lengkapnya dicetak alat yang sama.',
  '',
  '**Cara membaca tabel.** Kolom "Rujukan Sevima" menunjuk baris `BENCH-*` atau bagian `BENCHMARK_SEVIMA` yang nyata; kalau kosong, artinya **memang tidak ada padanannya** di katalog Sevima (bukan berarti tidak diwajibkan). Kolom "Regulasi/standar" memakai penanda **`VERIFIKASI-LEGAL`** untuk nomor yang belum diverifikasi terhadap dokumen hukum resmi oleh pemilik — itu tanda jujur, bukan angka yang diasumsikan. Kolom terakhir menunjuk tempat rujukan itu **sudah** dipakai di dokumen lain, supaya tidak ada sumber kebenaran kedua.',
  '',
  '| Gugus | Domain | Rujukan Sevima (terukur) | Regulasi/standar Indonesia | Status rujukan hari ini |',
  '|---|---|---|---|---|',
  ...prdRows.map((r) => '| ' + r.join(' | ') + ' |'),
  '',
  '**Empat norma yang menempel pada register ini.** (1) **Sevima adalah bukti pasar, bukan dasar hukum.** Kalau Sevima tidak punya modulnya (karier, endowment, PBJ, klinik, perpustakaan, akreditasi), justifikasinya harus regulasi atau proses akademik nyata — bukan "kompetitor tidak punya". (2) **Setiap nomor regulasi yang ditandai `VERIFIKASI-LEGAL` tidak boleh muncul di teks pengguna, brosur, atau acceptance criteria** sampai owner legal mengonfirmasi; yang boleh dipakai adalah **kelas kewenangan** (nasional vs institusional). (3) **Angka akademik hanya dari sumber yang disebut.** IKU, SINTA, borang, dan BKD membaca tabel bersumber; proyeksi/taksiran wajib dinyatakan `degraded`. (4) **Satu rujukan satu rumah.** Register ini **tidak** mendefinisikan kebutuhan; ia hanya memetakan. Definisi tetap di `PRD §5.x` per modul, `BENCHMARK_SEVIMA` untuk bukti pasar, `AUDIT_READINESS` untuk `BENCH-*`.',
  '',
  '**Yang berubah karena register ini.** Tiga gugus yang selama ini mengutip "standar industri" tanpa rujukan konkret kini punya penanda eksplisit: **M-06 BPJS/EWMP** (`0079`/`0080` baru ditulis, dasar hukumnya ditandai `VERIFIKASI-LEGAL`), **M-39 perpustakaan** (UU 43/2007 ditandai), dan **M-41 klinik** (ketentuan rekam medis ditandai). Tiket penutupnya: `PRV-1` (verifikasi legal) di `ROADMAP §2.25`, dan peta seed per modul di `SEED_DATA §8.4`.',
  '',
];

insertBefore('docs/PRD.md', '## 6. Acceptance Criteria (terukur)', prd519.join(NL), 'PRD 5.19');

// ============ 2. SEED_DATA 8.4 — peta modul -> kelompok seed (ditambah di ekor berkas) ==
const seed84 = [
  '### 8.4 Peta modul → kelompok seed (menutup temuan "modul tanpa rujukan seed") — 2026-10-21',
  '',
  '**Temuan yang memaksa bagian ini ada.** `node .tools/module-provenance.mjs` mengukur berapa modul yang sama sekali tidak disebut di `SEED_DATA.md`, dan hasilnya termasuk modul enterprise (`0051`–`0072`) yang DDL-nya sudah ditulis. Artinya spesifikasi punya tabel tetapi tidak punya **jalur uji data awal**, dan itu membuat "CRUD lengkap" tidak dapat dibuktikan di CI. Ini lubang kontrak seed, bukan kelalaian estetika: tanpa seed, gerbang `NOT NULL`, `CHECK`, `EXCLUDE`, dan RLS tidak pernah teruji nilainya. Angka hari ini dicetak alat, bukan diturunkan dari tabel di bawah.',
  '',
  '**Aturan main (tidak berubah dari §8.1–§8.3).** Seed ditulis per **kelompok**, bukan per tabel acak; satu kelompok = satu berkas seed idempoten; tenant sampel `SICN-DEMO` + satu tenant kedua khusus uji silang (NFR-S1). Nilai kamus wajib lewat `reference_items` (§20) dan **tidak pernah** hardcode di seed; parameter hanya dari katalog §21.3.',
  '',
  '| Kelompok seed | Modul yang dilayani | Objek inti | Baris minimum agar uji bermakna | Status |',
  '|---|---|---|---|---|',
  '| `S-01 platform` | M-01, M-02, M-03, M-05 | tenants, tenant_settings, users/roles/assignments, permissions, master_system_parameters | 2 tenant · 12 peran-assignment · seluruh katalog parameter §21.3 · 4 kanal notifikasi | spesifikasi ada (`§8.2`) |',
  '| `S-02 kamus` | M-02 (data master) | reference_kinds + reference_items (§20.4) | ≥ 1 item per kind + 1 item `is_active=false` untuk uji `?at=` | target §8.3 tercapai |',
  '| `S-03 akademik inti` | M-12…M-19 | academic_periods, curricula, courses, study_programs, classes, enrollments, grades, attendances | 1 prodi × 2 periode × 8 kelas × 40 mahasiswa | §5/§6 existing |',
  '| `S-04 keuangan` | M-10, M-11 | invoices, fee_tariff_groups, tuition_tariff_matrix, virtual_accounts, scholarships | 3 golongan tarif × 2 jalur + 2 tagihan tertunggak untuk uji gerbang KRS | berkas migrasi belum ada → seed tidak dapat dijalankan (`G-02`) |',
  '| `S-05 kepegawaian & iuran` | M-06, M-07, M-08 | employees, payroll_runs, leave, `social_insurance_participations`, `anomaly_domain_settings` | 6 dosen (1 dengan lebih dari satu kepesertaan) + 4 staff + 2 program iuran | **baru: `0079`/`0081` (2026-10-21)** — menunggu berkas diterapkan |',
  '| `S-06 intake & siklus hidup` | M-09, M-14, M-23, M-27, M-30, M-35 | pmb_* , nim_assignments, graduation_records, documents, student_cards, tracer_* | 2 jalur × 2 gelombang (1 beririsan = **wajib ditolak**) + 1 pendaftar lolos 2 prodi | **baru: `0021`/`0076`/`0077`** (`DATA_MODEL §23`) |',
  '| `S-07 sarana & fasilitas` | M-39, M-40, M-41, M-42, M-43 | pustaka (item/peminjaman), aset + penyusutan, rekam klinik, asrama, acara | 20 aset (1 rusak untuk tiket) + 1 pinjaman lewat jatuh tempo (denda) | `0067`–`0070` belum berberkas |',
  '| `S-08 mutu & regulasi` | M-30…M-34 | sertifikat/legalisir, staging Feeder, bukti akreditasi, sumber IKU | 1 borang 9 kriteria + 1 staging run CP1/CP2 | sebagian objek tanpa DDL (`CRD-6`) |',
  '| `S-09 kelas khusus PDP` | M-36, M-41 | kasus PPKS (terenkripsi), rekam klinik (terenkripsi) | 2 kasus + access-log; **tanpa nilai rahasia di seed** | wajib DPIA sebelum produksi |',
  '| `S-10 kemahasiswaan & publikasi` | M-21, M-24, M-25, M-26, M-28, M-29 | kegiatan & poin SKKM, magang/KKN, jurnal & publikasi, simulasi kelulusan, karier, mobilitas | 1 mahasiswa dengan 3 aktivitas (2 lolos konversi, 1 ditolak) + 1 publikasi ber-ISSN + 1 skenario simululus "belum lulus" | kontrak belum ditulis (`SED-1`) |',
  '| `S-11 tata kelola non-akademik` | M-04, M-37, M-44, M-45, M-46, M-47 | tiket helpdesk, temuan SPMI, hibah/LPPM, lead CRM, paket pengadaan, dana abadi | 3 tiket (1 escalasi) + 2 temuan mutu (1 closed) + 1 hibah + 1 lead + 1 paket pengadaan | kontrak belum ditulis (`SED-1`) |',
  '',
  '**Cara ukur (jangan kutip angkanya dari tabel di atas).** `node .tools/module-provenance.mjs` mencetak kolom `SEED` per modul; target siklus berikutnya = **0 modul tanpa rujukan seed**. `node .tools/seed-count.mjs` tetap mengukur tiga frontier yang sudah ada (parameter, kamus, kanal), dan sisi nyata tetap **0** sampai berkas migrasi benar-benar dieksekusi (`G-02`).',
  '',
  '**Yang TIDAK dilakukan di sini.** Tidak ada angka seed yang dikarang untuk modul yang objeknya belum punya DDL; sebelas kelompok di atas adalah **kontrak**, dan barisnya ditulis pada tiket `SED-1` (`ROADMAP §2.25`) setelah objeknya nyata. Menaruh puluhan baris fixture palsu akan membuat CI hijau di atas kertas — persis kegagalan generator yang dibuang pada `RD-83`.',
  '',
];

appendTail('docs/SEED_DATA.md', seed84.join(NL), 'SEED_DATA 8.4');
