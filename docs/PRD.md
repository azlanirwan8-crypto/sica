# SICA — Product Requirements Document

| | |
|---|---|
| Produk | **SICA** — Sistem Informasi Campus Akademik |
| Model | SaaS B2B multi-tenant untuk perguruan tinggi Indonesia |
| Versi dokumen | 0.1 (draft baseline) |
| Status | Siap implementasi Fase 1; asumsi terkontrol terdaftar di §9 |
| Dokumen terkait | [INDEX.md](file:///c:/SICA/docs/INDEX.md) · [ARCHITECTURE.md](file:///c:/SICA/docs/ARCHITECTURE.md) · [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md) · [SECURITY_COMPLIANCE.md](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md) · [GLOSSARY.md](file:///c:/SICA/docs/GLOSSARY.md) |

---

## 1. Visi Produk

> **Setiap perguruan tinggi Indonesia menjalankan siklus akademik lengkap — dari penerimaan mahasiswa baru sampai ijazah tercatat di PDDIKTI — dalam satu platform yang tidak pernah mati pada hari Open Wiring.**

Positioning: SICA bukan "website kampus". SICA adalah **sistem pencatatan resmi (system of record)** untuk status akademik, nilai, dan tagihan. Konsekuensi positioning ini mengikat seluruh keputusan desain:

1. **Akurasi > fitur.** Satu nilai salah = protes mahasiswa, temuan audit, atau gagal akreditasi. Write path akademik harus transactional, idempotent, dan ter-audit.
2. **Ketersediaan pada puncak > rata-rata.** Profil beban SIAKAD adalah trafik datar + ledakan serentak (OW/KRS, bayar UKT, lihat KHS). SLO diukurnya pada jam puncak, bukan rata-rata harian.
3. **Kepatuhan adalah fitur.** Pelaporan PDDIKTI dan jejak audit bukan add-on; ia penentu bentuk skema data sejak awal.
4. **Konfigurasi > kustomisasi kode.** Setiap kampus punya aturan sendiri (band SKS, denda, konversi nilai, syarat yudisium). Yang tidak bisa dikonfigurasi akan memicu fork kode — penyakit mematikan produk multi-tenant.

### Prinsip desain non-negotiable
| # | Prinsip | Konsekuensi teknis |
|---|---|---|
| P1 | Data antar-tenant tidak pernah bercampur, bahkan karena bug | RLS di database sebagai enforcer utama, bukan hanya filter aplikasi (§ ARCHITECTURE) |
| P2 | Tidak ada mutasi data akademik tanpa jejak | `audit_logs` append-only + hash chain, termasuk perubahan nilai & pembatalan tagihan |
| P3 | Tidak ada uang atau SKS yang hilang | Ledger append-only; koreksi via reversing entry, bukan `UPDATE`/`DELETE` |
| P4 | Aturan bisnis adalah data, bukan kode | Semua ambang (band SKS, denda, deadline, skala nilai) tersimpan & versioned |
| P5 | Server adalah sumber kebenaran otorisasi | Menyembunyikan tombol di UI bukan kontrol akses |

---

## 2. Masalah yang Dipecahkan

| Masalah lapangan (terverifikasi dari praktik kampus) | Dampak hari ini | Jawaban SICA |
|---|---|---|
| Hari OW/KRS sistem lama tumbang | Ribuan mahasiswa gagal daftar kelas dalam satu hari, eskalasi ke rektorat | Queue-based enrollment + atomic quota + load gate (NFR-P1) |
| Mahasiswa sudah isi KRS tapi namanya tidak muncul di roster dosen | Kelas "hantu", presensi & nilai tidak bisa diinput | Enrollment projection konsisten + inspeksi konsistensi terjadwal + notifikasi status |
| KRS lewat batas waktu diselesaikan dengan surat tulisan tangan + stempel | Data offline, tidak teraudit, keputusan tidak konsisten | Alur *late KRS* in-system dengan approval + alasan + audit |
| Koreksi nilai butuh admin membuka kunci, tanpa jejak alasan | Celah fraud, temuan audit | Workflow koreksi: usulan dosen → approval Kaprodi → alasan wajib → audit (BR-G4) |
| Kuesioner belum diisi memblokir KHS/KRS, aturannya tersebar | Protes & bypass manual | Aturan *prerequisite checklist* terparameter per prodi/periode |
| Syarat ujian butuh cek "bebas keuangan" & "bebas perpustakaan" dari dua sistem berbeda | Yudisium tertunda | Clearance engine: agregator syarat lintas modul dengan status per-mahasiswa |
| Feeder PDDIKTI dikerjakan satu operator, tanpa backup | Pelaporan terlewat, data ditolak per record | Modul sync ber-adapter + laporan kepatuhan per prodi + validasi pra-kirim |
| Tagihan menghasilkan denda yang tidak konsisten & lupa dibatalkan | Sengketa keuangan | Engine tarif terparameter + idempotensi pembayaran + void via reversing entry |

---

## 3. User Persona

Skala: 1 tenant kampus = 5.000 mahasiswa, 300 dosen, 60 prodi (asumsi A1 — lihat §9).

| Persona | % populasi | Motivasi utama | Sakit terbesar | Kekuasaan di sistem |
|---|---|---|---|---|
| **Mahasiswa** | 94% | Lulus tepat waktu, lihat tagihan, tidak dikunci saat OW | Sistem lambat saat OW, status tidak jelas | Baca data sendiri; submit KRS, skripsi, bayar |
| **Dosen Pengampu** | 5% | Input nilai & presensi cepat, roster akurat | Roster salah, deadline nilai mepet, form nilai bertele-tele | Tulis nilai/presensi hanya untuk kelas yang diampu |
| **Dosen PA / Pembimbing Akademik** | ±15% dari dosen | Validasi KRS tanpa harus membaca 200 proposal satu per satu | Volume validasi manual di awal semester | Approve/reject KRS mahasiswa bimbingan |
| **Kaprodi** | ±60 orang | Kendali kurikulum, kelas, yudisium; lulus audit | Aturan beda per prodi tapi sistem memaksa satu nilai global | CRUD scope prodi + approve koreksi nilai |
| **Admin Akademik (BAAK)** | 3–10 orang | Tutup periode, cetak transkrip, selesaikan kasus | Rekonsiliasi status, permintaan ubah data historis | CRUD akademik lintas prodi |
| **Admin Keuangan / Bendahara** | 2–8 orang | Tagihan tertagih, rekonsiliasi bersih | Pembayaran tak ter-match, retry dobel | CRUD tagihan/pembayaran + approval keringanan |
| **Operator Feeder PDDIKTI** | 1–3 orang (sering tanpa backup) | Kirim periode, tidak ditolak | Data lokal tidak memenuhi format wajib | Jalankan sync, baca error per record |
| **Pimpinan (Rektor/Warek/Dekan)** | 5–15 orang | Angka benar, keputusan cepat | Tidak punya dashboard; minta rekap ke staf | Read agregat + approve SK + e-sign |
| **Platform Operator SICA** (Tim Platform Engineering) | 2–5 orang | Deploy, dukung banyak tenant, isolasi insiden | Tenant besar menelan resource tenant kecil | Cross-tenant, break-glass ter-audit |
| **Alumni** | pasca-lulus | Legalisir, karier, ijazah digital | Proses legalisir lama & manual | Baca dokumen sendiri + kirim tracer study |
| **Pendaftar (CBT/PMB)** | musiman | Daftar, bayar, lihat lolos | Lupa akun, berkas ditolak tanpa alasan jelas | Write aplikasi sendiri |

**Catatan persona yang menentukan desain:** satu orang memegang beberapa role sekaligus (Dosen + Kaprodi + Pembimbing). Karena itu role **harus** melekat pada konteks (prodi, periode, kelas), bukan sebagai label global pada user. Ini keputusan skema di `DATA_MODEL.md` (`user_role_assignments.scope_*`).

---

## 4. User Journey Utama

### J1 — Onboarding tenant (waktu-ke-value, B2B critical)
`Sales tanda tangan` → Platform Operator buat tenant + domain → **Import master data** (prodi, kurikulum, mata kuliah, dosen, mahasiswa dari XLSX/template SICA atau skema legacy) → konfigurasi tahun & kalender akademik, aturan akademik, skala nilai, tarif → provision admin PT + MFA wajib → **Validasi pra-go-live** (report: data tidak lengkap, NIM duplikat, dosen tanpa NIDN) → aktifkan self-service → cutover dari portal lama (parallel run 1 periode).

*Metrik keberhasilan:* tenant baru bisa go-live tanpa keterlibatan engineering ≤ 14 hari kerja.

### J2 — Siklus tagih → bayar → KRS terbuka (journey paling sering rusak)
`Admin Akademik` buka periode & OW (kalender) → `engine tagihan` generate invoice massal untuk semua mahasiswa `AKTIF` per prodi/angkatan → mahasiswa terima notifikasi (email/WA) → bayar via VA/QRIS → gateway kirim callback → **verifikasi signature + idempotency key** → invoice → `PAID` → gerbang KRS terbuka otomatis → mahasiswa isi & ajukan KRS → validasi sistem (band SKS, prasyarat, bentrok, kuota) → `Dosen PA` approve → enrollment terbentuk, kuota kelas berkurang atomik → tagihan turunan (biaya per SKS bila skema SKS) dihitung ulang.

*Failure path wajib tertangani:* callback hilang, callback dobel, pembayaran sebagian, keringanan/diskon, tunggakan periode lalu, mahasiswa dibebaskan (beasiswa).

### J3 — Perkuliahan → nilai → KHS
`Admin Prodi` buat kelas + paralel + jadwal → `Kaprodi` tugaskan dosen pengampu → kelas muncul di dashboard dosen → presensi per pertemuan (QR/token/manual) → input nilai angka → **konversi skala nilai per kurikulum** (bukan hardcode) → `Kunci Nilai` (mandatory untuk KHS) → sistem hitung IP → KHS tersedia → *prerequisite checklist* (kuesioner, bebas keuangan, bebas perpustakaan) harus lolos sebelum KHS/KRS berikutnya → evaluasi otomatis peringatan/ancaman DO.

*Failure path:* dosen lupa input (status `K`), dosen ingin koreksi setelah kunci (BR-G4), nilai masuk setelah yudisium.

### J4 — Tingkat akhir → yudisium → ijazah → PDDIKTI
Mahasiswa cek syarat (SKS ≥ min, IPK ≥ min, tanpa `E`/`K`) → ajukan proposal → Kaprodi tetapkan pembimbing & penguji → log bimbingan per sesi → seminar proposal → ujian hasil → nilai TA → upload file final (cek similarity) → clearance engine konfirm "bebas keuangan/perpustakaan" → `Dekan` terbitkan SK yudisium (e-sign) → status `LULUS` + predikat → nomor ijazah → **sinkron PDDIKTI** → alumni + SKPI + tracer.

### J5 — Pimpinan mengambil keputusan
Rektor buka dashboard → IPK rata-rata, ketepatan nilai dosen, tunggakan, laju DO, kepatuhan feeder per prodi → drill-down prodi → export untuk rapat senat → tanda tangani SK dari dalam aplikasi.

### J6 — Platform Operator menangani insiden tenant
Alert anomali (error rate tenant X) → impersonation *hanya* dengan justifikasi + MFA + TTL pendek + tercatat di audit → identifikasi → perbaikan via job backfill ter-audit → postmortem. Tenant tidak pernah bisa melihat bahwa tenant lain ada.

---

## 5. Ruang Lingkup: MVP (Fase 1) vs Phase 2

Legenda: **M**andatory-regulatory (tidak bisa ditawar oleh kampus Indonesia), **B**usiness-critical, **C**onfigurable-at-tenant.

### 5.1 MVP — Fase 1 (target: menggantikan portal lama & memenuhi pelaporan nasional)

| ID | Modul | Fitur | Kelas |
|---|---|---|---|
| FR-ADM-01 | Administrasi | Tenant, domain, profil institusi, struktur fakultas/prodi/jenjang | B |
| FR-ADM-02 | Administrasi | Tahun akademik, periode (ganjil/genap/antar semester), status `DRAFT/OPEN/CLOSED` | B |
| FR-ADM-03 | Administrasi | Kalender akademik dengan tanggal kunci per periode | B |
| FR-ADM-04 | Administrasi | **Aturan akademik terparameter per prodi/periode**: jendela KRS, batas SKS, prasyarat, kuesioner, denda | C |
| FR-ADM-05 | Administrasi | Kurikulum + mata kuliah + SKS + prasyarat + daftar skala nilai per kurikulum | C |
| FR-ADM-06 | Administrasi | User, role, permission, penugasan role ber-scope, approval alur perubahan akses | B |
| FR-IDT-01 | Identitas | Login email/NIM + password Argon2id, MFA (TOTP/WebAuthn) untuk semua peran writes-admin | M |
| FR-IDT-02 | Identitas | Pemilih role saat login (multi-role), reset password self-service | B |
| FR-IDT-03 | Identitas | Session table + revocation server-side, perangkat & riwayat login | B |
| FR-AKA-01 | Akademik | Penugasan dosen ke kelas (koordinator + anggota), roster | B |
| FR-AKA-02 | Akademik | OW / pengisian KRS dengan validasi aturan + kuota atomik | B |
| FR-AKA-03 | Akademik | Approval KRS oleh Dosen PA/Kaprodi + alasan penolakan | C |
| FR-AKA-04 | Akademik | Late-KRS / KRS manual ber-approval + audit | C |
| FR-AKA-05 | Akademik | Presensi per pertemuan, rekap, ambang minimal presensi sebelum UTS/UAS | C |
| FR-AKA-06 | Akademik | Input nilai, kunci nilai, koreksi nilai ber-workflow | B |
| FR-AKA-07 | Akademik | IP per periode, IPK, KHS, transkrip berversi | B |
| FR-AKA-08 | Akademik | Status mahasiswa + riwayat (AKTIF/CUTI/DO/LULUS/STOP), perubahan ber-approval | B |
| FR-AKA-09 | Akademik | **Komposisi nilai** per mata kuliah/kelas: bobot komponen (Tugas, Praktikum, UTS, UAS) yang **harus berjumlah 100%** sebelum nilai bisa diinput | C |
| FR-AKA-10 | Akademik | **Cekal (blokir) per jenis**: Akademik, Keuangan, Perpustakaan, Kemahasiswaan — ditegakkan saat pengisian KRS & saat yudisium | C |
| FR-AKA-11 | Akademik | KRS terkunci setelah diajukan (koreksi hanya lewat jalur *sunting KRS* ber-approval + audit), plus approval KRS **massal** oleh Dosen PA | B |
| FR-AKA-12 | Akademik | Pengaturan per prodi-per-periode sebagai satu objek konfigurasi (jendela KRS/validasi/cetak KRS/KHS/input nilai/kuesioner/generate pertemuan/batas ubah presensi) | C |
| FR-AKA-13 | Akademik | **Yudisium & Kelulusan**: Pendaftaran yudisium, verifikasi otomatis syarat kelulusan (min SKS per jenjang BR-R3, min IPK BR-R6, bebas nilai E/K, clearance bebas cekal BR-S4, akreditasi prodi valid BR-R7), penetapan predikat kelulusan (BR-R6), penerbitan SK Yudisium, dan update status mahasiswa ke `LULUS` siap lapor PDDIKTI | M |
| FR-AKA-14 | Akademik | **Cetak Dokumen Akademik Resmi**: Generator PDF server-side untuk Kartu Rencana Studi (KRS), Kartu Hasil Studi (KHS), Transkrip Akademik Sementara, dan Kartu Peserta Ujian (UTS/UAS) dilengkapi QR Code verifikasi dokumen (URL publik dengan hash integritas) | B |
| FR-AKA-15 | Akademik | **Penjadwalan Kuliah & Ruang (Dasar)**: Manajemen data master ruang kuliah (gedung, kapasitas kursi, tipe ruang/lab), alokasi jadwal mingguan kelas kuliah (hari, jam mulai-selesai, ruang), serta deteksi & pencegahan bentrok (*conflict detection*) jadwal dosen dan ruangan | B |
| FR-KEU-01 | Keuangan | Komponen tarif per prodi/angkatan/jenjang + versioned | C |
| FR-KEU-02 | Keuangan | Engine generate tagihan massal per periode (idempotent) | B |
| FR-KEU-03 | Keuangan | Pembayaran VA/QRIS + webhook verified + idempotency + rekonsiliasi harian | B |
| FR-KEU-04 | Keuangan | Ledger append-only, void via reversing entry, laporan piutang & pendapatan | M |
| FR-KEU-05 | Keuangan | Gerbang KRS berbasis status lunas/dibebaskan + keringanan ber-approval | C |
| FR-KEU-06 | Keuangan | **Aturan Akademik sebagai pemetaan gerbang**: komponen tarif → aksi yang dibatasi (lihat KHS, ambil KRS, KRS semester pendek, ikut UTS, ikut UAS, generate mahasiswa) | C |
| FR-KEU-07 | Keuangan | Semantik status tagihan 4-keadaan yang tidak ambigu bagi kasir & mahasiswa: `BELUM_BAYAR` / `BELUM_LUNAS` / `BAYAR_SEBELUM_LUNAS` (cicilan, belum cukup, termasuk potongan) / `LUNAS`; + cicilan & deposit | M |
| FR-FDR-01 | Feeder | Mapping entitas lokal → kode PDDIKTI (tabel data, bukan kode) | M |
| FR-FDR-02 | Feeder | Validasi kelayakan pra-kirim + laporan error per record | M |
| FR-FDR-03 | Feeder | Kirim/simpan periode, log sync, retry aman | M |
| FR-NTF-01 | Notifikasi | Email in-app ( + gateway WA bila dikonfigurasi) dengan template per event & preferensi | B |
| FR-AUD-01 | Audit | `audit_logs` append-only hash-chained untuk semua write akademik/keuangan | M |
| FR-RPT-01 | Reporting | Dashboard dasar: kepatuhan feeder, nilai terlambat, piutang, OW status | B |
| FR-PLT-01 | Platform | Provisioning tenant, fitur flag per tenant, kuota resource, billing-ready | B |

### 5.2 Phase 2 (setelah Fase 1 stabil satu periode penuh)

| ID | Modul | Cakupan Fitur & Alur Kerja | Integrasi Kunci |
|---|---|---|---|
| FR-P2-01 | PMB (Penerimaan Mahasiswa Baru) | Multi-jalur seleksi (prestasi/tes/rapor), portal pendaftaran online, verifikasi berkas digital, integrasi pembayaran biaya pendaftaran via VA/QRIS, penilaian & perankingan kuota prodi, pengumuman kelulusan, registrasi ulang online, **auto-generate NIM & auto-provisioning akun SICA** | Finance, Identity, Academic |
| FR-P2-02 | CBT (Computer-Based Test) | Bank soal per mata pelajaran/prodi, pengacakan soal & opsi, penjadwalan sesi tes PMB atau ujian berkala, antarmuka tes berbasis web dengan proteksi fullscreen, auto-grading instan, dan log integritas peserta | PMB, Security |
| FR-P2-03 | Tingkat Akhir & Bimbingan | Alur pengajuan & persetujuan judul/proposal skripsi/tesis, penugasan dosen pembimbing & penguji oleh Kaprodi, logbook bimbingan per sesi dengan paraf digital dosen, pendaftaran seminar proposal & sidang skripsi, integrasi cek similarity (Turnitin API), dan clearance pra-sidang | Academic, Grading, Document |
| FR-P2-04 | MBKM (Merdeka Belajar) | Katalog program MBKM (magang, studi independen, KKN, pertukaran mahasiswa), pendaftaran & persetujuan Dosen PA, kontrak belajar, log aktivitas mitra, penilaian mitra, dan alur konversi SKS ke transkrip akademik (maks 20 SKS per semester per BR-M1) | Academic, Curriculum, Feeder |
| FR-P2-05 | LMS (Learning Management System) | Silabus perkuliahan mingguan, distribusi materi (PDF, video, link), penugasan online dengan batas pengumpulan, kuis formatif, forum diskusi per kelas, serta sinkronisasi nilai tugas/kuis langsung ke komponen nilai SICA | Academic, Attendance, Grading |
| FR-P2-06 | Kurasi Mutu (SPMI & Akreditasi) | Siklus PPEPP (Penetapan, Pelaksanaan, Evaluasi, Pengendalian, Peningkatan), audit mutu internal (AMI), tindak lanjut CAPA, dan ekspor instan data instrumen akreditasi (9 kriteria BAN-PT / LAM-INFOKOM / LAM-PTKES) dari basis data SICA | Reporting, Audit, Leadership |
| FR-P2-07 | SDM Dosen & Tendik | Data induk dosen & staf (NIDN/NUPTK/NIP), portofolio Tridharma (pengajaran, penelitian, pengabdian), pelaporan Beban Kerja Dosen (BKD/SISTER), serta pemantauan presensi pegawai | Academic, Feeder SISTER |
| FR-P2-08 | Wisuda, Ijazah Digital & SKPI | Verifikasi berkas wisuda, penjadwalan seremoni & alokasi sesi wisuda, penomoran ijazah nasional (PISN/PIN Kemendiktisaintek), penerbitan Ijazah Digital & Transkrip ber-TTE tersertifikasi (PSrE terakreditasi BSSN seperti BSrE/Peruri per BR-R15), SKPI dwibahasa, serta portal legalisir digital online | Identity, Compliance, Feeder |
| FR-P2-09 | Dashboard Eksekutif Pimpinan | Visualisasi KPI lintas modul (tren penerimaan maba, rasio dosen-mahasiswa, rata-rata IPK lulusan, efisiensi penagihan UKT, kepatuhan pelaporan PDDikti), analisis kohort retensi & DO, dan ekspor ringkasan untuk rapat Senat/Rektorat | Reporting, Analytics |
| FR-P2-10 | Alumni & Tracer Study | Database alumni, kuesioner Tracer Study standar Dikti untuk pemenuhan IKU 1 (Indikator Kinerja Utama perguruan tinggi), tracking masa tunggu kerja & gaji pertama lulusan, dan portal lowongan kerja kampus | Student Status, Reporting |
| FR-P2-11 | Integrasi Eksternal Lanjutan | Integrasi sistem perpustakaan (Koha/SLiMS untuk otomatisasi clearance), pembayaran kartu kredit/convenience store, integrasi Single Sign-On kampus via OpenID Connect (OIDC) / SAML 2.0 (Google Workspace / Microsoft 365), dan ekspor data jurnal ke ERP keuangan | Identity, Finance, API |
| FR-P2-12 | Litabmas (Penelitian & Pengabdian) | Pengajuan proposal penelitian dan pengabdian masyarakat dosen, seleksi reviewer internal, manajemen kontrak hibah, pemantauan progress report & luaran (jurnal, paten, buku) | SDM, Reporting |
| FR-P2-13 | OBE (Outcome-Based Education) | Perancangan kurikulum OBE: pendefinisian Profil Lulusan, Capaian Pembelajaran Lulusan (CPL), Capaian Pembelajaran Mata Kuliah (CPMK), Sub-CPMK, matriks keterkaitan CPL-CPMK, perancangan rubrik penilaian berbasis capaian, dan dashboard portofolio ketercapaian CPL per mahasiswa & program studi untuk akreditasi internasional (ABET/ASIIN/IABEE) | Curriculum, Grading, Reporting |
| FR-P2-14 | AI Campus Assistant & Early Warning | Asisten AI berbasis LLM untuk menjawab FAQ mahasiswa (jadwal, tagihan, prosedur akademik), rekomendasi cerdas mata kuliah saat KRS, dan model prediktif peringatan dini (*early warning system*) untuk mahasiswa berisiko putus studi/DO berdasarkan histori presensi dan nilai | Academic, Student Status, Notif |

### 5.3 Batasan Ruang Lingkup (*Out of Scope*)

Fitur berikut secara eksplisit berada di luar ruang lingkup sistem SICA:
- **Tata Usaha Persuratan Umum**: Pengelolaan naskah dinas non-akademik umum (dikelola oleh sistem e-office kampus).
- **Akuntansi Penuh (*Double-Entry GL*)**: SICA membatasi lingkup pada modul piutang mahasiswa (*student accounts receivable* / billing & ledger); integrasi ke sistem ERP keuangan kampus disediakan via API/jurnal export.
- **Penggajian (*Payroll*)**: Penggajian dosen dan tenaga kependidikan dikelola oleh HRIS terpisah.
- **Perpustakaan Digital Mandiri**: SICA berfokus pada integrasi status bebas pustaka (*library clearance*) via webhook/API dengan Koha atau SLiMS, bukan mengelola repositori sirkulasi buku.
- **Perangkat Keras Biometrik**: Absensi didukung berbasis mobile/web QR-token; integrasi mesin fingerprint fisik diserahkan pada modul perantara.

### 5.4 Wawasan Implementasi Lapangan & Praktik Operasional Kampus

Berdasarkan analisis alur kerja operasional institusi pendidikan tinggi di Indonesia, berikut kebutuhan esensial yang diakomodasi ke dalam arsitektur SICA:

| Kebutuhan Praktis Kampus | Penanganan Teknis dalam Sistem SICA |
|---|---|
| **Gerbang Keuangan Multidimensi** | Gerbang pembayaran tidak hanya membatasi KRS, melainkan dikonfigurasikan fleksibel untuk aksi: melihat KHS, pendaftaran semester antara, kartu ujian UTS/UAS, dan proses kelulusan (`academic_rules.gates`). |
| **Cekal Terintegrasi (*Multi-dimensional Holds*)** | Pemblokiran hak akses mencakup 4 dimensi: Akademik, Keuangan, Perpustakaan, dan Kemahasiswaan (`blockades`). Status bebas cekal wajib terpenuhi sebelum pengisian KRS dan yudisium. |
| **Validasi Komposisi Nilai 100%** | Bobot komponen penilaian (Tugas, Praktikum, UTS, UAS) wajib berjumlah tepat 100% sebelum dosen dapat membuka form input nilai (`grade_components`, `AC-NIL-4`). |
| **Pemisahan Publikasi & Penguncian Nilai** | Status penilaian memisahkan antara pengumuman nilai sementara kepada mahasiswa dan penguncian resmi (*locked grade*) yang menjadi dasar penerbitan KHS definitif. |
| **Koreksi Nilai Pasca-Kunci Ter-audit** | Nilai yang telah dikunci hanya dapat dikoreksi melalui pengajuan resmi dosen dengan persetujuan Kaprodi, alasan tertulis, dan pencatatan riwayat perubahan (*before/after*) pada log audit. |
| **Persetujuan KRS Massal (*Batch Approval*)** | Dosen PA disediakan antarmuka persetujuan KRS massal per angkatan untuk mempercepat validasi di masa puncak awal semester tanpa mengabaikan penolakan individual. |
| **Prasyarat Kuesioner Evaluasi Dosen** | Pengisian kuesioner evaluasi pembelajaran semester lalu dapat diaktifkan sebagai prasyarat pembukaan KHS atau KRS periode berjalan. |
| **Status Tagihan 4-Keadaan** | Siklus penagihan merefleksikan kondisi riil: `BELUM_BAYAR`, `BELUM_LUNAS`, `BAYAR_SEBELUM_LUNAS` (cicilan/potongan beasiswa), dan `LUNAS` (`AC-KEU-4`). |
| **Alur Penataan Tahun Ajaran Baru** | Penyiapan semester baru mengikuti urutan dependensi ketat: Tahun Akademik → Periode → Pengaturan Prodi → Kelas Paralel → Dosen Pengampu → Jadwal Ruang → Penugasan Dosen PA. |
| **Penyelarasan Kalender Hari Libur** | Generator sesi pertemuan kuliah (`class_sessions`) otomatis mendeteksi hari libur nasional dan menggeser rencana perkuliahan ke jadwal pengganti/minggu berikutnya. |
| **Diferensiasi Peran Dosen** | Mengakomodasi kapasitas penugasan dosen secara simultan: Dosen Pengampu Kelas, Dosen Pembimbing Akademik (PA), serta Pembimbing/Penguji Tugas Akhir. |
| **Pemisahan Yudisium dan Seremoni Wisuda** | Yudisium diperlakukan sebagai peristiwa hukum kelulusan yang mengunci status akademik mahasiswa, sedangkan wisuda merupakan peristiwa seremonial yang dapat dijadwalkan dalam beberapa kloter. |
| **Penyelenggaraan Dual Mode (Onsite vs Online)** | Konfigurasi per tenant/prodi yang menyesuaikan seluruh alur sistem: kapasitas kelas fisik (40 mhs) vs virtual (150 mhs), validasi ruang gedung vs link Zoom terintegrasi, dan presensi QR geofence vs presensi aktivitas LMS (`BR-A12`). |
| **Dynamic Auto-Class & Waitlist Threshold** | Saat kelas penuh, sistem tidak menolak secara pasif, melainkan menahan di antrean daftar tunggu (kunci SKS) dan otomatis men-generate kelas baru saat batas minimum efisiensi (15 mhs) tercapai (`BR-A10`). |
| **SICA Virtual Campus (EdLink-Style Architecture)** | Sinkronisasi instan (*zero-setup*) dari hasil KRS ke kelas virtual LMS (pertemuan 1–16, modul video, forum diskusi, kuis CBT) dengan rekapitulasi nilai dan presensi otomatis ke SIAKAD (`AC-LMS-1`, `AC-LMS-2`). |

---

### 5.5 Katalog Aturan Bisnis (*Business Rules Catalog*)

Katalog aturan bisnis ini merupakan sumber kebenaran formal untuk seluruh acceptance criteria dan pembatasan data di sistem SICA.

#### A. Aturan Regulasi Nasional Mengikat (`BR-R*`)
Aturan ini bersumber dari **Permendiktisaintek No. 39/2025** (SN-Dikti jo. Permendiktisaintek 10/2026), **Permenristekdikti 59/2018**, dan **UU PDP No. 27/2022**. Aturan ini bersifat **mengikat secara hukum nasional** dan tidak boleh diubah menjadi opsi fleksibel per tenant.

| ID | Norma Hukum & Regulasi | Implikasi Sistem SICA |
|---|---|---|
| **BR-R1** | 1 SKS = **45 jam kerja/semester** (39/2025 Ps 15(6)) | Validasi beban perencanaan dan struktur jam perkuliahan di kurikulum. |
| **BR-R2** | Plafon SKS: **sem 1–2 ≤ 20**, **sem ≥3 ≤ 24**, **semester antara ≤ 9** (Ps 17–18) | Batas atas mutlak di database; band IPS hanya bergerak **di bawah** plafon ini. |
| **BR-R3** | Beban minimum kelulusan: D1 36 · D2 72 · D3 108 · S1/D4 **144** · S2 ≥ 36 SKS | `study_programs.min_total_sks` tervalidasi otomatis saat verifikasi yudisium. |
| **BR-R4** | Masa studi maksimal **2× masa tempuh normal** (S1 maksimal 16 semester) | `study_programs.max_study_semesters`; evaluasi otomatis peringatan masa studi. |
| **BR-R5** | Skala nilai nasional **A=4, B=3, C=2, D=1, E=0**; ambang lulus mata kuliah ditetapkan PT | Nilai lulus per mata kuliah dikonfigurasi per kurikulum; tidak di-hardcode di kode. |
| **BR-R6** | IPK kelulusan: **≥ 2,00** (Sarjana/Diploma) dan **≥ 3,00** (Profesi/Magister/Doktor) | Ambang verifikasi yudisium per jenjang; predikat kelulusan ditetapkan institusi. |
| **BR-R7** | Program studi wajib **terakreditasi aktif** untuk meluluskan mahasiswa | Gerbang yudisium memblokir penetapan kelulusan jika status akreditasi prodi kedaluwarsa. |
| **BR-R8** | Ijazah wajib memuat Nomor Ijazah Nasional (PIN), Transkrip, dan SKPI dwibahasa | Bidang data PIN/PISN dan pencatatan capaian pembelajaran lulusan (CPL) terakomodasi. |
| **BR-R9** | Jendela pelaporan PDDIKTI berkala (rencana studi ≤2 bln, hasil studi ≤2 bln) | Peringatan otomatis batas pelaporan Neo Feeder pada kalender akademik. |
| **BR-R10** | Data historis PDDIKTI tidak dapat dihapus; koreksi via pengajuan resmi | Larangan hard-delete; workflow pembukaan periode dan log sinkronisasi terkelola. |
| **BR-R11** | Operator Neo Feeder diangkat dengan SK resmi Pimpinan Perguruan Tinggi | Hak akses role `FEEDER_OPERATOR` dengan kredensial tersimpan aman di KMS/Vault. |
| **BR-R12** | Arsip ijazah, transkrip nilai, dan SKPI wajib disimpan **permanen** | Retensi data kelulusan berstatus permanen (WORM); tidak mengikuti siklus purge log. |
| **BR-R13** | Masa transisi penyesuaian SN-Dikti 39/2025 paling lambat September 2027 | Parameter aturan akademik fleksibel mengakomodasi aturan transisi kampus. |
| **BR-R14** | Kepatuhan PP 33/2026: Kewajiban DPO, DPIA, dan mitigasi denda s.d. 2% aset | Tata kelola kepatuhan privasi data terintegrasi dalam modul sistem. |
| **BR-R15** | Dokumen berkekuatan hukum wajib memakai TTE tersertifikasi (PSrE BSSN) | Integrasi tanda tangan digital tersertifikasi untuk SK Yudisium dan Ijazah Digital. |

#### B. Parameter Kebijakan Institusi (`BR-A/G/K/S/M*`)
Aturan ini dapat disesuaikan per institusi kampus dan tersimpan di `academic_rules.params`.

| ID | Parameter Kebijakan | Rekomendasi Nilai Standar | Keterangan |
|---|---|---|---|
| **BR-A1** | Jendela Open Wiring (KRS) per prodi/periode | Berdasarkan Kalender Akademik | Pembatasan rentang waktu pengisian KRS online. |
| **BR-A2** | Band SKS berbasis IPS (di bawah plafon BR-R2) | Sem 1–2: 20 SKS; Sem ≥3: IPS ≥3.50 → 24, 3.00–3.49 → 21, 2.50–2.99 → 18, 2.00–2.49 → 15, <2.00 → 12 | Keputusan senat akademik institusi. |
| **BR-A3** | Prasyarat mata kuliah dan ambang nilai kelulusan | Minimal huruf C/D (sesuai kurikulum) | Penolakan otomatis pada KRS jika prasyarat belum lulus. |
| **BR-A4** | Validasi bentrok jadwal dan kapasitas kelas | Blokir otomatis (*Hard Block*) | Mencegah tumpang tindih waktu kuliah dan kelebihan kuota. |
| **BR-A5** | Keterkaitan status pembayaran dengan akses KRS | Aktif (dengan jalur dispensasi beasiswa) | Menahan pembukaan KRS bagi mahasiswa berstatus menunggak. |
| **BR-A6** | Kebijakan denda keterlambatan pembayaran | Non-aktif / Flat per bulan | Menghitung denda secara otomatis sesuai ketentuan kampus. |
| **BR-A7** | Jenis cekal yang menahan proses transaksional | Keuangan menahan KRS; Perpustakaan menahan Yudisium | Hak akses dinonaktifkan hingga cekal dicabut oleh unit terkait. |
| **BR-A8** | Kuesioner evaluasi dosen sebelum pembukaan KHS | Aktif | Mendorong pengisian kuesioner sebelum mahasiswa melihat nilai. |
| **BR-A9** | Penguncian periode yang telah ditutup (*CLOSED*) | Seluruh operasi tulis diblokir | Menjamin integritas data historis semester lalu. |
| **BR-A10** | Kebijakan Pembentukan Kelas Otomatis (*Auto-Class Generation & Waitlist*) | Ambang batas min 15 mhs (Onsite) / 30 mhs (Online); Maks 4 kelas paralel | Menahan peminat kelas penuh di antrean waitlist (kunci SKS) dan otomatis men-generate kelas baru saat threshold tercapai. |
| **BR-A11** | Penegakan Beban Mengajar Dosen (*Workload Guardrail & Teaching Assistant*) | Maksimal 16 SKS (BKD Dikti) | Memblokir penugasan dosen overload; mengalihkan ke dosen pengganti (Onsite) atau Tutor Asisten Dosen (Online PJJ). |
| **BR-A12** | Model Penyelenggaraan Kampus (*Dual Delivery Mode: Onsite vs Online*) | Per-Tenant / Per-Prodi (`ONSITE`, `ONLINE`, `HYBRID`) | Menentukan apakah kelas membutuhkan alokasi ruang gedung fisik atau auto-provisioning Virtual Room (Zoom/Meet/LMS). |
| **BR-A13** | Presensi Daring Terintegrasi LMS (*Activity-Based Attendance*) | Min 80% watch-time video / durasi join Zoom live | Mengotomatisasi rekap presensi mahasiswa online langsung ke KHS tanpa input manual dosen. |
| **BR-A14** | Syarat Lunas UKT/SPP Gerbang KRS (*Payment-Gated KRS - Sevima Benchmark*) | Tagihan Semester = `PAID` atau Disetujui Dispensasi | Mahasiswa terblokir dari pengisian KRS online jika tagihan UKT belum lunas dan tidak memiliki status dispensasi beasiswa/keringanan aktif. |
| **BR-A15** | Ambang Kehadiran Minimal Ujian (*Exam Eligibility 75% - Sevima Benchmark*) | Minimal 75% dari total pertemuan perkuliahan tatap muka | Kehadiran < 75% secara otomatis memblokir penerbitan Kartu Ujian (UTS/UAS) dan mengunci entri nilai akhir oleh dosen. |
| **BR-A16** | Klasifikasi Prasyarat Matakuliah (*Prerequisites & Co-requisites*) | *Taken*, *Passed (Min Grade)*, dan *Co-requisite* (Ambil Bersamaan) | Memvalidasi riwayat tempuh, ambang batas kelulusan matakuliah terdahulu, dan kewajiban mengambil matakuliah praktikum bersamaan dengan teori. |
| **BR-A17** | Kepatuhan Skema Feeder PDDIKTI | Kompatibel 100% Neo Feeder API | Setiap data master (mahasiswa, dosen, kelas, KRS, nilai, kurikulum) memiliki struktur mapping yang siap sinkronisasi dua arah ke PDDIKTI. |
| **BR-G1** | Batas waktu pengisian nilai dosen pasca-UAS | 14 hari kalender | Notifikasi berkala dan eskalasi otomatis ke Kaprodi. |
| **BR-G2** | Penanganan nilai kosong tanpa keterangan | Status `K` (Kosong) | Nilai tidak dihitung dalam IP, namun menahan syarat yudisium. |
| **BR-G3** | Presisi pembulatan IP dan IPK | 2 desimal, pembulatan *half-up* | Pembulatan dilakukan hanya pada hasil akhir perhitungan. |
| **BR-G4** | Koreksi nilai pasca-penguncian | Usulan Dosen → Approval Kaprodi | Wajib menyertakan alasan resmi dan tercatat pada audit trail. |
| **BR-G5** | Komposisi bobot nilai komponen | Wajib berjumlah 100% | Ditegakkan sebelum form input nilai dapat diakses dosen. |
| **BR-K1** | Struktur tarif dan kelompok UKT | Kelompok tarif per angkatan dan jalur masuk | Mendukung skema Uang Kuliah Tunggal maupun tarif per-SKS. |
| **BR-K2** | Otorisasi pembatalan (*void*) tagihan | Dual-approval (Pemohon ≠ Penyetuju) | Mengharuskan alasan tertulis dan pencatatan entri pembalik. |
| **BR-K3** | Matriks gerbang penagihan | Dikonfigurasi per komponen tarif | Menentukan aksi akademik yang dibatasi saat tagihan belum lunas. |
| **BR-S1** | Ambang batas peringatan akademik dan DO | IPS < 2,00 berturut-turut selama 2 semester | Menerbitkan surat peringatan resmi sebelum penetapan sanksi DO. |
| **BR-S2** | Persyaratan cuti akademik | Telah menempuh min 40 SKS, maksimal 4 semester | Memverifikasi bebas tagihan SPP cuti. |
| **BR-S3** | Syarat pendaftaran tugas akhir / skripsi | Telah lulus ≥ 100 SKS dengan IPK ≥ 2,50 | Diverifikasi otomatis oleh sistem saat pengajuan judul. |
| **BR-S4** | Clearance bebas tanggungan sebelum yudisium | Bebas keuangan, bebas perpustakaan, bebas lab | Seluruh unit pengelola wajib menandai status *passed*. |
| **BR-S5** | Syarat kelulusan akademik | SKS terpenuhi, IPK ≥ ambang, tanpa nilai E/K | Validasi otomatis sebelum penerbitan SK Yudisium. |
| **BR-M1** | Plafon konversi SKS kegiatan MBKM | Maksimal 20 SKS per semester | Pengakuan kredit akademik program magang/studi independen. |
| **BR-M2** | Pembimbingan aktivitas luar kampus (IKU 2) | Dosen pembimbing + verifikasi konversi | Rekam jejak kegiatan diakui untuk pelaporan kinerja perguruan tinggi. |

---

### 5.6 Penyelarasan Kebijakan Akademik & Regulasi Nasional

Perancangan modul akademik dan keuangan SICA diselaraskan secara ketat dengan perkembangan regulasi nasional:

1. **Penetapan Plafon Beban SKS**: Pengaturan beban SKS tidak lagi diasumsikan flat 24 SKS untuk semua mahasiswa. Sistem menegakkan batas atas nasional: semester 1–2 maksimal 20 SKS, semester 3 ke atas maksimal 24 SKS, dan semester antara maksimal 9 SKS ([BR-R2](file:///c:/SICA/docs/PRD.md#L203)).
2. **Fleksibilitas Masa Studi Maksimal**: Batas masa studi dikonfigurasi per program studi dengan batas atas 2× masa tempuh kurikulum normal (misalnya 16 semester untuk program S1 reguler, sesuai [BR-R4](file:///c:/SICA/docs/PRD.md#L205)).
3. **Konversi Program MBKM Berbasis Kebijakan Perguruan Tinggi**: Sesuai SN-Dikti No. 39/2025 Pasal 18(6), plafon dan bobot pengakuan SKS program luar kampus ditetapkan oleh kebijakan masing-masing perguruan tinggi dengan batas wajar 20 SKS ([BR-M1](file:///c:/SICA/docs/PRD.md#L249)).
4. **Predikat Kelulusan Mandiri**: Rentang Indeks Prestasi untuk penetapan predikat kelulusan (*Cumlaude*, Sangat Memuaskan, Memuaskan) dikonfigurasikan pada tingkat institusi kampus (`graduation.honors_bands`), memenuhi ketentuan [BR-R6](file:///c:/SICA/docs/PRD.md#L207).
5. **Permanensi Arsip Kelulusan**: Berdasarkan UU Kearsipan dan Permenristekdikti 59/2018 ([BR-R12](file:///c:/SICA/docs/PRD.md#L213)), arsip digital ijazah, transkrip nilai, dan SKPI berstatus **arsip permanen** dan dilindungi dari kebijakan purging otomatis.
6. **Penataan Format Nomor Induk Mahasiswa (NIM)**: Sistem mendukung format penomoran NIM lokal institusi secara fleksibel tanpa membatasi struktur data saat migrasi dari sistem lama.
7. **Dasar Hukum Pemrosesan Data Pribadi**: Pemrosesan data akademik bersandar pada pemenuhan kewajiban perundang-undangan dan perjanjian studi ([UU PDP Pasal 20(2)](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md#L271)), sehingga hak penghapusan data ditangani via pembatasan pemrosesan dan anonimisasi tampilan, bukan penghapusan fisik arsip akademik.

---

### 5.7 Model Packaging: Master (Core) vs Add-on (Modular Entitlement)
SICA dijual sebagai **SaaS modular**. Campus dapat memilih sebagian modul tanpa fork kode (ADR-13, DATA_MODEL §12):

- **Core/Master (selalu aktif, default):** `identity`, `academic`, `teaching`, `enrollment` (KRS+DPA), `attendance`, `assessment` (nilai/KHS), `finance` (tagih/gerbang KRS), `feeder_pddikti`, `audit`.
- **Add-on (opt-in per tenant):** `pmb`, `cbt`, `lms`, `mbkm`, `thesis`, `spmi`, `hr_bkd`, `parent_portal`, `graduation`, `tracer_iku`.
- **Kecuali yang dinegosiasikan:** `finance` & `feeder_pddikti` default ON namun dapat DINONAKTIFKAN (kampus ber-sistem keuangan eksternal → gerbang KRS pakai feed status lunas; PT non-pelapor → feeder OFF).

**Skenario penerimaan yang harus didukung produk:**
| Permintaan kampus | Konfigurasi | Mekanisme |
|---|---|---|
| "Sudah punya PMB, cukup SIAKAD" | Core ON, `pmb` OFF | Jalur **impor mahasiswa** (PRD J1) → NIM & akun di-*provision*; menu PMB tak muncul. |
| "Sudah SIAKAD+PMB, butuh LMS saja" | Core + `pmb` ON, **aktifkan `lms`** | `tenant_modules(lms, ACTIVE)`; prasyarat `teaching`+`enrollment` sudah ON → valid; LMS dapat roster otomatis. |
| "Butuh modul tertentu saja" | Core (prasyarat) + addon tsb | Addon **tidak bisa berdiri tanpa Core** (dependency enforcement). |

**KPI keberhasilan packaging:** provisioning/pencabutan modul ≤ 1 menit (data-driven, tanpa deploy), nol akses endpoint/menu modul yang tidak dibeli, dan metering `PER_SEAT` (mis. LMS) tercatat di `tenant_usage`.

## 6. Acceptance Criteria (terukur)

Format: Given/When/Then. Semua AC diverifikasi automated test; bertanda 🔒 wajib lolos di CI sebelum deploy.

### 6.1 Fungsional

**AC-KRS-1 🔒 (band SKS)**
Given mahasiswa dengan IP semester lalu 2,35 pada prodi dengan band `2.00–2.49 → maks 15 SKS`
When ia mengajukan KRS 18 SKS
Then sistem menolak dengan pesan mencantumkan aturan `BR-A2` dan ambang yang berlaku, dan **tidak ada baris enrollment yang terbentuk**.

**AC-KRS-2 (prasyarat)**
Given mata kuliah `IF321` berprasyarat `IF211` dengan ambang lulus `D`
When mahasiswa dengan nilai `IF211 = E` atau status `K` mengajukan `IF321`
Then penolakan dengan alasan spesifik per mata kuliah.

**AC-KRS-3 🔒 (kuota kelas, race condition & dynamic auto-class waitlist)**
Given kelas dengan kuota 40 dan 39 terisi, 150 mahasiswa menekan "ambil" bersamaan:
- **Mode Konvensional (Fixed Quota):** Tepat **1** enrollment terbentuk (roster = 40), tidak ada baris 41, dan 149 request menerima error `CLASS_FULL`.
- **Mode Auto-Class (Waitlist Threshold aktif, ambang = 15):** Tepat **1** enrollment mengisi kursi ke-40 di Kelas A; 14 mahasiswa berikutnya dialokasikan ke `class_waitlists` (kuota SKS terkunci sementara); ketika mahasiswa ke-15 antrean (request ke-15) menekan ambil, transaksi atomik secara otomatis memicu pembentukan `Kelas B` (kapasitas 40), mempromosikan 15 mahasiswa waitlist menjadi `ENROLLED` di Kelas B, dan membuka 25 sisa kuota Kelas B untuk publik.

**AC-LMS-1 🔒 (zero-setup virtual class synchronization - EdLink style)**
Given mahasiswa berhasil menyelesaikan KRS dan disetujui Dosen PA
When status KRS berubah menjadi `APPROVED`
Then sistem background worker otomatis memetakan mahasiswa dan dosen ke ruang kelas virtual (`lms_sessions` 1 s.d. 16), menyinkronkan daftar roster peserta tanpa perlu kode kelas manual, dan mengirimkan notifikasi jadwal perdana ke aplikasi mobile.

**AC-LMS-2 (integrasi presensi & penilaian lms ke buku nilai khs)**
Given mahasiswa mengikuti perkuliahan daring (live webinar Zoom atau modul asinkron LMS)
When mahasiswa mencapai ambang presensi (≥80% durasi webinar atau video modul) dan mengumpulkan tugas/kuis CBT
Then presensi otomatis tercatat pada `attendances` dan nilai hasil asesmen otomatis mengisi komponen nilai (`grade_components`) di KHS SIAKAD tanpa entri ulang oleh dosen pengampu.

**AC-KRS-4 (gerbang keuangan)**
Given tagihan periode aktif berstatus `OVERDUE` dan konfigurasi tenant `enrollment_requires_payment = true`
When mahasiswa membuka pengisian KRS
Then form terkunci dengan ringkasan tunggakan + jalur "ajukan keringanan"; bila `false`, KRS terbuka dan tunggakan tetap tercatat.

**AC-NIL-1 (koreksi nilai)**
Given nilai sudah `LOCKED` dan KHS sudah terbit
When dosen mengajukan koreksi
Then nilai tidak berubah sampai Kaprodi scope sama menyetujui; setelah setuju, sistem menulis baris koreksi baru + `audit_logs` berisi actor, alasan wajib, `old_value`, `new_value`, `request_id`; IP & KHS dihitung ulang; mahasiswa menerima notifikasi.

**AC-NIL-2 (determinisme pembulatan)**
Given set nilai yang sama
When IP dihitung oleh layanan mana pun (web, job batch, export)
Then hasilnya identik: 2 desimal, pembulatan *half-up*, dilakukan **hanya pada hasil akhir**, dan uji properti (property-based test) terhadap 10.000 sampel acak tidak menemukan deviasi.

**AC-NIL-3 (konversi skala per kurikulum)**
Given kurikulum A memakai skala 4-level (A/B/C/D/E) dan kurikulum B memakai 5-level (dengan `A-`, `B+`, dst.)
When dosen memasukkan angka 78 di masing-masing
Then huruf & bobot mengikuti `grade_scale` milik kurikulum tersebut — **tanpa satu pun konstanta skala nilai di kode aplikasi**.

**AC-KEU-1 🔒 (idempotensi pembayaran)**
Given gateway mengirim callback yang sama 3 kali (retry)
When ketiga callback diproses bersamaan
Then hanya 1 `payment` tercatat, status invoice tetap benar, ledger hanya satu entri, dan percobaan ulangan mengembalikan respons sukses yang sama (no-op).

**AC-KEU-2 (rekonsiliasi)**
Given 5.000 invoice ter-generate untuk satu periode
When engine dijalankan ulang karena gangguan
Then jumlah & total rupiah invoice identik dengan run pertama (tidak dobel), dan run kedua mencatat `generation_run_id` baru sebagai audit event.

**AC-KEU-3 (void tagihan)**
Given invoice terbit salah
When admin keuangan mem-*void* dengan alasan
Then invoice tidak pernah dihapus; status menjadi `VOID` dan muncul entri reversing di ledger; laporan piutang & pendapatan tetap dapat direkonsiliasi ke angka sebelumnya.

**AC-NIL-4 🔒 (komposisi nilai harus 100%)**
Given mata kuliah dengan bobot `Tugas 30% + UTS 30% + UAS 30%` (= 90%)
When admin mencoba mengaktifkan input nilai untuk kelas itu
Then sistem menolak dengan selisih eksplisit (`kurang 10%`), dan **tidak ada** field input nilai yang terbuka untuk kelas tersebut. Setelah komposisi = 100%, input nilai tersedia. Perubahan komposisi setelah sebagian nilai terisi wajib lewat approval + audit + opsi "hitung ulang nilai kelas".

**AC-KRS-5 (imutabilitas setelah pengajuan)**
Given mahasiswa sudah menekan "Ajukan KRS"
When ia mencoba menambah/mengurangi mata kuliah
Then sistem menolak dengan pesan bahwa KRS sudah terkunci, dan satu-satunya jalur perubahan adalah *Sunting KRS* oleh Dosen PA/Kaprodi dengan alasan → tercatat di `audit_logs` (`before`/`after` daftar kelas) → mahasiswa dinotifikasi.

**AC-CEK-1 (cekal ditegakkan, bukan hanya ditampilkan)**
Given mahasiswa punya cekal `PERPUSTAKAAN` aktif untuk periode berjalan
When ia mengisi KRS (konfigurasi tenant `cekal_blocks_enrollment = true`)
Then form KRS tertutup dengan daftar penyebab + kontak penuntasan; bila `false`, KRS tetap terbuka tapi cekal menahan penerbitan KHS/yudisium.

**AC-KEU-4 (semantik status tidak ambigu)**
Given invoice Rp5.000.000 dibayar Rp3.000.000 dengan potongan beasiswa Rp1.000.000
When status dihitung
Then hasil = `PARTIAL` (bukan `PAID`), sisa yang ditagih = Rp1.000.000, dan laporan yang sama dibaca identik oleh kasir, mahasiswa, dan pimpinan (satu fungsi kalkulasi, bukan tiga interpretasi).

**AC-FDR-1 (validasi pra-kirim)**
Given 300 baris riwayat studi, 12 di antaranya punya NIM belum terdaftar di PDDIKTI
When operator menjalankan pra-validasi
Then 288 lolos, 12 ditandai dengan error code + saran perbaikan + tautan ke baris sumber, dan proses kirim menolak hingga operator memilih *kirim yang valid saja* atau membatalkan.

**AC-AUD-1 🔒 (kekebalan audit)**
Given user aplikasi DB (`sica_app`)
When ia mencoba `UPDATE`/`DELETE` pada `audit_logs`
Then terjadi `permission denied`, dan trigger proteksi menolak perubahan dari peran mana pun selain `sica_owner`.

**AC-MIG-1 (migrasi data)**
Given ekspor portal lama 5.000 mahasiswa + riwayat nilai
When import SICA dijalankan
Then laporan rekonsiliasi menampilkan total baris sumber, terimpor, ditolak dengan alasan, dan selisih IP/IPK per mahasiswa ≤ 0,00 (perbandingan numerik penuh), sebelum status tenant boleh `LIVE`.

**AC-YUD-1 🔒 (validasi kelulusan & clearance)**
Given mahasiswa tingkat akhir mengajukan yudisium
When sistem memvalidasi persyaratan: (a) total SKS ≥ min prodi (BR-R3), (b) IPK ≥ ambang kelulusan (BR-R6), (c) tidak ada nilai `E` atau status `K`, (d) clearance bebas cekal keuangan/perpustakaan terpenuhi (BR-S4), dan (e) akreditasi prodi masih berlaku (BR-R7)
Then bila semua syarat terpenuhi, pengajuan disetujui → status mahasiswa berubah menjadi `LULUS` ber-SK Yudisium + predikat kelulusan (BR-R6); bila salah satu syarat gagal, sistem menolak dengan rincian klausul yang tidak terpenuhi dan tidak ada nomor kelulusan yang diterbitkan.

**AC-JDW-1 (pencegahan bentrok jadwal & ruangan)**
Given ruang `LAB-KOMP-1` telah dialokasikan untuk Kelas `IF101-A` pada hari Senin pukul 08:00–10:30, atau Dosen X telah dijadwalkan mengajar pada slot tersebut
When staf prodi mencoba menjadwalkan Kelas `IF202-B` di ruang yang sama atau dengan Dosen X pada rentang waktu yang beririsan (mis. Senin 09:00–11:30)
Then sistem menolak penyimpanan jadwal dengan pesan bentrok spesifik (*conflict detected*: nama ruang / nama dosen dan rentang waktu irisannya).

**AC-DOC-1 (keabsahan cetak dokumen ber-QR)**
Given mahasiswa atau admin mengunduh dokumen akademik resmi (KRS/KHS/Transkrip/Kartu Ujian)
When PDF dibangkitkan oleh server
Then dokumen memuat QR code verifikasi yang mengarah ke endpoint publik SICA, menampilkan ringkasan data otentik (NIM, Nama, IPK/Mata Kuliah, tanggal cetak, dan signature SHA-256) untuk mencegah pemalsuan dokumen cetak.

### 6.2 Non-fungsional (ini bagian yang biasa hilang — dan bagian yang paling diingat rektorat)

| ID | Kriteria | Metode verifikasi |
|---|---|---|
| NFR-P1 🔒 | Simulasi OW: 3.000 mahasiswa login & submit KRS dalam 20 menit (≈100 TPS burst), error rate < 0,1%, p95 < 800 ms, **tanpa enrollment ganda/lebih kuota** | k6 + DB assertion |
| NFR-P2 | Halaman daftar & dashboard: p95 < 800 ms server-side; LCP < 2,5 s di jaringan 4G | Lighthouse CI + RUM |
| NFR-A1 | Availability 99,5% per bulan pada periode aktif; maintenance window hanya di jeda semester | uptime monitor + SLA report per tenant |
| NFR-A2 | RPO ≤ 15 menit, RTO ≤ 4 jam; **uji restore** ke cluster terpisah | drill restore per kuartal, bukti di `/evidence` |
| NFR-S1 🔒 | Uji penetrasi internal: 0 temuan High/Critical pada akses lintas tenant | test suite matriks 2-tenant (§SECURITY) |
| NFR-S2 | Semua data in transit TLS 1.2+; at-rest terenkripsi; secret di vault, tidak di env plaintext | scan config + IaC review |
| NFR-C1 | 10 GB riwayat akademik per tenant dapat diekspor penuh (CSV + PDF) dalam < 10 menit | integration test |
| NFR-C2 | Permintaan hak subjek (UU PDP Ps 6–12) ditangani lewat `data_subject_requests`; **penghapusan tidak memusnahkan rekaman akademik wajib** — hasilnya anonymize-for-display + alasan tertulis (Ps 42–44). SICA berperan **processor**, kampus **controller** (DPA per tenant) | register + workflow + uji "hapus ditolak, anonimisasi berhasil" |
| NFR-U1 | Seluruh write path selesai dalam 1 transaksi; tidak ada state setengah-jadi bila job mati | chaos test: kill job di tengah batch |
| NFR-D1 | Retensi **dijalankan dari `retention_rules` (JRA kampus)**, bukan angka di kode: rekaman kelulusan `PERMANENT` & `is_locked` (BR-R12); audit log ≥5 th; session ≥13 bln; catatan cuti/DO/pindah mengikuti JRA (floor ANRI 5 th) | retention policy test + uji "aturan retensi tidak bisa menurunkan kelas permanen" |
| NFR-R1 🔒 | Pengajuan yudisium/ijazah **ditolak otomatis** bila status akreditasi prodi tidak valid/kedaluwarsa (BR-R7), dengan pesan yang menyebutkan field mana yang harus dilengkapi | integration test per kondisi akreditasi |
| NFR-R2 | Plafon SKS nasional (20/24/9 per BR-R2) tidak dapat dilonggarkan konfigurasi tenant; hanya band di bawah plafon yang bisa diubah | uji properti: setiap `academic_rules.params` valid ⇒ tidak pernah melewati plafon |
| NFR-R3 | Tidak ada `UPDATE/DELETE` untuk peran `sica_app` pada `grades` final, `ledger`, `graduation_records`, `audit_logs` (BR-R10/R12) | uji GRANT di CI terhadap DB nyata |
| NFR-R4 | Tenggat pelaporan PDDikti per periode dipantau & diingatkan sebelum lewat (BR-R9); antrian error per record dapat diselesaikan tanpa hard-delete | uji jadwal + status pipeline |
| NFR-R5 | Dokumen berdampak hukum memakai TTE tersertifikasi (BR-R15); dokumen internal boleh TTE non-sertifikat tapi dibedakan di `document_signatures` | uji tanda tangan + verifikasi digest |

### 6.3 Definisi Selesai (*Definition of Done* / DoD)

Setiap kebutuhan fungsional (FR) dinyatakan selesai dan siap dirilis ke lingkungan produksi apabila memenuhi kriteria berikut:
- [x] Seluruh *Acceptance Criteria* terkait lolos verifikasi automated test.
- [x] Unit test dan integration test (via Testcontainers dengan instance PostgreSQL riil) berstatus hijau (100% lolos).
- [x] Matriks hak akses (*permission matrix*) telah diperbarui dan divalidasi.
- [x] Peristiwa audit (*audit event*) berhasil dipancarkan dan terekam pada `audit_logs`.
- [x] Skema kontrak dan dokumentasi OpenAPI 3.1 ter-generate secara otomatis.
- [x] Migrasi skema database teruji reversible (*rollback dry-run*) di lingkungan staging.
- [x] Seluruh string antarmuka mendukung lokalisasi (Bahasa Indonesia & Bahasa Inggris).
- [x] Dokumentasi operasional pengguna (*help article* & panduan admin) telah tersedia.
- [x] Fitur dilindungi oleh *feature flag* dinamis sebelum aktivasi resmi per tenant.

---

## 7. Metrik Keberhasilan Produk (*Product Metrics & KPI*)

| Kategori KPI | Indikator Metrik | Target Keberhasilan |
|---|---|---|
| **North Star** | **Penyelesaian Siklus Akademik End-to-End** (Tagihan → KRS → Perkuliahan → Nilai → KHS → Yudisium → Sinkronisasi Neo Feeder) tanpa intervensi manual | 100% tenant aktif menyelesaikan siklus dalam 1 periode penuh. |
| **Aktivasi Tenant** | Waktu rata-rata onboarding tenant hingga status *Go-Live* operasional | ≤ 14 hari kerja tanpa eskalasi teknis ke core engineering. |
| **Keandalan Puncak** | Tingkat insiden downtime pada periode puncak Open Wiring (OW) | **Zero Downtime** (0 insiden kegagalan sistem > 15 menit). |
| **Integritas Nilai** | Insiden modifikasi nilai tanpa approval Kaprodi dan audit trail | **0 Kasus** (*Zero Tolerance*). |
| **Otomasi Keuangan** | Tingkat rekonsiliasi otomatis pembayaran VA/QRIS ke ledger piutang | ≥ 99,0% transaksi ter-rekonsiliasi otomatis real-time. |
| **Kepatuhan Regulasi** | Tingkat penerimaan data pelaporan semesteran di pangkalan data PDDIKTI | ≥ 99,5% data diterima tanpa penolakan validasi nasional. |
| **Efisiensi Institusi** | Penurunan waktu operasional staf BAAK dan Keuangan untuk rekapitulasi data | Efisiensi waktu meningkat ≥ 60% dibandingkan portal legacy. |
| **Kesehatan Bisnis B2B** | *Net Retention Rate* (NRR) dan rasio tiket bantuan per 1.000 mahasiswa aktif | NRR ≥ 110% per tahun; rasio tiket < 2 tiket per 1.000 mahasiswa/bulan. |

---

## 8. Tahapan Implementasi & Rencana Rilis (*Implementation Roadmap*)

Pengembangan sistem menerapkan prinsip **Vertical Slice Architecture** — setiap iterasi sprint menyelesaikan satu alur bisnis secara utuh (Antarmuka Pengguna → API Endpoint → Domain Logic → Skema Relasional & RLS Policy → Audit Trail → Automated Test Suite) tanpa memisahkan lapisan kerja secara parsial.

### 8.1 Prinsip Tata Kelola Pengembangan
1. **Satu Slice Mengacu Satu Kriteria Keberhasilan**: Setiap iterasi difokuskan menyelesaikan acceptance criteria terukur.
2. **Prioritas Isolasi Multi-Tenant**: Setiap pembuatan tabel domain baru wajib disertai deklarasi policy Row-Level Security (RLS) pada commit yang sama.
3. **Automated Testing sebagai Gerbang Utama**: Kode tidak dapat digabungkan (*merge*) ke branch utama tanpa kelulusan test suite integrasi database riil.
4. **Persetujuan Manual pada Logika Kritis**: Formulasi IPK, ledger akuntansi, pemetaan Neo Feeder, dan matriks izin wajib melalui *human approval gate* oleh Lead Architect.

### 8.2 Rencana Rilis per Sprint (Fase 1)

| Sprint | Fokus Pengembangan (*Slice*) | Artefak & Fungsionalitas yang Dapat Didemokan |
|---|---|---|
| **Sprint 0** | Fondasi Arsitektur, CI/CD, Skema Multi-Tenant, RLS, Autentikasi Argon2id + MFA, Redis Session Revocation. | Verifikasi login 2 tenant terisolasi; pengujian penetrasi cross-tenant ditolak oleh RLS di level kernel database. |
| **Sprint 1** | Modul Administrasi: Profil Institusi, Struktur Fakultas/Prodi, Periode Akademik, Kalender Pendidikan. | Administrator institusi membuka, mengelola kalender, dan menutup periode akademik. |
| **Sprint 2** | Manajemen Kurikulum: Mata Kuliah, Prasyarat, Komposisi Nilai, Skala Nilai Dinamis per Kurikulum. | Kaprodi menyusun kurikulum prodi lengkap dengan prasyarat dan bobot komponen. |
| **Sprint 3** | Manajemen Kelas & Penjadwalan: Ruang Kelas, Plotting Jadwal Kuliah, Penugasan Dosen, Roster Mahasiswa. | Deteksi bentrok jadwal ruang dan dosen; kelas tampil di portal dosen. |
| **Sprint 4 🔒** | Billing Engine: Komponen Tarif, Tagihan Massal Idempotent, Gateway VA/QRIS, Double-entry Ledger. | Mahasiswa membayar UKT via VA simulasi → status lunas real-time → gerbang KRS terbuka. |
| **Sprint 5 🔒** | Open Wiring (KRS): Validasi Plafon SKS, Validasi Prasyarat, Kuota Atomik (Advisory Lock), Batch Approval PA. | Uji beban konkurensi (100 TPS burst) tanpa over-subscribe kuota kelas (AC-KRS-3). |
| **Sprint 6** | Perkuliahan & Penilaian: Presensi Sesi, Input Nilai, Kunci Nilai, Koreksi Nilai Ter-audit, Kalkulasi KHS & Transkrip. | Penerbitan KHS mahasiswa dengan presisi kalkulasi IPK 2 desimal teruji matematis. |
| **Sprint 7** | Status Mahasiswa, Peringatan Akademik & DO Otomatis, Clearance Bebas Cekal, Yudisium & Kelulusan. | Evaluasi otomatis masa studi, penerbitan SK Yudisium, dan penguncian status LULUS. |
| **Sprint 8 🔒** | Integrasi Neo Feeder PDDIKTI: Pemetaan Data, Pra-validasi Kelayakan, Eksekusi Sinkronisasi, Sync Log. | Validasi data pra-kirim dan pelaporan aktivitas perkuliahan ke sandbox Neo Feeder. |
| **Sprint 9** | Generator Dokumen Resmi Ber-QR Code (KRS/KHS/Transkrip), Dashboard Eksekutif Pimpinan, Portal Notifikasi. | Pengunduhan dokumen PDF resmi ber-QR Code verifikasi publik; demonstrasi dashboard rektorat. |
| **Sprint 10** | Hardening Sistem, Penetration Testing, Disaster Recovery Drill, UAT Final, Cutover Data Historis Tenant #1. | Sistem siap operasional penuh (*Production Ready*) untuk go-live tenant perdana. |

---

## 9. Asumsi Dasar & Parameter Keputusan Institusi

### 9.1 Parameter Kapasitas & Regulasi

| ID | Parameter Asumsi | Baseline Nilai Desain | Implikasi Teknis & Tata Kelola |
|---|---|---|---|
| **A1** | Skala Rata-rata Tenant Kampus | 5.000 Mahasiswa, 300 Dosen, 60 Program Studi | Model kapasitas infrastruktur dan perhitungan resource pooling database. |
| **A2** | Sistem Penyelenggaraan Studi | Sistem Kredit Semester (Reguler & Semester Antara) | Desain tabel relasi kelas, enrollment, dan kalender akademik. |
| **A3** | Struktur Pembiayaan Kuliah | Kombinasi UKT Flat per Semester dan Skema Biaya per-SKS | Billing engine mendukung skema tarif flat maupun dinamis berbasis SKS riil. |
| **A4** | Cakupan Jenjang Pendidikan | Diploma (D1–D4) dan Sarjana (S1); ekstensi ke Pascasarjana (S2/S3) | Batasan masa studi maksimal (2× masa tempuh normal) dan ambang IPK lulus. |
| **A5** | Penyedia Identitas Pengguna | SICA sebagai Identity Provider utama; federasi OIDC/SAML institusi di Phase 2 | Manajemen otentikasi mandiri berbasis password Argon2id dan MFA WebAuthn. |
| **A6** | Saluran Pembayaran Elektronik | Integrasi Virtual Account multi-bank dan QRIS nasional | Webhook idempotency dan rekonsiliasi transaksi otomatis. |
| **A7** | Migrasi Data Sistem Lama | Data historis akademik dan status mahasiswa dimigrasikan penuh | Script staging migration dengan verifikasi deviasi nilai IPK ≤ 0,00. |
| **A8** | Plafon Beban SKS Nasional | Sem 1–2: ≤ 20 SKS; Sem ≥ 3: ≤ 24 SKS; Semester Antara: ≤ 9 SKS | Validasi mutlak pada logic enrollment (BR-R2, SN-Dikti 39/2025). |
| **A9** | Gerbang Keuangan Akademik | Terkunci otomatis bagi penunggak, dengan jalur dispensasi resmi | Penegakan hak akses transaksional berbasis status tagihan ledger. |
| **A10** | Kebijakan Denda Tagihan | Dikonfigurasi opsional per institusi (flat per bulan atau persentase) | Perhitungan denda otomatis saat masa tenggang (*grace period*) terlampaui. |
| **A11** | Skala Huruf & Bobot Nilai | Terparameter per kurikulum (4-level atau multi-level dengan minus/plus) | Standarisasi penyimpanan berbasis skor mentah 0–100 dan pemetaan dinamis. |
| **A12** | Jadwal Go-Live Operasional | Awal periode semester akademik baru | Memastikan migrasi dan penataan master data tuntas sebelum perkuliahan aktif. |
| **A13** | Standar Regulasi Nasional | SN-Dikti Permendiktisaintek 39/2025 jo. 10/2026 & Permenristekdikti 61/2016 | Kepatuhan hukum menyeluruh sebelum batas transisi nasional September 2027. |
| **A14** | Retensi Arsip Akademik | Rekaman kelulusan (Ijazah/Transkrip/SKPI) berstatus **Permanen** | Berpedoman pada UU Kearsipan No. 43/2009 dan Jadwal Retensi Arsip (JRA). |
| **A15** | Kepatuhan Privasi Data Pribadi | Kepatuhan UU PDP 27/2022 dan Peraturan Pemerintah No. 33/2026 | Kewajiban registri pemrosesan data (RoPA), pelaksanaan DPIA, dan penunjukan DPO. |
| **A16** | Tanda Tangan Elektronik Sah | TTE Tersertifikasi yang diterbitkan oleh PSrE Terakreditasi BSSN | Menjamin keabsahan legalitas dokumen SK Yudisium dan Ijazah Digital di pengadilan. |
| **A17** | Pelaporan Indikator Kinerja | Kepmendiktisaintek No. 358/M/KEP/2026 (IKU Perguruan Tinggi) | Struktur data kuesioner tracer study dirancang memenuhi formulasi metrik IKU 1. |

### 9.2 Keputusan Strategis & Prasyarat Implementasi Tenant

Sebelum proses cutover data dan onboarding operasional tenant dimulai, keputusan kebijakan berikut disepakati bersama pimpinan institusi kampus:
1. **Pedoman Beban Studi Institusi**: Konfigurasi rentang IPS terhadap hak maksimum SKS semester berikutnya yang disahkan oleh Senat Akademik institusi (harus berada di bawah plafon BR-R2).
2. **Skala Nilai Kurikulum**: Penetapan matriks skala huruf mutu, nilai bobot, dan batas lulus minimum per program studi.
3. **Kewenangan Otorisasi Keuangan**: Penetapan matriks pejabat yang berwenang menyetujui dispensasi pembayaran, cicilan, dan pembatalan (*void*) tagihan.
4. **Jadwal Retensi Arsip (JRA) Institusi**: Pengesahan dokumen JRA kampus yang selaras dengan pedoman ANRI untuk menentukan masa retensi berkas non-permanen (catatan cuti dan mutasi).
5. **Status Validitas Akreditasi Program Studi**: Verifikasi nomor SK dan masa berlaku akreditasi BAN-PT/LAM setiap program studi untuk menjamin kelancaran gerbang yudisium.
6. **Integrasi Provider TTE Tersertifikasi**: Pemilihan vendor PSrE mitra kampus (BSrE BSSN, Peruri, atau Privy) untuk penerbitan sertifikat digital penandatangan dokumen resmi.
7. **SK Operator Neo Feeder**: Pengangkatan resmi operator pangkalan data oleh Pimpinan Perguruan Tinggi sebagai prasyarat pemegang kredensial sinkronisasi PDDIKTI.
8. **Standar Penomoran Dokumen Institusi**: Konvensi format penomoran NIM mahasiswa, nomor surat keputusan, dan nomor sertifikat kelulusan lokal.
