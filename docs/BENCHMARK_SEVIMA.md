# SICA — Benchmark Sevima & Spesifikasi Modul Administrasi (Master Data)

| | |
|---|---|
| **Status** | Aktif — benchmark parsial; field-level parity dan verifikasi sumber masih terbuka |
| **Tanggal** | 2026-10-22 |
| **Pemilik** | Principal Lead Architect / SIAKAD Domain Analyst |
| **Rujukan** | [PRD.md](file:///c:/SICA/docs/PRD.md) · [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md) · [API_SPEC.md](file:///c:/SICA/docs/API_SPEC.md) · [UI_UX_DESIGN.md](file:///c:/SICA/docs/UI_UX_DESIGN.md) · [ROADMAP_TASKS.md](file:///c:/SICA/docs/ROADMAP_TASKS.md) · [AGENTS.md](file:///c:/SICA/AGENTS.md) |
| **Cakupan** | (1) peran, (2) menu per peran, (3) katalog modul, (4) data master & pendukung, (5) flow/alur — Sevima vs SICA |

---

## 0. Mengapa dokumen ini ada

SICA diposisikan sebagai pengganti SIAKAD legacy kampus Indonesia, dan tolok ukur lapangan yang paling banyak dipakai adalah **Sevima** (SEVIMA Platform / siAkadCloud, GoFeeder & ProFeeder, EdLink, CBT, SPMB/PMB, Finance Cloud, SIM Kepegawaian, Karirlink, SPMI, Litabmas — lihat §2A.1 untuk penamaan resmi). Permintaan eksplisit: **pelajari seluruh dokumentasi Sevima** (direktori produk, penjelasan, panduan/manual), lalu tuangkan hasilnya sebagai catatan resmi supaya:

1. Peta **peran → menu → modul → data master → flow** SICA lengkap sebelum satu baris kode Admin ditulis.
2. Ada **selisih (gap) yang jujur** antara apa yang Sevima punya dan apa yang SICA sudah implementasi.
3. Prioritas pengerjaan Area Admin (dimulai dari **Data Master**) punya dasar, bukan asumsi.

## 0.0 Status Audit & Batas Kesimpulan

Dokumen ini merupakan benchmark kerja, **bukan bukti bahwa SICA telah mencapai 100% paritas atau superioritas** terhadap seluruh produk SEVIMA. Cakupan sumber, versi panduan, form, field, perilaku, dan alur perlu diverifikasi secara eksplisit sebelum kesimpulan tersebut dapat dibuat. Halaman panduan resmi yang menjadi titik awal riset adalah https://sevima.com/panduan/; setiap klaim harus ditautkan ke panduan spesifik dan diberi tingkat keyakinan sesuai metodologi §0.1.

Belum tersedia matriks field-by-field yang menautkan setiap form/field SEVIMA ke kontrak API, kolom/constraint DDL, layar SICA, dan bukti implementasi. Kesiapan modul yang terukur juga bukan kesiapan sistem: [AUDIT_READINESS.md](file:///c:/SICA/docs/AUDIT_READINESS.md) §20 menjelaskan status per modul dan gerbang global, sementara [ROADMAP_TASKS.md](file:///c:/SICA/docs/ROADMAP_TASKS.md) §2.33 DOC-1 masih terbuka. Karena itu, tidak boleh disimpulkan bahwa semua gap sudah ditutup atau SICA sudah melampaui SEVIMA.

Temuan yang tervalidasi harus ditambahkan ke spesifikasi terkait melalui protokol kaskade; item yang belum diverifikasi harus tetap ditandai sebagai gap/pertanyaan, bukan diklaim selesai. Status dokumen benchmark tetap aktif dan belum dikunci.

### 0.1 Metodologi & tingkatan keyakinan
Setiap klaim di dokumen ini diberi penanda sumber:

| Penanda | Arti |
|---|---|
| `[DOK]` | Dikutip dari dokumentasi/manual resmi Sevima atau kamus data PDDikti |
| `[PUB]` | Halaman pemasaran / deskripsi produk Sevima |
| `[PIHAK-KETIGA]` | Panduan kampus pengguna, forum, artikel pihak ketiga |
| `[INF]` | Kesimpulan kami dari pola umum SIAKAD Indonesia — **wajib diverifikasi sebelum dijadikan kebutuhan** |
| `[KODE]` | Kondisi SICA terverifikasi dari repositori (skema Drizzle / `tsc` / rute Next.js) |

> **Disiplin audit:** tidak ada klaim Sevima yang kami tandai `[DOK]` bila sumbernya hanya halaman pemasaran. Bila tidak terbukti, kami tulis `[INF]` dan jadikan pertanyaan, bukanrequirements.

---

## 1. Kondisi SICA — baseline snapshot 2026-10-19 (bukan status terkini)

Bagian ini merekam baseline repositori saat riset awal pada 2026-10-19. Angka `[KODE]` di bawah tidak boleh dibaca sebagai keadaan SICA hari ini; gunakan pemeriksaan repo bertanggal atau alat pemilik yang dirujuk di bagian terkait untuk status terkini. Kolom kerja §2.10 memiliki pengukuran tersendiri bertanggal 2026-10-21 dan juga hanya mengukur dimensi yang disebut di sana.

### 1.1 Tabel yang SUDAH ada sebagai kode Drizzle `[KODE]`
Terverifikasi dari `packages/database/src/schema/*.ts` — **45 tabel unik** (dihitung `grep -c pgTable(` per berkas pada 2026-10-19; angka "25" pada versi awal dokumen ini salah dan sudah dibetulkan, bersama hilangnya kelompok RBAC dari daftar):

| Gugus | Tabel |
|---|---|
| Platform & identitas | `tenants`, `tenant_domains`, `plans`, `subscriptions`, `tenant_quotas`, `tenant_usage`, `users`, `password_history`, `tenant_memberships`, `sessions`, `refresh_tokens`, `mfa_factors` |
| Master akademik | `organizations`, `academic_years`, `academic_periods`, `study_programs`, `grade_scales`, `grade_scale_bands`, `curricula`, `courses`, `rooms` |
| Personel & biodata | `students`, `lecturers`, `staff`, `student_addresses`, `student_guardians` |
| Kelas & pembelajaran | `classes`, `class_assignments`, `class_schedules`, `class_sessions`, `class_waitlists` |
| Penilaian & presensi | `enrollments`, `attendances`, `grade_components`, `grades`, `grade_corrections` |
| Entitlement modul | `modules`, `module_dependencies`, `plan_modules`, `tenant_modules` |
| RBAC ber-scope (`schema/rbac.ts`, ditulis sebagai `0011_rbac_scoped.sql`) | `roles`, `permissions`, `role_permissions`, `user_role_assignments`, `access_change_requests` |

### 1.2 Objek yang HANYA ada di dokumen, belum jadi tabel `[KODE]` vs [DATA_MODEL §5]
Ini pekerjaan wajib Area Admin, karena menu Admin tidak bisa dibentuk tanpa objeknya:

| # | Objek | Fungsi di menu Admin | Dampak bila belum ada |
|---|---|---|---|
| A-1 | `academic_calendar_events` | **Kalender Akademik** (tanggal kunci per periode, termasuk tenggat laporan PDDikti BR-R9) | Tidak ada "buka/tutup jendela" terstruktur; deadline diatur manual |
| A-2 | `course_prerequisites` | **Prasyarat Mata Kuliah** (BR-A3, BR-A16) | Validasi prasyarat KRS tidak bisa ditegakkan per matakuliah |
| A-3 | `blockades` | **Cekal** — enam dimensi `clearance_dimension` (ACADEMIC/FINANCE/LIBRARY/LAB/STUDENT_AFFAIRS/ADMINISTRATIVE; lihat DATA_MODEL §15.2), bukan "4 dimensi" (BR-A7, FR-AKA-10) | Gerbang blokir hanya asumsi; tidak bisa menegah KRS/yudisium |
| A-4 | `academic_rules` | **Pengaturan Akademik per Prodi-Periode** (FR-AKA-12) — padanan "Setting Akademik" di SIAKAD lain | Semua ambang (band SKS, gerbang, denda) tidak bisa dikonfigurasi per kampus → memaksa fork kode, melanggar prinsip P4 |
| A-5 | `student_status_history` | **Status Mahasiswa** (aktif/cuti/DO/pindah/lulus) + riwayat | Perubahan status tak teraudit; feeder riwayat akademik mustahil |
| A-6 | ~~`permissions`, `roles`, `role_permissions`, `user_role_assignments`, `access_change_requests`~~ | **Hak Akses** & penugasan role ber-scope (prodi/periode/kelas) | **DIREVISI 2026-10-19 — kelima objek ini SUDAH jadi tabel**: skema Drizzle di `packages/database/src/schema/rbac.ts` + tulis sebagai `0011_rbac_scoped.sql` (222 izin, 15 peran/tenant, 607 grant). Yang belum adalah **penerapannya ke database** (`G-02`), jadi pada kondisi saat ini RBAC masih enum 5 nilai `tenant_memberships.role` tanpa scope → Kaprodi prodi A belum terbedakan dari prodi B |
| A-7 | `audit_logs` (+ `audit_chain_head`) | **Log Aktivitas** (FR-AUD-01) | Klaim "ter-audit" belum punya target penyimpanan di kode |
| A-8 | `outbox`, `idempotency_keys` | Notifikasi & pengulangan aman | Event notifikasi/worker belum ter-persist |
| A-9 | `fee_tariff_groups`, `fee_components`, `invoices`, `invoice_items`, `payments`, `invoice_installments`, `deposits`, `ledger`, `payment_waivers`, `clearances` | **Modul Keuangan** (FR-KEU-*) | Gerbang KRS berbasis lunas (J2) belum bisa dijalankan |
| A-10 | `pddikti_mappings`, `pddikti_sync_runs`, `period_reopen_requests`, `pddikti_correction_requests` | **Feeder PDDIKTI** (FR-FDR-*) | Kepatuhan nasional belum tersimpan |
| A-11 | `graduation_records`, `document_signatures`, `retention_rules`, `data_processing_bases`, `data_subject_requests` | Yudisium/ijazah & kepatuhan UU PDP | Fase berikutnya; perhatikan defek AUD-09 (tabel rangkap di dokumen) |
| A-12 | `tenant_settings` (NIM format, penomoran surat, logo, timezone) | **Pengaturan Institusi** | Konvensi penomoran per kampus (PRD §9.2.8) tak tersimpan |

### 1.3 Permukaan aplikasi web saat ini `[KODE]`
- Halaman `(dashboard)`: `dashboard`, `academic/krs`, `academic/khs`, `academic/advisor` — semuanya sudut pandang **mahasiswa/dosen**.
- Rute API: `auth/*` (login, mfa, refresh, logout, me), `academic/*` (krs open-classes/submit/approve, khs, transcript, grading), `attendance/qr/{generate,scan}`, `tenant/modules/*`, `health*`.
- **Area Admin: NOL.** Tidak ada menu, tidak ada halaman, tidak ada rute, dan **tidak ada satu pun kontrak Zod CRUD master data** di `packages/contracts` (yang ada hanya kontrak transaksional: KRS, grading, presensi, biodata).
- Navigasi `components/layout/top-nav.tsx` Velzon horizontal 2-baris: Dashboard · Akademik · Lainnya; item tanpa halaman diberi badge "Segera".

**Konsekuensi:** master data hari ini hanya bisa diisi lewat skrip seed (`apps/web/src/scripts/dev-seed-academic.ts`). Kampus tidak bisa mengatur sendiri — padahal "mandiri kelola tanpa vendor" adalah titik jual utama terhadap SIAKAD legacy.

---

## 2. Benchmark Sevima

> Sumber primer: **SEVIMA Pusat Bantuan** (`knowledge.sevima.com`), **Buku Panduan SIM Akademik** (PDF resmi ber-copyright PT Sentra Vidya Utama, diunggah umegabuana.ac.id), **Siakad Lite** & **GoFeeder Knowledgebase** (`sites.google.com/sevima.com`), changelog Sevima Platform Juli & September 2026. Penanda sumber lihat §0.1.

### 2.0 Temuan struktur: Sevima TIDAK punya satu "aplikasi admin"
`[DOK]` Admin login ke **SEVIMA Platform** (SSO, domain `<pt>.siakadcloud.com`), **memilih role**, lalu masuk ke **modul**. Jadi "area admin" Sevima = irisan dari beberapa modul, bukan satu menu Admin. Modul yang tersedia: `Akademik`, `Keuangan Akademik`, `Seleksi Penerimaan Mahasiswa Baru (SPMB/PMB)`, `Computer Based Test (CBT)`, `Kepegawaian`, `Tracer Alumni`, `Administrasi Aplikasi`, `MBKM`, `Edlink` (LMS), `Profeeder/Gofeeder`, `Akreditasi Cloud`, `SPMI`, `Litabmas`, `SIM Kerjasama`, `Karirlink/MauKuliah`, `Dashboard Pimpinan`.
→ **Implikasi untuk SICA:** kita tetap pakai **satu Area Admin dengan gugus menu stabil** (`/admin/**`) yang disaring entitlement modul, karena titik lemah Sevima justru perpindahan modul & duplikasi jalur (lihat §2.9).

### 2.1 Modul `Administrasi Aplikasi` — console Admin PT `[DOK]`
| Menu | Sub-menu / isi |
|---|---|
| `Dashboard` | widget **Statistik Login Pengguna** (hari ini + 30 hari, rincian browser) |
| `Pengguna` | `Unit Kerja`, `User`, `Role` (Non Admin / Admin Pengguna / Admin Edlink / Admin Aplikasi), `Hak Akses` |
| `Log` | `Log Login`, `Log Tabel`, `Log Transaksi` |
| `Pengaturan` | `Aplikasi` (Perguruan Tinggi, PMB, halaman login + favicon + `page_background`, Email/SMTP, Plugin/Addon, Label), `Data Backup` (Excel), `File Backup`, `Kustomisasi` → `Form`, `Kolom Data Master`, `Laporan`, `Penandatanganan` |
| `Laporan` | `Daftar User`, `Log Login` |
| **(aksi)** | **`Login As`** — admin masuk sebagai akun user untuk debugging |

Sumber: [Manajemen Pengaturan Aplikasi oleh Admin PT](https://knowledge.sevima.com/manajemen-pengaturan-aplikasi-sevima-platform-oleh-admin-pt/), [Fitur Log dan Laporan](https://knowledge.sevima.com/fitur-log-dan-laporan-pada-modul-administrasi-aplikasi/), [Modul Administrasi Aplikasi](https://knowledge.sevima.com/f-modul-administrasi-aplikasi/).

### 2.2 Modul `Akademik` — 5 top-menu `[DOK]`
```
Portal        → Mahasiswa · Pegawai
Perkuliahan   → Data Kurikulum · Data Kelas · Administrasi · Data Tugas Akhir
                · Kegiatan Pendukung · Integrasi PD-DIKTI
Data Pelengkap→ (master data, lihat §2.3 — 6 kategori)
Laporan       → (report builder + cetak)
Setting       → Setting Prodi · Periode Akademik · Setting Aplikasi
                · Kalender Akademik · Skala Nilai · Komposisi Nilai
```
Sumber: [Modul Akademik](https://knowledge.sevima.com/a-modul-akademik/), [Cara menambahkan periode akademik](https://knowledge.sevima.com/cara-menambahkan-periode-akademik/), PDF Buku Panduan SIM Akademik.

### 2.3 `Data Pelengkap` = **Data Master** Sevima (6 kategori, nama item verbatim) `[DOK]`
| Kategori | Item |
|---|---|
| **Perguruan Tinggi** | `Data Perguruan Tinggi`, `Fakultas`, `Jurusan`, `Program Studi`, `Konsentrasi`, `Tingkat Pendidikan`, `Tingkat Pendidikan Universitas`, `Sistem Kuliah`, `Ruang Kuliah`, `Kegiatan Akademik`, `Kalender Akademik`, `Universitas Luar`, `Perusahaan`, `Contact Person`, `Instansi` (+submen `Pembimbing`) |
| **Perkuliahan** | `Unsur Nilai`, `Jenis Matakuliah`, `Kelompok Matakuliah`, `Bidang Ilmu`, `Kelas Perkuliahan`, `Slot Waktu`, `Status Hadir`, `Jenis Pertemuan`, `Jenis Kegiatan Pendukung` |
| **Biodata** | `Agama`, `Pekerjaan`, `Suku`, `Penghasilan` |
| **Mahasiswa** | `Status Mahasiswa`, `Jenis Tinggal`, `Kebutuhan Khusus`, `Transportasi` |
| **Pegawai** | `Jenis Pegawai`, `Golongan`, `Jabatan Fungsional`, `Jabatan Struktural`, `Predikat Pegawai`, `Status Keaktifan` |
| **Wilayah** | `Negara`, `Propinsi`, `Kota`, `Kecamatan` (± Kelurahan/Kodepos) |

**Field yang terdokumentasi eksplisit** (penting — ini yang harus ditandingi kelengkapannya):
- **Data PT**: `Kode Unit`, `Nama Unit`, `Nama Unit (EN)`, `Nama Singkat`, `Alamat`, `Unit/Satuan Kerja`, `Telepon`, `Akreditasi`, `No. SK Akreditasi`, `No. SP Pendirian`, `Rektor`, `Wakil Rektor 1–4` (dipakai sebagai kolom tanda tangan laporan).
- **Fakultas**: `Kode Fakultas`, `Nama`, `Nama (EN)`, `Nama singkatan`, **`Kode NIM`** untuk generate NIM dari PMB.
- **Program Studi**: filter fakultas, pejabat, `Kode NIM`, **SKS lulus minimal**, **IPK lulus minimal** (dipakai saat yudisium), `Gelar`, `Unit/Satuan Kerja` (jembatan SIAKAD↔Gate untuk autentikasi & pembatasan hak akses), `Detail Program Studi`.
- **Tingkat Pendidikan**: `Jenjang`, `Nama Tingkat Pendidikan`, `Urutan`, checkbox `Perguruan Tinggi`. **Tingkat Pendidikan Universitas**: `Masa Studi (Smt)`, `Max. Cuti (Smt)`, `Max. Studi (Smt)`.
- **Sistem Kuliah**: `Kode`, `Nama Sistem Kuliah` — mengikat ke mahasiswa; menentukan kelas yang boleh diambil saat KRS **dan** biayanya.
- **Ruang Kuliah**: `Kode`, `Nama Ruang`, `Unit`, `Lokasi`, `Kap.` (kapasitas).
- **Kegiatan Akademik**: `Kode`, `Nama`, `Backgroud` (warna penanda kalender).
- **Kalender Akademik**: `Tgl Mulai`, `Tgl Selesai`, `Keterangan`, `Libur` (akademik/nasional), filter periode + kegiatan.
- **Unsur Nilai**: `Kode`, `Nama Unsur`, `Nama Singkat`.
- **Contact Person**: `Perusahaan`, `Nama Pegawai`, `No. Telp`.
- Transaksi kurikulum ada di `Perkuliahan > Data Kurikulum`: `Tahun Kurikulum`, `Mata Kuliah`, `Kurikulum Prodi` (aksi `Salin Data`, `Cetak Silabus`, `Detail`), `Prasyarat Matakuliah`, **`Ekivalensi Mata Kuliah`**, **`Batas SKS`**.
- Entri orang: `Portal > Mahasiswa` dan `Portal > Pegawai` (tambah/hapus/cari massal/`Cetak`/detail bertab).

### 2.4 Fungsi operasional Admin (bukan CRUD master) `[DOK]`
**(a) `Setting > Setting Prodi` — per prodi per periode, 9 tab:** `Kurikulum Mahasiswa Baru`, `Biodata`, `KRS`, `Validasi KRS`, `Cetak KRS`, `KHS`, `Pengisian Nilai`, `Pengisian Kuesioner`, `Dosen Generate Pertemuan`. Isi terdokumentasi: `Buka KRS?`, `Tanggal Awal/Akhir KRS`, `Tanggal Cetak KRS`, `Buka Validasi KRS?`, `Dosen Tampil di KRS`, `Buka KHS?`, `Tanggal Awal/Akhir KHS`, `Buka Pengisian Nilai?`, `Dosen Bisa Isi Presentase Komponen?`, `Buka Cetak Kartu UTS/UAS?` + tanggalnya, `Minimal Presensi UTS/UAS`, `Buka Pengubahan Biodata?`, `Buka Kuesioner?`, `Dosen Bisa Generate Tatap Muka?`, `Jumlah Pertemuan Kuliah`, `Batas Penggantian Status Kuliah & Presensi`, `Buka Setting Ketua Kelas?`. → [Fungsi detail setting prodi](https://knowledge.sevima.com/fungsi-detail-setting-prodi-akademik/), [Manajemen Setting Prodi setiap periode](https://knowledge.sevima.com/manajemen-setting-prodi-setiap-periode-akademik/).

**(b) `Setting > Setting Aplikasi` (toggle global):** `Melengkapi Biodata Sebelum KRS`, `Tidak Bisa Mengubah Jadwal Perkuliahan`, `Tidak Bisa Melihat Nilai & Catatan Ujian Tugas Akhir`, `Daftar IP Address Untuk Presensi Perkuliahan`, `Nama Matakuliah Yang Ditampilkan Pada Transkrip`, `Nilai Mahasiswa Yang Ditampilkan Pada Transkrip`, `Menampilkan Kolom Nomor Transkrip Sementara`, `Menampilkan Poin Kemahasiswaan`. → [Setting Aplikasi Modul Akademik](https://knowledge.sevima.com/setting-aplikasi-pada-modul-akademik/).

**(c) Plotting & kelas:** `Perkuliahan > Data Kelas > Kelas Kuliah`, `Aksi > Generate Kelas` (filter `Periode Akademik`, `Prodi Pengampu`, `Kurikulum`; form `Sistem Kuliah`, `Jumlah Kelas`, `Daya Tampung`; nama kelas otomatis A/B/C), `Dosen Pengajar`, `Jadwal Perkuliahan`, `Generate Pertemuan`, `Tata Cara Salin Kelas`, **`Update Kelas Perkuliahan Massal` via Excel**, `Import Jadwal Perkuliahan`, `Monitoring Ruang`, `Rekap Penggunaan Ruang`. → [Panduan Generate Kelas](https://knowledge.sevima.com/panduan-generate-kelas/).

**(d) Status mahasiswa:** `Perkuliahan > Administrasi > Status Semester` → `Buat Status Semester` (Aktif/Cuti/Non Aktif); `Administrasi > Mahasiswa Keluar > Tambah`; `Berhenti Studi`; cuti (dengan validasi pengajuan); **`Generate Status Perwalian` otomatis dengan validasi cekal keuangan + AKM tidak lengkap + batas masa studi**; `Pindah Program Studi` / `Set Kelas/Kelompok` / `Set Kurikulum` (dialog `NIM Asal` → prodi tujuan → `NIM Tujuan`).

**(e) Nilai:** `Skala Nilai` (level PT **dan** prodi), `Komposisi Nilai` (mustahak 100%), `Pemutihan Nilai`, `Monitoring Pengisian Nilai`, perbedaan **Umumkan Nilai** vs **Kunci Nilai**, kunci/buka kunci nilai kelas **massal**, `Hitung Ulang Nilai Kelas/IPS/IPK/Transkrip`, input manual + **upload Excel**.

**(f) Keuangan** (modul `Keuangan Akademik`; top-menu `Tarif`(`Tagihan`), `Kelompok Tagihan`, `Transaksi`(`Pembayaran`, `Masuk/Keluar/Mutasi/Posting/Jurnal Umum`), `Pengaturan Awal`(`Data Pelengkap`, `Referensi Akuntansi/Anggaran/Akademik`), `Saldo Awal`, `Import`, `Anggaran`, `Integrasi Akademik`, `Laporan`, `Tutup Buku`): `Generate > Tagihan Pendaftar`, `Setting Pengaturan Tagihan pada Kelompok Tagihan`, `Setting Pengaturan Pembayaran Tagihan`, `Cara Mengatur Tarif Tagihan per Mata Kuliah`, `Import tarif tagihan menggunakan Excel`, `Manajemen UKT`, **`Fungsi Poin Pada Referensi Penghasilan untuk UKT/KIP Kuliah`**, VA/bank (mis. BTN Syariah), **`Mekanisme Cekal`**, `Tagihan Wisuda`, `Setting Tagihan Semester Pendek`. → [Siakad Lite — generate tagihan](https://sites.google.com/sevima.com/siakadlite/keuangan/tahapan-generate-tagihan-pendaftar-pada-siakad-lite), [Finance Cloud](https://knowledge.sevima.com/b-gambaran-umum-sevima-finance-cloud/).

**(g) Kemahasiswaan, kurikulum lanjutan, persuratan, kelulusan** `[DOK]`: `Kemahasiswaan > Aktivitas > Jenis Prestasi` / `Tingkat Prestasi`; `Jenis Pelanggaran`, `Kelompok Pelanggaran`, `Sanksi Pelanggaran`, `Daftar Pelanggaran`; `Jenis Beasiswa`, `Daftar Beasiswa`, `Berkas Beasiswa`; `Setting Informasi Prodi` (untuk SKPI); **OBE** (`Manajemen OBE`, CPL/CPMK, *Generate AI untuk Manajemen Capaian Kurikulum OBE*); `Aktivitas Kuliah (AKM)`; MBKM/kelas hybrid; **RPL**; `Persuratan` (`Setting Template Surat`, `Setting Penomoran Surat`, validasi pengajuan surat); `Finalisasi Mata Kuliah`; `Paket Kuliah/Pemaketan KRS`; `Predikat Kelulusan`; yudisium/wisuda (`Periode Wisuda`, `Peserta Yudisium`, `Import Peserta Yudisium` + template Excel, `Generate Penomoran Dokumen`, `Berita Acara TA` dengan variabel `judul_ta`, `nama_penguji_1`).

**(h) Lainnya:** `Login As`, `Log Tabel/Transaksi`, `Kustomisasi Laporan Mandiri`, `Data/File Backup`, MFA admin, SMTP, live chat (tawk.to), `Pengajuan Penambahan Hak Akses`, sinkron Zoom/Edlink, **integrasi Neo Feeder 3.0.1**.

### 2.5 Tabel pemetaan Feeder ↔ layar Admin Sevima (verbatim) `[DOK]`
Akses: `Pengaturan > Pemetaan Sumber` (Profeeder). 20 sumber daya:

| # | Sumber daya Feeder | Layar pemenuh di Admin Sevima |
|---|---|---|
| 1 | Status Mahasiswa | `Perkuliahan > Administrasi > Status Semester` |
| 2 | Jenis Daftar | `Modul PMB > Referensi > Pendaftaran > Jalur Daftar` ("Jenis Pendaftaran") |
| 3 | Jalur Daftar | sama ("Nama Jalur Penerimaan") |
| 4 | Jenis Keluar | `Data Pelengkap > Mahasiswa > Status Mahasiswa` |
| 5 | Jenjang Pendidikan | `Data Pelengkap > Perguruan Tinggi > Tingkat Pendidikan` |
| 6 | Jenis Mata Kuliah | `Data Pelengkap > Perkuliahan > Jenis Matakuliah` |
| 7 | Kelompok Mata Kuliah | `Data Pelengkap > Perkuliahan > Kelompok Matakuliah` |
| 8 | Jenis Aktivitas | `Data Pelengkap > Perkuliahan > Jenis Kegiatan Pendukung` + Bimbingan Akademik/Skripsi/TA/Tesis/Disertasi/Proyek Akhir |
| 9 | Jenis Prestasi | `Kemahasiswaan > Aktivitas > Jenis Prestasi` |
| 10 | Tingkat Prestasi | `Kemahasiswaan > Aktivitas > Tingkat Prestasi` |
| 11 | Agama | `Data Pelengkap > Biodata > Agama` |
| 12 | Perguruan Tinggi (asal) | `Data Pelengkap > Perguruan Tinggi > Universitas Luar` |
| 13 | Program Studi | `Modul PMB > Referensi > Pendidikan > Prodi Perguruan Tinggi` |
| 14 | Negara | `Data Pelengkap > Wilayah > Negara` |
| 15 | Wilayah | `Data Pelengkap > Wilayah > Kecamatan` |
| 16 | Pekerjaan | `Data Pelengkap > Biodata > Pekerjaan` |
| 17 | Penghasilan | `Data Pelengkap > Biodata > Penghasilan` |
| 18 | Jenis Tinggal | `Data Pelengkap > Mahasiswa > Jenis Tinggal` |
| 19 | Alat Transportasi | `Data Pelengkap > Mahasiswa > Transportasi` |
| 20 | Kebutuhan Khusus | `Data Pelengkap > Mahasiswa > Kebutuhan Khusus` |

Error feeder yang tampak di lapangan: `id_jalur_daftar tidak boleh kosong`, `id_jenis_daftar tidak boleh kosong`, `Aktivitas Tidak Boleh Kosong`, `Kecamatan tidak sama dengan database`, `Kewarganegaraan tidak boleh kosong`. Dosen wajib melengkapi tab `Kepegawaian` & tab `Dosen` (`Homebase Dosen`, `NIDN`, `NIDK`, `NUPN`); alternatif tanpa NIDN: NIDK/NUPTK/dosen praktisi. → [Pemetaan Sumber Profeeder](https://knowledge.sevima.com/pengaturan-pemetaan-sumber-pada-profeeder/), [Pelaporan Biodata](https://knowledge.sevima.com/panduan-halaman-pelaporan-biodata/), [Biodata dosen wajib](https://knowledge.sevima.com/biodata-dosen-yang-wajib-dilengkapi-pada-modul-kepegawaian/), [Pelaporan dosen ber-NUPTK](https://knowledge.sevima.com/mekanisme-pelaporan-dosen-pengajar-memiliki-nuptk-pada-profeeder/).

### 2.6 Dimensi 1 dari sisi Sevima — daftar peran yang dikirim `[DOK]`/`[PUB]`
`Admin PT`/`Administrator` (seluruh PT) · `Admin Akademik` · `Admin Prodi`/kaunit (satu prodi) · `Admin Keuangan` · `Admin PMB` · `Admin Kepegawaian` · `Operator Feeder`/`TU` · `Pimpinan` (dashboard T1/T2 + tanda tangan laporan) · `Dosen Pengampu` · `Dosen Wali/PA` · `Dosen Pembimbing/Penguji` · `Dosen Non-NIDN` · `Mahasiswa` · `Pendaftar/Camaba` · `Orang tua mahasiswa` · `Tim Penjaminan Mutu/Auditor/Auditee` (SPMI) · `Afiliator` (MauKuliah) · role halus di Administrasi Aplikasi: `Administrator Pengguna` / `Admin Edlink` / `Admin Aplikasi` · **`Login As`** · **merger akun multirole untuk SSO**.
Sumber: [Role GoFeeder](https://sites.google.com/sevima.com/knowledgebase-sevima-gofeederc/home/role), [Merger akun multirole oleh Admin PT](https://knowledge.sevima.com/cara-adminpt-merger-akun-multirole-untuk-sso-sevima-platform/).
`[INF]` Rincian izin per menu jarang dipublikasikan, sehingga kami **tidak** mengklaim tahu persis siapa boleh apa di Sevima. Yang terbukti: model perannya **multi-role + merger akun** dan pembatasan akses memakai `Unit/Satuan Kerja` + kode unit.

### 2.7 Kekuatan yang WAJIB kita tandingi (daftar fitur Sevima yang "matang")
1. **Setting Prodi 9 tab per prodi-per-periode** — granularitas pengaturan adalah alasan kampus pindah sistem sulit; ini padanan `academic_rules` kita (belum di-implementasi!).
2. **Generate massal**: Generate Kelas (A/B/C otomatis), Generate Pertemuan, Generate Status Perwalian, Generate Tagihan — operator satu klik untuk ribuan baris.
3. **Impor/ekspor Excel di hampir semua objek** + `Update Kelas Massal` via Excel + template Excel yudisium/tarif.
4. **Kustomisasi tanpa vendor** sebagian terbuka: `Kustomisasi > Form`, `Kolom Data Master`, `Laporan`, `Penandatanganan`.
5. **Dua tahap nilai** (Umumkan vs Kunci) — memisahkan pengumuman mahasiswa dan penguncian resmi.
6. **Monitoring**: `Monitoring Pengisian Nilai`, `Monitoring Ruang`, `Rekap Penggunaan Ruang`, `Statistik Login`.
7. **`Login As`** — dukungan cepat (dengan risiko keamanan, lihat §2.10).
8. **Pemetaan sumber Feeder 20 objek** — kepatuhan jadi "data", bukan kerja manual.
9. **Ekivalensi mata kuliah & RPL & Pemaketan KRS** — kasus nyata kampus (transfer kredit, maba paket).
10. **Persuratan**: template surat + penomoran + validasi pengajuan (PRD kita men-deklarasi persuratan umum out-of-scope — **perlu koreksi**, lihat §2.10 butir D-8).

### 2.8 Kelemahan Sevima yang menjadi celah diferensiasi SICA `[DOK]` (pola artikel knowledge base)
| # | Titik lemah (bukti di dokumentasi mereka) | Jawaban SICA |
|---|---|---|
| D-1 | **Ketergantungan vendor**: perubahan struktur laporan/kolom & penambahan hak akses harus lewat tiket ("Ketentuan dan Alur Permohonan Kustomisasi Laporan", "Pengajuan Penambahan Hak Akses") | Self-service: `Kustomisasi` sebagai objek ber-audit + wizard; perubahan izin oleh Admin PT dengan four-eyes, tanpa tiket |
| D-2 | **Menu overflow & duplikasi jalur**: objek sama dari banyak tempat (`Data Kelas > Tahun Ajaran` vs `Data Kurikulum > Tahun Ajaran` vs `Setting > Periode Akademik`; `Home > Setting > Setting Prodi` vs `Setting > Setting Prodi`); manual resmi sendiri salah penomoran bab | Satu IA `/admin/**` dengan penamaan objek unik + pencarian global objek + "lihat juga" eksplisit |
| D-3 | **Hapus berjenjang manual**: hampir semua form berbunyi "pastikan data terkait … sudah terhapus" (fakultas→prodi→ruang→kelas) | Pratinjau dependensi sebelum hapus (impact analysis) + nonaktifkan-soft, bukan hapus; `409 MODULE_IN_USE` sudah kita punya polanya |
| D-4 | **Puluhan artikel "kenapa tidak muncul"** (filter periode, kelas tak muncul di KRS, ruang tak muncul, tombol Generate VA hilang, dosen pengajar tak tampil, `SKS Dosen terbaca 0`) = UI tidak self-explanatory | **Panel "Kesehatan Data"** pra-go-live + status "mengapa terkunci" di setiap halaman (empty-state aktif dengan sebab + tautan perbaikan) |
| D-5 | **Validasi Feeder reaktif**: error PDDikti baru kelihatan saat pelaporan; mapping kode harus refresh manual saat kode berubah | **Pra-validasi Feeder di saat input** (validasi inline terhadap kamus kode PDDikti yang disinkron), bukan saat kirim |
| D-6 | **Kustomisasi = puluhan switch tersebar** di 9 tab Setting Prodi + Setting Aplikasi, tanpa pratinjau | Skema `academic_rules.params` (jsonb, versioned, di-set dari **templat** + **wizard 4 langkah** + pratinjau dampak + diff sebelum simpan) |
| D-7 | **Multi-tenant implisit/legacy**: `Unit/Satuan Kerja` + kode unit angka dipakai untuk autentikasi & pembatasan akses | `tenant_id` + **RLS default-deny di kernel DB**; role ber-scope eksplisit (`user_role_assignments.scope_*`) |
| D-8 | Persuratan & SKPI tercampur di modul akademik | Kita perlu **sub-modul `documents`** (template surat + penomoran + tanda tangan) — PRD §5.3 saat ini mengecualikan persuratan umum; kecualikan tetap naskah dinas non-akademik, tetapi **surat akademik** (KHS, surat keterangan aktif, legalisir, SK yudisium, berita acara) wajib di dalam lingkup |
| D-9 | `Login As` tanpa justifikasi terdokumentasi | Impersonation **hanya** dengan justifikasi + MFA + TTL pendek + tercatat `audit_logs` (PRD J6) |
| D-10 | Beban belajar tinggi (modul banyak, istilah beragam) | Onboarding per peran + bantuan kontekstual + "panduan 5 menit" tiap menu Admin |

### 2.9 Catatan integritas klaim
Yang di atas berasal dari dokumentasi resmi Sevima dan PDF panduan ber-copyright; **tidak** ditemukan review independen/pihak ketiga yang kredibel mengenai kepuasan pengguna Sevima, sehingga daftar §2.8 disusun sebagai **pola yang tampak dari dokumentasi mereka** (jumlah artikel troubleshooting, alur tiket, duplikasi jalur), bukan kutipan keluhan pelanggan. Klaim yang tidak terbukti kami tandai `[INF]`.

### 2.10 Selisih SICA ↔ Sevima pada area Admin (tabel kerja — kolom keempat dihitung alat)

**Kolom keempat bukan tulisan tangan (2026-10-21).** Ia diregenerasi oleh `node .tools/bench-admin-delta.mjs` dari empat pemeriksaan: `CREATE TABLE` di `DATA_MODEL`, rute di `API_SPEC`, alamat layar di `UI_UX`, baris katalog di `RBAC_MATRIX`, semuanya dibaca dari sel "Padanan SICA". Kolom ketiga tetap klaim manusia dari siklus-siklus sebelumnya dan sengaja tidak dihapus — pertanyaan produknya yang berguna, bukan ingatannya. Di mana keduanya bertentangan, kolom alat yang menang dan tandanya ditulis `KONTRADIKSI`.

| Objek/layanan Sevima | Padanan SICA | Status SICA (klaim manusia, siklus sebelumnya) | Ukuran alat 2026-10-21: `objek ber-DDL` · `rute` · `layar` · `izin ber-nomor` |
|---|---|---|---|
|    `Data Pelengkap` 6 kategori master    |    `/admin/master/**`    |    ❌ belum ada (skema sebagian ada, UI/API nol)    |  `DDL 0/0 · rute 1/1 · layar 1/1`  |
|    `Status Hadir`, `Jenis Pertemuan`, `Slot Waktu`, `Unsur Nilai`, `Jenis Matakuliah`, `Kelompok Matakuliah`, `Bidang Ilmu`    |    tabel data referensi (§5.1 M-17)    |    ❌ belum ada tabel    |  `tidak terpetakan alat (sel tidak menyebut objek/alamat/kode yang dikenali)`  |
|    `Wilayah` (Negara/Propinsi/Kota/Kecamatan/Kelurahan)    |    `student_addresses.*Code`    |    ◐ kolom ada, **kamus wilayah belum ada**    |  `DDL 1/1 · rute 0/0 · layar 0/0`  |
|    `Biodata > Agama/Pekerjaan/Suku/Penghasilan`    |    enum `income_band` saja    |    ◐ sebagian (`incomeBand`), agama/pekerjaan/suku masih teks bebas    |  `DDL 0/1 (tanpa DDL: income_band) · rute 0/0 · layar 0/0`  |
|    `Status Mahasiswa` + `Jenis Keluar` (feeder)    |    `student_status` enum + `feederStatusCode`    |    ◐ enum ada, **riwayat & kamus jenis keluar belum** (P-10)    |  `DDL 0/1 (tanpa DDL: student_status) · rute 0/0 · layar 0/0`  |
|    `Setting Prodi` 9 tab per prodi-periode    |    `academic_rules.params`    |    ❌ tabel belum dibuat → **prioritas ADM-6**    |  `DDL 1/1 · rute 0/0 · layar 0/0 ⟶ KONTRADIKSI: objek terukur ada, klaim manusia berkata belum`  |
|    `Setting Aplikasi` toggle global    |    `tenant_settings`    |    ❌ belum dispesifikasi    |  `DDL 1/1 · rute 0/0 · layar 0/0 ⟶ KONTRADIKSI: objek terukur ada, klaim manusia berkata belum`  |
|    `Periode Akademik` + buka/tutup    |    `academic_periods.status`    |    ✅ skema ada, ❌ UI/API belum    |  `DDL 1/1 · rute 0/0 · layar 0/0 ⟶ KONTRADIKSI: objek terukur ada, klaim manusia berkata belum`  |
|    `Kalender Akademik` (+ `Libur`)    |    `academic_calendar_events`    |    ❌ tabel belum dibuat (dok §5 ada)    |  `DDL 1/1 · rute 0/0 · layar 0/0 ⟶ KONTRADIKSI: objek terukur ada, klaim manusia berkata belum`  |
|    `Skala Nilai` level PT & prodi    |    `grade_scales`+`grade_scale_bands` per kurikulum    |    ✅ ada (model sedikit beda: per kurikulum, bukan per prodi)    |  `DDL 2/2 · rute 0/0 · layar 0/0`  |
|    `Komposisi Nilai` (mustahak 100%)    |    `grade_components` + AC-NIL-4    |    ✅ skema & aturan ada, ❌ UI Admin belum    |  `DDL 1/1 · rute 0/0 · layar 0/0 ⟶ KONTRADIKSI: objek terukur ada, klaim manusia berkata belum`  |
|    `Generate Kelas` massal    |    service baru (`ADM-5`)    |    ❌    |  `tidak terpetakan alat (sel tidak menyebut objek/alamat/kode yang dikenali)`  |
|    `Generate Pertemuan` (lewati libur)    |    `class_sessions` sudah ada    |    ◐ tabel ada, generator belum    |  `DDL 1/1 · rute 0/0 · layar 0/0`  |
|    `Update Kelas Massal` via Excel / `Import Jadwal`    |    jalur impor (`ADM-9`)    |    ❌    |  `tidak terpetakan alat (sel tidak menyebut objek/alamat/kode yang dikenali)`  |
|    `Plotting Dosen` + `SKS Dosen`    |    `class_assignments`    |    ✅ skema, ❌ guardrail BR-A11 di UI    |  `DDL 1/1 · rute 0/0 · layar 0/0 ⟶ KONTRADIKSI: objek terukur ada, klaim manusia berkata belum`  |
|    `Status Semester` massal + `Generate Status Perwalian`    |    `student_status_history` + DPA assignment    |    ❌    |  `DDL 1/1 · rute 0/0 · layar 0/0 ⟶ KONTRADIKSI: objek terukur ada, klaim manusia berkata belum`  |
|    `Pindah Program Studi` (NIM asal→tujuan)    |    alur khusus    |    ❌    |  `tidak terpetakan alat (sel tidak menyebut objek/alamat/kode yang dikenali)`  |
|    `Umumkan Nilai` vs `Kunci Nilai`    |    `grade_status` (`DRAFT`/`SUBMITTED`/`EFFECTIVE`)    |    ✅ model ada, perlu dipetakan istilah UI    |  `DDL 0/1 (tanpa DDL: grade_status) · rute 1/1 · layar 1/1`  |
|    `Pemutihan Nilai`, `Hitung Ulang IPS/IPK/Transkrip`    |    service recalculation    |    ◐ kalkulator ada, endpoint recalc belum    |  `tidak terpetakan alat (sel tidak menyebut objek/alamat/kode yang dikenali)`  |
|    `Ekivalensi Mata Kuliah`, `RPL`, `Pemaketan KRS`    |    belum ada    |    ❌ (tambah backlog)    |  `tidak terpetakan alat (sel tidak menyebut objek/alamat/kode yang dikenali)`  |
|    `Monitoring Pengisian Nilai`/`Ruang`    |    dashboard admin    |    ❌    |  `tidak terpetakan alat (sel tidak menyebut objek/alamat/kode yang dikenali)`  |
|    `Kelompok Tagihan`, `Tarif`, `Generate Tagihan`, `Cekal`, `Tutup Buku`    |    modul `finance` (skema dok §5)    |    ❌ tabel & UI    |  `tidak terpetakan alat (sel tidak menyebut objek/alamat/kode yang dikenali)`  |
|    `Persuratan` (template + penomoran + TTE)    |    `document_signatures` + sub-modul dokumen    |    ◐ dok saja    |  `DDL 1/1 · rute 0/0 · layar 0/0`  |
|    OBE (CPL/CPMK, pemetaan capaian)    |    FR-P2-13    |    ❌ Phase 2    |  `tidak terpetakan alat (sel tidak menyebut objek/alamat/kode yang dikenali)`  |
|    `Login As`    |    impersonation ter-audit (PRD J6)    |    ❌    |  `tidak terpetakan alat (sel tidak menyebut objek/alamat/kode yang dikenali)`  |
|    `Log Tabel`/`Log Transaksi`    |    `audit_logs`    |    ❌ tabel belum dibuat di kode    |  `DDL 1/1 · rute 0/0 · layar 0/0 ⟶ KONTRADIKSI: objek terukur ada, klaim manusia berkata belum`  |
|    `Kustomisasi Form/Kolom/Laporan`    |    meta-konfigurasi per tenant    |    ❌ (backlog produk penting)    |  `tidak terpetakan alat (sel tidak menyebut objek/alamat/kode yang dikenali)`  |
|    Neo Feeder 20 pemetaan sumber    |    `pddikti_mappings`    |    ❌ tabel belum dibuat    |  `DDL 1/1 · rute 0/0 · layar 0/0 ⟶ KONTRADIKSI: objek terukur ada, klaim manusia berkata belum`  |
---

## 2A. Lapisan kedua riset Sevima (portofolio, pengemasan, model hak akses)

Metode lapis kedua: 16 pencarian web + 18 fetch halaman dokumentasi. Catatan metodologi: PDF penawaran di `sevima.com` tidak selalu bisa diekstraksi; angka harga diambil dari halaman harga langsung.

### 2A.1 Koreksi nama produk `[DOK]`
Struktur Sevima **bukan** "produk bernama singkatan". Tidak ditemukan bukti publik untuk *SIAKAD-ST* atau *"Siakad Next"* sebagai nama resmi, dan **Neo Feeder adalah aplikasi milik PDDikti**, bukan produk Sevima — produk Sevima di jalur itu adalah **GoFeeder/ProFeeder**. Nama terverifikasi: **SEVIMA Platform / siAkadCloud**, **SEVIMA GoFeeder / GoFeeder Cloud**, **ProFeeder**, **Siakad Lite / SEVIMA Platform Lite**, **EdLink**, **CBT / CBT V2**, **SPMB-PMB / PMB V2 / RPL New Generation**, **SEVIMA Pay + EduFin/FinanceCloud**, **AkreditasiCloud**, **SPMI/SPME**, **SIM Kepegawaian**, **Karirlink**, **Litabmas**, **MBKM**, **SIMKERMA**, **Persuratan**, **E-Sign**, **Dashboard Pimpinan**, **MauKuliah**, **Sevima University** (training & sertifikasi, SSO satu akun).
> §0 dokumen ini telah dikoreksi mengikuti temuan ini.

### 2A.2 Direktori dokumentasi resmi (indeks yang kita jadikan acuan) `[DOK]`
- **Indeks kategori**: [knowledge.sevima.com](https://knowledge.sevima.com/) memakai kategori berhuruf **A–V** (A. Gambaran Umum, A. Modul Akademik, B. Keuangan/Finance Cloud, F. Modul Administrasi Aplikasi, H. Profeeder, dst.) — **satu-satunya "directory" resmi**; dokumen Admin PT di halaman [Manajemen Pengaturan Aplikasi oleh Admin PT](https://knowledge.sevima.com/manajemen-pengaturan-aplikasi-sevima-platform-oleh-admin-pt/) adalah rujukan terlengkap yang kami temukan.
- **7 stream changelog terpisah**: Product, V2, Administrasi Aplikasi, PMB, SPMI v10.1, Akademik, Dashboard Pimpinan + varian **PMB V2 / CBT V2 / RPL New Generation** yang hidup berdampingan → sinyal beban training & kompleksitas versi (`[DOK]`, juga `[INF]` untuk interpretasinya).
- Panduan per kampus: [Modul Sevima — BAAK UPGRISBA (16 modul)](https://baak.upgrisba.ac.id/page/modul-sevima), [Modul SiakadCloud STPM Santa Ursula](http://stpmsantaursula.ac.id/modul-siakadcloud-sevima/), [Buku Panduan SIM Akademik PDF](https://umegabuana.ac.id/wp-content/uploads/2025/01/Pedoman-SIM-Akademik.pdf).

### 2A.3 Peta modul Sevima → modul SICA (19 modul entitlement)
| Modul Sevima | Fungsi | Modul SICA | Status SICA |
|---|---|---|---|
| SEVIMA Platform / siAkadCloud (Akademik) | SIAKAD inti | `academic`+`teaching`+`enrollment`+`assessment`+`attendance` | ✅ skema; ◐ UI hanya sisi mahasiswa/dosen |
| Administrasi Aplikasi | console Admin PT (user, hak akses, log, pengaturan, kustomisasi, backup) | `identity`+`audit` | ❌ **belum ada area admin** |
| Keuangan Akademik / FinanceCloud / SEVIMA Pay | tarif, tagihan, VA, jurnal, tutup buku | `finance` | ❌ tabel & UI |
| GoFeeder / ProFeeder | pelaporan PDDikti, pemetaan sumber, AKM | `feeder_pddikti` | ❌ |
| SPMB / PMB / PMB V2 / RPL | pendaftaran, seleksi, berkas UKT, pembatalan NIM | `pmb` (addon) | ❌ |
| CBT / CBT V2 / CBT AI | bank soal, proctoring, auto-grading | `cbt` (addon) | ❌ |
| EdLink (LMS) | kelas virtual, gamifikasi, tarik nilai ke SIAKAD | `lms` (addon) | ◐ desain ADR-?/ARCHITECTURE §8 |
| SIM Kepegawaian | BKD, cuti, absensi pegawai, portofolio dosen | `hr_bkd` (addon) | ◐ `lecturers`/`staff` sudah ada |
| SPMI / AkreditasiCloud | 4 dokumen mutu, AMI, RTM, instrumen | `spmi` (addon) | ❌ |
| Litabmas | penelitian/pengabdian, LPPM, reviewer | (belum masuk katalog) | ❌ **tambah ke katalog modul** |
| Karirlink / Tracer Alumni / SKPI / PIN Ijazah | tracer, IKU, ijazah | `graduation`+`tracer_iku` (addon) | ❌ |
| MBKM | log book, kelas merdeka | `mbkm` (addon) | ❌ |
| SIMKERMA, Persuratan, E-Sign, MauKuliah | kerjasama, surat, TTE, portal publik | sebagian `documents` (belum jadi modul) | ❌ **tambah modul `documents`** usulan |
| Dashboard Pimpinan | section T1/T2 | reporting | ◐ dashboard mahasiswa/dosen saja |

**Kesimpulan:** katalog 19 modul SICA **setara dalam cakupan akademik** tetapi **kurang 2–3 modul** dibanding Sevima: `litabmas`, `documents`/`persuratan`(+`esign`), dan `kerjasama`. Ini harus masuk ROADMAP §1.5 (katalog modul) — bukan sebagai kode, tapi sebagai keputusan produk yang tercatat.

### 2A.4 Model pengemasan & harga Sevima `[DOK]` `[PUB]`
| Paket | Harga/bulan | Kapasitas |
|---|---|---|
| Growth | Rp10 jt | < 2.000 mhs |
| Business | Rp17 jt | < 4.000 mhs |
| Professional | Rp25 jt | < 7.000 mhs |
| Premium | Rp45 jt | < 12.000 mhs |
| Enterprise | Rp120 jt | > 12.000 mhs (+ 2 Account Manager dedicated, ProFeeder, Dashboard Executive) |
Add-on: **e-Sign Rp3 jt/bln** (mulai Professional), **PPG Rp4 jt/bln per 1.000 mahasiswa PPG**; akuntansi keuangan = kontrak terpisah. PDF 2024/2025 memakai tier LITE/STARTER/BASIC/GROWTH/BUSINESS/PROFESSIONAL/PREMIUM/ENTERPRISE. Lisensi = **per kapasitas mahasiswa per bulan**, bukan per user seat. Katalog pemerintah: [Professional (EXT) Rp21.616.000](https://katalog.inaproc.id/sentra-vidya-utama/sevima-platform-paket-professional-ext).
**Gating berbasis paket terbukti di dokumentasi:** *"fitur kemahasiswaan ini hanya tersedia pada paket Business ke atas"*, sub-menu `Pengaturan` *"disesuaikan dengan paket yang dimiliki"*.
→ **Posisi SICA:** lisensi per modul/seat mengikuti kontrak entitlement; **platform satu-satunya otoritas penerbit/perubah lisensi**. `/admin/modul` tenant hanya membaca hak dan melakukan opt-out dalam batas hak yang sudah diberikan, bukan self-service escalation. Metering/desain objek bukan bukti lisensi atau billing deployed.

### 2A.5 Aspek hosting/multi-tenant Sevima `[DOK]` `[PUB]`
Domain per kampus: `<kampus>.siakadcloud.com`, `<kampus>.sevimaplatform.com`, `<kampus>.gofeedercloud.com`, `<kampus>.karirlink.id` (contoh live: universitaswidyatama, universitaspawyatandaha, insipemalang). Klaim infrastruktur [sevima.com/hosting](https://sevima.com/hosting/): **server di Indonesia**, **"dedicated, tidak dibagi tenant lain"**, 1 IP publik, akses root/SSH, pemulihan <15 menit, **SLA uptime 99,9%**, migrasi penuh; tersedia juga jalur on-premise/VPS.
→ Penawaran hosting dedicated tidak membuktikan topologi database semua produk SEVIMA. Subdomain bukan bukti isolasi DB dan kita tidak memiliki akses runtime untuk menyimpulkannya.
1. SICA menargetkan RLS default-deny multi-tenant; keamanan, biaya dan waktu provisioning memerlukan pengukuran tersendiri, bukan disimpulkan dari pola arsitektur.
2. Angka SLA penawaran hanya pembanding dokumenter. Perubahan SLO/RTO SICA harus diputus pemilik PRD/deployment berdasarkan kebutuhan, biaya dan drill terukur, bukan dinaikkan otomatis untuk mengalahkan angka pemasaran.

### 2A.6 Model hak akses Sevima — **adopt pola izinnya** `[DOK]`
- Tingkatan admin pada Administrasi Aplikasi: **Non Admin** (tidak punya akses modul), **Admin Pengguna** (Dashboard, Pengguna, Laporan saja), **Admin Edlink**, **Admin Aplikasi** (Dashboard, Pengguna, Log, Pengaturan, Laporan, Login As). Catatan resmi: *"Menu Login As hanya bisa diakses dari sisi Admin Aplikasi"*, *"Hak Akses … hanya Admin Aplikasi"*.
- **Matriks izin per menu = 6 aksi**: `Read`, `Insert`, `Update`, `Delete`, `Validate`, `Other`, disaring per **aplikasi + role**, disimpan lewat tombol `SIMPAN`. ([Setting Hak Akses Finance Cloud](https://knowledge.sevima.com/f-setting-hak-akses-pada-sevima-finance-cloud/))
- Role dapat **ditambah sendiri** oleh Admin PT; `User` otomatis ter-create saat modul Kepegawaian/Akademik menambah data; **pegawai non-dosen wajib ditambah manual** (`Pengguna > User > Tambah`).
- Scope orang tua (`Portal > Mahasiswa` read-only) *"bisa disesuaikan oleh admin di Administrasi Aplikasi ⇒ Pengguna ⇒ Hak Akses"*.
→ **Desain SICA:** enam verba `READ/INSERT/UPDATE/DELETE/VALIDATE/OTHER` mengikuti RBAC_MATRIX, assignment berscope/validity dan perubahan hak melalui `access_change_requests` empat-mata + audit. Ini tidak membuktikan SEVIMA tidak memiliki scope; §2A.7 justru memuat scope prodi yang terdokumentasi. Verba bukan izin bebas dan approval bisnis bukan hak otomatis Admin IT.

### 2A.7 Peran Sevima + menu yang benar-benar terdokumentasi `[DOK]`
| Role Sevima | Menu/cakupan terdokumentasi |
|---|---|
| **Administrator** | `SDM`, `PMB`, `Akademik > Mahasiswa`; kelola periode berlaku, referensi pendukung, pengguna, cetak KTM/Kartu Dosen, gelombang PMB, data mahasiswa, kelas & jadwal, **dispensasi KRS**, **validasi KRS Online**, aktivitas/kelulusan, tagihan/pembayaran, cetak laporan |
| **Admin Prodi/Kaprodi-Ketua Unit** | sebatas prodi-nya (setting prodi, kelas, pengampu, nilai) |
| **Admin Keuangan** | tarif, kelompok tagihan, generate tagihan, pembayaran, cegal, laporan |
| **Admin PMB** | gelombang, seleksi, berkas, NIM |
| **Admin Kepegawaian** | dosen/staf, BKD |
| **Dosen** | `SDM`, `Mahasiswa (Daftar, Validasi KRS)`, `Perkuliahan`; validasi KRS, input nilai, presensi, baca kuesioner, isi RPS |
| **Dosen Non-NIDN** | jalur pelaporan alternatif (NIDK/NUPTK/dosen praktisi) |
| **Mahasiswa** | `Profil (KRS, Aktivitas Kuliah, RHS, KHS, Tagihan)`, `Perkuliahan`; breadcrumb riil `Akademik → Pengisian KRS → "Konsultasi KRS"`, `Akademik → Riwayat KRS → Aksi → Cetak KRS` |
| **Pendaftar/Camaba** | portal `…/spmbfront/login` (ID Pendaftar + PIN) |
| **Orang Tua Mahasiswa** | `Portal > Mahasiswa` (biodata, KRS, KHS, transkrip, keuangan) + `Kalender Akademik` |
| **Pimpinan** | Dashboard T1/T2 + tanda tangan laporan |
| **TU / Operator Feeder** | pelaporan feeder, pemetaan sumber |
| **Auditee / Auditor / Admin Penjaminan Mutu** | SPMI |
| **Admin LPPM / Reviewer** | Litabmas |
| **Afiliator** | MauKuliah |
| **Tidak ditemukan** | **role Pustakawan** — clearance perpustakaan di Sevima tampak ditangani modul `Cekal`, bukan portal pustakawan terpisah `[INF]` |
→ **Pemetaan peran SICA:** kebutuhan PMB, kepegawaian, mutu, riset dan TU dipetakan ke assignment operasional dalam RBAC_MATRIX. Jangan memakai satu `tenant_admin` sebagai pemilik semua operasi. Peran/izin yang belum tersedia tetap pending; keputusan katalog milik RBAC, bukan dibuat dari nama menu vendor.

### 2A.8 Bukti pihak ketiga soal usability (memperkuat §2.8) `[PIHAK-KETIGA]`
- Evaluasi SIAKAD berbasis SEVIMA Platform di Universitas Ibnu Sina Batam: **skor SUS 61,12 (grade "OK")**, masalah utama *"kerumitan sistem dan ketidakkonsistenan fitur"*; rekomendasi eksplisit *"penyediaan panduan penggunaan setiap pembaruan sistem serta evaluasi usability secara berkala"*. ([ojs3.lppm-uis.org](https://ojs3.lppm-uis.org/index.php/JR/article/view/1462))
- Studi heuristic SIAKAD lain (UMG, UPN Jatim) menemukan pola *"kebingungan menemukan menu tertentu"* dan *"ketidakjelasan status proses"*. ([sibc.upnjatim.ac.id](https://sibc.upnjatim.ac.id/index.php/sibc/article/download/661/58/839))
- Failure mode yang diakui sendiri di judul artikel bantuan mereka: *"Fitur lupa password tidak berhasil mengirimkan email"*, *"Tidak Muncul Button Centang Saat Generate User Mahasiswa"*, *"Kenapa tiket yang sudah dibuat tidak muncul pada helpdesk admin?"* ([knowledge.sevima.com](https://knowledge.sevima.com/cara-menghubungi-layanan-support-sevima-platform/)) — **tanpa SLA tertulis publik**.

### 2A.9 Praktik yang TIDAK boleh SICA tiru (catatan audit) `[DOK]`
1. **Password default hasil reset = tanggal lahir `YYYYMMDD`** ([panduan reset password mahasiswa](https://knowledge.sevima.com/langkah-langkah-melakukan-reset-password-mahasiswa-pada-sevima-platform/)) → lemah & mudah ditebak. SICA: token reset sekali-pakai + wajib ganti sandi saat login + MFA untuk peran penulis (SECURITY §2).
2. **`Login As`: justifikasi tidak dijelaskan pada sumber yang ditinjau**, bukan bukti kontrolnya tidak ada. SICA mensyaratkan grant scoped, approval, alasan, MFA, expiry dan audit; platform tidak mendapat PII default.
3. Ketergantungan konfigurasi tertentu pada vendor adalah informasi dokumenter, bukan bukti seluruh produk lock-in. SICA membedakan lisensi platform, parameter operasional berapproval, reference nasional terverifikasi dan binding teknis tenant; **tidak semua konfigurasi boleh diedit tenant**.
4. Hosting dedicated tidak otomatis mahal/lambat atau membuktikan topologi semua produk. SICA perlu menguji RLS, kuota tenant dan noisy-neighbor sendiri.

### 2A.10 Titik jual Sevima yang harus kita punya (persyaratan fungsional tambahan)
| Yang mereka punya | FR/SPEC SICA yang harus ditambah |
|---|---|
| `Unsur Nilai`, `Jenis Matakuliah`, `Kelompok Matakuliah`, `Bidang Ilmu`, `Slot Waktu`, `Status Hadir`, `Jenis Pertemuan`, `Jenis Kegiatan Pendukung` | **FR-ADM-07 Data Referensi & Kamus** (tabel `reference_items` + `reference_kinds`, atau tabel khusus per gugus) — lihat §5.1 M-17 |
| `Sistem Kuliah` (mengikat kelas yang boleh diambil **dan** biayanya) | Perlu padanan: `enrollment_scheme` per prodi/angkatan (reguler/parallel/PPG/dsb.) → **FR-ADM-08** |
| `Ekivalensi Mata Kuliah` + `RPL` | **FR-KUR-02** konversi/equivalensi (dipakai MBKM & pindah prodi) |
| `Batas SKS` sebagai objek master | sudah ada (`academic_rules.max_sks_by_ip` + plafon prodi) — tetapi perlu **layar Admin** |
| `Pembatalan NIM`, `NIM generate dari Kode Fakultas` | `student_status_history` + `tenant_settings.nim_format` (M-04/K-02) |
| `Dispensasi KRS`, `validasi KRS online`, `Pemaketan KRS` | `academic_rules.late_krs_mode` + jalur approval (FR-AKA-04/11) + **FR-AKA-16 pemaketan KRS** |
| `Kustomisasi Form/Kolom Data Master/Laporan/Penandatanganan` | **FR-ADM-09 Meta-konfigurasi per tenant** (field visibility, label, urutan kolom, template laporan) — backlog produk bernilai tinggi |
| `Monitoring Pengisian Nilai`, `Monitoring Ruang`, `Statistik Login` | **FR-RPT-02 Monitoring operasional admin** |
| `Persuratan` + `Berita Acara TA` bervariabel | **FR-DOC-02 template surat + token variabel** (`judul_ta`, `nama_penguji_1`) — koreksi out-of-scope §2.8 D-8 |
| `Cetak KTM`/`Kartu Dosen`, `Kartu UTS/UAS` | sudah ada FR-AKA-14 + KTM digital UI_UX §3.3 — tambahkan **cetak kartu dosen** |
| `Gamifikasi/Leaderboard EdLink`, `CBT AI buat soal per CPL`, `Generate AI capaian OBE` | FR-P2-14 (AI) — **jangan dijual sebelum ada modelnya**; cukupkan sebagai "bantuan penyusunan" (lihat catatan kejujuran copy landing di PROGRESS §5.25) |

---

## 2B. Lapisan ketiga: kamus data PDDikti Neo Feeder (dampak ke Admin & data master)
> Rincian teknis lengkap ada di [INTEGRATIONS §1.4](file:///c:/SICA/docs/INTEGRATIONS.md); norma terikat di [PRD §3.4.5](file:///c:/SICA/docs/PRD.md) + `BR-R16`/`BR-R17` + `AC-FDR-2`; konsekuensi DDL di [DATA_MODEL §14.5](file:///c:/SICA/docs/DATA_MODEL.md). Bagian ini mencatat **kenapa** riset Feeder mengubah rencana Area Admin.

| # | Temuan Feeder | Yang berubah di rencana Admin SICA |
|---|---|---|
| FB-1 | Feeder = aplikasi **lokal** ( PostgreSQL lokal, `localhost:8100`), WS POST ke `/ws/live2.php`, token via `GetToken`, **`error_code 100` = token kedaluwarsa**, sandbox `sandbox2.php` | Dibutuhkan **Feeder Bridge** di sisi kampus + antrean job idempoten; tidak ada "kirim dari serverless". Rute `/admin/feeder` hanya mengatur job & membaca temuan |
| FB-2 | 13 aksi **kamus** tersedia (`GetAgama`, `GetPekerjaan`, `GetPenghasilan`, `GetWilayah`, `GetJalurMasuk`, `GetPembiayaan`, `GetKebutuhanKhusus`, `GetJenjangPendidikan`, `GetJenisTinggal`, `GetAlatTransportasi`, `GetNegara`, `GetProdi`, `GetJenisAktivitasMahasiswa`) | `reference_kinds.feeder_code` + tombol **"Sinkron dari PDDikti"** di `/admin/master/referensi`; kode lokal yang menyimpang = temuan `BLOCK` |
| FB-3 | **11 penolakan validasi** menahan sinkron (jenis daftar vs SKS diakui, IP/IPK>4, prodi tanpa periode, non-registrasi, **mahasiswa ganda**, tanggal lahir tidak wajar, SKS semester>24, SKS MK tidak konsisten, mengajar>18, periode beririsan, **DUKCAPIL mismatch**) | Jadi **gerbang input** (`AC-FDR-2`), disimpan di `pddikti_validation_findings`, diagregasi panel **Kesehatan Data** (FR-ADM-10). Ini pula jawaban atas kelemahan Sevima D-5 |
| FB-4 | **Dosen tidak dapat dibuat/diubah lewat Feeder** (dikelola pusat/SISTER) | `BR-R16`: UI feeder **tidak** punya aksi kirim dosen; hanya pencocokan `nidn`/`pddiktiIdDosen` |
| FB-5 | Tidak ada objek **presensi**, **tagihan**, **ruang**, **bahan ajar** di Feeder | Klaim pemasaran harus jujur: QR presensi & modul keuangan = keunggulan **internal**, bukan "siap lapor" |
| FB-6 | `jenis_kelamin` = **L/P**; `nik` 16 digit + **nama ibu kandung** = kunci DUKCAPIL; `id_pembiayaan`/`biaya_masuk`/`penerima_kps` wajib maba | Peta kode di `pddikti_mappings`; validasi lintas tabel (NIK + `student_guardians`); kolom pembiayaan **belum ada** → masuk migrasi perluasan |
| FB-7 | SKS dipecah **4 jenis** dan total ≤ 9; `realisasi_minggu ≤ 18`; RPS & Rencana Evaluasi wajib sejak Ganjil 2024 (bobot ≥ 50% untuk IKU 7) | Perluasan `courses` + CHECK; kolom `planned/realized_meetings`; **RPS** jadi objek admin (belum ada di skema kita → backlog ADM) |
| FB-8 | `jenisdaftar` 1..5 (baru/pindahan/RPL/non-gelar/fastrack) dengan aturan SKS-diakui & PT asal | Membenarkan `FR-KUR-02` (ekivalensi) & `FR-AKA-17` (pindah prodi) sebagai **syarat nasional**, bukan fitur |
| FB-9 | Checkpoint 1/2 (≤2 bulan) + praktik **Ganjil 30 April / Genap 30 Oktober**; koreksi via **PDM**; buka periode **Tipe 1/Tipe 2** | `academic_calendar_events` **auto-isi** tenggat saat periode dibuat (ADM-2); `pddikti_correction_requests` = padanan PDM; `period_reopen_requests` menyimpan tipe |

**Target SICA:** pra-validasi input dan panel temuan sebelum kirim. Dokumentasi pembanding tidak membuktikan kapan seluruh validasi SEVIMA berjalan. Validasi internal **tidak menjamin persetujuan pangkalan nasional**: kode, aturan, versi, sumber/lisensi referensi dan respons target wajib diverifikasi. Tabel riset di atas bukan pengesahan fakta nasional atau tenggat hukum; verifikasi resmi masih terbuka mengikuti INTEGRATIONS: **[VERIFIKASI-VENDOR]** (pemilik: integrasi) dan **[VERIFIKASI-LEGAL]** (pemilik: legal).

**Item baru yang lahir dari riset ini (masuk backlog, tercatat agar tidak hilang):**
- OBJ-1 `pddikti_mappings` + `pddikti_validation_findings` (belum ada tabel) — ADM-3/ADM-9.
- OBJ-2 **RPS (Rencana Pembelajaran Semester)** & **Rencana Evaluasi** per mata kuliah/kelas — objek admin yang wajib pelaporan nasional tetapi tidak ada di skema kita saat ini.
- OBJ-3 **Aktivitas mahasiswa & prestasi** (SIMKATMAWA: jenis aktivitas, tingkat prestasi, penyelenggara, tahun) — padanan `kegiatan_akademik`/kemahasiswaan; diperlukan untuk AKM & IKU.
- OBJ-4 Sinkronisasi kamus pusat terjadwal (cron) + diff "kode PDDikti berubah" — mencegah busuk peta.

---

## 3. Dimensi 1 — Peran (role) yang SICA harus dukung
> **Catatan kepemilikan:** daftar di bawah adalah **peran tampilan** (15) untuk keperluan pemetaan menu. Katalog **normatif** hak akses — 22 peran ber-scope + ~160 kode permission + matriks aksi — ada di [RBAC_MATRIX.md §2](file:///c:/SICA/docs/RBAC_MATRIX.md); rekonsiliasi kedua daftar ada di [RBAC_MATRIX §11](file:///c:/SICA/docs/RBAC_MATRIX.md).

Diturunkan dari [PRD §3 Persona](file:///c:/SICA/docs/PRD.md) (11 persona) + kebutuhan regulasi (BR-R11 operator feeder, BR-K2 dual-approval keuangan) + kenyataan lapangan bahwa **satu orang memegang banyak peran**.

| # | Kode role | Nama tampilan | Scope melekat pada | Modul wajib | Fase |
|---|---|---|---|---|---|
| R-01 | `super_admin` | Platform Operator | lintas-tenant (break-glass ter-audit) | `identity`, `audit` | 1 |
| R-02 | `tenant_admin` | Admin IT tenant (bukan BAAK) | governance tenant, assignment aktif sesuai RBAC | identitas/konfigurasi teknis; bukan Core operasional penuh | 1 |
| R-03 | `kaprodi` | Ketua Program Studi | 1..n prodi | `academic`, `teaching`, `assessment` | 1 |
| R-04 | `dosen` | Dosen Pengampu | kelas (via `class_assignments`) | `teaching`, `attendance`, `assessment` | 1 |
| R-05 | `dosen_wali` | Dosen Pembimbing Akademik | sekelompok mahasiswa | `enrollment` (approval KRS) | 1 |
| R-06 | `operator_feeder` | Operator PDDIKTI | tenant (BR-R11, ber-SK) | `feeder_pddikti` | 1 |
| R-07 | `keuangan` | Administrator Keuangan | tenant | `finance` | 1 |
| R-08 | `keuangan_approver` | Pejabat Penyetuju Keringanan/Void | tenant (≠ R-07, BR-K2) | `finance` | 1 |
| R-09 | `pimpinan` | Rektor/Warek/Dekan | agregat tenant/fakultas | reporting (read) | 2 |
| R-10 | `staff` | Tenaga Kependidikan | unit/org | `hr_bkd` (addon) | 2 |
| R-11 | `mahasiswa` | Mahasiswa | dirinya | `enrollment`, `attendance`, `assessment` | 1 |
| R-12 | `pendaftar` | Pendaftar Baru (PMB) | aplikasi dirinya | `pmb`, `cbt` (addon) | 2 |
| R-13 | `ortu` | Orang Tua/Wali | mahasiswa terkait | `parent_portal` (addon) | 2 |
| R-14 | `alumni` | Alumni | dokumen dirinya | `graduation`, `tracer_iku` (addon) | 2 |
| R-15 | `auditor_mutu` | Auditor Internal (SPMI) | instrumen mutu | `spmi` (addon) | 2 |

**Aturan penegakan (wajib, berbeda dari SIAKAD legacy):**
1. Hak berasal dari `user_role_assignments` aktif dengan scope/validity, bukan label login. Resolver berscope sudah ada; cakupan penegakan dibuktikan per rute, bukan disimpulkan dari helper.
2. Server sumber otorisasi; penyembunyian menu bukan kontrol. Enam lapisan mengikuti SECURITY §3.3, bukan urutan tiga guard lama. Entitlement mendahului izin pada domain modular; rute tulis admin baru mengotorisasi sebelum validasi bentuk. Empat metode organisasi/prodi sudah diperbaiki, warisan lain tetap `RD-155`.
3. Perubahan hak akses bersifat **empat-mata** (`access_change_requests`): tidak ada self-escalation, dan setiap grant dicatat ke `audit_logs`.
4. Semua peran penulis-admin **wajib MFA** (FR-IDT-01).

---

## 4. Dimensi 2 & 3 — Peta menu per peran × modul

Kode modul = 19 modul entitlement nyata ([DATA_MODEL §12.2](file:///c:/SICA/docs/DATA_MODEL.md#L1296)). Legenda kolom **Menu**: `●` penuh (CRUD), `◐` baca/aksi terbatas, `–` tidak terlihat.

### 4.1 MENU — administrasi teknis dan operasi kampus (pemilik terpisah)
Peta menu bukan daftar grant `tenant_admin`. Admin IT mengelola governance teknis; BAAK, BAUK, HRD, fakultas/Kaprodi dan dosen mengelola operasi sesuai assignment berscope dan RBAC. Rute usulan tidak membuktikan layar/fitur deployed. Profil/kode nasional memerlukan verifikasi bisnis; IT hanya binding/metadata teknis. Dukungan platform tidak memiliki PII default.

| Kelompok menu | Item menu | Rute web usulan | Modul | Owner |
|---|---|---|---|---|
| **A. Umum** | Ringkasan & kesehatan data tenant (pra-go-live report) | `/admin` | `academic` | BAAK sesuai scope/RBAC |
| | Profil institusi & identitas PT (nama, alamat, kode PDDikti, logo, timezone) | `/admin/institusi` | `identity` | Admin IT (governance; bukan izin operasi) |
| | Struktur organisasi (fakultas / jurusan / unit / perpustakaan) | `/admin/organisasi` | `academic` | BAAK sesuai scope/RBAC |
| **B. Data Master** | Tahun akademik | `/admin/master/tahun-akademik` | `academic` | BAAK sesuai scope/RBAC |
| | Periode / semester (DRAFT→OPEN→CLOSED) | `/admin/master/periode` | `academic` | BAAK sesuai scope/RBAC |
| | Kalender akademik & tanggal kunci (termasuk tenggat PDDikti BR-R9) | `/admin/master/kalender` | `academic` | BAAK sesuai scope/RBAC |
| | Program studi (jenjang, kode PDDikti, akreditasi, plafon SKS BR-R2/R3/R4) | `/admin/master/prodi` | `academic` | BAAK·kaprodi sesuai scope |
| | Kurikulum (versi, masa berlaku, skala nilai) | `/admin/master/kurikulum` | `academic` | kaprodi |
| | Mata kuliah (SKS teori/praktik/kerja/lab, tipe, bahasa pengantar) | `/admin/master/matakuliah` | `academic` | kaprodi |
| | Prasyarat & ko-requisite matakuliah (BR-A16) | `/admin/master/prasyarat` | `academic` | kaprodi |
| | Skala nilai & band konversi (FR: skala per kurikulum) | `/admin/master/skala-nilai` | `assessment` | kaprodi |
| | Komposisi bobot penilaian (harus 100%, AC-NIL-4) | `/admin/master/komposisi-nilai` | `assessment` | kaprodi |
| | Ruang & gedung (kapasitas, tipe lab/kelas, fasilitas) | `/admin/master/ruang` | `teaching` | pemegang izin domain sesuai RBAC; bukan hak default Admin IT |
| | Data referensi nasional (agama, pekerjaan, penghasilan, wilayah, jalur masuk, jenis sekolah) | `/admin/master/referensi` | `academic` | BAAK sesuai scope/RBAC |
| **C. Personel (Kepegawaian Akademik)** | Mahasiswa (+ biodata feeder, alamat, ortu, foto) | `/admin/personel/mahasiswa` | `academic` | BAAK·kaprodi sesuai scope |
| | Perubahan status mahasiswa (aktif/cuti/DO/pindah/lulus) beralasan + riwayat | `/admin/personel/status-mahasiswa` | `academic` | BAAK·kaprodi sesuai scope |
| | Dosen (NIDN/NUPTK, rumpun, homebase, jabatan fungsional) | `/admin/personel/dosen` | `academic` | HRD/pemilik biodata sesuai RBAC; BAAK hanya scope akademik terkait |
| | Tendik/staf | `/admin/personel/staf` | `hr_bkd` | HRD sesuai RBAC, bukan Admin IT |
| | Pembimbing akademik (pasang dosen-wali per angkatan/prodi) | `/admin/personel/dosen-wali` | `enrollment` | kaprodi |
| **D. Penyelenggaraan** | Kelas & kelas paralel (generate massal per kurikulum) | `/admin/penyelenggaraan/kelas` | `teaching` | kaprodi |
| | Penugasan dosen ke kelas + guardrail beban mengajar 16 SKS (BR-A11) | `/admin/penyelenggaraan/pengampu` | `teaching` | kaprodi |
| | Jadwal mingguan & deteksi bentrok (AC-JDW-1) | `/admin/penyelenggaraan/jadwal` | `teaching` | kaprodi |
| | Generate pertemuan/sesi (1..16, geser hari libur) | `/admin/penyelenggaraan/pertemuan` | `teaching` | dosen·kaprodi |
| **E. Pengaturan Transaksional** | Pengaturan prodi-per-periode (jendela KRS/validasi/cetak/input nilai/kuesioner) = `academic_rules` | `/admin/pengaturan/akademik` | `enrollment` | BAAK·kaprodi sesuai scope |
| | Gerbang & cekal (4 dimensi, BR-A7) | `/admin/pengaturan/cekal` | `finance`·`academic` | pemegang izin domain sesuai RBAC; bukan hak default Admin IT |
| | Kebijakan DO/peringatan akademik (BR-S1) | `/admin/pengaturan/retensi-studi` | `academic` | BAAK sesuai scope/RBAC |
| | Paket/komoditas biaya & komponen tarif (BR-K1) | `/admin/keuangan/tarif` | `finance` | keuangan |
| | Modul & add-on aktif (entitlement) | `/admin/modul` | `identity` | Admin IT (governance; bukan izin operasi) |
| **F. Pengguna & Hak Akses** | Pengguna, sesi aktif, reset lewat workflow; tidak ada unduh secret/faktor MFA | `/admin/pengguna` | `identity` | Admin IT (MFA + approval sesuai RBAC) |
| | Peran & penugasan ber-scope (matriks izin) | `/admin/pengguna/hak-akses` | `identity` | Admin IT (governance; bukan izin operasi) |
| | Log aktivitas (audit, filter per aktor/entitas) | `/admin/audit` | `audit` | pemegang izin domain sesuai RBAC; bukan hak default Admin IT |
| **G. Migrasi & Impor** | Impor XLSX/CSV master + laporan rekonsiliasi (AC-MIG-1) | `/admin/impor` | `academic` | BAAK sesuai scope/RBAC |
| **H. Feeder** | Pemetaan kode lokal→PDDikti, pra-validasi, kirim, log sync (AC-FDR-1) | `/admin/feeder` | `feeder_pddikti` | operator_feeder |

### 4.2 MENU — peran lain (ringkas)
| Peran | Menu yang terlihat |
|---|---|
| `dosen` (R-04) | Beranda dosen · Kelas saya · Presensi (QR/panggil) · Buku nilai · Kunci/koreksi nilai · Roster · Rekap kepatuhan |
| `dosen_wali` (R-05) | Mahasiswa bimbingan · Approval KRS (individual + **massal** AC) · Catatan progres · Rekomendasi SKS |
| `keuangan` (R-07) | Komponen tarif · Generate tagihan massal · Pembayaran/VA · Rekonsiliasi harian · Piutang · Void (ajukan) |
| `keuangan_approver` (R-08) | Antrean persetujuan keringanan/void (tidak bisa mengajukan sendiri) |
| `operator_feeder` (R-06) | Mapping · Pra-validasi · Ekspor/kirim per periode · Antran error per record |
| `pimpinan` (R-09) | Dashboard eksekutif · Drill-down prodi/fakultas · Approval SK (e-sign) · Ekspor rapat senat |
| `mahasiswa` (R-11) | Jadwal · KRS · KHS/IPK · Tagihan & bayar · Presensi · Surat keterangan · Status & cekal saya |
| `pendaftar` (R-12) | Pendaftaran · Bayar tes · CBT · Pengumuman · Registrasi ulang |
| `ortu` (R-13) | progres anak (KHS, presensi, tagihan) — read-only |
| `alumni` (R-14) | Ijazah digital & legalisir · Tracer study · SKPI |
| `auditor_mutu` (R-15) | Instrumen PPEPP · bukti/AMI · CAPA · ekspor 9 kriteria |

---

## 5. Dimensi 4 — Data master, data pendukung, dan lainnya

Empat gugus (pemisahan ini yang membuat admin SIAKAD sering kacau bila tidak dispesifikasi):

### 5.1 Data MASTER (rujukan, umur panjang, dikunci oleh relasi)
| # | Entitas | Sumber tabel | Status kode | Catatan regulatori |
|---|---|---|---|---|
| M-01 | Tahun akademik | `academic_years` | ✅ ada | label `2026/2027`, unik per tenant |
| M-02 | Periode/semester | `academic_periods` | ✅ ada | status `DRAFT/OPEN/CLOSED`; penutupan memblokir tulis (BR-A9) |
| M-03 | Kalender akademik | `academic_calendar_events` | ❌ **belum ada** | jenis `OW_OPEN…PDDIKTI_*_DUE`; `is_mandatory` tak boleh hapus |
| M-04 | Organisasi (fakultas/jurusan/unit) | `organizations` | ✅ ada | `kind` + `parent_id` (hierarki) |
| M-05 | Program studi | `study_programs` | ✅ ada | kode PDDikti, akreditasi + masa berlaku (BR-R7), plafon SKS (BR-R2/R3/R4) |
| M-06 | Kurikulum | `curricula` | ✅ ada | berversi + `grade_scale_id` per kurikulum |
| M-07 | Mata kuliah | `courses` | ✅ ada | SKS pecah teori/praktik; `course_type` |
| M-08 | Prasyarat matakuliah | `course_prerequisites` | ❌ **belum ada** | BR-A16 (`PASSED`/`TAKEN`/`CO_REQUISITE` + ambang nilai) |
| M-09 | Skala nilai + band | `grade_scales`, `grade_scale_bands` | ✅ ada | BR-R5; band tumpang tindih ditolak |
| M-10 | Komponen bobot nilai | `grade_components` | ✅ ada | **AC-NIL-4** = jumlah bobot harus 100% |
| M-11 | Ruang/gedung | `rooms` | ✅ ada | kapasitas, tipe, fasilitas |
| M-12 | Mahasiswa | `students` | ✅ ada | + kolom biodata feeder (§11.2) |
| M-13 | Alamat mahasiswa (multi-jenis) | `student_addresses` | ✅ ada | kode wilayah Kemendagri 4 level |
| M-14 | Orang tua/wali | `student_guardians` | ✅ ada | penghasilan/pekerjaan = wajib feeder & basis UKT |
| M-15 | Dosen | `lecturers` | ✅ ada | NIDN/NUPTK/rumpun/homebase (G-04) |
| M-16 | Tendik/staf | `staff` | ✅ ada | NIP, unit kerja (G-05) |
| M-17 | Data referensi nasional | *(belum ada tabel)* | ❌ | agama, pekerjaan, penghasilan, jalur masuk, jenis sekolah asal, bahasa pengantar, wilayah |
| M-18 | Kelompok tarif & komponen biaya | `fee_tariff_groups`, `fee_components` | ❌ | BR-K1 (UKT / per-SKS), versioned |
| M-19 | Beasiswa & keringanan | `payment_waivers` | ❌ | jalur dispensasi gerbang KRS |

### 5.2 Data PENDUKUNG / transaksional (dibentuk dari master)
P-01 Kelas & paralel (`classes` ✅) · P-02 Penugasan pengampu (`class_assignments` ✅) · P-03 Jadwal mingguan (`class_schedules` ✅) · P-04 Pertemuan/sesi (`class_sessions` ✅) · P-05 Antrean kelas (`class_waitlists` ✅, BR-A10) · P-06 Enrollment/KRS (`enrollments` ✅) · P-07 Presensi (`attendances` ✅, status + GPS) · P-08 Nilai (`grades` ✅) · P-09 Koreksi nilai (`grade_corrections` ✅, BR-G4) · P-10 Riwayat status mahasiswa (**❌** `student_status_history`) · P-11 Invoice & pembayaran (**❌**) · P-12 Ledger append-only (**❌**) · P-13 Clearance/cekal (**❌** `blockades`, `clearances`) · P-14 Yudisium/ijazah (**❌**, defek AUD-09) · P-15 Sync log feeder (**❌**).

### 5.3 Data KONFIGURASI & kebijakan (yang membedakan kampus satu dgn lain)
K-01 `academic_rules` per prodi-per-periode (**❌ belum ada tabel**) — ini **objek paling penting** untuk produk multi-tenant: band SKS, gerbang, denda, ambang presensi, jendela koreksi, syarat skripsi.
K-02 `tenant_settings` (**❌ belum dispesifikasi**) — format NIM, penomoran SK, timezone, logo, nama surat, preferensi bahasa.
K-03 `tenant_modules` (✅) — entitlement; filter menu & guard API.
K-04 `permissions`/`roles`/`role_permissions`/`user_role_assignments`/`access_change_requests` (**❌ belum ada tabel**) — matriks izin ber-scope.
K-05 Kredensial integrasi (feeder/payment/SMTP/WA) — wajib di KMS/Vault, **bukan** baris plaintext DB ([ENV_CONTRACT](file:///c:/SICA/docs/ENV_CONTRACT.md)).
K-06 `retention_rules` & `data_processing_bases` (**❌**) — JRA kampus (NFR-D1).

### 5.4 Data OPERASIONAL platform
`tenants`, `tenant_domains`, `plans`, `subscriptions`, `tenant_quotas`, `tenant_usage`, `users`, `sessions`, `refresh_tokens`, `mfa_factors` (✅ semua ada di kode) + `login_events`, `password_history` (✅ `password_history`; **❌ `login_events` belum ada tabel**) + `audit_logs`/`outbox`/`idempotency_keys` (**❌ belum ada tabel**).

---

## 6. Dimensi 5 — Flow alur kerja

### 6.1 F-ADM-A — Penataan tahun ajaran baru (urutan dependensi ketat)
Ini alur **Admin** yang jadi target pengerjaan pertama (PRD §5.4 menetapkan urutannya):

```
1 Buat Tahun Akademik            (M-01)
2 Buka Periode/Semester          (M-02)  ── status DRAFT sampai siap
3 Isi Kalender Akademik           (M-03)  ── OW_OPEN/CLOSE, UTS, UAS, GRADE_CUTOFF, PDDIKTI_*_DUE
4 Tetapkan/Perbarui Kurikulum     (M-06) ── + skala nilai (M-09) & komposisi bobot (M-10)
5 Sinkron Mata Kuliah ke Kurikulum(M-07) ── + prasyarat (M-08)
6 Siapkan Ruang                   (M-11)
7 Buat Kelas Paralel per MK       (P-01) ── plafon paralel prodi (max_parallel_classes)
8 Tugaskan Dosen Pengampu         (P-02) ── guardrail 16 SKS (BR-A11) menolak overload
9 Plot Jadwal Mingguan            (P-03) ── deteksi bentrok dosen+ruang (AC-JDW-1) HARD BLOCK
10 Generate Pertemuan 1..16       (P-04) ── lewati hari libur; sinkron LMS (AC-LMS-1)
11 Terbitkan Pengaturan Akademik  (K-01) ── jendela KRS/validasi/cetak/input nilai per prodi
12 Buka Periode → status OPEN     ── gerbang OW; mahasiswa & dosen mulai.transaksi
```
**Gate wajib tiap langkah:** RLS `withTenantContext` · `withModule('academic'|'teaching'|'enrollment')` · otorisasi role+scope · audit event · idempotensi (generate massal aman dijalankan ulang, pola AC-KEU-2).

### 6.2 F-ADM-B — Tutup & buka kunci periode
Pejabat akademik berwenang (BAAK/Kaprodi sesuai RBAC, **bukan hak default Admin IT**) → kumpulkan exception → approval penutupan periode → `CLOSED` menolak mutasi domain yang dibatasi BR-A9. Koreksi melalui `period_reopen_requests` atau `grade_corrections` berizin, beralasan dan diaudit; arsip tidak dihapus.

### 6.3 F-ADM-C — Impor master data legacy (J1 onboarding, ≤14 hari)
Unduh templat → unggah XLSX/CSV per entitas dengan **urutan dependensi** (prodi → matakuliah → kurikulum → dosen → mahasiswa) → **validasi pra-import** (NIM duplikat, dosen tanpa NIDN, prodi tanpa akreditasi, baris yatim) → laporan rekonsiliasi (baris sumber / terimpor / ditolak + alasan) → apply dalam transaksi per-batch + audit → baru tenant boleh `LIVE` (AC-MIG-1).

### 6.4 F-ADM-D — Perubahan data historis yang diizinkan
Tiga jalur legal saja: **(1)** koreksi biodata PII (mahasiswa/ortu) → audit + notifikasi; **(2)** perubahan status mahasiswa → butuh approval + alasan + `student_status_history`; **(3)** koreksi nilai pasca-kunci → usul dosen → approve kaprodi → **reversing row**, bukan `UPDATE` diam-diam. Semua yang lain ditolak dengan alasan terukur.

### 6.5 F-ADM-E — alur parsial, bukan loop end-to-end selesai
Submit KRS memiliki jalur DB-backed dengan advisory lock sebagai pengecualian sementara `RD-11/P-6`; itu tidak membuktikan seluruh alur UI/approval. **UI KRS masih mock (`RD-154`)**. Presensi, nilai, KHS, yudisium dan Feeder membutuhkan bukti per jalur/role/DB sendiri; keberadaan rute atau klik tersembunyi bukan audit UI penuh.

---

## 7. Urutan pengerjaan Area Admin (keputusan)

Dasar: master data adalah fondasi transaksi. Organisasi/prodi sudah memiliki metode admin yang diperbaiki; klaim “hanya seed dapat mengisi master” tidak lagi berlaku menyeluruh. Tabel sprint berikut adalah urutan perencanaan historis, bukan status semua slice saat ini; penutupan mengikuti bukti per rute di ROADMAP/AUDIT_READINESS.

| Sprint | Slice | Alasan urut |
|---|---|---|
| ADM-1 | **Kerangka Admin**: guard role+scope, layout area admin, `VelzonDataGrid` + pola form/daftar, kontrak Zod generik (`PaginationQuery`, envelope) | dipakai ulang oleh semua slice berikutnya |
| ADM-2 | **Tahun akademik · Periode · Kalender** (+ tabel `academic_calendar_events`) | gerbang status `OPEN/CLOSED` menentukan bisa/tidaknya semua tulis |
| ADM-3 | **Organisasi · Prodi · Kurikulum · Matakuliah · Prasyarat · Skala nilai · Komposisi** | rantai dependensi FK terpanjang; perlu `course_prerequisites` |
| ADM-4 | **Ruang** | murah, tanpa dependensi, langsung dipakai slice kelas |
| ADM-5 | **Kelas · Pengampu · Jadwal · Generate pertemuan** | butuh ADM-2+3+4 selesai; memakai conflict-detector yang sudah teruji |
| ADM-6 | **Pengaturan akademik per prodi-periode** (`academic_rules`) + cekal | objek konfigurasi = janji produk "konfigurasi > kustomisasi kode" (P4) |
| ADM-7 | **Personel**: CRUD mahasiswa/dosen/staf + form biodata feeder + perubahan status | paling banyak kolom; setelah strukturnya stabil |
| ADM-8 | **Pengguna & hak akses** (`permissions`/`roles`/`user_role_assignments`) + audit viewer | menutup lubang RBAC scope yang sekarang enum 5 nilai |
| ADM-9 | **Impor massal** + laporan rekonsiliasi | setelah seluruh CRUD tunggal terbukti benar |

**Lanjutan 2026-10-19 (setelah dekonstruksi enterprise).** Urutan di atas **diperpanjang**, tidak diganti: **ADM-K** (tutup katalog izin `K-1`…`K-5` sebelum rute baru dibuat) → **ADM-10** (kelembagaan: `time_slots`, `buildings`, `concentrations`, `laboratories`) → **ADM-11** (kurikulum/OBE + keuangan enterprise) → **ADM-12** (KRS/MBKM, presensi, publikasi nilai, kelulusan). Dasar & rinciannya: [BLUEPRINT_ENTERPRISE.md §6.3](file:///c:/SICA/docs/BLUEPRINT_ENTERPRISE.md) dan [ROADMAP §2.5.13](file:///c:/SICA/docs/ROADMAP_TASKS.md). Status ADM-8 berubah dari "belum ada" menjadi **◐ skema + resolver ada, migrasi `0011` belum diterapkan** — lihat BLUEPRINT §6.0.

Validasi wajib setiap slice (standing DoD): `tsc` 0 error · `lint` bersih · unit test kontrak+service · **integration test live Supabase** dengan RLS · audit event tercatat · i18n `id`+`en` · UI Velzon (§2.0 UI_UX_DESIGN).

---

## 7A. Tinjauan dokumentasi Fase 1 — batas bukti perbandingan

Target **Fase 1 diperluas** mencakup governance platform/Admin IT dan slice operasi bisnis sesuai ROADMAP; perluasan cakupan **tidak memberi Admin IT hak operasional** dan tidak berarti seluruh operasi sudah selesai. Bagian ini membandingkan **dokumentasi**, inventaris kode dan bukti uji SICA yang dirujuk; bukan benchmark runtime dua produk pada dataset, versi, infrastruktur dan beban yang sama. Tidak tersedia akses runtime SEVIMA untuk perbandingan setara.

**Skor lama 8.0 vs 4.1 (sebelumnya 8.4 vs 4.1) adalah penilaian subjektif internal**, bukan keluaran alat ukur atau bukti “melampaui SEVIMA”. Rata-rata dan delta itu tidak dipakai sebagai kriteria penerimaan atau klaim publik. Ketiadaan pembahasan fitur dalam sumber vendor berarti **belum diketahui**, bukan fitur tidak ada atau bernilai rendah.

### 7A.1 Standar nasional: pemetaan kebutuhan, bukan sertifikasi

SN-Dikti, PDDikti/Neo Feeder, SISTER, perlindungan data pribadi, tanda tangan elektronik dan akreditasi memerlukan verifikasi sumber resmi, versi/perubahan yang berlaku, lingkup, lisensi referensi dan penanggung jawab penilaian. Status masih terbuka: **[VERIFIKASI-LEGAL]** (pemilik: legal) dan **[VERIFIKASI-VENDOR]** (pemilik: integrasi). Nama regulasi dari draf sebelumnya tidak menetapkan fakta hukum terverifikasi. Katalog parameter, kamus nasional atau lulus doc gate tidak membuktikan kepatuhan hukum maupun penerimaan laporan oleh regulator. Salinan nilai nasional harus memiliki provenance dan verifikasi sebelum digunakan (§6 INTEGRATIONS).

### 7A.2 Bukti yang dapat dan tidak dapat disimpulkan

| Area | Bukti terbatas yang dapat dirujuk | Tidak dibuktikan oleh bukti tersebut |
|---|---|---|
| Otorisasi admin | RBAC_MATRIX, assignment berscope/validity, guard dan uji rute terkait | hak dari label login; Admin IT otomatis berhak KRS/nilai/settlement; semua rute legacy aman |
| Lisensi/modul | kontrak entitlement platform dan opt-out tenant | tenant boleh menaikkan lisensi; modul nonaktif boleh menghapus arsip akademik |
| SoD/MFA | workflow approval dan pengujian constraint/guard per skenario | identitas manusia berbeda hanya karena dua akun berbeda; seluruh aksi sensitif telah diuji |
| Audit | `appendAuditEntry` dan `verifyAuditChain`: SHA-256 JSON, kepala per tenant/partisi | rantai lintas tenant, tamper-proof terhadap DBA, Merkle/WORM deployed, kepatuhan hukum otomatis |
| RLS | harness `packages/database/scripts/test-rls.ts` memerlukan PostgreSQL dan role non-bypass | kondisi DB produksi dari inventaris DDL atau tes array/mock |
| UI dan operasi | rute/layar nyata harus dibedakan dari mock dan rancangan | klik tersembunyi sebagai audit UI penuh, mobile parity atau kesiapan seluruh alur kampus |
| Statistik alat | inventaris handler/izin, unit/e2e dan gate adalah snapshot sesuai run/commit/lingkungannya | skor kompetitor, cakupan penuh, atau kelulusan saat ini tanpa menjalankan ulang |

`verify:chain` membuat tenant sintetis dan sisipan hash salah; hasilnya bukan pemeriksaan rantai lama tenant demo setelah cleanup. Doc parser `.tools/bench-admin-delta.mjs` memeriksa rujukan dokumen, bukan implementasi/deployment.

### 7A.3 Putusan terbatas dan blocker

Klaim yang dapat dipakai: **“SICA memiliki spesifikasi dan bukti implementasi parsial untuk governance admin; status tiap alur mengikuti bukti uji terkait.”** Tidak ada dasar dari tinjauan ini untuk mengatakan Fase 1 melampaui SEVIMA, siap produksi, memenuhi semua hukum, atau semua fitur selesai.

Blocker tetap dibedakan: `RD-146` cleaner belum aman untuk apply rutin; `RD-154` UI KRS masih mock; `RD-155` urutan guard rute warisan belum tertutup menyeluruh. Perbaikan empat metode organisasi/prodi tidak menutup seluruh API/UI. Operasi akademik, keuangan, HRD, Feeder dan mobile memerlukan bukti sendiri, bukan diwarisi dari kelulusan konsol admin.

### 7A.4 Lima lensa audit internal — bukan panel pakar

**Tidak ada panel atau pakar eksternal yang berpartisipasi.** Persona “Pakar SEVIMA” dan narasi pengalaman profesional pada draf lama bukan konsultasi nyata dan tidak dipakai sebagai otoritas. Lima lensa berikut adalah kerangka review internal:

1. **Arsitektur:** batas modul/transport, entitlement, transaksi dan satu pemilik fakta; desain berbeda dari deployment.
2. **Keamanan:** otorisasi sebelum bentuk, scope/validity, MFA/SoD, RLS non-bypass, audit tamper-evident, masking dan DSAR/retensi.
3. **Analisis bisnis:** platform/Admin IT berbeda dari BAAK/BAUK/HRD/fakultas/dosen/mahasiswa; lisensi berbeda dari opt-out; referensi nasional dan hukum perlu verifikasi.
4. **QA:** alur UI nyata, state gagal/empty, mock, idempotensi/FK tenant, aksesibilitas dan paritas klien memerlukan bukti per skenario.
5. **DevOps:** profil beban, failover/restore, bounded locks dan HA/ZDD diuji di staging; jumlah tes tidak menggantikan drill atau sertifikasi.

Kelima lensa menghasilkan pertanyaan dan kebutuhan bukti, bukan skor validasi eksternal.

---

## 7B. Benchmark eksternal menu administrator (2026-10-24) — Sevima "Administrasi Aplikasi" + 12 produk lain

Bagian ini menjawab pertanyaan pemilik yang berbeda dari §7A. §7A membandingkan **cakupan modul** (skor inventaris internal); §7B membandingkan **menu administrator** — gugus apa yang benar-benar tersedia untuk Admin IT dan operator platform di produk lain, supaya tidak ada daun yang hilang karena kita tidak tahu ia harus ada.

**Metode dan batas bukti.** Dua putaran riset sumber terbuka (dokumentasi vendor, basis pengetahuan resmi, panduan universitas yang memakai produk, dokumentasi komunitas). Tidak ada satu pun akun produk yang dibuka, jadi klaim berhenti sejauh dokumen publik mendukungnya. Tiga tingkatan dipakai dan **tidak boleh dicampur**: **[KUAT]** = nama menu disebut verbatim di dokumentasi resmi; **[SEDANG]** = kapabilitas terdokumentasi di panduan pihak ketiga/mirror, nama menu tidak selalu verbatim; **[TIPIS]** = halaman pemasaran tanpa pohon menu. **Kandidat gap hanya boleh lahir dari [KUAT] atau [SEDANG] yang berulang di ≥3 produk.** Workday, Ellucian, Unit4 dan eCampus berhenti di tingkat [TIPIS] untuk menu, sehingga tidak dipakai sebagai dasar gap; Tricampus/UCD, Metric, SmartCampus, K-Matrix, Garde dan Qwanza **tidak menghasilkan bukti yang dapat diverifikasi** dan dinyatakan sebagai tidak tersedia, bukan sebagai "sama saja".

### 7B.1 Pohon Sevima "Modul Administrasi Aplikasi" (peran Admin PT) dan peta-nya ke SICA — [KUAT]

Sumber: panduan resmi [Manajemen Pengaturan Aplikasi oleh Admin PT](https://knowledge.sevima.com/manajemen-pengaturan-aplikasi-sevima-platform-oleh-admin-pt/) dan [Fitur Log & Laporan](https://knowledge.sevima.com/fitur-log-dan-laporan-pada-modul-administrasi-aplikasi/). Kolom "SICA" mengukur katalog izin + `menu_items` hari ini, bukan rencana.

| Item Sevima (verbatim) | Padanan SICA hari ini | Vonis |
|---|---|---|
| Dashboard ▸ Statistik Login Pengguna | `identity.loginstats.view` **dipegang** `TENANT_ADMIN` (terukur dalam 97 kodenya); layar agregat per tenant belum ada | **data ada, layar belum** — bukan daun baru |
| Pengguna ▸ Unit Kerja / User / Role / Hak Akses | `admin.organisasi` · `admin.pengguna` · `admin.hak-akses` · `admin.permintaan-hak` (empat-empatnya berjalan, terbukti di browser) | **SETARA** |
| Log ▸ Log Login / Log Tabel / Log Transaksi | `audit.log.view` + `audit.export` dipegang; `/admin/audit` tenant sendiri; filter **per jenis perubahan** dan jejak restore belum | **PARITAS sebagian** — satu gap nyata: klasifikasi aksi |
| Pengaturan ▸ Perguruan Tinggi | `admin.parameters.meta` (daun baru siklus ini, gerbang `settings.meta.view`) | **SETARA** |
| Pengaturan ▸ PMB | milik `PMB_OPERATOR` (R-3), bukan Admin IT | **bukan hak R-2** — sesuai §6.8 |
| Pengaturan ▸ Halaman (favicon, background) | `settings.meta.*` mencakup label/urutan/visibilitas; **favicon/warna/halaman login tidak ternormakan** | **gap** → `P-12` butir (ii) |
| Pengaturan ▸ Email (kanal & template) | `FR-NTF-01` **sudah ada di PRD** (email in-app + gateway WA, template per peristiwa, preferensi) tetapi **nol** kode `notification.*` di katalog, nol daun, nol rute | **gap paling tajam**: spesifikasi ada, rantainya tidak |
| Pengaturan ▸ Plugin/Add-on | R-2 hanya `entitlement.module.view/.activate/.deactivate` di bawah lisensi yang sudah diberikan; registri aplikasi/token adalah objek lain | **gap** → `P-12` butir (vi) |
| Pengaturan ▸ Label (ubah nama field) | `settings.meta.*` (FR-ADM-09) | **SETARA** |
| Pengaturan ▸ Data Backup / File Backup (unduh) | §6.8 baris *maintenance*: **permission pending**, spec-only, dan restore DB sengaja **bukan** tombol | **gap** → `P-12` butir (iii) |
| Pengaturan ▸ Kustomisasi Form | `settings.customattr.*` + meta; daun `admin.parameters.customattr` baru dibuat siklus ini, layar `BELUM` | **PARITY di kontrak, layar belum** |
| Pengaturan ▸ Kustomisasi Kolom Data Master | `settings.meta.update` + `tenant_custom_attributes` (`DATA_MODEL §20` kelas D) | **SETARA** |
| Pengaturan ▸ Kustomisasi Laporan | FR-ADM-09 menyebut *template* laporan; **tidak ada report builder** dan `G-30` mencatat nol baris `EXPORT` untuk gugus baru (yang ada hanya 4: `academic.export.own/.bulk`, `assessment.export.bulk`, `audit.export`) | **gap** — kelas aksi dulu, menu belakangan |
| Pengaturan ▸ Kustomisasi Penandatanganan | blok tanda tangan masuk FR-ADM-09; eksekusi TTE milik M-13/`document.*`, dan `document.numbering.manage` **sudah dicabut** dari R-2 (`0093`) | **bukan daun R-2** — pemilik domain |
| Laporan ▸ Daftar User / Log Login | proyeksi yang sama dengan dua baris di atas | **SETARA** |
| **Login As** (impersonasi oleh Admin PT) | `identity.impersonation.grant` khusus `PLATFORM_OPERATOR` (§4.5 baris 317); R-2 hanya `.revoke` | **DITOLAK untuk R-2** → `P-13` |

### 7B.2 Bukti per produk pembanding

| Produk | Kuat bukti | Gugus menu admin yang terdokumentasi |
|---|---|---|
| [Sevima / siAkadCloud](https://knowledge.sevima.com/manajemen-pengaturan-aplikasi-sevima-platform-oleh-admin-pt/) · [registry modul](https://baak.upgrisba.ac.id/page/modul-sevima) | **[KUAT]** | Administrasi Aplikasi (15 item di §7B.1), Akademik, Keuangan, PMB, CBT, MBKM, SPMI, Akreditasi, Kepegawaian, Litabmas, SKPI/Tracer, E-Sign, Dashboard Pimpinan, SIM Kerjasama, Jaga Kampus, RPL, ProFeeder/GoFeeder, Helpdesk |
| [Canvas LMS — level Account](https://community.instructure.com/en/kb/articles/661579-how-do-i-use-account-settings) | **[KUAT]** | Account Settings, **Quotas**, Integrations (Teams), Notifications, Admins (penugasan peran), Announcements, Reports, Apps, **Feature Options**, Security (MFA, pembatasan IP, proxy), **Developer Keys**, **SIS Import**, Theme/branding, sub-account hierarkis |
| [Moodle — Site administration](https://docs.moodle.org/en/Manage_users) + mirror [Chapter 19](https://danielneis.github.io/how-to-use-moodle-27/chapter19.html) | **[SEDANG]** (docs.moodle.org menolak fetch) | Users (akun, role/permission, **Upload users CSV**), Appearance/Themes, Plugins & authentication, Reports/**logs**, Security, Server (path, **session handling**, **scheduled/ad-hoc tasks**), **Maintenance mode**, Backup/Restore, Languages |
| [Moodle Workplace multi-tenant](https://docs.moodle.org/311/en/multi-tenancy) | **[SEDANG]** | tenant allocation, tenant admin permissions, **branding per tenant**, hierarki kategori/user/laporan per tenant |
| [PeopleSoft Campus Solutions](https://docs.oracle.com/cd/F38458_01/psft/pdf/cs92lsas-b012021.pdf) | **[KUAT]** untuk struktur, bukan layar admin | Set Up SACR; Institution/**Campus**/School/Dept; Academic Career/Level; **Terms & Sessions**; grading scheme; Academic Institution Security |
| [Jenzabar CX / J1](https://my.kcu.edu/ICS/Help/J1/Campus%20Portal%20Features/en/crn_web_system_administration.html) | **[KUAT]** sempit | System Administration Manager; **Data Definitions** (kode alamat, tipe telepon); portal & portlet settings |
| [NeoCampus modul Administrator](https://neocampus.web.id/modul/administrator) | **[SEDANG]** (pemasaran teknis) | RBAC, **audit trail**, data master, **integrasi API**, **backup/recovery**, enkripsi, VA/e-billing, Feeder, dashboard pimpinan |
| [Enterprise Education / eCampus](https://ecampus.id/ecampus/WEB-INF/baru/erp.jsp) | **[TIPIS]** untuk menu | PMB…Aset, **Neo Feeder & EMIS**, WhatsApp Gateway, Sistem Pengajuan (beasiswa/KKN/PKL), Penelitian & Pengabdian, Karya Ilmiah, Perpustakaan, Koperasi, Kantin Digital; "modul dapat diaktifkan bertahap" = menu digerakkan entitlement |
| [Sevima siAkadCloud SLA](https://sevima.com/siakadcloud/sla/) | **[KUAT]** (kewajiban, bukan menu) | backup 3×/hari, retensi 90 hari, restore ≤4 jam, uptime ≥99% — ini **R-1**, bukan konsol kampus |
| [Feeder PDDIKTI — Admin PT](https://sites.google.com/sevima.com/knowledgebase-sevima-gofeederc/home/role/panduan-akun-tu-pada-sevima-gofeeder-cloud) | **[SEDANG]** (PDF 403, isi dari cuplikan) | **Log Feeder** dengan filter Tambah/Edit/Hapus/**Restore**; alur ubah nomor HP/email + **OTP**; role ganda satu user; impor mahasiswa |
| [OpenEduCat (Odoo)](https://github.com/openeducat/openeducat_erp) | **[SEDANG]** | Campus/Classroom, Library, Timetable, Fees, **Event/Website/CRM/WhatsApp**, Document — banyak di antaranya add-on Odoo, bukan inti SIAKAD |
| Unit4 SM · Workday Student · Ellucian · eCampuz · SIAKAD 4.0 · Educampus · Technophoria · MetaSchool · Slate | **[TIPIS]** | daftar fitur/ranah saja; **tidak** dipakai sebagai dasar gap |

### 7B.3 Vonis kesesuaian untuk dua peran Fase 1

**Sudah setara atau lebih ketat (terukur, bukan klaim):** penugasan peran ber-scope + antrean perubahan hak **empat-mata** (`access_change_requests`, `requiresMFA` pada aksi grant) — tidak satu pun pembanding mempublikasikan approval orang-kedua untuk pemberian peran; parameter operasional berversi dengan `approve.regulatory/.security` + riwayat beralasan; kamus dinamis + atribut kustom (Sevima berhenti di "Kustomisasi Kolom"); pemisahan R-1/R-2/pemilik domain yang eksplisit di dokumen dan **ditegakkan di API** (`e2e-r2-boundary` 24/24). Pada tiga hal terakhir ini SICA lebih ketat dari yang dapat saya buktikan ada di produk mana pun.

**Enam kapabilitas yang berulang di ≥3 produk dan belum punya daun di SICA** — didaftarkan sebagai `P-12` di `AUDIT_READINESS §10`, **bukan** sebagai menu yang sudah ada:

| # | Kapabilitas | Produk yang membuktikan | Ranah pemilik | Gerbang sebelum boleh jadi daun |
|---|---|---|---|---|
| i | Kanal notifikasi + registri template + pelacakan kirim (email/WA/SMS/push) | Sevima Email, Canvas Notifications, eCampus WA Gateway, OpenEduCat | R-2 konfigurasi; isi pesan milik unit pengirim | `FR-NTF-01` → kode `notification.*` ber-nomor di §4.5 → DDL template → rute → layar → task |
| ii | Tema/branding portal (favicon, warna, halaman login) + pratinjau | Sevima Halaman, Canvas Theme, Moodle Workplace, NeoCampus | R-2 | perluas norma `settings.meta.*`; pratinjau tanpa `?at=` |
| iii | Unduh cadangan data/file tenant sendiri + riwayat pemulihan | Sevima Data/File Backup, NeoCampus, Moodle | **R-1 eksekusi**, R-2 **pengajuan + unduh** | baris maintenance §6.8 masih `pending`; restore tetap prosedur ops, bukan tombol |
| iv | Monitor tugas terjadwal/antrean + sesi aktif | Moodle Tasks/Session, Canvas Reports | R-2 lihat, R-1 kendalikan | **DITAHAN `RD-11`/`P-6`**: `bullmq`/`ioredis` bukan dependensi nyata; menormalkan layarnya hari ini melanggar `AGENTS §3.9` |
| v | Builder laporan & definisi laporan tersimpan + verba `EXPORT` | Unit4 Reporting, Canvas Reports, Sevima Kustomisasi Laporan | R-3 (pemilik data) + R-2 (teknis) | `G-30`: gugus baru belum punya baris `EXPORT`; kode dulu, menu belakangan |
| vi | Kunci API/token integrasi + registri aplikasi per tenant | Canvas Developer Keys/Apps, NeoCampus API, Sevima Plugin/Addon | R-2 mengajukan & mencabut, R-1 memvalidasi | **rahasia tidak pernah jadi baris parameter** (`§21.2`), hanya `credential_ref` + `ENV_CONTRACT §7` |

**Dua gap struktural yang sudah dikenal dan masih terbuka** (bukan temuan baru, tetapi benchmark mengonfirmasi relevansinya): hierarki multi-kampus/sub-akun (PeopleSoft Campus, Canvas sub-accounts, Moodle Workplace) terblokir migrasi `0044` + enum `SITE` yang belum nyata — task `#18`; dan impor massal (Canvas SIS Import, Moodle Upload users, Feeder import, Sevima export Excel) yang daunnya **sudah ada sebagai baris tersembunyi** (`admin.parameters.import`, `is_visible = false`, izin 319/320 masih `usulan`) — task `MENU-LOCK-3`.

**Yang tidak akan disalin.** Kemunculan tunggal: maintenance mode & environment check (Moodle), Quotas sebagai objek akun (Canvas), setup Host-to-Host VA oleh unit (MetaSchool — dan itu ranah BAUK, bukan Admin IT), penomoran surat/data definitions kode alamat (Sevima/Jenzabar — domain e-office). Penambahan bisnis yang benar-benar modul (AkreditasiCloud, Litabmas, EMIS, kemahasiswaan/SKPI, beasiswa, RPL/kurikulum ganda, koperasi, kantin) adalah **pekerjaan registri 48 modul** `PRD §5.12`, bukan menu administrator; sebagian sudah tercatat `BELUM` di sana (`litabmas` dan `ormawa` bahkan belum masuk `MODULE_CODES` — `G-10`).

### 7B.4 Koreksi atas dua klaim yang lahir dari riset ini

Riset sub-agent menghasilkan dua pernyataan yang **saya ukur ulang dan salah**: (a) "SICA nol izin berverba `EXPORT`" — salah, terukur ada empat (`academic.export.own/.bulk`, `assessment.export.bulk`, `audit.export`) dan `TENANT_ADMIN` memegang `audit.export`; yang benar adalah `G-30`: gugus **baru** belum punya baris `EXPORT`. (b) "Login As adalah gap R-2" — salah kategori: SICA menempatkannya sebagai objek R-1 dan §6.8 melabeli administrator tidak memberi hak masuk sebagai orang lain; ini keputusan (`P-13`), bukan kekurangan. Tidak ada angka di bagian ini yang disalin dari ringkasan agent tanpa pengecekan ke `SYSTEM_ROLE_GRANTS`, `menu_items`, atau `RBAC §4.5`.

### 7B.5 Batas bagian ini

Bagian ini adalah **pemetaan kelengkapan menu**, bukan klaim keunggulan produk dan bukan izin !CMDPLACEHOLDER!. Tidak satu pun dari enam butir §7B.3 boleh menjadi baris `menu_items` sebelum rantai `AGENTS §3.11` selesai (PRD → RBAC → DATA_MODEL → API_SPEC → UI_UX → ROADMAP → kode). §7A tetap pemegang skor cakupan modul; angkanya tidak dipindahkan ke mari dan sebaliknya (`RD-55`).

## 8. Catatan integritas dokumen

1. Bagian §2 memuat sumber dokumenter yang telah dikumpulkan; status versi, cakupan dan verifikasi resmi tetap harus dicatat. Sumber yang belum tersedia tetap terbuka: **[VERIFIKASI-VENDOR]** (pemilik: integrasi) atau **[VERIFIKASI-LEGAL]** (pemilik: legal) sesuai lingkupnya, bukan fakta hasil tebakan.
2. Setiap item §1.2/§5 yang bertanda ❌ adalah **pekerjaan tersurat**, bukan pekerjaan yang "nanti juga jadi".
3. Dokumen ini wajib dirujuk (dan diperbarui) oleh setiap task Admin di [ROADMAP_TASKS.md](file:///c:/SICA/docs/ROADMAP_TASKS.md) sebelum kode ditulis.
4. **§7A bukan penilaian kompetitif terukur.** Skor lama kedua produk subjektif; alat menghitung inventaris atau menguji skenario, bukan menghasilkan skor keunggulan. Lima lensa review internal bukan konsultasi pakar. Hasil historis perlu run/commit/lingkungan dan tidak membuktikan status sekarang; doc gates tidak membuktikan hukum, seluruh fitur atau superiority.
5. **§7B adalah peta kelengkapan menu, bukan klaim keunggulan dan bukan daftar kerja yang disetujui.** Setiap barisnya berhenti sejauh dokumen publik mendukung: **[KUAT]** hanya bila nama menu disebut verbatim di dokumentasi resmi produk pemiliknya, dan produk yang tidak menghasilkan bukti verifiabel (Tricampus/UCD, Metric, SmartCampus, K-Matrix, Garde, Qwanza) **dinyatakan tidak tersedia**, bukan disimpulkan setara atau tidak punya. Angka SICA di kolom "Padanan" diukur dari `SYSTEM_ROLE_GRANTS`, `menu_items` dev, dan `RBAC §4.5` — bukan dari ringkasan riset; dua klaim riset yang salah sudah dibanting dan dicatat di §7B.4. Enam kandidat gap berstatus **`P-12` (belum diputus)** dan **tidak satu pun** boleh menjadi baris `menu_items`, kode izin, atau rute sebelum rantai `AGENTS §3.11` selesai; §7B tidak punya wewenang memberi izin koding.



**Kolom Status bukan lagi tulisan tangan (2026-10-21).** Ia diregenerasi oleh `node .tools/bench-admin-delta.mjs`, yang membaca nama objek / alamat / kode izin dari sel "Padanan SICA" dan memeriksa tiga hal: apakah objek itu punya `CREATE TABLE` di `DATA_MODEL`, apakah alamatnya muncul sebagai rute di `API_SPEC`, dan apakah alamat itu punya spesifikasi layar di `UI_UX`. Sebelum ini kolom itu dirawat manual dan sudah salah dua arah: `Wilayah` tercetak "kamus wilayah belum ada" padahal `reference_dictionary_versions`/`_entries` sudah ber-DDL, `Setting Aplikasi` tercetak "`tenant_settings` belum dispesifikasi" padahal tabelnya ada dan `PRD §5.11.2` butir 13 sudah memvonis rumah bendera rilis, dan `Kalender Akademik` tercetak "tabel belum dibuat" padahal `academic_calendar_events` ada. Yang tidak bisa dibuktikan alat dicetak sebagai "tidak terpetakan alat", bukan sebagai klaim.