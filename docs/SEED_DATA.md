# SICA Master Seed Data Specification (Development & Staging)
**Status:** Canonical Reference & Fixture  
**Target Environment:** Local Docker Compose & Cloud Staging  
**Tenant Context:** Universitas Nusantara (`subdomain: nusantara`)  
**UUID Seed Namespace:** Deterministic UUID v4 / UUID v7  

---

## 1. Kredensial Login Default untuk Pengujian (Testing Accounts)

Untuk mempermudah pengujian otentikasi lintas role (RBAC) pada Web Portal dan Mobile App, seluruh akun seed memakai **satu sandi seragam**. *Catatan akurasi (diralat 2026-10-19, `AUDIT_READINESS RD-24`): paragraf ini dulu mengklaim hash Argon2id. Kenyataan kode hari ini = **Scrypt peppered** karena paket `argon2` native belum menjadi dependensi (lihat §1.1 di bawah dan `SECURITY_COMPLIANCE §2.1`); contoh hash di bawah hanyalah ilustrasi bentuk, **bukan** nilai yang ada di basis data seed.*

> **Password Default Seluruh Akun Testing:**  
> `SicaDemo2026!`  
> *(Hash Argon2id: `$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQxMjM0NTY3OA$9lJkQk4F+p3q+u18WqF...`)*

| Role | Username / Identifier | Email Login | Nama Lengkap | Unit / Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **Admin Akademik (operasional, bukan Admin IT)** | `adm.nusantara` | `admin@sica.ac.id` | **Bambang Wijaya, S.Kom., M.T.** | Kepala Biro Administrasi Akademik (BAAK); assignment/izin mengikuti RBAC, bukan alias login |
| **Dosen / DPA** | `0412088501` | `dosen@sica.ac.id` | **Dr. Eng. Ir. Hendra Gunawan, S.T., M.T.** | Dosen Teknik Informatika / DPA Utama |
| **Mahasiswa Aktif** | `220601001` | `mahasiswa@sica.ac.id` | **Ahmad Rizky Pratama** | Mahasiswa S1 Teknik Informatika (Sem 5) |

### 1.1 Seed dev yang SUDAH runnable (minimal, Supabase dev) — 2026-10-18
Skrip nyata: `apps/web/src/scripts/dev-seed.ts` → `pnpm --filter @sica/web seed:dev` (idempoten).
Hash sandi memakai **Scrypt peppered** (bukan Argon2id — `argon2` native belum terpasang; adapter siap tukar). Akun & kredensial aktual saat ini (tenant slug **`demo`**):

| Role | Identifier (NIM/NIDN/Email) | Password dev | MFA dev |
| :--- | :--- | :--- | :--- |
| platform operator (R-1) | `platform@demo.sica.test` (slug tenant `platform`) | `PlatformPass!23` | **wajib** |
| tenant_admin | `admin@demo.sica.test` / `ADMIN01` | `AdminPass!23` | tidak — sengaja, agar gerbang `401 MFA_REQUIRED` tetap teruji |
| tenant_admin (pemohon) | `admin2@demo.sica.test` / `ADMIN02` | `Admin2Pass!23` | **wajib** |
| tenant_admin (penyetuju kedua) | `admin3@demo.sica.test` / `ADMIN03` | `Admin3Pass!23` | **wajib** |
| dosen | `dosen@demo.sica.test` / `NIDN9001` | `LecturerPass!23` | tidak |
| mahasiswa | `mhs@demo.sica.test` / `2201010045` | `StudentPass!23` | tidak |

**Secret TOTP dev (HANYA lokal, vektor RFC 6238, dicetak seed sebagai `otpauth://`):** `GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ`. Kode 6 digit dihitung dari secret ini; `node .tools/totp-dev.mjs` mencetak kode yang sedang berlaku. Dua admin ber-MFA (`admin2`/`admin3`) adalah fixture uji **empat-mata tingkat akun** pada `PENDING → APPROVED`: bukti yang dapat diperoleh hanya pemohon dan penyetuju memiliki `userId` berbeda, **bukan dua manusia berbeda**. Satu manusia dapat mengendalikan kedua akun; fixture ini tidak membuktikan pencegahannya.

