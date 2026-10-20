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

### 5.8 Modul Administrasi & Data Master (hasil benchmark Sevima — 2026-10-19)
> Rujukan detail & bukti: [BENCHMARK_SEVIMA.md](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md) §2, §2A, §3–§7. Bagian ini **menambah** kebutuhan fungsional yang terbukti ada di aplikasi admin Sevima tetapi belum terdaftar sebagai FR di PRD. Prioritas pengerjaan: **Area Admin dimulai dari Data Master** (urutan ADM-1…ADM-9 pada dokumen benchmark §7).

| ID | Modul | Kebutuhan | Kelas | Sumber benchmark |
|---|---|---|---|---|
| FR-ADM-07 | Administrasi | **Kamus/data referensi per tenant** yang dapat dirawat admin: `Unsur Nilai`, `Jenis Matakuliah`, `Kelompok Matakuliah`, `Bidang Ilmu/Rumpun`, `Slot Waktu`, `Status Hadir`, `Jenis Pertemuan`, `Jenis Kegiatan`, `Agama`, `Pekerjaan`, `Penghasilan`, `Suku`, `Jenis Tinggal`, `Kebutuhan Khusus`, `Transportasi`, `Status/Jenis Keluar Mahasiswa`, `Jenjang/Tingkat Pendidikan`, `Negara/Provinsi/Kota/Kecamatan/Kelurahan` | C | Sevima `Data Pelengkap` 6 kategori |
| FR-ADM-08 | Administrasi | **Skema enrollment ("sistem kuliah")** per prodi/angkatan yang mengikat (a) kelas yang boleh diambil saat KRS dan (b) tarif yang berlaku | C | Sevima `Sistem Kuliah` |
| FR-ADM-09 | Administrasi | **Meta-konfigurasi mandiri per tenant**: visibilitas/label/urutan kolom pada form & data master, template laporan, blok penandatanganan — tanpa tiket ke vendor, dengan diff + audit | B | Sevima `Kustomisasi Form/Kolom Data Master/Laporan/Penandatanganan`; titik lemah D-1 |
| FR-ADM-10 | Administrasi | **Panel "Kesehatan Data" pra-go-live**: laporan kelengkapan & anomali (NIM duplikat, dosen tanpa NIDN, prodi tanpa akreditasi, matakuliah tanpa kurikulum, kelas tanpa jadwal, mahasiswa tanpa dosen-wali) sebagai *gate* sebelum tenant `LIVE` | B | Sevima: puluhan artikel "kenapa tidak muncul"; D-4 |
| FR-ADM-11 | Administrasi | **Diagnostics "mengapa terkunci"** pada setiap halaman transaksi (sebab penolakan + tautan perbaikan), bukan pesan error umum | B | D-4, D-6 |
| FR-ADM-12 | Administrasi | **Dampak-penghapusan (impact analysis)** sebelum hapus/nonaktifkan master: tampilkan dependensi (fakultas→prodi→kurikulum→matakuliah→kelas) dan tawarkan *nonaktif-soft*, bukan hapus paksa | B | D-3 |
| FR-ADM-13 | Administrasi | **Impersonation berjustifikasi** (padanan `Login As`): wajib alasan + MFA + TTL pendek + tercatat `audit_logs`; tersedia untuk peran `tenant_admin` scope terbatas & `super_admin` | M | D-9, Journey J6 |
| FR-AKA-16 | Akademik | **Pemaketan KRS ("kuliah paket")** untuk mahasiswa baru: paket SKS otomatis per prodi/angkatan, tetap tunduk plafon BR-R2 | C | Sevima `Paket Kuliah/Pemaketan KRS`; `academic_rules.first_semester_packed_sks` |
| FR-KUR-02 | Kurikulum | **Ekivalensi & konversi matakuliah** (dipakai RPL, pindah prodi, MBKM) dengan ambang nilai + pencatatan sumber konversi | C | Sevima `Ekivalensi Mata Kuliah`, `RPL` |
| FR-AKA-17 | Akademik | **Pindah program studi** dengan pemetaan NIM asal→tujuan dan pemindahan riwayat (bukan hapus-tambah) | B | Sevima `Pindah Program Studi` |
| FR-AKA-18 | Akademik | **Dua tahap publikasi nilai**: *umumkan* (terlihat mahasiswa) vs *kunci* (dasar KHS/transkrip) + **kunci/buka massal** + **hitung ulang** nilai kelas/IPS/IPK/transkrip ter-audit | B | Sevima `Umumkan Nilai` vs `Kunci Nilai`, `Hitung Ulang…` |
| FR-RPT-02 | Reporting | **Monitoring operasional admin**: kepatuhan pengisian nilai per dosen/kelas, pemanfaatan ruang, statistik login & aktivitas admin | B | Sevima `Monitoring Pengisian Nilai`, `Monitoring Ruang`, `Statistik Login` |
| FR-DOC-02 | Dokumen | **Persuratan akademik**: template surat + token variabel (`judul_ta`, `nama_penguji_1`, …), penomoran otomatis per tenant, validasi pengajuan, TTE | B | Sevima `Persuratan`, `Berita Acara TA`, `Generate Penomoran Dokumen` |
| FR-IDT-04 | Identitas | **Matriks hak akses 6 aksi** per (aplikasi, role, scope): `READ`, `INSERT`, `UPDATE`, `DELETE`, `VALIDATE`, `OTHER` — `VALIDATE` dipakai untuk aksi persetujuan (KRS, koreksi nilai, status) | B | Sevima `Hak Akses` (bukti verbatim §2A.6) |

