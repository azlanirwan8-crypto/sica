# SICA Enterprise External Integrations Specification
**Status:** Spesifikasi dan target parsial; bukan bukti standar produksi telah diterapkan
**Role:** Lead Enterprise Integration Architect  
**Core Stack:** Node.js / Next.js, PostgreSQL 16 (RLS) — **BullMQ & Redis berstatus TARGET**, keduanya
belum menjadi dependensi nyata (`TECH_CONVENTIONS.md` §6, gap `RD-11`); lihat §1.8.0 dan §1.10.  
**External Services:** PDDikti Neo Feeder, Midtrans / Xendit, Fonnte / WhatsApp Gateway, Resend Email, Cloudflare R2 / AWS S3, **SICA Virtual Campus (self-hosted BigBlueButton / Jitsi)** untuk kehadiran daring — seluruh gugus §5 berstatus `design-only`; Zoom / Google Meet / Microsoft Teams hanya opsional dengan kredensial di vault/ENV.  

---

## 1. Integrasi PDDikti Neo Feeder (Kementerian Diktisaintek)

SICA **merancang** sinkronisasi dua arah Neo Feeder melalui transport terkontrol; bentuk Web Service/RPC, versi dan kebijakan instalasi target perlu verifikasi resmi. Bagian ini bukan bukti pengiriman nyata atau engine telah deployed. Admin IT mengelola binding/ref, sedangkan persetujuan akademik dan kirim mengikuti otoritas operasional §6.1.

```
┌──────────────┐     ETL & Sanitasi      ┌────────────────────┐     JSON RPC      ┌──────────────────┐
│  SICA DB     │ ──────────────────────> │  PDDikti Sync Sync │ ────────────────> │  Neo Feeder      │
│ (PostgreSQL) │ <────────────────────── │  Worker (BullMQ)   │ <──────────────── │  WS (Pemerintah) │
└──────────────┘      Update Feeder ID   └────────────────────┘     Response ID   └──────────────────┘
```

> Diagram di atas adalah **ringkasan arah**. Alur kanonik yang mengikat (termasuk staging layer,
> mesin validasi pra-kirim, dan worker retry) ada di **§1.5 – §1.8**; mesin auto-fix lokal, delta sync,
> norma keselamatan dan dampak entitas baru ada di **§1.11 – §1.14**; status kejujurannya satu register
> di **§1.10**. Kotak "Worker (BullMQ)" pada diagram adalah **target**, bukan keadaan kode hari ini
> (§1.8.0 dan §1.10.4).

### 1.1 Autentikasi & Handshake Feeder
Endpoint: `POST https://feeder.kampus.ac.id:8082/ws/live2.php`
- **Action:** `GetToken`
- **Payload protokol keluar (ilustrasi, bukan body API admin):** `{ "act": "GetToken", "username": "<FEEDER_USER>", "password": "<FEEDER_PASS>" }`. Service transport me-resolve secret ref melalui penyimpanan aman saat handshake; plaintext tidak masuk konfigurasi umum, UI, log atau audit. Endpoint contoh/aksi harus diverifikasi terhadap instalasi target.
- Penyimpanan token Redis/renewal adalah **target**, bukan deployment terbukti. Respons kedaluwarsa yang sudah diverifikasi per versi memicu renegosiasi terkontrol; kegagalan menjadi status kanal, bukan bypass autentikasi.
- **Masa berlaku token: `60 menit` `[TIDAK-TERVERIFIKASI]`** — angka ini berasal dari repo integrator
  pihak ketiga, **bukan** dari User Guide resmi Feeder, dan belum pernah diukur dari sandbox
  (diralat 2026-10-19 — AUDIT_READINESS `BENCH-138`). Yang **normatif dan boleh dikodekan** adalah
  **deteksi `100` → renegosiasi**, bukan asumsi TTL; simpan sebagai `FEEDER_TOKEN_TTL_SECONDS` di
  `ENV_CONTRACT` dengan nilai awal 3600 yang **wajib** diverifikasi per instalasi Feeder target.

### 1.2 Skema Pemetaan Data — SATU objek kanonik `pddikti_mappings`

**Defek yang ditutup di sini (diralat 2026-10-19 — AUDIT_READINESS `BENCH-123`, BLOCKER):** objek ini
pernah ditulis dalam **tiga bentuk berbeda** — `entity/local_field/pddikti_field/transform`
([DATA_MODEL §5](file:///c:/SICA/docs/DATA_MODEL.md)), `entity_type/local_value/feeder_code/feeder_label`
(BLUEPRINT §4.8), dan "satu baris `entity='sex_type'`" (§1.4(d) di bawah). Ketiganya menyatukan **dua hal
yang berbeda**: **peta field** (`students.nim → nim`) dan **kamus nilai** (`M → L`, agama, wilayah).
Sekarang hanya ada satu tabel dengan pembeda `kind`; generator kontrak membaca `kind='FIELD'`,
validasi pra-kirim & layar "Pemetaan Sumber" membaca `kind='VALUE'`.

```sql
-- Definisi kanonik ada di DATA_MODEL §5; salinan ini dijaga identik (satu objek satu definisi).
CREATE TABLE pddikti_mappings (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('FIELD','VALUE')),
  entity text NOT NULL,            -- FIELD: 'mahasiswa','mata_kuliah','kelas','nilai','riwayat'
                                   -- VALUE: nama kamus, mis. 'sex_type','agama','wilayah','pekerjaan'
  local_field text,                -- FIELD saja: kolom SICA, mis. 'students.nim'
  feeder_field text,               -- FIELD saja: kolom Feeder, mis. 'nim'
  transform jsonb,                 -- FIELD saja: aturan konversi, mis. {"fn":"semester_from_date"}
  local_code text,                 -- VALUE saja: kode/enum SICA, mis. 'M'
  feeder_code text,                -- VALUE saja: kode resmi pusat, mis. 'L' (PDDikti memakai L/P)
  feeder_label text,               -- VALUE saja: label kamus pusat hasil sinkron
  source text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('SYNC','MANUAL')),
  verified_at timestamptz, active_version int NOT NULL DEFAULT 1,
  CHECK ((kind = 'FIELD') = (local_field IS NOT NULL AND feeder_field IS NOT NULL)),
  CHECK ((kind = 'VALUE') = (local_code IS NOT NULL AND feeder_code IS NOT NULL)));
CREATE UNIQUE INDEX uq_pddikti_mappings ON pddikti_mappings (tenant_id, kind, entity, active_version,
  COALESCE(local_field,''), COALESCE(local_code,''));
```

**Tiga aturan yang membuat objek ini berguna, bukan sekadar tabel konfigurasi:**
1. **Kamus nilai TIDAK boleh ditiru sebagai baris `VALUE` tanpa sumber.** Nilai `feeder_code`/`feeder_label`
   di-*upsert* dari `Get*` (lihat §1.4(n) drift) dan dicatat `source='SYNC'` + `verified_at`. Baris
   `MANUAL` = keputusan kampus yang **wajib** muncul di panel Kesehatan Data sebagai risiko penolakan.
2. **`kind='VALUE'` adalah peta, bukan kamus.** Kamus lengkap (agama/pekerjaan/wilayah) tetap hidup di
   `reference_items` + `reference_dictionary_entries` (DATA_MODEL §14.2/§14.7 → `0028`); `pddikti_mappings`
   hanya menghubungkan kode lokal ↔ kode pusat. Jangan menyalin nama kamus ke dua tempat.
3. **Kolom kiri pada tabel A/B/C di bawah harus dibaca sebagai baris `kind='FIELD'`**, bukan sebagai
   kebenaran kedua. Bila teks di bawah dan `pddikti_mappings` bertentangan, **tabel yang menang**.

#### A. Biodata & Riwayat Pendidikan Mahasiswa (`InsertRiwayatPendidikanMahasiswa`) `[PIHAK-KETIGA]`
> Nama aksi pada judul A/B/C berasal dari repo integrator (`virbo/yii2-wsfeeder` dan sejenisnya),
> **bukan** dari User Guide resmi; aksi yang terverifikasi ada di daftar §1.4(b) diberi tanda `[DOK]`.
> (diralat 2026-10-19 — `BENCH-137`)
| Field SICA (`students`, `enrollments`) | Field PDDikti Feeder | Tipe Data | Keterangan / Transformasi |
| :--- | :--- | :---: | :--- |
| `feeder_identities(entity_type='student', local_id=students.id).feeder_id` | `id_mahasiswa` | UUID | **Bukan kolom `students`.** ID ini dipasok dari respons `GetBiodataMahasiswa` (cari via NIK/NIM) — lihat §1.4(k) & DATA_MODEL §14.7 `0028`; mengarang id sendiri = pelanggaran invariance I-14 |
| `students.nim` | `nim` | String(24) | Nomor Induk Mahasiswa aktif; sumber `nim_assignments` (DATA_MODEL §14.7 `0021`) |
| `study_programs.pddikti_code` | `id_prodi` | UUID | ID Program Studi resmi di pangkalan data Dikti (kolom ini memang ada di `students`/`study_programs`) |
| `feeder_identities(entity_type='periode')` + `transform {"fn":"semester_from_date"}` | `id_periode_masuk` | String(5) | **`academic_periods.pddikti_id` tidak ada di skema** (diralat 2026-10-19); periode dibentuk dari `academic_years.label` + `term` → `20261` (Ganjil) / `20262` (Genap) |
| `students.registration_date` | `tgl_daftar` | YYYY-MM-DD | Tanggal resmi registrasi mahasiswa. **Status kolom:** dispesifikasi di DATA_MODEL §14.5(1), **belum ada** di `schema/classes.ts` — kolom wajib dibuat sebelum pipeline ini jalan; ejaan lama `students.admission_date` **dilepas** |
| `students.feeder_entry_type_code` | `id_jenis_daftar` | Integer | 1 baru · 2 pindahan · 3 RPL · 4 non-gelar · 5 fastrack (lihat §1.4(e)); spesifikasi §14.5(2), **belum ada di kode**; ejaan lama `students.admission_type` **dilepas** |
| `students.entry_cost_rupiah` | `biaya_masuk` | BigInt | Nominal rupiah utuh → integer tanpa desimal (§14.5(1); **belum ada di kode**); ejaan lama `students.biaya_masuk` **dilepas** |
| `students.funding_source_code` / `receives_kps` / `kps_number` | `id_pembiayaan` / `penerima_kps` / `nomor_kps` | text / boolean / text | Semua tiga dispesifikasi §14.5(1) dan **belum ada di kode**; titik pengambilannya **registrasi ulang PMB** (`pmb_reregistrations`, §14.7 `0021`), bukan form mahasiswa pasca-NIM (BENCH-12) |
| `student_guardians (relation='IBU').full_name` | `nama_ibu_kandung` | text | Tidak ada kolom `students.mother_name`; validasi DUKCAPIL membaca dari sana (§1.4(d)) |
| `student_addresses (is_preferred).*_code` | `kelurahan` + `id_wilayah` | String(5+) | Kode wilayah 5 level (mis. `180102`); validasi inline terhadap `reference_dictionary_entries` (§1.4(n)) |

#### B. Kurikulum & Mata Kuliah (`InsertMataKuliah`) `[PIHAK-KETIGA]`
| Field SICA (`courses`) | Field PDDikti Feeder | Tipe Data | Keterangan / Transformasi |
| :--- | :--- | :---: | :--- |
| `courses.code` | `kode_mata_kuliah` | String(20) | Kode MK unik di prodi terkait |
| `courses.name` | `nama_mata_kuliah` | String(200)| Nama resmi mata kuliah bahasa Indonesia |
| `courses.sks` | `sks_mata_kuliah` | Decimal(4,1) | **Kolom nyata = `courses.sks`** (otoritatif = jumlah; diralat 2026-10-19, ejaan `courses.sks_total` dilepas — K-13) |
| `courses.sks_teori` | `sks_tatap_muka` | Decimal(4,1) | Satu dari **empat** rincian wajib; ejaan `sks_theory` **dilepas** |
| `courses.sks_praktik` | `sks_praktek` | Decimal(4,1) | ejaan `sks_practicum`/`sks_lab`/`sks_practice` **dilepas** |
| `courses.sks_praktik_lapangan` | `sks_praktek_lapangan` | Decimal(4,1) | Wajib dinyatakan; dua kolom terakhir dulu **tidak ada di dokumen ini** sama sekali |
| `courses.sks_simulasi` | `sks_simulasi` | Decimal(4,1) | Lihat DATA_MODEL §11.4 (satu set kolom SKS kanonik) |
| `courses.course_type` | `id_jenis_mata_kuliah` | text | Nilai kamus pusat diambil `GetJenisMatakuliah`; `id_kelompok_mata_kuliah` **juga wajib** — belum punya kolom sumber (BENCH-132) |
> **Status kolom SKS (verifikasi kode 2026-10-19):** yang **sudah ada** di
> `schema/academic-master.ts:190-192` hanya `sks`, `sks_teori`, `sks_praktik`; `sks_praktik_lapangan` dan
> `sks_simulasi` **belum ada di kode** (barunya ada di DATA_MODEL §11.4, belum bermigrasi) — jadi baris B
> di atas adalah **kontrak yang menunggu kolomnya dibuat**, bukan pemetaan yang bisa langsung dikodekan.

#### C. Nilai Perkuliahan Semester (`UpdateNilaiPerkuliahanKelas`) `[DOK]`
| Field SICA (`grades`) | Field PDDikti Feeder | Tipe Data | Keterangan / Transformasi |
| :--- | :--- | :---: | :--- |
| `feeder_identities(entity_type='class').feeder_id` | `id_kelas_kuliah` | UUID | **Bukan kolom `classes`.** `classes.pddikti_class_id` tidak ada di skema (diralat 2026-10-19); id kelas kuliah **ditangkap dari Feeder**, tidak dikarang SICA (I-14) |
| `feeder_identities(entity_type='riwayat_pendidikan').feeder_id` | `id_registrasi_mahasiswa` | UUID | id riwayat per mahasiswa per periode; `students.pddikti_reg_id` juga tidak ada di skema |
| `grades.raw_score` | `nilai_angka` | Decimal(5,2)| Skor mentah (0–100); kolom nyata `grades.raw_score` (ejaan `numeric_score` dilepas) |
| `grades.letter_code` | `nilai_huruf` | String(3) | A, B+, B, C, D, E (kolom nyata; `letter_grade` dilepas). **SERVER_ONLY** — tidak pernah diterima dari body (DATA_MODEL §14.9) |
| `grades.point_value` | `nilai_indeks` | Decimal(3,2)| Bobot mutu 4.00/3.50/dst (kolom nyata; `grade_point` dilepas). Turunan band `grade_scale_bands` |

### 1.3 Mekanisme Rekonsiliasi & Anti-Duplikasi
1. **Satu-satunya tempat id PDDikti = `feeder_identities`** (DATA_MODEL §14.7 → `0028_feeder_bridge.sql`),
   bukan kolom `pddikti_id` yang disebar di tiap tabel. Bentuknya
   `(tenant_id, entity_type, local_id, feeder_id, source, verified_at)` dengan
   `UNIQUE (tenant_id, entity_type, local_id)`. Aturan keras: `feeder_id` **hanya** boleh terisi dari
   respons bridge (`source='BRIDGE_RESPONSE'`) — id yang dikarang SICA akan ditolak pusat dan
   tidak dapat ditarik kembali (invariance I-14, `BENCH-127`). Kolom `pddikti_*_id` yang sudah ada di
   skema (`students.pddikti_id_pd`, `lecturers.pddikti_id_dosen`, `courses.pddikti_id_mk`) adalah
   **proyeksi baca-saja** dari tabel itu; keduanya ditandai `SERVER_ONLY` (DATA_MODEL §14.9).
2. Jika `feeder_id` sudah ada → worker mengeksekusi aksi `Update…`, bukan `Insert…`. Jika belum ada
   → `Insert…`, dan **hanya** setelah `GetBiodataMahasiswa`/`GetTranskripMahasiswa` memastikan record
   itu memang belum terdaftar di pusat (mencegah duplikat lintas migrasi, `BENCH-13`).
3. **Nama yang menang untuk jejak percobaan:** `pddikti_sync_runs` (satu percobaan per run) +
   `feeder_jobs` (satu baris per record, resumable) + `pddikti_validation_findings` (temuan per record).
   Istilah `pddikti_sync_logs` yang dipakai butir 3 versi lama dokumen ini **tidak** menjadi tabel
   keempat (DATA_MODEL §14.8) — (diralat 2026-10-19 — `RD-32`).
4. Seluruh payload yang gagal membawa `error_code` resmi Feeder (matriks §1.4(l)) dan menahan
   `check_code`-nya sendiri (§1.4(p)) supaya dapat dilaporkan per prodi, per record, dan per operator.

---

### 1.4 Realitas Teknis Neo Feeder hasil riset (2026-10-19) — apa yang BISA dan TIDAK BISA kita lakukan
> Sumber: UG UI/UX Feeder PDDikti v4.0 (`pddikti-admin.kemdikbud.go.id`), PDF pendampingan LLDikti III & VI (Neo Feeder 2.4.0 / 2024-Genap), snapshot API publik `pddikti.kemdikbud.go.id`, dan integrator sumber-terbuka (`virbo/yii2-wsfeeder`, `BASE`, `importer-neo-feeder`). Penanda keyakinan mengikuti [BENCHMARK_SEVIMA §0.1](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md).

**(a) Bentuk aplikasi & jalur koneksi** `[DOK]`
- Neo Feeder adalah **aplikasi lokal** (`http://localhost:8100/#/login`) dengan **DB PostgreSQL lokal**; prefill + **Kode Registrasi** datang dari portal pusat, login memakai akun PDDikti, sinkron dua arah (kirim & turun) dengan **OTP lewat nomor WA terdaftar** (perubahan nomor diajukan via pddikti-admin).
- Web Service: **POST JSON** ke `/ws/live2.php` (sandbox: `sandbox2.php`, port 8082/3003) berbadan `{ token, act, filter, key, record, order, limit, offset }`; token via `act=GetToken {username,password}`; respons `{ error_code, error_msg, data }` dengan `0` = sukses dan **`100` = token kedaluwarsa → renegosiasi**; `-1/-2` = timeout/parse. Kamus field per aksi dapat dibaca programatik: `act=GetDictionary, fungsi=Insert…`.
- **Konsekuensi arsitektur SICA:** adapter kita **tidak** bisa "hubungi PDDikti langsung dari serverless". Yang benar = **Feeder Bridge** (agen di sisi kampus, seperti pembanding punya `Integrator`) + **antrean job keluar-masuk** + `pddikti_sync_runs` sebagai buku besar percobaan. Aksi yang menyentuh internet kampus harus **idempoten** dan dapat di-*resume*.

**(b) Aksi yang terverifikasi ada** `[DOK]`/`[PIHAK-KETIGA]`
`GetToken`, `GetListMahasiswa`, `GetBiodataMahasiswa`, `Insert/Update/DeleteBiodataMahasiswa`, `InsertPerkuliahanMahasiswa`, `UpdateNilaiPerkuliahanKelas`, `InsertMahasiswaLulusDO`, `GetSemester`, `GetStatusMahasiswa`, `GetJenisKeluar`, `GetTranskripMahasiswa`, `GetProfilPT`, serta `Insert/GetListKomponenEvaluasiKelas` + `GetRiwayatNilaiMahasiswaKomponenEvaluasi` (v2.3.0+) dan `InsertAktivitasMBKMFlagship` (v2.4).
Referensi/kamus yang **ditarik dari pusat, bukan dikarang lokal** — daftar 13 `Get*` ini
`[PIHAK-KETIGA]`: sumbernya repo integrator, **bukan** User Guide resmi, dan dua aksi yang kami butuhkan
belum tercakup di dalamnya (`GetRencanaPembelajaran`/RPS dan `GetNilaiPerkuliahanKomponenEvaluasi` penuh);
keduanya **wajib** diverifikasi di sandbox sebelum dipakai kode (diralat 2026-10-19 — `BENCH-137`):
`GetAgama`, `GetNegara`, `GetWilayah`, `GetProdi`, `GetJalurMasuk`, `GetPekerjaan`, `GetPenghasilan`,
`GetJenjangPendidikan`, `GetJenisTinggal`, `GetAlatTransportasi`, `GetPembiayaan`, `GetKebutuhanKhusus`,
`GetJenisAktivitasMahasiswa`.
→ **Ini menjawab FR-ADM-07:** `reference_kinds` wajib punya `feeder_code` + **sinkron** dari `Get*` (bukan seed manual). Kamus lokal yang menyimpang dari pusat = sumber penolakan data nomor satu.

**(c) Batasan yang wajib dihormati (kerap salah dipahami)** `[DOK]`
1. **Dosen TIDAK boleh dibuat/diubah lewat Feeder** — "data dosen hanya dikelola oleh DIKTI"; registrasi NIDN/NIDK/NUP lewat pddikti-admin/SISTER, penugasan dosen di portal. Yang dicatat sebagai riwayat: fungsional, kepangkatan, pendidikan, sertifikasi, penelitian, bimbingan, penguji. → Modul `feeder_pddikti` SICA **hanya membaca/mencocokkan** dosen (`lecturers.pddiktiIdDosen`, `nidn`), **tidak pernah** menawarkan "kirim dosen".
2. **Tidak ada objek presensi per individu** — yang dilaporkan adalah **status AKM per periode** (`status keaktifan`, `IPS`, `IPK`, `sks semester`, `total_sks`). Presensi QR/geofence kita = nilai tambah **internal**, bukan payload feeder.
3. **Tidak ada objek tagihan** di Neo Feeder resmi (`id_pembiayaan` + `biaya_masuk` + `penerima_kps`/`nomor_kps` adalah pembiayaan mahasiswa, bukan kelompok tagihan) → sinkron keuangan mengirim **hasil** (biaya yang dibebankan), bukan `invoices`.
4. **Tidak ada objek ruang terpisah**; kapasitas & lingkup ada di form kelas → `rooms` untuk kebutuhan internal (jadwal/bentrok), tidak dipetakan ke feeder.
5. `bahan ajar`/`tugas`/`video meeting` per pertemuan **bukan** ranah Feeder (ranah LMS) → `lms_materials`/`lms_assignments` tidak ikut pipeline feeder.

**(d) Field wajib mahasiswa (bintang merah) yang harus ada di form Admin** `[DOK]`
`nim`, `nama_mahasiswa`, `jenis_kelamin` (**L/P**, bukan M/F!), `tempat_lahir`, `tanggal_lahir` (`Y-m-d`), `id_agama`, **`nik` 16 digit**, **`nisn`**, `kewarganegaraan` (`ID`), `kelurahan` + `id_wilayah` (kode wilayah 5 level, mis. `180102`), `penerima_kps`, **`nama_ibu_kandung`**, `id_jalur_daftar`, `tanggal_daftar`, `id_pembiayaan`, `biaya_masuk`. Opsional/nullable: `npwp`, alamat rinci (`jalan/dusun/rt/rw/kode_pos`), `telepon/handphone`, `email`, `id_alat_transportasi`, `nomor_kps`, data ayah/ibu/wali (`nik_ayah` boleh null, `nama_ayah`, `id_pendidikan_*`, `id_pekerjaan_*`, `id_penghasilan_*`, `id_kebutuhan_khusus_mahasiswa/ayah/ibu`).
→ **Tiga temuan yang menyentuh skema kita:** (1) `students.sex` kini enum `('M','F')` padahal PDDikti memakai **`L`/`P`** — petanya disimpan sebagai **dua baris `pddikti_mappings` dengan `kind='VALUE'`, `entity='sex_type'`** (`M→L`, `F→P`) per §1.2, **bukan** sebagai `entity='sex_type'` tanpa `kind` seperti tulisan versi lama dokumen ini (diralat 2026-10-19 — `BENCH-123`); enum internal jangan diubah; (2) **NIK 16 digit** + **nama ibu kandung** adalah kunci pencocokan DUKCAPIL — `personal_nik_encrypted` sudah ada, tetapi `nama_ibu` baru hidup di `student_guardians (relation='IBU')`, jadi validasi wajib membaca dari sana (dasar pemrosesannya: §1.4(o)); (3) `penerima_kps`/`nomor_kps`/`id_pembiayaan`/`biaya_masuk` **belum punya kolom** → tambah di perluasan `0003` (sudah ditulis di DATA_MODEL §14.5(1)).

**(e) Jenis daftar & aturan riwayat akademik** `[DOK]`
`jenisdaftar`: **1** Peserta Didik Baru · **2** Pindahan · **3** RPL · **4** Pendidikan Non Gelar · **5** Fastrack. Aturan pusat: pindahan/RPL **wajib** `sks_diakui > 0` + Nilai Transfer + `id_pt_asal`/`id_prodi_asal`; peserta didik baru justru **harus kosong** `sks_diakui`; `periode_keluar ≥ periode_masuk`; input di tingkat fakultas dapat diarahkan ke prodi (NIM baru + tanggal pindah).
→ **Membenarkan `FR-KUR-02` (ekivalensi) & `FR-AKA-17` (pindah prodi)** yang kita catat dari Sevima: keduanya ternyata **syarat pelaporan nasional**, bukan fitur tambahan. Kolom baru: `students.feeder_entry_type_code` (1..5), `recognized_sks`, `transfer_grade`, `origin_pt_code`, `origin_program_code` — **satu nama yang menang**: ejaan lama `students.enrollment_route_code` pada kalimat sebelumnya adalah alias yang **dilepas** karena DATA_MODEL §14.5(2) sudah membekukan `feeder_entry_type_code` (diralat 2026-10-19 — `RD-13`; lihat juga tabel A di §1.2).

**(f) Kurikuler: SKS 4 rincian & capaian akhir** `[DOK]`
Mata kuliah: `sks_tatap_muka` + `sks_praktek` + `sks_praktek_lapangan` + `sks_simulasi` → `sks_mata_kuliah` **otomatis = jumlah**, tidak boleh 0, **≤ 9**, wajib `id_jenis_mata_kuliah` & `id_kelompok_mata_kuliah`; tab **Rencana Pembelajaran (RPS)** dan **Rencana Evaluasi** — rencana evaluasi **wajib sejak Ganjil 2024**, dan bobot `case method`/`team participative` + `project` **≥ 50%** untuk sumbangan **IKU 7**.
Mengajar dosen: `nidn`, bobot SKS, `rencana_minggu_pertemuan`, `realisasi_minggu_pertemuan` — **realisasi > 18 = error validasi**. KRS: peringatan di atas **24 SKS** (sama dengan BR-R2). Nilai: **skala nilai per prodi wajib dibuat lebih dulu**, lalu per kelas per **komponen evaluasi** (nama + bobot → angka → huruf → indeks) — konsisten dengan `grade_components` + AC-NIL-4.
Lulus/DO (`InsertMahasiswaLulusDO`): `id_jenis_keluar`, `id_periode_keluar`, `sk_yudisium` + tanggal, `IPK`, `judul_skripsi`, `jalur_skripsi`, pembimbing 1–3 + bulan awal/akhir, penguji, **`no_seri_ijazah`/`no_sertifikat_profesi`** (boleh kosong untuk Profesi/SP1/SP2 karena digenerate **PISN**).
→ **Selaras celah G-06:** `courses` baru punya `sks_teori`/`sks_praktik`; pembanding/PDDikti memecah **4** jenis. Perluasan kolom + peta kode wajib; `courses.sks` tetap otoritatif sebagai jumlah.

**(g) Tab "Validasi" = gerbang kirim (ini yang menahan pelaporan)** `[DOK]`
Sync **terhambat** bila validasi pusat merah: (1) aturan jenis daftar vs `sks_diakui`/nilai transfer & `periode_keluar < periode_masuk`; (2) `IPK`/`IPS > 4.0` atau `IPK = 0` tapi `IPS > 0`; (3) prodi belum diatur periodenya; (4) mahasiswa non-registrasi; (5) **Mahasiswa Ganda** (nama + tanggal + tempat lahir identik); (6) tanggal lahir tidak wajar (< 10 tahun) / jenis kelamin tidak sesuai; (7) `sks semester > 24`; (8) SKS mata kuliah tidak konsisten; (9) realisasi mengajar > 18; (10) periode **beririsan** antar prodi; (11) **mismatch DUKCAPIL**.
→ **Keputusan produk:** SICA menjalankan **seluruh cek ini pada saat input** (bukan saat kirim) — jawaban atas kelemahan Sevima D-5, dan bahan utama panel **Kesehatan Data** (FR-ADM-10). Tiap cek punya kode sendiri pada `pddikti_validation_findings` agar dapat dilaporkan per prodi & per record. Daftar di atas **11** dan itu **kurang** untuk lapangan: kosakata lengkapnya **27** `check_code`, lihat butir **(p)** di bawah dan DATA_MODEL §14.5(5) (diralat 2026-10-19 — `BENCH-132`).

**(h) Tenggat & bukti** `[DOK]`/`[PIHAK-KETIGA]`
**Checkpoint 1** ≤ 2 bulan setelah kuliah mulai: daya tampung, mahasiswa baru, mata kuliah, substansi, kurikulum, kelas, dosen pengajar, KRS, AKM. **Checkpoint 2** ≤ 2 bulan setelah kuliah selesai: skala nilai, nilai, update AKM, aktivitas, prestasi, lulus/DO. Praktik lapangan: **Ganjil sampai 30 April**, **Genap sampai 30 Oktober** (LLDIKTI VI; webinar pembanding menyebut 31 Oktober 2026). Perubahan riwayat butuh **Open Periode Tipe 1**, transaksi perkuliahan **Tipe 2**; lulus/DO & mahasiswa periode lampau hanya lewat pddikti-admin. **PDM** (Perubahan Data Mahasiswa) diajukan via portal dengan 6 kolom inti (NIM, Nama, Nama Ibu Kandung, Tempat Lahir, Tanggal Lahir, Periode Pendaftaran) + lampiran (surat permohonan, surat pernyataan + SPTJM pimpinan, ijazah/KRS-KHS/BAP); PISN butuh SK Yudisium + SPTJM; eksepsi masa studi butuh kalender akademik + bukti cuti.
→ Mengikat [DATA_MODEL §5 `academic_calendar_events`](file:///c:/SICA/docs/DATA_MODEL.md): `PDDIKTI_STUDY_PLAN_DUE` & `PDDIKTI_STUDY_RESULT_DUE` wajib **auto-terisi** saat admin membuat periode (bukan diingat manusia), dan `pddikti_correction_requests` kita adalah padanan teknis **PDM** (koreksi, bukan hard delete — BR-R10).

**(i) Matriks Checkpoint — objek × CP × aksi × temuan BLOCK yang menahan** `[DOK]` (norma lapangan;
diganti dari prosa karena inilah yang dipegang operator saat mengerjakan setoran) —
diralat 2026-10-19, menutup `BENCH-124`. Legenda: `[DOK]` = aksi ada di daftar terverifikasi §1.4(b);
`[PIHAK-KETIGA]` = nama aksi berasal dari repo integrator; `[USUL]` = jalur yang SICA usulkan dan belum
dinyatakan Feeder; `—` = tidak tersedia. **Kolom "menahan" adalah gerbangnya**: selama satu saja temuan
`BLOCK` terbuka untuk prodi/periode itu, seluruh baris objek tersebut tidak akan diterima pusat.

| Objek | Checkpoint | Insert | Update | Get | Temuan `BLOCK` yang menahan |
|---|---|---|---|---|---|
| Mahasiswa (biodata / data pokok) | CP1 | `InsertBiodataMahasiswa` `[DOK]` | `UpdateBiodataMahasiswa` `[DOK]` | `GetBiodataMahasiswa`, `GetListMahasiswa` `[DOK]` | `FEEDER_NIK_LENGTH`, `FEEDER_NISN_FORMAT`, `FEEDER_BIRTH_DATA`, `FEEDER_DUPLICATE_STUDENT`, `FEEDER_DUKCAPIL_MISMATCH`, `FEEDER_REGION_CODE_UNKNOWN`; hapus hanya lewat `DeleteBiodataMahasiswa` pada yang **belum pernah dilaporkan** (I-15) |
| Status mahasiswa / AKM per periode | CP1 **dan** CP2 | — (menempel pada `InsertPerkuliahanMahasiswa`) | `UpdatePerkuliahanMahasiswa` `[PIHAK-KETIGA]` | `GetStatusMahasiswa`, `GetSemester` `[DOK]` | `FEEDER_PERIOD_UNSET` (prodi belum diatur periodenya), `FEEDER_NON_REGISTRANT`, `FEEDER_PAST_AKM_MISSING` (AKM periode lampau kosong), `FEEDER_ACTIVE_WITHOUT_KRS`, `FEEDER_MINISTRY_PERIOD_CLOSED` |
| KRS / perkuliahan mahasiswa | CP1 | `InsertPerkuliahanMahasiswa` `[DOK]` | — `[USUL]` (perubahan lewat pembatalan + baris baru) | via `GetTranskripMahasiswa` `[DOK]` | `FEEDER_SEMESTER_SKS` (> 24 SKS), `FEEDER_ENTRY_TYPE_RULE` (`sks_diakui` vs jenis daftar), `FEEDER_PERIOD_UNSET`; **penahan struktural SICA:** `class_distributions` & `semester_results` belum ada DDL-nya (DATA_MODEL §14.7 → `0023`/`0018`) sehingga visibilitas KRS & plafon SKS tidak dapat dibuktikan (BENCH-35/37) |
| Kurikulum & kelas (matakuliah, kelas, rencana evaluasi, RPS) | CP1 | `InsertMataKuliah` `[PIHAK-KETIGA]`, `InsertKomponenEvaluasiKelas` `[DOK]` | — `[USUL]` | `GetListKomponenEvaluasiKelas` `[DOK]`, `GetProdi` `[PIHAK-KETIGA]` | `FEEDER_COURSE_SKS` (4 rincian ≠ jumlah, atau 0, atau > 9), `FEEDER_RPS_MISSING`, `FEEDER_EVALUATION_PLAN_MISSING` (wajib sejak Ganjil 2024; bobot `case method`+`project` ≥ 50% untuk IKU 7), `FEEDER_COMPONENT_WEIGHT_SUM` (≠ 100), `FEEDER_PROGRAM_CODE_UNREGISTERED` |
| Nilai per komponen & nilai akhir | CP2 | komponen saja (`InsertKomponenEvaluasiKelas` `[DOK]`) | `UpdateNilaiPerkuliahanKelas` `[DOK]` | `GetRiwayatNilaiMahasiswaKomponenEvaluasi` `[DOK]` | `FEEDER_LETTER_WITHOUT_INDEX`, `FEEDER_IPK_RANGE` (IPK/IPS > 4, atau IPK 0 tapi IPS > 0), skala nilai prodi belum dibuat (`grade_scales.owner_level`/`program_id` — DATA_MODEL §5, `RD-29`), `FEEDER_CLASS_WITHOUT_LECTURER` |
| Aktivitas mahasiswa / MBKM / prestasi | CP2 | `InsertAktivitasMBKMFlagship` `[DOK]` (v2.4) | — `[USUL]` | `GetJenisAktivitasMahasiswa` `[PIHAK-KETIGA]` | **penahan struktural SICA:** `student_activities`/`activity_kinds`/`achievement_levels` belum ada DDL-nya (`0026`) → tidak ada sumber baris untuk dikirim (BENCH-112/114); `FEEDER_DICTIONARY_STALE` bila `id_jenis_aktivitas_mahasiswa` local ≠ kamus pusat |
| Transkrip (hasil studi) | CP2 | — | — | `GetTranskripMahasiswa` `[DOK]` — **arah masuk**, lihat §1.4(m) | `FEEDER_TRANSCRIPT_MISMATCH_GRADUATION` (isi transkrip ≠ rekaman lulus), `FEEDER_SEMESTER_SKS`; **penahan struktural:** `transcript_versions`/`transcript_lines` belum ada (`0027`) → tidak ada objek yang bisa dibanding (BENCH-117, kewajiban arsip BR-R12) |
| Lulus / DO | CP2 | `InsertMahasiswaLulusDO` `[DOK]` | hanya lewat PDM/pddikti-admin | `GetJenisKeluar` `[DOK]` | `FEEDER_ACCREDITATION_EXPIRED` (BR-R7: prodi tidak boleh meluluskan dengan akreditasi kedaluwarsa), `no_seri_ijazah` kosong padahal diperlukan dan PISN belum kembali (BENCH-110), `sk_yudisium` + tanggal belum ada (objek `yudisium_batches` → `0027`), PDM belum lengkap enam kolom intinya (§1.4(o)) |
| Dosen mengajar (beban & realisasi) | CP1 | **DILARANG** — data dosen tidak pernah ditulis lewat Feeder (§1.4(c) butir 1) `[DOK]` | **DILARANG** | `GetProfilPT` `[DOK]` (+ NIDN dicocokkan dari SISTER/pddikti-admin) | `FEEDER_LECTURER_NIDN_INVALID`, `FEEDER_TEACHING_WEEKS` (realisasi > 18 = error validasi), bobot team teaching ≠ SKS kelas (BENCH-62: inilah penyebab gejala "SKS Dosen terbaca 0"), `planned_meetings`/`realized_meetings` belum ada di `class_assignments` (DATA_MODEL §14.5(4)) |
| Modus pembelajaran kelas (`sifat_pembelajaran` `F`/`O`/`M`) — **baris ditambah 2026-10-20, detail di §1.16** | CP1 (KELAS), jejak di CP2 (AKM) | menempel pada payload KELAS `[PIHAK-KETIGA]` — **hanya bila** kamus pusat punya entri; aksi `Insert*` yang mengirimnya belum terverifikasi di sandbox | sama: pemetaannya lewat `pddikti_mappings kind='VALUE' entity='sifat_pembelajaran'`, bukan lewat kode | `GetDictionary, fungsi=Insert…` `[DOK]` (§1.4(a)) — sumber kamus nilai modus | kamus belum di-*seed* → kolom `feeder_sifat_pembelajaran` **NULL** → baris **tidak ikut kirim** (I-14, `[VERIFIKASI-KAMUS]`); `classes.learning_modality`/`class_sessions.session_kind` belum ada di kode (`0049` belum dieksekusi) → `FEEDER_SOURCE_NOT_IMPLEMENTED` `[USUL]` menahan domain KELAS/KRS_AKM, bukan melewatinya |

Dua kalimat yang wajib diingat operator: **CP1 = ≤ 2 bulan setelah kuliah mulai** (daya tampung, maba, matakuliah,
kurikulum, kelas, dosen pengajar, KRS, AKM); **CP2 = ≤ 2 bulan setelah kuliah selesai** (skala nilai, nilai,
update AKM, aktivitas, prestasi, lulus/DO). Praktik lapangan Ganjil s.d. 30 April, Genap s.d. 30 Oktober
(LLDIKTI VI; `[PIHAK-KETIGA]` — webinar pembanding menyebut 31 Oktober 2026). Tenggat ini **harus** menjadi
baris `academic_calendar_events` ber-`is_mandatory = true` (DATA_MODEL §5: `PDDIKTI_STUDY_PLAN_DUE`,
`PDDIKTI_STUDY_RESULT_DUE`, `PDDIKTI_BETWEEN_DUE`), bukan ingatan manusia.

**(j) Matriks hak tulis per tipe reopen — `BENCH-125` (ditutup 2026-10-19).**
Re-open **bukan** satu flag `reopen_type`; ia mengubah **himpunan aksi** yang boleh dieksekusi.
`[DOK]` untuk batasannya: Tipe 1 = INSERT (data pokok + transaksional, disetujui LLDIKTI setelah BAP);
Tipe 2 = UPDATE (hanya transaksional). Konsekuensi yang harus ditegakkan di service **sebelum** job dibuat:

| Aksi data | Tipe 1 (INSERT) | Tipe 2 (UPDATE) | Penjaga yang menolak |
|---|---|---|---|
| Input **data pokok** mahasiswa (biodata baru) untuk periode lampau | **boleh** | **DITOLAK** | `reopen_type <> 'TYPE1'` → `409 REOPEN_TYPE_INSUFFICIENT`; Tipe 2 menolak insert data pokok |
| **Hapus** biodata mahasiswa | **DITOLAK** untuk yang sudah pernah dilaporkan (jalurnya pddikti-admin/PDM) | **DITOLAK** | invariance I-15: tidak ada `DELETE` jalur Feeder pada mode reopen apa pun |
| Koreksi isi biodata (nama, tanggal lahir, nama ibu) | bukan lewat reopen → **PDM** | bukan lewat reopen → **PDM** | `pddikti_correction_requests` + SPTJM (§1.4(o)) |
| Insert **transaksional** (perkuliahan/KRS, kelas, komponen evaluasi) yang **belum pernah** ada di pusat | **boleh** | **DITOLAK** (Tipe 2 hanya bisa mengubah baris yang sudah ada) | `feeder_jobs` menolak `Insert*` saat `reopen_type='TYPE2'` |
| Update nilai / koreksi nilai baris yang **sudah** dilaporkan | **boleh** | **boleh** | jendela `opens_at ≤ now() ≤ closes_at` + status `APPROVED` dan **belum** `USED` |
| Insert aktivitas mahasiswa / prestasi baru | **boleh** | **DITOLAK** | sama seperti insert transaksional |
| Lulus/DO untuk periode lampau, atau NIM yang sudah aktif | **DITOLAK dari WS** | **DITOLAK dari WS** | hanya pddikti-admin (portal); SICA menyimpan buktinya di `period_reopen_requests.llidikti_decision_ref` |
| Ekspor/perubahan **status** mahasiswa (cuti, aktif kembali) | **boleh** (insert riwayat) | **boleh** (update riwayat) | `student_status_history` wajib ada barisnya sebelum kirim (`FEEDER_PAST_AKM_MISSING`) |

Syarat administratif (semua tipe): satu `period_reopen_requests` per (prodi, periode) dengan
`bap_number` + `llidikti_decision_ref` + `approved_at` + jendela `opens_at`/`closes_at` — kolom-kolom itu
sudah ditambahkan ke DATA_MODEL §5 (diralat 2026-10-19 — `BENCH-126`). Setelah jendela menutup, permintaan
berpindah ke `USED`; memakai reopen yang sudah kedaluwarsa = `410 REOPEN_WINDOW_CLOSED`.

**(k) Objek Jembatan Feeder (Feeder Bridge) — `BENCH-127` (BLOCKER, ditutup 2026-10-19).**
Adapter kita **tidak dapat** menghubungi pusat dari serverless; yang benar adalah agen di sisi kampus +
antrean job. Ini objeknya (DDL & nomor migrasi: DATA_MODEL §14.7 → `0028_feeder_bridge.sql`; yang lama
`feeder_credentials`/`otp_events`/`feeder_environments` ikut didaftarkan di sana agar tidak menjadi
objek baru tanpa DDL):

| Objek | Isi minimum | Aturan keras yang tidak boleh hilang |
|---|---|---|
| `feeder_bridges` | `tenant_id`, `name`, `base_url`, `version`, `credential_ref`, `last_seen_at`, `is_active` | Hanya bridge **ter-registrasi** yang boleh menulis job; `credential_ref` menunjuk vault — **kredensial tidak pernah menjadi kolom** |
| `feeder_jobs` | `bridge_id`, `run_id`, `action`, `direction`, `record_key`, `idempotency_key`, `status`, `attempt`, `last_error_code`, `resume_offset`, `resume_limit` | `UNIQUE (tenant_id, idempotency_key)` **per record** → resume parsial tidak boleh menggandakan baris (§1.4(l)) |
| `feeder_identities` | `entity_type`, `local_id`, `feeder_id`, `source='BRIDGE_RESPONSE'`, `verified_at` | id PDDikti **hanya** dari respons bridge (I-14); `UNIQUE (tenant_id, entity_type, local_id)` |
| `feeder_credentials` | `tenant_id`, `environment`, `username`, `secret_ref`, `expires_at`, `otp_required`, `operator_membership_id`, `phone_ref` | masa berlaku wajib; **satu baris = satu penanggung jawab manusia** (§1.4(m)) |
| `otp_events` | `credential_id`, `requested_at`, `delivered_at`, `consumed_at`, `channel`, `code_hash` | kode OTP **tidak pernah** disimpan plaintext; retensi pendek (≤ 7 hari) |
| `feeder_environments` | `tenant_id`, `environment LOCAL-SANDBOX-PRODUCTION`, `base_url`, `port`, `is_default` | endpoint produksi **menolak** kredensial sandbox (BENCH-135) — diverifikasi saat `GetToken`, bukan saat kirim |

**(l) Matriks `error_code` → tindakan — `BENCH-129` (ditutup 2026-10-19).**
Bentuk respons: `{ error_code, error_msg, data }`; `0` = sukses. Yang lama hanya menyebut `100`, sedangkan
`-1`/`-2` dan resume `limit`/`offset` tidak pernah dispesifikasi — padahal di situlah job panjang mati
setengah jalan dan data ganda lahir.

| Kode / kondisi | Arti | Kelas | Tindakan otomatis | Batas & penghenti |
|---|---|---|---|---|
| `0` | sukses | — | `feeder_jobs.status='ACCEPTED'`; `feeder_identities` diisi dari `data` | — |
| `100` | token kedaluwarsa | retryable-1x | renegosiasi `GetToken`, **ulangi permintaan yang sama satu kali** | maks 1 renegosiasi per job per jendela; ke-2 → `FAILED_TOKEN` + notifikasi operator (jangan loop: renegosiasi berulang memicu OTP) |
| `-1` | timeout / koneksi putus | retryable | **`attempts` 5, backoff exponential 5 s → 80 s** (satu kurva dengan §3.1), resume dari `resume_offset` terakhir yang terkonfirmasi | setelah 5 → DLQ (`feeder_jobs.status='DEAD'`) dengan `last_error_code='-1'` — ini **transport**, jangan ditulis sebagai temuan validasi; **tidak pernah** mengirim ulang batch yang sudah `ACCEPTED` |
| `-2` | respons tidak dapat di-parse | **terminal** | hentikan **job** (bukan hanya record), simpan `raw_response` ter-redaksi untuk penyelidikan | `FAILED_PARSE` + `409 FEEDER_PARSE_FAILURE`; tidak ada retry otomatis — perbaikan dilakukan manusia karena retry terhadap respons rusak menghasilkan duplikasi |
| HTTP non-200 / TLS gagal / port tertutup | bridge atau jaringan mati | retryable | tandai `feeder_bridges.last_seen_at` basi; job **tidak** dianggap terkirim | `BRIDGE_OFFLINE` (state SM-7); pengiriman berikutnya ditahan, bukan dikirim "nanti juga sampai" |
| `error_msg` berisi penolakan validasi pusat | data ditolak (bukan transport) | terminal-per-record | tulis `pddikti_validation_findings` dengan `check_code` (§1.4(p)); record lain tetap jalan | record `REJECTED` tidak dihitung sukses; run berakhir `PARTIAL` bukan `SENT` |
| `limit`/`offset` (resume) | jendela baca/tulis parsial | — | cursor disimpan **di job**, per (action, filter); `resume_offset` hanya maju setelah record terkonfirmasi | larangan keras: **dilarang kirim ulang sebagian** (partial resend) yang menggandakan baris; idempotensi per record adalah satu-satunya penentu |

**Satu kalimat aturan:** sebuah record dianggap terkirim hanya bila `feeder_jobs` barisnya `ACCEPTED`;
`status='SENT'` pada run tidak boleh disimpulkan dari "tidak ada error" — run `PARTIAL` tetap menahan
penutupan checkpoint (lihat `pddikti_sync_runs.status`, DATA_MODEL §5).
⚑ **Catatan kejujuran untuk seluruh kode di (i)–(p):** nama kode HTTP/error yang saya sebut di sini —
`409 REOPEN_TYPE_INSUFFICIENT`, `410 REOPEN_WINDOW_CLOSED`, `403 FEEDER_ENVIRONMENT_MISMATCH`,
`409 FEEDER_PARSE_FAILURE`, `422 VA_FILTER_CONFLICT` — berstatus **`[USUL]`**. Inventaris kode error
API saat ini masih tidak koheren (`RD-12`), jadi setiap kode di atas **wajib didaftarkan lebih dulu**
di [API_SPEC §2.3](file:///c:/SICA/docs/API_SPEC.md) sebelum satu baris pun kode menulisnya; klien tidak
boleh membedakan retryable vs terminal dari kode yang belum terdaftar.

**(m) Runbook prefill + Kode Registrasi + OTP — `BENCH-130` (MAJOR operasional, ditutup 2026-10-19).**
1. **Prefill** dilakukan dari aplikasi Feeder lokal (`http://localhost:8100`), yang menarik **Kode
   Registrasi** dari portal pusat; tanpa langkah ini `GetToken` gagal dan seluruh pipeline diam.
2. **Login + kirim dapat menuntut OTP via WhatsApp ke nomor yang terdaftar di akun PDDikti.** Karena itu
   `feeder_credentials` wajib menyimpan `operator_membership_id` (orang yang **berhak atas nomor**) dan
   `phone_ref` (referensi nomor di vault, bukan nomor mentah). **Pemegang nomor = jabatan, bukan
   individu**: penugasan dibaca dari `user_role_assignments` dengan peran `FEEDER_OPERATOR` (lihat
   [RBAC_MATRIX §2](file:///c:/SICA/docs/RBAC_MATRIX.md)); saat operator pindah/berhenti,
   pengajuan ganti nomor dilakukan **di pddikti-admin** (jalur resmi) dan **tidak dapat** diganti
   self-service oleh SICA.
3. **Prosedur tetap saat operator berganti** (berurutan, semuanya ter-audit): (a) administrator akun
   PDDikti PT — unsur yang ditunjuk pimpinan, bukan kaprodi per kelas — mengajukan perubahan nomor
   via pddikti-admin `[DOK]`; (b) admin platform menutup baris `feeder_credentials` lama
   (`expires_at = now()`), membuka baris baru dengan `operator_membership_id` baru; (c) bridge melakukan
   `GetToken` sekali untuk membuktikan kredensial hidup; (d) `otp_events` dicatat; (e) baris lama **tidak
   dihapus** (jejak siapa yang memegang kredensial pada tanggal kirim tertentu adalah bukti untuk
   LLDIKTI).
4. **Mode OTP dibutuhkan → SM-7 masuk state `AUTH_OTP_REQUIRED`** (BLUEPRINT §5.8): job tidak
   di-retry otomatis; operator mendapat notifikasi `OTP_LOGIN` (kanal prioritas P0, §3.2) dan pekerjaan
   dilanjutkan manual. Ini mencegah loop renegosiasi yang membanjiri nomor kampus.
5. **Retensi & PII:** `otp_events` hanya menyimpan hash; nomor telepon mengikuti retensi kelas identitas
   (`retention_rules`), dan `raw_response` Feeder wajib diredaksi sebelum dipersist (UU PDP; §1.4(o)).

**(n) Drift kamus pusat — `BENCH-131` (ditutup 2026-10-19).**
Kode kamus PDDikti **berubah** tanpa pemberitahuan yang bisa dibaca aplikasi (contoh nyata: pemindahan
kecamatan, penambahan jenis aktivitas, perubahan label pekerjaan). Mekanismenya bukan "cron OBJ-4" yang
hidup di kepala operator, melainkan objek + temuan:
1. `reference_dictionary_entries` (global, tanpa `tenant_id`, SELECT-only → **tidak** ikut generator RLS,
   lihat DATA_MODEL §6.2) menyimpan `domain`, `code`, `name`, `version`, `effective_from`, `source`
   (`PDDIKTI` / `KEMENDAGRI`).
2. `reference_dictionary_versions(domain, version, captured_at, row_count, digest, diff jsonb)` —
   setiap sinkron `Get*` menulis satu versi; **diff** (tambah/ubah/hapus) dihitung terhadap versi aktif.
3. Job terjadwal (pengganti "OBJ-4", kini bernomor migrasi `0028` dan dapat dilacak) membandingkan kamus
   aktif dengan `reference_items`/`pddikti_mappings` tenant. Selisih menghasilkan
   `FEEDER_DICTIONARY_STALE` (severity `BLOCK` untuk domain yang akan dikirim, `WARN` sisanya) dan
   **menahan** run yang menyentuh domain itu sampai dipetakan ulang.
4. Peta nilai lokal ↔ pusat **tidak boleh** disalin ke `pddikti_mappings` secara manual bila sumbernya
   `source='SYNC'` tersedia; baris `MANUAL` yang menutupi kode lama adalah penyebab penolakan senyap
   nomor satu (§1.2 aturan 1).

**(o) PDM, persetujuan dua orang, lingkungan, dan dasar pemrosesan — `BENCH-133/134/135/136`
(ditutup 2026-10-19).**
- **PDM (Perubahan Data Mahasiswa) = enam kolom inti + lampiran.** Portal meminta **identitas**, bukan id
  baris kita: `nim`, `nama_mahasiswa`, `nama_ibu_kandung`, `tempat_lahir`, `tanggal_lahir`,
  `periode_pendaftaran`; lampiran: surat permohonan, surat pernyataan + **SPTJM pimpinan**,
  ijazah/KRS-KHS/BAP. Keenam kolom + `sptjm_number` + `attachment_ids` + `eksepsi_masa_studi` +
  `pisn_requires_sk_yudisium` **sudah ditambahkan** ke `pddikti_correction_requests` (DATA_MODEL §5) —
  tanpa itu pengajuan PDM hanya bisa diketik di luar sistem. PISN hanya boleh diminta **dengan** SK
  Yudisium; eksepsi masa studi hanya dengan kalender akademik + bukti cuti.
- **Dua orang untuk produksi (`BENCH-134`, BR-R11).** `pddikti_sync_runs.dry_run` default `true`;
  percobaan ke `environment='PRODUCTION'` ditolak DB kecuali `approved_by IS NOT NULL` dan
  `approved_by <> operator_id` (CHECK ada di DATA_MODEL §5). Penyetuju = pejabat ber-SK, bukan
  self-approval; berkas bukti (nomor BAP/keputusan LLDIKTI untuk reopen, SPTJM untuk PDM) menempel pada
  objek kerjanya, sehingga jejak untuk LLDIKTI dapat dicetak dari sistem, bukan dari log.
- **Sandbox vs produksi per tenant (`BENCH-135`).** `feeder_environments` + `feeder_credentials.environment`
  mengikat kredensial ke satu lingkungan; `GetToken` ke endpoint produksi dengan kredensial sandbox =
  **gagal keras** (`403 FEEDER_ENVIRONMENT_MISMATCH`), bukan peringatan.
  **RALAT 2026-10-21 (`RD-75`):** kalimat lama menulis "variabelnya `FEEDER_BASE_URL`/`FEEDER_PORT`/`FEEDER_ENVIRONMENT` per tenant (ENV_CONTRACT)" — salah dua-duanya. ENV adalah milik **deployment**, bukan milik tenant; menaruh endpoint per tenant di ENV berarti satu proses harus punya satu variabel per kampus. Bentuk yang benar: `feeder_environments` + `feeder_credentials` (baris DB, berversi, ber-RLS) memegang endpoint, pangkalan, dan environment per tenant; `ENV_CONTRACT §7` hanya menyediakan **fallback bootstrap** (`PDDIKTI_FEEDER_ENDPOINT`, `PDDIKTI_FEEDER_CREDENTIAL_REF`) untuk tenant pertama yang belum punya baris. Nama `FEEDER_BASE_URL`/`FEEDER_PORT`/`FEEDER_ENVIRONMENT` **tidak pernah** dideklarasikan di skema validasi (`apps/web/src/config/env.ts`) dan tidak lagi dipakai di dokumen mana pun. <!-- env-drift-quoted: baris ini mengutip nama kalah, bukan merujuk variabel hidup -->
- **Dasar pemrosesan NIK & nama ibu kandung (`BENCH-136`, BR-R14, UU PDP).** NIK + nama ibu adalah data
  pribadi **spesifik** yang dikirim ke pangkalan nasional. Kategorinya terdaftar di
  `data_processing_bases` sebagai `category='feeder_reporting'` dengan
  `basis='LEGAL_OBLIGATION'` (kewajiban pelaporan Permenristekdikti 59/2018 & regulasi turunan) —
  **bukan** `CONSENT`, sehingga "menarik persetujuan" tidak boleh dijadikan alasan menolak pelaporan;
  konsekuensinya: (a) `jra_ref` wajib diisi (dasar hukum retensi), (b) kolom tetap terenkripsi
  (`students.personal_nik_encrypted`) dan **tidak pernah** muncul di payload log, (c) DPIA (FR-ADM-19)
  mencatat penanggung jawab, pihak ketiga (bridge + Kemdiktisaintek), dan masa retensi,
  (d) subjek data dapat meminta salinan & koreksi lewat `data_subject_requests` (`dsr_kind='ACCESS'` /
  `'CORRECTION'`) tanpa menghentikan kewajiban laporan.

**(p) Kelengkapan kosakata `check_code` — `BENCH-132` (ditutup 2026-10-19).**
Daftar 11 kondisi pada butir (g) **kurang** untuk lapangan. Daftar lengkap 27 kode kini hidup di
DATA_MODEL §14.5(5) (`pddikti_validation_findings.check_code`); tambahan 16 yang sebelumnya tidak
terdaftar — dan yang paling sering menahan checkpoint — adalah:
`FEEDER_PT_CODE_UNREGISTERED`, `FEEDER_PROGRAM_CODE_UNREGISTERED`, `FEEDER_MINISTRY_PERIOD_CLOSED`,
`FEEDER_ACCREDITATION_EXPIRED`, `FEEDER_ACTIVE_WITHOUT_KRS`, `FEEDER_PAST_AKM_MISSING`,
`FEEDER_CLASS_WITHOUT_LECTURER`, `FEEDER_LECTURER_NIDN_INVALID`, `FEEDER_RPS_MISSING`,
`FEEDER_EVALUATION_PLAN_MISSING`, `FEEDER_COMPONENT_WEIGHT_SUM`, `FEEDER_LETTER_WITHOUT_INDEX`,
`FEEDER_TRANSCRIPT_MISMATCH_GRADUATION`, `FEEDER_NIK_LENGTH`, `FEEDER_NISN_FORMAT`,
`FEEDER_REGION_CODE_UNKNOWN`.
Konsekuensi produk: **seluruh 27 dijalankan pada saat input** (bukan saat kirim) — jawaban atas kelemahan
pembanding D-5 dan bahan utama panel Kesehatan Data (FR-ADM-10); tiap kode punya satu pesan `id`/`en`
di `admin.errors.*` dan dapat dilaporkan per prodi, per record, per operator.

---

### 1.5 Staging Layer — penyangga pra-push antara data operasional dan Feeder

**Cakupan sub-bagian ini.** §1.4(a) sudah menetapkan bahwa SICA tidak dapat menghubungi pusat dari
serverless dan bahwa semua tulisan wajib lewat **Feeder Bridge** + antrean job. §1.5 menutup bagian
yang belum pernah tertulis di dokumen mana pun: **job Feeder tidak boleh dibaca langsung dari tabel
operasional.** Tiga alasan, semuanya turunan dari bentuk Feeder, bukan selera arsitektur:

1. Payload Feeder adalah **proyeksi multi-tabel** — `students` + `student_guardians (relation='IBU')`
   + `student_addresses (is_preferred)` + `pddikti_mappings kind='VALUE'` + `feeder_identities`
   (lihat baris A §1.2). Bentuk baris `students` tidak pernah cukup, dan memetakannya saat kirim
   berarti pemetaan hidup di dua tempat.
2. Satu koreksi **PDM** (§1.4(o)) mengubah data operasional hari ini, tetapi **tidak boleh** mengubah
   apa yang sudah terkirim kemarin. Pembanding audit harus byte-exact terhadap yang benar-benar keluar.
3. `UNIQUE (tenant_id, idempotency_key)` pada `feeder_jobs` (§1.4(k)) hanya bermakna bila digest payload
   dihitung dari sesuatu yang **stabil**. Tabel operasional tidak stabil: ia disunting peran lain.

#### 1.5.1 Alur dan state pipeline

```
operational ──> staging ──> validated ──> queued ──> sent ──> acknowledged ──> reconciled
```

Sisi non-linear sengaja **tidak** digambar (diagram yang menyilang selalu disalahbaca sebagai izin):
`PUSHED` kembali ke `PACKED` hanya untuk kelas transport (§1.8.4); `PUSHED` ke `REJECTED`, lalu
`REJECTED` kembali menjadi baris staging baru setelah data induk dibetulkan; satu baris staging dapat
berakhir `SUPERSEDED`; dan `PACKED`/`PUSHED` yang habis anggaran retry berpindah ke `DEAD` pada sisi
**job** (DLQ, §1.8.8) — `DEAD` bukan keadaan staging. Nama keadaan pada pipeline ini adalah **`state`
yang dihitung** oleh view `pddikti_staging_status` atas enum `pddikti_staging_state`
(`PREPARED · VALIDATED · BLOCKED · PACKED · PUSHED · ACKNOWLEDGED · REJECTED · SUPERSEDED`,
DATA_MODEL §16.4.1/§16.4.4, `0031`) — **bukan kolom** di baris staging, karena staging append-only dan
keadaan yang disimpan harus di-`UPDATE` (DATA_MODEL §16.4.7 butiran (ii) menolak desain itu).

**Ralat 2026-10-20 (`RD-44`).** Versi lama sub-bagian ini memakai keadaan `STAGING`, `QUEUED`, `SENT`,
`RECONCILED`, `DISCARDED` di atas kolom fiktif `pipeline_state` milik tabel `feeder_staging_records`.
Tabel dan kolom itu **tidak pernah diregistrasi** DATA_MODEL; yang hidup adalah tujuh
`pddikti_staging_<domain>` + view `pddikti_staging_status` (`0031`). Tabel di bawah sudah dipetakan ke
kosakata pemenang; crosswalk lengkap + daftar konsep yang belum punya kolom ada di **§1.5.4**.

| `state` (view `pddikti_staging_status`) | Masuk karena | Boleh dihitung ulang menjadi | Yang memindahkan / yang menghitung | Larangan yang ditegakkan |
|---|---|---|---|---|
| `PREPARED` | baris staging ditulis: proyeksi payload dihitung + `payload_digest` disimpan | `VALIDATED`, `BLOCKED`, `SUPERSEDED` | service Feeder (`feeder.validate.run`); dihitung oleh view | isi baris staging tidak dapat diubah in-place; koreksi = **baris baru pada run baru** (§1.5.2 butir 3) |
| `BLOCKED` | ada temuan `severity='BLOCK'` yang belum `resolved_at` untuk `(run, staging_record_key)` | `VALIDATED` setelah temuan ditutup, `SUPERSEDED` bila run diganti | dihitung view dari `pddikti_validation_findings` (perluasan §16.4.4) | tanpa keadaan ini job **tidak boleh dibuat**; penolakan yang sah adalah `409 FEEDER_BLOCKING_FINDINGS` (API_SPEC §2.3 baris 32) |
| `VALIDATED` | mesin §1.6 lulus tanpa temuan `FATAL` dan tanpa `BLOCKING_CP` yang terbuka | `PACKED` | operator ber-`feeder.period.send` setelah `diff` §1.7 di-approve; untuk `PRODUCTION` juga `approved_by <> operator_id` (§1.4(o)) | `VALIDATED` adalah kesimpulan view, bukan tombol: tidak ada kolom `validated_at` di staging |
| `PACKED` | baris `feeder_jobs` ditulis (satu per `record_key`) dengan `idempotency_key` deterministik | `PUSHED`, kembali `PACKED` (hanya kelas transport, §1.8.4) | worker §1.8 (satu-satunya pihak yang menyentuh bridge) | `PACKED` tidak pernah dirender sebagai "terkirim" di layar mana pun |
| `PUSHED` | POST keluar ke bridge dengan body = byte yang diarsipkan di `pddikti_payload_snapshots` | `ACKNOWLEDGED`, `REJECTED`, kembali `PACKED` (hanya kelas transport) | worker | `PUSHED` **bukan** sukses; `pddikti_sync_runs.status='SENT'` tidak boleh disimpulkan dari "tidak ada error" (§1.4(l)) |
| `ACKNOWLEDGED` | `response_code = 0` dan `data` terbaca; view membaca `feeder_identities.feeder_id` | terminal sampai baris staging baru ada | worker (transaksi yang sama dengan isi `feeder_identities` + snapshot) | id PDDikti **hanya** ditulis dari `pddikti_payload_snapshots.feeder_id_returned` (I-14); `feeder_jobs.status='ACCEPTED'` |
| `REJECTED` | `error_code` validasi pusat (bukan transport), atau `feeder_jobs.status='FAILED'` | baris staging baru setelah data induk dibetulkan | manusia: `feeder.correction.request` atau pemilik data | tidak pernah di-retry otomatis; tidak pernah `DELETE` (I-15) |
| `SUPERSEDED` | run sengaja ditutup tanpa dikirim (keputusan service, bukan perhitungan view) | terminal | service, dengan alasan tercatat | bukan penghapusan: barisnya tetap ada (BR-R10); `DATA_MODEL §16.4.4` menegaskan view tidak menghasilkan nilai ini |

Dua keadaan yang dulu ditulis di sini (`RECONCILED`, `DISCARDED`) **tidak punya padanan di enum
pemenang** dan sengaja tidak dipaksakan: "sudah direkonsiliasi" dijawab oleh
`pddikti_reconciliation_diffs.applied_at`/`decision` (§1.7), bukan oleh staging; "dibatalkan sebelum
pernah dikirim" dijawab oleh `discard_reason` yang **masih berupa permintaan kolom** (§1.5.4) —
sebelum kolom itu ada, pembatalan dijalankan lewat penutupan run beralasan di `audit_logs`.

#### 1.5.2 Aturan keras staging

1. **Proyeksi, bukan salinan.** Baris staging menyimpan `canonical_payload jsonb` (kolom nyata
   `pddikti_staging_*`, DATA_MODEL §16.4.2/§16.4.3) = **persis bentuk field
   Feeder** (`nim`, `nama_mahasiswa`, `sks_praktek_lapangan`, …) hasil proyeksi dari kolom sumber lewat
   `pddikti_mappings kind='FIELD'` + peta nilai `kind='VALUE'`, dilengkapi kolom bertipe per domain yang
   memang ada di tabel staging (`sks_total`, `registered_sks`, `akm_status_code`). Tidak ada kolom
   operasional yang ikut tersalin; tidak ada field Feeder yang berasal dari tebakan.
2. **Satu baris = satu `record_key` + satu `payload_digest`.** Kombinasi itu adalah unit kerja, dan
   ditegakkan oleh `UNIQUE (tenant_id, run_id, record_key)` (§16.4.3): satu baris staging tidak pernah
   memuat dua record, dan satu record pada satu run hanya punya satu baris.
3. **Append-only: koreksi = baris baru pada run baru.** `record_key`, `domain`, `action`,
   `canonical_payload`, `payload_digest`, `packer_version`, `source_updated_at` **tidak dapat diubah**
   setelah insert — ditegakkan oleh `REVOKE UPDATE, DELETE … FROM sica_app` (§16.4.6), bukan oleh
   disiplin tim. Yang dihitung ulang hanyalah keadaan (lewat view, §1.5.1). Rantai versi tidak memakai
   kolom `rev`: run pengganti menunjuk run lama lewat `pddikti_sync_runs` dan `applied_run_id` pada diff
   (§16.4.6), sehingga "versi mana yang menggantikan" tetap dapat direkonstruksi tanpa kolom kedua.
4. **Tidak ada jalur UI yang mengedit staging secara bebas.** Staging hanya bergerak lewat workflow:
   `feeder.validate.run` (menutup temuan sampai `VALIDATED` dihitung view), `feeder.period.send`
   (`VALIDATED` ke `PACKED`), `feeder.correction.approve` / aksi pemilik data (`REJECTED` menjadi baris
   staging baru pada run berikutnya). Rute `/admin/feeder/**`
   **tidak pernah** menerima `canonical_payload` dari body klien; hanya `record_key` + `reason`.
   Ini penutup pola `SERVER_ONLY` (DATA_MODEL §14.9) pada kanal Feeder.
5. **Snapshot yang benar-benar dikirim diarsipkan.** Saat `PUSHED`, badan permintaan (`http_request`,
   **tanpa token** — guard `CHECK (NOT (environment='PRODUCTION' AND http_request ? 'token'))`) dan
   respons yang dipangkas (`response_code`/`response_msg`/`response_body`) ditulis ke
   `pddikti_payload_snapshots` per `attempt` dan tidak dapat diubah (§16.4.5). Retensi mengikuti
   `retention_rules` (§16.5) per kelas: `feeder_snapshot` **P730D** di DB lalu arsip storage,
   `feeder_staging` **P365D**; payload yang menyentuh kelulusan/ijazah ikut kelas
   **rekaman inti permanen** (BR-R12), sisanya kelas identitas/pelaporan dengan alasan wajib terisi.
6. **Staging tidak memegang kredensial.** Hanya `bridge_id` + `environment` (BENCH-135). Token,
   username, password, nomor OTP tidak pernah menjadi kolom maupun isi payload (§1.4(k)/(m);
   `credential_ref` = referensi vault).
7. **Selalu dibaca/ditulis di Primary.** Staging adalah read-your-writes (AGENTS §3.7): setelah
   `VALIDATED` ditulis, pembacaan berikutnya **wajib** ke Primary. Query rekonsiliasi murni-teoritis
   boleh ke replica, tapi tidak pernah untuk memutuskan apa yang akan dikirim.

#### 1.5.3 Gramatika `record_key`, digest, dan `idempotency_key`

```
record_key = <domain>:<local_id>:<flavor>
  domain   : anggota enum TERTUTUP `pddikti_domain` — MAHASISWA | KURIKULUM | KELAS | KRS_AKM |
             NILAI | AKTIVITAS | KELUAR (DATA_MODEL §16.4.1/§15, kardinalitas tetap TUJUH,
             satu domain = satu tabel staging = satu `record_prefix`)
  local_id : uuid baris sumber milik tenant ini (bukan id Feeder)
  flavor   : 'core' default; varian eksplisit bila satu baris menghasilkan lebih dari satu payload
             (mis. 'kps' untuk indikator pembiayaan, 'transfer' untuk nilai transfer)
  contoh   : MAHASISWA:9f1c…:core | NILAI:7b2a…:final | KURIKULUM:7b2a…:c1
```

> **Ralat 2026-10-20 (`RD-44`, turunan).** Versi lama daftar ini menulis sembilan nama domain bebas
> (`student`, `entry`, `enrollment`, `course`, `learning_class`, `eval_component`, `grade`, `akm`,
> `activity`, `graduation`). Tidak satu pun anggota `pddikti_domain`, dan enum itu tertutup — menulis
> domain di luar tujuh nilai berarti baris staging tidak pernah punya tabel. Pemetaan yang dipakai
> sekarang: `student`/`entry` → **MAHASISWA**; `course` → **KURIKULUM**; `learning_class`/
> `eval_component` → **KELAS**; `enrollment`/`akm` → **KRS_AKM**; `grade` → **NILAI**; `activity` →
> **AKTIVITAS**; `graduation` → **KELUAR**. Perbedaan varian (mis. `entry` vs `biodata`) dibawa oleh
> `flavor`, bukan oleh domain baru.

- `payload_digest = sha256(kanonikalisasi(canonical_payload))` heksadesimal 64 karakter (kolom nyata
  `char(64)` di tiap `pddikti_staging_*`, §16.4.2/§16.4.3; `CHECK (length(payload_digest) = 64)`).
  Kanonikalisasi: kunci
  terurut leksikografis, tanpa spasi, angka ditulis sebagai string desimal kanonik (tanpa nol berlebih),
  tanggal `YYYY-MM-DD`, `null` disimpan eksplisit (bukan hilang), field biner digantikan
  `attachment:<id>:<sha256>` — bukan base64.
- Versi kamus yang dipakai menghitung payload **ikut menjadi bahan digest kunci idempotensi**. Yang
  sudah berpemilik: `reference_dictionary_versions(domain, version, effective_from, source)` + digest
  barisnya (DATA_MODEL §14.7 baris G → `0028`), dan `packer_version` pada baris staging. **Tidak ada
  kolom bernama `dictionary_fingerprint`** — ia nama konsep dari versi lama bagian ini dan sekarang
  berstatus **permintaan kolom** (§1.5.4 daftar permintaan): ia harus diregistrasi DATA_MODEL lebih
  dulu sebelum satu baris kode pun menulisnya. Tujuannya tetap: payload yang sama tetapi dihitung dari
  kamus berbeda **harus** tampak berbeda, karena pusat bisa menolak yang kedua (BENCH-131).
- `feeder_jobs.idempotency_key = sha256(concat_ws('|', tenant_id, action, record_key, payload_digest,
  packer_version, dictionary_version, coalesce(reopen_request_id, '-')))` → 64 karakter heks.
  `dictionary_version` dan `reopen_request_id` pada baris di atas **belum menjadi kolom mana pun**
  (§1.5.4); sampai keduanya ada, rumus yang dapat dijalankan hari ini hanyalah empat suku pertama.
  Ejaan lama di dokumen ini menyebut hasilnya "40 karakter heks" — itu salah hitung SHA-256 dan
  **diralat 2026-10-20** menjadi 64, sama dengan panjang yang diwajibkan `CHECK (length(...) = 64)` di
  §16.4.3. Konsekuensi yang harus dipahami, bukan dikira-kira: **retry attempt ke-2/3/4 memakai key
  yang sama** (tidak melahirkan baris baru, sesuai `UNIQUE (tenant_id, idempotency_key)`), sedangkan
  **payload yang sudah dibetulkan menghasilkan key baru** dan itu memang attempt pengiriman baru —
  bukan duplikasi, karena isinya beda.

#### 1.5.4 Bentuk objek — **ralat nama ke pemenang DATA_MODEL** (`RD-44`, ditutup di dokumen ini 2026-10-20)

**Aturan kepemilikan yang berlaku di seluruh §1.5.** Nama tabel, nama kolom, tipe, indeks, dan nomor
migrasi adalah milik [DATA_MODEL §14.7 & §16.4](file:///c:/SICA/docs/DATA_MODEL.md). Dokumen ini hanya
**menunjuk** nama itu dan menjelaskan perilakunya. Versi lama bagian ini menulis DDL tandingan
(`CREATE TABLE feeder_staging_records` + tujuh `ALTER TABLE … ADD COLUMN` hasil karangan) untuk objek
yang **tidak pernah diregistrasi** di mana pun. Itu cacat, bukan kebebasan: dua nama untuk satu buffer
staging berarti dua bentuk payload, dan kirim Feeder berhenti dapat direproduksi. Blok DDL itu
**dihapus** dari bagian ini; di bawah ini hanya ada crosswalk + daftar permintaan.

**(1) Crosswalk: ejaan lama → nama pemenang → nomor.**

| Konsep yang dimaksud | Ejaan lama (DILEPAS, jangan dipakai lagi) | Nama pemenang yang dipakai sekarang | Rumah |
|---|---|---|---|
| Penyangga pra-push, satu baris per record per run | `feeder_staging_records` | **tujuh `pddikti_staging_<domain>`** (`_mahasiswa`, `_kurikulum`, `_kelas`, `_krs_akm`, `_nilai`, `_aktivitas`, `_keluar`), `UNIQUE (tenant_id, run_id, record_key)`, kolom bertipe + `canonical_payload`/`payload_digest` | DATA_MODEL §16.4.3 → `0031` bagian A |
| Keadaan baris staging | kolom `pipeline_state` | **`state` hasil hitung** pada view `pddikti_staging_status` atas enum `pddikti_staging_state` (`PREPARED · VALIDATED · BLOCKED · PACKED · PUSHED · ACKNOWLEDGED · REJECTED · SUPERSEDED`) | §16.4.1/§16.4.4 → `0031` bagian B (butuh `0028`) |
| Arsip byte request/response per percobaan | `feeder_payload_archives` | **`pddikti_payload_snapshots`** (`http_request`, `request_digest`, `http_status`, `response_code`, `response_msg`, `response_body`, `feeder_id_returned`, `attempt`, `storage_key`) | §16.4.5 → `0031` bagian A |
| Eksekusi mesin validasi (satu siklus) | `feeder_validation_runs` sebagai **tabel** | **`pddikti_sync_runs`** (kolom tambahan `checkpoint`, `ruleset_version`, `staging_rows`, `blocked_rows`, `manifest_digest`, `push_started_at`) + **view** `pddikti_validation_runs` (`security_invoker = true`) | §16.4.4 → `0031`; view adalah **pemenang sebagai view**, tabelnya kalah |
| Satu siklus banding lokal vs pusat (arah masuk) | `feeder_reconciliation_runs` | **`pddikti_sync_runs`** dengan `feeder_jobs.direction='INBOUND'` (satu job per halaman, `resume_offset`/`resume_limit`) | §14.7 baris G → `0028` |
| Satu selisih + disposisi manusia | `feeder_reconciliation_items` | **`pddikti_reconciliation_diffs`** (`local_digest`, `center_digest`, `diff jsonb`, `severity`, `decision pddikti_reconciliation_decision`, `decision_reason`, `evidence_ref`, `decided_by`, `validated_by`, `applied_at`, `applied_run_id`) | §16.4.6 → `0031` bagian A |
| Kunci baris staging pada temuan | `pddikti_validation_findings.record_key` + `staging_rev` | **`staging_record_key`** (satu kolom, tanpa `rev`) | §16.4.4 ALTER |
| Riwayat circuit breaker per bridge | `feeder_breaker_events` | **belum ada pemenangnya** — lihat daftar permintaan (2) | — |
| Token bucket sementara tanpa Redis | `feeder_rate_slots` | **belum ada pemenangnya**; pemilik perilaku limiter/breaker adalah [ARCHITECTURE §10.4.1](file:///c:/SICA/docs/ARCHITECTURE.md) (`feeder.push`), dan itu **target** sampai `bullmq`/`ioredis` nyata (`RD-11`, `P-6`) | — |

Satu nama sengaja **tidak** diberi prefiks di sini: `reconciliation_runs` **tanpa** `feeder_` adalah
objek gugus keuangan (kanal pembayaran/VA — §2.4, DATA_MODEL §14.7 baris B). Dua mekanisme berbeda
dengan satu nama adalah tabrakan yang dulu ingin saya hindari dengan prefik; prefiks itu sendiri yang
kalah, karena DATA_MODEL memilih `pddikti_reconciliation_diffs`. Pemisahan istilah ditulis terang di
**§5.5**.


**(2) Permintaan kolom — ditulis sebagai kebutuhan, bukan sebagai DDL.** Semua baris di bawah ini
**belum ada di skema mana pun**; kolomnya tidak boleh ditulis kode sampai DATA_MODEL mendaftarkannya
(di `0028` untuk gugus bridge, di `0031` untuk gugus staging). Yang sudah diputuskan DATA_MODEL tidak
diulang di sini — kolom hasil ALTER §16.4.4/§16.4.5/§16.4.6 adalah pemenang dan bagian ini memakainya.

| Kebutuhan perilaku | Nama yang dipakai bagian ini | Padanan yang **sudah ada** hari ini | Status |
|---|---|---|---|
| Memisahkan kegagalan transport vs validasi per job (§1.8.4) | `feeder_jobs.transport_class` | `feeder_jobs.last_error_code` + `attempt` (§14.7 baris G, `0028`) | **permintaan** — tanpa ini, klasifikasi hanya hidup di kepala worker |
| Penjadwalan ulang & konfirmasi-before-retry (§1.8.3) | `feeder_jobs.next_retry_at`, `deadline_at`, `confirmed_at` | `feeder_jobs.resume_offset`, `resume_limit` | **permintaan** — hari ini resume berjalan dari offset, bukan dari waktu |
| DLQ yang dapat di-query per prodi (§1.8.8) | `feeder_jobs.dead_reason`, `dead_at`, `replay_of` | `feeder_jobs.status` (nilai `DEAD` belum diregistrasi sebagai bagian kosakata) | **permintaan** — `replay_of` adalah satu-satunya cara membuktikan "job ini bukan duplikasi" |
| Keadaan breaker di sisi bridge (§1.8.6) | `feeder_bridges.breaker_state`, `open_until`, `consecutive_transport_failures` | `feeder_bridges.last_seen_at`, `is_active`, `credential_ref` | **permintaan**; target akhirnya limiter/breaker BullMQ di ARCHITECTURE §10.4.1 (`bullmq`/`ioredis` **design-only**, `RD-11`) |
| Riwayat transisi breaker (untuk menjawab "berapa lama produksi butek") | `feeder_breaker_events` | tidak ada | **permintaan objek** ke §14.7; dokumen ini tidak membuat DDL-nya |
| Penanda laju sementara tanpa Redis (§1.8.7) | `feeder_rate_slots` | tidak ada | **permintaan objek**, dan hanya lahir bila `feeder_environments` menuntut limiter sebelum `ioredis` nyata |
| Bundel bukti per run (§1.9) | `pddikti_sync_runs.evidence_bundle_digest` | `manifest_digest` (sudah ada, §16.4.4) — **itu yang dipakai** untuk daftar `record_key`; digest bundel adalah tambahan | **permintaan**; jangan menyamakan `manifest_digest` dengan "isi bukti" |
| Empat tingkatan temuan (§1.6.2) | `pddikti_validation_findings.level` (`FATAL · BLOCKING_CP · WARNING · INFO`) | `severity CHECK ('WARN','BLOCK')` + kolom baru `domain`, `staging_record_key`, `feeder_error_code`, `feeder_error_msg`, `snapshot_id` (§16.4.4) | **permintaan** — dan proyeksinya wajib `severity` tetap terhitung, bukan dirombak diam-diam |
| Bahan remedi temuan (§1.6.4) | `expected`, `actual`, `remedy_href` | tidak ada | **permintaan** — tanpa ketiganya temuan tidak dapat ditindaklanjuti prodi lain |
| Penunjuk reopen/PDM dari job | `reopen_request_id` | objek `period_reopen_requests` + `pddikti_correction_requests` **sudah ada** (§5) | **permintaan kolom penunjuk**, bukan objek baru |

**`created_at`/`updated_at`, RLS, dan `REVOKE` tidak diduplikasi di sini** — konvensi waktunya milik
DATA_MODEL §1, dan penegakan append-only gugus ini sudah ditulis di §16.4.6
(`REVOKE UPDATE, DELETE ON tujuh pddikti_staging_* + pddikti_payload_snapshots FROM sica_app`;
`pddikti_reconciliation_diffs` boleh di-`UPDATE` karena ia objek kerja ber-status dua penyetuju, bukan
buffer kirim).

**Dua kosakata keadaan, dua objek — jangan disatukan.** `state` pada view `pddikti_staging_status`
(delapan nilai `pddikti_staging_state`) menjawab "sampai mana kandidat payload ini"; `feeder_jobs.status`
menjawab "apa yang terjadi pada percobaan ini". Satu baris staging dapat menunjuk beberapa baris job
(`attempt`, replay §1.8.8) dan beberapa baris `pddikti_payload_snapshots`; menggabungkan keduanya akan
menghapus riwayat percobaan, yaitu justru bukti yang diminta §1.9. Perhatikan bahwa enum pemenang **tidak
memiliki** `DEAD` dan **tidak memiliki** `DISCARDED`: keadaan habis-anggaran ada di sisi job, dan
pembatalan run adalah keputusan service yang beralasan di `audit_logs` — bukan kolom status di baris
yang tidak boleh di-`UPDATE`.

`severity` yang lama (`'WARN'`/`'BLOCK'`) **tidak dirombak diam-diam**: ia menjadi proyeksi turunan
(`FATAL` dan `BLOCKING_CP` menjadi `BLOCK`; `WARNING` dan `INFO` menjadi `WARN`) sampai pemilik
DATA_MODEL §5 memutuskan melebarkan `CHECK` atau membiarkan `severity` terhitung. Menambahkan
`level` sebagai `NOT NULL DEFAULT` akan **menaikkan derajat temuan lama secara massal** karena
backfill diam-diam — karena itu kolom dibuka nullable dulu. **Satu cacat lama yang sudah ditutup
DATA_MODEL, dan catatannya di sini saya cabut:** `UNIQUE (tenant_id, check_code, entity_type, entity_id)`
menggabungkan dua record berbeda dalam satu entitas besar, dan kuncinya kini **sudah** diperbaiki lewat
§16.4.4 — `DROP CONSTRAINT` (nama dibaca dari `pg_constraint`, tidak ditebak) lalu indeks parsial
`uq_pddikti_findings_open … WHERE resolved_at IS NULL` plus kolom `staging_record_key`. Yang tersisa
untuk pemilik register hanyalah `level`/`expected`/`actual`/`remedy_href` (baris permintaan di atas).

#### 1.5.5 Matriks domain → staging → aksi → checkpoint → reopen → penjaga

Kolom Checkpoint, mode reopen, dan penjaga **menyalin keputusan** §1.4(i)/(j); bila ada pertentangan,
**§1.4(j) yang menang**. Yang baru di sini hanyalah dua kolom paling kiri: dari mana payload dihitung
dan bagaimana bentuknya di staging. **Kolom paling kiri kini memakai enum `pddikti_domain`**
(tujuh nilai tetap — pemetaan nama lama di §1.5.3); `domain` di luar tujuh nilai tidak dapat ditulis
karena tabel staging-nya tidak ada.

| Domain (`pddikti_domain`) | Sumber lokal (baca) | Bentuk staging (`record_key`) | Aksi Feeder | Checkpoint | Mode reopen yang sah | Penjaga yang menolak |
|---|---|---|---|---|---|---|
| `MAHASISWA` (biodata / data pokok) | `students` + `student_guardians(relation='IBU')` + `student_addresses(is_preferred)` + `pddikti_mappings` + `feeder_identities(entity_type='student')` | `MAHASISWA:<students.id>:core` | `InsertBiodataMahasiswa` bila id belum ada, jika sudah `UpdateBiodataMahasiswa` (§1.3.2) | CP1 | Tipe 1 boleh insert; Tipe 2 **menolak** insert data pokok; koreksi isi lewat PDM | `409 REOPEN_TYPE_INSUFFICIENT`; I-15 menolak `DELETE`; `FEEDER_NIK_LENGTH`, `FEEDER_DUKCAPIL_MISMATCH`, `FEEDER_REGION_CODE_UNKNOWN` |
| `MAHASISWA` (riwayat masuk: jenis daftar, nilai transfer, asal) | `students.feeder_entry_type_code`, `recognized_sks`, `transfer_grade`, `origin_pt_code`, `origin_program_code` | `MAHASISWA:<students.id>:transfer` | `InsertRiwayatPendidikanMahasiswa` | CP1 | Tipe 1 | `FEEDER_ENTRY_TYPE_RULE` (§1.4(e)); `FEEDER_ID_REGISTRATION_MISSING` `[USUL]` |
| `KRS_AKM` (KRS / perkuliahan) | `enrollments` × `classes` × `curricula` + `feeder_identities(class, riwayat_pendidikan, curriculum)` + `semester_results` (usulan `0018`) | `KRS_AKM:<enrollments.id>:krs` | `InsertPerkuliahanMahasiswa`; update `[USUL]` (§1.4(i) baris KRS) | CP1 | Tipe 1 insert; Tipe 2 hanya baris yang sudah ada | `FEEDER_SEMESTER_SKS`, `FEEDER_CURRICULUM_ID_MISSING` `[USUL]`, `FEEDER_CLASS_ID_MISSING` `[USUL]`, `404 MODULE_NOT_AVAILABLE` bila modul non-ACTIVE |
| `KURIKULUM` (matakuliah) | `courses` + 4 rincian SKS (DATA_MODEL §11.4) + `course_type` | `KURIKULUM:<courses.id>:core` | `InsertMataKuliah` | CP1 | Tipe 1 | `FEEDER_COURSE_SKS`; `FEEDER_DICTIONARY_STALE` untuk `id_jenis_mata_kuliah`; dua kolom SKS belum ada di kode → `NOT_IMPLEMENTED` (§1.6.1) |
| `KELAS` (rombel/kelas kuliah) | `classes` + `class_schedules` + `lecturers.nidn` + **`classes.learning_modality`** (§1.16: sumber `sifat_pembelajaran`; kolomnya belum ada → `NOT_IMPLEMENTED`) | `KELAS:<classes.id>:core` | insert `[PIHAK-KETIGA]`, id **wajib** diambil dari respons `Get*` | CP1 | Tipe 1 | `FEEDER_PROGRAM_CODE_UNREGISTERED`, `FEEDER_CLASS_WITHOUT_LECTURER`; I-14 bila id dikarang; kamus modus kosong → baris tidak ikut kirim (§1.16.1) |
| `KELAS` (rencana evaluasi) | `grade_components` (`weight_pct`) + `grade_scales` per prodi | `KELAS:<grade_components.id>:eval` | `InsertKomponenEvaluasiKelas` `[DOK]` | CP1 (rencana) dan CP2 (isi nilai) | Tipe 1 insert; Tipe 2 ubah | `FEEDER_COMPONENT_WEIGHT_SUM` (tidak sama 100), `FEEDER_EVALUATION_PLAN_MISSING` |
| `NILAI` (nilai akhir per mahasiswa per kelas) | `grades.raw_score`, `letter_code`, `point_value` (**SERVER_ONLY**) | `NILAI:<grades.id>:final` | `UpdateNilaiPerkuliahanKelas` `[DOK]` | CP2 | Tipe 1 dan Tipe 2 **boleh**, dalam jendela `opens_at`–`closes_at` dan status `APPROVED` belum `USED` | `FEEDER_LETTER_WITHOUT_INDEX`, `FEEDER_IPK_RANGE`, `410 REOPEN_WINDOW_CLOSED`, `409 GRADE_LOCKED_USE_CORRECTION_WORKFLOW` |
| `KRS_AKM` (status keaktifan per periode) | `student_status_history` + `semester_results` (IPS/IPK/sks semester) | `KRS_AKM:<enrollments.id>:akm` | menempel `InsertPerkuliahanMahasiswa`; `UpdatePerkuliahanMahasiswa` `[PIHAK-KETIGA]` | CP1 **dan** CP2 | Tipe 1 insert riwayat; Tipe 2 update riwayat | `FEEDER_PAST_AKM_MISSING`, `FEEDER_NON_REGISTRANT`, `FEEDER_ACTIVE_WITHOUT_KRS`, `FEEDER_PERIOD_UNSET` |
| `AKTIVITAS` (aktivitas/MBKM/prestasi) | `student_activities` + `activity_kinds.feeder_id_jenis_aktivitas` (usulan `0026`) | `AKTIVITAS:<student_activities.id>:core` | `InsertAktivitasMBKMFlagship` `[DOK]` | CP2 | Tipe 1 insert; Tipe 2 **DITOLAK** | `FEEDER_DICTIONARY_STALE`; sumber belum ada DDL-nya → `NOT_IMPLEMENTED` |
| `KELUAR` (lulus / DO) | `graduation_records`, `yudisium_batches` (`0027`), `no_seri_ijazah`/PISN | `KELUAR:<graduation_records.id>:core` | `InsertMahasiswaLulusDO` `[DOK]` | CP2 | **Bukan lewat WS** untuk periode lampau / NIM aktif (§1.4(j)) | `FEEDER_ACCREDITATION_EXPIRED` (BR-R7), `sk_yudisium` kosong, PISN belum kembali (BENCH-110) |
| **dosen mengajar** | `class_assignments` (`planned_meetings`, `realized_meetings`, `teaching_sks_weight`) | **tidak distaging untuk tulis** | **DILARANG** (§1.4(c) butir 1) | baca-saja CP1 | tidak ada | `kirimDosen` tidak boleh ada di kontrak; hanya `GetProfilPT` + pencocokan NIDN |
| presensi, tagihan, ruang, bahan ajar | `attendances`, `attendance_evidence` (§5), `invoices`, `rooms`, `lms_materials` | **tidak distaging** | tidak ada objeknya di Feeder (§1.4(c) butir 2–5) | — | — | staging menolak domain di luar `pddikti_domain` (allowlist tertutup, bukan turunan); presensi hanya menjadi **dasar** aturan `SEM-PRESENCE-MIN` (§1.11.2) |

#### 1.5.6 Permukaan tulis (write surface) dan tidak ada edit bebas

Empat titik tulis yang sah, semuanya `feeder_pddikti` dan semuanya ter-audit (§1.9). Rutenya mengikuti
nama yang sudah terdaftar di API_SPEC §4.6.6; tambahan yang belum terdaftar diberi tanda `[USUL]` dan
**wajib** masuk API_SPEC §2.3/§4.6.6 sebelum kode menulisnya (aturan yang sama dengan ⚑ §1.4(l)):

| Titik tulis | Rute | Izin | Body yang diterima (whitelist Zod) |
|---|---|---|---|
| hitung staging dari data induk | `POST /admin/feeder/stage` `[USUL]` | `feeder.sync.run` | `domain`, `record_key`/filter periode-prodi, `dry_run` — **tanpa payload** |
| jalankan mesin validasi | `POST /admin/feeder/validate` | `feeder.validate.run` | `stage`, `domain`, `period_id`, `program_id` |
| setujui diff lalu antrekan | `POST /admin/feeder/push` | `feeder.period.send` (+ `approved_by` untuk PRODUCTION) | `sync_run_id`, `diff_approval_id`, `bridge_id`, `environment` |
| disposisi selisih rekonsiliasi | `POST /admin/feeder/reconciliation/:itemId/decide` `[USUL]` | `feeder.correction.approve` (aksi `VALIDATE`) | `disposition`, `reason` minimal 10 karakter |

Enam lapis penegakan AGENTS §3.8 berlaku penuh di keempatnya; yang paling sering bocir di kanal ini:
**L2** — `tenant_id`/`actor` hanya dari token terverifikasi dan middleware menghapus
`x-tenant-id`/`x-user-id` kiriman klien (`SEC-07`); **L4** — scope prodi/periode dibaca dari
`holdsScoped` terhadap `user_role_assignments`, bukan dari label peran (`SEC-11`); **anti-IDOR** —
`record_key` dan `sync_run_id` dari klien wajib diselesaikan ke barisnya **di dalam transaksi**
(`WHERE tenant_id = ctx.tenantId AND record_key = $1`) sebelum state apa pun berubah.

### 1.6 Data Validation Engine (pra-kirim)

Engine ini adalah **gerbang**, bukan penasihat. Ia menjawab satu pertanyaan dengan satu jawaban
deterministik: *apakah byte pada `canonical_payload` baris staging ini boleh meninggalkan bridge?*

#### 1.6.1 Kontrak eksekusi

1. **Aturan hidup di kode; temuan hidup di database.** Sama seperti `FIELD_RULES` (AGENTS §3.8),
   katalog aturan berada di `packages/contracts/src/feeder-validation.ts` sebagai
   `FEEDER_VALIDATION_RULES: readonly FeederRule[]` — **tidak** dibuatkan tabel aturan. Alasan: baris DB
   yang dapat diedit peran admin akan mampu menurunkan gerbang pelaporan nasional tanpa tinjauan kode,
   dan itu persis celah `SEC-*` yang sudah kita catat untuk izin. Yang dibuat tabel hanyalah
   **hasil eksekusi** (`pddikti_validation_findings`) dan **riwayat eksekusi** (`pddikti_sync_runs`,
   dibaca lewat view `pddikti_validation_runs` — §1.5.4).
2. **Masukan engine = baris staging, bukan tabel operasional.** Ini yang membuat "yang divalidasi"
   identik dengan "yang dikirim". Engine yang membaca `students` langsung akan meloloskan payload yang
   berbeda dari yang dihitung §1.5 — dan pusat menolaknya tanpa kita bisa mereproduksi.
3. **Dua lintasan, satu katalog.** `PASS-INPUT` berjalan pada setiap tulis Admin (norma §1.4(g): cek
   saat input, bukan saat kirim; inilah bahan panel Kesehatan Data FR-ADM-10). `PASS-PUSH` berjalan
   sekali per run (`pddikti_sync_runs`, dibaca lewat view `pddikti_validation_runs`) sebelum baris
   staging boleh dihitung `VALIDATED` oleh view `pddikti_staging_status`. Aturan yang sama dieksekusi di
   keduanya; yang berbeda hanyalah tingkat yang menolak (lihat tabel §1.6.2 kolom "berlaku pada").
4. **Determinisme terukur.** Input `(isi baris staging, packer_version, ruleset_version run, versi
   kamus yang dipakai)` yang sama
   **wajib** menghasilkan himpunan temuan yang sama. Ini punya tes properti (TESTING_STRATEGY), bukan
   asumsi. Setiap temuan menunjuk `run_id` (pemilik `ruleset_version`, §16.4.4) + versi
   `reference_dictionary_versions` yang berlaku sehingga temuan lama dapat
   direproduksi setelah aturan berubah.
5. **`NOT_IMPLEMENTED` bersifat fail-closed.** Aturan yang kolom/sumbernya belum ada di skema (mis.
   `courses.sks_simulasi`, `class_sessions`, `student_activities`, `semester_results`) **tidak boleh
   dilompati secara senyap**. Engine memancangkan temuan `level='FATAL'` dengan
   `check_code='FEEDER_SOURCE_NOT_IMPLEMENTED'` `[USUL]` untuk domain yang bersangkutan, sehingga
   pengiriman domain itu tertutup sampai DDL-nya jalan. Melompati aturan yang sumbernya belum ada =
   menjanjikan angka nol pada panel kepatuhan.

#### 1.6.2 Empat tingkatan

| Level | Berlaku pada | Efek konkret | Yang boleh meloloskan | Jejak yang ditinggalkan |
|---|---|---|---|---|
| `FATAL` | PASS-INPUT dan PASS-PUSH | **Menolak kirim**: staging tidak dapat berpindah ke `VALIDATED`; job tidak dibuat; `409 FEEDER_BLOCKING_FINDINGS` | tidak ada yang boleh meloloskan — hanya perbaikan data (atau PDM untuk data induk) | temuan `BLOCK` terbuka, `sync_run` berhenti `VALIDATING` |
| `BLOCKING_CP` | terutama PASS-PUSH menjelang setoran | **Menolak penutupan checkpoint** (`academic_calendar_events` CP1/CP2 tidak boleh ditandai selesai; tab Validasi pusat akan merah) | `feeder.correction.approve` (aksi `VALIDATE`, actor berbeda dari pemohon) dengan `reason` — mencatat **penundaan**, bukan menghapus temuan | temuan `BLOCK` + baris `pddikti_reconciliation_diffs` bila penyebabnya selisih pusat |
| `WARNING` | PASS-INPUT | **Tetap dikirim** + catat temuan; tidak menahan gerbang | tidak perlu pelolosan; wajib muncul di panel Kesehatan Data dan ikut alarm §1.8.9 | temuan `WARN`, dihitung per prodi/periode/operator |
| `INFO` | PASS-INPUT | Catatan konteks (mis. nilai persis di ambang, kamus baru dipelajari) — tidak memengaruhi pipeline | — | temuan `WARN` dengan `level='INFO'` supaya tidak meniru keadaan bersih |

Proyeksi ke kolom yang **sudah ada**: `severity` lama hanya mengenal `'WARN'`/`'BLOCK'`, sehingga
`FATAL` dan `BLOCKING_CP` dipetakan ke `BLOCK`, `WARNING`/`INFO` ke `WARN` (lihat `ADD COLUMN level`
§1.5.4). Jangan menulis ulang `CHECK` lama diam-diam — itu wewenang DATA_MODEL §5.

#### 1.6.3 Katalog aturan per field (dapat dieksekusi tanpa menebak)

Kolom "Definisi" adalah spesifikasi, bukan ilustrasi: implementasinya harus dapat diuji baris demi
baris. Kolom "Kesiapan" menyebut apa adanya keadaan kode hari ini (verifikasi 2026-10-19).

| Aturan | Definisi yang dapat dieksekusi | Level | `check_code` | Sumber pembanding | Kesiapan |
|---|---|---|---|---|---|
| NIK format | `length(nik) = 16` dan `nik ~ '^[0-9]{16}$'` dan dua digit pertama = kode provinsi yang ada di kamus `WILAYAH` versi aktif dan bukan `0000000000000000` | `FATAL` | `FEEDER_NIK_LENGTH` | `reference_dictionary_entries(domain='WILAYAH')`, hasil decrypt `students.personal_nik_encrypted` dalam scope | **kolomnya belum ada**: `personal_nik_encrypted` tidak ditemukan di `packages/database/src/schema` maupun `migrations/` (hanya menjadi path redaksi di `packages/logger/src/index.ts:19`) — klaim §1.4(d) perlu diralat; tanpa kolom, aturan ini `NOT_IMPLEMENTED` |
| NIK cocok DUKCAPIL | hasil verifikasi DUKCAPIL != cocok, padahal field akan dikirim sebagai data pokok | `BLOCKING_CP` | `FEEDER_DUKCAPIL_MISMATCH` | `pddikti_correction_requests` (jalur PDM, §1.4(o)) — **koreksi, bukan sunting lokal** | `[TIDAK-TERVERIFIKASI]` kanal DUKCAPIL: tidak ada integrasinya di repo; engine hanya boleh membaca hasil verifikasi yang sudah tersimpan |
| NISN format | `nisn ~ '^[0-9]{8,10}$'`; nol depan **dipelihara** (tidak di-normalisasi jadi integer) | `FATAL` | `FEEDER_NISN_FORMAT` | field wajib Feeder §1.4(d) | `students.nisn` **sudah ada** (`classes.ts:56`); `UNIQUE (tenant_id, nisn)` belum ada (yang ada hanya `uq_students_nim`) |
| NISN unik | lokal: `UNIQUE (tenant_id, nisn)`; nasional: harus dibuktikan oleh hasil `Get*` terakhir (lihat aturan "freshness"), bukan diasumsikan | `BLOCKING_CP` | `FEEDER_DUPLICATE_STUDENT` | `pddikti_sync_runs` arah `INBOUND` + `pddikti_reconciliation_diffs` | `pddikti_mappings` + `feeder_identities` |
| Kamus fresh | umur tarikan `Get*` terakhir untuk domain yang akan dikirim `<= FEEDER_PULL_MAX_AGE_DAYS`; bila lebih tua, kesimpulan "belum terdaftar di pusat" **tidak sah** | `BLOCKING_CP` | `FEEDER_DICTIONARY_STALE` | `reference_dictionary_versions.captured_at` (§1.4(n)) | objek terdaftar `0028`, belum ada DDL berjalan |
| ID registrasi untuk studi lanjut atau pindah | bila `feeder_entry_type_code` in (2, 3, 5) atau `jenjang` lanjut: `feeder_identities(entity_type='riwayat_pendidikan').feeder_id` wajib terisi **dan** `id_pt_asal` + `id_prodi_asal` + `recognized_sks > 0` | `BLOCKING_CP` | `FEEDER_ID_REGISTRATION_MISSING` `[USUL]` + `FEEDER_ENTRY_TYPE_RULE` | `feeder_identities` (I-14), `students.*` hasil perluasan §14.5(2) | kode baru wajib masuk DATA_MODEL §14.5(5) dulu |
| ID Kurikulum PDDikti | sebelum kirim KRS: `feeder_identities(entity_type='curriculum', local_id=curricula.id).feeder_id` terisi | `BLOCKING_CP` | `FEEDER_CURRICULUM_ID_MISSING` `[USUL]` | respons `Get*` (id tidak boleh dikarang) | `curricula` ada di kode; `feeder_identities` belum |
| ID Kelas PDDikti | sebelum kirim KRS dan nilai: `feeder_identities(entity_type='class', local_id=classes.id).feeder_id` terisi (`classes.pddikti_class_id` **tidak ada** di skema) | `FATAL` untuk `grade` | `FEEDER_CLASS_ID_MISSING` `[USUL]` | §1.2 baris C; `feeder_identities` | sama |
| Kode prodi terdaftar | `study_programs.pddikti_code` tidak null dan menjadi anggota `GetProdi` versi aktif | `FATAL` | `FEEDER_PROGRAM_CODE_UNREGISTERED` | `reference_dictionary_entries(domain='PRODI')` | `pddikti_code` ada (`academic-master.ts:83`); kamus belum |
| Kode PT | hasil `GetProfilPT` cocok dengan identitas tenant yang terdaftar; tidak ada baris PT lokal yang dikarang | `FATAL` | `FEEDER_PT_CODE_UNREGISTERED` | `feeder_identities(entity_type='pt')` | belum ada |
| Kode wilayah | `id_wilayah` hasil proyeksi **anggota eksak** kamus wilayah versi aktif pada level kecamatan; pemeriksaan keanggotaan **menang** atas pemeriksaan panjang digit (panjang resmi `[TIDAK-TERVERIFIKASI]`, contoh di §1.4(d) 6 digit) | `FATAL` | `FEEDER_REGION_CODE_UNKNOWN` | `reference_dictionary_entries(domain='WILAYAH', source='KEMENDAGRI')` | `student_addresses` ada |
| Logika periode | `id_periode = <tahun acuan label> + <digit term>`; digit untuk `GANJIL`, `GENAP`, `ANTAR` (enum nyata: `GANJIL`,`GENAP`,`ANTAR`) **dibaca dari** `GetSemester` dan diuji keanggotaan, tidak pernah didefinisikan di kode; nilai turunan wajib sama dengan `feeder_identities(entity_type='periode').feeder_id` bila baris itu ada; `periode_keluar >= periode_masuk`; tidak ada irisan periode antar prodi | `FATAL` bila hasil turunan bukan anggota kamus; `WARNING` kamus tua; `BLOCKING_CP` irisan | `FEEDER_PERIOD_UNSET`, `FEEDER_PERIOD_OVERLAP` | `academic_years.label`, `academic_periods.term`, `GetSemester` | digit `ANTAR` = `[TIDAK-TERVERIFIKASI]` |
| SKS empat rincian | `sks = sks_teori + sks_praktik + sks_praktik_lapangan + sks_simulasi` (eksak, dua sisi `numeric(4,1)`), tiap komponen `>= 0`, jumlah `> 0` dan `<= 9`. **Kategori ALG-11-nya `BLOCKING`, bukan `SEMANTIC`** — lihat crosswalk §1.11.1 dan vonis §1.11.4 | `FATAL` | `FEEDER_COURSE_SKS` | DATA_MODEL §11.4 + `CHECK` nyata §16.4.3 | `sks_praktik_lapangan` dan `sks_simulasi` **belum ada** di kode → `NOT_IMPLEMENTED` |
| SKS semester (KRS) | jumlah `sks` matakuliah pada KRS `> 24` ditolak; `> plafon program` tetapi `<= 24` = peringatan | `FATAL` di atas 24; `WARNING` di atas plafon program (BR-M1 20) | `FEEDER_SEMESTER_SKS` | `enrollments` × `classes`, `academic_rules` | jalur KRS sinkron hari ini (AGENTS §3.8 pengecualian) |
| Presensi minimum sebelum nilai | `attendance_pct = jumlah(attendances.status='PRESENT' pada sesi kelas itu) / jumlah(class_sessions.status='HELD')`; penyebut `= 0` berarti **tidak ada dasar** dan penulisan nilai ditolak; `attendance_pct < ambang` (sumber ambang: `academic_rules`, nilai PRD BR-A15 = 75 persen) dan `letter_code` bukan `T` atau `E` serta tidak ada dispensasi tersetujui | `BLOCKING_CP` | `FEEDER_PRESENCE_MINIMUM` `[USUL]` | `attendances` (enum nyata `PRESENT`,`EXCUSED`,`SICK`,`ABSENT_LATE`,`ABSENT`; `UNIQUE(session_id, student_id)`), `class_sessions` | `class_sessions` **sudah ada** di `classes.ts:162-182` tetapi **tidak punya kolom `status`** → `HELD` hari ini tidak terdefinisi, dan `UNIQUE(class_id, seq)` mengunci satu percobaan per seq (BENCH-57) → `NOT_IMPLEMENTED`; konsekuensi mengikuti keputusan `P-3`: yang dihukum **mahasiswa**, bukan entri nilai dosen |
| Akreditasi tidak kedaluwarsa saat meluluskan | `study_programs.accreditation_expires_on >= yudisium_date` dan `accreditation_status` bukan kedaluwarsa; akan habis dalam `FEEDER_ACCREDITATION_WARN_DAYS` (default 60) | `FATAL` untuk `graduation`; `WARNING` untuk domain lain | `FEEDER_ACCREDITATION_EXPIRED` (BR-R7) | `study_programs.accreditation_status`, `accreditation_expires_on` (ada di kode) | kolom ada; `yudisium_batches` belum (`0027`) |
| Nomor seri ijazah atau PISN | untuk `id_jenis_keluar` lulus pendidikan lain: `no_seri_ijazah` wajib terisi; boleh kosong **hanya** untuk Profesi, SP1, SP2 dan itu menuntut `pisn_requires_sk_yudisium = true` dengan SK Yudisium + SPTJM terlampir; PISN belum kembali dan dipaksa kosong | `FATAL` untuk `graduation` | `FEEDER_GRADUATION_SERI_MISSING` `[USUL]` | §1.4(f)/(h), BENCH-110, `pddikti_correction_requests` | kolom PDM sudah didaftarkan §1.4(o) |
| IPK dan IPS | `0 < ipk <= 4.00` dan `0 < ips <= 4.00`; dilarang `ipk = 0` sementara `ips > 0` | `FATAL` | `FEEDER_IPK_RANGE` | `semester_results` | `semester_results` belum ada (`0018`) |
| Konsistensi huruf dan indeks | `letter_code` terisi maka `point_value` dan `nilai_indeks` harus serasi dengan band `grade_scale_bands` **prodi** (skala per prodi wajib dibuat lebih dulu) | `FATAL` | `FEEDER_LETTER_WITHOUT_INDEX` | `grade_scales.owner_level`, `program_id` (`RD-29`) | kolom nyata `grades.letter_code`, `point_value` (SERVER_ONLY) |
| Bobot komponen evaluasi | `sum(weight_pct)` komponen satu kelas = 100; untuk sumbangan IKU 7, bobot `case method` + `team participative` + `project` `>= 50` persen | `FATAL` untuk jumlah; `WARNING` untuk IKU | `FEEDER_COMPONENT_WEIGHT_SUM`, `FEEDER_EVALUATION_PLAN_MISSING`, `FEEDER_RPS_MISSING` | `grade_components` (AC-NIL-4) | `grade_components` ada |
| Data lahir dan jenis kelamin | tanggal lahir valid `YYYY-MM-DD`, usia pada `tgl_daftar` `>= 10` tahun; **peta nilai kelamin wajib ada**: `pddikti_mappings kind='VALUE' entity='sex_type'` memuat `M` menjadi `L` dan `F` menjadi `P` | `FATAL` | `FEEDER_BIRTH_DATA` (dan temuan kelengkapan pemetaan) | `pddikti_mappings`, §1.4(d) temuan (1) | enum `students.sex` tetap `M`/`F`; jangan diubah |
| Duplikasi nasional | kunci `(nama_mahasiswa, tempat_lahir, tanggal_lahir)` sama dengan mahasiswa lain pada hasil `Get*` pusat, atau NIK sama dengan mahasiswa ber-NIM lain | `BLOCKING_CP` | `FEEDER_DUPLICATE_STUDENT` | `GetListMahasiswa` dan `GetBiodataMahasiswa` §1.4(b) | bergantung tarikan §1.7 |

Tiga catatan kejujuran atas tabel di atas: (1) nama `check_code` yang **sudah ada** dalam register
27 kode DATA_MODEL §14.5(5) dipakai apa adanya; yang bertanda `[USUL]` (`FEEDER_SOURCE_NOT_IMPLEMENTED`,
`FEEDER_ID_REGISTRATION_MISSING`, `FEEDER_CURRICULUM_ID_MISSING`, `FEEDER_CLASS_ID_MISSING`,
`FEEDER_PRESENCE_MINIMUM`, `FEEDER_GRADUATION_SERI_MISSING`) **belum terdaftar** dan dilarang ditulis
di kode sebelum masuk register itu; (2) ambang angka yang bukan dari dokumen (60 hari peringatan
akreditasi, umur tarikan kamus) adalah **konfigurasi SICA**, bukan klaim Feeder; (3) dua pertentangan
nama yang saya temukan saat memeriksa kode dan **harus diputuskan pemilik DATA_MODEL**, bukan saya
diamkan: `students.entry_route` (nyata, `classes.ts:42`, text) versus `students.feeder_entry_type_code`
(norma §1.4(e), integer 1..5) — aturan jenis daftar di atas **tidak dapat dieksekusi** sebelum salah
satu dimenangkan; dan klaim §1.4(d)/(o) bahwa `students.personal_nik_encrypted` "sudah ada" yang
**tidak terbukti** di skema maupun migrasi hari ini.

#### 1.6.4 Keluaran mesin

Satu temuan = satu baris `pddikti_validation_findings` dengan muatan di bawah. Bentuknya **data**,
bukan string pesan, karena layar Admin dan ekspor CSV mengonsumsinya langsung:

```typescript
// packages/contracts/src/feeder-validation.ts — tidak memakai `any` (AGENTS §3.1)
export type FeederFindingLevel = 'FATAL' | 'BLOCKING_CP' | 'WARNING' | 'INFO';

export interface FeederValidationFinding {
  readonly errorCode: string;          // `check_code`, wajib anggota register DATA_MODEL §14.5(5)
  readonly level: FeederFindingLevel;
  readonly field: string;              // nama field FEEDER, mis. 'nik' — bukan nama kolom lokal
  readonly recordKey: string;          // gramatika §1.5.3
  readonly stagingRev: number;         // versi payload yang dinilai
  readonly expected: string;           // deskripsi yang dapat dibaca, mis. '16 digit numerik'
  readonly actual: string;             // nilai **ter-masked**: '320101******0001'
  readonly remedyHref: string;         // tautan internal dari allowlist tertutup, bukan URL bebas
  readonly ruleVersion: string;
  readonly dictionaryFingerprint: string;
  readonly programId: string | null;   // untuk pelaporan per prodi (§1.3 butir 4)
  readonly periodId: string | null;
}
```

Aturan bentuk keluaran: `field` selalu nama **field Feeder** (bahasa pusat), `expected`/`actual` selalu
terisi (temuan tanpa keduanya tidak dapat ditindaklanjuti prodi lain), `actual` untuk kolom ber-PII
**wajib** lewat redaksi `ISSUE_RESOLUTION` §3.1, dan `remedy_href` diambil dari allowlist rute
`/admin/**` yang terdaftar (menolak URL bebas = menutup open-redirect di layar Admin).

#### 1.6.5 Temuan muncul sebagai data, bukan sebagai toast

Norma mengikat: **masking dan gerbang adalah state data** (UI_UX_DESIGN §9.8 butir 1). Konsekuensi di
kanal Feeder:

1. **Tidak ada toast untuk temuan.** Toast adalah peristiwa sesaat; temuan harus tetap ada di layar
   ketika operator kembali besok. Yang dirender: `VelzonDataGrid` temuan dengan kolom
   `Level`, `Record`, `Field`, `Expected`, `Actual`, `Prodi`, `Periode`, `Remedy` (tautan), dan
   strip state pipeline §1.5.1 di kepala halaman.
2. **Server yang mengirim keadaan, UI tidak menyimpulkan.** Respons daftar memuat
   `canSend: boolean`, `blockingCount`, `fatalCount`, `warningCount`, dan `findings[]`. Tombol
   "Kirim" tidak dirender bila `canSend = false` — sesuai aturan API_SPEC §2.5 "kalau server tidak
   mendaftarkan transisinya, tombol tidak dirender". UI tidak pernah boleh menebak "pasti boleh".
3. **Enam keadaan wajib ada** (UI_UX §9.8 butir 2): kosong (sebab + tindakan pertama "Jalankan
   Stage"), loading (skeleton baris), error server (`409 FEEDER_BLOCKING_FINDINGS` + pesan
   `admin.errors.<CODE>` + tautan remedy), ditolak (`feeder.period.send` dipegang peran mana + scope),
   dibatasi gerbang (strip: reopen `APPROVED`/jendela/modul `ACTIVE`), offline (read-only cache,
   submit ditolak).
4. **Masking pada `actual`.** NIK, nama ibu kandung, dan tanggal lahir dirender `••••` atau topeng
   digit untuk peran tanpa hak `INSERT`/`UPDATE` atas objek itu — dengan tooltip sebab, bukan sel
   kosong dan bukan hilang dari DOM. Nominal keuangan (mis. `biaya_masuk`) tidak dibaca peran akademik
   yang tidak berhak (SoD BAAK dan BAUK).
5. **i18n.** Setiap `check_code` punya satu pasangan kunci `admin.errors.<CODE>` +
   `admin.feeder.rule.<code>.title` / `.remedy` di `id.json` dan `en.json`. Karena inventaris `admin.*`
   belum ada (`RD-19`), layar feeder **tidak boleh** ditulis sebelum kuncinya masuk `docs/I18N_KEYS.md`.
6. **Ekspor.** Satu run dapat diunduh sebagai CSV per prodi, per record, per operator — bahan
   tab Validasi dan bahan BAP reopen (§1.4(j)).

### 1.7 Rekonsiliasi lokal vs pusat

§1.3 mengatur anti-duplikasi **sebelum** kirim. Sub-bagian ini mengatur apa yang terjadi **sesudah**:
bagaimana membuktikan bahwa yang ada di sisi lokal sama dengan yang ada di pangkalan nasional, dan
siapa yang boleh mengubah apa bila ternyata tidak sama. Nama objek yang dipakai (pemenang DATA_MODEL,
§1.5.4): siklus inbound = **`pddikti_sync_runs`** + `feeder_jobs(direction='INBOUND')`, satu selisih =
**`pddikti_reconciliation_diffs`** (§16.4.6, `0031`). Istilah "rekonsiliasi" di sini **berbeda objek**
dengan rekonsiliasi dana `reconciliation_runs` (§2.4, `0015`/`0022`) — pemisahan katanya ditulis di
**§5.6** supaya tidak tertukar lagi.

#### 1.7.1 Cara menghasilkan diff (deterministik, dapat diuji)

1. **Normalisasi dua sisi ke bahasa Feeder.** Sisi lokal dihitung ulang dari baris staging
   (`canonical_payload`); sisi pusat dibaca dari respons `Get*` yang disimpan. Kedua sisi dibandingkan
   **pada nama field Feeder**, lewat proyeksi `pddikti_mappings kind='FIELD'` dan peta
   `kind='VALUE'`. Membandingkan kolom lokal dengan field pusat = membandingkan dua skema yang berbeda
   dan selalu menghasilkan diff palsu.
2. **Kunci join = `feeder_identities.feeder_id`**, bukan NIM dan bukan nama. Record yang belum punya id
   pusat tidak masuk diff; ia masuk kelas `LOCAL_ONLY` (lihat §1.7.2) **hanya bila** tarikan yang harusnya
   memuatnya sudah `COMPLETE`.
3. **Kamus dibandingkan terhadap versi, bukan terhadap ingatan.** `reference_dictionary_versions`
   (domain, version, digest, diff) adalah pihak ketiga dalam banding ini; penyimpangan kamus menghasilkan
   `FEEDER_DICTIONARY_STALE` (§1.4(n)) dan bukan temuan record.
4. **Lima kelas selisih** (`diff_kind`, allowlist tertutup): `LOCAL_ONLY` (lokal ada, pusat tidak),
   `CENTER_ONLY` (pusat ada, lokal tidak punya barisnya), `VALUE_MISMATCH` (kedua ada, satu field beda),
   `IDENTITY_CONFLICT` (dua baris lokal menunjuk satu `feeder_id`, atau satu baris lokal menunjuk dua id),
   `PERIOD_CONFLICT` (id periode/kelas lokal berbeda dari yang dikembalikan pusat).
   `IDENTITY_CONFLICT` adalah yang paling berbahaya: ia berarti **pemetaan**, bukan data, dan tidak boleh
   diselesaikan dengan menulis ulang `feeder_id` (I-14).
5. **Setiap selisih punya sidik jari run.** `(run_id, record_key, field, diff_kind)` unik; selisih yang
   sama tidak boleh lahir dua kali dalam satu run, dan selisih lama yang tidak muncul lagi ditandai
   `resolved_by_run` — bukan dihapus.

#### 1.7.2 Matriks keputusan tiga arah

| Arah keputusan | Contoh selisih | Yang boleh ditulis | Yang dilarang keras | Aktor dan gerbang |
|---|---|---|---|---|
| **lokal-dasar** (pusat diselaraskan mengikuti lokal) | `VALUE_MISMATCH` pada field yang memang milik kampus: `kode_mata_kuliah`, `sks_*`, bobot komponen, kelas, KRS, nilai | baris staging `rev` baru → `Update*` di checkpoint yang sah | `Insert*` saat Tipe 2; menulis data pokok periode lampau tanpa reopen Tipe 1; menghapus apa pun (I-15) | `feeder.period.send` + `diff` di-approve; `pddikti_sync_runs.approved_by <> operator_id` untuk PRODUCTION (§1.4(o)) |
| **pusat-dasar** (lokal diselaraskan mengikuti pusat) | `feeder_id` yang belum tercatat; `id_periode` hasil `GetSemester`; nilai kamus (agama, wilayah, pekerjaan, jenis aktivitas); `id_kelas_kuliah`; akreditasi & status prodi hasil `GetProdi`/`GetProfilPT` | `feeder_identities` (`source='BRIDGE_RESPONSE'`), `reference_dictionary_entries`, `pddikti_mappings` baris `source='SYNC'` + `verified_at` | mengarang id; menimpa `pddikti_mappings` baris `SYNC` dengan `MANUAL`; menyimpulkan "record belum terdaftar" dari tarikan `PARTIAL` | pekerja sistem kanal (`channelActorId` terdaftar, §1.9.3) + persetujuan `VALIDATE` manusia untuk setiap perubahan peta bernorma |
| **harus-PDM** (dua-duanya dilarang) | `IDENTITY_CONFLICT` pada identitas: nama, tanggal/tempat lahir, **nama ibu kandung**, NIK, NIM yang sudah aktif, status mahasiswa periode lampau | hanya `pddikti_correction_requests` (enam kolom inti + SPTJM + lampiran, §1.4(o)) dan jejak di `pddikti_reconciliation_diffs` | sunting lokal lalu `Update*` "biar cepat"; `DELETEBiodataMahasiswa`; menyetujui diff sendiri | `feeder.correction.request` (pemohon) lalu `feeder.correction.approve` (penyetuju, actor berbeda — I-5) |

#### 1.7.3 Penanganan `Get*` parsial (di sinilah rekonsiliasi biasanya bohong)

Feeder mengembalikan halaman, bukan himpunan lengkap. Aturan yang membuat diff masih dapat dipercaya:

1. **Loop halaman wajib selesai sebelum kesimpulan apa pun.** Worker meminta `limit = FEEDER_PAGE_LIMIT`
   dengan `offset` bertahap; `resume_offset` hanya maju setelah halaman terkonfirmasi; run berakhir
   `PARTIAL` bila halaman terakhir tidak tercapai (indikator: `data` berjumlah `limit` tetapi halaman
   berikutnya kosong adalah **sah**, sedangkan `error_code != 0` di tengah halaman adalah `PARTIAL`).
2. **`PARTIAL` menurunkan status semua turunannya.** Selisih `LOCAL_ONLY` **tidak boleh** disimpulkan
   dari run `PARTIAL`: ia menjadi `UNKNOWN` dan menahan penutupan checkpoint. Alasan bisnisnya nyata:
   `LOCAL_ONLY` yang salah adalah perintah `Insert*` → mahasiswa ganda di pangkalan nasional, dan
   itu tidak dapat ditarik kembali (§1.3 butir 2, BENCH-13).
3. **Kesimpulan punya masa kedaluwarsa.** Diff yang berumur lebih tua dari
   `FEEDER_PULL_MAX_AGE_DAYS` (konfigurasi SICA, awal 14) tidak boleh dipakai sebagai dasar `Insert*`;
   mesin §1.6 menegakkan ini sebagai `FEEDER_DICTIONARY_STALE` pada level `BLOCKING_CP`.
4. **Atribusi halaman per record.** Untuk tarikan, satu `feeder_jobs` mewakili satu halaman
   (`direction='INBOUND'`, `resume_offset`/`resume_limit` dipakai di sini); untuk pengiriman, satu
   `feeder_jobs` mewakili **satu `record_key`** (unit idempoten). Dua penggunaan kolom yang sama, dua
   semantik, dibedakan tegas oleh `direction` — ini alasan `resume_offset` tidak boleh ditafsirkan
   sendirian.

#### 1.7.4 Perbedaan tidak pernah selesai sendiri

Norma yang mengikat dan wajib punya tes: **tidak satu pun jalur rekonsiliasi yang menulis tabel
operasional secara otomatis.** Diff hanya dapat menghasilkan (a) baris `pddikti_reconciliation_diffs`
menunggu disposisi manusia, (b) pengisian `feeder_identities`/kamus dari respons bridge (pusat-dasar,
bukan data kampus), atau (c) temuan. Perpindahan `disposition` adalah aksi `VALIDATE` dengan `reason`;
`system:reconciliation` tidak diberi hak `UPDATE` pada `students`, `grades`, `courses`. Perbandingan
dengan §2.4 keuangan: di sana rekonsiliasi boleh menutup (`SETTLED`) karena sumber kebenarannya uang
vendor; di sini sumber kebenarannya **regulator**, sehingga yang menutup adalah manusia ber-wewenang
dengan berkas.

### 1.8 Async Retry Worker + exponential backoff untuk RTO

#### 1.8.0 Status: target, bukan kenyataan

`bullmq` dan `ioredis` **belum menjadi dependensi** (`TECH_CONVENTIONS.md` §6, gap `RD-11`;
dipasang hanya bersama keputusan `P-6`). Karena itu spesifikasi ini ditulis **di atas `feeder_jobs`
sebagai keadaan yang tahan**, bukan di atas Redis: antrean yang sesungguhnya adalah baris DB
(`feeder_jobs.status` — kolom nyata `0028` — dan `next_retry_at`, yang masih **permintaan kolom**
§1.5.4); Redis hanya akselerator. Konsekuensi yang harus
dipahami arsitek: **bila Redis mati, tidak ada job yang hilang** — worker tinggal membaca
`feeder_jobs` dengan `next_retry_at <= now()`. Bentuk `Queue`/`Worker` di bawah adalah *facade* agar
pemindahan ke BullMQ bersifat mekanis, bukan redesign.

#### 1.8.1 Kurva backoff (angka kanonik kanal Feeder)

```
percobaan total (attempts)   : 5            # arti BullMQ: jumlah eksekusi termasuk yang pertama
base delay                   : 5000 ms
factor                       : 2
cap                          : 80000 ms
jitter                       : PENUH (full jitter)
delay(attempt n)             : min(cap, base * 2^(n-1))        # n = 1..4 antar-percobaan
sleep_actual                 : uniform(0, delay(n))
```

| Percobaan ke- | Jeda sebelum percobaan berikutnya | Kumulatif jeda | Yang terjadi sesudah kegagalan ini |
|---|---|---|---|
| 1 | 5 s | 5 s | retry kelas transport (§1.8.4) |
| 2 | 10 s | 15 s | retry |
| 3 | 20 s | 35 s | retry |
| 4 | 40 s | 75 s | retry — ini percobaan terakhir dalam anggaran |
| 5 | tidak ada (anggaran habis) | 75 s | `status='DEAD'` + DLQ §1.8.8 |

`cap` 80 s adalah langit-langit kurva: ia menjadi jeda kelima hanya bila `FEEDER_RETRY_MAX_ATTEMPTS`
dinaikkan ke 6 (kumulatif 155 s), sehingga tidak ada satu pun percobaan yang berjeda lebih dari 80 s
apa pun nilai `attempts` yang dipilih suatu tenant.

Kurva ini **satu keluarga** dengan §3.1 messaging (`attempts: 5`, `exponential`, `delay: 5000`).
Dua hal yang saya catat jujur dan tidak saya ubah di dokumen lain: (1) komentar §3.1 menuliskan lima
jeda (`5s, 10s, 20s, 40s, 80s`) padahal `attempts: 5` dengan semantik BullMQ hanya menghasilkan **empat**
jeda — off-by-one yang harus diputuskan pemilik §3.1 (naikkan `attempts` ke 6 atau buang `80s` dari
komentar); (2) karena itu `cap` hari ini berfungsi sebagai pelindung, bukan sebagai langkah kurva.
RTO kanal: kegagalan transport berhenti diam-diam
paling lambat 75 s + waktu eksekusi setelah kegagalan pertama; alarm §1.8.9 memakai ambang usia menit,
jadi kurva ini **bukan** penentu SLA — ia hanya penentu kapan manusia dilibatkan.

```typescript
// Target shape (BullMQ). Hari ini: fungsi murni yang menghitung next_retry_at untuk feeder_jobs.
export const feederRetryOptions = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

export function fullJitterDelayMs(attempt: number): number {
  const ceiling = Math.min(80_000, 5_000 * 2 ** (attempt - 1));
  return Math.floor(Math.random() * (ceiling + 1)); // full jitter: 0..ceiling
}
```

#### 1.8.2 Timeout transport per aksi (per kelas, bukan global)

| Kelas aksi | `connect` | `read` | Deadline job | Catatan |
|---|---|---|---|---|
| `GetToken` | 5 000 ms | 15 000 ms | 30 000 ms | kegagalan di sini = `BRIDGE_OFFLINE`, bukan `FAILED_TOKEN` |
| `Get*` baca dan halaman (tarikan) | 5 000 ms | 30 000 ms | 300 000 ms per halaman | retry aman tanpa konfirmasi (idempoten murni) |
| `Insert*` dan `Update*` (mutasi) | 5 000 ms | 60 000 ms | 900 000 ms | **wajib** confirm-before-retry (§1.8.3) |
| `GetDictionary` | 5 000 ms | 30 000 ms | 300 000 ms | sumber kamus; kegagalan → `FEEDER_DICTIONARY_STALE`, bukan data |
| Aksi `Delete*` pada jalur Feeder | — | — | — | **tidak ada** (I-15): tidak ada timeout untuk panggilan yang tidak boleh terjadi |

Variabel: `FEEDER_CONNECT_TIMEOUT_MS`, `FEEDER_READ_TIMEOUT_MS_GET`, `FEEDER_READ_TIMEOUT_MS_WRITE`,
`FEEDER_TOKEN_TIMEOUT_MS`, `FEEDER_JOB_DEADLINE_MS` — semuanya target `ENV_CONTRACT` (hari ini tidak
se satu pun `FEEDER_*` terdaftar di sana).

#### 1.8.3 Resume dan konfirmasi-before-retry

1. `resume_offset` **hanya maju setelah baris record terkonfirmasi** (sudah dinormakan §1.4(l));
   worker yang crash di tengah halaman akan mengulang halaman itu, bukan memajukan cursor.
2. **Mutasi yang timeout bukan kegagalan yang boleh diulang buta.** `-1` pada `Insert*` berarti
   kemungkinan pusat **sudah** menerima dan kita tidak tahu. Prosedur wajib sebelum retry mutasi:
   tarik identitas record lewat `Get*` dengan filter kunci (`nik`/`nim`/`id_prodi`), lalu putuskan:
   sudah ada di pusat → job ditandai `ACCEPTED` + `feeder_identities` diisi dari respons (bukan dari
   perkiraan) dan `transport_class='CONFIRMED_AFTER_TIMEOUT'`; belum ada → retry normal;
   tarikan gagal atau `PARTIAL` → **jangan retry**, turunkan ke `DEAD` dengan `dead_reason='UNCONFIRMED'`.
   Ini satu-satunya mekanisme yang membuktikan tidak adanya duplikat lintas migrasi.
3. **Aturan atribusi ACK.** Job berpindah ke `ACCEPTED` hanya bila `error_code = 0` **dan** `data`
   dapat dipetakan ke `record_key` job itu. Bila satu panggilan HTTP memuat banyak record dan respons
   tidak dapat diatribusi per record, **seluruh** record tetap `SENT` dan menunggu konfirmasi `Get*` —
   sukses kolektif dilarang.
4. Batch yang sudah `ACCEPTED` tidak pernah dikirim ulang, tidak dalam keadaan apa pun, termasuk
   replay DLQ (§1.8.8).

#### 1.8.4 Pemisahan tegas: transport vs validasi

| Aspek | Kegagalan **transport** (`-1`, HTTP non-200, TLS, `BRIDGE_OFFLINE`) | Kegagalan **validasi** (`error_code != 0` kelas data) |
|---|---|---|
| Kelas pada job | `transport_class IN ('TRANSPORT','BRIDGE','PARSE')` | `transport_class='VALIDATION'` |
| Di-retry otomatis | ya, sampai `attempts` habis | **tidak pernah** — retry data yang sama hanya mengulang penolakan |
| Efek ke pipeline | job tetap antre; status tidak berubah menjadi temuan data | `state` view dihitung ulang menjadi `REJECTED`; record keluar dari batch |
| Efek ke checkpoint | `sync_run` `PARTIAL`, checkpoint tertahan sementara | checkpoint tertahan **sampai manusia memperbaiki**; run `PARTIAL`, bukan `SENT` (§1.4(l)) |
| Ditulis sebagai temuan §1.6 | **DILARANG.** Transport bukan keadaan data; mencatatnya sebagai `FEEDER_*` akan membanjiri panel Kesehatan Data dengan sampah yang akan hilang sendiri | ya, `pddikti_validation_findings` dengan `check_code` dari `error_msg` (§1.4(p)) |
| Penghitung circuit breaker | ya | **tidak** (data buruk bukan kesehatan jaringan) |
| Tujuan akhir setelah habis | `status='DEAD'` + DLQ + alarm | antrean perbaikan manusia (`feeder.correction.request` atau pemilik data) |

`-2` (parse) diperlakukan terminal per §1.4(l): tidak di-retry, breaker langsung `OPEN`, arsip
`raw_response` ter-redaksi wajib ada.

#### 1.8.5 Renegosiasi token satu-flight (anti thundering herd)

1. Pemicu: `error_code = 100` pada satu job. **Satu** renegosiasi per `(tenant_id, bridge_id,
   environment)` pada satu saat. Hari ini gemboknya `pg_advisory_xact_lock(hashtextextended(key, 0))`
   karena Redis belum ada; sesudah `ioredis` nyata, `SET NX PX` dengan TTL `FEEDER_TOKEN_TTL_SECONDS`
   menjadi implementasi yang sama.
2. Job lain yang ikut kena `100` **tidak** memanggil `GetToken`: mereka menunggu gembok paling lama
   `FEEDER_TOKEN_WAIT_TIMEOUT_MS = 15000`, lalu dikirim kembali ke antrean **tanpa memakan `attempt`**
   (menunggu gembok bukan kegagalan). Ini mencegah banjir permintaan OTP ke nomor kampus (§1.4(m)).
3. Setelah renegosiasi selesai, hanya permintaan yang memicu yang diulang **satu kali** (§1.4(l));
   percobaan ke-2 tetap `100` → `FAILED_TOKEN`, notifikasi operator, breaker tidak dihitung (ini
   kredensial, bukan jaringan).
4. Mode `AUTH_OTP_REQUIRED` menghentikan seluruh pengiriman environment itu sampai manusia masuk
   (SM-7, §1.4(m) butir 4). Retry otomatis dilarang di sini.

#### 1.8.6 Circuit breaker per bridge

State **terkini** disimpan di `feeder_bridges` (`breaker_state`/`open_until`/`consecutive_transport_failures`
masih **permintaan kolom** — §1.5.4 daftar (2)); riwayat transisi (`feeder_breaker_events`) **belum punya
objek sama sekali**. Perilaku breaker yang jadi target akhir adalah milik
[ARCHITECTURE §10.4.1](file:///c:/SICA/docs/ARCHITECTURE.md), bukan keputusan bagian ini. Kunci breaker =
**`(bridge_id, environment)`** sehingga sandbox yang mati **tidak pernah** menutup produksi, dan
sebaliknya (BENCH-135).

| Parameter | Nilai awal (konfigurasi SICA, bukan angka vendor) | Aturan |
|---|---|---|
| `FEEDER_CB_WINDOW_S` | 600 | jendela hitung kegagalan transport beruntun |
| `FEEDER_CB_THRESHOLD` | 5 | dalam jendela itu, 5 kegagalan transport **atau** `BRIDGE_OFFLINE` membuka breaker |
| `FEEDER_CB_OPEN_S` | 120 untuk `PRODUCTION`, 30 untuk `LOCAL`/`SANDBOX` | lama state `OPEN`; job **menunggu**, tidak dihitung gagal, tidak dianggap terkirim |
| `FEEDER_CB_HALFOPEN_PROBES` | 1 | probe hanya aksi baca murah (`GetSemester`); **tidak pernah** probe mutasi |
| `FEEDER_CB_MAX_OPEN_S` | 1800 | pendinginan tumbuh dua kali tiap gagal-probe, dibatasi 30 menit |
| Transisi `OPEN` ke `HALF_OPEN` | otomatis saat `open_until` lewat | satu percobaan; sukses → `CLOSED` + counter nol; gagal → `OPEN` lagi |
| Pemicu `OPEN` seketika | `-2` parse, kredensial lingkungan salah (`403 FEEDER_ENVIRONMENT_MISMATCH`) | butuh manusia; tidak ada transisi otomatis keluar `OPEN` untuk dua kasus ini |

Setiap transisi **wajib** menulis riwayat breaker + `audit_logs` (§1.9); tanpa objek
`feeder_breaker_events` (permintaan §1.5.4) hanya state terkini yang dapat dibaca, sehingga "berapa lama
produksi butek" hari ini **tidak dapat dijawab** — itu status, bukan gaya bahasa. Alarm: `OPEN` di
`PRODUCTION` lebih dari 10 menit = Severity 2 (`ISSUE_RESOLUTION` §4 menuntut RCA).

#### 1.8.7 Rate limit kementerian dan batching `limit`/`offset`

- **Batas laju resmi Feeder tidak diketahui** (§1.10). Karena itu `FEEDER_RATE_RPS` = **2** permintaan
  per detik per `(bridge, environment)` dengan burst 5 adalah **pilihan konservatif SICA** dan wajib
  dikonfirmasi per instalasi — bukan klaim kementerian.
- Token bucket: Redis bila tersedia; **sementara** tanpa Redis, `feeder_rate_slots` (`bridge_id`,
  `window_start`, `granted`, `cap`) menahan jalur panas. Worker mengambil slot **sebelum** menyentuh
  jaringan, dan melepas slot saat request selesai; kegagalan mengambil slot = tunggu, bukan `attempt++`.
- **Halaman baca:** `limit = FEEDER_PAGE_LIMIT` (awal 100), `offset` maju sebesar `limit`; berhenti
  ketika halaman pulang dengan jumlah `< limit` **atau** `data` kosong; penjaga `FEEDER_MAX_PAGES_PER_RUN`
  (awal 200) menghentikan loop liar dan menandai run `PARTIAL`.
- **Halaman tulis:** mutasi dikirim **satu record per permintaan** untuk domain yang menghasilkan id
  (biodata, riwayat pendidikan, nilai, kelulusan) supaya atribusi ACK §1.8.3 mungkin; aksi tanpa id
  dan tanpa efek samping berantai boleh digabung sampai 50 record dengan `record` array, dan setiap
  anggota batch tetap punya baris `feeder_jobs` sendiri.
- `429`/`Retry-After` dari bridge: diperlakukan sebagai transport retryable, menghormati header bila
  ada; **tidak pernah** ditulis sebagai temuan data.

#### 1.8.8 DLQ dan replay yang idempoten

1. `status='DEAD'` + `dead_reason` + `dead_at` + `last_error_code` = DLQ. Tidak ada tabel mati terpisah:
   himpunan `DEAD` pada `feeder_jobs` **adalah** DLQ, dan itu tetap dapat di-`SELECT` prodi per prodi.
2. **Replay = job baru yang menunjuk job lama** (`replay_of`), bukan perubahan baris mati. Prosedur:
   operator memilih himpunan (`environment`, `bridge_id`, `dead_reason`, jendela waktu) → sistem
   menghitung ulang staging (bila data induk berubah, `rev` baru dan digest baru) → validasi ulang
   §1.6 → `idempotency_key` dihitung ulang → job baru di-`QUEUED`. Karena digest ikut menghitung key,
   replay atas payload yang **tidak** berubah menghasilkan key yang sama dengan lama → ditolak
   (`409 IDEMPOTENCY_CONFLICT` `[USUL]`: harus didaftarkan API_SPEC lebih dulu) dan operator diminta
   memperbaiki data, bukan mengirim ulang. Ini penutup "replay yang tidak sengaja menggandakan".
3. Replay **menolak** record yang sudah `ACCEPTED` (§1.8.3 butir 4) dan menolak `Delete*` (I-15).
4. Replay atas `dead_reason='UNCONFIRMED'` wajib lewat prosedur §1.8.3 butir 2 lebih dulu.
5. Setiap replay adalah `pddikti_sync_runs` baru dengan `dry_run` sendiri; replay ke `PRODUCTION`
   tetap butuh orang kedua (§1.4(o)).

#### 1.8.9 Alarm dan SLI kanal Feeder

| Sinyal | Ambang awal | Kelas | Aksi otomatis |
|---|---|---|---|
| Usia job `QUEUED` tertua | 30 menit peringatan; 120 menit eskalasi | Severity 3 lalu 2 | tidak ada; manusia dipanggil |
| Rasio `error_code != 0` | lebih dari 5 persen dalam jendela 15 menit | Severity 2 | tahan push berikutnya, breaker tidak ikut buka |
| Jumlah temuan `WARNING` | ambang per prodi-periode (`FEEDER_WARNING_ALARM_COUNT`, awal 100) | Severity 3 | masuk panel Kesehatan Data + ekspor CSV |
| `BLOCKING_CP` terbuka saat H-14 checkpoint | tanggal dari `academic_calendar_events` (BR-R9) | Severity 2 | notifikasi `FEEDER_OPERATOR` + kaprodi |
| Breaker `OPEN` di `PRODUCTION` | lebih dari 10 menit | Severity 2 | RCA wajib (ISSUE_RESOLUTION §4) |
| DLQ bertambah | satu baris `DEAD` pun di `PRODUCTION` | Severity 2 | daftar replay tersedia, tidak auto-replay |
| Umur tarikan `Get*` | lebih dari `FEEDER_PULL_MAX_AGE_DAYS` (awal 14) | Severity 3 | `FEEDER_DICTIONARY_STALE` `BLOCKING_CP` (§1.7.3) |
| `sync_runs` `PARTIAL` menganggur | lebih dari 24 jam | Severity 3 | penutupan checkpoint tetap tertahan |

### 1.9 Bukti dan audit: bagaimana run menjawab auditor

#### 1.9.1 Isi bundel bukti per run

Setiap `pddikti_sync_runs` menyimpan (langsung atau lewat tautan `feeder_jobs` dan arsip):

| Bukti | Di mana | Kenapa harus ada |
|---|---|---|
| Siapa memicu (membership, peran ber-scope, MFA) | `pddikti_sync_runs.operator_id` + `audit_logs` | "operator" bukan nama tampilan; yang dibaca auditor adalah identitas pada tanggal itu |
| Persetujuan orang kedua (PRODUCTION) | `approved_by`, `approved_at`, `CHECK approved_by <> operator_id` | BR-R11, BENCH-134 |
| `feeder_jobs` yang dihasilkan | `feeder_jobs.run_id`, per `record_key` + `idempotency_key` | membuktikan himpunan yang dikirim, bukan yang direncanakan |
| Digest payload | `pddikti_staging_<domain>.payload_digest` (§16.4.3) | byte-level, tanpa menyimpan PII di kolom laporan |
| Payload yang benar-benar keluar | `pddikti_payload_snapshots.http_request` + `request_digest` | jawaban "isinya apa"; guard `CHECK` menjamin token tidak ikut |
| Respons mentah | `pddikti_payload_snapshots.response_code` / `response_msg` / `response_body` (dipangkas) | jawaban "diterima atau tidak"; redaksi mengikuti `ISSUE_RESOLUTION` §3.1 |
| Versi kamus & versi aturan | `pddikti_sync_runs.ruleset_version` + `pddikti_staging_*.packer_version` + versi `reference_dictionary_versions` yang berlaku pada run | membuktikan payload dihitung dari kamus yang benar, bukan kamus hari ini. **Catatan jujur:** kolom `dictionary_fingerprint`/`rule_version` yang dipakai versi lama dokumen ini **tidak ada** — pemetaannya di §1.5.4 daftar (2) |
| Lingkungan & bridge | `pddikti_sync_runs.environment`, `bridge_id`, `feeder_credentials` (baris ber-`operator_membership_id`) | memisahkan sandbox dari produksi (BENCH-135) dan menyebut penanggung jawab nomor OTP |
| Dasar reopen atau PDM | `period_reopen_requests.llidikti_decision_ref`, `bap_number`, `pddikti_correction_requests.sptjm_number` + `attachment_ids` | berkas LLDIKTI dicetak dari sistem, bukan dari log |
| Temuan & disposisi | `pddikti_validation_findings`, `pddikti_reconciliation_diffs.decided_by`/`validated_by` | "siapa yang memutuskan ini boleh lewat" |
| Rantai jejak | `audit_logs` (append-only, hash-chained, DATA_MODEL §4) + `audit_chain_head` + `evidence_bundle_digest` run | membuktikan tidak ada baris yang disisipkan belakangan |

**Dua nama objek jejak audit yang saya rujuk, bukan saya putuskan:** `audit_logs` dan
`system_audit_trails`. Yang pertama punya DDL tertulis (DATA_MODEL §4, partisi bulanan, `REVOKE
UPDATE/DELETE`, hash-chained; `SECURITY_COMPLIANCE` § memisahkannya dari *application logs* dan
*security events*). Yang kedua **tidak ditemukan di repositori ini dalam bentuk apa pun** (grep 2026-10-19:
nol hasil) — jadi ia saya sebut sebagai nama yang dirujuk dan menjadi beban pemilik DATA_MODEL §14.7 dan
SECURITY § untuk mendaftarkan atau melepaskannya. Sampai itu terjadi, bukti kanal Feeder bersandar pada
`audit_logs` + `pddikti_payload_snapshots`, dan **tidak ada kode yang boleh menulis
`system_audit_trails`** (menulis tabel yang tidak ada = error runtime di jalur audit, tempat paling buruk
untuk mengetesnya).

#### 1.9.2 Menjawab tiga pertanyaan auditor

```sql
-- (1) "Data ini dikirim kapan?"  — satu baris per PERCOBAAN, bukan per record.
SELECT s.attempt, s.created_at AS pushed_at, s.http_status, s.response_code, s.response_msg,
       s.acknowledged_at, j.status AS job_status, j.last_error_code,
       r.environment, r.operator_id, r.approved_by
FROM   pddikti_payload_snapshots s
JOIN   pddikti_sync_runs r ON r.id = s.run_id
LEFT   JOIN feeder_jobs j ON j.id = s.job_id           -- FK job dipasang di 0031 bagian B
WHERE  s.tenant_id = current_setting('app.current_tenant')::uuid
  AND  s.domain = 'MAHASISWA' AND s.record_key = 'MAHASISWA:9f1c…:core'
ORDER  BY s.attempt;
-- Catatan: `sent_at`/`request_bytes`/`response_bytes`/`sha256_both`/`redaction_applied` yang dipakai
-- versi lama dokumen ini TIDAK ADA. Yang ada: `http_request` + `request_digest` + `response_*`
-- (DATA_MODEL §16.4.5). Redaksi bukan kolom: packer wajib menulis `http_request` tanpa token, dan
-- PII hanya masuk ke kolom `*_encrypted` tabel staging, tidak pernah ke snapshot.

-- (2) "Isinya apa?"  — payload kanonik yang dinilai + byte yang benar-benar keluar.
SELECT t.record_key, t.packer_version, t.payload_digest, t.source_updated_at,
       s.attempt, s.request_digest, s.feeder_id_returned
FROM   pddikti_staging_mahasiswa t
LEFT   JOIN pddikti_payload_snapshots s
        ON s.tenant_id = t.tenant_id AND s.run_id = t.run_id
       AND s.domain = 'MAHASISWA' AND s.record_key = t.record_key
WHERE  t.tenant_id = current_setting('app.current_tenant')::uuid
  AND  t.record_key = 'MAHASISWA:9f1c…:core'
ORDER  BY s.attempt;
-- Tidak ada `t.rev`: versi dibedakan oleh `run_id` (§1.5.2 butir 3). Isi `canonical_payload` dibaca
-- lewat tabel staging domain terkait, dan untuk NILAI lewat `canonical_payload_encrypted` (§16.4.3).

-- (3) "Siapa yang menyetujui?"
SELECT r.operator_id AS pemohon, r.approved_by AS penyetuju, r.approved_at,
       y.sk_number, y.sk_date, y.approved_by AS penyetuju_yudisium,
       lg.actor_user_id, lg.actor_role_ctx, lg.action, lg.target_entity, lg.target_id, lg.reason
FROM   pddikti_sync_runs r
LEFT   JOIN yudisium_batches y ON y.period_id = r.period_id AND y.tenant_id = r.tenant_id
LEFT   JOIN audit_logs lg ON lg.tenant_id = r.tenant_id
        AND lg.target_entity = 'pddikti_sync_runs' AND lg.target_id = r.id
WHERE  r.id = $1;
```

Tiga jawaban di atas tidak boleh membutuhkan log aplikasi. Kalau sebuah fakta hanya ada di stdout,
bukti itu belum ada.

#### 1.9.3 Pelaku kanal dan GUC (dua hal yang paling sering salah di worker)

1. **Worker tidak punya konteks HTTP.** `SET LOCAL app.current_tenant` **wajib** dijalankan di dalam
   setiap transaksi worker, diambil dari kolom `tenant_id` job, bukan dari middleware:

```sql
BEGIN;
SET LOCAL app.current_tenant = '<feeder_jobs.tenant_id>';   -- GUC RLS; NOBYPASSRLS tetap berlaku
SELECT pg_advisory_xact_lock(hashtextextended('feeder:' || $job_id::text, 0));
-- ... baca staging, tulis ACK, isi feeder_identities, tulis audit_logs ...
COMMIT;
```

2. **Aksi kanal memakai `channelActorId` yang terdaftar**, bukan `null` dan bukan `ctx.actorId` klien
   (pola yang sama dengan §2.3 catatan 2 dan API_SPEC §4.7.5 untuk webhook pembayaran). Untuk kanal Feeder
   nilai yang sah adalah identitas sistem per tindakan — `system:feeder-push`, `system:feeder-pull`,
   `system:reconciliation` — atau `feeder_credentials.operator_membership_id` bila aksinya milik orang.
   Konsekuensi yang harus dijaga: setiap pelepasan cekal/clearance lewat kanal Feeder menulis
   `lifted_by = channelActorId` yang **berbeda** dari `imposed_by`, sehingga
   `CHECK (lifted_by <> imposed_by)` tetap bermakna dan jejak "siapa melepas apa" tidak runtuh menjadi
   satu akun serba-bisa.
3. **Satu transaksi untuk satu ACK.** Perpindahan `feeder_jobs.status`, isi `feeder_identities` (I-14),
   baris `audit_logs`, dan snapshot `pddikti_payload_snapshots` terjadi dalam satu transaksi; sebagian
   berhasil = tidak ada yang berhasil (NFR-U1, pola §2.4).

### 1.10 Status kejujuran (apa yang belum ada dan apa yang tidak kita ketahui)

#### 1.10.1 Belum ada di kode — terverifikasi 2026-10-19, **7 baris terakhir diukur ulang 2026-10-20**

| Klaim spesifikasi | Kenyataan kode | Konsekuensi |
|---|---|---|
| Rute `/admin/feeder/**` (`validate`, `push`, `corrections`, `runs/:id`, `stage`, `reconciliation/:id/decide`) | **nol rute**; direktori `admin/` pun belum ada di `apps/web/src/app` (yang ada hanya `(auth)`, `(dashboard)`, `api/v1/{academic,attendance,auth,health,tenant}`) | seluruh §1.5–§1.9 adalah spesifikasi; tidak ada satu pun yang dapat diklik hari ini |
| Jembatan Feeder: `feeder_bridges`, `feeder_jobs`, `feeder_identities`, `feeder_credentials`, `feeder_environments`, `otp_events`, `reference_dictionary_*` | terdaftar di DATA_MODEL §14.7 → `0028_feeder_bridge.sql`, tetapi **migrations hanya berisi `0001`–`0006` dan `0011`** → `0028` belum pernah dieksekusi | tidak ada objek untuk ditulis; jangan menulis layarnya sebelum §14 DATA_MODEL-nya jalan (aturan "dokumen dulu, kode kemudian") |
| `pddikti_mappings`, `pddikti_sync_runs`, `pddikti_validation_findings`, `pddikti_correction_requests`, `period_reopen_requests` | **tidak ada** di `packages/database/src/schema` (grep `pddikti_mappings` = 0) | kolom yang saya rujuk di §1.5–§1.9 adalah kontrak, bukan skema |
| Antrean dan worker | `bullmq` **dan** `ioredis` tidak ada di `package.json` mana pun (grep = 0) | §1.8 memakai `feeder_jobs` sebagai antrean tahan; pemindahan ke BullMQ adalah pekerjaan `R-2`/`R-6` bersama `P-6` |
| Sumber perhitungan aturan | `courses.sks_praktik_lapangan`, `courses.sks_simulasi`, `class_sessions.status` (tabelnya ada, **kolom status/HELD tidak ada**), `student_activities`, `semester_results`, `yudisium_batches`, `graduation_records`, `recognized_sks`, `feeder_entry_type_code` **belum ada** | engine §1.6 menandai domain-domain itu `FEEDER_SOURCE_NOT_IMPLEMENTED` dan **menolak kirim** (fail-closed), bukan melewatinya |
| `students.registration_date`, `entry_cost_rupiah`, `funding_source_code`, `receives_kps`, `kps_number`, `personal_nik_encrypted` | **tidak ada satu pun** di `students` (`packages/database/src/schema/classes.ts:26-67`); yang paling mirip hanyalah `funding_source` (ejaan lain) dan `students.feeder_status_code` | baris A §1.2 dan aturan NIK/pendanaan §1.6 **tidak dapat dikodekan** hari ini; tambahan: `students.nisn` dan `students.pddikti_id_pd` **sudah ada**, jadi jangan meminta kolom baru untuk keduanya |
| `FEEDER_*` environment variables | **diralat 2026-10-20:** `ENV_CONTRACT.md` baris 245 **sudah mendaftarkan 9** variabel (`FEEDER_CONNECT_TIMEOUT_MS`, `FEEDER_READ_TIMEOUT_MS`, `FEEDER_RETRY_BASE_MS`, `FEEDER_RETRY_FACTOR`, `FEEDER_RETRY_MAX_ATTEMPTS`, `FEEDER_BREAKER_THRESHOLD`, `FEEDER_BREAKER_OPEN_SECONDS`, `FEEDER_RATE_RPS`, `FEEDER_RATE_BURST`) dengan status **"tidak ada di `env.ts`"**; catatan lama "nol di ENV_CONTRACT (grep = 0)" sudah tidak benar. `FEEDER_TOKEN_TTL_SECONDS` yang dituntut §1.1 **masih belum terdaftar** | daftar target sudah ada di kontrak environment; yang belum ada hanyalah pembacanya di runtime |
| Izin kanal | `feeder.mapping.*`, `feeder.validate.run`, `feeder.sync.run/view`, `feeder.period.send`, `feeder.correction.request/approve`, `feeder.credential.manage` **sudah ada** di `packages/contracts/src/authz.ts` (dan teruji di `authz-catalog.test.ts`) | ini bagian yang benar-benar siap: gerbang izin tidak perlu dikarang ulang |
| **Feeder Bridge** (satu-satunya proses yang menyentuh pusat) | `grep -rniE "feeder_bridge\|FeederBridge" apps/web/src packages` = **0 hasil** (diukur 2026-10-20) | §1.11 dan §1.12 adalah mesin **sisi lokal**; tanpa bridge tidak pernah ada `feeder_id_returned`, jadi tidak ada akhir pipeline (I-14). Bridge belum terpasang = seluruh kanal berhenti di `QUEUED` |
| Migrasi `0031_pddikti_staging.sql` (tujuh `pddikti_staging_*` + `pddikti_payload_snapshots`) | DDL-nya **ditulis** di DATA_MODEL §16.4.3/§16.4.5, berkasinya **belum ada**: `packages/database/migrations` hanya berisi `0001`–`0006` dan `0011` (terukur 7 berkas) | `feeder_autofix_suggestions.staging_id` tidak punya tabel tujuan; aturan §1.11 tidak dapat dieksekusi |
| Migrasi `0040_feeder_autofix.sql` (`feeder_autofix_rules`, `feeder_autofix_suggestions`, `feeder_identity_matches`, `feeder_sync_watermarks`) | **belum dieksekusi** (daftar migrasi di atas), dan dependensinya `0028` + `0031` juga belum; tipe enum `feeder_autofix_kind` **tidak ada** di `packages/database/src/schema` | dua `CHECK` yang menjadi penegak utama §1.11 (`fix_expr` hanya `FORMAT`/`ENRICH`; tanpa kolom `feeder_id` di `feeder_identity_matches`) hari ini **belum ada yang menegakkan** — baru norma dokumen |
| Migrasi `0044_institution_sites.sql`, `0045_final_project_kinds.sql`, `0046_tuition_tariff_matrix.sql` | **0 baris** di `migrations/` dan 0 `pgTable` padanan di `packages/database/src/schema` (DATA_MODEL §19.6 mencatat semuanya "spec") | seluruh §1.14 adalah dampak yang **belum dapat dikirim**; jangan menjanjikan "sinkron multi-kampus" |
| Kamus digit pemeriksaan **NISN** | `grep -icE "nisn" docs/SEED_DATA.md` = **0**; `SEED_DATA.md` tidak punya bagian kamus referensi sama sekali (bagian 1–7 adalah akun dev + master data) | aturan `SEM-NISN-CHK` **wajib** `NOT_IMPLEMENTED` dan menolak kirim sampai baris kamusnya di-*seed*; rumus tidak boleh ditulis dari ingatan agen (§1.11.4) |
| Kamus **gelar** untuk pemotongan nama | `reference_kinds` (§14.2) hanya mendaftarkan **17** kosakata `kind` dan **tidak satu pun** bernama `gelar`; kolom nyata hanya `title_prefix`/`title_suffix` (DATA_MODEL baris 1613) | `FMT-TITLE` tidak punya allowlist → fail-closed sebagai `REVIEW`, bukan auto-strip (§1.11.3 langkah 8) |
| Kosakata modus & kolom Feeder-nya (`classes.learning_modality`, `class_sessions.session_kind`, `feeder_sifat_pembelajaran`) | **tidak ada satu pun** di `packages/database/src/schema` (terukur 2026-10-20): yang ada hanyalah `classes.delivery_mode` (`ONSITE \| ONLINE_SYNC \| ONLINE_ASYNC`, `classes.ts:89`), `classes.virtual_meeting_provider` (`ZOOM \| GOOGLE_MEET \| TEAMS \| BUILTIN_LMS`), `class_sessions.delivery_type` (`classes.ts:173`) dan `class_sessions.virtual_room_url` — semuanya **alias yang dilepas** DATA_MODEL §21.4; `0049_system_parameters.sql` belum dieksekusi (`migrations/` = 7 berkas) | §1.16 tidak punya sumber kolom; pemetaan `F`/`O`/`M` tidak dapat dihitung; dan **§5 (kehadiran daring) tidak punya dasar perhitungan rasio** — keduanya fail-closed, tidak dikirim/vonis ditahan |
| Nama objek §1.5.4 (`feeder_staging_records`, `feeder_payload_archives`, `feeder_validation_runs`, `feeder_reconciliation_runs`/`_items`, `feeder_breaker_events`, `feeder_rate_slots`) | **DIRALAT 2026-10-20 (`RD-44` ditutup di level dokumen).** Lima nama pertama diganti ke pemenang DATA_MODEL (tujuh `pddikti_staging_*`, `pddikti_payload_snapshots`, view `pddikti_validation_runs` + `pddikti_sync_runs`, `pddikti_reconciliation_diffs`) — crosswalk + daftar permintaan kolom ada di §1.5.4. Dua nama terakhir (`feeder_breaker_events`, `feeder_rate_slots`) **tetap tidak punya rumah** dan sekarang berstatus permintaan terang, bukan DDL | §1.5–§1.9 tidak lagi mengarang tabel; yang tersisa hanyalah nomor & DDL yang memang bukan wewenang dokumen ini |

#### 1.10.2 `[TIDAK-TERVERIFIKASI]` dari sisi vendor — ditolak ditulis sebagai fakta

| Klaim yang beredar | Status | Yang dokumen ini tulis sebagai gantinya |
|---|---|---|
| Masa berlaku token 60 menit | `[TIDAK-TERVERIFIKASI]` (sudah diralat §1.1, `BENCH-138`) | deteksi `100` lalu renegosiasi; TTL = konfigurasi per instalasi |
| Batas laju permintaan Feeder (rps per akun/PT) | **tidak dikenal**; tidak ada angka resmi yang dapat kita tunjuk | `FEEDER_RATE_RPS = 2` + burst 5 sebagai **pilihan konservatif SICA**, wajib dikonfirmasi |
| SLA RTO Feeder / jendela ketersediaan bridge | tidak ada dokumen vendor yang kita punya | tidak menormakan SLA; alarm memakai usia job & rasio error (§1.8.9) |
| Ukuran batch maksimum yang diterima `record` array | tidak terverifikasi | 1 record untuk mutasi ber-id, maksimal 50 untuk aksi lain, sebagai **kebijakan SICA** |
| Ukuran halaman `limit` yang diizinkan | tidak terverifikasi | `FEEDER_PAGE_LIMIT = 100` (kebiasaan integrator, `[PIHAK-KETIGA]`), boleh diubah |
| Daftar aksi lengkap (mis. `InsertMataKuliah`, `UpdatePerkuliahanMahasiswa`) | `[PIHAK-KETIGA]` dari repo integrator (§1.2 catatan A, `BENCH-137`) | nama aksi yang belum dibuktikan di sandbox tidak boleh dipakai kode; dua aksi (RPS dan nilai komponen penuh) **wajib** diverifikasi lebih dulu |
| Nomor `error_code` selain `0`, `100`, `-1`, `-2` | tidak terverifikasi | himpunan yang lama saja dipakai untuk keputusan otomatis; sisanya diklasifikasi dari `error_msg` dan disimpan apa adanya |
| Digit kode periode untuk `ANTARA`/ANTAR | tidak terverifikasi | keanggotaan diuji ke `GetSemester`; **tidak ada pemetaan digit yang di-hardcode** |
| Panjang kanonik `id_wilayah`, `id_prodi`, `id_pt` | tidak terverifikasi (contoh §1.4(d) hanya menunjukkan satu bentuk) | pemeriksaan **keanggotaan kamus**, bukan regex panjang |
| Tenggat checkpoint 30 April / 30 Oktober | `[PIHAK-KETIGA]` praktik LLDIKTI (sudah dicatat §1.4(h)/(i)) | `academic_calendar_events` wajib diisi per tenant, bukan angka global |
| Perilaku PISN (kapan nomor seri kembali) | tidak terverifikasi | nomor seri hanya boleh dianggap ada bila **dibuktikan** oleh respons `Get*` atau berkas yang diarsipkan; aturan §1.6 menolak domain `graduation` tanpa bukti itu |
| Ketersediaan kanal DUKCAPIL untuk verifikasi NIK | tidak ada integrasinya di repo | engine hanya membaca **hasil** verifikasi yang sudah tersimpan; tidak pernah mengklaim cek langsung |

#### 1.10.3 Aturan fail-closed yang menahan godaan

1. **Jangan mengarang angka vendor.** Setiap konstanta di §1.8 adalah konfigurasi SICA dengan nama
   `FEEDER_*` dan **harus** melewati konfirmasi sandbox per instalasi sebelum dinaikkan menjadi
   "kebijakan". Angka yang belum dikonfirmasi tidak boleh dikutip di dokumen lain sebagai kemampuan
   Feeder.
2. **Sandbox tidak dapat diverifikasi dari repo ini.** Tidak ada kredensial, tidak ada bridge, tidak
   ada catatan pengujian `sandbox2.php`. Karena itu **daftar verifikasi sandbox** adalah hasil yang
   masih ditunggu: `GetToken` hidup; senarai aksi nyata; versi kamus per domain; perilaku `100`,
   `-1`, `-2`; ukuran `limit` yang ditoleransi; apakah respons dapat diatribusi per record; bentuk
   `error_msg` untuk penolakan validasi.
3. **Fail-closed lebih baik daripada optimis.** Domain yang sumber datanya belum punya DDL tidak
   dikirim; run `PARTIAL` tidak menutup checkpoint; `LOCAL_ONLY` tanpa tarikan `COMPLETE` tidak
   menjadi `Insert*`; mutasi tanpa konfirmasi tidak di-retry; `100` ke-2 berhenti, tidak berputar.
4. **Urutan pengerjaan yang jujur:** DDL `0028` + perluasan §1.5.4 (nomor dari DATA_MODEL §14.7)
   → `FEEDER_VALIDATION_RULES` + `feeder_validation_runs` → staging writer per domain → worker
   transport (masih DB-backed) → BullMQ hanya bersama `P-6` → baru layar `/admin/feeder/**` setelah
   kunci `admin.errors.*` masuk inventaris (UI_UX §9.8 butir 3) dan rute terdaftar di API_SPEC §4.6.6.

#### 1.10.4 Register status gugus §1.11–§1.14 dan §1.16–§1.17 (diukur 2026-10-20)

Bagian ini ada **di dalam** §1.10 dengan sengaja: gugus §1.11–§1.14 punya nomor bagian sendiri
(karena ARCHITECTURE §12.2.5 dan DATA_MODEL §18.10 sudah menunjuk "INTEGRATIONS §1.11/§1.12"),
tetapi status kejujurannya tetap satu register dengan sisanya.

| Gugus | Yang dispesifikasi di sini | DDL di dokumen | Migrasi berjalan | Kode | Boleh diklik pengguna? |
|---|---|---|---|---|---|
| §1.11 auto-fix lokal (ALG-11) | 5 kategori + katalog `rule_code` per domain + pipeline normalisasi + ambang kemiripan | ✅ DATA_MODEL §18.5 | ❌ `0040` belum ada di `migrations/` | ❌ nol Berkas | 📋 spec |
| §1.12 Delta Sync | himpunan berubah, digest,SKIP, urutan induk-anak, airmen | ✅ §18.5 `feeder_sync_watermarks` | ❌ `0040` + `0031` + `0028` belum jalan | ❌ nol | 📋 spec |
| §1.13 aturan keselamatan | 9 norma mengikat + locus penegakannya | ✅ CHECK/trigger di §18.5 dan §16.4 | ❌ belum dieksekusi | ❌ belum ada CI §18.9(7) yang berjalan | 📋 spec |
| §1.14 entitas baru → payload | `campus_sites`, jenis program, TA non-skripsi, tarif | ✅ DATA_MODEL §19.1–§19.4 | ❌ `0044`/`0045`/`0046` belum ada | ❌ nol | 📋 spec — dan **sebagian tidak akan pernah terkirim** sampai kamus pusat punya bentuk (§1.14) |
| §1.16–§1.17 modus pembelajaran → payload | jalur nilai `feeder_sifat_pembelajaran` (`F`/`O`/`M`), perlakuan `BLENDED`, penahan `modPkk`/`idPembelajaran`, delta baris §1.4(i) | ✅ kosakata & kolom milik DATA_MODEL §21.4 (`0049`); peta nilainya `pddikti_mappings kind='VALUE'` (§1.2) | ❌ `0049` belum dieksekusi; **kamus `F/O/M` belum di-*seed*** (`reference_dictionary_entries` untuk domain ini 0 baris terukur) | ❌ nol — tidak ada `ENR-MODALITAS`/`BLK-KAMUS-MODUS` di kode | 📋 spec dengan **penahan aktif**: selama kamus kosong, kolom `NULL` dan barisnya **tidak ikut kirim** (I-14, `[VERIFIKASI-KAMUS]`) — bukan "dikirim dengan kode asal" |
| Dependensi antrean | `feeder.push` sebagai kanal §1.12 | ✅ ARCHITECTURE §10.4.1 | tidak berlaku | ❌ `bullmq`/`ioredis` **design-only** (`RD-11`, `P-6`) | 📋 target — §1.12 memakai `feeder_jobs` sebagai antrean tahan (§1.8.0) |

Satu kalimat yang harus dibaca sebelum kutipan mana pun dari §1.11–§1.14: **tidak ada satu pun objek
di gugus ini yang punya migrasi berjalan.** Angka ambang, urutan pipeline, dan hak bertindak di bawah
adalah kontrak yang menunggu `0028` → `0031` → `0040` → `0044` → `0045` → `0046` dieksekusi
(MIGRATION_SOP, expand-only), bukan kemampuan yang tersedia hari ini.

### 1.11 Mesin pra-validasi & auto-fix lokal (ALG-11) — nama dan isi aturan per domain

**Kepemilikan rujukan.** Gugus ini **tidak** mendefinisikan ulang hal yang sudah punya pemilik; ia
hanya mengisi kolom yang memang menjadi jatahnya ("nama & isi aturan Feeder per domain",
DATA_MODEL §18.10):

| Yang dibutuhkan pembaca | Pemiliknya | Peran §1.11 |
|---|---|---|
| Algoritma engine pra-validasi & auto-fix (RETE, kompleksitas, penempatan, mode turun) | [ARCHITECTURE §12.6](file:///c:/SICA/docs/ARCHITECTURE.md) (ALG-11) | konsumen; **tidak** menulis ulang arsitekturnya |
| Mekanika delta sync & airmen | [ARCHITECTURE §12.10](file:///c:/SICA/docs/ARCHITECTURE.md) | isi §1.12 adalah penjabaran yang dapat dieksekusi, bukan norma baru |
| Retry, backoff, limiter, DLQ kanal Feeder | [ARCHITECTURE §10.4.1](file:///c:/SICA/docs/ARCHITECTURE.md) (`feeder.push`: concurrency 4, limiter 20 req/1000 ms, `attempts` 4, backoff eksponensial 5.000 ms + jitter, ceiling 5 menit) | **cross-reference saja** (§1.12.6); angka itu tidak diputuskan di sini dan tidak boleh dikutip seolah keputusan baru |
| Nama objek & nomor migrasi auto-fix | [DATA_MODEL §18.5](file:///c:/SICA/docs/DATA_MODEL.md) → `0040_feeder_autofix.sql`: `feeder_autofix_rules`, `feeder_autofix_suggestions`, `feeder_identity_matches`, `feeder_sync_watermarks`, enum `feeder_autofix_kind` | pemakai nama; **tidak** membuat tabel atau kolom tandingan |
| Nama objek entitas baru | [DATA_MODEL §19](file:///c:/SICA/docs/DATA_MODEL.md): `campus_sites` (`0044`), `final_project_kinds` (`0045`), `fee_tariff_groups` + `tuition_tariff_matrix` (`0046`) | pemakai nama; lihat §1.14 |
| Kode error HTTP yang dikirim ke klien | [API_SPEC §2.3](file:///c:/SICA/docs/API_SPEC.md) (baris 6, 12, 25, 31, 32, 33, 35, 42, 55, 56, 73, 74, 75) | **tidak ada kode baru** di bagian ini; semua penolakan menunjuk baris register |
| `check_code` temuan | register 27 kode di DATA_MODEL §14.5(5) + `[USUL]` §1.6.3 | pemakai; kode baru **wajib** masuk register itu lebih dulu |
| Izin & peran atas layar dan aksi | [RBAC_MATRIX §4.5 baris 76–86](file:///c:/SICA/docs/RBAC_MATRIX.md) (`feeder.autofixrule.view/insert/update/approve`, `feeder.autofix.view/apply/revert`, `feeder.identity.view/confirm`, `feeder.watermark.view/force`) | pemakai; **tidak** membuat string izin baru (AGENTS §3.8) |
| Gramatika `record_key`, `payload_digest`, `idempotency_key` | §1.5.3 di file ini | pemakai apa adanya |

**Yang membuat bagian ini ada.** §1.6 mengatur *temuan* (apa yang salah) dan menolak kirim. Yang belum
pernah tertulis di dokumen mana pun adalah *perbaikan*: siapa yang boleh membetulkan apa, dengan hak
bertindak sebesar apa, dan berapa keyakinan yang dibutuhkan sebelum mesin menyentuh satu karakter.
Auto-fix yang salah lebih berbahaya daripada penolakan: penolakan terlihat, perbaikan diam-diam
mengubah apa yang diterima negara.

#### 1.11.1 Lima kategori aturan dan hak bertindak masing-masing

Enum `feeder_autofix_kind` (DATA_MODEL §18.5) adalah **satu-satunya** kosakata kategori. Kategori
bukan label gaya bahasa: ia menentukan kolom yang boleh terisi.

| `kind` | Hak bertindak mesin | Yang **dilarang** keras | Siapa yang menerapkan | Penegak di skema |
|---|---|---|---|---|
| `FORMAT` | **perbaiki otomatis** pada kolom baris staging milik tenant ini: rapikan spasi, `UPPER` nama, tanggal ke ISO, telepon ke E.164, buang karakter kontrol, buang gelar dari allowlist, kanalisasi homoglyph di kolom angka | menulis ke tabel sumber (`students`, `courses`, `grades`, `enrollments`); mengubah nilai yang tidak terdaftar di `applies_to` | worker, lalu tercatat di `feeder_autofix_suggestions` dengan `verdict='AUTO'` | `CHECK (kind IN ('FORMAT','ENRICH') AND fix_expr IS NOT NULL)`; `verdict='AUTO'` menuntut `applied_by` + `applied_at` |
| `ENRICH` | **isi otomatis dari data lokal** yang sudah sah: `id_prodi` dari `study_programs.pddikti_code`, kode wilayah dari `reference_items`, empat rincian SKS dari `courses`, `id_periode` dari `academic_years.label` + `term`, `id` pusat dari `feeder_identities` hasil bridge | menebak nilai yang sumbernya tidak ada di DB; mengisi `feeder_id` dari kemiripan | worker, sama seperti `FORMAT` | `fix_expr` wajib ada; sumber nilai harus kolom/FK yang **terdaftar** (lihat §1.11.7 butir 4) |
| `IDENTITY` | **usulkan pasangan** lokal ↔ baris pusat hasil `Get*`; tampilkan skor, `margin` dan `blocked_by` | **tidak pernah menulis `feeder_id`** — apa pun skornya (I-14) | manusia: `feeder.identity.confirm` (verba `VALIDATE`, `ADMIN_ACADEMIC`) mengonfirmasi pasangan; `feeder_id` tetap hanya masuk dari `pddikti_payload_snapshots.feeder_id_returned` | `feeder_identity_matches` **tidak punya kolom `feeder_id`** — bentuk skema itulah penegakannya |
| `SEMANTIC` | **hanya usulkan**: tandai temuan, jelaskan sebab, tautkan remedy | `applied_at` tidak boleh pernah terisi; tidak boleh "memperbaiki" makna | manusia lewat jalur data induk (koreksi PDM §1.4(o) atau aksi pemilik objek), bukan lewat auto-fix | `CHECK` menolak `fix_expr` pada `SEMANTIC`; CI §18.9(7) mencari baris `SEMANTIC`/`BLOCKING` ber-`applied_at` dan wajib 0 hasil |
| `BLOCKING` | **tolak kirim**: staging tidak dapat naik ke `VALIDATED`; job tidak dibuat | menurunkan diri menjadi peringatan; dilompati karena "kebiasaan kampus" | tidak ada yang menerapkan — hanya perbaikan data atau `feeder.correction.approve` (actor berbeda) yang melepasnya | penolakan = `409 FEEDER_BLOCKING_FINDINGS` (API_SPEC §2.3 baris 32); temuan `severity='BLOCK'` terbuka |

Tiga aturan yang membuat tabel di atas berarti:
1. **Hak bertindak menempel pada kategori, bukan pada nama aturan.** Aturan bernama `FORMAT` apa pun
   tidak dapat "sekalian" memperbaiki makna, karena kolom `fix_expr` untuk `SEMANTIC`/`BLOCKING`
   **NULL secaraCONSTRAINT** — mesin tidak punya bahan untuk menulis.
2. **Tidak ada `AUTO` tanpa tiga bukti.** `metric` + `score` + `margin` (AGENTS §3.9: "tidak ada field
   `AUTO` tanpa `candidate_ref` + ambang keyakinan + margin"). Skor mentah saja tidak pernah cukup.
3. **`REJECT` ada di enum `verdict`** (§18.5) khusus untuk usulan yang ditolak manusia — supaya
   penolakan tercatat sebagai keputusan, bukan sebagai usulan yang hilang.

**Crosswalk dua kosakata yang dipakai di file ini (satu aturan, dua sumbu — jangan dicampur).**
§1.6.2 menamai **level temuan** (`FATAL · BLOCKING_CP · WARNING · INFO`, kolom `level` hasil permintaan
§1.5.4); bagian ini menamai **kategori aturan** (`FORMAT · ENRICH · IDENTITY · SEMANTIC · BLOCKING`,
enum nyata `feeder_autofix_kind`, DATA_MODEL §18.5). Keduanya tidak saling menggantikan: kategori
menentukan **hak bertindak mesin**, level menentukan **apa yang ditahan pipeline**. Pemetaannya:

| Kategori aturan (`feeder_autofix_kind`) | Level temuan yang lahir (§1.6.2) | Ditambah oleh |
|---|---|---|
| `FORMAT`, `ENRICH` | tidak melahirkan temuan bila hasil akhirnya sah; lahir `WARNING` bila normalisasi menghasilkan `REVIEW` | `feeder_autofix_suggestions` (baris usulan/perbaikan) |
| `IDENTITY` | `WARNING` (pasangan belum dikonfirmasi) | `feeder_identity_matches` |
| `SEMANTIC` | `WARNING` atau `BLOCKING_CP` — **tidak pernah** `FATAL`, karena `SEMANTIC` tidak menahan state bila penyebabnya hanya interpretasi | `pddikti_validation_findings` |
| `BLOCKING` | `FATAL` (menolak kirim) atau `BLOCKING_CP` (menolak penutupan checkpoint) | `pddikti_validation_findings` |

**Satu keputusan yang dulu menggantung, sekarang ditutup:** pelanggaran SKS per jenis (`= 0` atau `> 9`)
adalah `BLOCKING` — bukan `SEMANTIC`. Alasannya struktural, bukan selera: `pddikti_staging_kurikulum`
sudah punya `CHECK (sks_total BETWEEN 1 AND 9)` + `CHECK (sks_total = Σ empat rincian)` (DATA_MODEL
§16.4.3), sehingga baris yang melanggarnya **tidak dapat ditulis** sebagai staging yang sah; menyebutnya
"_semantic, hanya usulan_" mengundang mesin mengirim baris yang pasti ditolak pusat. ARCHITECTURE §12.6
masih menuliskannya sebagai contoh `SEMANTIC` — itu **utang ralat di dokumen pemilik algoritma**, dan
baris §1.11.4 di bawah sudah memakai verdict `BLOCKING` agar tidak ada dua vonis untuk satu aturan.
Kembali ke norma yang mengikat mesin: auto-fix hanya `FORMAT`/`ENRICH` yang boleh menulis otomatis,
`feeder_id` hanya dari respons bridge, dan setiap kirim butuh dua orang (§1.13 butir 2-3).

#### 1.11.2 Matriks aturan yang menyala per domain kirim

Domain = enum `pddikti_domain` (DATA_MODEL §16.4.1), **tujuh nilai, kardinalitas tetap**. Tabel staging
milik tiap domain adalah `pddikti_staging_<domain>` (§16.4.3). Ejaan lama `feeder_staging_records` dari
§1.5.4 **sudah diralat** ke nama-nama itu pada 2026-10-20 (`RD-44`; crosswalk & permintaan kolom:
§1.5.4, status register: §1.10.1 baris terakhir).

| Domain | Tabel staging | `FORMAT` | `ENRICH` | `IDENTITY` | `SEMANTIC` | `BLOCKING` |
|---|---|---|---|---|---|---|
| MAHASISWA | `pddikti_staging_mahasiswa` | FMT-WS, FMT-UPPER, FMT-TITLE, FMT-DATE, FMT-PHONE, FMT-HOMO, FMT-CTRL, FMT-SEXL, FMT-KEEP0 | ENR-PRODI, ENR-PERIOD, ENR-WILAYAH, ENR-REGID, ENR-PROGTYPE, ENR-FUNDING | IDN-MHS, IDN-RIWAYAT | SEM-NISN-CHK, SEM-USIA, SEM-ENTRY-RULE, SEM-DUP-NAME, SEM-COST-RANGE | BLK-NIK-16, BLK-REGION, BLK-PRODI-REG, BLK-PT-REG, BLK-REGID, BLK-EMAIL |
| KURIKULUM | `pddikti_staging_kurikulum` | FMT-WS, FMT-UPPER, FMT-CTRL, FMT-NUM | ENR-CKIND, ENR-CGROUP, ENR-CURRICID | IDN-MK | SEM-SEMESTER-OFFERED | BLK-SKS-TOTAL, BLK-SKS-JENIS-ZERO, BLK-SKS-JENIS-CAP, BLK-CURRICID-SENT |
| KELAS | `pddikti_staging_kelas` | FMT-WS, FMT-UPPER, FMT-NUM | ENR-LECTLIST, ENR-ACTKIND, ENR-CLASSID, ENR-MODALITAS | IDN-KELAS | SEM-MEET-18, SEM-PARTICIPANT | BLK-CLASSID, BLK-SKS-KELAS, BLK-WEIGHT-100, BLK-EVALPLAN, BLK-RPS, BLK-NOLDOS, BLK-KAMUS-MODUS |
| KRS_AKM | `pddikti_staging_krs_akm` | FMT-WS, FMT-NUM, FMT-DATE | ENR-PERIOD, ENR-AKMSTATUS, ENR-REGSKS | (tidak ada — `record_key` sudah kunci lokal) | SEM-PARITY, SEM-ACTIVE-NOSKS, SEM-STATUS-DICT | BLK-PERIOD-UNSET, BLK-KRSID-SENT, BLK-PAST-AKM, BLK-SKS-24 |
| NILAI | `pddikti_staging_nilai` | FMT-NUM, FMT-DATE | ENR-GRADESCALE, ENR-CLASSID | (tidak ada) | SEM-LETTER-POINT, SEM-GPA-RANGE, SEM-PRESENCE-MIN | BLK-GRADE-NOTEFFECTIVE, BLK-CLASSID, BLK-LETTER-NOIDX |
| AKTIVITAS | `pddikti_staging_aktivitas` | FMT-WS, FMT-UPPER, FMT-DATE, FMT-CTRL | ENR-ACTKIND, ENR-CREDIT | IDN-ACT | SEM-DATE-ORDER, SEM-CREDIT-CAP, SEM-EVIDENCE | BLK-ACTKIND-DICT, BLK-MBKM-CAP |
| KELUAR | `pddikti_staging_keluar` | FMT-WS, FMT-NUM, FMT-DATE | ENR-EXITKIND, ENR-PERIOD, ENR-SERI | IDN-YUDISIUM | SEM-YUDISIUM-SK, SEM-ACCRED-DATE, SEM-THESIS-KIND | BLK-EXIT-REGID, BLK-SERI-IJAZAH, BLK-GATE-FINANCE, BLK-IPK-RANGE |

**Tiga perubahan matriks yang harus terbaca sebagai keputusan, bukan kosmetika (2026-10-20):**

1. **SKS pindah kategori.** `SEM-SKS-ZERO`, `SEM-SKS-CAP`, `SEM-SKS-KELAS`, `SEM-SKS-24` kini menjadi
   `BLK-SKS-JENIS-ZERO`, `BLK-SKS-JENIS-CAP`, `BLK-SKS-KELAS`, `BLK-SKS-24`. Alasan: `CHECK` nyata di
   `pddikti_staging_kurikulum`/`_krs_akm` (DATA_MODEL §16.4.3: `sks_total BETWEEN 1 AND 9`,
   `registered_sks BETWEEN 0 AND 24`) membuat barisnya tidak mungkin sah, jadi hak bertindak
   `SEMANTIC` ("hanya usulkan") adalah label yang menyesatkan — lihat vonis §1.11.1 dan §1.11.4.
2. **Gugus modus pembelajaran mendapat aturan baru** (§1.16): `ENR-MODALITAS` (ENRICH — mengisi
   `feeder_sifat_pembelajaran` **hanya** dari baris `pddikti_mappings kind='VALUE'` yang sumbernya
   `source='SYNC'`; kosong = field tidak dikirim) dan `BLK-KAMUS-MODUS` (BLOCKING — domain KELAS/KRS_AKM
   ditolak kirim selama kamus `F`/`O`/`M` belum di-*seed*, `[VERIFIKASI-KAMUS]`). Keduanya **belum punya
   `check_code` terdaftar** dan memakai `FEEDER_DICTIONARY_STALE` / `FEEDER_SOURCE_NOT_IMPLEMENTED`
   `[USUL]` sampai register DATA_MODEL §14.5(5) menyetujui kode baru.
3. **`SEM-PRESENCE-MIN` (NILAI) tidak berubah** dan tetap hanya **mengusulkan**: ia menahan **ambang
   kehadiran internal**, bukan objek Feeder — presensi tidak pernah dikirim sebagai record (§1.4(c)
   butir 2), dan dasarnya kini termasuk bukti daring §5 (`attendance_evidence`), bukan hanya `QR`.

**Baris yang sengaja TIDAK masuk matriks (kejujuran, bukan kelalaian):**

| Area yang diminta | Kenapa tidak ada domainnya | Yang berlaku |
|---|---|---|
| **Dosen / PTK** | `pddikti_domain` hanya tujuh nilai dan **tidak mengenal dosen**; DATA_MODEL §14.5 aturan 4 melarang keras: "Data dosen tidak pernah ditulis ke feeder (dikelola pusat/SISTER). Tidak ada `kirimDosen` di mana pun." **Status objek sumbernya hari ini:** `lecturers` **sudah punya DDL** (DATA_MODEL §11.3 "Master Dosen & Tendik", menutup `G-04`/`G-05`) dan punya kolom `nidn` di kode (`packages/database/src/schema/people.ts`) — catatan lama "`G-04` dosen tidak punya tabel" **tidak lagi menjadi temuan** dan tidak perlu dibuka ulang di setiap dokumen | `IDN-DOSEN-NIDN` saja: pencocokan `lecturers.nidn` terhadap `feeder_identities(entity_type='dosen')` yang **sudah ditarik**, dengan temuan pembanding `FEEDER_LECTURER_NIDN_INVALID` (register §14.5(5)) sebagai usulan. NIDN **tidak pernah** masuk `canonical_payload` sebagai data yang kita tulis ke pusat; yang menulis dosen adalah `lecturer_list jsonb` pada KELAS (BENCH-62), dan itu di-`ENRICH` dari `class_assignments`, bukan dari tebakan |
| **Keuangan / UKT** | Tidak ada objek tagihan di Feeder (DATA_MODEL §14.5 aturan 5); yang naik hanyalah **biaya masuk** (`entry_cost_rupiah`), **pembiayaan** (`funding_code`), **KPS**, dan komponen biaya pada KELUAR | `ENR-FUNDING` + `SEM-COST-RANGE` di MAHASISWA; tarif per §1.14.4 **tidak ikut kirim** bila `fee_tariff_groups.feeder_cost_kind IS NULL` |
| **Presensi & ruang** | §14.5 aturan 5: tidak ada objek presensi/ruang di Feeder | hanya menjadi **dasar** aturan `SEM-PRESENCE-MIN` di NILAI, tidak pernah dikirim sebagai record |

#### 1.11.3 Pipeline normalisasi (berurutan, idempoten, berversi)

Urutan adalah norma, bukan saran. Langkah 5 sesudah langkah 1-2 dan sebelum langkah 6, karena
kanalisasi homoglyph hanya aman pada token yang sudah di-*casefold* dan hanya pada kolom angka;
langkah 8 paling akhir, karena pemotongan gelar harus membaca aliran token yang sudah utuh.

```
0  gerbang   aturan dijalankan pada salinan staging (kolom typed + canonical_payload), TIDAK PERNAH
             pada baris sumber. Setiap langkah menyimpan (rule_code, column, before, after)
             sebagai feeder_autofix_suggestions sebelum byte hasil ditulis.
1  NFKC      normalisasi bentuk Unicode: fullwidth menjadi ASCII, ligatur diurai, bentuk kompatibel
             menjadi kanonik. Tanpa langkah ini, teks fullwidth (mis. rentetan U+FF2D U+FF21 U+FF28
             U+FF21 U+FF33 U+FF29 U+FF33 U+FF37 U+FF21, yaitu "MAHASISWA" dalam bentuk fullwidth) dari
             hasil OCR tidak pernah
             cocok dengan "MAHASISWA" dan seluruh pipeline kemiripan bohong.
2  casefold  untuk keperluan **banding saja**. Nilai resmi yang dikirim tetap apa adanya: casefold
             tidak pernah menjadi after_value pada kolom nama.
3  tanda baca buang titik, koma, tanda hubung non-struktural di ujung token; JANGAN membuang tanda
             baca di dalam kode (dash pada kode wilayah adalah bagian kode).
4  spasi     collapse run spasi/nbsp/tab menjadi satu, lalu trim kedua ujung.
5  homoglyph kanalisasi O→0, I→1, l→1, S→5, B→8, Z→2, g→9 HANYA pada kolom bertipe angka:
             nik, nisn, postal_code, sks_*, registered_sks, cumulative_gpa, participant_count,
             kode numerik kamus. Pada kolom teks langkah ini **dilarang** — "OSCAR" bukan "05CAR".
             Aturan dipilih dari daftar kolom numerik milik tiap tabel staging (§16.4.3), bukan dari
             regex "terlihat angka", karena "123" sebagai nama ruang adalah teks.
6  tanggal   parse multi-format (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD, DD MM YYYY) lalu
             tulis **ISO `YYYY-MM-DD`** dengan validasi kalender nyata (31-02 ditolak, bukan
             digulir). Tidak ada asumsi abad dua-digit; `19/07/08` **wajib** menjadi temuan REVIEW,
             bukan tanggal 2008-07-19 yang disimpulkan.
7  telepon   E.164: buang karakter non-digit,_normalkan 0 → +62, hormati kode negara eksplisit,
             hasil 10-15 digit. **Konsekuensi yang harus dibaca:** hasilnya tidak pernah menjadi key
             `no_hp`/`telepon` di `canonical_payload` — trigger app.reject_pii_in_payload (§16.4.2)
             menolak key itu. Nilai E.164 masuk ke kolom terenkripsi (phone_encrypted) dan payload
             hanya membawa digest-nya.
8  gelar     potong token gelar **hanya bila** token hasil langkah 1-4 persis sama dengan entri
             kamus gelar allowlist (cocok eksak, bukan substring, bukan "mirip"). Allowlist **belum
             ada** (reference_kinds §14.2 tidak memiliki kind gelar — terukur), jadi hari ini aturannya
             berstatus NOT_IMPLEMENTED dan menghasilkan REVIEW: memotong nama dengan pola "kata setelah
             koma" adalah cara tercepat menghapus sebagian identitas orang.
9  akhir     cek ulang: setelah normalisasi, jalankan kembali kelas SEMANTIC/BLOCKING terhadap hasil.
             Normalisasi tidak boleh membuat baris yang tadinya ditolak menjadi lolos tanpa sebab
             (guard ini yang membedakan auto-fix dari "auto-lolos").
```

Empat invariance pipeline: **(i) idempoten** — langkah yang dijalankan dua kali menghasilkan byte yang
sama, dan kunci UNIQUE `feeder_autofix_suggestions` `(run_id, staging_table, staging_id, column_name,
rule_id)` membuat run ulang tidak menggandakan perbaikan; **(ii) reversibel** — `before_value` selalu
terisi, `reverted_at` melepas efeknya dengan menulis **baris staging baru pada run baru** (§1.5.2 butir 3
— bukan `rev`, kolom itu tidak ada); **(iii) berversi** — `feeder_autofix_rules.version` yang aktif pada
run + `ruleset_version` pada `pddikti_sync_runs` (§16.4.4) adalah versi katalog yang menghasilkan byte
itu, sehingga
payload lama tetap dapat direproduksi setelah aturan berubah; **(iv) tidak menyentuh PII plaintext di
payload** — kolom yang terlarang di `canonical_payload` hanya boleh berubah di kolom terenkripsinya.

#### 1.11.4 Pemeriksaan identitas (yang bisa dibuktikan, dan yang tidak)

| Objek | Pemeriksaan yang **sah** | Batas jujur | `kind` |
|---|---|---|---|
| **NIK** | `^[0-9]{16}$` (panjang + pola), **bukan** `0000000000000000`, 6 digit awal = kode wilayah yang **anggota** kamus Kemendagri versi aktif (`reference_items(kind='wilayah')`, hierarki 5 level §14.2) | **NIK tidak punya checksum.** Yang bisa diuji hanyalah panjang, pola, dan keberadaan kode wilayah. Klaim "NIK tervalidasi" harus selalu diucapkan sebagai "NIK berbentuk sah dan wilayahnya dikenal", bukan "NIK benar". Kecocokan dengan DUKCAPIL adalah **temuan terpisah** (`FEEDER_DUKCAPIL_MISMATCH`) yang hanya boleh dibaca dari hasil verifikasi yang sudah tersimpan — kanal DUKCAPIL tidak ada di repo ini (§1.10.2) | panjang/pola + keanggotaan wilayah = `BLOCKING` (setara `FATAL` §1.6.3); kecocokan DUKCAPIL yang belum terbukti = `SEMANTIC`, tidak pernah auto-fix |
| **NISN** | 10 digit numerik, nol depan **dipelihara**, **digit pemeriksaan** dihitung dari **baris kamus berversi** | `[VERIFIKASI-KAMUS]` — rumus **wajib** berasal dari kamus yang di-*seed* lewat SEED_DATA dan diberi versi (`reference_dictionary_versions`), **tidak boleh** ditulis dari ingatan agen. Diukur 2026-10-20: `SEED_DATA.md` **tidak memuat** apa pun tentang NISN maupun kamus referensi (bagian 1-7 hanya akun dev + master data) → sampai baris kamusnya ada, `SEM-NISN-CHK` berstatus `NOT_IMPLEMENTED` dan domain MAHASISWA **ditolak kirim**, bukan diloloskan. Penempatan kamus yang diusulkan: `reference_items(kind='nisn_checksum')` dengan resep di `extra` jsonb + `source_ref` menunjuk dokumen resmi — **butuh registrasi DATA_MODEL §14.2**, bukan keputusan dokumen ini | `SEMANTIC` (usulkan; tidak pernah "membetulkan" digit terakhir) |
| **ID Registrasi (`id_reg`)** | tepat **10 karakter alfanumerik**; bila baris sudah pernah dikirim dan `feeder_identities` kosong → tolak | id ini **milik pusat**. Bentuknya boleh diuji, isinya tidak boleh dibuat: tidak ada `ENRICH` yang berhak mengarang `id_reg` | bentuk = `FORMAT`; keharusan ada = `BLOCKING` |
| **NIM** | cocok dengan **regex berversi** dari `tenant_settings.nim_format` | **Ralat nama (diukur 2026-10-20):** ARCHITECTURE §12.6 menulis `tenant_settings.format_nim`, sedangkan DATA_MODEL §14.3 mendefinisikan kolom nyatanya **`nim_format jsonb`** dengan bentuk `{"pattern":"{kodeFak}{tahun}{seq4}","perProdi":false}`. §1.11 memakai **`nim_format`**, nama milik DATA_MODEL; ARCHITECTURE §12.6 yang perlu diralat pada giliran pemiliknya. Tanpa pola terisi → `NOT_IMPLEMENTED`, bukan lolos | `FORMAT` bila hanya lebar/padding yang salah; `SEMANTIC` bila digitnya beda |
| **SKS per jenis** | tiap rincian `<> 0` dan `<= 9`; total = jumlah empat rincian (`numeric(4,1)` kedua sisi) | ini **CHECK nyata** di `pddikti_staging_kurikulum` (§16.4.3) — aturan mesin hanya mengulang yang sudah ditegakkan DB, tidak menggantikannya. Feeder menolak 0 dan > 9 (AC-FDR-2, §14.5(3)). **Vonis konsisten (diralat 2026-10-20, tutup `RD-42`-style duplikasi kosakata):** kategorinya `BLOCKING`, bukan `SEMANTIC` — karena ada `CHECK` struktural yang membuat barisnya tidak mungkin sah, jadi tidak ada ruang "usulkan lalu kirim". ARCHITECTURE §12.6 menempatkan contoh ini di `SEMANTIC`; itu **yang perlu diralat di sisi ARCHITECTURE**, dan dokumen ini tidak lagi menulis dua verdict untuk satu aturan. Level temuannya (`§1.6.2`) tetap `FATAL` — dua kosakata, satu arah: lihat crosswalk §1.11.1 | `BLOCKING` (kategori ALG-11) = temuan `FATAL` (level §1.6.2) |
| **Paritas semester** | digit term periode ∈ kamus `GetSemester` versi aktif; `periode_keluar >= periode_masuk`; tidak ada irisan periode antar prodi; paritas `GANJIL`/`GENAP` konsisten dengan `starts_on`/`ends_on` | digit untuk `ANTAR` **`[TIDAK-TERVERIFIKASI]`** (§1.10.2): keanggotaan diuji ke kamus, tidak ada pemetaan digit yang di-*hardcode* | `BLOCKING` |
| **Status mahasiswa** | `akm_status_code` ∈ `'1'..'5'` **dan** anggota kamus pusat versi aktif | enum CHECK saja tidak cukup: nilai 5 yang tidak dikenal pusat tetap ditolak. Ini aturan "harus ada di kamus", bukan "cocok dengan regex" | `SEMANTIC` |
| **Akreditasi** | `accreditation_status` anggota kamus BAN-PT/LAM dan `accreditation_expires_on` belum lewat saat yudisium | kedaluwarsa = tolak untuk KELUAR, peringatan untuk domain lain (BR-R7) | `BLOCKING` untuk `graduation` |

#### 1.11.5 Ambang pencocokan kemiripan, blocking, dan penugasan

Ruang kandidat **selalu** milik tenant sendiri: pasangan lokal ↔ baris Feeder hasil `Get*`. Ini
*grounding* atas data, bukan pembentukan teks (AGENTS §3.9), dan karena itu bisa diberi ambang.

**Pemilihan metrik (bukan selera — bentuk datanya yang menentukan):**

| Bentuk data | Metrik | Kenapa | Batas jarak/skor |
|---|---|---|---|
| Nama orang (`person_name`, `activity_title` orang) | **Jaro-Winkler** `JW = J + l·p·(1−J)`, `l ≤ 4`, `p = 0,1` | kesalahan ketik nama hampir selalu di **ujung**, sedangkan awalan tetap benar; pembobotan prefiks memberi skor tinggi pada kasus itu tanpa menaikkan skor "Budi" vs "Budiman" secara bebas | skor saja tidak memvonis; vonis dari skor **dan** `margin` |
| Kode pendek (`nik`, `nisn`, `id_reg`, `nim`, kode wilayah) | **Levenshtein** | kode adalah urutan karakter dengan makna per posisi; jarak 1 berarti satu tombol meleset | jarak `<= 1` untuk panjang `<= 10`, `<= 2` untuk lebih panjang, **dengan syarat satu-ke-satu** (satu karakter pusat tidak boleh dipasangkan ke dua lokal) |
| Judul panjang (nama matakuliah, judul aktivitas, judul TA) | **Dice/Jaccard atas 3-gram** + **TF-IDF cosine** | panjang membuat edit-distance murah salah ("Pengantar" muncul di ratusan judul) dan naif; kemiripan set 3-gram + bobot kata menangkap parafase judul | keduanya wajib di atas ambang; bila bertentangan → `REVIEW`, bukan rata-rata |

**Vonis (tiga tingkat, disimpan di `feeder_identity_matches.verdict` / `feeder_autofix_suggestions.verdict`):**

| Vonis | Syarat (angka dibaca dari `rule.threshold`, tidak ditulis ulang di sini) | Efek |
|---|---|---|
| `AUTO` | `score >= rule.threshold.auto` **DAN** `margin >= rule.threshold.min_margin` **DAN** tepat **satu** kandidat | perbaikan boleh diterapkan ke kolom staging untuk `FORMAT`/`ENRICH`; untuk `IDENTITY` ini tetap **hanya usulan** yang butuh `feeder.identity.confirm` |
| `REVIEW` | `rule.threshold.review <= score < rule.threshold.auto`, **atau** margin lebih tipis dari `rule.threshold.min_margin`, **atau** metrik 3-gram dan cosine bertentangan | masuk antrean layar "Identitas" dengan dua kandidat terdepan; tidak ada tindakan otomatis |
| `NO_MATCH` | `score < rule.threshold.review`, **atau** beberapa kandidat setara, **atau** ruang kandidat kosong | kolom dibiarkan kosong + `candidate_ref` ke tarikan `Get*`; **bukan** nol, bukan nilai turunan |

**Ambang hidup di mana — satu tempat saja.** Bentuk nilainya `{metric, auto, review, min_margin}` pada
kolom `feeder_autofix_rules.threshold` (DATA_MODEL §18.5), karena ambang itu **berversi bersama aturan**
dan terkunci oleh `feeder_autofix_rules.version` (`UNIQUE (tenant_id, rule_code, version)`).
**Dokumen ini tidak mengulang angkanya**: contoh nilai baku tinggal satu tempat, yaitu komentar kolom di
DATA_MODEL §18.5; menyalinnya ke tabel vonis di atas dan ke §1.15 adalah persis pola `RD-03`/`RD-12` yang
kita perangi. Yang berubah hanyalah **nama accessor** (`rule.threshold.auto`, `rule.threshold.review`,
`rule.threshold.min_margin`). ARCHITECTURE §12.6 menulis ambang yang sama sebagai
penghuni `academic_rules` per tenant. **Pertentangan penempatan itu ditutup di sini ke satu arah**:
yang dieksekusi mesin adalah `rule.threshold`, karena hanya ia yang ikut `version` aturan dan ikut
menentukan `payload_digest`; `academic_rules` tetap menjadi rumah aturan ber-scope prodi × periode
(SKS per IPK, jendela KRS, denda) dan **bukan** tempat ambang kemiripan. ARCHITECTURE §12.6 perlu
diralat oleh pemiliknya; dua tempat ambang untuk hal yang sama adalah cacat, bukan pilihan gaya.

**Blocking (wajib, bukan optimasi).** Banding semua-ke-semua `O(n^2)` tidak masuk *budget* ALG-11
(120 s / 20 ribu baris, ARCHITECTURE §12.11). Kunci blok, semuanya kolom milik tenant ini:
`substr(norm,1,3)` (prefiks-3), `kode_wilayah_nik(1:5)`, `tanggal_lahir`, `prodi_id`. Kandidat hanya
dibandingkan **di dalam blok yang sama**, dan tiap pasangan menyimpan `blocked_by` = kunci yang dipakai
(`feeder_identity_matches.blocked_by` NOT NULL, §18.5) supaya biaya `O(n·k)` dapat diaudit, bukan
dibuktikan dengan keyakinan. Di dalam blok: **BK-tree** atas jarak edit (target `k ≤ 50`); untuk kamus
judul matakuliah, varian hapus bergaya *SymSpell* sebagai indeks kandidat.

**Penugasan satu-ke-satu.** Setelah skor didapat, pasangan dipilih agar **satu baris Feeder tidak pernah
dipasangkan ke dua mahasiswa** dan sebaliknya: *greedy* terurut skor turun untuk n besar, **Hungarian
`O(n^3)` hanya bila `n ≤ 60`** dalam satu blok (di atas itu, `O(n^3)` pada blok 500 adalah penolakan
diam-diam terhadap *budget* — pecah per kunci blok, dan pasangan lintas-chunk **ditolak**, bukan
dipaksakan). Hasil penugasan ditulis dengan `metric`, `score`, `runner_up_score`, `margin`; tidak ada
jalan lain untuk masuk `AUTO`.

#### 1.11.6 Keluaran: usulan, temuan, dan apa yang tidak dibuat dua kali

| Keluaran | Objek | Catatan |
|---|---|---|
| Perbaikan (auto maupun usulan) | `feeder_autofix_suggestions` (`rule_id`, `staging_table`, `staging_id`, `record_key`, `column_name`, `before_value`, `after_value`, `metric`, `score`, `runner_up_score`, `margin`, `verdict`, `applied_by`, `applied_at`, `reverted_at`) | **reversibel dan ter-*diff*** oleh bentuknya; tidak ada tabel kedua |
| Pasangan identitas | `feeder_identity_matches` | **tanpa kolom `feeder_id`** — penegakan I-14 lewat bentuk skema |
| Temuan validasi | `pddikti_validation_findings` (§14.5(5)) + kolom nyata hasil §16.4.4 (`domain`, `staging_record_key`, `feeder_error_code`, `feeder_error_msg`, `snapshot_id`) dan **permintaan** `level`/`expected`/`actual`/`remedy_href` (§1.5.4 daftar 2) | temuan **tidak dibuat dua tabel** (DATA_MODEL §18.5 menyebutnya terang); ejaan kunci baris staging adalah `staging_record_key`, bukan `record_key`/`staging_rev` |
| Eksekusi aturan | view `pddikti_validation_runs` **atas** `pddikti_sync_runs` (§16.4.4) | view ini **kalah sebagai tabel** dan tidak boleh dihidupkan kembali sebagai tabel |
| Aturan itu sendiri | `feeder_autofix_rules` (`rule_code`, `kind`, `domain`, `applies_to`, `check_expr`, `fix_expr`, `threshold`, `version`, `status`, `source_ref`, `requested_by`, `approved_by`) | `source_ref` **NOT NULL**: aturan tanpa sumber tidak boleh `ACTIVE` |

#### 1.11.7 Larangan yang membuat bagian ini aman

1. Mesin **tidak pernah** menulis ke `students`, `courses`, `enrollments`, `grades`, `student_activities`,
   `thesis_records` — hanya ke kolom baris staging milik run ini.
2. Mesin **tidak pernah** menghasilkan `feeder_id`, `id_reg`, `id_prodi`, `id_pt`, `id_periode` yang tidak
   berasal dari respons bridge tersimpan (`feeder_identities` ← `pddikti_payload_snapshots.feeder_id_returned`).
3. **Tidak ada `AUTO` tanpa aturan berversi** yang sudah `ACTIVE` lewat empat-mata (§1.13 butir 5). Aturan
   `DRAFT` hanya boleh menghasilkan temuan, tidak boleh menghasilkan tulisan.
4. Sumber nilai setiap `ENRICH` wajib **kolom atau FK yang terdaftar** di `applies_to`; aturan yang
   menunjuk kolom belum ada di skema menghasilkan `FEEDER_SOURCE_NOT_IMPLEMENTED` (§1.6.1 butir 5) dan
   **menolak kirim domain itu**, tidak melewatinya.
5. Nama orang **tidak pernah** dibetulkan secara diam-diam bila perubahannya mengubah identitas
   (ARCHITECTURE §12.6): `FMT-TITLE` hanya boleh memotong token yang ada di allowlist kamus.
6. Hasil selalu lewat worker `engine.feederpre` (120 s / 20 ribu baris, §12.11) — bukan rute HTTP;
   `422 ENGINE_*`/`503 ENGINE_BUDGET_EXCEEDED` hanya sebagai apa yang terdaftar di API_SPEC §2.3
   (baris 73–75), bukan sebagai kode baru di sini.
7. Ruang kandidat dibatasi `tenant_id` baris staging — **tidak ada banding lintas tenant** dalam bentuk
   apa pun, termasuk untuk menaikkan skor.

### 1.12 Delta Sync Feeder — cara menentukan "yang berubah"

**Kepemilikan.** Mekanika kanoniknya adalah [ARCHITECTURE §12.10](file:///c:/SICA/docs/ARCHITECTURE.md);
objek dan kolomnya adalah `feeder_sync_watermarks` di [DATA_MODEL §18.5](file:///c:/SICA/docs/DATA_MODEL.md)
(`0040_feeder_autofix.sql`). Sub-bagian ini **menjabarkan** supaya dapat diuji (himpunan, urutan, kunci,
ambang maju), tidak mengubah norma dan tidak menambah objek tandingan. Yang **tidak** ada di §12.10 dan
tidak pernah dispesifikasi di dokumen mana pun: definisi `tombstone`, aturan induk-sebelum-anak per
domain, dan apa yang terjadi pada airmen ketika run hanya sebagian berhasil.

#### 1.12.1 Himpunan berubah (tiga klausa, digabung sebagai OR)

Kandidat run = baris staging domain `d` milik tenant yang memenuhi **salah satu**:

| Klausa | Definisi yang dieksekusi | Kenapa perlu |
|---|---|---|
| **A. Ubah isi** | `source_updated_at > feeder_sync_watermarks.last_committed_at` (kolom nyata §16.4.2, bukan `updated_at` tabel operasional — yang kita bandingkan adalah versi payload, bukan versi baris sumber) | jalur normal |
| **B. Transisi keadaan** | ada baris audit/riwayat transisi ber-`VALIDATE` **setelah** watermark pada objek sumber: `grades` menjadi `EFFECTIVE`, `enrollments` menjadi `SUBMITTED`/`APPROVED`, `student_status_history` baru, `yudisium`/`graduation_records` bervalidasi, `pddikti_reconciliation_diffs` ber-`decision` | **isi tidak berubah, maknanya berubah.** Nilai yang angkanya sama tetapi baru disetujui **wajib** dikirim; watermark berbasis kolom waktu saja akan melewatkannya selamanya |
| **C. Koreksi / pembatalan** | baris ber-`action='DELETE'` sebagai **tombstone** yang menunjuk `record_key`, atau baris staging yang temuan `BLOCK`-nya baru ditutup sehingga `state` view berubah dari `REJECTED`/`BLOCKED` menjadi `VALIDATED` | **hard delete dilarang (BR-R10)** — penghapusan fisik tidak pernah bisa dibuktikan ke auditor dan tidak pernah bisa di-*resume*; yang dikirim adalah pernyataan pembatalan, sisanya diputuskan pusat lewat jalur koreksi/PDM (§1.4(o)). Versi lama klausa ini menyebut `supersedes_rev` dan `pipeline_state='REJECTED'`; keduanya **tidak ada** di skema — pemetaannya §1.5.1/§1.5.4 |

Run `PARTIAL` tidak menggeser apa pun (§1.4(l)); kandidat dihitung ulang dari watermark terakhir, bukan
dari "yang sudah dicoba".

#### 1.12.2 Digest dan SKIP

`payload_digest` (SHA-256 heks atas kanonikalisasi kolom yang **ditujukan ke Feeder**; gramatika §1.5.3,
kolom nyata §16.4.2) dibandingkan dengan digest pada baris `feeder_identities`/tarikan `Get*` terakhir.
**Digest sama = SKIP**: tidak dikirim, tidak dibuat job-nya, tidak membakar kuota vendor, dan **tidak
mencatat kegagalan apa pun** — SKIP adalah keputusan benar, bukan keadaan anomali. Empat konsekuensi yang
harus ikut ditulis supaya tidak salah paham:

1. Yang dibandingkan adalah **payload kanonik**, bukan kolom sumber. Koreksi `FORMAT`/`ENRICH` §1.11
   yang mengubah byte payload **menjadi** perubahan (digest beda) dan karena itu terkirim; koreksi yang
   hasilnya identik tidak mengirim apa pun.
2. Versi kamus ikut masuk kunci idempotensi (`dictionary_version` pada rumus §1.5.3 — **permintaan
   kolom**, §1.5.4 daftar 2), sehingga payload yang isinya sama
   tetapi dihitung dari versi kamus berbeda **tidak** dianggap identik — pusat bisa menolak yang kedua
   (BENCH-131).
3. Digest dihitung atas kanonikalisasi **plaintext sebelum** enkripsi kolom PII (§16.4.2), sehingga
   keutuhan bukti dapat diverifikasi tanpa membuka isi yang dirahasiakan.
4. Untuk NILAI, payload-nya sendiri terenkripsi (`canonical_payload_encrypted`, §16.4.3 butir 5); digest
   tetap kolom kanoniknya. Delta sync **tidak** mendefinisikan digest kedua untuk domain itu.

Nama yang diminta pengguna adalah "record digest". **Tidak ada kolom bernama `record_digest`**: yang
dimaksud adalah `payload_digest` (punya dua pemilik sekaligus: §1.5.3 dan DATA_MODEL §16.4.2), dan
`request_digest` pada `pddikti_payload_snapshots` (§16.4.5) yang menghitung byte HTTP persis per
percobaan. Nama ketiga tidak dibuat.

#### 1.12.3 Urutan induk-sebelum-anak

Urutan pengiriman deterministik, dan pelanggaran urutan adalah sebab umum penolakan "induk belum ada":

```
1  urutkan  (kind: CREATE sebelum UPDATE pada record_key yang sama),
             (tanggal masuk / periode),
             (domain dalam graf dependensi di bawah),
             (record_key) sebagai pemecah seri — tidak ada urutan "yang pertama ketemu"
```

| Urutan | Domain | Bergantung pada |
|---|---|---|
| 1 | MAHASISWA (biodata, `id_reg`) | PT + prodi terdaftar (`GetProfilPT`/`GetProdi`) dan kamus periode |
| 2 | KURIKULUM (matakuliah) | prodi + kurikulum; `id_kurikulum` pusat sudah ada |
| 3 | KELAS | matakuliah (KURIKULUM) **dan** `id_kelas_kuliah` dari bridge; `lecturer_list` diisi dari `class_assignments` |
| 4 | KRS_AKM | mahasiswa (1) **sebelum** perkuliahan; kelas (3); periode |
| 5 | NILAI | KRS_AKM (4) + `feeder_identities(entity_type='class')` |
| 6 | AKTIVITAS | mahasiswa (1) + jenis aktivitas dari kamus `Get*` |
| 7 | KELUAR | seluruh riwayat (1-6) bersih, gerbang keuangan & clearance lepas, akreditasi belum kedaluwarsa |

Aturan yang menegakkan: baris anak **tidak boleh** dibuat sebagai job selama baris induknya belum
`ACKNOWLEDGED` untuk `record_key` yang sama. Ini bukan antrian prioritas; ia penahan. Resume parsial
(§1.8.3) memakai urutan yang sama, karena mengirim "mahasiswa sebelum KRS" sekali tidak menjamin
resume mengirim urutan itu lagi.

#### 1.12.4 `Idempotency-Key` per record

Satu kunci per record, **tidak ada kunci kedua untuk delta sync**:

```
feeder_jobs.idempotency_key = sha256(concat_ws('|', tenant_id, action, record_key,
        payload_digest, packer_version, dictionary_version, coalesce(reopen_request_id,'-')))
                                                                  -- §1.5.3; SHA-256 = 64 karakter heks
UNIQUE (tenant_id, idempotency_key)                                                  -- feeder_jobs, 0028
```

Rumus §1.5.3 adalah **superset** dari bentuk yang diminta (`hash(tenant, domain, record_key, digest)`):
ia memakai `action` (bukan `domain`) karena satu domain dapat mengirim beberapa aksi, dan menambah
`packer_version` + `dictionary_version` + `reopen_request_id`. **Catatan ralat 2026-10-20:** versi lama
menyebut hasilnya "40 karakter heks" — salah hitung; SHA-256 adalah 64, dan itu yang diizinkan
`CHECK (length(payload_digest) = 64)` di §16.4.3. Dua suku tambahan (`dictionary_version`,
`reopen_request_id`) **belum menjadi kolom** (§1.5.4 daftar 2), jadi kunci yang dapat dihitung hari ini
hanya empat suku pertama — itu keadaan yang harus diumumkan, bukan dirapikan.

#### 1.12.5 Watermark: hanya maju atas baris yang benar-benar `SUCCEEDED`

| Kolom `feeder_sync_watermarks` | Diisi ketika | Larangan |
|---|---|---|
| `last_committed_at` | **hanya** baris yang berakhir sukses diterima pusat (state `ACKNOWLEDGED`, `response_code = 0`) — airmen digeser ke nilai `source_updated_at` **maksimum baris yang sukses itu**, bukan ke waktu mulai run dan bukan ke `max()` seluruh kandidat | menggeser airmen atas baris `REJECTED`/`DEAD`/`SKIPPED` — kehilangan data senyap, cacat paling berbahaya di jalur Feeder (DATA_MODEL §18.5 penutup) |
| `last_run_id` | run yang menyumbang pergeseran terakhir | menunjuk run `PARTIAL` sebagai airmen |
| `row_count`, `digest` | jumlah baris yang **benar-benar** terkirim sukses pada langkah itu + digest agregat himpunan sukses | menghitung SKIP sebagai terkirim, atau menghitung ulang dari kandidat |
| `forced_full_at` | **rebuild penuh** diminta: `feeder.watermark.force` (verba `OTHER`, hanya `TENANT_ADMIN`, RBAC §4.5 baris 86). Klausa A diabaikan satu kali; seluruh record dihitung ulang, digest tetap menyaring yang identik | memakai rebuild sebagai jalan pintas mengganti aturan yang belum di-*approve*; tidak ada `forced_full_at` yang menghapus riwayat (BR-R10) |

`UNIQUE (tenant_id, domain, entity)` berarti airmen **per domain dan per entitas dalam domain** —
rekonsiliasi parsial `KRS_AKM` tidak boleh menggeser airmen `NILAI`.

#### 1.12.6 Retry, limiter, DLQ — cross-reference, bukan keputusan baru

Angka kanal `feeder.push` (`concurrency` 4, `limiter` 20 req/1000 ms, `attempts` 4, backoff eksponensial
5.000 ms + jitter dengan ceiling 5 menit, kegagalan terminal ke DLQ `feeder.push-dlq` disertai temuan
`BLOCK`) sudah **dinormakan di ARCHITECTURE §10.4.1** dan kurva transport per kelasnya di §1.8.1–§1.8.2.
§1.12 hanya menambahkan satu konsekuensi: **retry tidak pernah menggeser airmen**, dan retry **hanya**
untuk kelas `TRANSPORT`/`TOKEN` (§1.8.4) — penolakan validasi pusat (`error_code` validasi) tidak pernah
di-*retry* otomatis, ia menjadi `REJECTED` dan menunggu manusia.

#### 1.12.7 Batas yang membuat delta sync tidak menjadi jalan tikus

**Perubahan keadaan akademik tidak boleh dikirim sebagai efek samping; ia hanya boleh dikirim sebagai
hasil transisi yang sudah disetujui.** Delta sync menggoda orang untuk "kirim sekarang, setujui
belakangan" karena otomatis mengambil apa yang berubah. Enam penahan, semuanya sudah berpemilik:

| Penahan | Bentuknya | Rujukan |
|---|---|---|
| Klausa B **hanya** membaca transisi ber-`VALIDATE` | nilai `DRAFT`/belum `EFFECTIVE`, KRS belum `SUBMITTED`, yudisium belum disetujui → **tidak masuk kandidat** | ARCHITECTURE §12.10 aturan (c); verba `VALIDATE` RBAC_MATRIX §4 |
| Staging append-only, tidak ada edit bebas | koreksi = `rev` baru; state hanya naik lewat workflow | §1.5.2 butir 3-4; DATA_MODEL §16.4(1) |
| Gerbang kirim butuh dua orang | `validated_by <> decided_by`; `approverId <> requesterId` | §1.13 butir 3; API_SPEC §2.3 baris 55 & 56 |
| Temuan `BLOCK` menahan state | `VALIDATED` tidak tercapai; job tidak dibuat | `409 FEEDER_BLOCKING_FINDINGS` (baris 32), `422 PDDIKTI_CORRECTION_REQUIRED` (baris 33) |
| Periode terkunci | delta sync tidak menembus periode `CLOSED`/`LOCKED` | `423 PERIOD_CLOSED` (baris 25), `409 GRADE_LOCKED_USE_CORRECTION_WORKFLOW` (baris 35) |
| Gerbang kelulusan | domain KELUAR ditahan selama tagihan/clearance/cekal belum bersih | `409 GRADUATION_GATE_UNRESOLVED` (baris 31) |

### 1.13 Aturan keselamatan yang mengikat (norma, bukan saran)

Sembilan norma ini **mengikat** dan masing-masing punya locus penegakan; tidak satu pun boleh ditulis
di kode sebagai "konvensi tim". Sebuah aturan tanpa penegak = temuan audit, bukan keselamatan.

| # | Norma (mengikat) | Yang menegakkan | Pemilik rujukan | Bukti verifikasi |
|---|---|---|---|---|
| 1 | Auto-fix **tidak pernah** menulis tabel akademik sumber (`students`, `enrollments`, `grades`, `courses`, `student_activities`, `thesis_records`). Koreksi data sumber = permintaan + `VALIDATE` lewat service pemiliknya, tanpa *hard delete* | `fix_expr` hanya untuk `FORMAT`/`ENRICH`; tulisan hanya ke kolom baris staging; CI §18.9(7) mencari `applied_at` pada `SEMANTIC`/`BLOCKING` dan wajib 0 baris | DATA_MODEL §18.5 + §14.5 BR-R10; ARCHITECTURE §12.6 invariance (a) | `docs/DATA_MODEL.md` §18.9 nomor 7 |
| 2 | **`feeder_id` hanya dari respons bridge.** Tidak ada jalur lain, tidak ada skor setinggi apa pun yang memberi hak itu, tidak ada field `pddikti_*_id` yang diterima dari body | `feeder_identity_matches` **tanpa kolom `feeder_id`**; `pddikti_payload_snapshots.feeder_id_returned` sebagai satu-satunya jalan masuk; kolom `pddikti_*_id` = `SERVER_ONLY` | invariance **I-14**; DATA_MODEL §14.9 | DATA_MODEL §8 query nomor 7 ("tidak ada id yang lahir tanpa jejak snapshot") |
| 3 | **Gerbang kirim butuh dua orang:** `validated_by <> decided_by` (dan `approved_by <> requested_by` di level aturan/tarif). Satu actor tidak pernah menjadi pemohon sekaligus penyetuju | `CHECK` pada `pddikti_reconciliation_diffs` dan `feeder_autofix_rules`; `violatesSoD()` di service | API_SPEC §2.3 baris 56 `SELF_APPROVAL_FORBIDDEN`, baris 55 `DECISION_ALREADY_MADE`; SoD BR-K2/BR-M1 | uji empat titik kegagalan RBAC (AGENTS §3.8) |
| 4 | **Setiap perbaikan reversibel dan ter-*diff***: `before_value`/`after_value` + `reverted_at`; tidak ada "perbaikan" yang hanya hidup di memori worker | baris `feeder_autofix_suggestions` per `(run, staging, kolom, rule)`; revert menulis `rev` staging baru | DATA_MODEL §18.5; ARCHITECTURE §12.6 invariance (c) | `UNIQUE (run_id, staging_table, staging_id, column_name, rule_id)` — run ulang tidak menggandakan |
| 5 | **Aturan berversi + empat-mata, karena mengubah aturan = mengubah apa yang diterima negara.** `status='ACTIVE'` menolak diri bila `approved_by` kosong atau sama dengan `requested_by`; `source_ref` wajib | `CHECK` di `feeder_autofix_rules`; izin `feeder.autofixrule.approve` (verba `VALIDATE`, `ADMIN_ACADEMIC`/`HEAD_OF_PROGRAM` **≠** pembuat, MFA penulis-admin) | RBAC_MATRIX §4.5 baris 76-79; ARCHITECTURE §11.4/AGENTS §3.9 "parameter = kewenangan" | uji penolakan: aturan `DRAFT` tidak dapat diterapkan |
| 6 | **Delta sync tidak pernah menggeser watermark atas baris yang belum `SUCCEEDED`** | `feeder_sync_watermarks` ditulis hanya dari jalur `ACKNOWLEDGED`; `row_count`/`digest` ikut terhitung dari subset sukses | ARCHITECTURE §12.10 aturan (a); DATA_MODEL §18.5 penutup | run parsial → periksa airmen **tidak** berubah untuk baris gagal |
| 7 | **PII tidak pernah menjadi key payload plaintext**, termasuk hasil normalisasi telepon/gelar | trigger `app.reject_pii_in_payload()` (daftar `banned` keys, §16.4.2); nilai normalisasi masuk kolom `*_encrypted` | DATA_MODEL §16.4.2; `nik`/`nama_ibu`/`no_hp` terlarang di payload | CI §8 bandingkan hasil filter recursive packer |
| 8 | **Fail-closed adalah default.** Sumber aturan belum ada → `NOT_IMPLEMENTED` + tolak kirim; kandidat kosong → `NO_MATCH` + kolom kosong; **tidak ada nol, tidak ada tebakan, tidak ada pelompatan senyap** | §1.6.1 butir 5; `verdict='NO_MATCH'` tidak pernah mengisi `after_value` | ARCHITECTURE §12.11 mode turun ALG-11 | §1.10.3 butir 3 |
| 9 | **Mesin mengusulkan, manusia menyetujui** berlaku penuh di kanal Feeder: keluaran §1.11 hanya masuk objek Feeder milik kanal ini, dan tidak pernah menjadi record akademik | `proposal_only`: tidak ada INSERT/UPDATE dari engine ke tabel domain; hasil resmi lahir lewat service + `VALIDATE` | AGENTS §3.9 butir 2; ARCHITECTURE §12.2.5 | uji penolakan CI: engine tidak dapat menulis tabel domain |

### 1.14 Implikasi entitas baru (DATA_MODEL §19) ke payload Feeder

Empat gugus entitas baru lahir di [DATA_MODEL §19](file:///c:/SICA/docs/DATA_MODEL.md) (`0044`, `0045`,
`0046`). Tiga di antaranya **tidak punya padanan di kamus pusat**, dan itu harus ditulis sebagai batas,
bukan dirapikan menjadi fitur. Yang dilarang di bagian ini: menjanjikan sinkron yang bentuknya belum
ada resmi (pola `BENCH-*` yang kita catat, dan §1.10.3 butir 1).

#### 1.14.1 Multi-kampus (`campus_sites`, `0044`) — apa yang TIDAK dipetakan PDDikti

| Kenyataan | Konsekuensi ke Feeder |
|---|---|
| **PDDikti mengenal kode PT per program studi, bukan per gedung.** Kolom `campus_sites.feeder_kode_pt` sengaja diberi komentar bahwa isinya **tidak boleh berbeda antar site** bila pusat tidak mengenal konsep site (DATA_MODEL §19.1) | satu tenant = **satu "perguruan tinggi" di mata Feeder** hari ini. Mengirim `kode_pt` berbeda per kampus = membuat PT hantu di pangkalan nasional; itu temuan `BLOCKING` (`FEEDER_PT_CODE_UNREGISTERED`), bukan variasi konfigurasi |
| Tidak ada field alamat/koordinat gedung pada aksi kirim; lokasi tidak menjadi bagian record kelas | `site_id` **tidak ikut payload**. Ia tetap kolom milik SICA (`rooms.site_id`, `class_sessions.site_id`, `enrollments.site_id`, `tuition_tariff_matrix.site_id`) dan dipakai untuk kapasitas, jadwal, presensi, tagihan, laporan per site |
| Yang **mirip** tetapi bukan sama: Feeder mengenal **kelas paralel** (`no_urut`/`class_seq`) dan **jenis aktivitas kuliah** (`id_aktif_kuliah`) | **Kelas paralel dan lokasi berbeda adalah dua hal yang berbeda di SICA, tetapi satu hal yang sama di Feeder.** Dua kelas paralel di gedung berbeda dikirim sebagai dua kelas dengan `kode_pt` yang sama; bedanya hilang di pusat. Karena itu: (a) `site_id` wajib ikut **`record_key`/`local_id`** sisi lokal supaya dua payload yang bentuknya identik tetap terbedakan di staging; (b) baris KELAS **tidak boleh** di-*dedup* oleh digest lintas-site — yang dibandingkan adalah payload, dan payload dua site bisa sama persis |
| Scope RBAC `SITE` diminta DATA_MODEL §19.1 sebagai keputusan RBAC_MATRIX, belum diputuskan | tanpa scope `SITE`, "hak kirim hanya untuk kampus cabang" tidak dapat dinyatakan; `feeder.period.send` hari ini ber-scope organisasi/prodi |

**Sikap yang diizinkan hari ini:** kirim sebagai kelas dengan `kode_pt` tunggal; laporkan kebutuhan
`site` sebagai **temuan BENCH baru** dan tunggu kamus resmi (DATA_MODEL §19.1 kalimat penutup).
**Tidak diizinkan:** mengirim `site` dalam bentuk apa pun yang dikarang, atau mengklaim "sinkron
multi-kampus" di layar mana pun.

#### 1.14.2 Jenis program (`reference_items(kind='jenis_program')`) — Reguler / Karyawan / PJJ / Internasional

Vonis modelnya sudah diambil DATA_MODEL §19.2 dan **tidak dibuka ulang**: tidak ada tabel
`program_types`; yang ada kamus `reference_items(kind='jenis_program')` + kolom `text` bertenor panjang
(`study_programs.default_program_type`, `classes.program_type`, `enrollments.program_type`).

| Aturan ke-Feeder | Isi | Kenapa |
|---|---|---|
| **Kamus nilai nasional wajib dari `Get*` resmi, bukan dikarang** | `reference_items.feeder_code` + `reference_kinds.feeder_code` di-*upsert* dari aksi `Get*` (`source='SYNC'`, `verified_at` terisi) mengikuti §1.2 aturan 1 dan §14.5 aturan 2 | nilai `jenis_program` yang ditulis manual = penolakan per record dan **temuan risiko di panel Kesehatan Data**; `reference_kinds.has_external_dictionary = true` adalah tanda bahwa kind ini tidak boleh punya nilai manual |
| Jenis program ikut payload **hanya bila** punya `feeder_code` terisi | `ENR-PROGTYPE`: kosong → field tidak dikirim + temuan `WARNING`; **tidak** dipetakan dengan menebak dari string nama kelas | DATA_MODEL §19.2 melarang `program_type` di-*infer* dari string nama kelas |
| **PJJ** | `delivery_mode='ONLINE'` wajib; geofence presensi tidak berlaku (`method='LMS_ACTIVITY'`); kuota ruang tidak terpakai | dampaknya ke Feeder: KRS_AKM/KELAS tetap dikirim, tapi dasar **kehadiran** di §1.6.3 (`FEEDER_PRESENCE_MINIMUM`) tidak boleh menuntut sesi tatap muka yang memang tidak ada |
| **Karyawan** | jendela kelas malam/akhir pekan; tarif berbeda; `meeting_minutes` 150/170 | tidak mengubah bentuk payload, hanya nilai periode/ruang di sisi lokal |
| **Internasional** | bahasa pengantar (`courses.bahasa_pengantar`), skema nilai berbeda (`grade_scale_bands` per skema) | **tidak ikut checkpoint Feeder yang sama** (DATA_MODEL §19.2 huruf c) — ini batas yang wajib dilaporkan, bukan fitur yang dijanjikan; domain KELUAR/NILAI untuk program ini berhenti dengan temuan, bukan dengan angka yang mungkin salah skala |

#### 1.14.3 Tugas Akhir non-skripsi (`final_project_kinds`, `0045`)

| Bentuk | Perlakuan ke Feeder |
|---|---|
| Skripsi | jalur lama; ikut `pddikti_staging_keluar` (`thesis_title`, `thesis_route`, pembimbing 1-3 + `sup*_month_from/to`, `examiners`) |
| **Prototipe / proyek industri / publikasi / HAKI / paten / penampilan** | jenisnya **data** di `final_project_kinds`, dan kolom `feeder_jenis_ta` menentukan segalanya: **`NULL` berarti TIDAK DIKIRIM** (I-14), bukan "dikirim dengan kode asal" (DATA_MODEL §19.3 aturan penutup) |
| Jenis dengan `requires_publication = true` | transisi ke `PASSED` **ditolak** selama tidak ada `final_project_outputs` bervalidasi; ini gerbang lokal, dan KELUAR tidak boleh naik ke staging sebelum gerbangnya lepas (domain KELUAR baris `BLK-*` §1.11.2) |
| **Nomor HAKI / paten / DOI** | `final_project_outputs.identifier` **tidak punya kamus pusat** — repo tidak mengenal aksi `Get*` untuk HAKI/DOI. Konsekuensi: nilai ini **hanya ikut sebagai bukti lokal** (`attachments` + `evidence_digest`), tidak pernah masuk payload Feeder sebagai field yang dikarang, dan tidak pernah menjadi dasar `ENRICH` |
| `venue` (jurnal/konferensi/instansi) | kolom `text` **bukan FK** karena memang tidak ada kamusnya (§19.3) — jadi ia juga tidak dapat dipetakan ke kode pusat; jangan menjanjikan pemetaan yang sumbernya tidak ada |
| `credit_transferable` (pengakuan kredit lintas matakuliah, pasal 53/2023) | berdampak pada **KURIKULUM/MBKM konversi** sisi lokal (`course_equivalencies`, `recognized_sks`); tidak ada objek "pengakuan TA" di Feeder, sehingga ia tidak pernah menjadi record sendiri |

Angka bulan pembimbing (`sup*_month_from/to BETWEEN 1 AND 12`) tetap CHECK lokal; aturan `SEM-*` §1.11.2
hanya boleh **mengusulkan** perbaikan bila jumlah bulan tidak masuk akal, tidak pernah memotongnya
menjadi 12.

#### 1.14.4 Matriks tarif UKT (`fee_tariff_groups` + `tuition_tariff_matrix`, `0046`)

Yang **tidak** naik ke Feeder, dinyatakan terang: **tidak ada objek tagihan** (DATA_MODEL §14.5 aturan
5). Yang ada di payload hanyalah **`biaya_masuk`** (`students.entry_cost_rupiah` → `bigint` rupiah utuh),
**`id_pembiayaan`**, **`penerima_kps`**, **`nomor_kps`** (MAHASISWA) dan komponen biaya pada KELUAR.
Hubungannya dengan `0046`:

| Aturan | Isi | Penegak |
|---|---|---|
| Komponen biaya dilaporkan **hanya** bila punya padanan pusat | `fee_tariff_groups.feeder_cost_kind IS NULL` → komponen **tidak dilaporkan** sama sekali; bukan "digabung jadi satu angka lain" | CHECK bentuk kolomnya (§19.4) + aturan `ENR-FUNDING` §1.11.2 |
| Nominal tidak terbaca peran akademik | `tuition_tariff_matrix` + `invoices` berada di bawah SoD BAAK/BAUK: peran non-keuangan menerima boolean "tertahan/tidak" beserta sebab, **bukan** jumlahnya | FIELD_RULES / `SERVER_ONLY` (DATA_MODEL §14.9; AGENTS §3.8) |
| Tarif adalah kunci, bukan hitungan mesin | `site_id`, `pmb_path_id`, `pmb_wave_id`, `income_group_code` **NULLABLE dan ikut `UNIQUE` dengan `COALESCE`** (§19.4) karena NULL tidak pernah bertabrakan dengan NULL; tanpa itu generator tagihan memilih baris secara nondeterministik | `UNIQUE` + `CHECK` status `ACTIVE` butuh `approved_by <> requested_by` (empat-mata untuk uang) |
| Perubahan tarif tidak memicu delta sync massal | `tuition_tariff_matrix` **bukan** sumber `payload_digest` domain mana pun; yang dikirim adalah biaya per mahasiswa hasil pemilihan tarif | §1.12.1 klausa A hanya membaca `pddikti_staging_*` |

### 1.15 Catatan pemeliharaan gugus §1.11–§1.14

1. **Bagian ini adalah pemilik nama aturan, dan hanya itu.** `rule_code` di §1.11.2–§1.11.4 boleh
   ditambah atau diubah di sini; **algoritmanya tidak** (ARCHITECTURE §12.6), **objeknya tidak**
   (DATA_MODEL §18.5), **kode error HTTP-nya tidak** (API_SPEC §2.3), **izinnya tidak**
   (RBAC_MATRIX §4.5 baris 76-86). Agen yang ingin mengubah salah satu yang terakhir menulis di
   dokumen pemiliknya lebih dulu.
2. **Setiap aturan baru wajib membawa lima hal:** `kind`, `domain`, `applies_to`, `check_expr`,
   `source_ref`. Aturan tanpa `source_ref` tidak boleh `ACTIVE` — itu CHECK, bukan gaya bahasa.
3. **Ambang dan angka konfigurasi SICA harus dibedakan dari klaim Feeder.** Ambang kemiripan **tidak**
   ditulis ulang di dokumen ini: nilainya hidup satu tempat saja, yaitu
   `feeder_autofix_rules.threshold` berversi (bentuk `{metric, auto, review, min_margin}`, DATA_MODEL
   §18.5) dan dibaca lewat accessor `rule.threshold.*` (§1.11.5). Yang boleh disebut di sini hanyalah
   **batas yang bukan klaim vendor**: `n ≤ 60` (Hungarian) dan `k ≤ 50` (ukuran blok) adalah keputusan
   SICA; `20 req/1000 ms` dan `attempts 4` adalah norma ARCHITECTURE §10.4.1 (cross-reference, bukan
   angka yang diputuskan di sini); panjang kanonik `id_wilayah` dan
   digit `ANTAR` **tetap `[TIDAK-TERVERIFIKASI]`** (§1.10.2) dan tidak boleh naik menjadi regex.
4. **Daftar tunggu yang membuat gugus ini bisa jalan** (urutan sama dengan §1.10.3 butir 4, ditambah
   kebutuhan lokal bagian ini): eksekusi `0028` → `0031` → `0040` → `0044` → `0045` → `0046`; registrasi
   `kind='gelar'` dan `kind='nisn_checksum'` di DATA_MODEL §14.2 beserta baris seed-nya di SEED_DATA;
   keputusan RBAC_MATRIX atas scope `SITE`.
5. **Sudah ditutup di dokumen ini pada 2026-10-20** (daftar sebelumnya, supaya tidak diminta dua kali):
   tabrakan nama §1.5.4 vs §16.4.3 → §1.5.4 sekarang **crosswalk ke nama pemenang** + daftar permintaan
   kolom, dan §1.5.1/§1.5.2/§1.6/§1.7/§1.9/§1.12 sudah ikut dipindah (`RD-44`); ejaan kolom pola NIM →
   `tenant_settings.nim_format` dipakai di seluruh file, `format_nim` hanya tinggal sebagai kutipan
   ralat untuk ARCHITECTURE §12.6 (`RD-43`); ambang kemiripan tidak lagi diduplikasi (butir 3 di atas);
   verdict SKS per jenis disatukan menjadi `BLOCKING` (§1.11.1/§1.11.4) dengan ralat balik ke
   ARCHITECTURE §12.6; klaim "`G-04` dosen tidak punya tabel" tidak lagi diulang sebagai temuan
   karena `lecturers` ber-DDL di DATA_MODEL §11.3 (`RD-45`). **Yang belum ditutup dan bukan wewenang
   dokumen ini:** DDL & nomor migrasi (DATA_MODEL), `format_nim` di ARCHITECTURE §12.6, contoh `SEMANTIC`
   untuk SKS di ARCHITECTURE §12.6, dan baris `docs/INTEGRATION_SPEC.md` — berkas itu **tidak pernah
   ada**; seluruh spesifikasi gugus ini tinggal di file yang sedang dibaca.

### 1.16 Pengiriman data sesuai modus pembelajaran (`sifat_pembelajaran` / `F`·`O`·`M`)

Kosakata modus **tidak diputuskan di sini**: `learning_modality` = `ONSITE | ONLINE | BLENDED` dan
`session_kind` = `REGULAR | SYNC_LIVE | ASYNC_MODULE | PRAKTIKUM | UTS | UAS | SUSULAN` adalah milik
[DATA_MODEL §21.4](file:///c:/SICA/docs/DATA_MODEL.md) (`0049_system_parameters.sql`, **belum dieksekusi**).
Bagian ini menjawab satu pertanyaan yang belum pernah ditulis di dokumen mana pun: **bagaimana modus itu
naik ke Feeder**, karena Feeder tidak mengenal `BLENDED` sebagai kata — ia mengenal satu kode kamus per
kelas/riwayat pembelajaran.

#### 1.16.1 Jalur nilai: kamus dulu, payload kemudian

| Lapis | Isi | Aturan |
|---|---|---|
| Sumber lokal | `classes.learning_modality` (kolom `text + CHECK` kelas A′) dan `class_sessions.session_kind` per pertemuan | kolom **belum ada di kode**: yang terukur hari ini hanyalah `classes.delivery_mode` (`ONSITE \| ONLINE_SYNC \| ONLINE_ASYNC`) dan `class_sessions.delivery_type` (`ONSITE \| SYNC_LIVE \| ASYNC_MODULE`) di `packages/database/src/schema/classes.ts:89` dan `:173` — keduanya **alias yang dilepas** (§21.4), jadi pembacaan payload saat ini belum punya sumber sah |
| Peta nilai | `pddikti_mappings (kind='VALUE', entity='sifat_pembelajaran')` → `local_code` (`ONSITE`/`ONLINE`/`BLENDED`) ↔ `feeder_code` (`F`/`O`/`M`) | **tidak dikarang.** `feeder_code` hanya boleh terisi dari `reference_dictionary_entries` hasil `Get*` (`source='SYNC'` + `verified_at`), mengikuti §1.2 aturan 1 dan §1.4(n). Penanda **`[VERIFIKASI-KAMUS]`** menempel di setiap baris peta sampai kamusnya di-seed |
| Kolom payload | `feeder_sifat_pembelajaran` pada baris KELAS / pembelajaran | namanya milik DATA_MODEL (§21.4); **tidak ada kolom itu di `pddikti_staging_kelas` hari ini** (§16.4.3) → permintaannya masuk §1.5.4 daftar (2) dan tidak boleh ditulis kode sebelum ada |
| Gerbang kirim | kamus belum di-*seed* → `feeder_sifat_pembelajaran` **NULL** → baris **tidak ikut kirim** | invariance **I-14** + aturan `NOT_IMPLEMENTED` §1.6.1 butir 5: domain KELAS/KRS_AKM yang menuntut kolom ini berhenti dengan temuan, bukan dengan kode yang ditebak. Ini persis keadaan yang berlaku **sekarang**, dan harus diucapkan sebagai keadaan blocking, bukan roadmap |

**Larangan yang membuat bagian ini tidak bisa disalahgunakan.** Tidak ada `CASE WHEN learning_modality =
'BLENDED' THEN 'M'` di dalam packer. Pemetaan `BLENDED → M` tampak masuk akal secara bahasa dan tetap
salah secara regulasi kalau pusat memakai digit, bukan huruf, atau memakai kamus lain. Bentuknya wajib
baris `pddikti_mappings`, supaya drift kamus pusat terlihat sebagai **data** (temuan
`FEEDER_DICTIONARY_STALE`), bukan sebagai bug yang baru muncul saat penolakan CHECKPOINT.

#### 1.16.2 Kelas `BLENDED`: satu payload, bukti per sesi

| Pertanyaan | Jawaban | Kenapa |
|---|---|---|
| Satu kelas `BLENDED` menghasilkan berapa payload KELAS? | **satu** — `record_key = KELAS:<classes.id>:core`; modus adalah atribut kelas, bukan kelas berbeda | `UNIQUE (tenant_id, run_id, record_key)` (§16.4.3) dan urutan induk-sebelum-anak §1.12.3 mengandaikan satu baris per kelas |
| Lalu `SYNC_LIVE` vs `REGULAR` di dalam kelas yang sama? | **tidak ikut payload KELAS.** Ia tinggal di `class_sessions.session_kind` dan menjadi bahan perhitungan kehadiran (§5.2) | Feeder melapor **kelas & AKM per periode**, bukan kehadiran per individu (§1.4(c) butir 2). Mengirim `session_kind` = mengarang objek yang tidak ada |
| Kode mana yang dipilih untuk kelas campuran? | Hanya ada **bila** kamus punya entri untuk "campuran" (`M` dalam narasi publik; **`[VERIFIKASI-KAMUS]`**). Bila kamus hanya mengenal dua nilai, kelas `BLENDED` **tidak dikirim** dengan alasan `FEEDER_DICTIONARY_STALE`/`FEEDER_SOURCE_NOT_IMPLEMENTED` — bukan dipaksa menjadi `F` | Dua pilihan keliru yang biasa terjadi: memaksa `F` (menghapus kuliah daring dari laporan nasional) atau mengirim `NULL` sebagai `''` (ditolak pusat). Yang sah: diam + temuan |
| Bukti yang dipilih untuk modus campuran? | `attendance_evidence` per sesi (`LMS_ACTIVITY` / `WEBHOOK_EVENT` / `QR` / `GEOFENCE`) dan **satu** baris `attendances` per (sesi, mahasiswa); rekonsiliasinya kebijakan §21.5 (lihat §5.4) | §21.4/§21.5: `attendances` tetap satu baris apa pun kebijakannya; bukti tidak pernah menjadi kolom kedua |

#### 1.16.3 Penahan untuk `modPkk` dan `idPembelajaran`

Nama field ini **beredar di repo integrator pihak ketiga** (`[PIHAK-KETIGA]`), bukan di User Guide yang
kita punya, dan belum pernah terdokumentasi dari sumber resmi. Karena itu statusnya **penahan**
(*placeholder*), bukan asumsi:

1. Tidak ada satu pun baris `pddikti_mappings (kind='FIELD')` yang memuat `modPkk`/`idPembelajaran`
   sampai aksinya terbukti ada di sandbox (`GetDictionary, fungsi=Insert…`, §1.4(b)) atau di User Guide.
2. Tidak ada kolom SICA yang dibuat untuknya. Menambah `ALTER TABLE … ADD COLUMN mod_pkk` hari ini =
   membuat skema untuk field yang belum tentu ada (pola `RD-32`).
3. Packer **tidak boleh** mengirim kunci apa pun yang tidak ada di `canonical_payload` hasil proyeksi
   `kind='FIELD'` (§1.5.2 butir 1). Kalau nanti aksinya terbukti, urutannya: daftar di §1.2 tabel B/C
   → baris `pddikti_mappings kind='FIELD'` → DDL oleh DATA_MODEL → baru payload.
4. Yang **boleh** dinyatakan sekarang: bila `idPembelajaran` ternyata adalah id entitas pembelajaran di
   pusat, maka ia tunduk I-14 — id hanya masuk dari `pddikti_payload_snapshots.feeder_id_returned`
   (§1.5.4), tidak pernah dari kalkulasi lokal.

#### 1.16.4 Delta ke "Objek × Checkpoint" (§1.4(i)) karena gugus modus

Baris baru yang harus dibaca bersama matriks §1.4(i); **kolom final adalah milik DATA_MODEL**, dokumen
ini hanya menunjuk kebutuhannya:

| Objek | Checkpoint | Yang dibutuhkan sebagai kolom sumber | Status hari ini | Temuan yang menahan |
|---|---|---|---|---|
| Modus pembelajaran kelas (`sifat_pembelajaran`) | CP1 (KELAS) + CP2 (AKM ikut jejaknya) | `classes.learning_modality`, `class_sessions.session_kind`, peta nilai `entity='sifat_pembelajaran'` | kolom **belum ada** (`0049` belum dieksekusi); peta nilai **kosong** → `[VERIFIKASI-KAMUS]` | `FEEDER_DICTIONARY_STALE`, `FEEDER_SOURCE_NOT_IMPLEMENTED` `[USUL]` (didaftarkan §1.6.3 catatan 1) — keduanya menahan, tidak melewatkan |
| Kehadiran sebagai dasar nilai | CP2 (NILAI) | `attendance_evidence` (`0049`) + `attendances.source` dua nilai baru (`LMS_ACTIVITY`, `WEBHOOK_EVENT`) | `class_sessions.status`/`HELD` **tidak ada** → penyebut rasio tidak terdefinisi (BENCH-57) | `FEEDER_PRESENCE_MINIMUM` `[USUL]` + vonis §5.4; `NOT_IMPLEMENTED` sampai kolomnya ada |

Baris-baris ini **tidak mengubah** checkpoint mana pun di §1.4(h)/(i): CP1 tetap ≤ 2 bulan setelah kuliah
mulai, CP2 tetap ≤ 2 bulan setelah kuliah selesai. Yang berubah hanyalah bahwa sebagian domain sekarang
punya alasan baru untuk **tidak dikirim** — dan itu harus muncul di panel Kesehatan Data, bukan di log
worker.

### 1.17 Catatan pemeliharaan §1.16 (modus pembelajaran)

1. §1.16 **bukan** pemilik kosakata. Ia pemilik pertanyaan "naik ke Feeder bagaimana". Ganti nilai
   `F/O/M` = ganti baris `pddikti_mappings` + `reference_dictionary_entries` (data), bukan ganti kode.
2. Setiap kali kamus pusat bertambah, `reference_dictionary_versions` baru wajib memicu evaluasi ulang
   aturan (ARCHITECTURE §12.6 kalimat penutup), bukan rilis kode.
3. Daftar tunggu khusus gugus ini: eksekusi `0049` (kolom modus + `attendance_evidence` + dua nilai
   `attendance_source`), seed `reference_dictionary_entries` untuk `sifat_pembelajaran`, registrasi
   kolom payload oleh DATA_MODEL, dan verifikasi sandbox atas `modPkk`/`idPembelajaran`.

---

## 2. Integrasi Payment Gateway (Midtrans & Xendit)

SICA mengadopsi integrasi multi-gateway (Midtrans Core API & Xendit Invoice) untuk pembayaran Uang Kuliah Tunggal (UKT), Formulir PMB, dan Wisuda melalui Virtual Account (BCA, Mandiri, BNI, BRI) serta QRIS Dinamis.

### 2.1 Alur Transaksi & Validasi Webhook Idempotent

```
[Mahasiswa] ── Bayar VA ──> [Bank / ATM] ── Callback ──> [Payment Gateway]
                                                               │
                                                       POST Webhook Event
                                                               │
                                                               ▼
                                                    ┌────────────────────┐
                                                    │ SICA API Handlers  │
                                                    │ Verify Signature   │
                                                    └────────────────────┘
                                                               │
                                                   Atomic DB Transaction
                                                               │
                                           ┌───────────────────┴───────────────────┐
                                           ▼                                       ▼
                                ┌─────────────────────┐                 ┌─────────────────────┐
                                │ Invoices (PAID)     │                 │ Double-Entry Ledger │
                                │ & Unlock Akademik   │                 │ (Jurnal Kas / Bank) │
                                └─────────────────────┘                 └─────────────────────┘
```

### 2.2 Verifikasi Keamanan Signature Webhook

Setiap request callback yang masuk ke `/api/v1/payments/webhook/:gateway` WAJIB diverifikasi keabsahan signature-nya sebelum membaca body payload:

```typescript
// Midtrans Signature Check: SHA512(order_id + status_code + gross_amount + ServerKey)
import crypto from 'crypto';

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureReceived: string,
  serverKey: string
): boolean {
  const payload = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const computedSignature = crypto.createHash('sha512').update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(signatureReceived));
}
```

### 2.3 Handler Mutasi Database Atomik & Auto-Reconcile Ledger

```typescript
import { db } from '@/database';
import { invoices, payments, ledger } from '@/database/schema';
import { eq, sql } from 'drizzle-orm';

export async function processPaymentWebhookSuccess(event: {
  tenantId: string;
  invoiceId: string;
  gatewayTransactionId: string;
  amount: bigint;
  paymentMethod: string;
  paidAt: Date;
}) {
  return await db.transaction(async (tx) => {
    // 1. Kunci baris invoice menggunakan SELECT ... FOR UPDATE (Concurrency Protection)
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, event.invoiceId))
      .for('update');

    if (!invoice) throw new Error('INVOICE_NOT_FOUND');
    if (invoice.status === 'PAID') return { alreadyProcessed: true }; // Idempotent check

    // 2. Update status invoice menjadi LUNAS (PAID).
    //    ⚑ `invoices.status` dan `paid_amount` adalah **SERVER_ONLY** (DATA_MODEL §14.9): hanya
    //    transisi ini yang boleh menuliskannya, tidak pernah lewat body PATCH.
    await tx.update(invoices).set({
      status: 'PAID',
      paidAmount: event.amount,          // kolom kanonik: `invoices.paid_amount` (bekas `paid_rupiah`)
      updatedAt: new Date()
    }).where(eq(invoices.id, invoice.id));

    // 3. Catat rekaman pembayaran riil — kolom mengikuti `payments` di DATA_MODEL §5
    //    (diralat 2026-10-19 — RD-07/RD-08/K-14: nama-nama di bawah adalah satu-satunya yang sah)
    await tx.insert(payments).values({
      tenantId: event.tenantId,
      invoiceId: invoice.id,
      channelId: invoice.channelId,                // ⚑ FK `payment_channels` (0015); bekas `provider`
      method: event.paymentMethod,                 // 'VA' | 'QRIS' | 'BILL' | 'MANUAL' | 'TELLER'
      externalRef: event.gatewayTransactionId,     // ⚑ kunci idempotensi; bekas `provider_ref`/
                                                   //   `vendor_transaction_id` — keduanya dilepas
      amountRupiah: event.amount,
      status: 'SETTLED',
      paidAt: event.paidAt,                        // waktu uang masuk (bukan waktu rekonsiliasi)
      idempotencyKey: event.gatewayTransactionId
    });

    // 4. Posting ke Double-Entry General Ledger (Kas Debit, Piutang Kredit).
    //    ⚑ Tabel = `ledger` (bukan `financialLedger`); kolom = `account_code`, `debit`, `credit`,
    //    `invoice_id`, `entry_group_id`. **Dua baris satu group = satu jurnal** dan harus balance
    //    (AC-KEU-3); `ledger.invoice_id` nullable agar jurnal non-piutang mungkin (BENCH-31).
    const entryGroupId = crypto.randomUUID();
    await tx.insert(ledger).values([
      {
        tenantId: event.tenantId,
        entryGroupId,
        invoiceId: invoice.id,
        accountCode: '1101-KAS-BANK',              // ⚑ harus ada di `accounts` (chart of accounts)
        debit: event.amount,
        credit: 0n,
        reason: `Penerimaan Pembayaran VA Invoice #${invoice.number}`
      },
      {
        tenantId: event.tenantId,
        entryGroupId,
        invoiceId: invoice.id,
        accountCode: '1103-PIUTANG-MAHASISWA',
        debit: 0n,
        credit: event.amount,
        reason: `Pelunasan Piutang Akademik Invoice #${invoice.number}`
      }
    ]);

    // 5. Lepas cekal keuangan — BUKAN hapus baris (riwayat penahan harus tersisa)
    //    Skema kanonik: DATA_MODEL §5 `blockades(dimension, blocks, lifted_by, lifted_at, lift_reason)`.
    //    Kolomnya kini `dimension` (bukan `kind`) dengan nilai 'FINANCE' — disamakan dengan
    //    `clearances.dimension` (diralat 2026-10-19 — K-11/BENCH-103); penlepasan mencatat actor + alasan.
    await tx.execute(sql`
      UPDATE blockades
      SET lifted_by = ${ctx.actorId},
          lifted_at = now(),
          lift_reason = 'AUTO_SETTLED_BY_PAYMENT'
      WHERE student_id = ${invoice.studentId}
        AND tenant_id = ${ctx.tenantId}
        AND dimension = 'FINANCE'
        AND source_id = ${invoice.id}
        AND lifted_at IS NULL
    `);

    return { success: true };
  });
}
```

**Dua hal yang belum selesai di jalur ini (dicatat agar tidak dianggap sudah benar):**
1. **Lepas-cekal otomatis vs CHECK empat-mata.** `blockades` punya `CHECK (lifted_by IS NULL OR lifted_by <> imposed_by)` ([DATA_MODEL §5](file:///c:/SICA/docs/DATA_MODEL.md)). Rekonsiliasi otomatis akan menabrak constraint ini bila `imposed_by` adalah akun sistem yang sama. Keputusannya: cekal keuangan yang **dibuat otomatis** oleh engine tagihan memakai actor sintetis `system:billing`, sedangkan pelepasan otomatis memakai `system:reconciliation` — dua identitas berbeda sehingga constraint tetap bermakna; pelepasan **manual** tetap wajib orang berbeda dari penaruh cekal.
2. **Proyeksi `ctx.actorId` di jalur webhook.** Webhook tidak punya user; actor harus diambil dari kanal yang terdaftar (`payment_channels.created_by` / sistem), bukan `null`, supaya `audit_logs` tidak kehilangan pelaku.

### 2.4 Objek rekonsiliasi yang diminta cetak biru enterprise (2026-10-19)
Rujukan: [BLUEPRINT §4.4](file:///c:/SICA/docs/BLUEPRINT_ENTERPRISE.md) (field) dan §5 **SM-3** (state machine invoice + pembayaran + ledger + gerbang). Yang selama ini tersirat di §2.1–§2.3 kini menjadi objek eksplisit:

| Objek | Peran dalam alur | Kolom penentu | State SM-3 |
|---|---|---|---|
| `payment_channels` | satu baris per kanal (Midtrans VA, Xendit VA, QRIS, manual teller) + kredensial referensinya | `kind` (VA_BANK/QRIS/BILL/MANUAL/TELLER), `provider`, `bank_code`, `va_pattern`, `fee_pct`, `webhook_secret_ref`, `settlement_cutoff_time`, `is_active` | sumber transisi `INITIATED→PENDING→SETTLED` |
| `payments` | satu usaha bayar; idempoten pada id transaksi vendor | `invoice_id`, `channel_id`, `method`, `amount_rupiah`, `status payment_status`, **`external_ref`** (UNIQUE per tenant+kanal; bekas nama `provider_ref`/`vendor_transaction_id` — **dilepas**, lihat §2.3), `paid_at`, `settled_at`, `recorded_by`, **`verified_by`** | `SETTLED` memicu ledger + buka gerbang |
| `virtual_accounts` | VA adalah objek ber-nyawa: dibuat → dipakai → dibatalkan → kedaluwarsa | `channel_id`, `bank_code`, **`va_number` UNIQUE global per bank** (BENCH-34: prefix bisa bertabrakan antar-tenant), `invoice_id`, `issued_at`, `expires_at`, `status ISSUED / USED / CANCELLED / EXPIRED`, `cancelled_by` | sub-state SM-3; pembayaran lewat jatuh tempo → `EXPIRED`, **tidak pernah** auto-`PAID` (BENCH-23) |
| `payment_windows` | sumber preseden satu-satunya untuk `due_at` (default tenant → prodi → angkatan → jalur) | `program_id`, `entry_year_from/to`, `default_due_days`, `cutoff_time`, `penalty_mode` | menahan `OVERDUE` & denda (BENCH-21/28) |
| `payment_allocations` | satu transfer untuk banyak invoice; overpay → sisa jadi deposit | `payment_id`, `invoice_id`, `installment_id`, `amount`, `priority` (denda → pokok) dengan `SUM(alokasi) = payments.amount_rupiah` | menyalakan gerbang hanya bila tagihan yang disyaratkan teralokasi (BENCH-24/26) |
| `receipts` | kuitansi bernomor + dapat diverifikasi & dibatalkan | `tenant_id`, `number` (urut per tenant), `invoice_id`, `issued_at`, `digest_sha256`, `void_of_receipt_id` | cetak ulang & status pasca-void (BENCH-33) |
| `reconciliation_runs` | proses pencocokan batch (auto) dan penyelesaian selisih (manual) | `channel_id`, `period`, `rows_gateway`, `rows_matched`, `rows_suspense`, `started/finished_at`, `status` | `MATCHED` / `SUSPENSE` / `REFUND_ISSUED` |
| `payment_plans` | cicilan/termin turunan invoice (tetap **satu konsep** dengan `invoice_installments` — rename + backfill wajib sebelum 0015) | `parent_invoice_id`, `installments jsonb`, `late_fee_rule`, `status` | gerbang akademik mengikuti induk (AC-KEU-5) |

**Aturan penegakan (bukan saran):**
- **Tiga jalur masuk dana** (`webhook`, `pull status`, `manual teller`) **wajib** bertemu di satu fungsi penulisan ledger; duplikasi terserap oleh `UNIQUE (tenant_id, channel_id, external_ref)` dan `idempotency_keys` — lihat `AC-KEU-1` (3 callback bersamaan → tepat 1 baris ledger **group**, yaitu 2 baris balance). Kolom kunci itu dahulu bernama `vendor_transaction_id`; ejaan itu **dilepas** (diralat 2026-10-19 — `RD-08`).
- **Tidak ada `SETTLED` tanpa ledger.** Perpindahan status pembayaran dan penulisan `ledger` + pelepasan cekal berada di **satu transaksi**; kegagalan salah satu me-rollback semuanya (NFR-U1).
- **Ledger hanya `INSERT`.** `REVOKE UPDATE, DELETE, TRUNCATE ON ledger FROM sica_app` (DATA_MODEL §6.3); void/koreksi = baris baru ber-`reverses_entry_id` (I-4), bukan pembalikan nominal manual.
- **VA punya nyawa.** `virtual_accounts` bertransisi `ISSUED → USED / CANCELLED / EXPIRED`; job sweep menandai `EXPIRED` saat `expires_at` lewat, dan pembayaran yang datang **setelah** itu masuk `SUSPENSE` (bukan auto-lunas, BENCH-23). Pembatalan bayar hanya untuk kanal `MANUAL`/`TELLER` (`channel.kind`), sisanya lewat `REFUND` API vendor (BENCH-25).
- **Cekal keuangan ikut kedaluwarsa.** `blockades.expires_at` (DATA_MODEL §5) disapu job yang sama: baris aktif yang lewat `expires_at` di-`lift` dengan `lift_reason='EXPIRED'` — tanpa sweep, `expires_at` hanya hiasan (BENCH-29).
- **Suspense tidak pernah diam-diam jadi lunas.** Baris `reconciliation_runs` berstatus `SUSPENSE` menahan penutupan buku periode sampai diselesaikan (match / refund / koreksi manual), dan penyelesaiannya adalah aksi `VALIDATE` (`TREASURER`), bukan `UPDATE` bebas.
- **Rekonsiliasi membaca Primary.** Hasil `SETTLED` dibaca kembali untuk menampilkan status ke mahasiswa/kasir → **read-your-writes**, jadi wajib ke Primary (AGENTS §3.7), bukan replica.
- **Bukan jalur Feeder.** Tidak ada objek tagihan/presensi/ruang di Neo Feeder ([DATA_MODEL §14.5 aturan 5](file:///c:/SICA/docs/DATA_MODEL.md)); yang naik hanya status AKM, pembiayaan (indikator kemampuan bayar), dan hasil belajar.

---

## 3. Integrasi Messaging Gateway (WhatsApp & Email)

SICA menggunakan background job queue **BullMQ** (Redis-backed) untuk mengirimkan notifikasi tanpa membebani latensi HTTP API:
- **WhatsApp Gateway:** Fonnte API / Gupshup WhatsApp Business API
- **Transactional Email:** Resend API / AWS SES

### 3.1 Arsitektur Antrean (Queue System)

```typescript
import { Queue, Worker } from 'bullmq';
import { redisConnection } from '@/lib/redis';

export const notificationQueue = new Queue('sica-notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000 // Retry: 5s, 10s, 20s, 40s, 80s
    },
    removeOnComplete: 1000,
    removeOnFail: 5000
  }
});
```

### 3.2 Katalog Jenis Notifikasi & Template

| Tipe Notifikasi | Saluran (*Channel*) | Prioritas | Trigger Kejadian |
| :--- | :---: | :---: | :--- |
| `OTP_LOGIN` | WhatsApp & Email | **High (P0)** | Percobaan login akun dengan proteksi MFA aktif |
| `INVOICE_GENERATED` | WhatsApp & Email | Normal (P1) | Penerbitan tagihan UKT baru semester ganjil/genap |
| `PAYMENT_RECEIPT` | WhatsApp & Email | Normal (P1) | Berhasil verifikasi pelunasan VA atau QRIS |
| `KRS_APPROVED` | WhatsApp & Push App | Normal (P2) | Dosen Pembimbing menyetujui rencana studi mahasiswa |
| `CLASS_SCHEDULE_REMINDER` | Push App & WhatsApp | Normal (P2) | Pengingat H-1 jam sebelum perkuliahan dimulai |

---

## 4. Integrasi Object Storage (Cloudflare R2 & AWS S3)

Penyimpanan berkas biner (Foto Profil, Bukti Pembayaran, Berkas Skripsi, Dokumen Ijazah & Transkrip PDF) menggunakan S3-Compatible Storage dengan skema **Pre-Signed URL** langsung dari client ke object storage (tanpa membebani buffer memory Next.js server).

### 4.1 Diagram Alur Unggah Berkas Pre-Signed URL

```
[Client Web/Mobile] ──── 1. Minta Pre-Signed URL ────> [Next.js API]
                                                            │
                                                   Validasi Ekstensi & Ukuran
                                                            │
[Client Web/Mobile] <── 2. Kirim URL PUT (TTL 5m) ──────────┘
        │
   3. Direct HTTP PUT Binary
        │
        ▼
┌─────────────────────────┐
│ Cloudflare R2 / AWS S3  │
└─────────────────────────┘
        │
   4. Sukses (200 OK)
        │
        ▼
[Client Web/Mobile] ──── 5. Konfirmasi Simpan Metadata ──> [Next.js API]
```

### 4.2 Generator Pre-Signed URL (AWS SDK v3 S3 Client)

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.STORAGE_ENDPOINT, // e.g. https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!
  }
});

// Aturan Upload Ketat
const ALLOWED_MIME_TYPES: Record<string, { maxSize: number; allowedExts: string[] }> = {
  avatar: { maxSize: 2 * 1024 * 1024, allowedExts: ['image/jpeg', 'image/png', 'image/webp'] },
  assignment: { maxSize: 25 * 1024 * 1024, allowedExts: ['application/pdf', 'application/zip'] },
  diploma_archive: { maxSize: 10 * 1024 * 1024, allowedExts: ['application/pdf'] }
};

export async function generateUploadPresignedUrl(params: {
  tenantId: string;
  category: 'avatar' | 'assignment' | 'diploma_archive';
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
}) {
  const policy = ALLOWED_MIME_TYPES[params.category];
  if (!policy) throw new Error('INVALID_UPLOAD_CATEGORY');

  if (!policy.allowedExts.includes(params.fileType)) {
    throw new Error(`FILE_TYPE_NOT_ALLOWED: Hanya menerima ${policy.allowedExts.join(', ')}`);
  }

  if (params.fileSizeBytes > policy.maxSize) {
    throw new Error(`FILE_TOO_LARGE: Batas ukuran maksimal ${policy.maxSize / (1024 * 1024)}MB`);
  }

  // Pola path terisolasi per tenant
  const storageKey = `tenants/${params.tenantId}/${params.category}/${Date.now()}-${params.fileName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.STORAGE_BUCKET_NAME,
    Key: storageKey,
    ContentType: params.fileType
  });

  // URL berlaku tepat 5 menit (300 detik)
  const presignedPutUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

  return {
    uploadUrl: presignedPutUrl,
    storageKey,
    expiresInSeconds: 300
  };
}
```

---

## 5. Kehadiran Daring: LMS, Konferensi, dan Rekonsiliasi Multi-Sumber — 2026-10-20

**Status gugus: kontrak/design-only, bukan bukti presensi vendor deployed.** Inventaris 18 rute/7 migrasi/nol skema pada 2026-10-20 adalah snapshot lama, bukan keadaan Fase 1 terkini; `0049` kini sudah berberkas. Ketersediaan migrasi/parameter tidak membuktikan eksekusi DB atau konsumen presensi. Alias lama mengikuti pemetaan kanonik DATA_MODEL, bukan kontrak baru. `bullmq`/`ioredis` absen manifest; uji adapter, signature, mapping peserta dan interval tetap dibutuhkan. Sinkronisasi ini tidak menjalankan DB/worker atau sandbox vendor.

### 5.1 Kepemilikan rujukan (norma tidak diputuskan dua kali)

| Yang dibutuhkan pembaca | Pemiliknya | Peran §5 |
|---|---|---|
| Kosakata modus & sesi (`learning_modality`, `session_kind`), objek `attendance_evidence`, enum `attendance_source` + `LMS_ACTIVITY`/`WEBHOOK_EVENT`, `CHECK`/indeks | [DATA_MODEL §21.4/§21.5/§21.6](file:///c:/SICA/docs/DATA_MODEL.md) → `0049` | pemakai nama; **tidak** membuat tabel atau kolom tandingan |
| Path, skema Zod peristiwa, bentuk respons, kode error permukaan presensi multi-modus | [API_SPEC §4.18](file:///c:/SICA/docs/API_SPEC.md) | **tabel vonis §5.4 di bawah identik dengan API_SPEC §4.18**; yang ditulis di sini adalah **mekanika sisi integrasi** (bagaimana peristiwa sampai ke sana), bukan kontrak wire kedua |
| Norma nol-API-key, nol-egress PII, kredensial di vault/ENV | `AGENTS §3.9` + DATA_MODEL §21.6 + `SECURITY_COMPLIANCE` §7 | penjabaran per provider (§5.5); **tidak** melonggarkan |
| Antrean, `concurrency`, limiter, `attempts`, backoff, DLQ untuk `attendance.event.ingest` | [ARCHITECTURE §10.4.1](file:///c:/SICA/docs/ARCHITECTURE.md) | **cross-reference saja** — sama seperti §1.12.6, angka tidak diputuskan di sini |
| Baca parameter saat runtime (`attendance.online_min_join_ratio`, `attendance.multi_source_policy`, `finance.webhook_max_clock_skew_s`) | API_SPEC §4.16 (mesin parameter) + DATA_MODEL §21.3 nomor 6/23/24 | pemakai; nilai dibaca dari `master_system_parameters`, **tidak** ditulis sebagai konstanta di adapter |
| Kode izin aksi | `RBAC_MATRIX` §4/§4.5 | **tidak ada kode baru di sini**; §5.6 mendaftar yang masih belum ada sebagai tagihan |
| Presensi luring (QR berotasi, geofence, tantangan, banding) | API_SPEC §4.3.6–§4.3.9 + §6.10.6 (ALG-12) | tidak disentuh; §5 hanya menambah jalur **daring** dan cara keduanya bertemu |

### 5.2 Spesifikasi peristiwa kehadiran daring

Peristiwa **dihasilkan di sisi SICA** (kanal internal) atau **diserahkan vendor lewat webhook bertanda
tangan** (kanal pendukung). Bentuk wire-nya milik API_SPEC §4.18.2/§4.18.3; yang dispesifikasi di sini
adalah semantik dan penahan di jalur integrasi.

| Peristiwa | Pengirim | Isyarat yang benar | Yang tidak boleh dilakukan |
|---|---|---|---|
| `JOIN` | adapter kanal internal (ruang BBB/Jitsi milik kampus) | menandai **awal** satu interval kehadiran; `occurred_at` = waktu server tempat peristiwa dicatat, bukan waktu perangkat | membuka interval dari `JOIN` yang datang **setelah** sesi ditutup (lihat jendela §5.3); memakai waktu `occurredAt` klien sebagai dasar urutan |
| `LEAVE` | adapter kanal internal | **menutup** interval terakhir; interval tanpa `LEAVE` ditutup oleh `session_close` atau oleh celah heartbeat | memaksa `LEAVE` sintetis saat koneksi putus-putus tanpa celah (itu menghitung durasi yang tidak terjadi) |
| `HEARTBEAT` | adapter + klien ruang kelas (interval **60 detik** tetap, bukan "sekitar 1 menit") | bukti bahwa peserta **masih ada**: satu heartbeat menghidupkan kembali jendela durasi sampai `heartbeat + toleransi` | mengirim heartbeat lebih cepat untuk menaikkan durasi — ditolak oleh dedup per jendela (5.3) sehingga tidak ada gunanya; dan larangan `JOIN` tanpa heartbeat sama sekali (tab browser terbuka = bukan kehadiran) |
| `SUMMARY` | kanal internal (ringkasan sesi) | klaim agregat yang **dihitung ulang** server; selisih dengan hitungan server dikirim sebagai `discrepancy` | menerima rasio dari kanal sebagai vonis (API_SPEC §4.18 butir 3) |
| Vendor `meeting_started` / `participant_joined` / `participant_left` / `meeting_ended` | webhook Zoom/Meet/Teams **bila kampus berlangganan** | hanya mengisi `attendance_evidence(source='WEBHOOK_EVENT')` dengan `vendor`, `credential_ref`, `event_digest`; payload dibatasi `{event, userRef, duration, sessionId}` | menjadi satu-satunya dasar `PRESENT`; membawa nama peserta, email, transkrip, rekaman, atau isi pertemuan masuk ke SICA (egress/PII — §5.5) |

**Lima penahan jalur (menyerupai pola §1.5, karena ancaman yang dihadapi sama: bukti yang hilang atau
tergandakan).**

1. **Ingest adalah `INSERT` belaka.** Tidak ada rute peristiwa yang melakukan `UPDATE attendances`;
   vonis dihitung pada **penutupan sesi** oleh worker (batch flush per `AGENTS §3.7`), idempoten per
   `(sesi, mahasiswa)`. Ini yang membuat ratusan peristiwa per sesi tidak berubah menjadi ratusan
   operasi tulis pada baris yang sama.
2. **Jam server satu-satunya jam yang dipakai.** Selisih `occurredAt` klien/vendor terhadap waktu server
   yang melebihi `finance.webhook_max_clock_skew_s` (baku **300 detik**, rentang atas 300; pemiliknya
   DATA_MODEL §21.3 nomor 6) = peristiwa **diabaikan dengan ACK**, tidak disimpan, tidak memvonis.
   Catatan kejujuran: kunci parameter itu berawalan `finance.` karena ia lahir untuk webhook pembayaran
   dan **dipakai ulang** oleh DATA_MODEL §21.6 untuk webhook kehadiran. Pemindahan ke
   `attendance.webhook_max_clock_skew_s` adalah keputusan DATA_MODEL, bukan keputusan bagian ini —
   sampai dipindah, dua gugus membaca satu angka, dan itu harus terlihat sebagai satu sumber.
3. **Antrean target.** Tabel/worker DB-backed perlu bukti implementasi dan uji crash/failover sendiri;
   `bullmq`/`ioredis` **design-only** (`RD-11`, `P-6`), bukan dependensi deployed. Rate limiter/retry
   mengikuti ARCHITECTURE §10.4.1. Targetnya exactly-once effect lewat idempotensi, bukan delivery.
4. **Batch flush, bukan baris-per-peristiwa.** Sesi 200 peserta × heartbeat 60 detik selama 100 menit =
   ±20 ribu peristiwa per sesi. Menuliskannya satu per satu ke `attendance_evidence` melanggar semangat
   §3.7; yang dituliskan adalah **interval hasil agregasi** (satu baris per `(sesi, mahasiswa, sumber,
   jendela)`), dan peristiwa mentah hanya lewat di buffer worker, tidak menjadi tabel kedelapan.
5. **Larangan `SELECT … FOR UPDATE` per peristiwa.** Penahan duplikasi adalah `UNIQUE` (§5.3),
   bukan kunci baris — persis alasan §3.7 menolak decrement kuota per-request di jalur panas.

### 5.3 Jendela sesi, rasio durasi, dan idempotensi

**Jendela perhitungan.** Rasio dihitung terhadap **durasi sesi yang terjadwal**, bukan terhadap durasi
ruang vendor. Sumbernya, berurutan dan fallback-nya harus terbaca:

| Urutan | Sumber jendela | Status hari ini | Kalau tidak ada |
|---|---|---|---|
| 1 | `class_sessions` dengan waktu mulai/selesai eksplisit | **tidak ada kolomnya**: yang nyata hanyalah `held_on` (date), `seq`, `duration_minutes` (baku 100), `is_attendance_open`, `virtual_room_url` (`packages/database/src/schema/classes.ts:162-182`) | jatuh ke 2 |
| 2 | `class_schedules.start_time`/`end_time` + `day_of_week` yang cocok dengan `class_sessions.held_on` | **ada di kode** (`classes.ts:129-146`) — tetapi pemetaan hari-jam ke tanggal dikerjakan di pemakai, bukan di skema | jatuh ke 3 |
| 3 | `duration_minutes` saja (mulai tidak diketahui) | ada, tetapi **tidak dapat** menghasilkan `ratio` yang jujur | **vonis ditahan**: tidak ada baris `attendances` yang dibuat dari bukti daring saja, dan temuan `EVIDENCE_INSUFFICIENT` (API_SPEC §2.3 baris 117) dilaporkan sebagai sebab |

Permintaan kolomnya (waktu mulai/selesai sesi dan `status` sesi `HELD/BATAL`) sudah tercatat di §1.10.1
dan di BENCH-57; **nama final milik DATA_MODEL**. Sampai kolom itu ada, jalur daring tidak boleh
dijanjikan sebagai "presensi otomatis penuh" di layar mana pun.

**Rasio.**

```
W = [mulaiSesi, selesaiSesi) dari jadwal/snapshot sesi yang sah
D = durasi(W) > 0
I = interval JOIN/LEAVE atau heartbeat yang valid setelah dedup identitas peristiwa
U = union semua (I ∩ W) per peserta; overlap perangkat/sumber yang memenuhi kebijakan dihitung sekali
durasiEfektif = durasi(U)
ratioComputed = durasiEfektif / D                       # numeric, bukan float
kandidat = ratioComputed >= attendance.online_min_join_ratio
```

Mulai sebelum sesi/selesai setelah sesi **dipotong ke irisan W**, bukan membuang event pembuka lalu kehilangan interval. Data sepenuhnya di luar W tidak menambah durasi. Denominator hilang/nol/negatif, pasangan event tidak sah, gap heartbeat atau laporan vendor parsial/stale → bukti tidak cukup/degraded, bukan angka nol/penuh yang dianggap final. Penutupan pada session-close hanya sah sesuai kebijakan bukti; tidak boleh mengasumsikan hadir sepanjang gap.

Default **75% adalah kebijakan configurable berversi**, bukan angka hukum universal. Rentang mengikuti katalog kanonik DATA_MODEL/PRD, tidak dibuat ulang di sini. Kandidat rasio belum menjadi vonis: M-18 memeriksa bukti internal, aturan rekonsiliasi dan approval yang berlaku. Label daring/campuran serta kirim Feeder O/M hanya sesudah aturan kanonik dan mapping nasional tervalidasi; vendor bukan pembuat keputusan.

Angka ambang **tidak** ditulis sebagai konstanta di adapter; ia dibaca dari parameter (resolver API_SPEC
§4.16) dan **versi parameter-nya ikut tersimpan** pada hasil vonis (`parameter_version`), supaya keputusan
tahun lalu dapat direproduksi setelah kampus mengubah ambang. Aritmetika mengikuti `AGENTS §3.4`/ADR-5:
`numeric`, bukan `double` — kolom `latitude/longitude` di `attendances` hari ini `doublePrecision` dan itu
bukan preseden untuk rasio.

**`ASYNC_MODULE` tidak berbagi ambang yang sama.** DATA_MODEL §21.3 pernah mendaftarkan **satu** ambang
daring (`attendance.online_min_join_ratio` nomor 23), sementara PRD BR-A13 dan ARCHITECTURE §8.2 bicara
watch-time 80 % **tanpa kunci parameter**. Karena itu vonis sempat dibuat fail-closed: modul asinkron
hanya menulis `attendance_evidence(source='LMS_ACTIVITY')` dengan `duration_s` dan `ratio` hasil hitungan.
**Ralat 2026-10-21 (`RD-72`):** kuncinya kini terdaftar sebagai **§21.3 nomor 29**
`attendance.async_min_watch_ratio` = `0.80` (`DECIMAL`, rentang 0,50–1,00, kelas `ACADEMIC`, override per
sesi lewat `class_sessions.min_watch_pct` yang **tidak pernah** melonggarkan ambang tenant) — dan kolom itu
sendiri tidak lagi membawa `DEFAULT 80`. Menyalin 0,75 untuk watch-time tetap salah objek; membaca 0,80
dari PRD sebagai konstanta tetap yatim parameter. Kedua jalur sekarang punya rumah yang sama: **parameter**, bukan angka di adapter.

**Idempotensi dan agregasi berbeda.** Dedup identitas event vendor/source + jenis event dilakukan sebelum membentuk interval; replay key + payload sama mengembalikan hasil sama, key sama + payload berbeda → **409**. JOIN dan LEAVE berbeda dalam menit yang sama tidak boleh runtuh menjadi satu event. Bucket menit/jam dapat dipakai untuk agregasi **sesudah** interval valid dan union, bukan satu-satunya identitas dedup. Constraint/kolom final milik DATA_MODEL/API; bila kontrak lama hanya memakai `(tenant_id, session_id, student_id, source, event_window)`, rekonsiliasi tersebut **pending**, bukan alasan menghilangkan event yang berbeda. Klaim idempoten memerlukan uji replay/paralel dan dampak DB, bukan hanya nama UNIQUE.

**Dedup webhook vendor.** `event_digest` (HMAC atas payload kanonik per vendor) menahan notifikasi
kembar; penampung tautan `userRef → student` **belum ada di skema** (temuan yang sama ditulis API_SPEC
§4.18.3 butir 4). Sampai penampung itu diregistrasi DATA_MODEL, webhook vendor **hanya dapat menyimpan
`event_digest` untuk audit transport** dan **tidak dapat** menghasilkan baris kehadiran. Ini penahan
terberat di gugus ini dan tidak boleh disamarkan menjadi "tinggal pasang webhook".

### 5.4 Urutan konflik dan tabel vonis (identik dengan API_SPEC §4.18)

Kebijakan dibaca dari `attendance.multi_source_policy` (kamus `kebijakan_rekonsiliasi`, DATA_MODEL
§21.3 nomor 24, baku `ONSITE_PRIMARY`). **Tidak ada filter `policy` di permukaan klien**: pemanggil tidak
boleh memilih kebijakan (API_SPEC §4.18.4).

Urutan yang dipakai saat dua sumber menunjuk satu `(sesi, mahasiswa)`:

```
1  kunci baris: uq_attendances_session_student (satu baris, apa pun kebijakannya — DATA_MODEL §21.5)
2  baca kebijakan tenant/scope (parameter berversi; bukan label peran, bukan tebakan UI)
3  tentukan bukti otoritatif: kanal internal SICA (LMS_ACTIVITY) > bukti luring (QR/GEOFENCE) > vendor
   (WEBHOOK_EVENT) — vendor TIDAK PERNAH sendirian cukup (DATA_MODEL §21.6 butir 3)
4  hitung ratioComputed dari interval (§5.3); bandingkan dengan ambang berversi
5  belum cukup bukti -> tidak ada baris baru: tunggu / antrean banding (§4.3.8 API_SPEC), BUKAN status keenam
6  vonis ditulis worker penutupan sesi; koreksi manusia lewat aksi VALIDATE dengan alasan (bukan UPDATE bebas)
```

**Tabel vonis** — kolom dan barisnya **sama** dengan API_SPEC §4.18.4 ("Tabel keputusan kanonis");
kolom terakhir hanyalah sisi integrasi yang menjadi alasan bagian ini ada. Ditulis di sini **bukan**
sebagai sumber kebenaran kedua: bila suatu saat keduanya berbeda, **API_SPEC §4.18 yang menang** dan
bagian ini yang diralat pada commit yang sama (§5.9 butir 3).

| `attendance.multi_source_policy` | Aturan vonis | Baris `attendances` | Muatan wajib di respons (milik API_SPEC) | Yang terjadi di jalur integrasi (§5) |
|---|---|---|---|---|
| `ONSITE_PRIMARY` (baku) | bukti luring (`QR`/`GEOFENCE`) menang; bukti daring **hanya** tercatat sebagai `evidence` | **satu** | `authoritative: true` pada bukti luring; `sufficiency: "SUPPORTING_ONLY"` pada bukti daring | worker penutupan sesi tetap menulis `attendance_evidence` kanal internal/vendor — bukti tidak dibuang hanya karena ia kalah |
| `ONLINE_PRIMARY` | `ratioComputed >= attendance.online_min_join_ratio` (baku 0,75) menang; QR menjadi bukti tambahan | **satu** | `ratioComputed`, `ratioClaimed`, `discrepancy`, ambang + `version` | rasio dihitung dari interval ber-heartbeat 60 dtk (§5.3), bukan dari `durationSec` kiriman kanal |
| `MERGE_ANY` | salah satu bukti cukup; **satu** baris `attendances`, `attendances.source` mencatat gabungan (`QR+LMS`) | **satu** | daftar sumber tergabung + sumber pertama yang diterima | dua peristiwa dari dua perangkat pada satu jendela tetap **satu** baris bukti per sumber (§5.3) karena union interval, bukan tumpukan |
| `REQUIRE_BOTH` | dua bukti wajib (luring + kanal internal); satu bukti saja = **bukan** `ABSENT`, **bukan** `PRESENT` → keadaan tunggu | **satu**, dengan keadaan tunggu + banding | `pendingReview.reason` + `appealHref` (§4.3.8) | inilah keadaan paling rawan di jalur integrasi: bukti datang terlambat setelah sesi ditutup, jadi jendela toleransi tertunda (§5.3) menentukan apakah baris masih sempat lengkap |
| `STRICT_LATEST` | bukti terakhir menang — **hanya** lewat aksi `VALIDATE` dengan alasan (koreksi pengampu), tidak pernah otomatis | **satu** | `rule: "MANUAL_OVERRIDE"` + `decidedBy: <actor>` + tautan riwayat | peristiwa tertanggal-terakhir tidak pernah memindahkan vonis sendiri; hanya service `decide` yang boleh (API_SPEC §4.18.4) |

**Kontrak yang mengikat tabel di atas dan tidak boleh dibalik di kode** (identik dengan API_SPEC §4.18):
`PENDING_REVIEW` **bukan** nilai keenam `attendance_status` — ia keadaan rekonsiliasi
(`decision.status: null` + `pendingReview.*`); perluasan enum adalah milik DATA_MODEL §15. Dan
`REQUIRE_ALL`/`LMS_ONLY`/`AUTO_LATEST` yang pernah disebut di dokumen lama **tidak ada** di kamus
`kebijakan_rekonsiliasi`: mengirimnya ke parameter = `422 PARAM_ENUM_UNKNOWN`, dan server **tidak**
menambah item kamus agar nilai lolos (API_SPEC §4.18.6 butir 6, `AGENTS §3.10`).

Empat konsekuensi integrasi dari tabel di atas, yang justru jadi alasan bagian ini ada:

1. **Worker penutupan sesi adalah satu-satunya penulis `attendances` untuk jalur daring.** Ia berjalan di
   Primary (hasilnya dibaca segera setelah itu — read-your-writes, `AGENTS §3.7`), idempoten per
   `(sesi, mahasiswa)`, dan boleh diulang tanpa menghasilkan baris kedua.
2. **Bukti tidak pernah naik menjadi kolom.** Semua yang tambahan masuk `attendance_evidence(source,
   occurred_at, duration_s, ratio, digest, device_digest, vendor, credential_ref, event_digest)`
   (DATA_MODEL §21.5/§21.6) — insert-only. godaannya nyata: "satu kolom `online_ratio` saja lebih murah",
   dan itu persis pola dua sumber kebenaran (`RD-32`).
3. **Vendor report tidak pernah menjadi oracle.** Bila hanya ada `WEBHOOK_EVENT`, hasilnya **bukan**
   `PRESENT`; jalan keluarnya kanal internal atau keputusan pengampu beralasan, bukan otomatisasi
   tambahan pada vendor.
4. **Laporan peserta dari vendor tidak pernah disimpan sebagai salinan.** Yang disimpan hanya empat kunci
   payload + digest; daftar nama, email, rekaman, transkrip = **tidak masuk** (egress & retensi PII,
   `SECURITY_COMPLIANCE` §7).

### 5.5 Matriks adapter provider

Legenda kolom "egress": apa yang **boleh** meninggalkan infrastruktur kampus. Semua baris berstatus
**`design-only`**: tidak ada satu pun adapter terpasang, dan **syarat review keamanan** (`SECURITY_COMPLIANCE`
§7/§10) adalah gerbang sebelum salah satunya ditulis.

| Provider | Hosting & lisensi | Cara peristiwa masuk SICA | Kredensial | Egress yang diizinkan | Konsekuensi kalau tidak dipakai | Status |
|---|---|---|---|---|---|---|
| **BigBlueButton (BBB)** | self-host kampus / milik SICA; **tanpa biaya lisensi** | **kanal internal**: adapter memicu peristiwa `JOIN`/`LEAVE`/`HEARTBEAT` dari sisi server (sesi BBB diketahui SICA karena SICA yang membuat & memantau ruang). Nama endpoint/parameter callback BBB: **`[VERIFIKASI-VENDOR]`** — jangan dikutip sebelum diambil dari dokumentasi resmi versi target | **tidak ada kunci vendor**; hanya `credential_ref` ke shared secret **milik sendiri** di vault/ENV | **nol** — seluruh pertemuan dan datanya tetap di dalam | tidak ada jalur daring otoritatif; `ONLINE_PRIMARY` praktis mati untuk kelas `SYNC_LIVE` | `design-only`; syarat: review keamanan + uji beban heartbeat (§5.3 butir 4) |
| **Jitsi (Meet) self-host** | self-host; **tanpa biaya lisensi** | peristiwa lewat **webhook/proxy milik sendiri** (komponen sisi server yang meneruskan kehadiran ke SICA). Jitsi inti **tidak** menyediakan API kehadiran per peserta secara out-of-the-box: **`[VERIFIKASI-VENDOR]`** + butuh komponen tambahan | tidak ada kunci vendor; secret webhook internal di vault/ENV | **nol** | sama seperti BBB; tanpa komponen proxy, kelas daring hanya punya bukti manual | `design-only`; syarat: komponen tambahan ditulis & diuji sendiri (bukan dependensi vendor) |
| **Zoom** | berlangganan kampus | **webhook vendor** (nama peristiwa/field & rentang laporan peserta **`[VERIFIKASI-VENDOR]`**; tidak ada endpoint yang dikutip di sini) + opsi tarik laporan setelah sesi | **hanya** di vault/ENV (`credential_ref`), **bukan** baris DB, **bukan** parameter UI (`master_system_parameters` punya `CHECK (is_secret = false)`), **bukan** isian layar | hanya `{event, userRef, duration, sessionId}` — identitas **opaque** yang SICA terbitkan sendiri; **dilarang** kirim nama, NIM, email, isi pertemuan, tautan rekaman | hilang **satu** sumber pendukung; vonis tetap sah lewat kanal internal + bukti luring | `design-only`; syarat: verifikasi signature/HMAC + batas skew + `IDENTITY_UNBOUND` dipegang sampai penampung tautan ada |
| **Google Meet** | Workspace kampus (berlangganan) | webhook/participation data **bergantung skema & persetujuan admin domain Workspace** — **`[VERIFIKASI-VENDOR]`**; tidak ada klaim cakupan | vault/ENV | sama dengan Zoom | sama | `design-only`; syarat: review keamanan + review kepatuhan (data berada di domain institusi, bukan tenant SICA) |
| **Microsoft Teams** | Microsoft 365 kampus | subscription/notification Graph (**`[VERIFIKASI-VENDOR]`**) | vault/ENV | sama dengan Zoom | sama | `design-only`; syarat sama |

**Yang TIDAK dilakukan bagian ini, dan tidak boleh dilakukan agen mana pun.**
1. **Tidak mengarang endpoint vendor.** Nama aksi, path, header, field, dan batas laju Zoom/Meet/Teams
   **tidak** ditulis sebagai fakta di sini; satu-satunya bentuk yang sah adalah baris
   `[VERIFIKASI-VENDOR]` sampai dokumentasi resmi versi target dibaca dan dicatat
   (`INTEGRATIONS` mengikuti pola §1.10.2 untuk Feeder: angka tanpa sumber = bukan norma).
2. **Tidak menjadikan vendor sebagai penentu hadir** (§5.4 butir 3; DATA_MODEL §21.6 butir 3).
3. **Tidak menyimpan kunci vendor di DB atau di layar.** `CHECK (is_secret = false)` pada
   `master_system_parameters` (DATA_MODEL §21.2) bukan hiasan; pola referensi yang benar sudah ada di
   kanal lain: `payment_channels.webhook_secret_ref`, `feeder_credentials.secret_ref`, `feeder_bridges.credential_ref`.
4. **Tidak mengirim PII/rekaman/transkrip keluar.** Ini bukan penurunan mutu fitur: kelas daring tetap
   jalan penuh lewat kanal internal.

**Konsekuensi kepatuhan kalau kampus menolak self-host** (dinyatakan agar keputusan itu dibuat dengan
mata terbuka, bukan sebagai ancaman produk): kehadiran daring kelas `SYNC_LIVE` kehilangan **sumber
otoritatif**. Yang tersisa hanya (a) laporan vendor yang **tidak dapat** memvonis sendiri, (b)
kehadiran manual pengampu (`source='MANUAL'`, butuh `attendance.record.create/.update`, beralasan,
ter-audit), atau (c) tidak ada presensi daring sama sekali. Konsekuensi turunannya: persetujuan
pengolahan data ke pihak ketiga (UU PDP + `SECURITY_COMPLIANCE` §7), risiko lintas-yurisdisi, dan
**modul `lms` tidak dapat dilaporkan sebagai "presensi otomatis"** di layar Admin mana pun. Nilai
`WEBHOOK_EVENT` di `attendance_evidence` wajib membawa `vendor`, `credential_ref`, `event_digest` dan
**tidak pernah** kolom berisi materi pertemuan (DATA_MODEL §21.6 butir 4).

### 5.6 Rekonsiliasi: dua kata, tiga objek, satu aturan penamaan

Istilah "rekonsiliasi" dipakai dua gugus yang berbeda untuk dua hal yang berbeda. Ini daftar
pembedanya, karena tabrakan istilah adalah cara paling tenang untuk salah membaca laporan.

| Istilah | Objek | Pertanyaan yang dijawab | Waktu | Penulisan yang sah | Pemilik |
|---|---|---|---|---|---|
| **bukti kehadiran** | `attendance_evidence` (`0049`) | "dari mana angka hadir ini?" — join/leave/heartbeat/vendor per (sesi, mahasiswa) | per peristiwa | **insert-only**; tidak pernah memvonis; tidak pernah menghapus baris `attendances` | DATA_MODEL §21.5 |
| **rekonsiliasi multi-sumber presensi** | tidak punya tabel sendiri: hasil **vonis** worker penutupan sesi atas baris `attendances` yang **satu**, dihitung dari bukti di atas | "mahasiswa ini hadir atau tidak, dan atas kebijakan apa?" | per sesi (ditutup oleh worker) | vonis = service/worker + `VALIDATE` manusia untuk koreksi; **bukan** `reconciliation_runs` | §5.4; API_SPEC §4.18.4; DATA_MODEL §21.5 |
| **rekonsiliasi dana / VA** | `reconciliation_runs` (`0015`/`0022`; gugus keuangan, §2.4) | "uang yang katanya masuk benar-benar ada di bank/kanal, dan sudah terbukukan?" | batch harian/per periode (`rows_gateway`, `rows_matched`, `rows_suspense`) | `SUSPENSE` adalah **keadaan rekonsiliasi dana**, penyelesaiannya aksi `VALIDATE` (`TREASURER`); tidak pernah diam-diam menjadi lunas | §2.4; API_SPEC §4.7.7 (**kontrak anti-duplikasi tiga jalur dana W-1…W-10**) dan §4.10; DATA_MODEL §14.7 baris B → `0022` |
| rekonsiliasi Feeder lokal vs pusat | `pddikti_reconciliation_diffs` (`0031`) | "yang kita kirim sama dengan yang ada di pangkalan nasional?" | batch inbound `Get*` | keputusan empat nilai + dua orang; tidak pernah menulis tabel domain otomatis | §1.7; DATA_MODEL §16.4.6 |

Tiga aturan yang membuat tabel di atas tidak bisa disalahgunakan:

1. **Jangan menyamakan `attendance_evidence` dengan `reconciliation_runs`.** Yang pertama adalah
   bukti yang **menumpuk** (satu sesi bisa menghasilkan ratusan baris); yang kedua adalah **pekerjaan
   ber-status** untuk uang (satu baris per batch, punya `status`, `rows_suspense`, dan penyelesai
   ber-`VALIDATE`). Mencampur keduanya akan membuat laporan keuangan dan rekap hadir berbagi satu
   keadaan — dan salah satu dari mereka pasti salah.
2. **Satu jalur dana, satu fungsi tulis.** Ketiga jalur (`webhook`, `pull status`, `manual teller`)
   wajib bertemu di satu fungsi penulisan ledger; kontraknya W-1…W-10 di API_SPEC §4.7.7 dan
   §2.4 di file ini. §5 tidak menambahkan jalur keempat dan tidak melonggarkan W-6 (nominal dari DB,
   bukan dari payload).
3. **Nama tanpa prefiks adalah milik keuangan.** `reconciliation_runs` tanpa penanda domain dibaca
   sebagai rekonsiliasi dana. Gugus lain memakai nama objeknya sendiri
   (`pddikti_reconciliation_diffs`, `attendance_evidence`) dan tidak membuat padanan kembar
   (pola `RD-32`).

### 5.7 Rantai lifecycle camaba → hari pertama, dari sisi integrasi

Rantai ini adalah **integrasi end-to-end**, bukan satu kanal. Urutannya normatif; setiap langkah menyebut
kanal, objek, dan **gerbang yang menahannya hari ini**.

```
camaba ──> [1 berkas & OCR] ──> [2 seleksi & gelombang] ──> [3 daftar ulang & UKT]
        ──> [4 VA + pembayaran] ──> [5 NIM] ──> [6 kelas pertama & presensi] ──> [7 CP1 Feeder]
        ──> ... semester berjalan ... ──> [8 CP2 Feeder]
```

| # | Langkah | Kanal integrasi & mesin | Objek yang disentuh | Gerbang yang menahan hari ini |
|---|---|---|---|---|
| 1 | Unggah berkas & pembacaan otomatis (ijazah/transkrip/surat) | **ALG-7 ekstraksi dokumen lokal** (ARCHITECTURE §11.9): Tesseract/PDF.js **tanpa egress**, tanpa OCR cloud; lapisan 0 menolak PDF terenkripsi/ber-`JavaScript`; keluaran selalu **draf** + `score`/`margin`/`source_span` | `pmb_documents` (per-berkas `status` + `rejection_reason`, BENCH-05), `attachments`, `document_templates`/`document_template_anchors`, hasil di tabel `*_results` mesin dengan `proposal_only` | `0021_pmb_intake.sql` belum dieksekusi; pustaka OCR belum ada di `package.json` (**design-only**, `AGENTS §3.9`); tulisan tangan **tidak** dijanjikan |
| 2 | Seleksi per jalur & gelombang | rule engine + kuota | `pmb_waves` (`EXCLUDE USING gist` anti-irisan), `pmb_paths`, `pmb_program_quotas(seats > 0)`, `pmb_selection_results` (tie-break deterministik, promosi `RESERVE`) | `0021`; tanpa `pmb_program_quotas`, **CP1 Feeder tidak bisa dikirim** (daya tampung per prodi per gelombang adalah objek CP1 — DATA_MODEL §14.7) |
| 3 | Daftar ulang → penetapan kelompok tarif/UKT | **ALG-4 RETE** (ARCHITECTURE §11.6) dengan **fakta dari kamus**, bukan dari teks bebas: penghasilan penjamin & wilayah = `reference_dictionary_entries`/`reference_items(kind='penghasilan')` (DATA_MODEL §21.3 nomor 9), **bukti lampiran** wajib ada sebelum fakta dianggap (`income_group_code`), dan aturan "penghasilan ≤ X maka wajib surat" adalah logika service L5 (DATA_MODEL §20.8 catatan) — bukan isi kamus | `pmb_reregistrations` (titik pengambilan `funding_source_code`/`entry_cost_rupiah`/`receives_kps`/`kps_number` untuk Feeder — §1.2 baris A), `fee_tariff_groups` + `tuition_tariff_matrix`, `invoices` | `0046` tarif belum dieksekusi; `0049` parameter belum ada; kamus penghasilan/wilayah **belum di-*seed*** → `[VERIFIKASI-KAMUS]`: tanpa baris kamus, kelompok tarif **tidak boleh diasumsikan** dan pengajuan berhenti sebagai draf |
| 4 | Tagihan terbit → VA multi-bank → pembayaran | kanal pembayaran §2 + API_SPEC §4.7/§4.10: **VA adalah objek ber-nyawa** (`ISSUED → USED \| CANCELLED \| EXPIRED`), webhook **wajib** verifikasi signature (`§2.2` pola SHA-512 Midtrans, `payment_channels.webhook_secret_ref` untuk yang lain), tiga jalur dana bertemu satu fungsi (W-1…W-10), `SETTLED` + ledger + lepas cekal dalam **satu transaksi** | `payment_channels`, `virtual_accounts` (`UNIQUE (bank_code, va_number)` **global antar-tenant**, BENCH-34), `payment_windows`, `payments.external_ref`, `payment_allocations`, `ledger`, `receipts`, `blockades` | `0015`/`0022` belum ada berkasnya; **nol rute webhook** di `apps/web/src/app/api/v1/payments/**`; `verifyMidtransSignature` di §2.2 adalah **kode spesifikasi**, belum ada di `src` |
| 5 | Penerbitan NIM | **ALG-18** generator NIM (nomor engine/section yang **ditagihkan** DATA_MODEL §21.3 nomor 21 ke ARCHITECTURE §12.17 — **tertulis 2026-10-20**, jadi pemiliknya sudah ada; yang masih kurang adalah berkasnya: `0021`/`nim_assignments` belum berwujud dan `reference_kind_usage` belum menandai kunci pola NIM): pola dari `tenant_settings.nim_format` (regex berversi), **sequence per prefix, bukan `MAX()+1`**, daur ulang **hanya** bila NIM belum pernah terdaftar di Feeder (BR-R10/BENCH-03/04) | `nim_assignments` (`status RESERVED \| ISSUED \| CANCELLED \| RECYCLED`, `issued_at`, `cancelled_by`), `students.nim` (`immutable_after = 'NIM_ISSUED'`, DATA_MODEL §14.9) | `0021`; `students.nim` sudah ada (`uq_students_nim`), `nim_assignments` **belum**; tanpa sequence ber-status, `MAX()+1` akan melahirkan NIM kembar di bawah konkurensi — itu sebabnya langkah ini tidak boleh "dikerjakan cepat" |
| 6 | Hari pertama: kelas, jadwal, presensi | §5.2–§5.4 (kanal internal) + QR/geofence (API_SPEC §4.3) | `class_sessions`, `class_schedules`, `attendances`, `attendance_evidence` | `0049` (kosakata modus + bukti); kolom waktu sesi (BENCH-57); provider self-host **belum terpasang** |
| 7 | **CP1 Feeder** | pipeline §1.5–§1.9: staging → validasi §1.6 → kirim via bridge | `pddikti_staging_mahasiswa` (biodata + riwayat), `_kurikulum`, `_kelas`, `_krs_akm` | `0028` + `0031` belum dieksekusi; **Feeder Bridge tidak ada di kode** (§1.10.1); kamus `sifat_pembelajaran` kosong → baris KELAS **tidak ikut kirim** (§1.16) |
| 8 | **CP2 Feeder** | sama, domain NILAI/AKTIVITAS/KELUAR | `pddikti_staging_nilai`, `_aktivitas`, `_keluar` | jendela reopen tipe 1/2, gerbang keuangan/clearance, `0018`/`0026`/`0027` belum ada |

**Empat hal yang membuat rantai ini jujur.** (1) Setiap langkah di atas punya **penahan berat**
yang belum dieksekusi; tidak satu pun boleh dilaporkan sebagai "alur sudah jalan". (2) Mesin
**mengusulkan**, manusia **menyetujui** — berkas hasil OCR dan kelompok tarif hasil RETE tidak pernah
langsung menjadi data resmi (`AGENTS §3.9`). (3) **Nol egress** di langkah 1 dan 3: dokumen camaba dan
fakta penghasilan tidak pernah dikirim ke layanan berbayar. (4) Kegagalan di langkah mana pun
**menahan** langkah berikutnya secara terang (VA kedaluwarsa → `SUSPENSE`, bukan lunas; NIM belum
terbit → CP1 tidak bisa dikirim; kamus kosong → payload tidak dikirim), bukan menyisakan angka nol di
laporan.

### 5.8 Status kejujuran gugus §5 (apa yang belum ada dan apa yang tidak kita ketahui)

| Klaim spesifikasi | Kenyataan terukur 2026-10-20 | Konsekuensi |
|---|---|---|
| Peristiwa `JOIN`/`LEAVE`/`HEARTBEAT` masuk `attendance_evidence` | **nol** objek `attendance_evidence` (0049 belum dieksekusi), **nol** rute `attendance/events/**`, **nol** adapter BBB/Jitsi | vonis daring tidak dapat ditulis; yang ada hanya `attendances` hasil `qr/scan` |
| Dua nilai baru `attendance_source` (`LMS_ACTIVITY`, `WEBHOOK_EVENT`) | enum di `packages/database/src/schema/enums.ts:137-143` hanya `QR \| GEOFENCE \| MANUAL \| APP_BULK \| FEEDER_SYNC` | `ALTER TYPE … ADD VALUE` butuh **migrasi tersendiri** (aturan DATA_MODEL §15.2); sebelum itu setiap insert nilai baru gagal di DB |
| `learning_modality` / `session_kind` sebagai kosakata tunggal | kode hanya punya `classes.delivery_mode` + `class_sessions.delivery_type` (ejaan yang **dilepas**) | pemetaan F/O/M (§1.16) dan rasio daring (§5.3) tidak punya sumber; alias lama jangan dipakai di kontrak baru |
| Verifikasi signature/HMAC webhook kehadiran vendor | **belum ada di kode**: `apps/web/src` tidak memuat satu pun verifier webhook (`grep` pada `webhook` hanya mengenai `config/env.ts`, `auth/services/password.service.ts`, `auth/services/token.service.ts`); **nol** rute `/api/v1/webhooks/**`; untuk pembayaran pun verifikasinya belum ber-rute (`payments/**` tidak ada) | seluruh §5.5 adalah desain; tidak ada satu provider pun yang boleh diaktifkan tanpa verifier + `credential_ref` dari vault |
| Kredensial provider di vault/ENV | kontrak kanal sudah dirujuk ENV_CONTRACT §7 dan Teams §6.8; klaim lama “nol entri” tidak berlaku sebagai status kini | registrasi, provisioning ref, consent/scope dan uji transport tetap harus terbukti per provider; tidak membuat env baru diam-diam |
| Antrean peristiwa & batch flush | `bullmq`/`ioredis` absen manifest (`RD-11/P-6`) | design-only; worker DB-backed/tahan-crash juga belum dibuktikan oleh tabel ini |
| Ambang & kebijakan sebagai parameter | nama parameter mengikuti katalog DATA_MODEL; berkas `0049` ada, bukan bukti DB diterapkan | resolver umum tidak membuktikan konsumen presensi sudah memakai versi parameter; perlu uji konsumsi nyata |
| Tautan `userRef → student` | kontrak peserta harus memakai mapping tenant-scoped, bukan pencarian nama | tanpa mapping tervalidasi, vendor tidak menghasilkan kehadiran; status implementasi perlu bukti per lingkungan |
| ALG-18 generator NIM | rujukan desain mengikuti ARCHITECTURE; tidak lagi disebut bagian hantu dari snapshot lama | dokumentasi engine bukan implementasi, konsumen dan uji masih diperlukan |
| Ambang watch-time asinkron | `attendance.async_min_watch_ratio` telah diregistrasi di desain (§5.3, RD-72) | berbeda dari rasio join; registrasi bukan bukti konsumen deployed atau keputusan PRESENT sah |
| `[VERIFIKASI-VENDOR]` seluruh nama API/field provider BBB/Jitsi/Zoom/Meet/Teams | tidak ada dokumentasi resmi versi target di repo; tidak ada sandbox | §5.5 tidak menulis endpoint, header, field, atau batas laju sebagai fakta; semuanya penahan sampai terverifikasi |

**Cara membaca §5 di dokumen lain.** §1.14.2 menulis bahwa PJJ memakai `method='LMS_ACTIVITY'` dan
geofence tidak berlaku; §1.16 menulis bagaimana modus itu naik ke Feeder; API_SPEC §4.18 menulis
permukaan wire-nya; DATA_MODEL §21 menulis fisik dan kosakatanya; `AGENTS §3.9` menulis normanya.
**Tidak ada satu pun dari mereka yang boleh berdiri sendiri sebagai bukti bahwa fitur ini ada.**
Urutan pengerjaan yang sah (tidak boleh dibalik, `AGENTS §3.11`): eksekusi `0049` (bukti + kosakata +
parameter) → registrasi penampung `userRef` + ambang watch-time oleh DATA_MODEL → registrasi kode izin
yang dibutuhkan (`RBAC_MATRIX` §4.5) → path & kode error (API_SPEC §4.18, **sudah ditulis**) → pola layar
(`UI_UX_DESIGN`) → task di `ROADMAP_TASKS` → **baru** adapter.

### 5.9 Catatan pemeliharaan & penomoran gugus §5

1. **§5 adalah pemilik mekanika sisi integrasi untuk kehadiran daring** (kanal, jendela, interval,
   dedup, konsekuensi provider). Ia **bukan** pemilik kosakata (DATA_MODEL §21.4), bukan pemilik wire
   contract (API_SPEC §4.18), bukan pemilik norma keamanan (`AGENTS §3.9`, `SECURITY_COMPLIANCE` §7).
2. **Alamat bagian:** §5 memuat mekanika presensi daring; §6 sudah terisi peta kanal nasional, pemisahan transport/fakta dan Teams. Rujukan SISTER memiliki tujuan §6.1–§6.2, bukan bagian kosong/hantu.
3. **Satu tabel vonis.** Bila API_SPEC §4.18 berubah, §5.4 wajib ikut berubah pada commit yang sama;
   dua tabel vonis untuk satu keadaan adalah pola `RD-03`/`RD-12`.
4. **Angka yang boleh disebut di sini** hanya yang sudah berpemilik: 60 detik (heartbeat, DATA_MODEL
   §21.5), 300 detik (`finance.webhook_max_clock_skew_s`, §21.3 nomor 6), 0,75
   (`attendance.online_min_join_ratio`, §21.3 nomor 23), ambang kemiripan Feeder (`rule.threshold`, §1.11.5).
   Retry/backoff/DLQ: **cross-reference ARCHITECTURE §10.4.1**, tidak ditulis ulang (norma §1.12.6
   berlaku juga untuk gugus ini).
5. **Bukti yang masih diperlukan:** migrasi terkait diterapkan pada lingkungan target, mapping peserta
   tenant-scoped, konsumen parameter join/watch-time berversi, verifier webhook, izin kanonik aktif
   serta adapter/fixture per provider. Registrasi parameter/ENV dan bagian desain ALG-18 sudah mempunyai
   rujukan; itu tidak menutup implementasi atau membuktikan DB berjalan. Izin yang belum aktif tetap
   pending menurut RBAC_MATRIX, bukan string baru dari dokumen ini.

---

## 6. Integrasi sistem nasional & eksternal untuk 47 modul (2026-10-20)

**Fungsi gugus ini.** §1 sudah menjadi pemilik kanal PDDikti Neo Feeder, §2 pemilik kanal pembayaran dan VA, §3 pemilik messaging, §4 pemilik object storage, §5 pemilik kehadiran daring. Gugus §6 **tidak** menormakan ulang salah satunya dan **tidak** menambah kontrak wire kedua: ia adalah **peta** — sistem nasional mana melayani modul mana, siapa penghasil fakta, siapa transport, dan apa statusnya hari ini. Setiap baris menunjuk nomor bagian pemilik angkanya.

**Ralat nama berkas yang ditagih.** Permintaan produk menyebut `INTEGRATION_SPEC.md`. Berkas itu **tidak pernah ada** dan tidak akan dibuat; yang sedang dibaca ini adalah `docs/INTEGRATIONS.md`, dan seluruh spesifikasi kanal tinggal di sini. Ralat dicatat di [AUDIT_READINESS `RD-57`](file:///c:/SICA/docs/AUDIT_READINESS.md) dan di `AGENTS §2.3`. Membuat berkas kembar adalah persis pola `RD-03`/`RD-32` yang dokumen ini perangi.

**Kepemilikan rujukan (norma tidak diputuskan dua kali).**

| Yang dibutuhkan pembaca | Pemiliknya | Peran §6 |
|---|---|---|
| Registri `M-01`…`M-47` + `APP`, status `PENUH`/`SEBAGIAN`/`NOL`, dan empat belas vonis tanggung jawab tunggal | [PRD §5.12.1 dan §5.13.1](file:///c:/SICA/docs/PRD.md) | §6 **menunjuk** nomor `M-xx` dan nomor vonis; ia tidak menyalin registri dan tidak mengubah sel status |
| Nama objek, DDL, nomor migrasi | `DATA_MODEL` §14.7 register, §16.4 staging, §18.5 autofix, §19 entitas baru, §21 parameter, §22 skema 47 modul | §6 memakai nama yang sudah menang dan mendaftarkan **permintaan kolom** sebagai tagihan, bukan sebagai fakta |
| Kode izin `resource × verb` | `RBAC_MATRIX` §4/§4.5 lalu `PERMISSION_SPECS` di `packages/contracts/src/authz.ts` | **tidak ada satu pun kode izin baru di sini**; yang belum menjadi baris didaftarkan sebagai penahan (§6.7) |
| Path, skema Zod, kode error | `API_SPEC` §2.3 register, §4 permukaan, §6 engine | rujukan saja |
| Norma nol-API-key, nol-egress, pustaka lokal berstatus `design-only` | `AGENTS §3.9`, ARCHITECTURE §11.1 dan §12.12, **TECH_CONVENTIONS §7** (register design-only) | §6.4 menaruh setiap adapter pada register itu dan mengutip hasil ukur, bukan menyatakan terpasang |
| Kosakata kamus dan parameter operasional | `DATA_MODEL` §20 (empat kelas) dan §21, seed di `SEED_DATA` | §6.5 mendaftar entri yang **wajib di-seed sebelum kirim**; nama `kind` final tetap milik pemiliknya |
| Mekanika delta sync, watermark, retry, DLQ | ARCHITECTURE §12.10 dan **§1.12 di file ini** | §6.3 **melanjutkan** ke SISTER/DJKI/SINTA dan kanal lain tanpa mendefinisikan ulang |
| Peristiwa kanonik lintas modul | ARCHITECTURE §13.1 (42 peristiwa, satu penerbit) | §6 memakai `event_type` yang sudah ada (`sister.portfolio.pushed`, `library.loan.cleared`, `graduation.diploma.signed`); tidak menciptakan nama baru |

**Terukur sebelum gugus ini ditulis (2026-10-20, dikutip apa adanya).** Berkas `docs/DATA_MODEL.md` sedang ditulis agen lain pada saat yang sama, jadi angka di bawah adalah keadaan **pada saat ukur**, dan §6.7 menandai mana yang bergerak.

```
ls packages/database/migrations/
  0001_init_rls_policies.sql   0002_academic_core.sql     0003_people_biodata.sql
  0004_entitlement_modules.sql 0005_field_data_attendance_courses.sql
  0006_member_role.sql         0011_rbac_scoped.sql
  → 7 berkas nyata. Tidak ada 0028, 0031, 0040, 0049, 0052, 0055, 0061, 0067, 0069.

grep -rn "fetch(" apps/web/src/modules ; grep -rn "axios" apps/web/src/modules
  → 2 baris, keduanya apps/web/src/modules/auth/components/login-form.tsx:310 dan :363,
    dengan endpoint relatif SAME-ORIGIN '/api/v1/auth/login' dan '/api/v1/auth/mfa/verify'
find apps/web/src/modules -type d -name engine  → 0 hasil (direktori engine belum ada)

grep nama paket pada package.json + apps/web/package.json + packages/*/package.json
             + apps/mobile/pubspec.yaml + pnpm-lock.yaml
  fast-xml-parser = 0 · xml2js = 0 · node-forge = 0 · pdf-lib = 0 · marc = 0
  tesseract = 0 · bullmq = 0 · ioredis = 0 · onnxruntime = 0 · or-tools = 0 · @aws-sdk = 0

grep -ciE "SISTER|ZOOM|BBB|JITSI|SIVIL|DJKI|SINTA|LPSE|KOHA|SLiMS" docs/ENV_CONTRACT.md → 0
grep -ciE "SISTER|DJKI|SINTA|ARJUNA|LPSE|KOHA|SLiMS" docs/ROADMAP_TASKS.md              → 0
find . -type d -name fixtures (node_modules dikecualikan)                               → 0 hasil
grep -c "resource:" packages/contracts/src/authz.ts                                     → 224
  dengan "sister", "legalisir", "procurement", "library", "research", "pin"             → 0 baris
grep -roh "\[VERIFIKASI-KAMUS\]" docs | wc -l                                           → 33 kemunculan
```

Blok di atas hanya **snapshot statis 2026-10-20**. Tidak menemukan `fetch` atau direktori engine bukan bukti engine nol-egress telah deployed, dan tidak membuktikan seluruh jalur jaringan. Registrasi kredensial/izin serta jumlah migrasi sudah dapat berubah; gunakan dokumen pemilik dan bukti per lingkungan, bukan angka lama sebagai status kini. `tesseract`, `bullmq`, `ioredis` tidak ada di manifest yang diperiksa; OCR/antrean terkait tetap design-only. Engine nol-key/nol-egress adalah kontrak, sedangkan transport eksternal memiliki batas kredensial terpisah (§6.1).

### 6.1 Peta sistem → modul

Kolom kredensial menunjuk vault/ENV melalui `*_ref`, **bukan nilai plaintext**. API/UI admin hanya mengelola binding, reference dan metadata status/rotasi; tidak ada pengecualian bagi Admin IT untuk membaca secret di body, log, audit, ekspor atau parameter umum. Secret hanya diresolusi service-side pada transport terdaftar. Connector eksternal boleh memerlukan kredensial dan egress terkontrol; **engine tetap nol API key dan nol egress**, membaca snapshot internal, bukan memanggil vendor.

| Kanal | Governance teknis Admin IT | Otoritas bisnis terpisah |
|---|---|---|
| Feeder | binding endpoint/tenant, secret ref, health/retry teredaksi | `FEEDER_OPERATOR` dan pemilik akademik sesuai RBAC menyetujui data, koreksi dan kirim; IT tidak mengesahkan fakta nasional |
| SISTER | binding institusi, rotasi ref, pemantauan transport | HRD/pemegang assignment BKD sesuai RBAC; peran/izin usulan yang belum aktif tetap pending; approval portofolio bukan hak IT |
| Teams | tenant/app binding, scope teknis minimum, ref, probe | dosen/pemilik sesi dan aturan M-18 memutus kehadiran; IT tidak mengubah nilai/presensi dari laporan vendor |
| PIN/SIVIL | konektivitas dan ref | pejabat kelulusan/dokumen berwenang sesuai RBAC menyetujui; nomor resmi hanya dari sumber tervalidasi, tidak dibuat Admin IT |
| Bank/VA | binding kanal dan secret ref | BAUK/pemegang izin keuangan, termasuk `TREASURER` sesuai SoD, menyetujui rekonsiliasi/settlement; IT tidak settle VA |

Semua aksi tunduk pada entitlement, assignment berscope/validity, MFA dan SoD; izin yang belum terdaftar tetap pending, bukan kode baru. Platform saja mengubah lisensi; tenant hanya opt-out dalam hak yang sudah diberikan. Legenda: `spec-only` = kontrak, `blocked` = prasyarat belum terbukti, `design-only` = komponen belum diterapkan, `implemented` = bukti runtime yang spesifik. Tabel kanal di bawah bukan bukti deployment; hitungan historis pada kolom status tidak menggantikan verifikasi per lingkungan.

| Sistem | M-xx penghasil data | M-xx transport | Arah | Skema atau versi yang diketahui publik | Mode | Kredensial disimpan di mana | Status hari ini |
|---|---|---|---|---|---|---|---|
| **PDDikti Neo Feeder** (aplikasi lokal kampus plus portal pusat) | M-09, M-13, M-14, M-18, M-19, M-20, M-30, M-38 (biodata, KRS, kelas, presensi, nilai, TA, kelulusan, konversi) | M-34 | dua-arah: kirim `Insert*`/`Update*`, tarik `Get*` | Web Service REST atas HTTPS dengan RPC action; senarai aksi dan bentuk payload dimiliki **§1.1–§1.4** dan tidak diulang di sini; versi aplikasi yang terlihat di riset §1.4 adalah Neo Feeder 2.4.0 dengan UG UI/UX v4.0 — wajib dikonfirmasi per instalasi `[VERIFIKASI-RESMI]` | kirim lewat Feeder Bridge, tarik rekonsiliasi berkala | `feeder_credentials.secret_ref` ke vault/ENV plus Kode Registrasi dari portal pusat (§1.1) | `blocked` — `0028`/`0031`/`0040` belum dieksekusi dan Bridge 0 baris kode (§1.10.1) |
| **PDDikti pangkalan data** (API publik kementerian) | M-09, M-30, M-35, M-39 membaca hasil verifikasi mahasiswa dan lulusan | M-34 | satu-arah masuk | endpoint dan skema hasil ukur §1.4 tidak pernah diambil dari User Guide; satu-satunya sumber nilai yang sah tetap `Get*` lewat Feeder (§1.7.2 baris pusat-dasar) `[VERIFIKASI-RESMI]` | tarik | kunci portal atas nama PT (registrasi oleh manusia) di sisi Bridge; **tidak pernah** dibaca engine (AGENTS §3.9) | `blocked` — nol baris ENV_CONTRACT untuk kanal ini (terukur) |
| **SISTER 2.0** (Sumber Daya Insani Terpadu) | M-06 kartu pegawai dan pendidikan, M-14 dan M-18 mengajar, M-19, M-20, M-21 dan M-22 publikasi dan HKI, M-44 penelitian dan pengabdian; **angka BKD tetap milik M-07** (vonis 7) | M-08, dan hanya itu | dua-arah: kirim portofolio, tarik status verifikasi | nama kanal ada di GLOSSARY baris *SISTER* (entri itu menunjuk `INTEGRATIONS §6.2`); versi antarmuka, senarai aksi, dan bentuk pesan **tidak ada di dokumen mana pun** `[VERIFIKASI-RESMI]` sebelum satu byte payload ditulis | kirim delta plus tarik rekonsiliasi per episenter | `sister_endpoints.credential_ref` (DATA_MODEL §22.2.3, nomor diklaim `0055`) ke vault/ENV | `spec-only` — objek diklaim di DATA_MODEL §22, nol migrasi berjalan; `hr.sister.sync` ada di RBAC §4 dan §4.5, **0** di `PERMISSION_SPECS` |
| **DJKI** (hak kekayaan intelektual: paten, paten sederhana, merek, desain industri, dttn, varietas tanaman, rahasia dagang) | M-22 permohonan, pemilik, lisensi; M-44 ketika luaran kontrak hibah | M-22 sendiri — tidak ada modul transport terpisah | dua-arah: kirim permohonan, tarik status resmi | klasifikasi jenis dan kanal pengajuan mengikuti daftar resmi DJKI; bentuk layanan **tidak ada di repo** `[VERIFIKASI-RESMI]` | hari ini **manual** (unduh dan unggah berkas); tarik status belum terancang | kredensial portal institusi ke vault/ENV — belum terdaftar | `blocked` — `ip_applications.center_reference` baru spesifikasi (`0062`); nomor resmi DJKI hanya boleh mengisi `center_reference`, tidak pernah `application_number` (analog I-14 §1.13 butir 2) |
| **SINTA** (indeks iptek nasional) | M-21 jurnal, artikel dan peristiwa indexing; M-22, M-44, M-07 | M-08 untuk portofolio, M-21 dan M-39 untuk metadata | dua-arah secara teoretis, tetapi **bentuknya belum terbukti**: SINTA umumnya memetik dari SISTER dan dari pelayan metadata institusi, bukan menerima kiriman | protokol rujukannya OAI-PMH untuk pelayan metadata dan Dublin Core untuk crosswalk; apakah SINTA mensyaratkannya dan versi mana `[VERIFIKASI-RESMI]` | pihak ketiga memetik, kita penyedia; **tidak ada panggilan keluar dari dalam engine** | tidak ada untuk peran penyedia; token akses bila disyaratkan ke vault/ENV | `design-only` — serializer belum ada (§6.4) |
| **ARJUNA** (pemeringkatan kinerja riset) | M-44 kontrak dan luaran, M-21, M-22, M-07 | M-08 (jalur tidak langsung lewat SISTER) | keluar secara tidak langsung | tidak ada dokumen skema di repo dan **kemungkinan tidak ada API langsung** untuk perguruan tinggi `[VERIFIKASI-RESMI]` | tidak ada jalur otomatis yang diizinkan hari ini | tidak ada | `blocked` — vonis 7 melarang §6 menciptakan jalur tulis kedua ke angka tridharma |
| **BAN-PT dan LAM** (akreditasi program studi dan rumpun; LAM-INFOKOM, LAM-PTKes dan lembaga sejenis) | M-12 capaian OBE, M-14, M-18, M-19 proses dan hasil, M-30 lulusan, M-37 PPEPP dan AMI dan CAPA, M-07 SDM | M-31 borang dan M-37 SPMI sebagai **proyeksi baca** (vonis 4) | dua-arah: ekspor borang dan LED keluar, peringkat dan masa berlaku masuk | instrumen sembilan kriteria dan instrumen LAM per rumpun disebut PRD FR-P2-06; bentuk borang, kanal penyerahan, dan kosakata peringkat `[VERIFIKASI-RESMI]` per versi instrumen | ekspor dokumen sebagai draf lalu `VALIDATE`; tarik status otomatis belum ada — satu-satunya jalur **terbukti** untuk nilai akreditasi hari ini adalah `GetProdi` dan `GetProfilPT` lewat Feeder (§1.7.2) | portal akreditasi adalah kredensial institusi ke vault/ENV — belum terdaftar | `spec-only` untuk ekspor, `blocked` untuk tarik otomatis |
| **e-Katalog dan LPSE** (pengadaan barang/jasa nasional) | M-46 paket, tender, HPS, kontrak; M-10 untuk komitmen dan pembayaran (vonis 6); M-40 untuk kartu aset hasil terima-aset (vonis 6) | M-46 | dua-arah: tarik katalog produk dan paket dan vendor, kirim realisasi serta pemantauan | format tukar e-Katalog dan API LKPP dan antarmuka LPSE **tidak ada di repo** `[VERIFIKASI-RESMI]` | tarik terjadwal plus kirim append-only | API key LPSE ke vault/ENV; vendor menunjuk `external_organizations` (`0053`) dan identitasnya tidak disalin per modul | `blocked` — M-46 dihitung `NOL` di PRD §5.12.1; objek diklaim `0069` (DATA_MODEL §22.7.3) tetapi belum ada kolom rujukan pusat untuk paket atau kontrak (terukur saat §22.7.3 dibaca: `tenders` dan `procurement_contracts` tidak memuat `center_reference`) |
| **Bank dan VA multi-kanal** (Midtrans Core API, Xendit Invoice; VA BCA, Mandiri, BNI, BRI; QRIS dinamis) | M-10 tagihan dan ledger; M-09 biaya PMB, M-23 wisuda, M-39 denda, M-41 ringkasan klinik, M-42 kantin, M-44 pencairan **hanya memancarkan kebutuhan tagih** | M-10 lewat `payment_channels` | dua-arah: terbit VA atau invoice, lalu callback plus tarik status | seluruhnya dimiliki **§2** (§2.1–§2.4) dan API_SPEC §4.7 dan §4.10 dengan kontrak anti-duplikasi W-1…W-10; §6 tidak menambah bentuk pesan | kirim, webhook idempoten, tarik status, teller manual — tiga jalur bertemu **satu** fungsi tulis ledger (§2.4) | `payment_channels.webhook_secret_ref` plus kunci ENV yang **sudah terdaftar** (`config/env.ts:40-56` memuat Midtrans dan Xendit, §5.8) | `spec-only` — nol rute `/api/v1/webhooks/**` dan `verifyMidtransSignature` masih kode spesifikasi (§5.7 baris 4); `0015` dan `0022` belum berwujud |
| **WhatsApp dan Email** (Fonnte atau Gupshup WABA; Resend atau AWS SES) | semua modul pemancar notifikasi: M-10, M-13, M-18, M-27, M-30, M-35 | kanal §3 — bukan modul bisnis | satu-arah keluar plus webhook status kirim | dimiliki **§3** (§3.1 arsitektur antrean, §3.2 katalog template) | antrean plus retry plus template berversi | kunci provider ke vault/ENV (Resend nyata di `env.ts`, Fonnte belum didaftar) | `spec-only` — §3.1 mengimpor `bullmq` dan `ioredis` yang keduanya `design-only` (`RD-11`, `P-6`) |
| **Zoom, Google Meet, Microsoft Teams** dan kanal self-host **BigBlueButton** atau **Jitsi** | M-15 modus dan sesi, M-16 aktivitas LMS, M-20 dan M-25 bimbingan | adapter §5.5 — **vonis kehadiran tetap M-18** | dua-arah: kanal internal mendorong peristiwa, vendor mendorong webhook | nama peristiwa, field, endpoint, dan batas laju vendor adalah **`[VERIFIKASI-VENDOR]`** per §5.5; tidak satu pun dikutip sebagai fakta di sini | webhook plus tarik laporan pasca-sesi; kanal internal mendorong `JOIN`, `LEAVE`, `HEARTBEAT` | `credential_ref` ke vault/ENV; **dilarang** menjadi baris parameter dan **dilarang** muncul di layar (§5.5 butir 3) | `design-only` — nol dependensi konferensi di manifest mana pun dan nol rute `attendance/events/**` (terukur §5 awal gugus) |
| **PIN dan SIVIL** plus legalisir dan pengiriman fisik ijazah | M-30 keputusan lulus dan clearance; M-35 ijazah elektronik, PIN, legalisir | M-35 | dua-arah: dataran ijazah keluar, hasil verifikasi masuk; verifikasi publik tanpa autentikasi (PRD FR-CRD-05) | PISN diterbitkan portal nasional dan **format nomor tidak boleh dikarang** (BR-R8 dan GLOSSARY baris *PISN*); endpoint SIVIL `[VERIFIKASI-RESMI]` | kirim plus tarik plus jejak verifikasi per percobaan (`sivil_verification_events`, `0052`) | `credential_ref` ke vault/ENV; `pin_reservations.pin_hash` disimpan sebagai HMAC sehingga tidak ada PIN plaintext maupun terenkripsi-terbaca (DATA_MODEL §22.1.2) | `blocked` — `0052` diklaim dan belum dieksekusi; `graduation.pin.sync` dan `graduation.legalisir.request` ada di RBAC §4, **0** di `PERMISSION_SPECS`; **pos dan ekspedisi fisik tidak punya kanal otomatis** di §1 sampai §6 dan tetap manual beralasan — kurir ber-API-key adalah pengecualian yang belum diputus produk |
| **DUKCAPIL** (verifikasi NIK) | M-02 kamus dan biodata, M-09 berkas camaba | tidak ada transport yang diizinkan hari ini | satu-arah masuk sebagai **hasil** verifikasi | tidak ada integrasi di repo (§1.10.2 baris terakhir); bentuk layanan `[VERIFIKASI-RESMI]` | tidak ada | tidak ada | `blocked` — engine hanya membaca hasil verifikasi yang sudah tersimpan dan tidak pernah mengklaim pemeriksaan langsung |
| **SLiMS dan KOHA** (otomasi perpustakaan) serta repositori institusi (RAMA milik M-20, deposit dan ISBN serta PNRI) | M-39 katalog, sirkulasi, denda, bebas pustaka; M-20 deposit tugas akhir; M-21 metadata jurnal | M-39 adapter ILS plus M-21 dan M-39 pelayan metadata | dua-arah: status bebas pustaka dan sirkulasi masuk, metadata keluar lewat pelayan | KOHA mengenal Z39.50 dan SRU dan API rest; SLiMS memakai API miliknya sendiri — versi target dan bentuk `[VERIFIKASI-RESMI]`; bentuk bibliografis sudah punya rumah di DATA_MODEL §22.7.1 (`bibliographic_records.format_kind` dengan `MARC21`, `UNIMARC`, `DUBLIN_CORE` dan `marc_subfields`) | tarik plus kirim; sinyal keluar memakai peristiwa kanonik `library.loan.cleared` (ARCHITECTURE §13.1) | `credential_ref` ILS kampus ke vault/ENV — belum terdaftar | `blocked` — objek diklaim `0067` dan belum dieksekusi; tidak ada tabel sinkron ILS di §22.7.1 saat diukur; bebas pustaka **hanya sinyal** ke M-30 (vonis 3) |
| **Object storage** (Cloudflare R2 atau AWS S3) | semua modul penyimpan berkas: M-09, M-20, M-35, M-36, M-41 | §4 | dua-arah lewat pre-signed URL milik SICA | dimiliki **§4** (§4.1 alur, §4.2 generator) | unggah dan baca lewat URL bertanda waktu | kunci di ENV (terdaftar `ENV_CONTRACT`) | `spec-only` — `@aws-sdk` **0** di seluruh manifest (terukur), jadi §4.2 adalah kode spesifikasi |

**Postur nol-kunci untuk gugus konferensi ditegaskan ulang.** Urutannya bukan pilihan rasa: **kanal internal kampus lebih dulu** (BBB atau Jitsi yang ruangannya dibuat dan dipantau SICA sendiri, tanpa kunci vendor, tanpa egress), dan **vendor berlangganan hanya pendukung**. Satu baris `WEBHOOK_EVENT` dari vendor **tidak pernah** cukup menjadi `PRESENT` (§5.4 butir 3, DATA_MODEL §21.6 butir 3), dan yang boleh keluar dari infrastruktur hanyalah empat kunci payload beridentitas opaque, bukan nama, NIM, email, rekaman, transkrip, atau isi pertemuan (§5.5, §5.4 butir 4).

**Satu temuan nama yang harus dibaca orang lain.** `reference_items(kind='industri_sister')` (DATA_MODEL §22.4.2, M-28 Career Center) adalah **rumpun sektor kerja** dan tidak ada hubungannya dengan kanal SISTER. Nama itu menyesatkan justru di berkas yang membahas SISTER. Pemilik namanya adalah DATA_MODEL; §6 tidak mengganti dan tidak memakai namanya untuk portofolio dosen, yang kinds-nya `item_sister` (§6.5).

### 6.2 Norma transport bukan pemilik fakta

Vonis [PRD §5.13.1 butir 7](file:///c:/SICA/docs/PRD.md) untuk SISTER berbunyi: M-08 adalah **transport** dan tidak memiliki angka; vonis butir 4 untuk M-31 dan M-32 berbunyi: fakta tetap di modul sumber, proyeksi tidak menyimpan salinan yang dapat disunting. Dua vonis itu adalah norma seluruh gugus ini, dan diucapkan ulang dalam bentuk yang **dapat diuji** — bukan sebagai imbauan arsitektur.

| Sistem | Fakta yang tetap milik modul penghasil | Yang boleh disimpan tabel transport | Yang dilarang disimpan | Penegak yang sudah bernama |
|---|---|---|---|---|
| PDDikti Feeder | `students`, `enrollments`, `grades`, `courses`, `student_activities`, `thesis_records` | `pddikti_staging_*` (kanonik payload plus digest), `feeder_jobs`, `pddikti_payload_snapshots`, `feeder_identities`, `feeder_sync_watermarks`, `pddikti_reconciliation_diffs` | `feeder_id` yang lahir tanpa respons Bridge; `UPDATE` balik ke tabel sumber | invariance I-14; §1.13 butir 1 dan 2; DATA_MODEL §18.9(7); gerbang CI (j) dan (t) |
| SISTER | `employees`, `lecturers`, `class_assignments`, `research_outputs`, `articles`, `ip_applications`, rekap BKD di M-07 | `sister_portfolio_items` (`source_entity`, `source_id`, `content_digest`, `sync_state`, `center_status`), `sister_sync_queue`, `sister_delta_watermarks`, `sister_endpoints` | judul publikasi, angka sks, angka BKD, nominal rupiah, id pusat yang diketik manusia | vonis 7; FR-SIS-01 dan FR-SIS-03; `center_reference` bukan `feeder_id` (DATA_MODEL §22.2.3); CHECK `sync_state <> 'SUPPRESSED' OR conflict_detail <> '{}'` |
| DJKI | `ip_applications` dan `ip_owner_lines` dan `incubated_startups` (M-22) | `center_reference`, `center_status_note`, jejak percobaan, digest bukti | nomor resmi DJKI di kolom `application_number` (itu nomor **kita**); status DJKI yang menimpa `ip_application_status` tanpa transisi ber-`VALIDATE` | pola yang sama dengan I-14; mesin state kelas A di §22.5.2 |
| SINTA dan ARJUNA | `articles`, `article_author_lines`, `article_indexing_events`, `journals.accreditation_item_id` | hasil pemetikan sebagai **peristiwa indexing** dengan sumber dan tanggal, dan status sinkron | peringkat yang ditulis manual sebagai angka final; salinan artikel sebagai baris kedua | vonis 4; `article_indexing_events` menunjuk objek sumber, bukan menggantikannya |
| BAN-PT dan LAM | `cpl_targets`, `obe_closing_actions`, `attendances`, `grades`, `clearances`, `graduation_records` | ekspor borang sebagai **draf beku** dengan `input_snapshot_hash`, versi instrumen, dan `evidence_digest` | salinan data bisnis yang dapat disunting di layar borang; status akreditasi yang diubah tanpa SK dan masa berlaku | vonis 4; DATA_MODEL §22.5.1 `accreditation_evidence`; gerbang (t) |
| e-Katalog dan LPSE | `requisitions`, `hps_items`, `tenders`, `procurement_contracts`, `receipt_assets` (M-46); `invoices`, `ledger` (M-10); `assets` (M-40) | rujukan pusat per paket dan kontrak, jejak kirim realisasi | nominal di tabel penunjuk (vonis 5 dan 6); kartu aset yang di-INSERT oleh adapter (vonis 6) | vonis 6; `receipt_assets` memicu service M-40, bukan INSERT sendiri |
| Bank dan VA | `invoices`, `payments`, `payment_allocations`, `ledger`, `receipts`, `blockades` | `external_ref`, `payments` hasil webhook, `reconciliation_runs` | nominal dari payload (W-6: nominal dari DB); `SETTLED` tanpa ledger satu transaksi; VA kedaluwarsa menjadi auto-lunas | §2.4; API_SPEC §4.7.7 W-1…W-10; `REVOKE UPDATE, DELETE, TRUNCATE ON ledger` |
| Konferensi | `classes`, `class_sessions`, `attendances` | `attendance_evidence` insert-only dengan `vendor`, `credential_ref`, `event_digest` | vonis dari vendor; daftar nama dan rekaman dan transkrip | §5.2 penahan 1 dan 4; §5.4 butir 3 dan 4; DATA_MODEL §21.6 butir 3 dan 4 |
| PIN dan SIVIL | `graduation_records` (nomor ijazah, SK, tanggal), `clearances` | `pin_reservations`, `e_certificates`, `certificate_verification_logs`, `sivil_verification_events`, `center_response_digest` | nomor PIN yang lahir tanpa reservasi berurutan; `pisn` yang dikarang; isi respons pusat disalin ke tabel modul | BR-R8; vonis 4; `pin_hash` HMAC; FK penahan `graduation_record_id` |
| ILS dan repositori | `bibliographic_records`, `items`, `circulations`, `library_fines`, `thesis_records` | sinyal bebas pustaka dengan `signal_state` dan `emitted_at`, rujukan id lokal (MIJ) dan digest | status kelulusan (vonis 3); tabel peminjaman kedua | `library_clearance_signals` (§22.7.1); peristiwa `library.loan.cleared`; gerbang (t) |

**Aturan yang dapat diuji (lima pertanyaan, semuanya berjawab ya atau tidak).**

1. **Tidak boleh ada `UPDATE` ke kolom bisnis dari adapter.** Sebuah adapter hanya boleh menulis tabel miliknya sendiri. Dalam bentuk yang dapat dijalankan di CI:

```
-- Q1: pemindaian statis. Hasil yang diharapkan = 0 baris.
--     Direktori transport (nama modul milik adapter) tidak boleh memuat tulisan ke tabel domain.
grep -rnE "(UPDATE|INSERT INTO)[[:space:]]+(students|enrollments|grades|invoices|ledger|attendances|clearances|graduation_records)" \
  apps/web/src/modules/feeder apps/web/src/modules/sister apps/web/src/modules/ip \
  apps/web/src/modules/procurement apps/web/src/modules/library apps/web/src/modules/pin
```

2. **Tabel transport tidak boleh punya kolom isi yang dapat disunting.** Yang diizinkan hanya empat golongan: penunjuk sumber (`source_entity`, `source_id`), kemasan (`canonical_payload`, `content_digest`, `payload_digest`), keadaan kirim (`sync_state`, `state`, `attempts`, `watermark`), dan apa yang pusat katakan apa adanya (`center_status`, `center_reference`, `feeder_id_returned`). Kolom berakhiran nominal atau angka akademik (`*_rupiah`, `*_bp`, `*_sks`, `*_score`) pada tabel transport = temuan. DATA_MODEL §22 menulis larangan ini untuk seluruh gugusnya (preamble vonis 1, 2, 4 dan 12) dan §22.11 sudah mengubahnya menjadi **cacah kolom uang** yang dapat dijalankan (query nomor 1 atas `apc_invoices`, `library_fines`, `clinic_billing_events`, `ticket_files`, `event_registrations`, `dormitories`, `crm_campaigns`, `career_vacancies` dengan `column_name ~ '(rupiah|amount|price|total|fee_value)'` — wajib 0 baris). Catatan keadaan: query itu **belum dapat dieksekusi** di basis data mana pun, karena tidak satu pun objek §22 punya berkas migrasi (`packages/database/migrations/` tetap 7 berkas) — jadi ia gerbang yang sudah bernama, bukan gerbang yang berjalan.
3. **Keadaan proyeksi ditegakkan oleh hak, bukan oleh disiplin tim.** Pola yang sudah ada di kanal lain dipakai ulang: `REVOKE UPDATE, DELETE ON <tabel transport> FROM sica_app` seperti pada `ledger` (§2.4) dan `certificate_verification_logs` (DATA_MODEL §22.1.2). Insert-only berarti koreksi = baris baru, dan `supersedes` lebih baik daripada suntingan.
4. **Id pusat hanya dari respons.** `feeder_id` hanya lewat `pddikti_payload_snapshots.feeder_id_returned` (I-14, §1.13 butir 2); `sister_portfolio_items.center_status` dan `ip_applications.center_reference` dan `graduation_records.pisn_verification_ref` mengikuti aturan yang sama: nilai nasional **tidak pernah** diterima dari body, tidak pernah dari impor massal, dan percobaan menulisnya menghasilkan `403` (PRD §5.13.2 butir 5; AC-HRS-1 kaki kedua).
5. **Kegagalan transport tidak pernah mengubah fakta.** Tidak ada jalur tulis dari tabel antrean mana pun ke `attendances`, `grades`, `enrollments`, `clearances`, `invoices`, atau rekap BKD: angka BKD **tidak pernah** berubah karena sinkron SISTER (FR-SIS-03), dan vonis kehadiran tidak pernah berasal dari laporan vendor (§5.4 butir 3). Uji penolakannya wajib, bukan diasumsikan (§6.6 nomor 2 dan 4).

**Yang secara eksplisit tidak dilakukan §6.2.** Ia tidak meminta tabel salinan baru, tidak meminta kolom `sister_*` di tabel modul, dan tidak menawarkan "sinkron satu arah ke tabel pusat sebagai sumber kebenaran". DATA_MODEL §22 preamble sudah menutup yang pertama dengan kalimat "Tidak ada `feeder_id` kedua di tabel modul mana pun"; gugus ini hanya memastikan kanal lain tidak menemukan jalan belakang.

### 6.3 Delta sync dan retry lintas sistem

**Tidak ada definisi baru di sini.** Mekanika kanonik adalah [ARCHITECTURE §12.10](file:///c:/SICA/docs/ARCHITECTURE.md) dan penjabaran yang dapat diuji adalah **§1.12** pada file ini: himpunan berubah tiga klausa (**§1.12.1**), digest dan SKIP (**§1.12.2**), urutan induk-sebelum-anak (**§1.12.3**), `Idempotency-Key` per record (**§1.12.4**), watermark yang hanya maju atas baris `SUCCEEDED` (**§1.12.5**), retry dan limiter dan DLQ sebagai cross-reference ke ARCHITECTURE §10.4.1 (**§1.12.6**), dan enam penahan anti-jalan-tikus (**§1.12.7**). Tabel di bawah **memetakan** keenam unsur itu ke kanal lain dan menambah hanya yang memang belum pernah dijawab di §1.12: granularitas watermark per sistem, urutan domain versi kanal lain, dan keadaan terminal ketika sistem tidak mengenal koreksi.

| Sistem | Kunci watermark | Himpunan berubah (pola §1.12.1) | Urutan wajib (pola §1.12.3) | Idempotensi (pola §1.12.4) | Retry dan terminal | Tombstone (BR-R10) |
|---|---|---|---|---|---|---|
| SISTER | `sister_delta_watermarks (tenant_id, endpoint_id, item_kind)` — **per episenter dan per jenis portofolio**, karena satu kampus dapat bicara ke produksi dan uji sekaligus (`sister_endpoints.environment` = `LOCAL`, `SANDBOX`, `PRODUCTION`, kosakata §15.3) | klausa A: `source_updated_at` maju; klausa B: transisi ber-`VALIDATE` di M-07, M-19, M-44; klausa C: baris `SUPPRESSED` beralasan | identitas pegawai (M-06) lalu bidang ilmu dan rumpun (kamus) lalu mengajar (M-14 dan M-18) lalu penelitian dan pengabdian (M-44) lalu publikasi dan HKI (M-21 dan M-22) lalu rekap BKD (M-07) | kunci turunan `(tenant_id, endpoint_id, item_kind, source_entity, source_id, content_digest, packer_version)`; **satu kunci per item**, tidak ada kunci kedua | `sister_sync_queue.state` memakai enum `queue_operation_state` dan `op_id` menunjuk `queue_operations` (`0030`), dengan dua nilai baru `SISTER_PUSH` dan `SISTER_PULL_RECONCILE` pada `queue_operation_kind` — **tidak ada mesin antrean kedua**; retry mengikuti ARCHITECTURE §10.4.1 dan kegagalan terminal menjadi **`NEEDS_REVIEW` plus temuan**, bukan hilang senyap | pembatalan item = baris `SUPPRESSED` dengan `conflict_detail` wajib terisi (CHECK menolak senyap); penghapusan fisik dilarang |
| DJKI | tidak berbasis watermark isi: **per permohonan**, `last_status_checked_at`; status pusat adalah keadaan, bukan diff | tarikan status atas `ip_applications` yang belum `GRANTED`, `REJECTED`, `LAPSED`, atau `RENEWED` dan belum diperiksa pada periode berjalan | permohonan lalu anuitas lalu lisensi (anak tidak diperiksa sebelum induknya diketahui) | kunci pada `(tenant_id, application_number, status_ditarik, checked_batch)` — menarik ulang status yang sama tidak membuat baris kedua | `attempts` sesuai norma antrean; setelah batas, permohonan tetap pada keadaan lokal dan hasilnya menjadi temuan `NEEDS_REVIEW`; **tidak** ada status otomatis yang naik karena respons pusat | riwayat status insert-only; penolakan tidak menghapus jejak percobaan |
| SINTA dan OAI-PMH | `resumptionToken` berversi plus jendela `from` dan `until` — watermark milik **pemanggil**, dan kita penyedia | bagi kita: tidak ada himpunan berubah untuk dikirim; yang berubah adalah **korpus** yang dimetik, dihitung dari `article_indexing_events` dan deposit baru | identik dengan §1.12.3: koleksi lalu records lalu sets; `identifier` stabil per objek sumber dan tidak pernah berubah ketika artikel diedit | `Idempotency-Key` per permintaan metik ditolak sebagai kunci kedua; determinisme dijaga oleh digest respons | kegagalan pemetik bukan keadaan SICA: pemetik yang hilang tidak pernah memicu retry keluar; **tidak ada panggilan keluar dari engine** | records yang ditarik kembali dinyatakan sebagai **deleted record** pada header respons, bukan hilang dari daftar; bentuk persisnya `[VERIFIKASI-RESMI]` terhadap spesifikasi OAI-PMH versi target |
| ARJUNA | tidak ada: tidak ada jalur langsung yang terbukti | — | — | — | — | — |
| BAN-PT dan LAM | bukan delta: **snapshot beku per ekspor** dengan `input_snapshot_hash`, versi instrumen, dan tanggal berlaku data | satu ekspor dibuat ketika periode penilaian dibuka atau ketika borang diminta ulang, bukan setiap perubahan baris | mengikuti graf fakta: kurikulum dan CPL lalu capaian lalu proses lalu lulusan lalu SDM dan sarana | `Idempotency-Key` per `(tenant_id, program_id, siklus, versi_instrumen)`; ekspor kembar atas snapshot identik = `200` dengan hasil yang sama, bukan berkas kedua | ekspor yang gagal tidak menggeser apa pun dan tidak membuat versi borang baru | pembatalan ekspor = ekspor pengganti yang menunjuk yang dibatalkan; borang lama tidak dihapus |
| e-Katalog dan LPSE | tarik: watermark per `(tenant_id, kanal, jenis_aset)` dari `updated_at` katalog; kirim: append-only tanpa watermark mundur | hanya baris katalog yang `updated_at`-nya maju; diff kosong = SKIP, tidak membakar kuota | vendor (`external_organizations` lalu `procurement_vendors`) lalu paket lalu tender lalu kontrak lalu realisasi | kunci tarik pada `(tenant_id, kanal, jenis_aset, halaman_kursor)`; kunci kirim pada `(tenant_id, kontrak_id, tahap_realisasi)` | retry dan DLQ milik kanal kirim yang terdaftar; kegagalan tarik tidak pernah membuat paket hantu | penarikan paket dinyatakan sebagai keadaan batal beralasan, bukan baris hilang |
| Bank dan VA | bukan delta sync — **webhook dan tarik status**; jangan memindahkan pola §1.12 ke kanal uang | — | — | `UNIQUE (tenant_id, channel_id, external_ref)` plus `idempotency_keys` (§2.4, AC-KEU-1) | tiga jalur bertemu satu fungsi; `SUSPENSE` adalah keadaan rekonsiliasi dana, penyelesaiannya `VALIDATE` peran `TREASURER` | tidak ada penghapusan: void dan koreksi = baris baru `reverses_entry_id` (I-4) |
| Konferensi | jendela sesi sah + identitas peristiwa, bukan watermark isi | interval diiriskan ke jendela sesi, lalu union; waktu di luar tidak dihitung (§5.3) | dedup dan validasi pasangan/gap sebelum agregasi; laporan kurang → degraded | key event + payload sama replay; beda payload 409; bucket menit bukan identitas JOIN/LEAVE. Constraint final DATA/API pending rekonsiliasi | retry/limiter mengikuti ARCHITECTURE; batch agregasi tidak menghilangkan interval sah | bukti tidak menghapus `attendances`; koreksi berizin/approval |
| ILS dan repositori | tarik: watermark per `(tenant_id, sistem_ils, jenis_laporan)`; sinyal keluar tanpa watermark | item yang `last_seen` atau `status`-nya maju plus antrian bebas pustaka yang baru lepas | anggota lalu item lalu peminjaman lalu denda; sinyal `library.loan.cleared` hanya setelah seluruh outstanding nol | kunci sinyal pada `(tenant_id, student_id, dimensi, periode)` sehingga replay tidak menghasilkan dua sinyal | kegagalan kirim sinyal tidak pernah mengubah `clearances` — M-30 dapat menghitung ulang dari fakta (§5.6, ARCHITECTURE §13.1 catatan) | sinyal yang dicabut dinyatakan sebagai keadaan baru dengan alasan, bukan baris hilang |

**Tiga aturan yang dipindahkan apa adanya dari §1.12 ke kanal lain, tanpa pengecualian:** (1) **retry tidak pernah menggeser watermark** (§1.12.5, §1.13 butir 6) — berlaku untuk SISTER, DJKI, LPSE, dan ILS; (2) **hard delete dilarang** dan penggantinya tombstone atau pernyataan pembatalan beralasan (BR-R10) — tidak ada satu pun kanal nasional yang boleh membuat penghapusan fisik; (3) **kegagalan terminal menjadi `NEEDS_REVIEW` plus temuan**, bukan baris yang hilang, sesuai batas sumber daya dan keadilan AGENTS §3.9 (retry maksimal 2 untuk engine; untuk transport angkanya dimiliki ARCHITECTURE §10.4.1 dan **tidak diputuskan di sini** — catatan jujur: §1.12.6 memakai `attempts` 4 untuk `feeder.push`, sedangkan AGENTS §3.9 menulis retry maksimal 2 untuk mesin; keduanya tidak bertabrakan karena yang pertama adalah **percobaan transport** dan yang kedua adalah **percobaan perhitungan engine**, dan kanal yang baru harus menyebut mana yang dia pakai, tidak boleh mengarang angka ketiga).

### 6.4 Adapter yang butuh pustaka lokal (design-only)

Norma: **AGENTS §3.9** — pustaka open-source lokal tanpa kredensial boleh, **dengan syarat** ia menjadi commit `package.json` plus lockfile nyata dan tercatat di **TECH_CONVENTIONS §7** (register design-only; §6 file itu adalah kontrak dependensi). Sebelum kedua itu terjadi, statusnya **design-only** dan tidak boleh diklaim berjalan di dokumen, layar, atau PR. Hasil ukur yang berlaku untuk **seluruh baris** tabel ini, dikutip dari blok pengukuran di pembuka §6: `fast-xml-parser` 0, `xml2js` 0, `node-forge` 0, `pdf-lib` 0, `marc` 0, `@aws-sdk` 0 pada `package.json` akar, `apps/web/package.json`, `packages/*/package.json`, `apps/mobile/pubspec.yaml`, dan `pnpm-lock.yaml`; `find apps/web/src/modules -type d -name engine` = 0 hasil.

| Adapter | Untuk modul dan kanal | Yang akan dipakai | Butuh kredensial | Status terukur | Syarat sebelum boleh diklaim |
|---|---|---|---|---|---|
| Serialis XML OAI-PMH | M-20 (repositori RAMA), M-21 (jurnal), M-39 (katalog) sebagai **pelayan metadata** untuk SINTA dan pemetik lain | serialis deterministik atas hasil baca (bukan engine keputusan) — pustaka XML lokal, misalnya `fast-xml-parser` atau `xml2js`, keduanya belum ada | **tidak** untuk peran penyedia; hanya token akses bila pemetik mensyaratkan, lalu ke vault/ENV | `design-only` — nol dependensi XML di manifest; ARCHITECTURE §13.5.1 (ALG-20) sudah menegaskan "serialis OAI-PMH bukan engine" | masuk manifest plus lockfile plus TECH_CONVENTIONS §7; golden vector byte-identik (gerbang (h)); `resumptionToken` berversi; **egress scan (g)** membuktikan tidak ada panggilan keluar |
| Parser dan serialis MARC21 serta crosswalk Dublin Core | M-39 katalog (`bibliographic_records.format_kind` sudah mengenal `MARC21`, `UNIMARC`, `DUBLIN_CORE` dan `marc_subfields` — DATA_MODEL §22.7.1), M-20 deposit, M-21 metadata | pembaca ISO 2709 plus pemeta subfield; pustaka MARC open-source lokal, belum ada di repo | **tidak** — parser adalah kode murni | `design-only` — `marc` = 0 di manifest; `CHECK (format_kind <> 'MARC21' OR marc_subfields <> '[]')` baru norma dokumen karena `0067` belum dieksekusi | masuk manifest plus register §7; round-trip byte-identik atas vektor fixtured; crosswalk wajib menyimpan versi profil agar dapat direproduksi |
| Adapter ILS SLiMS dan KOHA | M-39 sirkulasi, denda, bebas pustaka; M-20 validasi MiRIK | klien HTTP yang menunjuk `credential_ref`; protokol yang dirujuk (Z39.50 atau SRU atau rest) **belum diverifikasi** per versi target `[VERIFIKASI-RESMI]` | **ya** — kunci atau sandi layanan ILS kampus; hanya vault/ENV, dan nama kuncinya **wajib** masuk `ENV_CONTRACT.md` lebih dulu (§5.8 pola yang sama) | `blocked` plus `design-only` — ENV_CONTRACT 0 baris untuk kanal ini (terukur); objek sinkron ILS belum ada di §22.7.1 | keputusan objek oleh DATA_MODEL; registrasi kunci ENV; kode izin `resource × verb` di RBAC §4.5 lebih dulu (AGENTS §3.8 dan §3.11); uji bahwa adapter hanya menulis tabelnya sendiri (§6.2) |
| Penampil dan pembangkit PDF serta PDF/A untuk ijazah, transkrip, dan legalisir | M-35 dokumen resmi; M-30 SKPI; M-09 surat camaba | pustaka PDF lokal plus **perender PDF/A milik sendiri** (mis. `pdf-lib` atau `pdfjs` atau konversi di kontainer sendiri); **bukan** layanan konversi berbayar | **tidak** | `design-only` — `pdf-lib` = 0 dan `tesseract` = 0 (terukur); ALG-7 sudah menetapkan jalur utama tanpa OCR (ARCHITECTURE §11.9) | masuk manifest plus register §7 plus image kontainer; uji digest berkas (`e_certificates.document_digest_sha256`) dan uji retensi berkas mentah §11.9 |
| Tanda tangan elektronik CMS/PAdES (target) | M-35 dokumen dan M-19 transkrip | pustaka kriptografi lokal + kunci terkelola; algoritma/format dan rotasi dimiliki SECURITY/DATA_MODEL | connector PSrE/TSA dapat memerlukan kredensial setelah keputusan produk dan `[VERIFIKASI-RESMI]`; bukan kunci/egress dalam engine | design-only; **hash/HMAC atau jangkar WORM bukan otomatis tanda tangan tersertifikasi/cap waktu resmi**. Merkle/WORM belum dibuktikan deployed | verifikasi signature dan digest berkas terpisah dari verifier audit; uji trust chain, perubahan berkas, rotasi/revocation dan kebijakan hukum yang disahkan |
| Antrean kirim untuk seluruh kanal (§1.8, §5.2, §6.3) | M-34, M-08, M-22, M-46, M-39 | `bullmq` plus `ioredis` sebagai target ARCHITECTURE §10.4.1 | **tidak** (Redis milik sendiri) | `design-only` nyata — `bullmq` = 0 dan `ioredis` = 0 (`RD-11`, keputusan `P-6`); hari ini antrean adalah rancangan tabel/worker DB-backed (deployment dan ketahanan crash belum terbukti) | commit paket plus lockfile plus runbook DLQ plus uji beban §10.8; sebelum itu **dilarang** menyebut BullMQ sebagai arsitektur terpasang (AGENTS §3.9 "larangan turunan") |

**Batas deployment dan inferensi.** `tesseract`, `bullmq` dan `ioredis` absen manifest; OCR lokal dan antrean tersebut **design-only**, bukan bukti engine zero-API-key telah deployed. Tabel/worker DB-backed dan klaim tahan-crash juga memerlukan bukti implementasi serta failover sendiri. Connector eksternal boleh memakai kredensial service-side; engine lokal tetap tidak memegang API key vendor atau melakukan egress.

**GeoIP dan IsolationForest.** Jika dipakai, GeoIP membaca dataset lokal dengan sumber, versi, lisensi, tanggal/digest dan proses pembaruan yang disetujui; tidak memanggil API lokasi dari engine. GeoIP perkiraan jaringan, bukan lokasi/identitas pasti. IsolationForest adalah sinyal anomali berbasis data/fitur/model berversi, bukan bukti kecurangan atau keputusan otomatis. Keduanya memerlukan minimisasi PII, evaluasi false-positive/false-negative, bias, drift, DPIA/peninjauan hukum dan jalur banding manusia; tidak memberi jaminan akurasi atau legalitas universal. Ini kontrak desain, bukan klaim model/dataset sudah terpasang.

Bagian ini tidak memasang dependensi, membuat konfigurasi atau menjalankan adapter; register dependensi tetap milik TECH_CONVENTIONS.

### 6.5 Kamus nasional yang wajib di-seed sebelum kirim

Norma mengikuti AGENTS §3.10 dan DATA_MODEL §20.1. **Kamus kosong, stale atau belum terverifikasi menahan kirim**: tidak diganti 0, string kosong atau tebakan. Sebelum memakai referensi nasional, catat penerbit/sumber resmi, versi/skema, tanggal berlaku dan pengambilan, **lisensi/hak penggunaan**, digest snapshot, penanggung jawab serta bukti/tanggal verifikasi. Pembaruan memakai diff dan approval; versi lama dipertahankan untuk reproduksi.

`[VERIFIKASI-KAMUS]`/`[VERIFIKASI-RESMI]` adalah **pekerjaan verifikasi yang masih terbuka** (pemilik: integrasi untuk kamus/vendor dan legal untuk dasar hukum), bukan stempel bahwa nilai benar. Salinan `Get*`, dokumen atau seed nasional hanya fakta yang diterima dari sumber pada waktu tertentu, bukan verifikasi independen atas kebenaran/keberlakuannya. Nama kanal, klasifikasi dan versi pada tabel berikut tetap harus divalidasi terhadap sumber target; dokumen ini tidak mengarang URL, rumus nasional atau ketentuan hukum.

**Gugus 1 — entri yang sudah berlaku hari ini (rujukan nomornya ada, seed-nya belum).**

| Entri kamus | Kelas | Bentuk fisik yang sudah bernama | Sumber resmi yang wajib diverifikasi manusia | Konsekuensi bila belum di-*seed* |
|---|---|---|---|---|
| Wilayah administratif lima level | B | `reference_dictionary_entries (domain='WILAYAH', source='KEMENDAGRI')` plus `reference_items.parent_id` untuk hierarki lokal | kode Kemendagri; panjang kanonik per level **masih `[TIDAK-TERVERIFIKASI]`** di §1.10.2 — contoh §1.4(d) hanya memperlihatkan satu bentuk (mis. enam digit kecamatan) sehingga **pemeriksaan keanggotaan menang atas regex panjang** | `FEEDER_REGION_CODE_UNKNOWN` ber-verdict `FATAL` (§1.6.3 baris Kode wilayah); biodata berhenti sebagai `BLOCKING`; kelompok tarif UKT ikut berhenti karena fakta wilayah tidak ada (§5.7 langkah 3) |
| Agama | B | `pddikti_mappings (kind='VALUE', entity='agama')` plus kamus `GetAgama` | hasil `GetAgama` sandbox, bukan daftar hafalan | `id_agama` NULL dan payload MAHASISWA ditolak pusat per record (§1.2 baris A) |
| Jenis kelamin sebagai kode pusat | B | peta `local_code` ke `feeder_code` `L` atau `P` — **enum internal `M` dan `F` tidak diubah** (§1.4 huruf PDDikti, DATA_MODEL §14.5) | User Guide Feeder per instalasi | payload ditolak karena `M` dan `F` bukan kode pusat |
| Penghasilan penjamin dan pekerjaan | B untuk kode, C untuk label kampus | `reference_items (kind='penghasilan')` plus `id_penghasilan_ayah/ibu/wali` dan `id_pekerjaan_*` | `GetPenghasilan` dan `GetPekerjaan` | ALG-4 tidak boleh menetapkan kelompok tarif (§5.7 langkah 3 pada file ini plus PRD §5.14); pengajuan berhenti sebagai draf |
| Periode dan semester | B | `reference_dictionary_entries` hasil `GetSemester`; digit `ANTARA` **tidak** di-hardcode (§1.10.2) | `GetSemester` target | checkpoint CP1 dan CP2 tidak dapat dihitung; delta sync menahan baris |
| Jenis aktivitas mahasiswa, jalur masuk, pembiayaan, kebutuhan khusus, transportasi, jenis tinggal, jenjang pendidikan, negara | B | `reference_dictionary_entries` per domain plus `reference_kinds.feeder_code` (`has_external_dictionary = true` menandai kind yang **tidak boleh** punya nilai manual) | seluruh aksi `Get*` terdaftar di §1.4(n) dan DATA_MODEL §14.5 aturan 2 | nilai dikarang = penolakan per record plus temuan risiko di panel Kesehatan Data (BENCH-131) |
| Jenis Tugas Akhir yang ikut kirim | B | `final_project_kinds.feeder_jenis_ta` — **NULL berarti TIDAK DIKIRIM** (I-14, §1.14.3) | kamus jenis TA pusat per versi | luaran non-skripsi tidak pernah naik ke KELUAR; itu **batas**, bukan fitur |
| Modus pembelajaran `F`, `O`, `M` | B | `pddikti_mappings (kind='VALUE', entity='sifat_pembelajaran')` plus kolom payload `feeder_sifat_pembelajaran` (§1.16.1) | User Guide atau sandbox; `modPkk` dan `idPembelajaran` tetap **penahan** (§1.16.3) `[VERIFIKASI-RESMI]` | baris KELAS **tidak ikut kirim** dengan temuan `FEEDER_DICTIONARY_STALE` (dinormakan sebagai `RD-52`); **tidak ada** `CASE WHEN BLENDED THEN 'M'` di packer |
| Digit pemeriksaan NISN | B | `reference_kind_usage` plus kind `nisn_checksum` yang **belum terdaftar** (§1.15 butir 4) | sumber resmi penentuan checksum NISN; rumus **tidak boleh** ditulis dari ingatan agen (§1.11.4) | `SEM-NISN-CHK` wajib `NOT_IMPLEMENTED` dan menolak kirim (terukur: `grep -icE "nisn" docs/SEED_DATA.md` = 0) |
| Gelar untuk pemotongan nama | B | `reference_kinds (kind='gelar')` **belum ada** di register §14.2 yang ber-17 kind | daftar gelar resmi yang dipakai pusat | `FMT-TITLE` tidak punya allowlist sehingga fail-closed sebagai `REVIEW`, bukan auto-strip (§1.11.3) |

**Gugus 2 — entri baru yang ditagih modul gelombang ini.** Semua baris adalah **permintaan ke pemilik objek dan seed** (DATA_MODEL dan SEED_DATA), bukan daftar yang §6 sahkan sendiri.

| Entri baru | Kelas | Nama yang diminta (final milik DATA_MODEL) | Modul dan kanal yang membutuhkannya | Sumber resmi yang wajib diverifikasi manusia | Konsekuensi bila belum di-*seed* |
|---|---|---|---|---|---|
| Jenis portofolio SISTER | C | `reference_items (kind='item_sister')` — **sudah dirujuk** DATA_MODEL §22.2.3 (`sister_sync_queue.item_kind`, `sister_portfolio_items.item_kind`) dan sengaja **tanpa CHECK daftar** | M-08 transport; penghasil M-06, M-07, M-14, M-18, M-19, M-20, M-21, M-22, M-44 | senarai jenis item dan kode padanannya pada kanal SISTER target `[VERIFIKASI-RESMI]` — pusat menambah jenis tanpa menunggu rilis kita, jadi kind tidak boleh jadi enum | `sister_portfolio_items.item_kind` tidak terisi dan **tidak ada item yang dapat dikirim**; antrean kosong harus tampil sebagai temuan, bukan sebagai "sukses nol baris" |
| Skema hibah nasional (Dikti, DRTPM, Litabmas dan setara) | **B** | kolom `grant_schemes.external_scheme_code` sudah ada (DATA_MODEL §22.5.3) sebagai kelas B — nilai kodenya butuh `reference_dictionary_entries (domain='SKEMA_HIBAH')` berversi plus `effective_from` dan `effective_to` | M-44 dan M-11 (skema beasiswa nasional adalah domain terpisah) | panduan skema dan kode tahunan dari kementerian yang mengelola hibah pada tahun anggaran berjalan `[VERIFIKASI-RESMI]`; kode **tidak dapat** diubah tenant, hanya label | `external_scheme_code` NULL berarti proposal **tidak dapat** dilaporkan sebagai luaran skema nasional; `funder_kind='GOVERNMENT'` tanpa kode skema = temuan `BLOCKING`, bukan nol |
| Jenis luaran hibah dan capaian kontrak | C | `reference_items (kind='luaran_hibah')` — sudah dirujuk §22.5.3 (`research_outputs.output_kind_item_id`) | M-44, M-07 (kelayakan masuk BKD), M-31 dan M-32 (borang dan IKU) | daftar luaran wajib dan tambahan per skema `[VERIFIKASI-RESMI]` | `research_outputs` tidak berjenis dan karena itu tidak dapat dibaca M-07 maupun M-31; angka borang akan **kurang**, bukan salah — itu sebabnya mode turun wajib dilaporkan |
| Jenis HKI | C | `reference_items (kind='jenis_hki')` — sudah dirujuk §22.5.2 (`ip_applications.ip_type_item_id`) | M-22, M-08 (luaran portofolio), M-44 (luaran kontrak) | klasifikasi resmi DJKI (paten, paten sederhana, merek, desain industri, dttn, varietas tanaman, rahasia dagang, indikasi geografis) `[VERIFIKASI-RESMI]` — §22.5.2 menolak `CHECK (type IN (...))` justru karena DJKI bertambah | permohonan tidak dapat diajukan dan **tidak dapat** dipetakan ke kanal mana pun; nol baris permohonan yang seharusnya diajukan harus terlihat sebagai temuan |
| Status dan label HKI | A′ | `reference_items (kind='status_hki')` untuk label; keadaan mesin tetap enum `ip_application_status` kelas A (§22.5.2) | M-22, M-31 (borang), M-08 | label resmi per keadaan `[VERIFIKASI-RESMI]` | label salah tidak mengubah keadaan — itu gunanya kelas A′ — tetapi membuat borang tidak dapat dibaca asesor |
| Peringkat dan masa berlaku akreditasi (BAN-PT dan LAM per rumpun) | **B** | `reference_dictionary_entries (domain='AKREDITASI')` plus satu kind kelas C untuk rumpun lembaga; kolom fisik sudah menunggu di `journals.accreditation_item_id` (§22.5.1) dan **belum ada padanan untuk program studi** — permintaan kolom ke DATA_MODEL, karena PRD §9.2 butir 5 menuntut verifikasi nomor SK dan masa berlaku per prodi sebagai gerbang yudisium | M-31, M-37, M-30, M-35, M-34 (akreditasi ikut naik ke `GetProdi`) | **dua sumber berbeda dan keduanya manusia**: peringkat dari lembaga akreditasi yang berwenang per rumpun, dan salinan nilai pusat dari `GetProdi` (§1.7.2 baris pusat-dasar) `[VERIFIKASI-RESMI]` | tanpa kamus: status akreditasi tidak terisi, gerbang yudisium dan terbit ijazah **menahan** (bukan meloloskan dengan nilai kosong), dan borang tidak dapat diekspor |
| Indeks publikasi nasional dan internasional | C | `reference_items (kind='indeks_publikasi')` — sudah dirujuk §22.5.1 (`article_indexing_events.index_item_id`) | M-21, M-07, M-31, M-32, M-08 | daftar indeks yang diakui pada versi instrumen penilaian yang berlaku `[VERIFIKASI-RESMI]` — SINTA dan Scopus dan DOAJ dan Google Scholar **tidak setara** dan perbedaan itu adalah data, bukan kode | peristiwa indexing tanpa `index_item_id` tidak dapat dihitung ke borang; hasil SINTA tidak pernah boleh ditulis manual sebagai peringkat jurnal |
| Mata uang dan kurs untuk transaksi non-rupiah | **B** | `reference_dictionary_entries (domain='MATA_UANG')` — kode mengikuti ISO 4217 (standar terbuka, namun **tetap wajib diverifikasi pada daftar resmi**), plus rate berversi di objek yang pemiliknya DATA_MODEL tentukan | M-29 (biaya mobilitas), M-11 (beasiswa luar), M-46 (impor), M-10 (pelaporan) | daftar ISO 4217 dan sumber kurs resmi yang dipakai kampus `[VERIFIKASI-RESMI]` | seluruh nominal internal **tetap `bigint` rupiah utuh** (ADR-5) tanpa mata uang; konversi tidak dapat dilakukan dan karena itu transaksi valas ditolak, bukan dikonversi dengan kurs tebakan |
| Kanal dan bank penerbit VA | C untuk label kanal, **tabel struktur untuk bentuk** | `payment_channels` (§2.4) adalah pemilik `bank_code` dan `va_pattern`; **kanal pembayaran tidak dipindahkan ke key-value** (AGENTS §3.10: aturan struktural punya tabel sendiri); label bank dan nama tampilan adalah kamus kelas C menurut DATA_MODEL §20.1 | M-10, M-09, M-23, M-39, M-41, M-42, M-44 | daftar kanal yang aktif pada kontrak agregator kampus dan kode bank penerbit VA `[VERIFIKASI-RESMI]` | tanpa baris `payment_channels` aktif tidak ada VA yang dapat terbit; tagihan tetap terbit dan tetap tertahan — **bukan** lunas dengan kanal kosong |
| Bidang ilmu dan rumpun keilmuan | C sudah terdaftar, nilai belum di-*seed* | `reference_items (kind='bidang_ilmu')` — terdaftar §14.2 dan dipakai ulang FR-SIS-01 tanpa membuat kind kembar | M-06, M-07, M-08, M-20, M-21, M-44, M-31 | rumpun bidang ilmu yang dipakai kanal nasional target `[VERIFIKASI-RESMI]`; bila SISTER dan Feeder memakai rumpun berbeda, **dua peta nilai**, satu kind | tanpa nilai: portofolio SISTER tidak dapat diklasifikasi dan pengajuan berhenti; kind yang kosong tidak boleh diisi string bebas (§19.2 melarang `program_type` di-*infer* dari string) |

**Empat aturan yang membuat §6.5 tidak berubah menjadi tumpukan permintaan.** (1) Kelas B **tidak dapat disunting tenant**: yang berubah adalah versi kamus, bukan nilainya, dan tenant hanya memetakan label (DATA_MODEL §20.1 kelas B). (2) Setiap `kind` yang dibaca UI **wajib** punya baris `reference_kind_usage` sebelum layarnya ada — gerbang CI (n) (TECH_CONVENTIONS §7). (3) Versi kamus ikut masuk kunci idempotensi (`dictionary_version`, §1.12.2 butir 2), sehingga seed yang berubah **terlihat** sebagai perubahan payload, bukan sebagai kejutan saat penolakan CHECKPOINT. (4) Nilai `is_active = false` tetap terbaca lewat `?at=YYYY-MM-DD` (BR-R12) supaya laporan tahun lalu dapat direkonstruksi setelah pusat mencabut sebuah kode.

### 6.6 Uji kontrak integrasi

**Didaftarkan, bukan dijalankan.** Keadaan terukur hari ini: 15 berkas uji di `apps/web/tests` (`find` atas `*.test.ts`), `apps/web/tests/integration/tenant-rls.test.ts` dan `apps/web/tests/security/api-security-guards.test.ts` adalah satu-satunya uji lintas lapis yang ada, dan **nol** direktori `fixtures` di seluruh repo. Jadi tidak satu pun baris di bawah ini hijau hari ini; huruf gerbang CI yang disebut adalah milik ARCHITECTURE §12.12 dan §13.7 serta TECH_CONVENTIONS §7 — §6 **tidak menambah abjad baru** dan tidak mengklaim gerbang.

| Uji | Yang dibuktikan | Teknik dan fixture | Gerbang yang sudah bernama | Status |
|---|---|---|---|---|
| `UJI-INT-01` contract test per adapter | bentuk permintaan dan respons adapter terhadap **salinan respons resmi**, bukan layanan hidup: satu fixture per sistem per aksi (mis. respons verifikasi SISTER, tarikan status DJKI, halaman katalog LPSE, respons SIVIL) disimpan dan dibandingkan byte per byte atas bagian kanonik | fixture JSON dan XML di direktori fixture per kanal (belum ada); `nock`-style interception **tidak digunakan** karena adapter tidak boleh memanggil jaringan dalam uji | pola harness §11.2 (input snapshot) dan corak golden vector ARCHITECTURE §13.7 (h) | **belum ada** — nol fixture di repo |
| `UJI-INT-02` uji penolakan tulis tabel domain | adapter dan mesin **tidak dapat** menulis `students`, `enrollments`, `grades`, `invoices`, `ledger`, `attendances`, `clearances`, `graduation_records`: setiap usaha menghasilkan `403` atau ditolak hak, **bukan** `201` | uji tulis dari role aplikasi plus query Q1 §6.2 di CI atas direktori adapter | (j) uji penolakan engine; (t) nol rute tulis di luar pemilik objek; DATA_MODEL §18.9(7) | **belum ada** |
| `UJI-INT-03` uji id pusat hanya dari respons | usaha mengisi `feeder_id`, `center_status`, `center_reference`, `pisn_verification_ref` dari body atau impor massal **ditolak**; satu-satunya jalan masuk adalah jalur respons Bridge | uji penolakan per kanal plus query "tidak ada id yang lahir tanpa jejak snapshot" (DATA_MODEL §8 nomor 7) untuk Feeder | I-14; §1.13 butir 2; PRD §5.13.2 butir 5; AC-HRS-1 kaki kedua | **belum ada** |
| `UJI-INT-04` uji kegagalan vendor tidak mengubah status akademik | sisip `TIMEOUT`, `HTTP 500`, dan respons tak-valid-skema dari setiap kanal: baris `attendances`, `grades`, `enrollments`, `clearances`, `invoices`, `graduation_records` **tidak boleh berubah satu kolom pun**; yang berubah hanya tabel antrean dan temuan | uji terarah dengan vendor di-stub; bandingkan himpunan kolom tabel domain sebelum dan sesudah, dan selisih yang diizinkan hanyalah nol | §5.4 butir 3; §1.13 butir 9; vonis 3 PRD §5.13.1; ARCHITECTURE §13.7 (w) untuk preseden "sinyal tidak memvonis" | **belum ada** |
| `UJI-INT-05` uji watermark tidak maju atas baris gagal | run `PARTIAL` atau `REJECTED` **tidak menggeser** `feeder_sync_watermarks` maupun `sister_delta_watermarks`; `row_count` hanya menghitung yang `ACKNOWLEDGED` | run fixtured dengan subset sukses; bandingkan airmen sebelum dan sesudah | §1.12.5; §1.13 butir 6; DATA_MODEL §18.5 penutup; ARCHITECTURE §12.10 aturan (a) | **belum ada** |
| `UJI-INT-06` uji idempoten dan replay | dua notifikasi kembar, dua metik pada jendela sama, dan dua percobaan kirim atas digest sama menghasilkan **tepat satu** baris bukti atau satu hasil `200 {replayed:true}`; tidak ada baris kedua dan tidak ada denda ganda | replay tiga kali atas fixture yang sama; jumlah baris bukti yang dihasilkan **wajib** satu | §5.3 (idempoten per jendela); §2.4 AC-KEU-1; §1.12.4 kunci per record | **belum ada** |
| `UJI-INT-07` golden vector serialisasi | OAI-PMH XML, record MARC21 ISO 2709, crosswalk Dublin Core, dan amplop `pkcs#7`: keluaran byte-identik dari masukan fixtured, termasuk urutan atribut dan penanda versi profil | vektor fixtured per format; diff byte; seed dan versi profil tersimpan | (h) golden vector; §11.2 harness; (i) paritas numerik TS dan Dart bila ada angka di dalamnya | **belum ada** — dan **tidak dapat** ditulis sebelum pustakanya nyata (§6.4) |
| `UJI-INT-08` uji egress dan kredensial | tidak ada `fetch(`, `axios`, atau `https.request` di direktori adapter dan engine kecuali pada **transport kanal** yang terdaftar; tidak ada kredensial di `master_system_parameters` (`CHECK (is_secret = false)`), di body, di log, atau di proyeksi peran mana pun (Admin IT hanya reference/metadata, bukan secret) | pemindaian statis plus uji proyeksi kolom `credential_ref` | (g) egress scan; §5.5 butir 3; §22.2.3 RLS; AGENTS §3.9 | **belum ada** — hasil ukur hari ini: 2 `fetch(` dan keduanya same-origin (§6 pembuka) |
| `UJI-INT-09` uji PII dan tombstone | payload dan bukti **tidak memuat** PII terlarang; tidak ada `DELETE` fisik pada tabel transport dan antrean; penghapusan hanya dinyatakan sebagai pembatalan beralasan | inspeksi kunci terlarang pada fixture respons plus uji `DELETE` harus gagal | (v) nol PII di amplop peristiwa; §1.13 butir 7; BR-R10; §5.4 butir 4 | **belum ada** |
| `UJI-INT-10` uji kamus kosong berarti tidak dikirim | dengan seed kamus nol baris: kolom pemetaan `NULL`, baris **tidak masuk** kandidat kirim, dan panel Kesehatan Data menampilkan temuan — **bukan** nol, bukan string kosong, bukan baris terkirim | kosongkan seed pada basis uji; keadaan yang dihasilkan **wajib** `NOT_IMPLEMENTED` dan jumlah job kirim nol | §1.16.1 gerbang kirim; §1.13 butir 8; `RD-52`; gerbang (m) dan (n) untuk sisi UI | **belum ada** — ini uji yang paling sering dilewati dan paling mahal saat penolakan CHECKPOINT |
| `UJI-INT-11` uji kontrak lingkungan per kanal | setiap nama kunci baru wajib muncul di `ENV_CONTRACT.md` **sebelum** adapter membacanya; uji statis menolak `process.env.X` yang tidak terdaftar | diff atas nama variabel yang dibaca kode terhadap ENV_CONTRACT | pola §5.8 baris "Kredensial provider di vault/ENV"; §1.10.1 baris `FEEDER_*` (9 variabel terdaftar, `FEEDER_TOKEN_TTL_SECONDS` masih kurang) | **belum ada** — dan hari ini ENV_CONTRACT memuat **0** baris untuk SISTER, DJKI, SINTA, LPSE, SIVIL, ZOOM, BBB, JITSI, KOHA, SLiMS (terukur) |
| `UJI-INT-12` uji reproduksi lintas sistem | hasil kanal pada tanggal sama dapat dihitung ulang identik: `engine_code`, `engine_version`, `parameter_version`, `input_snapshot_hash`, `Idempotency-Key`, `budget`, `explain` tersimpan per run, termasuk untuk kanal non-engine (transport) | jalankan dua kali pada snapshot fixtured; bandingkan keluaran dan jejak | §11.2 harness; ARCHITECTURE §12.10; NFR-Z3 | **belum ada** |

**Cara membaca tabel ini di ROADMAP.** Urutan pengerjaan yang sah tidak boleh dibalik (AGENTS §3.11): norma FR dan BR dan AC di PRD, nama objek plus DDL plus nomor di DATA_MODEL, kode izin di RBAC_MATRIX §4.5 lalu `PERMISSION_SPECS` dan `gen-rbac-seed.mjs` dijalankan ulang, path plus kode error di API_SPEC, pola layar di UI_UX_DESIGN, task di ROADMAP_TASKS — **baru** adapter dan ujinya. Enam uji pertama (`01` sampai `06`) dapat ditulis lebih dulu sebagai **uji atas kontrak yang sudah dinormakan**; `07` dan `08` menunggu dependensi; `11` adalah gerbang yang membuat kanal tidak lahir diam-diam.

### 6.7 Register kanal dan prasyarat penutupan

Tabel berikut menyimpan **baseline historis 2026-10-20**; angka berkas/izin/ENV dan kekosongan objek di dalamnya bukan inventaris kini. Prasyarat terkini dikoreksi pada daftar setelah tabel dan §5.8. Status runtime per lingkungan tidak diukur pada siklus docs-only ini.

| M-xx | Sistem atau adapter | Status baseline | Penahan pada snapshot historis |
|---|---|---|---|
| M-34 | PDDikti Neo Feeder (Bridge plus staging plus autofix plus delta sync) | `blocked` | `0028`, `0031`, `0040`, `0044` sampai `0046` belum dieksekusi (migrations = 7 berkas); Feeder Bridge 0 baris kode; kamus `F`/`O`/`M` belum di-*seed* (`RD-52`) |
| M-34 | PDDikti pangkalan data (API publik, tarik) | `blocked` | tidak ada baris ENV_CONTRACT; skema belum diverifikasi `[VERIFIKASI-RESMI]`; rekonsiliasi resmi tetap lewat `Get*` (§1.7.2) |
| M-08 | SISTER 2.0 (delta hash plus antrean) | `spec-only` | objek diklaim `0055` dan belum berjalan; **kredensial SISTER belum diputus** (ENV_CONTRACT 0); versi antarmuka tidak diketahui; `hr.sister.sync` belum masuk `PERMISSION_SPECS` (0 dari 224 entri `resource:`) |
| M-07 | SISTER sebagai sumber angka BKD | **DITOLAK oleh desain** | vonis 7: angka milik M-07; kanal hanya mengirim item dan status (AC-HRS-1 kaki kedua) |
| M-22 | DJKI (pengajuan dan tarik status) | `blocked` | `0062` diklaim dan belum berjalan; klasifikasi jenis HKI belum di-*seed*; bentuk layanan `[VERIFIKASI-RESMI]`; nol kode izin kanal di `PERMISSION_SPECS` |
| M-21 dan M-39 dan M-20 | Serialis OAI-PMH plus Dublin Core (peran penyedia untuk SINTA) | `design-only` | pustaka XML 0 di manifest; profil crosswalk belum berpemilik; golden vector belum dapat dibuat |
| M-39 | Parser MARC21 dan UNIMARC | `design-only` | `marc` 0 di manifest; `format_kind` dan `marc_subfields` baru spesifikasi (`0067`) |
| M-39 | Adapter ILS SLiMS dan KOHA plus repositori (RAMA M-20) | `blocked` | tidak ada objek sinkron ILS di §22.7.1 saat diukur; bentuk protokol `[VERIFIKASI-RESMI]` per versi; kunci ENV belum didaftar |
| M-44 | Skema hibah Litabmas dan setara plus ARJUNA | `blocked` | `external_scheme_code` sudah ada sebagai kelas B tetapi **kamunya belum ada**; ARJUNA kemungkinan tidak punya API langsung `[VERIFIKASI-RESMI]` |
| M-31 dan M-37 | Ekspor borang BAN-PT dan LAM plus proyeksi status akreditasi | `spec-only` untuk ekspor, `blocked` untuk tarik otomatis | belum ada objek akreditasi **per program studi** (permintaan kolom ke DATA_MODEL); instrumen versi berjalan `[VERIFIKASI-RESMI]`; PRD §9.2 butir 5 menuntut verifikasi SK dan masa berlaku |
| M-46 dan M-40 dan M-10 | e-Katalog dan LPSE (tarik katalog plus kirim realisasi) | `blocked` | M-46 dihitung `NOL` di PRD §5.12.1; objek diklaim `0069` dan belum berjalan; **tidak ada kolom rujukan pusat per paket atau kontrak** (terukur pada §22.7.3); API key LPSE tidak terdaftar |
| M-10 | Bank dan VA multi-kanal plus QRIS | `spec-only` | nol rute webhook; verifier belum ada di `src`; `0015` dan `0022` belum berwujud; kunci ENV **sudah** terdaftar (bagian yang siap) |
| M-35 dan M-30 | PIN dan SIVIL plus PDF/A dan TTE | `blocked` plus `design-only` | `0052` diklaim dan belum berjalan; `pin_hash` HMAC baru spesifikasi; `node-forge` dan `pdf-lib` dan `tesseract` = 0; **TSA RFC 3161 sudah ditolak** (ADR-14) dan PSrE tersertifikasi butuh keputusan produk `[VERIFIKASI-RESMI]` |
| M-18 dan M-15 dan M-16 | Konferensi: BBB dan Jitsi self-host plus Zoom dan Meet dan Teams | `design-only` | nol dependensi; nol rute `attendance/events/**`; `bullmq` dan `ioredis` design-only; penampung tautan identitas vendor belum diregistrasi (§5.8) |
| M-09 dan M-30 dan M-41 dan M-29 | Verifikasi NIK lewat DUKCAPIL | `blocked` | tidak ada integrasi (§1.10.2); engine hanya membaca hasil tersimpan |
| seluruh modul pemancar | WhatsApp dan Email plus object storage | `spec-only` | §3.1 dan §4.2 adalah kode spesifikasi; `bullmq` dan `ioredis` dan `@aws-sdk` = 0 (terukur) |

**Daftar penahan yang membuat gugus ini berhenti sebagai peta (dideretkan supaya tidak diminta dua kali).**

1. **Kredensial:** gunakan registrasi ENV_CONTRACT terkini (termasuk §7 untuk kanal konferensi); entri dokumen tidak membuktikan provisioning, consent vendor atau rotasi. Kanal yang belum terdaftar tetap blocked; tidak ada secret di parameter/body admin.
2. **Migrasi:** hitungan lama 7 berkas tidak berlaku sekarang; `0047`/`0049` sudah berberkas. Ketersediaan berkas berbeda dari eksekusi DB. Setiap adapter perlu bukti migrasi/role/RLS pada lingkungan target, tanpa mengklaim diterapkan dari inventaris file.
3. **Antrean:** `bullmq`/`ioredis` design-only (`RD-11/P-6`); worker DB-backed memerlukan bukti crash/failover sendiri. Retry mengikuti pemilik ARCHITECTURE, bukan angka baru di sini.
4. **Kamus:** SEED_DATA §8 sudah memuat kontrak referensi. Kontrak/seed tidak membuktikan sumber, versi, lisensi, keabsahan mapping atau jumlah baris DB; kirim tetap tertahan bila verifikasi §6.5 belum lengkap.
5. **Izin:** gunakan RBAC_MATRIX dan katalog terkini; izin proposal belum aktif tetap pending. Tidak menyalin jumlah/ketiadaan kode dari snapshot lama dan tidak menciptakan kode izin di §6. Governance IT tetap terpisah dari approval bisnis.
6. **Selisih entitlement yang belum didamaikan.** PRD §5.12.1 menaruh M-08 pada `usulan: sister`, sementara RBAC §4 menaruh `hr.sister.sync` di bawah kode nyata `hr_bkd` dan baris seed `0004_entitlement_modules.sql:89` sudah melabeli `hr_bkd` sebagai "SDM dan BKD dan SISTER". Pemilik `packages/contracts/src/entitlement.ts` dan DATA_MODEL §12.2 yang memutuskan; §6 tidak memilih satu pihak.
7. **Pustaka adapter.** Seluruh baris §6.4 bernilai **design-only** karena nol di manifest (terukur). Ia menjadi nyata hanya lewat commit `package.json` plus lockfile plus entri TECH_CONVENTIONS §7; menyebutnya "sudah terpasang" adalah pelanggaran AGENTS §3.9 yang eksplisit.

**Catatan pemeliharaan gugus §6.**

1. **§6 adalah pemilik peta, bukan pemilik angka.** Tidak ada satu pun nominal, tidak ada satu pun versi skema vendor, tidak ada satu pun kode izin, dan tidak ada satu pun nama objek yang diputuskan di sini. Bila sebuah baris §6.1 bertentangan dengan §1 sampai §5 atau dengan dokumen pemilik, **yang lain itu yang menang** dan §6 diralat pada commit yang sama (corak §5.9 butir 3).
2. **Rujukan GLOSSARY kini menunjuk bagian yang ada.** Entri *SISTER* di `docs/GLOSSARY.md` baris 105 menunjuk `INTEGRATIONS §6.2`. Setelah gugus ini ada, bacaannya: **§6.1** untuk siapa apa dan **§6.2** untuk norma transport bukan pemilik fakta. Pemindahan penunjuk itu menjadi satu kata saja adalah pekerjaan **pemilik GLOSSARY**, bukan pekerjaan §6, dan §5.9 butir 2 yang sebelumnya menyebut rujukan itu "hantu" sekarang punya alamat.
3. **Penanda yang dipakai dan artinya.** `[VERIFIKASI-RESMI]` berarti wajib diambil dari sumber resmi oleh manusia sebelum pengiriman (nama sistem, versi skema, klasifikasi kamus, bentuk layanan). `[VERIFIKASI-VENDOR]` tetap milik §5.5 dan dipakai di sini **hanya** untuk kanal konferensi. `[TIDAK-TERVERIFIKASI]` tetap milik §1.10.2 dan tidak dipindahkan ke kanal lain tanpa alasan. `[PIHAK-KETIGA]` dan `[DOK]` dan `[USUL]` tidak dipakai ulang di §6.
4. **Yang sengaja tidak dibuat di §6.** Tidak ada `INTEGRATION_SPEC.md` (ralat `RD-57`). Tidak ada tabel `master_lookup_*` kedua (view `security_invoker` sudah punya pemilik di DATA_MODEL §20.2). Tidak ada kolom `sister_*` di tabel modul, tidak ada `feeder_id` kedua, tidak ada jalur tulis dari kanal mana pun ke tabel domain. Tidak ada nomor migrasi yang dibagikan. Tidak ada klaim kemampuan sebelum pustakanya nyata.
5. **Cara memperbarui.** Satu baris §6.1 baru menuntut lima hal sebelum ditulis di sini: ia punya `M-xx` penghasil dari registri PRD §5.12.1, punya satu vonis §5.13 yang menunjuk pemilik angkanya, punya permintaan objek eksplisit ke DATA_MODEL (bukan DDL karangan §6), punya titik aksi yang belum ada di RBAC §4.5 didaftarkan sebagai penahan §6.7, dan punya paling sedikit satu uji di §6.6. Baris yang tidak memenuhi itu tidak masuk peta; ia masuk daftar tunggu.

### 6.8 Microsoft Teams sebagai kanal vicon — kontrak, peta muatan, dan kegagalan (baru 2026-10-21)

Permintaan pemilik menempatkan Teams sebagai kanal resmi kampus melalui **Microsoft Graph** dengan *tenant binding* Azure AD. Di dokumen ini Teams diperlakukan **sama persis** dengan kanal vendor lain: **transport**, bukan pemilik fakta (`§6.2`), dan **bukan** mesin (`AGENTS §3.9`). Angka kehadiran tetap dihitung M-18 (`DATA_MODEL §21.5`, `API_SPEC §4.19`).

> Semua nama sumber daya di bawah berpenanda **`[VERIFIKASI-VENDOR]`** sampai dokumen Microsoft diverifikasi langsung pada lingkungan ini; tidak ada satu pun yang boleh dikutip sebagai bukti sudah teruji. Ini norma yang sama dipakai untuk Feeder dan SISTER (`§6.7`), dan tujuannya supaya bagian ini tidak menjadi janji terselubung.

#### 6.8.1 Bentuk hubungan dan kredensial

| Aspek | Kontrak |
|---|---|
| Identitas | aplikasi *confidential client* di tenant kampus (app-only, bukan delegasi pengguna) — `TEAMS_TENANT_ID` + `TEAMS_CLIENT_ID` + `TEAMS_CLIENT_SECRET` (`ENV_CONTRACT §7`) `[VERIFIKASI-VENDOR]` |
| Perolehan token | target *client credentials flow* dan renewal terkontrol `[VERIFIKASI-VENDOR]`; kegagalan token tetap mungkin, fail-closed dengan status degraded/FAILED dan sebab teredaksi, bukan janji pengguna tidak pernah melihat kegagalan |
| Cakupan minimal | membuat/membaca *online meeting* atas nama pengampu, membaca laporan kehadiran berlangganan, menerima notifikasi perubahan. Tidak ada cakupan surat, pesan pribadi, atau file drive `[VERIFIKASI-VENDOR]` |
| Penyimpanan | hanya `credential_ref` yang masuk DB; rahasia di vault/ENV. `conference_connections.external_tenant_ref` menyimpan id penyewa sisi vendor bila perlu pencocokan |
| Pseudonim | HMAC email/UPN kanonik dengan kunci tenant terkelola sesuai SECURITY, bukan hash biasa/salt publik; reference/version saja di konfigurasi. Email/NIM mentah tidak masuk event/log; mapping peserta service-side dan scoped |

#### 6.8.2 Peta muatan — Graph ke objek SICA

| Muatan sumber (satu laporan/langganan) | Kolom tujuan | Aturan pemetaan |
|---|---|---|
| id pertemuan unik sisi vendor | `conference_meetings.external_meeting_id` | `UNIQUE (tenant, provider, external_meeting_id)`; pertemuan tanpa baris ini ditolak, tidak dibuatkan diam-diam |
| interval kehadiran peserta (`FirstJoin`, `LastLeave`, `JoinCount`, daftar upaya; nama field belum terverifikasi) | `conference_channel_events` + `attendance_channel_evidence.join_seconds` | dedup event/laporan, iriskan setiap interval ke jadwal sesi, lalu **union** overlap lintas perangkat/sumber sah; hitung panjang union, bukan `LastLeave − FirstJoin` atau penjumlahan overlap ganda |
| peran peserta (presenter/pemakalah/pengamat) | `conference_channel_events.event_type` + keterangan | pengamat tanpa upaya bergabung tidak pernah menjadi `PRESENT` |
| sidik jari muatan | `conference_channel_events.payload_digest` | SHA-256 muatan mentah; muatan mentah tidak disimpan di tabel ini, dan tidak pernah masuk log (`§13.3` aturan input tak-tepercaya) |
| id peristiwa/langganan | `UNIQUE (tenant, provider, external_event_id, event_type)` + kunci idempotensi `0012` | peristiwa yang sama dua kali → satu baris, `processing_state = DUPLICATE` |

**Vonis tetap di M-18.** Hitung denominator sesi sah > 0 dan union irisan interval peserta dengan jendela sesi (§5.3), setelah dedup lintas laporan/perangkat. Bandingkan rasio numeric dengan parameter berversi (contoh default 0,75), bukan ketentuan hukum universal. Laporan vendor saja tidak cukup: bukti internal, mapping peserta, kelengkapan/freshness dan aturan kanonik harus sah. Data parsial/degraded tidak menjadi vonis final atau otomatis mengunci nilai. `HADIR_ONLINE`/`HADIR_MIXED` dan Feeder `O`/`M` hanya proyeksi setelah keputusan kanonik; pengiriman membutuhkan mapping kamus nasional yang **terverifikasi**, bukan sekadar baris seed.

#### 6.8.3 Penanganan kegagalan — setiap keadaan punya kode sendiri

| Keadaan | Perilaku sistem | Kode error (`API_SPEC §2.3`) |
|---|---|---|
| kanal dimatikan tenant / `enabled = false` | tolak sejak awal; layar tampilkan keadaan kanal, jangan biarkan dosen mengira sesi berjalan | `409 CONFERENCE_CONNECTION_DISABLED` (146) |
| kredensial kosong padahal kanal aktif | gagal-closed, **tanpa** jatuh ke default lain | `409 CONFERENCE_CONNECTION_DISABLED` (146) |
| token ditolak (rahasia kedaluwarsa, tenant salah) | menandai koneksi `FAILED`, coba rantai `conference.fallback_chain`, alarm ke Admin IT | `502 CONFERENCE_PROVIDER_UNREACHABLE` (147) |
| cakupan/kontrak lisensi kurang | sebab `SCOPE_DENIED` dicatat; kanal dianggap tidak tersedia sampai lisensi dibenahi | `502 CONFERENCE_PROVIDER_UNREACHABLE` (147) |
| dibatasi (throttling) | hormati `Retry-After`; `retry ≤ 2`, selebihnya antrean ulang + `NEEDS_REVIEW` (bukan gagal di HTTP) | — (worker, `queue_operations`) |
| laporan kehadiran belum tersedia pasca sesi | jadwalkan penarikan ulang; hasil sementara tidak pernah ditampilkan sebagai angka final | `422 CONFERENCE_EVIDENCE_STALE` (148) bila laporan lebih tua dari `conference.evidence_max_age_hours` |
| provider diminta di luar register enum | tolak validasi, bukan senyap | `422 PARAM_VALUE_NOT_ALLOWED` (145) |
| egress gagal total dan tidak ada bukti internal | sesi/bukti berlabel `degraded`; jangan finalisasi vonis presensi dari data kurang. Tidak ada perubahan/kunci nilai otomatis oleh transport; eskalasi ke pemilik domain untuk bukti/approval | `422 EVIDENCE_INSUFFICIENT` (117) |

#### 6.8.4 Uji yang wajib ada sebelum kanal ini diklaim

1. **Uji kontrak tiruan** (§6.6): tiga upaya bergabung, overlap dua perangkat, duplikat laporan, interval melintasi awal/akhir sesi, gap heartbeat, JOIN/LEAVE menit sama, denominator nol/hilang serta laporan parsial/stale. `join_seconds` = durasi **union irisan interval** dengan jadwal sah. Tolak `LastLeave − FirstJoin`, double-count dan vonis final dari bukti vendor yang tidak cukup.
2. **Uji idempotensi**: kirim peristiwa yang sama dua kali → satu baris + `DUPLICATE`; dua laporan berbeda untuk `(attendance, meeting, source)` yang sama → `UNIQUE` menahan.
3. **Uji ambang** 0,75 dengan `parameter_version` berbeda: laporan periode lalu harus mereproduksi angka yang sama, dan perubahan ambang tidak mengubah vonis lama.
4. **Uji PII**: `conference_channel_events` tidak boleh mengandung email/NIM; pemeriksaan daftar-terlarang atribut (pola `AGENTS §3.9` gerbang l) atas kolom dan muatan.
5. **Uji turun-mutu fallback**: kanal utama mati → rantai dicoba berurutan, tiap percobaan tercatat di `last_probe_*`, sesi berpindah kanal tanpa memutus bukti lama (`FR-VIC-07`).

#### 6.8.5 Yang sengaja tidak dijanjikan bagian ini

- Tidak ada klaim Graph *change notification* sudah terverifikasi bentuknya di lingkungan ini (`[VERIFIKASI-VENDOR]`).
- Tidak ada proctoring/wajah/liveness dari Teams: M-17 tetap menghitung lokal, dan `ALG-22` tetap design-only.
- Tidak ada pencocokan peserta lewat pencarian nama bebas; kunci hanya pseudonim bertanda (`§6.8.1`).
- Tidak ada dependensi SDK yang dipasang di dokumen ini; sebelum menjadi klaim, ia harus nyata di `package.json` + lockfile dan tercatat di `TECH_CONVENTIONS §6`.