> Tabel §1/§2+ (2 fakultas, 10 dosen, periode, Argon2id) = **spesifikasi target**, belum di-seed penuh. Seed dev kini mengaktifkan 9 modul **core** untuk tenant `demo` (`identity · academic · teaching · enrollment · attendance · assessment · finance · feeder_pddikti · audit`) agar UI/entitlement tidak kosong. Terverifikasi login HTTP 200 (JWT RS256 nyata), 401 salah sandi, 422 tenant asing.
>
> **Residu uji — mekanisme cleanup ada, tetapi tidak aman untuk apply rutin (`RD-146`, ralat forensik Fase 1).** `apps/web/src/scripts/dev-seed-clean.ts` menolak `NODE_ENV=production` dan mencari tenant `demo`, tetapi dua pagar itu **bukan bukti kepemilikan satu run**. Predikat `access_change_requests.status = 'PENDING'` mencakup semua permintaan tertunda tenant tersebut, bukan hanya fixture; predikat `users.email LIKE 'r2-%@demo.sica.test'` bersifat global, dan penghapusan user dapat menyentuh relasi/cascade di luar run uji. Pola `UJI%` dan `attendance.uji_e2e%` juga bukan identitas run unik. Hitungan dry-run tidak merinci seluruh relasi yang akan dihapus.
>
> **Jangan jalankan `--apply` dengan mekanisme yang ada.** Status residu tidak ditutup hanya karena pembersih tersedia. Perbaikan mendatang wajib: manifest kepemilikan `run_id` + tenant + ID eksplisit setiap fixture/relasi; dry-run berdaftar-ID dan dampak FK/cascade; snapshot sebelum tindakan; persetujuan atas diff; pengecekan tenant serta kepemilikan ulang dalam transaksi; dan pembandingan data non-run sebelum/sesudah. Pengguna global atau relasi tenant lain tidak boleh dihapus hanya berdasarkan pola email. Siklus docs-only ini tidak menjalankan penghapusan maupun memperbaiki skrip.
>
> **Bukti audit terpisah dari cleanup.** Tidak adanya `DELETE audit_logs` di skrip tidak membuktikan rantai lama tetap utuh. Verifikasi mendatang harus membaca **tenant yang sama**, segmen/rentang historis yang sama, jumlah baris serta checkpoint hash sebelum/sesudah; ketidaksesuaian dibuka sebagai insiden, bukan diperbaiki dengan menghitung ulang hash. `apps/web/src/scripts/verify-audit-chain.ts` membuat tenant sintetis baru, menambah tiga baris baik dan satu sisipan dengan hash salah: itu menguji deteksi fixture, **bukan** bukti bahwa audit tenant `demo` setelah cleanup tetap utuh.

---

## 2. Profil Perguruan Tinggi (Tenant Profile)

```json
{
  "id": "019183ab-0001-7000-8000-000000000001",
  "code": "UNUS",
  "name": "Universitas Nusantara",
  "subdomain": "nusantara",
  "customDomain": "academic.nusantara.ac.id",
  "nationalCode": "001099",
  "accreditationStatus": "Unggul",
  "legalEntity": "Yayasan Pendidikan Nusantara Mandiri",
  "address": "Jl. Merdeka No. 101, Kota Bandung, Jawa Barat 40115",
  "coordinates": { "latitude": -6.914744, "longitude": 107.609810 },
  "activePeriodId": "019183ab-0002-7000-8000-000000000001"
}
```

### 2.1 Periode Akademik Aktif
- **ID:** `019183ab-0002-7000-8000-000000000001`
- **Kode:** `2026/2027-1`
- **Nama:** `Tahun Akademik 2026/2027 Semester Ganjil`
- **Tipe Semester:** `GANJIL` (Odd)
- **Status Operasional:** `OPEN` (enum `period_status` = `DRAFT|OPEN|CLOSING|CLOSED`; jendela pengisian KRS aktif). *Diralat 2026-10-19 — `AUDIT_READINESS RD-13`: nilai lama `OPEN_ENROLLMENT` bukan anggota enum, sehingga seed ini tidak dapat dimuat apa adanya.*
- **Rentang Tanggal:** 01 September 2026 s.d. 31 Januari 2027

---

## 3. Struktur Organisasi: 2 Fakultas & 4 Program Studi

### 3.1 Fakultas Teknik (FT)
- **ID:** `019183ab-0010-7000-8000-000000000001`
- **Nama Dekan:** Prof. Dr. Ir. Suyitno, M.Eng.

| No | ID Prodi | Nama Program Studi | Jenjang | Kode Prodi | Akreditasi | Kaprodi |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| 1 | `019183ab-0011-7000-8000-000000000001` | S1 Teknik Informatika | S1 | 55201 | Unggul | Dr. Maya Anggraini, S.Kom., M.Cs. |
| 2 | `019183ab-0012-7000-8000-000000000001` | S1 Sistem Informasi | S1 | 57201 | Baik Sekali | Ir. Fajar Nugroho, M.T. |

### 3.2 Fakultas Ekonomi & Bisnis (FEB)
- **ID:** `019183ab-0020-7000-8000-000000000001`
- **Nama Dekan:** Dr. Hj. Nurul Hidayati, S.E., M.M., Ak.

| No | ID Prodi | Nama Program Studi | Jenjang | Kode Prodi | Akreditasi | Kaprodi |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| 3 | `019183ab-0021-7000-8000-000000000001` | S1 Manajemen Bisnis | S1 | 61201 | Unggul | Dr. Rahmat Setiadi, S.E., M.B.A. |
| 4 | `019183ab-0022-7000-8000-000000000001` | S1 Akuntansi Keuangan | S1 | 62201 | Unggul | Siti Farida, S.E., M.Si., Ak., CA |

---

