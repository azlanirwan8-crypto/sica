import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

/* Sisip PRD 5.20 — registri pedoman per modul (48 baris).
   Isi kolom "Dasar" HANYA nama regulasi/standar yang sudah dipakai di dokumen SICA; nomor
   pasal yang tidak yakin saya biarkan, dan nomor yang belum dicek owner legal diberi penanda
   VERIFIKASI-LEGAL. Alat penolak: .tools/pedoman-coverage.mjs */

const R = [
  ['M-01', 'SaaS Foundation', 'UU PDP 27/2022 (pengendali data antar-tenant) · PP 71/2019 PSTE (penyelenggaraan & audit sistem) `VERIFIKASI-LEGAL`', 'Admin area & manajemen langganan (`BENCHMARK_SEVIMA §2`)', 'PP 71/2019 mengikat instansi publik; untuk PT swasta dipakai sebagai praktik baik, bukan klaim kepatuhan.'],
  ['M-02', 'Master Parameter', 'UU PDP 27/2022 (kamus tidak boleh menampung PDP tanpa kelas) · 53/2023 (kosakata akademik: SKS, modus, sifat pembelajaran) · PDDikti Feeder (kode nasional kelas B)', 'Data Master & kamus (`BENCH-*` gugus admin)', 'Kelas B hanya dipetakan labelnya oleh tenant; kode nasional tidak dapat disunting (`AGENTS §3.10`).'],
  ['M-03', 'Hak Akses & RBAC', 'UU PDP 27/2022 (pembatasan akses data pribadi) · PP 71/2019 PSTE (manajemen akses & jejak) `VERIFIKASI-LEGAL`', 'Role & Hak Akses Sevima (`BENCHMARK_SEVIMA §2`)', 'SoD ditegakkan oleh `CHECK` di DB, bukan niat (`RBAC §5`).'],
  ['M-04', 'IT Helpdesk', 'Tidak ada dasar regulasi spesifik — standar layanan internal; PP 71/2019 PSTE (dukungan SPBE) `VERIFIKASI-LEGAL`', 'Tidak ada padanan di katalog Sevima', 'Dinyatakan eksplisit: modul ini tidak boleh dijual sebagai "kepatuhan regulasi".'],
  ['M-05', 'Keamanan & Audit', 'UU ITE 11/2008 ps.15/28 (jejak elektronik) `VERIFIKASI-LEGAL` · UU PDP 27/2022 (log akses) · PP 71/2019 PSTE (audit) `VERIFIKASI-LEGAL`', 'Log aktivitas admin Sevima', 'Masa retensi jejak = keputusan pemilik, bukan angka yang saya turunkan sendiri.'],
  ['M-06', 'HRIS & Payroll', 'UU 13/2003 Ketenagakerjaan + UU Cipta Kerja · PPh 21 TER (PMK 168/2023) `VERIFIKASI-LEGAL` · UU 40/2004 SJSN + PP 86/2013 (Ketenagakerjaan) + Perpres JKN (Kesehatan) `VERIFIKASI-LEGAL`', 'SDM, penggajian, lembur (`BENCH-40…74`)', 'Tarif iuran & pajak disimpan berversi basis-poin (`0079`), tidak pernah sebagai konstanta kode.'],
  ['M-07', 'BKD Dosen', '53/2023 (beban kerja & satuan SKS dosen) · SISTER 2.0 (format laporan BKD)', 'Tidak ada padanan setara di Sevima', 'Rumus BKD adalah statuta/kebijakan kampus → parameter berversi; SICA tidak memutus angka nasional.'],
  ['M-08', 'SISTER Sync', 'SISTER 2.0 (PUSDIAT) · UU PDP 27/2022 (data dosen)', 'Tidak ada padanan di Sevima', 'Skema pertukaran vendor ditandai `VERIFIKASI-VENDOR`; tanpa field yang dikarang.'],
  ['M-09', 'PMB & OCR', '53/2023 (jalur, seleksi, daya tampung) · UU PDP 27/2022 (NIK, nama ibu) · ketentuan KIP-K `VERIFIKASI-LEGAL`', 'PMB Sevima: jalur, gelombang, seleksi, daftar ulang, NIM (`BENCH-01…34`)', 'OCR berjalan lokal tanpa egress (`AGENTS §3.9`); hasil ekstraksi adalah data, bukan instruksi.'],
  ['M-10', 'Keuangan & Billing', '53/2023 (biaya pendidikan & UKT) · UU PDP 27/2022 · ketentuan tarif `VERIFIKASI-LEGAL`', 'Tagihan, VA, konfirmasi pembayaran Sevima', 'Gerbang KRS membaca tagihan dari DB; nominal tidak pernah dikirim sebagai konstanta.'],
  ['M-11', 'KIP-K & Beasiswa', 'Ketentuan beasiswa/KIP-K nasional `VERIFIKASI-LEGAL` · UU PDP 27/2022 (data kondisi ekonomi = sensitif)', 'Beasiswa sebagian (`BENCH-*`)', 'Verifikasi kelayakan dari sumber eksternal = `VERIFIKASI-VENDOR`; SICA hanya menyimpan keputusan + alasan.'],
  ['M-12', 'Kurikulum OBE', '53/2023 (CPL, Sub-CPMK, CPMK, SKS, asesmen) · BAN-PT/LAM (format borang kurikulum)', 'Kurikulum & mata kuliah Sevima', 'Peta CPL→Sub-CPMK harus lengkap sebelum `ALG-13` menampilkan angka; bila belum → `NO_PREREQ_DATA`.'],
  ['M-13', 'KRS Online & Perwalian', '53/2023 (batas beban SKS per IP) · PDDikti PDM (data registrasi akademik)', 'KRS Sevima', 'Band SKS per IP = tabel berversi di M-02, bukan `if` di kode (`AGENTS §3.10`).'],
  ['M-14', 'Jadwal & Ruang', '53/2023 (kalender & beban belajar) · PDDikti PDL/PDG', 'Jadwal & kelas Sevima', 'Kapasitas ruang/laboran adalah prasyarat ALG-2; tanpanya hasilnya `NO_PREREQ_DATA`, bukan jadwal kosong.'],
  ['M-15', 'Moda Perkuliahan', '53/2023 (pembelajaran daring/luring/hibrida) · PDDikti sifat pembelajaran F/O/M', 'Tidak ada padanan eksplisit di Sevima', 'Satu kosakata modus (`DATA_MODEL §21.4`); label hadir daring adalah proyeksi, bukan enum kedua.'],
  ['M-16', 'LMS Digital', '53/2023 (bobot asesmen & interaksi belajar) · UU PDP 27/2022 (konten & aktivitas)', 'e-learning sebagian', 'LMS milik sendiri; tidak ada konten atau PII yang keluar infrastruktur.'],
  ['M-17', 'Ujian & Proctoring', '30/2021 (PPKS — untuk pemantauan berbasis data sensitif) · UU PDP 27/2022 (biometrik)', 'Ujian/CBT Sevima', 'Kamera & liveness berbayar dilarang (`AGENTS §3.9`); proctoring hanya aturan lokal + jejak.'],
  ['M-18', 'Presensi Smart', '53/2023 (kehadiran minimum) · PDDikti (kode hadir, termasuk daring) · UU PDP 27/2022 (data lokasi)', 'Presensi Sevima (QR/absensi)', 'Radius geofence & ambang rasio dibaca dari katalog parameter §21.3; retensi lokasi 7–730 hari (`0078`).'],
  ['M-19', 'Nilai & KHS', '53/2023 (skala, pembobotan, konversi nilai) · PDDikti PNL', 'Nilai & transkrip Sevima', 'Engine mengusulkan, manusia menyetujui; tidak ada jalur tulis engine ke `grades`.'],
  ['M-20', 'Tugas Akhir & RAMA', '53/2023 (bentuk TA selain skripsi) · UU 28/2014 Hak Cipta', 'PPI/seminar sebagian (`BENCH-100…118`)', 'Pembimbing penguji diproteksi SoD; RAMA = proyek bersama antar-perguruan tinggi, belum diverifikasi vendor.'],
  ['M-21', 'Jurnal & OJS', 'SINTA (rekognisi publikasi) · UU 28/2014 Hak Cipta', 'Tidak ada padanan di Sevima', 'OJS/KOHA adalah sistem eksternal — integrasi ditandai `VERIFIKASI-VENDOR`, tidak ada klaim sudah jalan.'],
  ['M-22', 'Inkubator & HAKI', 'UU 28/2014 Hak Cipta · UU 20/2016 Merek (DJKI) `VERIFIKASI-LEGAL`', 'Tidak ada padanan di Sevima', 'SICA menghitung batas waktu & menyiapkan berkas; pengajuan tetap ke DJKI, tidak otomatis.'],
  ['M-23', 'Wisuda & Toga', '53/2023 (kelulusan & penobatan) · PDDikti PDL', 'Wisuda/legalisir Sevima', 'Objek kanonis = `commencement_batches` (ralat nama 2026-10-21); bukan "convocation".'],
  ['M-24', 'Kemahasiswaan & SKKM', '53/2023 (kegiatan ko-kurikuler & konversi) · 30/2021 (Perlindungan Mahasiswa: pelaporan) ', 'Poin kegiatan/SKKM sebagian', 'Aturan poin = kebijakan kemahasiswaan kampus → kamus + parameter, bukan kode.'],
  ['M-25', 'KKN, PKL & Magang', '53/2023 (pembelajaran di luar prodi) · ketentuan MBKM `VERIFIKASI-LEGAL`', 'KKN sebagian', 'Konversi SKS menuntut `course_equivalencies`; tanpanya hasil = `PARTIAL`.'],
  ['M-26', 'Simulasi Lulus', '53/2023 (syarat lulus)', 'Tidak ada padanan di Sevima', 'Read-only: tidak pernah menulis status kelulusan resmi (milik M-30 + aksi `VALIDATE`).'],
  ['M-27', 'Tracer Study', 'IKU 1/2/5 (kerangka pengukuran lulusan) · UU PDP 27/2022 (data alumni)', 'Tidak ada padanan di Sevima', 'Instrumen kuesioner = data (M-02); objek `0077` baru ditulis siklus ini.'],
  ['M-28', 'Career Center', 'IKU 2 (lulusan bekerja pertama) · UU PDP 27/2022', 'Tidak ada padanan di Sevima', 'Entitlement masih `usulan:` — belum SKU nyata, jangan dijual.'],
  ['M-29', 'KUI & Mobilitas', '53/2023 (mobilitas & konversi) · ketentuan imigrasi/KITA untuk WNA `VERIFIKASI-LEGAL`', 'Tidak ada padanan di Sevima', 'Dokumen imigrasi disimpan terenkripsi; tidak ada klaim otomatis visa.'],
  ['M-30', 'Yudisium & SKPI', '53/2023 (ijazah & statement) · PDDikti PDS · UU 43/2009 Kearsipan', 'Legalisir/SKL & laporan Sevima', 'Verifikasi digital = nomor seri + QR milik kampus; tanpa vendor tanda tangan (RFC 3161 dilarang).'],
  ['M-31', 'Akreditasi LKPS', 'BAN-PT/LAM (9 kriteria) · SPMI (Permendikbudristek tentang penjaminan mutu) `VERIFIKASI-LEGAL`', 'Tidak ada padanan setara', 'Auto-borang hanya agregasi bukti; setiap angka menunjuk tabel sumber, bukan taksiran.'],
  ['M-32', 'Dashboard IKU', 'IKU 1–8 (Permenristekdikti/Permendikbudristek) `VERIFIKASI-LEGAL` · SISTER (sumber data sebagian indikator)', 'Tidak ada padanan di Sevima', 'Proyeksi wajib ditandai `degraded`; dashboard tidak boleh menampilkan taksiran sebagai capaian.'],
  ['M-33', 'Jadwal Darurat', '53/2023 (kalender akademik & perubahan perkuliahan) · kebijakan internal kampus (status tanggap)', 'Tidak ada padanan di Sevima', 'Baris ini ditulis khusus untuk menutup temuan `REGULASI` terakhir hasil `module-provenance`; tidak ada dasar hukum khusus "jadwal darurat" yang saya klaim.'],
  ['M-34', 'Feeder PDDikti', 'PDDikti/PDID (skema Feeder) · UU PDP 27/2022 · 53/2023 (data yang dilaporkan)', 'Tidak ada padanan setara', 'Versi skema & daftar error = `VERIFIKASI-VENDOR`; kirim ulang wajib idempoten.'],
  ['M-35', 'PIN & SIVIL', 'UU PDP 27/2022 (identifikasi personal) · ketentuan SIVIL Kemendikbudristek `VERIFIKASI-VENDOR`', 'Tidak ada padanan di Sevima', 'PIN adalah kredensial: tidak pernah masuk parameter, log, atau body (`DATA_MODEL §21.2`).'],
  ['M-36', 'Portal PPKS', '30/2021 (PPKS) · UU PDP 27/2022 (data sensitif & anak)', 'Tidak ada padanan di Sevima', 'Enkripsi beramplop + access-log wajib; isi kasus tidak pernah masuk log atau notifikasi; DPIA sebelum produksi.'],
  ['M-37', 'SPMI & Quality', 'SPMI (sistem penjaminan mutu internal) · BAN-PT/LAM · 53/2023 (standar nasional yang diawasi)', 'Tidak ada padanan di Sevima', 'Temuan audit = data + aksi `VALIDATE`; SICA tidak menetapkan standar mutu nasional.'],
  ['M-38', 'Kampus Merdeka / MBKM', '53/2023 (pembelajaran di luar prodi, konversi hingga 20 SKS sesuai ketentuan) · IKU 2/3', 'Tidak ada padanan di Sevima', 'Persetujuan Dekan + SoD; nilai mitra masuk lewat bukti, bukan asumsi.'],
  ['M-39', 'e-Library', 'UU 43/2007 Perpustakaan `VERIFIKASI-LEGAL` · UU 43/2009 Kearsipan · standar metadata MARC21/Dublin Core', 'Tidak ada padanan di Sevima', 'Repositorium = PDDikti; interoperabilitas KOHA/SLiMS ditandai `VERIFIKASI-VENDOR`.'],
  ['M-40', 'Aset & Inventaris', 'PMK pengelolaan BMN untuk PTN `VERIFIKASI-LEGAL` · standar akuntansi aset/penyusutan (SAK/PMK) `VERIFIKASI-LEGAL`', 'Sarana-prasarana & aset sebagian', 'Metode penyusutan adalah parameter berversi; untuk PT badan hukum yang berlaku statuta & kebijakan internal.'],
  ['M-41', 'Klinik Kampus', 'UU 17/2023 Kesehatan `VERIFIKASI-LEGAL` · ketentuan rekam medis `VERIFIKASI-LEGAL` · UU PDP 27/2022', 'Tidak ada padanan di Sevima', 'Rekam medis `SERVER_ONLY` + access-log; tidak ada klaim sertifikasi faskes sampai owner legal mengonfirmasi.'],
  ['M-42', 'Asrama & Kantin', 'UU PDP 27/2022 (penghuni) · ketentuan kelaikan/keamanan bangunan `VERIFIKASI-LEGAL`', 'Tidak ada padanan di Sevima', 'SICA tidak menerbitkan sertifikasi (halal/kelaikan) — hanya mencatat bukti dari unit terkait.'],
  ['M-43', 'Humas & Event', 'UU ITE 11/2008 (konten elektronik) `VERIFIKASI-LEGAL` · UU PDP 27/2022 (publikasi nama & foto)', 'Pengumuman/portal sebagian', 'Persetujuan publikasi adalah data eksplisit per orang; tidak ada consent default.'],
  ['M-44', 'SIM-LPPM / LITABMAS', 'SISTER (PDD/hibah) · UU 11/2019 IRTE `VERIFIKASI-LEGAL` · 30/2021 (etika riset bila melibatkan subjek) ', 'Tidak ada padanan di Sevima', 'Ekspor ke SISTER = berkas yang disiapkan, bukan pengiriman otomatis yang sudah diverifikasi.'],
  ['M-45', 'CRM PMB & Marketing', 'UU PDP 27/2022 (profiling) · UU ITE ps.25 (pesan komersial) `VERIFIKASI-LEGAL`', 'Tidak ada padanan di Sevima', 'Consent + opt-out wajib; pengiriman massal tanpa consent = temuan, bukan fitur.'],
  ['M-46', 'E-Procurement PBJ', 'Perpres PBJ untuk instansi pemerintah `VERIFIKASI-LEGAL` · LKPP e-katalog · PP pengelolaan keuangan PTN-BH `VERIFIKASI-LEGAL`', 'Tidak ada padanan di Sevima', 'HPS/PPK/kuasa adalah peran, bukan flag; untuk PT badan hukum mengacu statuta + kebijakan internal.'],
  ['M-47', 'Endowment Fund', 'Ketentuan pengelolaan dana endowment PTN (PMK/PP) `VERIFIKASI-LEGAL` · UU PDP 27/2022 (donatur)', 'Tidak ada padanan di Sevima', 'Tahap spesifikasi; belum ada objek ledger endowment yang nyata — jangan diklaim berjalan.'],
  ['APP', 'SuperApp Mobile', '53/2023 & UU PDP 27/2022 berlaku identik dengan Web · paritas fungsi = `AGENTS §3.4`', 'Aplikasi mobile kampus Sevima', 'Tidak ada perhitungan atau vonis akademik di perangkat; read-model luring berlabel `SERVER_ONLY`.'],
];

