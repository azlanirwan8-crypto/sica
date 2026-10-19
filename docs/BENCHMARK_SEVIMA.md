# SICA — Benchmark Sevima & Spesifikasi Modul Administrasi (Master Data)

| | |
|---|---|
| **Status** | Aktif — dokumen rujukan sebelum kode (standing rule Principal Lead Architect) |
| **Tanggal** | 2026-10-19 |
| **Pemilik** | Principal Lead Architect / SIAKAD Domain Analyst |
| **Rujukan** | [PRD.md](file:///c:/SICA/docs/PRD.md) · [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md) · [API_SPEC.md](file:///c:/SICA/docs/API_SPEC.md) · [UI_UX_DESIGN.md](file:///c:/SICA/docs/UI_UX_DESIGN.md) · [ROADMAP_TASKS.md](file:///c:/SICA/docs/ROADMAP_TASKS.md) · [AGENTS.md](file:///c:/SICA/AGENTS.md) |
| **Cakupan** | (1) peran, (2) menu per peran, (3) katalog modul, (4) data master & pendukung, (5) flow/alur — Sevima vs SICA |

---

## 0. Mengapa dokumen ini ada

SICA diposisikan sebagai pengganti SIAKAD legacy kampus Indonesia, dan tolok ukur lapangan yang paling banyak dipakai adalah **Sevima** (SEVIMA Platform / siAkadCloud, GoFeeder & ProFeeder, EdLink, CBT, SPMB/PMB, Finance Cloud, SIM Kepegawaian, Karirlink, SPMI, Litabmas — lihat §2A.1 untuk penamaan resmi). Permintaan eksplisit: **pelajari seluruh dokumentasi Sevima** (direktori produk, penjelasan, panduan/manual), lalu tuangkan hasilnya sebagai catatan resmi supaya:

1. Peta **peran → menu → modul → data master → flow** SICA lengkap sebelum satu baris kode Admin ditulis.
2. Ada **selisih (gap) yang jujur** antara apa yang Sevima punya dan apa yang SICA sudah implementasi.
3. Prioritas pengerjaan Area Admin (dimulai dari **Data Master**) punya dasar, bukan asumsi.

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

## 1. Kondisi SICA hari ini (garis awal)

### 1.1 Tabel yang SUDAH ada sebagai kode Drizzle `[KODE]`
Terverifikasi dari `packages/database/src/schema/*.ts` (25 tabel domain/platform):

| Gugus | Tabel |
|---|---|
| Platform & identitas | `tenants`, `tenant_domains`, `plans`, `subscriptions`, `tenant_quotas`, `tenant_usage`, `users`, `password_history`, `tenant_memberships`, `sessions`, `refresh_tokens`, `mfa_factors` |
| Master akademik | `organizations`, `academic_years`, `academic_periods`, `study_programs`, `grade_scales`, `grade_scale_bands`, `curricula`, `courses`, `rooms` |
| Personel & biodata | `students`, `lecturers`, `staff`, `student_addresses`, `student_guardians` |
| Kelas & pembelajaran | `classes`, `class_assignments`, `class_schedules`, `class_sessions`, `class_waitlists` |
| Penilaian & presensi | `enrollments`, `attendances`, `grade_components`, `grades`, `grade_corrections` |
| Entitlement modul | `modules`, `module_dependencies`, `plan_modules`, `tenant_modules` |

### 1.2 Objek yang HANYA ada di dokumen, belum jadi tabel `[KODE]` vs [DATA_MODEL §5]
Ini pekerjaan wajib Area Admin, karena menu Admin tidak bisa dibentuk tanpa objeknya:

| # | Objek | Fungsi di menu Admin | Dampak bila belum ada |
|---|---|---|---|
| A-1 | `academic_calendar_events` | **Kalender Akademik** (tanggal kunci per periode, termasuk tenggat laporan PDDikti BR-R9) | Tidak ada "buka/tutup jendela" terstruktur; deadline diatur manual |
| A-2 | `course_prerequisites` | **Prasyarat Mata Kuliah** (BR-A3, BR-A16) | Validasi prasyarat KRS tidak bisa ditegakkan per matakuliah |
| A-3 | `blockades` | **Cekal** 4 dimensi (BR-A7, FR-AKA-10) | Gerbang blokir hanya asumsi; tidak bisa menegah KRS/yudisium |
| A-4 | `academic_rules` | **Pengaturan Akademik per Prodi-Periode** (FR-AKA-12) — padanan "Setting Akademik" di SIAKAD lain | Semua ambang (band SKS, gerbang, denda) tidak bisa dikonfigurasi per kampus → memaksa fork kode, melanggar prinsip P4 |
| A-5 | `student_status_history` | **Status Mahasiswa** (aktif/cuti/DO/pindah/lulus) + riwayat | Perubahan status tak teraudit; feeder riwayat akademik mustahil |
| A-6 | `permissions`, `roles`, `role_permissions`, `user_role_assignments`, `access_change_requests` | **Hak Akses** & penugasan role ber-scope (prodi/periode/kelas) | RBAC kini hanya enum 5 nilai di `tenant_memberships.role`; tidak ada scope → tidak bisa bedakan Kaprodi prodi A vs B |
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

### 2.10 Selisih SICA ↔ Sevima pada area Admin (tabel kerja)
| Objek/layanan Sevima | Padanan SICA | Status SICA |
|---|---|---|
| `Data Pelengkap` 6 kategori master | `/admin/master/**` | ❌ belum ada (skema sebagian ada, UI/API nol) |
| `Status Hadir`, `Jenis Pertemuan`, `Slot Waktu`, `Unsur Nilai`, `Jenis Matakuliah`, `Kelompok Matakuliah`, `Bidang Ilmu` | tabel data referensi (§5.1 M-17) | ❌ belum ada tabel |
| `Wilayah` (Negara/Propinsi/Kota/Kecamatan/Kelurahan) | `student_addresses.*Code` | ◐ kolom ada, **kamus wilayah belum ada** |
| `Biodata > Agama/Pekerjaan/Suku/Penghasilan` | enum `income_band` saja | ◐ sebagian (`incomeBand`), agama/pekerjaan/suku masih teks bebas |
| `Status Mahasiswa` + `Jenis Keluar` (feeder) | `student_status` enum + `feederStatusCode` | ◐ enum ada, **riwayat & kamus jenis keluar belum** (P-10) |
| `Setting Prodi` 9 tab per prodi-periode | `academic_rules.params` | ❌ tabel belum dibuat → **prioritas ADM-6** |
| `Setting Aplikasi` toggle global | `tenant_settings` | ❌ belum dispesifikasi |
| `Periode Akademik` + buka/tutup | `academic_periods.status` | ✅ skema ada, ❌ UI/API belum |
| `Kalender Akademik` (+ `Libur`) | `academic_calendar_events` | ❌ tabel belum dibuat (dok §5 ada) |
| `Skala Nilai` level PT & prodi | `grade_scales`+`grade_scale_bands` per kurikulum | ✅ ada (model sedikit beda: per kurikulum, bukan per prodi) |
| `Komposisi Nilai` (mustahak 100%) | `grade_components` + AC-NIL-4 | ✅ skema & aturan ada, ❌ UI Admin belum |
| `Generate Kelas` massal | service baru (`ADM-5`) | ❌ |
| `Generate Pertemuan` (lewati libur) | `class_sessions` sudah ada | ◐ tabel ada, generator belum |
| `Update Kelas Massal` via Excel / `Import Jadwal` | jalur impor (`ADM-9`) | ❌ |
| `Plotting Dosen` + `SKS Dosen` | `class_assignments` | ✅ skema, ❌ guardrail BR-A11 di UI |
| `Status Semester` massal + `Generate Status Perwalian` | `student_status_history` + DPA assignment | ❌ |
| `Pindah Program Studi` (NIM asal→tujuan) | alur khusus | ❌ |
| `Umumkan Nilai` vs `Kunci Nilai` | `grade_status` (`DRAFT`/`SUBMITTED`/`EFFECTIVE`) | ✅ model ada, perlu dipetakan istilah UI |
| `Pemutihan Nilai`, `Hitung Ulang IPS/IPK/Transkrip` | service recalculation | ◐ kalkulator ada, endpoint recalc belum |
| `Ekivalensi Mata Kuliah`, `RPL`, `Pemaketan KRS` | belum ada | ❌ (tambah backlog) |
| `Monitoring Pengisian Nilai`/`Ruang` | dashboard admin | ❌ |
| `Kelompok Tagihan`, `Tarif`, `Generate Tagihan`, `Cekal`, `Tutup Buku` | modul `finance` (skema dok §5) | ❌ tabel & UI |
| `Persuratan` (template + penomoran + TTE) | `document_signatures` + sub-modul dokumen | ◐ dok saja |
| OBE (CPL/CPMK, pemetaan capaian) | FR-P2-13 | ❌ Phase 2 |
| `Login As` | impersonation ter-audit (PRD J6) | ❌ |
| `Log Tabel`/`Log Transaksi` | `audit_logs` | ❌ tabel belum dibuat di kode |
| `Kustomisasi Form/Kolom/Laporan` | meta-konfigurasi per tenant | ❌ (backlog produk penting) |
| Neo Feeder 20 pemetaan sumber | `pddikti_mappings` | ❌ tabel belum dibuat |

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
→ **Posisi SICA:** lisensi **per modul + per seat** (`plan_modules.seat_limit`, `tenant_modules.seats`, `license_metric ∈ INCLUDED|PER_SEAT|FLAT`) yang **self-service** lewat `/admin/modul`, dengan metering ke `tenant_usage`. Jangan meniru gating yang hanya bisa diubah vendor (D-1).

### 2A.5 Aspek hosting/multi-tenant Sevima `[DOK]` `[PUB]`
Domain per kampus: `<kampus>.siakadcloud.com`, `<kampus>.sevimaplatform.com`, `<kampus>.gofeedercloud.com`, `<kampus>.karirlink.id` (contoh live: universitaswidyatama, universitaspawyatandaha, insipemalang). Klaim infrastruktur [sevima.com/hosting](https://sevima.com/hosting/): **server di Indonesia**, **"dedicated, tidak dibagi tenant lain"**, 1 IP publik, akses root/SSH, pemulihan <15 menit, **SLA uptime 99,9%**, migrasi penuh; tersedia juga jalur on-premise/VPS.
→ Ini berarti model Sevima = **isolasi per-tenant lewat subdomain + server khusus**, **bukan** satu basis data ber-`tenant_id`. Konsekuensi untuk kita:
1. SICA justru menjual **RLS default-deny multi-tenant** (1 klaim berbeda: biaya infra rendah, provision ≤ 14 hari, patch sekali untuk semua) — tetapi harus siap menjawab keberatan "data saya tidak dicampur kampus lain". Jawabannya sudah ada di dokumentasi kita: [DATA_MODEL §6](file:///c:/SICA/docs/DATA_MODEL.md#L917) + PRD P1 + NFR-S1 (uji penitrasi 2-tenant).
2. Angka SLA Sevima (99,9%, pemulihan <15 mnt) menjadi **target pembanding yang harus kami kalahkan atau samai**: PRD NFR-A1 saat ini 99,5%/bulan dan NFR-A2 RTO ≤ 4 jam — **REKONSILIASI: naikkan target NFR-A1 ke 99,9% dan RTO ≤ 15 menit** agar tidak kalah pada poin yang dijual kompetitor (lihat §7).

### 2A.6 Model hak akses Sevima — **adopt pola izinnya** `[DOK]`
- Tingkatan admin pada Administrasi Aplikasi: **Non Admin** (tidak punya akses modul), **Admin Pengguna** (Dashboard, Pengguna, Laporan saja), **Admin Edlink**, **Admin Aplikasi** (Dashboard, Pengguna, Log, Pengaturan, Laporan, Login As). Catatan resmi: *"Menu Login As hanya bisa diakses dari sisi Admin Aplikasi"*, *"Hak Akses … hanya Admin Aplikasi"*.
- **Matriks izin per menu = 6 aksi**: `Read`, `Insert`, `Update`, `Delete`, `Validate`, `Other`, disaring per **aplikasi + role**, disimpan lewat tombol `SIMPAN`. ([Setting Hak Akses Finance Cloud](https://knowledge.sevima.com/f-setting-hak-akses-pada-sevima-finance-cloud/))
- Role dapat **ditambah sendiri** oleh Admin PT; `User` otomatis ter-create saat modul Kepegawaian/Akademik menambah data; **pegawai non-dosen wajib ditambah manual** (`Pengguna > User > Tambah`).
- Scope orang tua (`Portal > Mahasiswa` read-only) *"bisa disesuaikan oleh admin di Administrasi Aplikasi ⇒ Pengguna ⇒ Hak Akses"*.
→ **Keputusan desain SICA (mencatat, belum kode):** permission model kita (`permissions`/`roles`/`role_permissions`/`user_role_assignments`, [DATA_MODEL §3](file:///c:/SICA/docs/DATA_MODEL.md#L284)) harus memakai **verb yang sama 6 aksi** (`READ/INSERT/UPDATE/DELETE/VALIDATE/OTHER`) supaya setara daya ungkap, **tetapi** ditambah **scope** (prodi/periode/kelas/org) yang tidak dimiliki Sevima, dan **tanpa** self-service escalation (ubah izin → `access_change_requests` empat-mata + audit). `Validate` dipetakan eksplisit ke aksi persetujuan (validasi KRS, approval koreksi nilai, approval status).

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
→ **Gap SICA yang tercatat:** daftar peran §3 kita belum memuat **`admin_pmb`**, **`admin_kepegawaian`**, **`auditor`/`auditee`**, **`admin_lppm`/`reviewer`**, **`afiliator`**, dan **`tu`**. Sebagian sudah tercakup modul addon; kita wajib memutus apakah perlu role terpisah atau cukup satu `tenant_admin` + permission-grant (rekomendasi: **permission-grant, bukan role baru**, agar tidak mengulang ledakan role Sevima).

### 2A.8 Bukti pihak ketiga soal usability (memperkuat §2.8) `[PIHAK-KETIGA]`
- Evaluasi SIAKAD berbasis SEVIMA Platform di Universitas Ibnu Sina Batam: **skor SUS 61,12 (grade "OK")**, masalah utama *"kerumitan sistem dan ketidakkonsistenan fitur"*; rekomendasi eksplisit *"penyediaan panduan penggunaan setiap pembaruan sistem serta evaluasi usability secara berkala"*. ([ojs3.lppm-uis.org](https://ojs3.lppm-uis.org/index.php/JR/article/view/1462))
- Studi heuristic SIAKAD lain (UMG, UPN Jatim) menemukan pola *"kebingungan menemukan menu tertentu"* dan *"ketidakjelasan status proses"*. ([sibc.upnjatim.ac.id](https://sibc.upnjatim.ac.id/index.php/sibc/article/download/661/58/839))
- Failure mode yang diakui sendiri di judul artikel bantuan mereka: *"Fitur lupa password tidak berhasil mengirimkan email"*, *"Tidak Muncul Button Centang Saat Generate User Mahasiswa"*, *"Kenapa tiket yang sudah dibuat tidak muncul pada helpdesk admin?"* ([knowledge.sevima.com](https://knowledge.sevima.com/cara-menghubungi-layanan-support-sevima-platform/)) — **tanpa SLA tertulis publik**.

### 2A.9 Praktik yang TIDAK boleh SICA tiru (catatan audit) `[DOK]`
1. **Password default hasil reset = tanggal lahir `YYYYMMDD`** ([panduan reset password mahasiswa](https://knowledge.sevima.com/langkah-langkah-melakukan-reset-password-mahasiswa-pada-sevima-platform/)) → lemah & mudah ditebak. SICA: token reset sekali-pakai + wajib ganti sandi saat login + MFA untuk peran penulis (SECURITY §2).
2. **`Login As` tanpa justifikasi** → SICA: impersonation dengan alasan + MFA + TTL pendek + `audit_logs` (PRD J6).
3. **`Unit Kerja` baru muncul setelah "Migrasi" oleh vendor**; `Kustomisasi Penandatanganan/Laporan` hanya bila belum pernah dikustomisasi Tim Teknis; kelompok `Aplikasi` sengaja tidak boleh diubah admin → lock-in. SICA: semua konfigurasi = data yang bisa diedit tenant dalam batas regulasi, dengan diff + audit.
4. **Isolasi via server dedicated** → mahal & lambat provision; tidak meniadakan kebutuhan RLS. SICA: RLS + ku Tenant (`tenant_quotas`) + anti noisy-neighbor.

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

## 3. Dimensi 1 — Peran (role) yang SICA harus dukung
> **Catatan kepemilikan:** daftar di bawah adalah **peran tampilan** (15) untuk keperluan pemetaan menu. Katalog **normatif** hak akses — 22 peran ber-scope + ~160 kode permission + matriks aksi — ada di [RBAC_MATRIX.md §2](file:///c:/SICA/docs/RBAC_MATRIX.md); rekonsiliasi kedua daftar ada di [RBAC_MATRIX §11](file:///c:/SICA/docs/RBAC_MATRIX.md).

Diturunkan dari [PRD §3 Persona](file:///c:/SICA/docs/PRD.md) (11 persona) + kebutuhan regulasi (BR-R11 operator feeder, BR-K2 dual-approval keuangan) + kenyataan lapangan bahwa **satu orang memegang banyak peran**.

| # | Kode role | Nama tampilan | Scope melekat pada | Modul wajib | Fase |
|---|---|---|---|---|---|
| R-01 | `super_admin` | Platform Operator | lintas-tenant (break-glass ter-audit) | `identity`, `audit` | 1 |
| R-02 | `tenant_admin` | Administrator Kampus (BAAK) | tenant (lintas prodi) | Core penuh | 1 |
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
1. Role **tidak pernah** global-butuh-scope. Penugasan disimpan di `user_role_assignments` dengan kolom scope (`program_id`, `period_id`, `class_id`, `org_id`) — sudah dispesifikasi di [DATA_MODEL §3](file:///c:/SICA/docs/DATA_MODEL.md#L309) tetapi **belum di-implementasi** (§1.2 A-6).
2. Server = sumber kebenaran otorisasi (PRD P5). Menyembunyikan menu di UI **bukan** kontrol akses; setiap rute API Admin memakai guard 3 lapis: verifikasi JWT → cek role/scope → `withModule(code)`.
3. Perubahan hak akses bersifat **empat-mata** (`access_change_requests`): tidak ada self-escalation, dan setiap grant dicatat ke `audit_logs`.
4. Semua peran penulis-admin **wajib MFA** (FR-IDT-01).

---

## 4. Dimensi 2 & 3 — Peta menu per peran × modul

Kode modul = 19 modul entitlement nyata ([DATA_MODEL §12.2](file:///c:/SICA/docs/DATA_MODEL.md#L1296)). Legenda kolom **Menu**: `●` penuh (CRUD), `◐` baca/aksi terbatas, `–` tidak terlihat.

### 4.1 MENU — Administrator Kampus (`tenant_admin`) & `kaprodi` (scope prodi)
Ini "Area Admin" yang akan kita bangun pertama. Kelompok menu mengikuti urutan kerja taman mahasiswa baru → tutup periode.

| Kelompok menu | Item menu | Rute web usulan | Modul | Owner |
|---|---|---|---|---|
| **A. Umum** | Ringkasan & kesehatan data tenant (pra-go-live report) | `/admin` | `academic` | admin |
| | Profil institusi & identitas PT (nama, alamat, kode PDDikti, logo, timezone) | `/admin/institusi` | `identity` | admin |
| | Struktur organisasi (fakultas / jurusan / unit / perpustakaan) | `/admin/organisasi` | `academic` | admin |
| **B. Data Master** | Tahun akademik | `/admin/master/tahun-akademik` | `academic` | admin |
| | Periode / semester (DRAFT→OPEN→CLOSED) | `/admin/master/periode` | `academic` | admin |
| | Kalender akademik & tanggal kunci (termasuk tenggat PDDikti BR-R9) | `/admin/master/kalender` | `academic` | admin |
| | Program studi (jenjang, kode PDDikti, akreditasi, plafon SKS BR-R2/R3/R4) | `/admin/master/prodi` | `academic` | admin·kaprodi |
| | Kurikulum (versi, masa berlaku, skala nilai) | `/admin/master/kurikulum` | `academic` | kaprodi |
| | Mata kuliah (SKS teori/praktik/kerja/lab, tipe, bahasa pengantar) | `/admin/master/matakuliah` | `academic` | kaprodi |
| | Prasyarat & ko-requisite matakuliah (BR-A16) | `/admin/master/prasyarat` | `academic` | kaprodi |
| | Skala nilai & band konversi (FR: skala per kurikulum) | `/admin/master/skala-nilai` | `assessment` | kaprodi |
| | Komposisi bobot penilaian (harus 100%, AC-NIL-4) | `/admin/master/komposisi-nilai` | `assessment` | kaprodi |
| | Ruang & gedung (kapasitas, tipe lab/kelas, fasilitas) | `/admin/master/ruang` | `teaching` | admin |
| | Data referensi nasional (agama, pekerjaan, penghasilan, wilayah, jalur masuk, jenis sekolah) | `/admin/master/referensi` | `academic` | admin |
| **C. Personel (Kepegawaian Akademik)** | Mahasiswa (+ biodata feeder, alamat, ortu, foto) | `/admin/personel/mahasiswa` | `academic` | admin·kaprodi |
| | Perubahan status mahasiswa (aktif/cuti/DO/pindah/lulus) beralasan + riwayat | `/admin/personel/status-mahasiswa` | `academic` | admin·kaprodi |
| | Dosen (NIDN/NUPTK, rumpun, homebase, jabatan fungsional) | `/admin/personel/dosen` | `academic` | admin |
| | Tendik/staf | `/admin/personel/staf` | `hr_bkd` | admin |
| | Pembimbing akademik (pasang dosen-wali per angkatan/prodi) | `/admin/personel/dosen-wali` | `enrollment` | kaprodi |
| **D. Penyelenggaraan** | Kelas & kelas paralel (generate massal per kurikulum) | `/admin/penyelenggaraan/kelas` | `teaching` | kaprodi |
| | Penugasan dosen ke kelas + guardrail beban mengajar 16 SKS (BR-A11) | `/admin/penyelenggaraan/pengampu` | `teaching` | kaprodi |
| | Jadwal mingguan & deteksi bentrok (AC-JDW-1) | `/admin/penyelenggaraan/jadwal` | `teaching` | kaprodi |
| | Generate pertemuan/sesi (1..16, geser hari libur) | `/admin/penyelenggaraan/pertemuan` | `teaching` | dosen·kaprodi |
| **E. Pengaturan Transaksional** | Pengaturan prodi-per-periode (jendela KRS/validasi/cetak/input nilai/kuesioner) = `academic_rules` | `/admin/pengaturan/akademik` | `enrollment` | admin·kaprodi |
| | Gerbang & cekal (4 dimensi, BR-A7) | `/admin/pengaturan/cekal` | `finance`·`academic` | admin |
| | Kebijakan DO/peringatan akademik (BR-S1) | `/admin/pengaturan/retensi-studi` | `academic` | admin |
| | Paket/komoditas biaya & komponen tarif (BR-K1) | `/admin/keuangan/tarif` | `finance` | keuangan |
| | Modul & add-on aktif (entitlement) | `/admin/modul` | `identity` | admin |
| **F. Pengguna & Hak Akses** | Pengguna, sesi aktif, reset/unduh MFA | `/admin/pengguna` | `identity` | admin |
| | Peran & penugasan ber-scope (matriks izin) | `/admin/pengguna/hak-akses` | `identity` | admin |
| | Log aktivitas (audit, filter per aktor/entitas) | `/admin/audit` | `audit` | admin |
| **G. Migrasi & Impor** | Impor XLSX/CSV master + laporan rekonsiliasi (AC-MIG-1) | `/admin/impor` | `academic` | admin |
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
`admin` → kumpulkan exception (nilai `K`, KRS belum disetujui, tagihan belum lunas) → **kunci periode** (`CLOSED`) → sistem menolak semua operasi tulis (BR-A9) → historis terkunci → bila perlu koreksi: `period_reopen_requests` (ber-approval + audit) atau `grade_corrections` (BR-G4). **Tanpa hard-delete** (BR-R10).

### 6.3 F-ADM-C — Impor master data legacy (J1 onboarding, ≤14 hari)
Unduh templat → unggah XLSX/CSV per entitas dengan **urutan dependensi** (prodi → matakuliah → kurikulum → dosen → mahasiswa) → **validasi pra-import** (NIM duplikat, dosen tanpa NIDN, prodi tanpa akreditasi, baris yatim) → laporan rekonsiliasi (baris sumber / terimpor / ditolak + alasan) → apply dalam transaksi per-batch + audit → baru tenant boleh `LIVE` (AC-MIG-1).

### 6.4 F-ADM-D — Perubahan data historis yang diizinkan
Tiga jalur legal saja: **(1)** koreksi biodata PII (mahasiswa/ortu) → audit + notifikasi; **(2)** perubahan status mahasiswa → butuh approval + alasan + `student_status_history`; **(3)** koreksi nilai pasca-kunci → usul dosen → approve kaprodi → **reversing row**, bukan `UPDATE` diam-diam. Semua yang lain ditolak dengan alasan terukur.

### 6.5 F-ADM-E → loop transaksi yang sudah hidup hari ini
OW/KRS (submit DB-backed + advisory lock ✅) → approval DPA (route ada, **masih mock** — lihat ROADMAP §2.3) → presensi QR ✅ → nilai ✅ → KHS/IPK ✅ → yudisium ❌ → feeder ❌.

---

## 7. Urutan pengerjaan Area Admin (keputusan)

Dasar: **master data adalah fondasi** — semua transaksi (KRS, nilai, presensi, tagihan, feeder) punya FK ke objek §5.1; dan hari ini hanya seed script yang bisa mengisinya.

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

Validasi wajib setiap slice (standing DoD): `tsc` 0 error · `lint` bersih · unit test kontrak+service · **integration test live Supabase** dengan RLS · audit event tercatat · i18n `id`+`en` · UI Velzon (§2.0 UI_UX_DESIGN).

---

## 8. Catatan integritas dokumen

1. Bagian §2 (fakta Sevima) sengaja dibiarkan kosong sampai sumbernya terkumpul; kami tidak menaruh tebakan di tempat bukti.
2. Setiap item §1.2/§5 yang bertanda ❌ adalah **pekerjaan tersurat**, bukan pekerjaan yang "nanti juga jadi".
3. Dokumen ini wajib dirujuk (dan diperbarui) oleh setiap task Admin di [ROADMAP_TASKS.md](file:///c:/SICA/docs/ROADMAP_TASKS.md) sebelum kode ditulis.