## 4. Master Data 10 Dosen Pengajar & Pembimbing

| No | NIDN | Nama Lengkap dengan Gelar | Email Kampus | Prodi Homebase | Jabatan Fungsional |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | `0412088501` | **Dr. Eng. Ir. Hendra Gunawan, S.T., M.T.** | `dosen@sica.ac.id` | S1 Teknik Informatika | Lektor Kepala |
| 2 | `0425038802` | **Dr. Maya Anggraini, S.Kom., M.Cs.** | `maya.anggraini@sica.ac.id` | S1 Teknik Informatika | Lektor |
| 3 | `0415119001` | **Bayu Pratama, S.Kom., M.T.** | `bayu.pratama@sica.ac.id` | S1 Teknik Informatika | Asisten Ahli |
| 4 | `0408048201` | **Ir. Fajar Nugroho, M.T.** | `fajar.nugroho@sica.ac.id` | S1 Sistem Informasi | Lektor Kepala |
| 5 | `0419078703` | **Dewi Sartika, S.T., M.Kom.** | `dewi.sartika@sica.ac.id` | S1 Sistem Informasi | Lektor |
| 6 | `0401027901` | **Dr. Rahmat Setiadi, S.E., M.B.A.** | `rahmat.setiadi@sica.ac.id` | S1 Manajemen Bisnis | Lektor Kepala |
| 7 | `0422068602` | **Arif Hidayat, S.E., M.M.** | `arif.hidayat@sica.ac.id` | S1 Manajemen Bisnis | Lektor |
| 8 | `0430099101` | **Nadya Putri, S.E., M.Sc.** | `nadya.putri@sica.ac.id` | S1 Manajemen Bisnis | Asisten Ahli |
| 9 | `0414018002` | **Siti Farida, S.E., M.Si., Ak., CA** | `siti.farida@sica.ac.id` | S1 Akuntansi Keuangan | Lektor Kepala |
| 10 | `0418058901` | **Wahyu Hidayat, S.E., M.Ak.** | `wahyu.hidayat@sica.ac.id` | S1 Akuntansi Keuangan | Lektor |

---

## 5. Master Data 20 Mata Kuliah Unggulan

### 5.1 Program Studi S1 Teknik Informatika
| No | Kode MK | Nama Mata Kuliah | SKS | Teori / Prak | Semester Rekomendasi |
| :---: | :--- | :--- | :---: | :---: | :---: |
| 1 | `TIF-101` | Algoritma dan Pemrograman | 4 | 2T / 2P | Semester 1 |
| 2 | `TIF-201` | Struktur Data & Algoritma | 3 | 2T / 1P | Semester 2 |
| 3 | `TIF-301` | Sistem Basis Data Terdistribusi | 3 | 2T / 1P | Semester 3 |
| 4 | `TIF-401` | Pemrograman Web Lanjut (Next.js) | 3 | 1T / 2P | Semester 4 |
| 5 | `TIF-501` | Arsitektur Perangkat Lunak Cloud | 3 | 3T / 0P | Semester 5 |
| 6 | `TIF-502` | Pengembangan Aplikasi Mobile (Flutter) | 3 | 1T / 2P | Semester 5 |

### 5.2 Program Studi S1 Sistem Informasi
| No | Kode MK | Nama Mata Kuliah | SKS | Teori / Prak | Semester Rekomendasi |
| :---: | :--- | :--- | :---: | :---: | :---: |
| 7 | `SIF-101` | Pengantar Sistem Informasi Bisnis | 3 | 3T / 0P | Semester 1 |
| 8 | `SIF-201` | Analisis & Perancangan Sistem (UML) | 3 | 2T / 1P | Semester 3 |
| 9 | `SIF-301` | Manajemen Proses Bisnis (BPMN) | 3 | 3T / 0P | Semester 4 |
| 10 | `SIF-401` | Enterprise Resource Planning (ERP) | 3 | 1T / 2P | Semester 5 |
| 11 | `SIF-501` | Tata Kelola TI (COBIT & ITIL) | 3 | 3T / 0P | Semester 5 |

### 5.3 Program Studi S1 Manajemen Bisnis
| No | Kode MK | Nama Mata Kuliah | SKS | Teori / Prak | Semester Rekomendasi |
| :---: | :--- | :--- | :---: | :---: | :---: |
| 12 | `MAN-101` | Pengantar Manajemen & Bisnis | 3 | 3T / 0P | Semester 1 |
| 13 | `MAN-201` | Manajemen Pemasaran Digital | 3 | 2T / 1P | Semester 3 |
| 14 | `MAN-301` | Manajemen Keuangan Korporasi | 3 | 3T / 0P | Semester 4 |
| 15 | `MAN-401` | Manajemen Strategik & Kepemimpinan | 3 | 3T / 0P | Semester 5 |
| 16 | `MAN-501` | Kewirausahaan & Startup Kampus | 3 | 1T / 2P | Semester 5 |

