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

**Status rujukan hukum:** daftar berikut merekam acuan yang dikutip spesifikasi, bukan hasil verifikasi legal pada siklus ini. Nomor, tanggal efektif, pasal, amendemen dan cakupan institusi wajib dicocokkan dengan sumber resmi sebelum dijadikan aturan produksi; khusus klaim regulasi 2026 yang belum memiliki bukti tetap `[VERIFIKASI-RESMI]`. Ambang hadir 75% adalah kebijakan berversi kampus, bukan kewajiban nasional universal yang dibuktikan glosarium ini.

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
| **GUC** | *Grand Unified Configuration* (PostgreSQL) | Variabel sesi lokal PostgreSQL yang diatur pada setiap awal transaksi koneksi pool untuk membatasi cakupan query RLS. Kunci kanonik yang dipakai implementasi: **`app.current_tenant`** (`SET LOCAL app.current_tenant = '<uuid>'` — lihat `packages/database/migrations/0001_init_rls_policies.sql:14` dan `src/client.ts:46`). Nama lain yang sempat tersebar di dokumen (`app.tenant_id`, `app.current_tenant_id`) adalah defek dokumentasi `RD-01` dan tidak boleh dipakai. |
| **Transactional Outbox** | Pola Komunikasi Event | Pola penulisan event keluar ke tabel `outbox` di database dalam transaksi ACID yang sama dengan mutasi bisnis untuk menjamin tidak ada event yang hilang saat broker/jaringan bermasalah. |
| **Advisory Lock** | PostgreSQL Concurrency Control | Kunci concurrency eksplisit di tingkat database pada level aplikasi (mis. lock per `class_id`) untuk mencegah *race condition* kelebihan kuota kelas saat ribuan mahasiswa berebut KRS bersamaan. |
| **Argon2id** | Kriptografi Password | Algoritma *memory-hard password hashing* pemenang Password Hashing Competition (PHC) yang direkomendasikan OWASP untuk ketahanan terhadap serangan GPU/ASIC brute-force. |
| **Pepper** | Kriptografi | Rahasia kunci statis tambahan yang disimpan terpisah di KMS (Key Management Service) dan digabungkan sebelum hashing password untuk melindungi database jika dump SQL bocor. |
| **CSP** | *Content Security Policy* | Header HTTP respons keamanan (`Content-Security-Policy`) yang menginstruksikan browser untuk membatasi eksekusi skrip hanya pada sumber terpercaya dan skrip ber-`nonce` dinamis untuk mencegah XSS. |
| **DPA** | *Data Processing Agreement* | Perjanjian hukum pemrosesan data pribadi antara SICA (sebagai *Data Processor*) dan Kampus (sebagai *Data Controller*) sesuai mandat UU PDP. |

---

## 6. Istilah regulasi & domain yang dipakai normatif (ditambah 2026-10-19)

