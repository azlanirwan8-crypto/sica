# SICA Master Seed Data Specification (Development & Staging)
**Status:** Canonical Reference & Fixture  
**Target Environment:** Local Docker Compose & Cloud Staging  
**Tenant Context:** Universitas Nusantara (`subdomain: nusantara`)  
**UUID Seed Namespace:** Deterministic UUID v4 / UUID v7  

---

## 1. Kredensial Login Default untuk Pengujian (Testing Accounts)

Untuk mempermudah pengujian otentikasi lintas role (RBAC) pada Web Portal dan Mobile App, seluruh akun seed menggunakan password seragam dengan hash Argon2id yang telah digenerate:

> **Password Default Seluruh Akun Testing:**  
> `SicaDemo2026!`  
> *(Hash Argon2id: `$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQxMjM0NTY3OA$9lJkQk4F+p3q+u18WqF...`)*

| Role | Username / Identifier | Email Login | Nama Lengkap | Unit / Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin (Tenant)** | `adm.nusantara` | `admin@sica.ac.id` | **Bambang Wijaya, S.Kom., M.T.** | Kepala Biro Administrasi Akademik (BAAK) |
| **Dosen / DPA** | `0412088501` | `dosen@sica.ac.id` | **Dr. Eng. Ir. Hendra Gunawan, S.T., M.T.** | Dosen Teknik Informatika / DPA Utama |
| **Mahasiswa Aktif** | `220601001` | `mahasiswa@sica.ac.id` | **Ahmad Rizky Pratama** | Mahasiswa S1 Teknik Informatika (Sem 5) |

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
- **Status Operasional:** `OPEN_ENROLLMENT` (Jendela Pengisian KRS Aktif)
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

Seluruh 50 mahasiswa berstatus **AKTIF** pada semester berjalan dan telah terdaftar dalam database. Berikut adalah rincian profil representatif dari masing-masing program studi:

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