### 5.4 Program Studi S1 Akuntansi Keuangan
| No | Kode MK | Nama Mata Kuliah | SKS | Teori / Prak | Semester Rekomendasi |
| :---: | :--- | :--- | :---: | :---: | :---: |
| 17 | `AKT-101` | Pengantar Akuntansi Dasar | 4 | 3T / 1P | Semester 1 |
| 18 | `AKT-201` | Akuntansi Keuangan Menengah I | 3 | 2T / 1P | Semester 3 |
| 19 | `AKT-301` | Perpajakan dan Kepatuhan Fiskal | 3 | 2T / 1P | Semester 4 |
| 20 | `AKT-401` | Sistem Informasi Akuntansi (SIA) | 3 | 1T / 2P | Semester 5 |

---

## 6. Master Data 10 Jadwal Kuliah & Ruang Kuliah

### Master Data Ruangan:
- `RM-LAB-01`: Gedung Lab Rekayasa Komputer Lt. 2 (Kapasitas: 40 Mahasiswa)
- `RM-R301`: Gedung Kuliah Bersama R301 (Kapasitas: 50 Mahasiswa)
- `RM-R302`: Gedung Kuliah Bersama R302 (Kapasitas: 50 Mahasiswa)
- `RM-R401`: Gedung Kuliah Bersama R401 (Kapasitas: 45 Mahasiswa)

### Matriks 10 Jadwal Kuliah Aktif (Semester Ganjil 2026/2027):

| No | Kode Kelas | Mata Kuliah | Kelas | Hari | Jam (WIB) | Ruang | Dosen Pengampu | Kuota |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :--- | :---: |
| 1 | `CLS-TIF501-A` | Arsitektur Perangkat Lunak Cloud | A | Senin | 08:00 - 10:30 | RM-R301 | Dr. Hendra Gunawan | 40 |
| 2 | `CLS-TIF502-A` | Pemrograman Mobile (Flutter) | A | Senin | 13:00 - 15:30 | RM-LAB-01 | Bayu Pratama, M.T. | 35 |
| 3 | `CLS-TIF401-A` | Pemrograman Web Lanjut (Next.js) | A | Selasa | 08:00 - 10:30 | RM-LAB-01 | Dr. Maya Anggraini | 35 |
| 4 | `CLS-TIF301-A` | Sistem Basis Data Terdistribusi | A | Rabu | 10:45 - 13:15 | RM-R302 | Dr. Hendra Gunawan | 45 |
| 5 | `CLS-SIF401-A` | Enterprise Resource Planning | A | Selasa | 13:00 - 15:30 | RM-R302 | Ir. Fajar Nugroho | 40 |
| 6 | `CLS-SIF501-A` | Tata Kelola TI (COBIT & ITIL) | A | Kamis | 08:00 - 10:30 | RM-R401 | Dewi Sartika, M.Kom. | 45 |
| 7 | `CLS-MAN301-A` | Manajemen Keuangan Korporasi | A | Rabu | 08:00 - 10:30 | RM-R401 | Dr. Rahmat Setiadi | 50 |
| 8 | `CLS-MAN501-A` | Kewirausahaan Startup | A | Kamis | 13:00 - 15:30 | RM-R301 | Arif Hidayat, M.M. | 45 |
| 9 | `CLS-AKT201-A` | Akuntansi Keuangan Menengah I | A | Jumat | 08:00 - 10:30 | RM-R302 | Siti Farida, M.Si. | 45 |
| 10 | `CLS-AKT401-A` | Sistem Informasi Akuntansi | A | Jumat | 13:30 - 16:00 | RM-LAB-01 | Wahyu Hidayat, M.Ak. | 35 |

---

## 7. Master Data 50 Mahasiswa (Sampel Distribusi Multi-Prodi)

Tabel berikut adalah **target fixture fiktif** 50 mahasiswa berstatus AKTIF, bukan hasil query atau bukti sudah terdaftar dalam database. Identitas/kode contoh bukan fakta nasional terverifikasi; penggunaan referensi resmi memerlukan sumber, versi, lisensi dan verifikasi sebagaimana INTEGRATIONS §6.5.

### 7.1 Mahasiswa S1 Teknik Informatika (20 Mahasiswa, Angkatan 2022 - 2024)

