# SICA — Glosarium Istilah & Kamus Domain

Dokumen ini mendefinisikan istilah domain akademik, regulasi pendidikan tinggi Indonesia, terminologi keuangan kampus, standar akreditasi, dan konsep arsitektur teknis yang digunakan di seluruh dokumentasi **SICA (Sistem Informasi Campus Akademik)**.

---

## 1. Terminologi Akademik & Perguruan Tinggi

| Istilah | Kepanjangan / Sumber | Definisi & Peran dalam Sistem SICA |
|---|---|---|
| **OW** | *Open Wiring* | Periode pembukaan registrasi mata kuliah serentak oleh seluruh mahasiswa secara online dalam jendela waktu kalender akademik tertentu. Titik beban trafik puncak (*peak concurrency*) sistem. |
| **KRS** | Kartu Rencana Studi | Dokumen kontrak rencana beban studi yang diajukan mahasiswa untuk semester berjalan. Memerlukan validasi prasyarat, batas SKS, dan persetujuan Dosen PA. |
| **KHS** | Kartu Hasil Studi | Dokumen laporan capaian prestasi nilai akademik mahasiswa pada satu semester tertentu, memuat daftar mata kuliah, huruf mutu, bobot, dan Indeks Prestasi Semester (IPS). |
| **SKS** | Satuan Kredit Semester | Takaran beban belajar mahasiswa. Berdasarkan SN-Dikti Permendiktisaintek 39/2025 Pasal 15(6), 1 SKS setara dengan **45 jam kerja per semester**. |
| **IPS** | Indeks Prestasi Semester | Rata-rata bobot nilai tertimbang per SKS yang diperoleh mahasiswa dalam satu semester berjalan (maksimum 4,00). Menentukan plafon batas SKS semester berikutnya. |
| **IPK** | Indeks Prestasi Kumulatif | Rata-rata bobot nilai tertimbang per SKS untuk seluruh mata kuliah yang telah diselesaikan mahasiswa sejak awal masa studi. |
| **Semester Antara** | Semester Pendek | Semester tambahan di antara semester ganjil dan genap (biasanya periode libur), dengan beban maksimum 9 SKS per BR-R2. |
| **BAAK** | Biro Administrasi Akademik & Kemahasiswaan | Unit kerja kampus yang mengelola administrasi perkuliahan, registrasi mahasiswa, transkrip, status studi, dan penutupan periode akademik. |
| **Dosen PA** | Dosen Pembimbing Akademik | Dosen yang ditugaskan membimbing dan memvalidasi (approve/reject) pengajuan KRS mahasiswa binaannya setiap awal semester. |
| **Yudisium** | Penetapan Kelulusan | Rapat/sidang resmi fakultas/institut yang memverifikasi terpenuhinya seluruh syarat kelulusan (SKS minimum, IPK minimum, bebas cekal) dan menetapkan status mahasiswa menjadi `LULUS` dengan SK Yudisium resmi. |
| **Wisuda** | Upacara Seremoni Kelulusan | Seremoni perayaan wisudawan/wisudawati yang telah berstatus lulus pada yudisium. Satu periode yudisium dapat dialokasikan ke dalam beberapa kelompok seremoni wisuda. |
| **Transkrip Akademik** | Transkrip Nilai Definitif | Daftar lengkap seluruh mata kuliah dan nilai resmi yang diselesaikan mahasiswa selama masa tempuh studi hingga kelulusan. Disertai Nomor Ijazah Nasional. |
| **SKPI** | Surat Keterangan Pendamping Ijazah | Dokumen resmi dwibahasa (Indonesia & Inggris) yang memuat rekam jejak capaian pembelajaran lulusan (CPL), aktivitas kokurikuler, sertifikasi kompetensi, dan level KKNI. |
| **Cekal** | *Blockade / Clearance Hold* | Pembatasan hak akses transaksional mahasiswa (seperti isi KRS, lihat KHS, ikut ujian, atau yudisium) akibat sanksi akademik, tunggakan SPP, buku pinjaman perpustakaan, atau pelanggaran disiplin. |

---

## 2. Regulasi Nasional & Ekosistem Kemendiktisaintek