**Rekonsiliasi ruang lingkup (§5.3):** pengecualian "Tata Usaha Persuratan Umum" tetap berlaku untuk naskah dinas non-akademik, **tetapi** surat **akademik** (KHS, surat keterangan aktif kuliah, legalisir, SK yudisium, berita acara ujian, kartu ujian) kini **di dalam lingkup** melalui FR-DOC-02/FR-AKA-14.

**Katalog modul perlu diperluas (keputusan produk, tercatat untuk eksekusi ROADMAP §1.5):** dibanding Sevima, katalog 19 modul SICA belum mencakup `litabmas` (penelitian & pengabdian), `documents`/`persuratan` + `esign`, dan `kerjasama` (SIMKERMA).

**Usulan revisi NFR berbasis benchmark —⚠️ menunggu persetujuan pemilik produk (belum mengubah angka resmi §6.2):** Sevima menjual **SLA 99,9%** dan pemulihan **< 15 menit** (§2A.5), sedangkan SICA saat ini NFR-A1 = 99,5%/bulan dan NFR-A2 = RPO ≤ 15 mnt / RTO ≤ 4 jam. Menyelaraskan ke 99,9% + RTO ≤ 15 menit menaikkan biaya infrastruktur (replika + failover otomatis + PITR aggressif); keputusan diambil bersama, bukan diam-diam.

**Yang secara sadar TIDAK kita tiru dari Sevima** (anti-pattern, lihat §2A.9): password reset default = tanggal lahir, `Login As` tanpa justifikasi, konfigurasi yang terkunci di vendor, dan "unit kerja" yang baru muncul setelah migrasi oleh penyedia.

---

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

---

<!-- SICA-47:BEGIN enterprise-47 -->

## 10. Cakupan Enterprise Smart Campus: 47 Modul + SuperApp (dikunci 2026-10-20)

### 10.1 Posisi terhadap Ruang Lingkup MVP