| No | NIM | Nama Mahasiswa | Angkatan | Semester | IPK Kumulatif | Kuota SKS Maks | Dosen PA |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| 1 | `220601001` | **Ahmad Rizky Pratama** (`mahasiswa@sica.ac.id`) | 2022 | 5 | 3.82 | 24 | Dr. Hendra Gunawan |
| 2 | `220601002` | **Aditya Bagus Wicaksono** | 2022 | 5 | 3.65 | 24 | Dr. Hendra Gunawan |
| 3 | `220601003` | **Anisa Putri Ramadhani** | 2022 | 5 | 3.91 | 24 | Dr. Hendra Gunawan |
| 4 | `220601004` | **Bagas Dwi Saputra** | 2022 | 5 | 3.40 | 24 | Dr. Maya Anggraini |
| 5 | `220601005` | **Bella Cantika Dewi** | 2022 | 5 | 3.15 | 24 | Dr. Maya Anggraini |
| 6 | `220601006` | **Dimas Arya Nugraha** | 2022 | 5 | 2.85 | 21 | Bayu Pratama, M.T. |
| 7 | `220601007` | **Dina Novitasari** | 2022 | 5 | 3.70 | 24 | Bayu Pratama, M.T. |
| 8 | `220601008` | **Eko Prasetyo** | 2022 | 5 | 2.35 | 18 | Dr. Hendra Gunawan |
| 9 | `220601009` | **Faisal Rahman** | 2022 | 5 | 3.52 | 24 | Dr. Hendra Gunawan |
| 10 | `220601010` | **Gita Permatasari** | 2022 | 5 | 3.78 | 24 | Dr. Maya Anggraini |
| 11 | `230601001` | **Hafiz Danendra** | 2023 | 3 | 3.60 | 24 | Bayu Pratama, M.T. |
| 12 | `230601002` | **Indah Lestari** | 2023 | 3 | 3.88 | 24 | Bayu Pratama, M.T. |
| 13 | `230601003` | **Joko Susilo** | 2023 | 3 | 2.95 | 21 | Dr. Hendra Gunawan |
| 14 | `230601004` | **Kevin Sanjaya** | 2023 | 3 | 3.45 | 24 | Dr. Hendra Gunawan |
| 15 | `230601005` | **Laras Wulandari** | 2023 | 3 | 3.95 | 24 | Dr. Maya Anggraini |
| 16 | `240601001` | **Muhammad Farhan** | 2024 | 1 | 0.00 (Maba) | 20 (Paket) | Dr. Maya Anggraini |
| 17 | `240601002` | **Nabila Zahra** | 2024 | 1 | 0.00 (Maba) | 20 (Paket) | Bayu Pratama, M.T. |
| 18 | `240601003` | **Oki Setiawan** | 2024 | 1 | 0.00 (Maba) | 20 (Paket) | Bayu Pratama, M.T. |
| 19 | `240601004` | **Putri Anggraini** | 2024 | 1 | 0.00 (Maba) | 20 (Paket) | Dr. Hendra Gunawan |
| 20 | `240601005` | **Rian Kurniawan** | 2024 | 1 | 0.00 (Maba) | 20 (Paket) | Dr. Hendra Gunawan |

### 7.2 Mahasiswa S1 Sistem Informasi (10 Mahasiswa)
| No | NIM | Nama Mahasiswa | Semester | IPK | Dosen PA |
| :---: | :--- | :--- | :---: | :---: | :--- |
| 21 | `220602001` | **Rizki Maulana** | 5 | 3.50 | Ir. Fajar Nugroho |
| 22 | `220602002` | **Salma Fairuz** | 5 | 3.65 | Ir. Fajar Nugroho |
| 23 | `220602003` | **Taufik Hidayat** | 5 | 2.75 | Dewi Sartika, M.Kom. |
| 24 | `220602004` | **Utami Ningsih** | 5 | 3.80 | Dewi Sartika, M.Kom. |
| 25 | `220602005` | **Vino Bastian** | 5 | 3.20 | Ir. Fajar Nugroho |
| 26 | `230602001` | **Winda Amalia** | 3 | 3.42 | Ir. Fajar Nugroho |
| 27 | `230602002` | **Yusuf Mansur** | 3 | 3.10 | Dewi Sartika, M.Kom. |
| 28 | `230602003` | **Zahra Maulida** | 3 | 3.72 | Dewi Sartika, M.Kom. |
| 29 | `240602001` | **Aldi Taher** | 1 | 0.00 | Ir. Fajar Nugroho |
| 30 | `240602002` | **Bunga Citra** | 1 | 0.00 | Dewi Sartika, M.Kom. |

### 7.3 Mahasiswa S1 Manajemen Bisnis (10 Mahasiswa)
| No | NIM | Nama Mahasiswa | Semester | IPK | Dosen PA |
| :---: | :--- | :--- | :---: | :---: | :--- |
| 31 | `220603001` | **Candra Wijaya** | 5 | 3.60 | Dr. Rahmat Setiadi |
| 32 | `220603002` | **Dara Puspita** | 5 | 3.85 | Dr. Rahmat Setiadi |
| 33 | `220603003` | **Erlangga Yudha** | 5 | 3.10 | Arif Hidayat, M.M. |
| 34 | `220603004` | **Fanny Ghassani** | 5 | 3.40 | Arif Hidayat, M.M. |
| 35 | `220603005` | **Gibran Rakabuming** | 5 | 3.75 | Nadya Putri, M.Sc. |
| 36 | `230603001` | **Hesti Purwadinata** | 3 | 3.55 | Nadya Putri, M.Sc. |
| 37 | `230603002` | **Irfan Hakim** | 3 | 2.90 | Dr. Rahmat Setiadi |
| 38 | `230603003` | **Jessica Iskandar** | 3 | 3.68 | Dr. Rahmat Setiadi |
| 39 | `240603001` | **Kaesang Pangarep** | 1 | 0.00 | Arif Hidayat, M.M. |
| 40 | `240603002` | **Luna Maya** | 1 | 0.00 | Nadya Putri, M.Sc. |