| Istilah | Rujukan Regulasi | Definisi & Implikasi Sistem |
|---|---|---|
| **SN-Dikti** | Permendiktisaintek No. 39/2025 (+ Amendemen No. 10/2026) | Standar Nasional Pendidikan Tinggi yang mengatur beban minimum kelulusan (S1: 144 SKS), masa studi (maksimal 2× masa tempuh normal), skala nilai nasional (A=4, B=3, C=2, D=1, E=0), dan ambang kelulusan IPK. |
| **PDDIKTI** | Pangkalan Data Pendidikan Tinggi | Basis data nasional resmi kementerian yang menyimpan riwayat seluruh perguruan tinggi, dosen, mahasiswa, mata kuliah, aktivitas kuliah, dan kelulusan di Indonesia. |
| **Neo Feeder** | Aplikasi Sinkronisasi PDDIKTI | Aplikasi/gateway resmi dari kementerian yang menghubungkan SIAKAD lokal kampus dengan pangkalan data PDDIKTI melalui REST API bersertifikat. |
| **PISN / PIN** | Permenristekdikti No. 59/2018 | Penomoran Ijazah Nasional / Sistem Penomoran Ijazah Nasional yang dikelola kementerian untuk menerbitkan nomor unik ijazah yang anti-pemalsuan dan diverifikasi via SIVIL. |
| **SIVIL** | Sistem Verifikasi Ijazah secara Elektronik | Portal verifikasi publik nasional untuk memastikan keabsahan nomor ijazah dan status kelulusan mahasiswa yang terdaftar di PDDIKTI. |
| **UU PDP** | UU No. 27/2022 tentang Pelindungan Data Pribadi | Regulasi pelindungan data pribadi di Indonesia. Mengatur kewajiban perlindungan PII, hak subjek data, dasar pemrosesan hukum, dan audit compliance. |
| **PP 33/2026** | Peraturan Pemerintah Pelaksana UU PDP (efektif Jan 2027) | Mengatur denda administratif (s.d. 2% pendapatan/aset tahunan), kewajiban penunjukan Data Protection Officer (DPO), dan Data Protection Impact Assessment (DPIA). |
| **TTE Tersertifikasi** | UU 1/2024 (ITE) & PP 71/2019 | Tanda Tangan Elektronik yang diterbitkan oleh Penyelenggara Sertifikasi Elektronik (PSrE) terakreditasi BSSN (seperti BSrE, Peruri, Privy) yang memiliki kekuatan hukum setara tanda tangan basah di pengadilan. |
| **JRA** | Jadwal Retensi Arsip (UU 43/2009 & ANRI) | Pedoman jangka waktu penyimpanan dan nasib akhir arsip kampus. Menetapkan rekaman kelulusan (Ijazah, Transkrip, SKPI) sebagai **arsip permanen** yang tidak boleh dimusnahkan. |
| **IKU** | Indikator Kinerja Utama PT (Kepmendiktisaintek 358/M/KEP/2026) | Metrik kinerja utama perguruan tinggi (mis. IKU 1 untuk keterserapan kerja lulusan/tracer study; IKU 2 aktivitas mahasiswa di luar kampus; IKU 3 dosen berkegiatan di industri). |

---

## 3. Kurikulum OBE & Penjaminan Mutu

| Istilah | Konteks | Definisi |
|---|---|---|
| **OBE** | *Outcome-Based Education* | Pendekatan pendidikan yang berfokus pada hasil capaian belajar lulusan (bukan sekadar input jam kuliah). Menjadi standar wajib akreditasi unggul BAN-PT dan lembaga akreditasi internasional. |
| **CPL** | Capaian Pembelajaran Lulusan | Kemampuan, pengetahuan, dan sikap yang harus dimiliki oleh setiap lulusan suatu program studi yang diturunkan dari Profil Lulusan dan jenjang KKNI. |
| **CPMK** | Capaian Pembelajaran Mata Kuliah | Kemampuan spesifik yang dijabarkan dari CPL dan dibebankan kepada suatu mata kuliah tertentu. |
| **Sub-CPMK** | Sub-Capaian Pembelajaran Mata Kuliah | Kemampuan akhir pada tiap tahapan pembelajaran/pertemuan yang dapat diukur dan dievaluasi secara objektif. |
| **SPMI** | Sistem Penjaminan Mutu Internal | Siklus pengendalian mutu perguruan tinggi (PPEPP: Penetapan, Pelaksanaan, Evaluasi, Pengendalian, Peningkatan) untuk memantau standar akademik secara berkesinambungan. |
| **LAM / BAN-PT** | Badan Akreditasi Nasional / Lembaga Akreditasi Mandiri | Lembaga independen akreditasi program studi (mis. LAM-INFOKOM untuk informatika, LAM-PTKes untuk kesehatan, LAMEMBA untuk ekonomi, BAN-PT untuk institusi). |