§5 (MVP/Phase 2) tetap menjadi **urutan rilis awal**; §10 adalah **cakupan produk penuh** yang menjadi acuan desain data, API, RBAC, dan UI sejak sekarang agar tidak ada refaktor besar ketika modul berikutnya dibangun. Setiap modul dijual/diaktifkan per tenant melalui entitlement ([DATA_MODEL.md §15.5](file:///c:/SICA/docs/DATA_MODEL.md)). Prinsip yang mengikat seluruh modul:

- **SSOT & zero re-entry** — satu pemilik per entitas, aliran lintas modul via event ([ARCHITECTURE.md §11](file:///c:/SICA/docs/ARCHITECTURE.md)).
- **Zero-hardcoding** — semua pilihan & aturan = data berversi dengan CRUD + `TOGGLE_ACTIVE` (DATA_MODEL §15.1–15.2).
- **RBAC 11 aksi** — `CREATE, READ, UPDATE, DELETE, APPROVE, REJECT, EXPORT, LOCK, UNLOCK, PARAM_EDIT, TOGGLE_ACTIVE` per role × modul × resource × parameter ([SECURITY_COMPLIANCE.md §10](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md), [RBAC_MATRIX.md §12](file:///c:/SICA/docs/RBAC_MATRIX.md)).
- **Engine lokal tanpa API key berbayar** — registri di ARCHITECTURE §11.4.
- **Multi-moda** — luring (TOTP QR 5 s + geofence ≤ 30 m), daring (SCORM/xAPI, rapat daring, proctoring lokal), hybrid (rekonsiliasi ganda, join ≥ 75%, tag feeder `F`/`O`/`M`) — M-15/M-16/M-17/M-18.

Semua angka regulasi di katalog (mis. 144 SKS, 7 tahun, 60 SKS MBKM, kategori TER PPh 21) adalah **nilai default parameter** dengan `regulatory_floor`, bukan konstanta — regulasi berubah, data mengikuti.


### 10.2 Katalog Modul (sumber kanonik daftar modul)

| Kode | Modul | Grup | Entitlement | Role target (kode RBAC) | Menu | Sub-menu / CRUD | Dasar regulasi |
|---|---|---|---|---|---|---|---|
| M-01 | SaaS Foundation | G1 | `platform_saas` | `PLATFORM_OPERATOR`, `COMPLIANCE_OFFICER` | Tenant Mgmt, SaaS Licensing, SLA, Global Audit | Tenant Provisioning, RLS Isolation, SLA Monitor | UU PDP 27/2022 (peran processor), PP 71/2019 PSTE (penyelenggara sistem elektronik), ISO/IEC 27001:2022 |
| M-02 | Master Parameter | G1 | `identity` | `TENANT_ADMIN`, `IT_ADMIN` | Master Lookups, System Params, Dynamic EAV, Auto-NIM | Generic Lookup CRUD, Rule Parameter Config, Custom Attributes | Permendikbudristek 53/2023 jo. SN-Dikti terbaru (aturan akademik terparameter), kamus Neo Feeder PDDikti |
| M-03 | Hak Akses & RBAC | G1 | `identity` | `TENANT_ADMIN`, `IT_ADMIN` | Role Mgmt, Permission Grid, Parameter Restrictions | Role Creator, Action Matrix Grid, RLS Mapping | UU PDP 27/2022 Ps. 35-39 (keamanan pemrosesan), ISO 27001 A.5.15-5.18 |
| M-04 | IT Helpdesk | G1 | `helpdesk` | `IT_ADMIN`, `ALL_USERS` | Service Desk Portal, Ticket Mgmt, SLA Rules | Submit Ticket, Queue Manager, Escalation Tier 1-3 | ITIL 4 (praktik service desk), ISO/IEC 20000-1 |
| M-05 | Keamanan & Audit | G1 | `audit` | `COMPLIANCE_OFFICER`, `IT_ADMIN` | Hash Chain Audit Log, PII Masking, Security Violations | SHA-256 Log Viewer, PII Field Masking Rules, PDP Manager | UU PDP 27/2022 (Ps. 46 notifikasi kegagalan 3×24 jam), PP 71/2019, UU 43/2009 Kearsipan |
| M-06 | HRIS & Payroll | G2 | `hr_bkd` | `HR_ADMIN`, `ADMIN_FINANCE`, `LECTURER`, `EMPLOYEE` | Data Pegawai, Presensi/Cuti, KPI, Remunerasi | Directory Pegawai, Cuti Approval, PPh 21 Tax Calculator | UU 13/2003 jo. UU 6/2023 Cipta Kerja, PP 58/2023 & PMK 168/2023 (TER PPh 21), UU 14/2005 Guru & Dosen, Permenpan-RB jabatan fungsional dosen |
| M-07 | BKD Dosen | G2 | `hr_bkd` | `LECTURER`, `HEAD_OF_PROGRAM`, `BKD_ASSESSOR`, `HR_BKD_OFFICER` | BKD Portfolio, Overlap Detector, EWMP Rubric | Rencana/Laporan BKD, Interval Tree Log, Asesor Assessment | Kepmendikbudristek 500/M/2022 jo. pedoman operasional BKD terbaru, UU 14/2005 (beban kerja 12–16 SKS), Permenpan-RB 1/2023 |
| M-08 | SISTER Sync | G2 | `hr_bkd` | `LECTURER`, `HR_BKD_OFFICER` | Sync Dashboard, Schema Mapping, Push Queue | SISTER Adapter Config, Push Tridharma Queue, Delta Viewer | Pedoman SISTER Kemdikbudristek (layanan web service SISTER), Permendikbudristek 44/2024 profesi/karier dosen |
| M-09 | PMB & OCR | G3 | `pmb` | `PMB_OPERATOR`, `APPLICANT` | Portal Camaba, Jalur PMB, Verification, CBT Exam | Dynamic Form, Local Tesseract OCR Parser, CBT Question Bank | Permendikbudristek 48/2022 (penerimaan mahasiswa baru S1/D), Permendikbudristek 41/2021 RPL, UU PDP 27/2022 |
| M-10 | Keuangan & Billing | G3 | `finance` | `ADMIN_FINANCE`, `TREASURER`, `STUDENT`, `LEADER` | Tariff Component Master, Billing Generator, Reconciler | UKT/SPI Rules, Invoice Queue, VA Webhook Reconciler | Permendikbudristek 2/2024 (SSBOPT/UKT PTN; acuan PTS via statuta), PSAK 72/73, PMK 168/2023 (pajak), SNAP BI (VA) |
| M-11 | KIP-K & Beasiswa | G3 | `scholarship` | `SCHOLARSHIP_ADMIN`, `STUDENT` | Application Verification, IPK Monitor, Allowance | Economic Scorer, Auto-Freeze Warning Rules, Account Tracker | Permendikbudristek 10/2020 jo. pedoman KIP Kuliah terbaru (Puslapdik), Permendikbudristek 2/2024 |
| M-12 | Kurikulum OBE | G4 | `academic` | `HEAD_OF_PROGRAM`, `DEAN`, `LECTURER` | Kurikulum Master, Profil Lulusan & CPL, CPMK Mapping | RPS Structuring, Rubrik OBE, CPL Attainment Matrix | Permendikbudristek 53/2023 (SN-Dikti, OBE, CPL), Perpres 8/2012 KKNI, instrumen LAM/BAN-PT |
| M-13 | KRS Online & Perwalian | G4 | `enrollment` | `ADVISER`, `STUDENT`, `ADMIN_ACADEMIC` | Sesi Perwalian Akademik, Bimbingan DPA, KRS Portal, KRS War Queue | Advising Log, SKS Limits, Approval Perwalian Dosen Wali, Redis Redlock KRS War Execution | Permendikbudristek 53/2023 (beban belajar, maks SKS), pedoman akademik tenant |
| M-14 | Jadwal & Ruang | G4 | `scheduling` | `SCHEDULER`, `LAB_STAFF` | Timetabling Generator, Facility Master, CSP Solver | CSP Constraint Rules, Schedule Solver Engine, Lab Allocator | SN-Dikti (1 SKS = 50 menit tatap muka + penugasan + mandiri), pedoman akademik tenant |
| M-15 | Moda Perkuliahan | G4 | `teaching` | `ADMIN_ACADEMIC`, `LECTURER` | Learning Mode Control, Shift Allocator, Lecture Session | Mode Selector Luring/Daring/Hybrid, Shift A/B, Feeder Tag | Permendikbudristek 53/2023 (pembelajaran jarak jauh/bauran), kamus Neo Feeder (mode kuliah F/O/M) |
| M-16 | LMS Digital | G4 | `lms` | `LECTURER`, `STUDENT` | Course Classroom, SCORM/Video Material, Discussion | Video Progress Tracker, SCORM 2004 Parser, Async Quiz Engine | SN-Dikti (pembelajaran daring), standar ADL SCORM 2004 4th Ed. & xAPI 1.0.3, UU 28/2014 Hak Cipta |
| M-17 | Ujian & Proctoring | G4 | `cbt` | `INVIGILATOR`, `LECTURER`, `STUDENT` | Online Exam Portal, Proctoring Rules, Incident Feed | Browser Lockdown, Local Face Check, Realtime Flagging Log | UU PDP 27/2022 (data biometrik = data spesifik, Ps. 4; wajib persetujuan eksplisit & DPIA Ps. 34), SN-Dikti penilaian |
| M-18 | Presensi Smart | G4 | `attendance` | `LECTURER`, `STUDENT`, `ADMIN_ACADEMIC` | Presensi Kelas, Dynamic QR Generator, Geofence Master | Dynamic Projector QR 5s, GPS Geofence <30m, Dual-Reconciliation | SN-Dikti (kehadiran minimum mengikuti pedoman akademik tenant), UU PDP (data lokasi) |
| M-19 | Nilai & KHS | G4 | `assessment` | `LECTURER`, `HEAD_OF_PROGRAM`, `STUDENT` | Gradebook Entry, Grading Scale, AST Evaluator, KHS | Formatif/UTS/UAS Weights, AST Math Rules, RPS vs KHS Normalizer | Permendikbudristek 53/2023 (penilaian), pedoman akademik tenant (skala nilai) |
| M-20 | Tugas Akhir & RAMA | G5 | `thesis` | `STUDENT`, `THESIS_SUPERVISOR`, `EXAMINER`, `HEAD_OF_PROGRAM` | Pengajuan TA/Skripsi, Bimbingan TA Digital, Pendaftaran Sidang, Repositori RAMA | Proposal Approval, Logbook Bimbingan Pembimbing, Plotting Penguji, Rubrik Nilai Sidang, OAI-PMH RAMA Exporter | Permendikbudristek 53/2023 (tugas akhir dapat berbentuk proyek/prototipe), Permendikbud 17/2010 pencegahan plagiat, ketentuan Repositori Ilmiah Nasional (RAMA) |
| M-21 | Jurnal & OJS | G5 | `journal` | `JOURNAL_MANAGER`, `LECTURER` | Journal Directory, APC Billing, Article Indexing | OAI-PMH Harvester, APC Invoice Generator, SINTA/ARJUNA Sync | Permendikbudristek terkait akreditasi jurnal ilmiah (ARJUNA), pedoman SINTA |
| M-22 | Inkubator & HAKI | G5 | `ipr_incubator` | `IPR_MANAGER`, `LECTURER`, `STUDENT` | HAKI Portal, DJKI Integration, Startup Milestones | DJKI Patent Filing Tracker, Seed Funding, IKU 5 Aggregator | UU 13/2016 Paten jo. UU 65/2024, UU 28/2014 Hak Cipta, Kepmendikbudristek 210/M/2023 (IKU 5) |
| M-23 | Wisuda & Toga | G5 | `graduation` | `GRADUATION_COMMITTEE`, `STUDENT`, `ADMIN_ACADEMIC` | Convocation Register, Seating Plotter, Stage Call Queue | Stage Call QR Trigger, Seating Grid Solver, Logistik Toga | Pedoman akademik tenant; ijazah mengikuti Permendikbudristek 6/2022 (ijazah, sertifikat, gelar) |
| M-24 | Kemahasiswaan & SKKM | G6 | `student_affairs` | `STUDENT_AFFAIRS_ADMIN`, `STUDENT` | Pengajuan SKKM, SIMKATMAWA Scorer, Prestasi | Certificate Verification, SKKM Weight Rules, Auto-SKPI Builder | Pedoman SIMKATMAWA Kemdikbudristek, Permendikbud 81/2014 (SKPI), Kepmendikbudristek 210/M/2023 (IKU 2 prestasi) |
| M-25 | KKN, PKL & Magang | G6 | `fieldwork` | `STUDENT`, `FIELD_SUPERVISOR`, `PARTNER_MENTOR`, `LPPM_ADMIN` | Alokasi Lokasi KP/PKL/KKN, Penugasan DPL, Bimbingan & Logbook Geofenced, Penilaian Mitra | Geographic & Group Allocator, Daily Logbook Bimbingan DPL, Form Nilai Mitra, Credit Conversion Engine to KHS | Permendikbudristek 53/2023 (bentuk pembelajaran: KKN, magang, praktik kerja), Pedoman MBKM |
| M-26 | Simulasi Lulus | G6 | `academic` | `STUDENT`, `ADVISER` | Graduation Simulator, Prerequisite Graph, CPM Analysis | Remainder SKS Calculator, DAG Viewer, Critical Path Engine | Batas masa studi Permendikbudristek 53/2023 (S1 maks 7 tahun) — sebagai parameter |
| M-27 | Tracer Study | G6 | `tracer_iku` | `ALUMNI_ADMIN`, `ALUMNI` | Survey Tracer, Blast Communication, Alumni Directory | Longitudinal Survey Form, Auto WA Blaster, Alignment Chart | Pedoman Tracer Study Kemdikbudristek (kuesioner inti), Kepmendikbudristek 210/M/2023 (IKU 1), UU PDP |
| M-28 | Career Center | G6 | `career` | `CAREER_ADMIN`, `ALUMNI`, `EMPLOYER`, `STUDENT` | Employer Portal, Job Vacancy Board, Virtual Career Fair | Bipartite Skill Matcher IKU 1 & 2, Partnership Verification | Kepmendikbudristek 210/M/2023 (IKU 1, IKU 2, IKU 6 kemitraan) |
| M-29 | KUI & Mobilitas | G6 | `international` | `INTL_OFFICE_ADMIN`, `STUDENT`, `LEADER` | International Mobility, Visa/ITAS Tracker, BIPA Class | Visa Expiry Alert, ECTS/US Credit Conversion Matrix | UU 6/2011 Keimigrasian jo. Permenkumham terkait ITAS pelajar, Permendikbudristek 53/2023 (kredit transfer), Permendikbud 27/2017 BIPA |
| M-30 | Yudisium & SKPI | G7 | `graduation` | `ADMIN_ACADEMIC`, `DEAN`, `STUDENT`, `UNIT_CLEARANCE_OFFICER` | Clearance Check, DFA Inference Engine, Batch Yudisium | Financial/Library/SKKM Clearance Checker, DFA Rule Engine | Permendikbud 81/2014 (SKPI), Permendikbudristek 6/2022 (ijazah), pedoman akademik tenant |
| M-31 | Akreditasi LKPS | G7 | `accreditation` | `HEAD_OF_PROGRAM`, `DEAN`, `QUALITY_OFFICER`, `LEADER` | LKPS Data Extractor, LED Report Builder, Compliance | 9-Criteria Data Tables, Ratio Checker, 1-Click Export Word/Excel | Peraturan BAN-PT 2/2024 & instrumen IAPS/LAM terkait (9 kriteria), Permendikbudristek 53/2023 |
| M-32 | Dashboard IKU | G7 | `tracer_iku` | `LEADER`, `DEAN`, `QUALITY_OFFICER` | Executive Dashboard, IKU Metric Detail 1-8, Reports | Realtime IKU 1-8 Calculator, Threshold Alert, Board Generator | Kepmendikbudristek 210/M/2023 (IKU PTN) & penyesuaian berikutnya — definisi IKU sebagai data berversi |
| M-33 | Jadwal Darurat | G7 | `scheduling` | `SCHEDULER`, `SARPRAS_ADMIN` | Incident Room Manager, Re-Routing Solver, Distance | Max-Flow Min-Cut Solver, Room Lockout, Emergency Push Alert | Permen PUPR 14/2017 kemudahan bangunan gedung, pedoman K3 kampus |
| M-34 | Feeder PDDikti | G7 | `feeder_pddikti` | `FEEDER_OPERATOR`, `IT_ADMIN` | Staging Buffer Manager, Error Validation, Sync Queue | Pre-Sync Rules Engine, Fuzzy Auto-Corrector, Async Retry Queue | Permendikbudristek 61/2016 jo. ketentuan PDDikti/Neo Feeder terbaru (pelaporan wajib) |
| M-35 | PIN & SIVIL | G7 | `graduation` | `ADMIN_ACADEMIC`, `FEEDER_OPERATOR`, `PUBLIC` | PIN Reservation, SIVIL Adapter, E-Ijazah Generator | PIN Quota Checker, Public SIVIL Dynamic QR Verification | Permendikbudristek 6/2022 (ijazah), ketentuan PIN (Penomoran Ijazah Nasional) & SIVIL Kemdikbudristek |
| M-36 | Portal PPKS | G7 | `ppks` | `PPKS_TASKFORCE`, `PPKS_REPORTER`, `LEADER` | Encrypted Whistleblower, Case Mgmt, Counseling | Anonymous Encrypted Submission, Case Timeline, Ministry Report | Permendikbudristek 55/2024 (Pencegahan dan Penanganan Kekerasan di Lingkungan Perguruan Tinggi, menggantikan Permendikbudristek 30/2021), UU 12/2022 TPKS, UU PDP |
| M-37 | SPMI & Quality | G7 | `spmi` | `QUALITY_OFFICER`, `INTERNAL_AUDITOR`, `HEAD_OF_PROGRAM`, `LEADER` | Mutu Repository, Audit Mutu Internal, Temuan/RTL | PPEPP Rules, Auditor Assignment, AMI Checklist Form | Permendikbudristek 53/2023 (SPMI, siklus PPEPP), Peraturan BAN-PT tentang SPMI |
| M-38 | Kampus Merdeka / MBKM | G7 | `mbkm` | `HEAD_OF_PROGRAM`, `STUDENT`, `MBKM_SUPERVISOR` | Program MBKM Portal, Bimbingan MBKM, Kampus Merdeka Sync | API MSIB/PMM Sync Adapter, Weekly Logbook Importer, DAG Credit Conversion to KHS | Permendikbudristek 53/2023 (hak belajar di luar prodi hingga 3 semester/ setara 60 SKS — sebagai parameter), pedoman MBKM |
| M-39 | e-Library | G8 | `library` | `LIBRARIAN`, `STUDENT`, `LECTURER` | OPAC Catalog Master, Circulation & Fines, Repository | Dublin Core MARC21 Parser, SLiMS/KOHA Adapter, Bebas Pustaka | UU 43/2007 Perpustakaan, SNI 7330:2009 perpustakaan perguruan tinggi, standar MARC21/Dublin Core |
| M-40 | Aset & Inventaris | G8 | `assets` | `ASSET_ADMIN`, `IT_ADMIN` | Asset Directory, Tagging & Barcoding, Depreciation | Asset QR Tagging, Straight-Line Depreciation Engine | PP 27/2014 jo. PP 28/2020 Pengelolaan BMN, PMK 181/2016 Penatausahaan BMN, PMK 65/2023 (masa manfaat & penyusutan), PSAK 16 (PTS) |
| M-41 | Klinik Kampus | G8 | `clinic` | `CLINIC_DOCTOR`, `COUNSELOR`, `STUDENT` | Encrypted Health Records, Virtual Clinic Queue, Bimbingan Konseling | AES-256 Encrypted Record Form, Virtual Queue Engine, Booking Konseling | UU 17/2023 Kesehatan, Permenkes 24/2022 Rekam Medis (elektronik, retensi), UU PDP (data kesehatan = data spesifik) |
| M-42 | Asrama & Kantin | G8 | `dormitory` | `DORM_MANAGER`, `STUDENT` | Dormitory Allocation, Shuttle Transport, E-Wallet | Multi-Dimensional Bin Packing Allocator, E-Wallet Reconciler | PBI 22/23/2020 sistem pembayaran (e-wallet closed-loop di bawah ambang izin) — sebagai batasan parameter |
| M-43 | Humas & Event | G8 | `events` | `PR_EVENT_ADMIN`, `EVENT_PARTICIPANT`, `STUDENT` | Event Management, Gate Check-in QR, Digital Signage | Event Registration Scorer, Gate QR Scanner, Digital Display Scheduler | UU PDP (data peserta), UU 14/2008 KIP (informasi publik kampus) |
| M-44 | SIM-LPPM / LITABMAS | G2 | `litabmas` | `LECTURER`, `GRANT_REVIEWER`, `LPPM_ADMIN`, `ADMIN_FINANCE`, `LEADER` | Skema Hibah, Selection, Contract, Monev & Luaran | Blind Reviewer Scoring, Grant Disbursement Approval, Auto-Feed BKD/SISTER/IKU 5 | Panduan Penelitian & Pengabdian DRTPM terbaru, Kepmendikbudristek 210/M/2023 (IKU 5), PMK SBM (standar biaya), UU 11/2019 Sisnas Iptek |
| M-45 | CRM PMB & Marketing | G3 | `crm_marketing` | `MARKETING_PMB`, `PMB_AGENT`, `SCHOOL_COUNSELOR`, `LEADER` | Leads Management, School Roadshow, Referral/Agent Network, Drip Campaign | Dynamic Funnel Rules, Expo Activity Scheduler, Commission Config, CAC Analytics | UU PDP 27/2022 (dasar persetujuan pemasaran, Ps. 20), UU ITE 19/2016, Permendikbudristek 48/2022 (penerimaan mahasiswa baru) |
| M-46 | E-Procurement PBJ | G3 | `procurement` | `PROCUREMENT_COMMITTEE`, `PPK_OFFICER`, `VENDOR`, `ADMIN_FINANCE` | Pengajuan PBJ, Tender/RFQ, E-Katalog Kampus, Kontrak | Vendor Directory, HPS Evaluator, Multi-Level PPK Approval, Auto-Aset Link | Perpres 16/2018 jo. Perpres 12/2021 & 46/2025 (PBJ), Peraturan LKPP terkait (PTN-BH/BLU memakai peraturan rektor), PMK 181/2016 BMN |
| M-47 | Endowment Fund | G6 | `endowment` | `ENDOWMENT_MANAGER`, `DONOR`, `ADMIN_FINANCE`, `LEADER` | Donor Campaign, Fund Portfolio, Investment Return, Grant Allocator | Donor Directory, Asset Yield Tracker, Auto-Allocation Beasiswa & Riset | PP 26/2015 jo. regulasi dana abadi perguruan tinggi (PTN-BH), PSAK 109/ISAK 35 (entitas nirlaba), UU PDP (data donatur) |
| APP | SuperApp Mobile | G9 | `mobile_superapp` | `STUDENT`, `LECTURER` | Mobile Dashboard, Fast KRS War, Dynamic QR Attendance, LMS, Bimbingan Logbook Mobile | Flutter Cross-Platform Engine, Offline-First SQLite Sync, Push Alert | UU PDP (data lokasi & perangkat), pedoman keamanan aplikasi mobile OWASP MASVS |

### 10.3 Profil Dashboard per Role (seed `dashboard_profiles`)

| Profil | Label | Role yang memakai profil | Kartu modul (urutan seed) |
|---|---|---|---|
| `DOSEN` | Dosen | `LECTURER`, `ADVISER`, `THESIS_SUPERVISOR`, `EXAMINER`, `ALL_USERS` | M-04, M-06, M-07, M-08, M-13, M-16, M-18, M-19, M-20, M-21, M-22, M-39, M-44 |
| `MAHASISWA` | Mahasiswa | `STUDENT`, `ALL_USERS` | M-04, M-10, M-11, M-13, M-16, M-17, M-18, M-19, M-20, M-24, M-25, M-26, M-27, M-28, M-38, M-39, M-41, M-42, M-43, APP |
| `PIMPINAN_AKADEMIK` | Kaprodi/Dekan | `HEAD_OF_PROGRAM`, `DEAN` | M-07, M-12, M-13, M-14, M-19, M-20, M-25, M-30, M-31, M-37, M-38, M-44 |
| `STAF_OPERASIONAL` | Staff BAAK/BAUK/Sarpras | `ADMIN_ACADEMIC`, `ADMIN_FINANCE`, `PMB_OPERATOR`, `SCHOLARSHIP_ADMIN`, `SCHEDULER`, `GRADUATION_COMMITTEE`, `SARPRAS_ADMIN`, `ASSET_ADMIN`, `PROCUREMENT_COMMITTEE`, `FEEDER_OPERATOR` | M-09, M-10, M-11, M-14, M-15, M-23, M-30, M-33, M-35, M-40, M-46 |
| `EKSEKUTIF` | Rektorat/Eksekutif | `LEADER` | M-10, M-29, M-31, M-32, M-36, M-37, M-44, M-45, M-47 |
| `ADMIN_IT` | Super Admin/Admin IT | `PLATFORM_OPERATOR`, `TENANT_ADMIN`, `IT_ADMIN`, `ALL_USERS` | M-01, M-02, M-03, M-04, M-05, M-34, M-35, M-40 |

Aturan render: `kartu = (modul profil ∪ modul lain ber-izin READ) ∩ entitlement tenant aktif ∩ izin READ efektif user`. Modul profil tampil di grid utama sesuai urutan seed; modul ber-izin lain tampil di grup "Modul Lain". Profil, urutan, dan isi kartu adalah data (CRUD di M-03 → *Dashboard Profiles*), bukan konstanta UI.


### 10.4 Rantai Integrasi Wajib (Zero Re-Entry)

| # | Rantai | Event penghubung (ARCHITECTURE §11.5) | Hasil tanpa input ulang |
|---|---|---|---|
| I-1 | M-45 → M-09 → M-10 → M-02 → M-13 | `crm.lead.converted` → `pmb.selection.decided` → `finance.invoice.paid` → `pmb.registration.completed` → `academic.student.activated` | data lead mengisi formulir camaba; tagihan daftar ulang terbit otomatis; lunas → NIM terbit (pola parameter) & status aktif → paket KRS semester 1 + dosen wali ter-assign |
| I-2 | M-25/M-38 → M-19 | `fieldwork.logbook.verified` → `fieldwork.score.submitted` / `mbkm.conversion.approved` | logbook geofenced diverifikasi DPL; nilai mitra + DPL dibobot parameter; dikonversi ke mata kuliah KHS |
| I-3 | M-20 → M-19 → M-39 → M-30 | `thesis.supervision.logged` → `thesis.defense.scored` → `thesis.repository.published` → `yudisium.clearance.changed` | logbook syarat sidang; nilai sidang masuk KHS; unggah RAMA (OAI-PMH) memenuhi syarat clearance |
| I-4 | M-44 → M-07 → M-08 → M-32 | `lppm.output.validated` → `bkd.activity.recorded` → `sister.item.pushed` → counter IKU 5 | luaran tervalidasi otomatis menjadi klaim BKD, di-push delta ke SISTER, menaikkan IKU 5 real-time |
| I-5 | M-46 → M-10 → M-40 | `procurement.request.submitted` → `finance.budget.committed` → `procurement.goods.received` → `asset.registered` | komitmen anggaran saat pengajuan; BAST membuat aset ber-QR & jurnal; penyusutan bulanan otomatis |
| I-6 | M-47 → M-11/M-44 | `endowment.yield.posted` → `endowment.allocation.approved` | hanya imbal hasil terealisasi yang dialokasikan ke kuota beasiswa & pagu hibah riset |
| I-7 | M-13 → M-14 → M-18 → M-07 → M-08 | `enrollment.krs.approved` → `schedule.published` → `attendance.lecturer.session_closed` → `bkd.activity.recorded` | KRS menentukan kelas & ruang; presensi dosen per sesi menjadi SKS pengajaran BKD → SISTER |
| I-8 | M-16/M-18 → M-19 → M-12 | `lms.submission.graded`, `attendance.recorded` → `grading.final.locked` → `obe.plo.computed` | komponen nilai terisi otomatis; AST menghitung nilai akhir; capaian CPMK→CPL terhitung; KHS & transkrip |
| I-9 | M-30 → M-35 → M-27 | `yudisium.batch.approved` → `pin.reserved` → `diploma.issued` → survei tracer gelombang 1 | PIN direservasi dari batch terkunci; e-ijazah bertanda tangan + QR SIVIL publik; alumni otomatis masuk kohort tracer |
| I-10 | Semua → M-34/M-31/M-32 | seluruh event domain → read-model | staging Feeder, tabel LKPS 9 kriteria, dan IKU 1–8 selalu mutakhir; ekspor tanpa rekap manual |

### 10.5 Simulasi Bisnis Real Lintas Modul (skenario uji penerimaan)

Setiap skenario adalah **tes E2E wajib** (TESTING_STRATEGY) dan dijalankan pada data seed realistis (SEED_DATA). Kolom "Efek real-time" adalah perubahan UI yang wajib terjadi tanpa reload di role penerima.

**S-1 Mahasiswa Reguler (lifecycle penuh)**

| Langkah | Role | Modul | Aksi | Event | Efek real-time |
|---|---|---|---|---|---|
| 1 | Tim Marketing | M-45 | lead dari expo dikonversi | `crm.lead.converted` | Admin PMB melihat camaba baru dengan data prefilled |
| 2 | Camaba | M-09 | isi form dinamis, unggah ijazah → OCR lokal + Levenshtein ≥ 0.85 | `pmb.applicant.submitted` | antrean verifikasi Admin PMB bertambah |
| 3 | Admin PMB | M-09 | verifikasi & keputusan lulus | `pmb.selection.decided` | tagihan daftar ulang muncul di portal camaba (M-10) |
| 4 | Sistem/Bank | M-10 | webhook VA lunas | `finance.invoice.paid` | status camaba → daftar ulang selesai |
| 5 | Sistem | M-02 | NIM terbit (pola parameter) & status aktif | `academic.student.activated` | dashboard berubah dari profil `APPLICANT` ke `MAHASISWA`; Feeder staging terisi |
| 6 | Mahasiswa / Dosen Wali | M-13 | KRS war (Redlock) → submit → ACC | `enrollment.krs.approved` | kursi tersisa berkurang live; kelas LMS & jadwal muncul |
| 7 | Dosen / Mahasiswa | M-16/M-18 | materi, tugas, presensi QR 5 s + geofence | `attendance.recorded`, `lms.submission.graded` | daftar hadir live di layar dosen |
| 8 | Dosen / Kaprodi | M-19/M-12 | hitung AST → kunci → publikasi KHS | `grading.khs.published`, `obe.plo.computed` | KHS mahasiswa & capaian CPL Kaprodi terbarui |
| 9 | Mahasiswa / Pembimbing | M-20 | logbook ≥ parameter → sidang → nilai → RAMA | `thesis.repository.published` | clearance M-30 bertransisi |
| 10 | Pustakawan / BAUK / Kemahasiswaan | M-39/M-10/M-24 | bebas pustaka, lunas, SKKM cukup | `library.clearance.granted`, `finance.hold.changed`, `skkm.claim.approved` | status DFA mahasiswa → `LAYAK_YUDISIUM` di layar BAAK |
| 11 | BAAK / Dekan | M-30 | batch yudisium → approve → lock | `yudisium.batch.approved` | PIN M-35 dapat direservasi |
| 12 | BAAK | M-35 | reservasi PIN, tanda tangan e-ijazah | `diploma.issued` | QR SIVIL publik aktif |
| 13 | Panitia | M-23 | Hungarian seating, stage call QR | `graduation.stage_called` | layar panggung & ponsel wisudawan |
| 14 | Alumni | M-27 | tracer gelombang 1 | `tracer.response.submitted` | IKU 1 M-32 bergerak |

**S-2 Mahasiswa Konversi (RPL Tipe A)** — M-09 OCR transkrip asal → baris `rpl_conversions` (Levenshtein nama MK + DAG prasyarat M-12) → Kaprodi `APPROVE` (`rpl.conversion.approved`) → M-19 mencatat SKS transfer (nilai asal ternormalisasi skala tenant) → M-10 menghitung billing matrikulasi dari matriks (dimensi `rpl_type`, sisa SKS) → transkrip kumulatif gabungan → M-24/M-30 menyusun SKPI & DFA clearance. Batas SKS RPL = parameter berbasis Permendikbudristek 41/2021.

**S-3 Dosen & Riset** — M-44 dosen mengajukan proposal → reviewer buta menilai (skor Naive Bayes hanya pendamping) → LPPM `APPROVE` → kontrak → BAUK `APPROVE` termin (`lppm.disbursement.approved` → jurnal M-10) → luaran SINTA/HAKI divalidasi (`lppm.output.validated`) → M-07 klaim BKD otomatis (interval tree menolak bentrok) → M-08 push delta SISTER → M-32 IKU 5 naik real-time di dashboard Rektorat.

**S-4 Sarpras & Keuangan** — M-46 unit mengajukan PBJ (`finance.budget.committed` mengurangi sisa pagu live) → AHP evaluasi vendor & cek HPS → approval berjenjang PPK (jenjang dari parameter nilai) → kontrak → BAST (`procurement.goods.received`) → M-40 aset ber-QR, kategori menentukan masa manfaat → penyusutan garis lurus bulanan + jurnal.

**S-5 Interaksi Multi-Role Real-Time** — (a) Dosen membuka presensi → kartu mahasiswa kelas itu berubah "Check-in tersedia" ≤ 2 s; (b) Pustakawan memberi bebas pustaka → mahasiswa mendapat notifikasi & BAAK melihat status DFA berubah; (c) Insiden ruang (M-33) → max-flow memindahkan kelas → jadwal mahasiswa & dosen terbarui + push alert; (d) Kaprodi `UNLOCK` nilai → dosen melihat gradebook terbuka kembali; (e) BAUK menandai lunas → blokir KRS hilang dari layar mahasiswa.

**S-6 Cakupan modul tersisa** — skenario pendukung wajib: M-01 provisioning tenant baru → seed lookup/role; M-03 perubahan izin empat-mata; M-04 tiket melewati SLA naik tier; M-05 verifikasi rantai hash & DSR PDP; M-06 payroll lock → jurnal; M-11 AHP beasiswa → diskon tagihan → freeze otomatis IPK < parameter; M-14 solver CSP → publish; M-15 ganti moda sesi → tag feeder; M-17 ujian dengan flag face check → review pengawas; M-21 harvest OJS → klaim BKD; M-22 HAKI granted → IKU 5; M-26 simulasi CPM; M-28 matching lowongan → IKU 1; M-29 konversi ECTS & alert visa; M-31 snapshot LKPS; M-36 laporan anonim terenkripsi → kasus; M-37 siklus AMI PPEPP; M-41 rekam medis terenkripsi & antrean; M-42 bin packing asrama → tagihan; M-43 registrasi event → gate QR; M-47 alokasi imbal hasil; APP check-in offline → sinkron diferensial.

### 10.6 Acceptance Criteria Lintas Modul (enterprise)

1. Tidak ada `ENUM`/`CHECK IN (...)` bisnis di migrasi baru (`pnpm db:lint` aturan kustom) dan tidak ada string pilihan bisnis di kode (lint `no-restricted-syntax` untuk literal status).
2. Setiap resource memiliki 6 endpoint standar + aksi alur kerja (API_SPEC §6.5) dan tombol UI yang hanya muncul bila izin ada; deny diuji per role.
3. Setiap rantai I-1…I-10 lulus tes E2E tanpa langkah input manual di modul hilir.
4. Latensi propagasi event → UI p95 ≤ 2 s pada 1.000 koneksi WS.
5. Semua engine §11.4 memiliki golden dataset & hasil deterministik (seed acak tetap).
6. Parameter regulasi tidak dapat diset di bawah `regulatory_floor`.

### 10.7 Keputusan Produk Terbuka (tidak memblokir R1)

| ID | Keputusan | Default sementara |
|---|---|---|
| PD-01 | `ppks` inti atau addon | **inti** (kewajiban regulasi) |
| PD-02 | Provider rapat daring default | Jitsi self-hosted; Zoom/Meet via OAuth milik tenant |
| PD-03 | Warna header | header biru (`--sica-topbar-bg`, default `#405189`) dengan aksen primer hijau `#0ab39c` (UI_UX §10.1) |
| PD-04 | Face check proctoring | opsional per ujian, wajib persetujuan biometrik & alternatif pengawas manusia |

<!-- SICA-47:END enterprise-47 -->