### 7.4 Mahasiswa S1 Akuntansi Keuangan (10 Mahasiswa)
| No | NIM | Nama Mahasiswa | Semester | IPK | Dosen PA |
| :---: | :--- | :--- | :---: | :---: | :--- |
| 41 | `220604001` | **Maia Estianty** | 5 | 3.90 | Siti Farida, M.Si. |
| 42 | `220604002` | **Nicholas Saputra** | 5 | 3.72 | Siti Farida, M.Si. |
| 43 | `220604003` | **Olla Ramlan** | 5 | 3.30 | Wahyu Hidayat, M.Ak. |
| 44 | `220604004` | **Pevita Pearce** | 5 | 3.82 | Wahyu Hidayat, M.Ak. |
| 45 | `220604005` | **Raffi Ahmad** | 5 | 2.80 | Siti Farida, M.Si. |
| 46 | `230604001` | **Sule Sutisna** | 3 | 3.15 | Siti Farida, M.Si. |
| 47 | `230604002` | **Tiara Andini** | 3 | 3.95 | Wahyu Hidayat, M.Ak. |
| 48 | `230604003` | **Uus Rizki** | 3 | 2.65 | Wahyu Hidayat, M.Ak. |
| 49 | `240604001` | **Vanesha Prescilla** | 1 | 0.00 | Siti Farida, M.Si. |
| 50 | `240604002` | **Wika Salim** | 1 | 0.00 | Wahyu Hidayat, M.Ak. |

## 8. Seed kanal vicon, kosakata modus, dan parameter (audit dewan 2026-10-21 — `RD-68`)

**Kenapa bagian ini ada.** Sebelum 2026-10-21, `SEED_DATA.md` berhenti di §7 (mahasiswa sampel) sementara `DATA_MODEL §21.3` menuntut katalog parameter, `§20.4` menuntut kamus enam gugus, dan `§21.10` menuntut enum kanal + kosakata modus. Artinya: semua itu **spesifikasi tanpa jalan uji**. Seed adalah bukti bahwa spesifikasi bisa ditegakkan, karena itu bagian ini ditulis sebagai *kontrak seed*, bukan sebagai skrip jadi. Jumlah tiap tuntutan dicetak oleh `node .tools/seed-count.mjs` (lihat `RD-76`: angka tetap di kalimat adalah sumber kesalahan, bukan bukti).

### 8.1 Status bukti seed (bukan pengukuran database)

Inventaris lama “7 migrasi, tertinggi 0011, semua seed 0” bukan keadaan terkini: berkas `0047`/`0049` sudah ada. **Berkas migrasi/seed ada ≠ diterapkan pada database**. Sinkronisasi docs-only ini tidak membaca jumlah baris database atau menjalankan seed, sehingga jumlah nyata tidak dinyatakan nol maupun lengkap.

| Objek | Target yang perlu dibuktikan | Bukti yang masih diperlukan |
|---|---|---|
| `master_system_parameters` | katalog kanonik DATA_MODEL §21.3, hanya konsumen aktif yang dinyatakan aktif | run migrasi/seed terotorisasi, tenant/run ID, jumlah dan versi dibanding katalog |
| `reference_kinds` / `reference_items` | register §20.4 termasuk item nonaktif untuk baca historis | manifest fixture, digest dan hasil query tenant yang sama |
| `reference_dictionary_entries` kelas B nasional | sumber, versi, lisensi dan verifikasi manusia sebelum kirim Feeder | `[VERIFIKASI-KAMUS]` INTEGRATIONS; salinan nilai nasional bukan fakta resmi terverifikasi |
| `conference_connections` | register kanal + satu default yang sah per tenant dev | migrasi/kode/kredensial-ref dan uji kontrak kanal, bukan hitungan tabel dokumen |
| `attendance.online_min_join_ratio` | contoh default `0.75` sebagai kebijakan configurable berversi | rentang mengikuti katalog kanonik DATA_MODEL/PRD; tidak menetapkan rentang kedua di seed |

### 8.2 Kontrak seed yang harus ada sebelum satu kanal pun diklaim