---

## 4. Keuangan & Tagihan Kampus

| Istilah | Konsep | Definisi |
|---|---|---|
| **UKT** | Uang Kuliah Tunggal | Biaya kuliah flat per semester yang mencakup seluruh komponen biaya pendidikan mahasiswa, biasanya dikelompokkan ke dalam beberapa kelompok tarif (UKT 1 s.d. UKT 9). |
| **VA** | *Virtual Account* | Nomor rekening virtual unik per tagihan/per mahasiswa yang diterbitkan bank rekanan untuk identifikasi dan konfirmasi pembayaran otomatis via webhook. |
| **QRIS** | *Quick Response Code Indonesian Standard* | Standar pembayaran kode QR nasional Bank Indonesia untuk pembayaran instan via e-wallet dan mobile banking. |
| **Ledger (Buku Besar)** | Akuntansi Append-Only | Catatan finansial berbasis ledger tanpa mutasi UPDATE/DELETE; pembatalan tagihan atau koreksi dilakukan dengan baris pembalik (*reversing entry*). |
| **Reversing Entry** | Jurnal Pembalik | Baris transaksi baru yang mencatat nilai negatif/kebalikan dari transaksi yang dibatalkan agar audit trail saldo tetap terjaga secara matematis. |
| **Void** | Pembatalan Invoice | Perubahan status tagihan menjadi tidak berlaku dengan alasan resmi dan entri pembalik, tanpa menghapus baris faktur dari database. |

---

## 5. Arsitektur Teknis & Keamanan SICA

| Istilah | Layer | Definisi & Manfaat Arsitektur |
|---|---|---|
| **Modular Monolith** | Arsitektur Aplikasi | Struktur kode dalam satu repository dan satu deployment unit, namun dibagi menjadi modul-modul domain yang terisolasi dengan kontrak ketat (Zod contracts) dan tanpa dependensi sirkular. |
| **Shared Schema + RLS** | Database Multi-tenancy | Pola multi-tenant di mana seluruh data kampus berada dalam satu skema database PostgreSQL bersama, namun diisolasi secara mutlak di tingkat kernel database menggunakan *Row-Level Security* (RLS). |
| **RLS** | *Row-Level Security* | Fitur keamanan PostgreSQL yang menyaring baris tabel secara otomatis berdasarkan kondisi keamanan (`USING` dan `WITH CHECK`) yang mengikat peran aplikasi `sica_app`. |
| **GUC** | *Grand Unified Configuration* (PostgreSQL) | Variabel sesi lokal PostgreSQL (seperti `SET LOCAL app.tenant_id`) yang diatur pada setiap awal transaksi koneksi pool untuk membatasi cakupan query RLS. |
| **Transactional Outbox** | Pola Komunikasi Event | Pola penulisan event keluar ke tabel `outbox` di database dalam transaksi ACID yang sama dengan mutasi bisnis untuk menjamin tidak ada event yang hilang saat broker/jaringan bermasalah. |
| **Advisory Lock** | PostgreSQL Concurrency Control | Kunci concurrency eksplisit di tingkat database pada level aplikasi (mis. lock per `class_id`) untuk mencegah *race condition* kelebihan kuota kelas saat ribuan mahasiswa berebut KRS bersamaan. |
| **Argon2id** | Kriptografi Password | Algoritma *memory-hard password hashing* pemenang Password Hashing Competition (PHC) yang direkomendasikan OWASP untuk ketahanan terhadap serangan GPU/ASIC brute-force. |
| **Pepper** | Kriptografi | Rahasia kunci statis tambahan yang disimpan terpisah di KMS (Key Management Service) dan digabungkan sebelum hashing password untuk melindungi database jika dump SQL bocor. |
| **CSP** | *Content Security Policy* | Header HTTP respons keamanan (`Content-Security-Policy`) yang menginstruksikan browser untuk membatasi eksekusi skrip hanya pada sumber terpercaya dan skrip ber-`nonce` dinamis untuk mencegah XSS. |
| **DPA** | *Data Processing Agreement* | Perjanjian hukum pemrosesan data pribadi antara SICA (sebagai *Data Processor*) dan Kampus (sebagai *Data Controller*) sesuai mandat UU PDP. |