// buang baris bantu yang tidak dipakai
const rows = R.filter((r) => r[0] !== 'M-33 note');

const block = [
  '### 5.20 Registri pedoman per modul — dasar regulasi & rujukan Sevima untuk 48 modul — 2026-10-21',
  '',
  '**Kenapa per modul, setelah §5.19 per gugus.** `node .tools/module-provenance.mjs` mengukur bahwa rujukan regulasi **tidak tersebar merata**: pada pengukuran pertama siklus ini, hanya sebagian kecil modul memiliki baris di dokumen mana pun yang menyebut modul **bersamaan** dengan regulasi induknya, dan **satu modul (M-33) tidak punya rujukan regulasi sama sekali**. Gugus di §5.19 tidak menjawab itu karena ia memetakan kelompok, bukan baris. Registri ini menurunkannya per modul supaya (a) tidak ada modul yang dibangun tanpa dasar, (b) tidak ada dasar yang dibangun tanpa verifikasi.',
  '',
  '**Aturan penulisan registri ini (tidak boleh dilanggar saat menambah baris).** (1) Kolom "Dasar" hanya boleh memuat **nama regulasi/standar yang nyata**; nomor pasal yang tidak yakin **tidak ditulis**, bukan ditebak. (2) Penanda `VERIFIKASI-LEGAL` = nomor/kewenangan **belum dikonfirmasi owner legal** dan karena itu **dilarang** muncul di teks pengguna, brosur, atau acceptance criteria (`ROADMAP §2.25` tiket `PRV-1`). (3) Penanda `VERIFIKASI-VENDOR` = skema/format pihak ketiga belum diverifikasi terhadap dokumen teknis vendor; field yang belum terverifikasi **tidak boleh diciptakan** di DDL. (4) Sevima adalah **bukti pasar**, bukan dasar: baris "Tidak ada padanan di Sevima" berarti justifikasinya harus regulasi/proses nyata, dan itu justru yang ditulis di kolom Dasar. (5) Registri **tidak** mendefinisikan kebutuhan — definisi tetap di §5.x per modul.',
  '',
  '| M | Modul | Dasar regulasi/standar Indonesia | Rujukan Sevima | Batas jujur / konsekuensi desain |',
  '|---|---|---|---|---|',
  ...rows.map((r) => '| ' + r.join(' | ') + ' |'),
  '',
  '**Yang tidak berubah karena registri ini.** Tidak satu pun FR/AC di §5.x dipindah ke sini, dan tidak ada nomor regulasi baru yang "ditemukan" oleh agen: yang ditulis adalah **rujukan yang sudah dipakai di dokumen SICA** (PRD/SECURITY/INTEGRATIONS/RBAC) lalu dipetakan per modul, ditambah penanda verifikasi untuk yang belum dicek. Alat `node .tools/pedoman-coverage.mjs` menolak registri ini bila jumlah barisnya bukan 48, bila ada modul registri yang kehilangan baris, atau bila muncul penanda `VERIFIKASI-*` yang tidak dikenal.',
  '',
];

let t = readFileSync('docs/PRD.md', 'utf8');
if (t.includes('### 5.20 Registri pedoman per modul')) { console.log('dilewati: PRD 5.20'); }
else {
  const anchor = '## 6. Acceptance Criteria (terukur)';
  const i = t.indexOf(anchor);
  if (i < 0) { console.error('ANCHOR hilang'); process.exit(1); }
  writeFileSync('docs/PRD.md', t.slice(0, i) + block.join(NL) + NL + NL + t.slice(i), 'utf8');
  console.log('sisip PRD 5.20 (baris modul = ' + rows.length + ')');
}