1. **Dev, idempoten, dan tanpa rahasia.** Seed hanya menulis `credential_ref` menunjuk entri ENV (`env:TEAMS_CLIENT_SECRET_REF` dsb.), tidak pernah nilai rahasia; seed yang mengandung token harus ditolak penguji (`SECURITY §7`).
2. **Deterministik.** Urutan baca `ORDER BY sort_order, code` (norma `AGENTS §3.10`); tidak ada seed yang bergantung pada urutan UUIDv7.
3. **Kelas B tidak dapat diubah tenant.** Entri nasional (wilayah, `sifat_pembelajaran` `F`/`O`/`M`) di-seed sebagai `is_system = true`; tenant hanya memetakan label. Uji penolakan: `UPDATE` oleh peran kampus harus gagal.
4. **Parameter kanal ikut riwayat.** Seed menulis baris `parameter_history` dengan `requested_by` ≠ `approved_by` (empat-mata ditegakkan `CHECK` di DB, bukan oleh niat).
5. **Alias kosakata dimigrasi, bukan dibiarkan.** Seed dev memakai `BLENDED`; pengujian wajib menolak `HYBRID`/`OFFLINE`/`TEAMS`/`BUILTIN` pada jalur tulis (`DATA_MODEL §21.10.2`, `0075`).

### 8.3 Kriteria selesai bagian ini (terukur, bukan naratif)

- Setelah migrasi terkait tersedia **dan diterapkan** pada DB uji berizin, bandingkan katalog spesifikasi dengan baris/versi/digest seed pada tenant/run yang sama, termasuk default kanal dan kelas B yang tidak dapat disunting tenant. `seed-count.mjs` tidak menggantikan bukti query DB; angka lama 61/33 adalah snapshot dokumen, bukan jumlah seed sekarang. Simpan artefak run bertanggal/commit, bukan angka tetap yang cepat basi.
- `PRD §5.15` AC-VIC-2 dapat dieksekusi: ambang 0,75 dibaca dari DB, bukan dari kode.
- Penutupan memerlukan artefak run pada DB tenant/run yang disetujui; siklus ini tidak mengeksekusinya. Inventaris dokumen tidak membuktikan jumlah seed atau kemampuan konsumen parameter.

### 8.4 Peta modul → kelompok seed (menutup temuan "modul tanpa rujukan seed") — 2026-10-21

**Temuan yang memaksa bagian ini ada.** `node .tools/module-provenance.mjs` mengukur berapa modul yang sama sekali tidak disebut di `SEED_DATA.md`, dan hasilnya termasuk modul enterprise (`0051`–`0072`) yang DDL-nya sudah ditulis. Artinya spesifikasi punya tabel tetapi tidak punya **jalur uji data awal**, dan itu membuat "CRUD lengkap" tidak dapat dibuktikan di CI. Ini lubang kontrak seed, bukan kelalaian estetika: tanpa seed, gerbang `NOT NULL`, `CHECK`, `EXCLUDE`, dan RLS tidak pernah teruji nilainya. Angka hari ini dicetak alat, bukan diturunkan dari tabel di bawah.

**Aturan main (tidak berubah dari §8.1–§8.3).** Seed ditulis per **kelompok**, bukan per tabel acak; satu kelompok = satu berkas seed idempoten; tenant sampel `SICN-DEMO` + satu tenant kedua khusus uji silang (NFR-S1). Nilai kamus wajib lewat `reference_items` (§20) dan **tidak pernah** hardcode di seed; parameter hanya dari katalog §21.3.