Daftar ini menutup temuan [AUDIT_READINESS.md](file:///c:/SICA/docs/AUDIT_READINESS.md) (skor §1 / `RD-30`): istilah di bawah **sudah** dipakai sebagai aturan di PRD/DATA_MODEL/INTEGRATIONS/RBAC tetapi belum pernah didefinisikan, sehingga agen berikutnya menafsirkannya sendiri.

| Istilah | Kepanjangan | Definisi operasional di SICA | Dipakai di |
|---|---|---|---|
| **AKM** | Status Akademik per Semester (field `status_akm` Feeder) | Status mahasiswa pada satu periode (`AKTIF`, `CUTI`, `DO`, `LULUS`, `PINDAHAN`, `NOT_REGISTRATION`); **wajib ada** sebelum KRS dibuka (`423 AKM_STATUS_MISSING`) | `student_status_history`, `BENCH-37` |
| **CP1 / CP2** | Checkpoint pelaporan PDDikti 1 & 2 | CP1 = rencana studi (mahasiswa, status, KRS, kurikulum kelas, dosen mengajar); CP2 = hasil (AKM, nilai, aktivitas, transkrip, lulus/DO). Tenggat ≤ 2 bulan setelah periode (BR-R9) | INTEGRATIONS §1.4, `BENCH-124` |
| **PDM** | Permintaan Penghapusan/Memperbaiki Data | Antrean koreksi data yang **sudah** terkirim ke PDDikti; wajib alasan + lampiran + SPTJM + persetujuan; menolak `UPDATE` langsung dan menolak hapus baris | `FR-FDR-04`, `BENCH-133` |
| **RPL** | Recognition of Prior Learning | Jalur masuk yang mengakui capaian dari pengalaman/kerja → `recognized_sks` + ekivalensi + penyesuaian plafon | `BENCH-14`, `BENCH-49` |
| **MBKM** | Merdeka Belajar Kampus Merdeka | Aktivitas luar kampus maks **20 SKS/semester** (BR-M1) dengan kontrak dua-approval + log aktivitas mitra | SM-8, `FR-MKM-01` |
| **CPL / CPMK** | Capaian Pembelajaran Lulusan / Capaian Pembelajaran Mata Kuliah | CPL milik prodi, CPMK milik mata kuliah; matriks kontribusi wajib berjumlah 1 per CPL (penegakan di service, bukan CHECK tabel) | OBE `DATA_MODEL §14`, `BENCH-115` |
| **PPEPP** | Penetapan, Pelaksanaan, Evaluasi, Pengendalian, Peningkatan | Siklus penjaminan mutu internal (SPMI); dasar kerja `QUALITY_OFFICER` | W-10.1–W-10.2 |
| **IKU** | Indikator Kinerja Utama perguruan tinggi | IKU-1 alumni bekerja, **IKU-2 aktivitas mahasiswa** (kunci modul kemahasiswaan `G-11`), IKU-7 nilai profesional dosen | `RBAC_MATRIX §2`, `BENCH-112` |
| **SIMKATMAWA** | Sistem Informasi Manajemen Kemahasiswaan | Pola data aktivitas/prestasi/poin yang menjadi acuan objek `student_activities` + bendera `show_in_skpi` | `BENCH-112` |
| **NIDN / NUPTK** | Nomor Induk Dosen Nasional / Nomor Univ. Perguruan Tinggi Kemendikbud | Identitas dosen di tingkat nasional; **data dosen tidak pernah ditulis lewat Feeder** (BR-R16) — SICA hanya mencocokkan | `lecturers`, INTEGRATIONS §1.4 |
| **BKD** | Beban Kerja Dosen | Realisasi minggu mengajar (cap **18** menurut Feeder) + tri dharma; bersumber dari `class_sessions` berstatus `HELD` dan jurnal sesi | `BENCH-59`, `BENCH-66` |
| **SISTER** | Sistem Sumber Daya Insani Terpadu | Kanal dikti untuk data dosen; padanan SICA: baca/cocok, **bukan** tulis | INTEGRATIONS §6.2 |
| **LLDIKTI** | Lembaga Layanan Pendidikan Tinggi | Pembina wilayah; **menyetujui** pembukaan kembali periode lampau (Tipe 1) setelah BAP | `BENCH-125`, `BENCH-126` |
| **BAP** | Berita Acara Pemeriksaan | Dokumen LLDIKTI yang menjadi syarat reopen periode lampau; disimpan di `period_reopen_requests.bap_number` | `BENCH-126` |
| **PISN** | Penomoran Ijazah Nasional | Diterbitkan **portal nasional**, bukan oleh kampus; SICA menyimpan + memverifikasi (jangan mengarang format) | BR-R8, `BENCH-110` |
| **SIVIL** | Sistem Verifikasi Ijazah Secara Elektronik | Kanal publik pengecekan keaslian ijazah — dasar hukum alternatif legalisir | `BENCH-120` |
| **TTE / PSrE** | Tanda Tangan Elektronik / Penyelenggara Sertifikasi Elektronik (terakreditasi BSSN) | Penanda-tanganan dokumen hukum; vendor-agnostik lewat `document_signatures.provider` | BR-R15, keputusan D-9 |
| **DLQ** | Dead Letter Queue | Antrean job yang gagal permanen (retry habis) — wajib terlihat operator + alert; **dilarang** drop diam-diam | ARCHITECTURE §10, W-06.4 |
| **PITR** | Point-In-Time Recovery | Pemulihan basis data ke momen tertentu; pasangan RPO/RTO ada di NFR-A2/DEPLOYMENT | DEPLOYMENT_DEVOPS |
| **WORM** | Write Once, Read Many | Penyimpanan arsip yang tidak dapat diubah (audit & rekaman kelulusan, retensi permanen BR-R12) | SECURITY §7 |
| **RPS** | Rencana Pembelajaran Semester | Dokumen wajib per mata kuliah; bersama Rencana Evaluasi menjadi penentu IKU-7 (bobot ≥ 50%) | `BENCH-65`, OBJ-2 |
| **UKT / SPP** | Uang Kuliah Tunggal / Sumbangan Pembinaan Pendidikan | UKT = tarif periodik bergolongan; SPP = per SKS. **Satu** objek tarif, dua semantik penagihan | FR-KEU-01, `BENCH-19` |
| **VA** | Virtual Account | Nomor rekening virtual per tagihan dengan siklus hidup sendiri (`ISSUED/USED/CANCELLED/EXPIRED`) — hari ini belum menjadi objek | `BENCH-20` |
| **SPMB/PMB** | Seleksi Penerimaan Mahasiswa Baru | Alur pendaftar → seleksi → registrasi ulang → NIM → mahasiswa aktif; pendaftar **belum** mahasiswa sehingga tagihannya butuh payer polymorphic | `BENCH-01`, `BENCH-02` |

---

## 7. Istilah teknis enam celah enterprise (ditambah 2026-10-19)

Istilah di bawah dipakai normatif oleh spesifikasi KRS-War asinkron, jembatan Feeder, mesin tagih, OBE/MBKM, jejak audit kebal-ubah, dan presensi anti-spoofing. Tanpa definisi ini, tiap agen menafsirkan "amannya" sendiri — persis pola yang menghasilkan temuan `SEC-*` di [AUDIT_READINESS.md](file:///c:/SICA/docs/AUDIT_READINESS.md).

| Istilah | Kepanjangan | Definisi operasional di SICA | Rumah spesifikasi |
|---|---|---|---|
| **Lease (kursi)** | Sewa sementara kuota | Pegangan ber-TTL atas satu kursi kelas **sebelum** commit DB; punya `expires_at`, bisa dilepas eksplisit atau kedaluwarsa; bukan enrollment dan bukan decrement permanen | ARCHITECTURE §10, DATA_MODEL `krs_baskets` |
| **Overbooking** | Kuota terlampaui | Kondisi yang **harus mustahil**: `enrolled` melebihi `capacity`. Invariance `held + enrolled + waitlisted <= capacity` adalah bentuk yang benar | ARCHITECTURE §10, gerbang NFR-P1 |
| **202 Accepted** | Status HTTP kerja tertunda | Server menerima & menjadwalkan, **belum** menyelesaikan; wajib membawa `opId` + `statusUrl`. Bukan sukses, bukan gagal — dan karena itu UI tidak boleh menampilkan "KRS tersimpan" padanya | API_SPEC (kontrak KRS asinkron) |
| **`opId`** | Id operasi asinkron | Penanganan yang dapat ditanya statusnya (`QUEUED/PROCESSING/SUCCEEDED/FAILED/EXPIRED`) + posisi antrean; umur maksimum 15 menit | API_SPEC, DATA_MODEL `async_operations` |
| **SSE** | Server-Sent Events | Aliran satu arah server→klien untuk posisi antrean & hasil; `Last-Event-ID` untuk sambung ulang, heartbeat wajib, dan **wajib** punya fallback polling saat proxy memutus aliran | ARCHITECTURE §10, API_SPEC |
| **Idempotency-Key** | Kunci pengulangan aman | Id yang dibuat klien untuk menjamin satu percobaan = satu efek; replay mengembalikan hasil awal, bukan efek kedua. Tanpa ini, retry jaringan = kursi ganda | TECH_CONVENTIONS §1.1.1, API_SPEC |
| **Exponential backoff + jitter** | mundur eksponensial + acak | Jeda retry tumbuh eksponensial lalu ditambah komponen acak agar gerombolan klien tidak bangkit serentak (thundering herd) | INTEGRATIONS (retry Feeder), §3.1 messaging |
| **Circuit breaker** | Pemutus rangkaian | Setelah ambang kegagalan per kanal/bridge, penghentian sementara pengiriman (fail-fast) dengan probe pemulihan separuh — supaya satu Feeder lambat tidak memblokir seluruh tenant | INTEGRATIONS §1 |
| **RTO (di konteks Feeder)** | Request Time Out | Kegagalan **transport** (koneksi/read putus). Bukan temuan validasi data: tidak boleh ditulis sebagai kesalahan isian mahasiswa dan **tidak** memicu kirim ulang batch yang sudah diterima | INTEGRATIONS §1.4(l), matriks `error_code` |
| **DLQ** | Dead Letter Queue | (lihat §6) — di sini: tempat `feeder_jobs`/`krs.submit` yang retry-nya habis; wajib terlihat operator + alert, dilarang hilang diam-diam | ARCHITECTURE §10, INTEGRATIONS |
| **Staging layer** | Penyangga pra-kirim | Proyeksi payload resmi (bukan salinan tabel operasional) yang divalidasi & di-diff sebelum menyentuh pangkalan nasional; append-only, bisa direkonstruksi untuk auditor | INTEGRATIONS §1, DATA_MODEL `pddikti_staging_*` |
| **Diff nasional–lokal** | Selisih pangkalan | Perbandingan data SICA vs respons `Get*` PDDikti; hasilnya tiga disposisi: lokal-dasar, pusat-dasar, atau butuh **PDM** (lihat §6). Perbedaan **tidak pernah** resolved otomatis menjadi ubahan data pokok | INTEGRATIONS §1 |
| **Envelope encryption** | Enkripsi bersampul | Data kolom dienkripsi DEK; DEK dibungkus master key di KMS/HSM. Yang tersimpan di DB bukan kunci; rotasi = bungkus ulang DEK, bukan enkripsi ulang seluruh baris | SECURITY §3.7 |
| **DEK / KEK** | Data Key Encrypting Key / Key Encrypting Key | DEK menyentuh data, KEK menyentuh DEK. Pemisahan ini yang membuat rotasi terjadwal mungkin tanpa membaca seluruh baris | SECURITY §3.7 |
| **AES-256-GCM** | Galois/Counter Mode | Mode terautentikasi: selain rahasia, juga **mendeteksi** ubahan ciphertext. Konsekuensi wajib: IV unik per enkripsi; IV dipakai ulang = kebocoran plaintext | SECURITY §3.7, DATA_MODEL |
| **AAD** | Additional Authenticated Data | Bahan yang diikat ke perhitungan tag GCM (`tenant_id` + nama kolom + `record_id`) sehingga ciphertext tidak dapat dipindah ke baris/tenant lain dan tetap lolos verifikasi | SECURITY §3.7 |
| **Blind index** | Indeks buta | HMAC atas plaintext dengan kunci terpisah, disimpan sebagai kolom `*_bidx char(64)` + `UNIQUE(tenant_id, bidx)`; memungkinkan pencarian/pencocokan NIK tanpa membuka plaintext. **Bukan** penggantian enkripsi kolom | SECURITY §3.7, DATA_MODEL |
| **Rekey** | Penggantian kunci | Job menulis ulang ciphertext dengan versi kunci baru; wajib reversibel-dijadwal, bukan `UPDATE` manual, dan selalu tercatat di jejak audit kebal-ubah | SECURITY §3.7 |
| **Insert-only / immutable audit** | Jejak tulis-saja | Tabel yang **tidak** punya `updated_at`, tidak mengizinkan `UPDATE`/`DELETE`/`TRUNCATE` untuk peran apa pun termasuk `super_admin`; koreksi = baris baru. Catatan keras: policy SELECT-only saja tidak cukup — **grant** harus di-`REVOKE` | SECURITY §3.6, DATA_MODEL |
| **Rantai hash** | Hash chain | `hash = digest(prev_hash disambung canonical(payload))` per (tenant, partisi); memvalidasi urutan & isi. Pemutusan rantai dilaporkan, tidak ditambal diam-diam | DATA_MODEL §4, `emitAdminAudit` |
| **Pseudoanimisasi** | Bukan anonimisasi | Identitas langsung diganti penghubung + kunci terpisah: data tetap berguna untuk arsip & Feeder, tapi tidak dapat dibaca balik tanpa kunci. Ini jawaban konflik **hak hapus (UU PDP)** vs **kewajiban arsip (BR-R12)** — bukan `DELETE` | SECURITY §3.7, `dsr_*` |
| **DSR** | Data Subject Request | Permintaan hak subjek data (akses, salinan, koreksi, bantahan, cabut consent, hapus) dengan status & outcome terkurasi enum | DATA_MODEL §15.2, SECURITY §3.7 |
| **TOTP** | Time-based One-Time Password | Token sekali-pakai berumur pendek berbasis waktu. Di presensi: QR berganti tiap **5 detik**; di MFA: berbasis 30 detik. Klien tidak pernah mengirim hasil keputusan, hanya bahan | SECURITY §2, API_SPEC presensi |
| **HMAC (QR presensi)** | Hash-based Message Authentication Code | Tanda tangan sesi presensi memakai rahasia server-side per (sesi, window). Penerbit tanda tangan **wajib** terikat bukti pengampuan kelas — tanpa itu rute menjadi oracle tanda tangan (`SEC-03`) | API_SPEC, ARCHITECTURE §10.2 |
| **Window tolerance** | Tololansi jendela | Jumlah window sebelum/sesudah yang masih diterima; kompensasi jam klien tanpa membuka replay. Nilai ini **resep keamanan**: tidak ditampilkan ke mahasiswa | API_SPEC, UI_UX §10 |
| **BSSID** | Basic Service Set Identifier | Pengenal AP Wi-Fi sebagai bukti "hadir di gedung". **Catatan platform**: Android 12+ butuh izin perangkat sekitar; iOS tidak menyediakan BSSID ke aplikasi → jalur verifikasi iOS wajib berbeda dan tidak boleh diklaim setara | UI_UX §10, API_SPEC |
| **Mock location** | Lokasi palsu | Flag perangkat (`is_mock_location`) + deteksi root/jailbreak. Kebijakan tenant memutuskan `BLOCK` atau `WARN_AND_LOG`; keduanya wajib tercatat sehingga penolakan bisa dibela | `attendances.is_mock_location`, UI_UX §10 |
| **Haversine** | Rumus jarak bola | Jarak koordinat→ruang dalam meter. Sumber kebenaran koordinat adalah **ruang milik server**, bukan yang dikirim klien; nilai `distance_meters` hasil hitung server yang disimpan | `attendances.distance_meters`, API_SPEC |
| **Device attestation** | Jaminan perangkat | Bukti bahwa perangkat/aplikasi asli (Play Integrity / App Attest). Digunakan sebagai pengganti BSSID di iOS dan untuk menaikkan keyakinan saat mode lokasi mencurigakan | API_SPEC, UI_UX §10 |
| **Profil Lulusan** | Capaian tingkat lulusan | Atap hierarki OBE: Profil Lulusan → CPL → CPMK → Sub-CPMK → Indikator Asesmen → Item Penilaian. Satu mata kuliah dapat melayani beberapa CPL | DATA_MODEL (OBE), API_SPEC |
| **Sub-CPMK** | Butir capaian mata kuliah | Turunan CPMK yang dapat diukur langsung; penghubung antara butir penilaian dosen dan capaian. **Item penilaian tidak pernah** menunjuk CPL secara langsung | DATA_MODEL (OBE) |
| **Attainment** | Pencapaian capaian | Agregasi per-armah/per-prodi atas Sub-CPMK→CPMK→CPL; numerik atau tercapai/tidak, mengikuti ambang yang disepakati; dipakai sebagai bukti akreditasi | DATA_MODEL `outcome_attainments`, API_SPEC |
| **Dispensasi keuangan** | Penangguhan kewajiban | Surat permohonan yang **menunda/mengurangi** tagihan atau membuka gerbang untuk periode tertentu; butuh alasan + lampiran + persetujuan `VALIDATE` oleh peran berbeda (pemohon ≠ penyetuju). Bukan penghapusan piutang | API_SPEC (mesin tagih), DATA_MODEL |
| **Denda keterlambatan** | Penalty | Pos biaya yang muncul otomatis melewati jatuh tempo; perhitungannya (dasar, pro-rata, plafon, peniadaan saat dispensasi) wajib satu fungsi kalkulasi dan **satu peristiwa ledger**, bukan sunting `net_amount` | DATA_MODEL `fee_components`, PRD BR-A6 |

---

## 8. Istilah gelombang kedua (2026-10-20) — engine nol-API-key & mesin data master

| Istilah | Padanan singkat | Makna operasional |
|---|---|---|
| Nol-API-Key | tanpa kunci vendor | Seluruh fungsi cerdas dijalankan algoritma internal/ML lokal di infrastruktur sendiri; panggilan berkunci dilarang dan data tidak keluar. Normatif di AGENTS §3.9, dibuktikan gerbang CI (g)/(h). |
| Nol-hardcoding data master | kamus adalah data | Nilai yang dapat dikembangkan/dinamai ulang kampus disimpan di mesin reference_kinds/reference_items dan dibaca lewat endpoint lookup, bukan konstanta di kode. Normatif di AGENTS §3.10, DATA_MODEL §20.1. |
| Kelas A / A-prime / B / C / D | pengelompokan kosakata | A = protokol & mesin state (enum tertutup); A-prime = keadaan tetap, label bebas; B = kamus nasional berversi (tenant hanya memetakan label); C = kamus yang dapat dirawat kampus; D = atribut kustom. Menentukan bentuk penyimpanan dan apakah CHECK tertutup diizinkan. |
| Dynamic Master Data Engine | satu mesin kamus | Pengganti sekitar 30 layar master kecil: satu tabel nilai per-tenant + metadata jenis kamus (cara merender, sumber nasional, versi, jendela berlaku) + layar Admin bertab + analisis dampak. |
| reference_kind_usage | siapa memakai kamus ini | Indeks terbalik kind ke layar/kolom/laporan. Menjawab "apa yang rusak kalau nilai ini saya nonaktifkan" dan menjadi target gerbang CI (n). Global (bukan milik tenant) karena mendeskripsikan kode aplikasi. |
| Atribut kustom | field tanpa rilis kode | Definisi di tenant_custom_attributes (tipe, wajib, regex, scope, visibilitas peran, pemetaan Feeder); nilai di kolom attributes jsonb tabel induk; riwayat di custom_attribute_history bila is_tracked. EAV murni ditolak sebagai penyimpan nilai. |
| Pensiun kode (merge) | merged_into_id | Nilai kamus nasional yang berhenti berlaku menunjuk penggantinya; riwayat tetap terbaca lewat parameter ?at= dan tidak pernah dihapus. |
| X-Lookup-Version | versi kamus | Naik setiap kali ada tulis; klien memakai ETag/If-None-Match supaya satu layar biodata tidak menembak endpoint yang sama dua belas kali. |
| Lease epoch / fencing token | nomor generasi pegangan | Pencacah monoton per pegangan kursi (tenant, kelas, mahasiswa). Worker finalis menolak job ber-epoch basi (FAILED_SUPERSEDED) sehingga job lama yang selesai terlambat tidak dapat menulis. Ini pengganti **Redlock**, yang ditolak karena tidak menambah kebenaran ketika penjaga otoritatifnya adalah DB. |
| Golden vector | vektor uji byte-identik | Input fixtured menghasilkan output identik bit-per-bit; membuat angka enam bulan lalu dapat direproduksi di hadapan auditor. |
| Mode turun (degraded) | jujur soal data | Ketika prasyarat (course_prerequisites, ketersediaan pengampu, rubrik indikator) belum terisi, mesin mengembalikan flag dan layar menampilkannya — bukan angka yang tampak meyakinkan. |
| Inti konflik (conflict core) | kenapa mustahil | Himpunan kendala/batas minimal yang membuat penjadwalan tidak layak (mis. "Lab II: kapasitas alat 24, kebutuhan 36"), bukan pesan "tidak ada slot". |
| Delta Sync + airmen kirim | hanya yang berubah | Himpunan berubah = updated_at setelah airmen ATAU transisi audit ATAU koreksi/tombstone; record_digest sama berarti SKIP; airmen hanya maju atas baris yang benar-benar sukses. |
| Akar Merkle jejak audit | jangkar tak-ubah | Akar per 1.000 daun per stream; akar hari ini menunjuk akar kemarin; diekspor ke penyimpanan WORM milik sendiri. TSA RFC 3161 pihak ketiga ditolak (butuh layanan luar). HASH_MISMATCH berarti bekukan + COMPROMISED, bukan dihitung ulang. |
| Coverage capaian (OBE) | berapa yang punya bukti | n_evaluated / n_enrolled dengan n_missing_evidence terpisah. Capaian tinggi dengan coverage rendah adalah temuan mutu, bukan hasil baik. |
| Scope SITE | hak per kampus | Tingkat scope baru untuk multi-kampus: penugasan memegang site_id + valid_to; pelanggaran lintas-site adalah IDOR horizontal. |
| Tantang-balas presensi | QR yang tidak bisa distop | Setelah pemindaian pertama, server menerbitkan tantangan 6 digit yang berganti pada langkah waktu berikutnya dan harus dikirim balik; mematahkan pola "foto QR dikirim ke teman di luar kampus". |

## 9. Istilah siklus 2026-10-20 bagian 2 — parameter, modus, dan otorisasi mikro

| Istilah | Makna operasional |
|---|---|
| Mesin parameter dinamis | Rumah baru (master_system_parameters, 0049) untuk skalar konfigurasi tenant: ambang, timeout, flag, pola. Punya CRUD, riwayat beralasan, dampak, dan hot-reload. Tidak memegang kredensial dan tidak menampung aturan struktural yang sudah punya tabel. |
| Kelas risiko parameter | TECHNICAL, OPS, ACADEMIC, FINANCIAL, REGULATORY, SECURITY. Menentukan siapa boleh membaca/menulis, perlu penyetuju kedua atau tidak, dan perlu MFA atau tidak. |
| PARAM_EDIT | Hak mengubah parameter sistem. Bukan verba baru: UPDATE pada resource settings dengan pola di parameter_permissions. |
| parameter_permissions | Pengikat pola kunci (mis. finance.*) ke kode izin yang sudah ada. DENY menang atas ALLOW; pola terspesifik menang; tidak boleh menciptakan izin di luar katalog. |
| menu_items / menu_permissions | Pohon menu per lapis (WEB/MOBILE) + allowlist izin per menu. Menyaring menu bukan kontrol akses: gerbang servis L1–L6 tetap wajib di setiap rute. |
| route_key | Nama stabil rute logis yang dikirim ke klien; path dibangun dari route_key, bukan string bebas hasil tempel. |
| X-Parameter-Version | Versi keadaan konfigurasi yang dipakai sebuah keputusan. Dibawa di respons dan disimpan di baris hasil supaya keputusan dapat direproduksi setelah parameter berubah. |
| learning_modality | Modus kelas: ONSITE, ONLINE, BLENDED. Kosakata kanonik; offline/hybrid/delivery_mode adalah alias yang dilepas. |
| session_kind | Bentuk satu pertemuan: REGULAR, SYNC_LIVE, ASYNC_MODULE, PRAKTIKUM, UTS, UAS, SUSULAN. Bukan sinonim modus: kelas BLENDED memiliki beberapa jenis ini. |
| attendance_evidence | Tabel bukti kehadiran multi-sumber (insert-only, ber-digest). Satu sesi dan satu mahasiswa tetap hanya punya satu baris attendances; bukti kedua tidak membuat kehadiran kedua. |
| Dual-Reconciliation | Rekonsiliasi bukti luring (QR/geofence) dan daring (peristiwa LMS) dengan lima kebijakan eksplisit; laporan vendor saja tidak pernah menghasilkan HADIR. |
| Oracle otoritatif kehadiran daring | SICA Virtual Campus self-hosted (BBB/Jitsi). Vendor webinar bersifat pendukung karena membawa kredensial dan risiko egress. |
| Interval tree (ALG-17) | Struktur untuk mendeteksi tumpang tindih beban/BKD: bangun O(n log n), query O(log n + k). Klaim O(log N) saja menyesatkan karena mengabaikan biaya bangun. |
| Pattern compiler (ALG-18) | Kompilator pola NIM per tenant menjadi regex + sequence per prefix. Deterministik (golden vector deret), tanpa MAX+1, dan menolak terbit bila pola belum dikonfigurasi. |
| DSatur (ALG-15) | Pewarnaan graf konflik ujian sebagai batas atas, dengan clique sebagai batas bawah; hasilnya dilaporkan sebagai gap, bukan sebagai klaim optimum. |

## 10. Leksikon gelombang ketujuh — 47 modul (2026-10-20)

| Istilah | Arti yang dipakai di dokumen ini |
|---|---|
| Modul bisnis (`M-xx`) | Label produk dan pengelompokan menu untuk 47 modul + SuperApp. **Bukan** enum, **bukan** kode entitlement, **bukan** izin. Rumah datanya `menu_items` (`DATA_MODEL §21.7`), registri normanya `PRD §5.12.1`. |
| Kode entitlement | Gerbang jual dan partisi izin: 19 nilai nyata di `packages/contracts/src/entitlement.ts` + kandidat di `PRD §5.12.1`. Sumbu ini berbeda dari `PERMISSION_MODULES` (13 nilai katalog izin) — melihat keduanya sebagai satu hal adalah sumber `RD-61`. |
| Kode modul izin (`PermissionModule`) | Nilai tempat sebuah izin dikumpulkan untuk uji katalog: hanya 13 nilai. Kolom `Modul` di `RBAC §4.5.1` memakai kosakata ini, sehingga tidak dapat dipakai untuk menyimpulkan modul jual. |
| SuperApp | Permukaan mobile (Flutter), bukan SKU. Merender modul yang sama dari `menu_items` dengan `layer` MOBILE/BOTH; tidak menghitung angka akademik di perangkat. |
| Vonis tanggung jawab tunggal | Satu objek punya satu penulis; modul lain hanya memancarkan sinyal. Empat belas butir di `PRD §5.13`, ditegakkan lewat `403 CROSS_MODULE_WRITE_FORBIDDEN` (baris 119). |
| Peristiwa kanonik | Nama `modul.entitas.aksi` di katalog `ARCHITECTURE §13.1` (42 butir). Payload tidak memuat PII yang tidak dibutuhkan konsumen. |
| `hiddenByDesign` | Keadaan layar yang menyatakan isi sengaja tidak ditampilkan (M-36 kasus PPKS, M-41 rekam medis), bukan error dan bukan `disabled`. |
| Transport, bukan pemilik fakta | Peran M-08 (SISTER) dan adapter kirim mana pun: menyimpan kemasan, watermark, dan jejak kirim; tidak pernah memiliki angka yang dikirim. |
| Irisan `M47-*` | Penomoran pelaksanaan sembilan irisan di `ROADMAP §2.20`. Tidak menggantikan `R-*`/`W-*`/`SPE-*`/`MDE-*`; ia menunjuk kombinasinya. |

## 11. Leksikon kanal vicon (audit dewan 2026-10-21)

| Istilah | Arti yang dipakai di dokumen ini |
|---|---|
| Kanal vicon | Transport pertemuan daring. Enam nilai sah (`conference_provider`): `BUILTIN_LMS`, `BBB`, `JITSI`, `GOOGLE_MEET`, `MICROSOFT_TEAMS`, `ZOOM`. Rumah: `DATA_MODEL §21.10.1`. Kanal **bukan** pemilik fakta (`INTEGRATIONS §6.2`). |
| Fallback chain | Urutan kanal percobaan, parameter `conference.fallback_chain` (kelas `TECHNICAL`, empat-mata + MFA). Bukan daftar prioritas tersembunyi di kode. |
| Bukti kanal | Baris `attendance_channel_evidence` (`0074`) berisi `join_seconds`, `session_seconds`, `ratio`, dan flag `degraded`. Bukti, bukan vonis. |
| `HADIR_ONLINE` | **Label proyeksi**: `attendance_status = PRESENT` ∧ kanal ∈ register ∧ `ratio ≥ attendance.online_min_join_ratio`. Bukan nilai enum baru; tag Feeder-nya `O` (kamus belum di-*seed* → tidak ikut kirim). Lihat `PRD §5.15.3`. |
| `review_state` | Penanda banding pada `attendances` (`NONE`/`PENDING`/`GRANTED`/`REJECTED`, `0074`). Mengganti salah paham "`PENDING_REVIEW` sebagai status kehadiran" (`RD-70`). |
| Turun-mutu (`degraded`) | Keadaan ketika hanya laporan vendor yang ada (kanal internal mati) atau laporan basi. Angka tampil dengan flag, **tidak dapat dikunci** sebagai angka akademik (`BR-VIC-02`). |
| Kosakata kalah | Token lama yang masih dibaca tetapi ditolak saat tulis: `TEAMS`, `BUILTIN`, `HYBRID`, `OFFLINE`, `ONLINE_SYNC`, `ONLINE_ASYNC`, `MEET` (kanal kontak). Register: `DATA_MODEL §21.10.2`. |
| `x` kanal tanpa kunci vendor | `BUILTIN_LMS`, `BBB`, `JITSI` pada jalur *self-host*: nol API vendor, tetap butuh kredensial internal (mis. `BBB_API_SECRET`) yang disimpan di ENV/vault (`ENV_CONTRACT §7`). |

## 12. Istilah tata kelola, paket dan pembuktian Fase 1

| Istilah | Makna kanonik |
|---|---|
| Tier tata kelola IT | Platform SICA (`R-1`) dan IT tenant (`R-2`); bukan hierarki pewarisan hak bisnis. BAAK/BAUK/HRD/dekan/dosen/mahasiswa adalah pengguna operasional |
| Pemberian lisensi | Hak komersial per tenant pada `tenant_modules`, diberikan platform; berbeda dari permission RBAC dan pilihan menu |
| Release flag | Pengendalian rilis kode yang sudah dideploy oleh platform; tidak menjual atau memberikan lisensi |
| Preferensi lokal | Opt-out tenant dalam batas lisensi/release; menyalakannya tidak dapat melampaui kedua gerbang induk |
| Paket dagang | Penawaran bundel yang dipetakan ke `plans`/`plan_modules` dan katalog `modules`; label sembilan paket bukan sembilan kode modul baru |
| Billing SaaS | Tagihan SICA kepada kampus, M-01; berbeda dari tagihan kampus kepada mahasiswa dan ledger M-10 |
| Alias entitas | `tenant_subscriptions`, `tenant_module_entitlements`, `addon_packages`, `sha256_audit_logs`, `pii_privacy_requests` mengikuti DATA_MODEL §12.6; tidak membuat fisik kedua |
| CSP penjadwalan | Constraint Satisfaction Problem, berbeda dari Content Security Policy. AC-3 menyaring domain kandidat; bukan jaminan solusi optimal tanpa pencarian dan bukti batas |
| Zero-downtime deployment | Target kontinuitas layanan yang dibuktikan staging/failover/drain; bukan jaminan tidak ada lock PostgreSQL |
| Stateless application | Instance web tidak menjadi satu-satunya pemilik sesi/pekerjaan; sesi aktual tersimpan PostgreSQL, Redis target akselerator/koordinasi yang punya kontrak pemulihan |
| Tamper-evident | Perubahan dapat dideteksi terhadap hash/jangkar tepercaya; bukan mustahil diubah pemilik infrastruktur dan bukan zero-knowledge |
| LOCK spesifikasi | Keputusan berbukti tentang konsistensi dan kelengkapan spesifikasi; tidak menggantikan tes, migrasi, approval permission, legal review atau bukti produksi |
| Lima lensa audit | Arsitektur, keamanan, bisnis, QA dan DevOps sebagai perspektif review internal; bukan konsultasi pakar eksternal yang benar-benar terjadi |