| Kelompok seed | Modul yang dilayani | Objek inti | Baris minimum agar uji bermakna | Status |
|---|---|---|---|---|
| `S-01 platform` | M-01, M-02, M-03, M-05 | tenants, tenant_settings, users/roles/assignments, permissions, master_system_parameters | 2 tenant · 12 peran-assignment · seluruh katalog parameter §21.3 · 4 kanal notifikasi | spesifikasi ada (`§8.2`) |
| `S-02 kamus` | M-02 (data master) | reference_kinds + reference_items (§20.4) | ≥ 1 item per kind + 1 item `is_active=false` untuk uji `?at=` | target §8.3; belum ada bukti run DB pada siklus ini |
| `S-03 akademik inti` | M-12…M-19 | academic_periods, curricula, courses, study_programs, classes, `class_distributions`, `krs_packages`/`krs_package_lines`, enrollments, grades, attendances | 1 prodi × 2 periode × 8 kelas × 40 mahasiswa · 1 paket `PUBLISHED` untuk cohort (2 baris wajib + 1 opsional; total `sks_snapshot = packed_sks` ≤ plafon BR-R2) · 1 paket `DRAFT` dengan version 2 untuk uji optimistic lock · kelas tanpa sebaran/jadwal untuk uji penolakan | kontrak diperluas di §26.8; migrasi `0023` belum tersedia, seed tetap `spec-only` (`G-02`) |
| `S-04 keuangan` | M-10, M-11 | invoices, fee_tariff_groups, tuition_tariff_matrix, virtual_accounts, scholarships | 3 golongan tarif × 2 jalur + 2 tagihan tertunggak untuk uji gerbang KRS | berkas migrasi belum ada → seed tidak dapat dijalankan (`G-02`) |
| `S-05 kepegawaian & iuran` | M-06, M-07, M-08 | employees, payroll_runs, leave, `social_insurance_participations`, `anomaly_domain_settings` | 6 dosen (1 dengan lebih dari satu kepesertaan) + 4 staff + 2 program iuran | **baru: `0079`/`0081` (2026-10-21)** — menunggu berkas diterapkan |
| `S-06 intake & siklus hidup` | M-09, M-14, M-23, M-27, M-30, M-35 | pmb_* , nim_assignments, graduation_records, documents, student_cards, tracer_* | 2 jalur × 2 gelombang (1 beririsan = **wajib ditolak**) + 1 pendaftar lolos 2 prodi | **baru: `0021`/`0076`/`0077`** (`DATA_MODEL §23`) |
| `S-07 sarana & fasilitas` | M-39, M-40, M-41, M-42, M-43 | pustaka (item/peminjaman), aset + penyusutan, rekam klinik, asrama, acara | 20 aset (1 rusak untuk tiket) + 1 pinjaman lewat jatuh tempo (denda) | `0067`–`0070` belum berberkas |
| `S-08 mutu & regulasi` | M-30…M-34 | sertifikat/legalisir, staging Feeder, bukti akreditasi, sumber IKU | 1 borang 9 kriteria + 1 staging run CP1/CP2 | sebagian objek tanpa DDL (`CRD-6`) |
| `S-09 kelas khusus PDP` | M-36, M-41 | kasus PPKS (terenkripsi), rekam klinik (terenkripsi) | 2 kasus + access-log; **tanpa nilai rahasia di seed** | wajib DPIA sebelum produksi |
| `S-10 kemahasiswaan & publikasi` | M-21, M-24, M-25, M-26, M-28, M-29 | kegiatan & poin SKKM, magang/KKN, jurnal & publikasi, simulasi kelulusan, karier, mobilitas | 1 mahasiswa dengan 3 aktivitas (2 lolos konversi, 1 ditolak) + 1 publikasi ber-ISSN + 1 skenario simululus "belum lulus" | kontrak belum ditulis (`SED-1`) |
| `S-11 tata kelola non-akademik` | M-04, M-37, M-44, M-45, M-46, M-47 | tiket helpdesk, temuan SPMI, hibah/LPPM, lead CRM, paket pengadaan, dana abadi | 3 tiket (1 escalasi) + 2 temuan mutu (1 closed) + 1 hibah + 1 lead + 1 paket pengadaan | kontrak belum ditulis (`SED-1`) |
| `S-12 jejak audit, jangkar & DSAR` | M-05 dan domain terkait | `audit_logs`, `audit_chain_head`; jangkar/run Merkle dan `data_subject_requests`/retensi adalah desain lanjutan | target dua tenant, segmen tertutup, fixture baik/rusak terisolasi; DSAR `ACCESS` disetujui dan `ERASURE` ditolak/parsial karena retensi atau legal hold | hash-chain JSON sudah memiliki fixture sintetis, **bukan** bukti histori demo pascacleanup; Merkle/DSAR dan run historis belum terbukti. `pii_privacy_requests` hanya alias desain `data_subject_requests`, bukan seed tabel kedua |
| `S-13 kepegawaian, gaji & KPI` | M-06 (bersama `S-05` yang sudah melayani objek lamanya) | `leave_policies`, `paycomponents`, `payroll_runs`, `payslip_lines`, `payroll_adjustments`, `kpi_components`, `kpi_results`, `pph21_brackets`, `employee_tax_profiles` | 3 versi kebijakan cuti (1 `ACTIVE`, 1 kedaluwarsa, 1 `DRAFT` tanpa penyetuju = **wajib ditolak** saat aktivasi) · 6 komponen gaji (1 tanpa `gl_account_code` ⇒ tidak dapat `ACTIVE`) · 1 run `PAID` beku + 1 run `DRAFT` + 1 `VOID` beralasan · 1 penyesuaian `APPROVED` belum terpasang · bobot KPI: satu jabatan berjumlah 10.000 dan **satu jabatan sengaja 8.800** untuk uji penolakan · 1 potret tarif PPh 21 berversi | kontrak belum ditulis (`SED-1`, tiket `HRS-5`); **nol nominal hasil hitungan seed** — angka gaji datang dari engine atas snapshot, seed hanya menyediakan komponen & tarif |

**Cara ukur.** `module-provenance.mjs` dan `seed-count.mjs` memeriksa rujukan/cakupan dokumen sesuai implementasi alat; hasilnya bukan query jumlah baris database. Target nol modul tanpa rujukan tidak berarti seed lengkap. Bukti nyata membutuhkan manifest run + tenant, migrasi diterapkan, query/digest fixture dan uji konsumen; jumlah database pada siklus ini **tidak diukur**.

**Yang TIDAK dilakukan di sini.** Tidak ada angka seed yang dikarang untuk modul yang objeknya belum punya DDL; sebelas kelompok di atas adalah **kontrak**, dan barisnya ditulis pada tiket `SED-1` (`ROADMAP §2.25`) setelah objeknya nyata. Menaruh puluhan baris fixture palsu akan membuat CI hijau di atas kertas — persis kegagalan generator yang dibuang pada `RD-83`.

