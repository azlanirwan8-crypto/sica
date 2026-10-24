
## 24. DDL dimensi yang belum berumah: geografi sesi real-time (peta GIS) dan jaminan sosial + EWMP (2026-10-21)

**Kenapa bagian ini ada.** Permintaan pemilik menambah dua dimensi yang tidak pernah diukur penjaga mana pun: **peta sebaran login real-time** (GIS) dan **kepatuhan jaminan sosial + EWMP**. `node .tools/dimension-audit.mjs` (alat baru siklus ini, 38 dimensi dari brief dewan) mencetak yang tidak bisa disanggah: `GeoIP` **0** kemunculan di 20 berkas, `active session store` **0**, **`BPJS` 0**, **`EWMP` 0**, `Glassmorphism` 0. Empat yang pertama adalah lubang kontrak, bukan lubang gaya: tanpa baris ENV yang sah, pengembangan akan menaruh kunci MaxMind di kode; tanpa objek iuran, payroll hanya bisa menampung BPJS lewat `jsonb` tanpa penegakan; dan peta sebaran tanpa definisi sumber data akan dipenuhi angka dummy — justru yang dilarang brief.

**Empat vonis arsitektur yang menentukan bentuk gugus ini.**
1. **Peta membaca fakta, tidak memilikinya.** `sessions` dan `login_events` (§3) sudah pemilik `ip_hash` SHA-256 ber-pepper harian. Gugus ini **menambah** gejala geografi per sesi, tidak pernah menyimpan IP mentah, dan tidak membuat tabel sesi kedua.
2. **Dua sumber koordinat, satu kolom, `source` wajib.** `GEOIP_DB` (perkiraan dari basis offline MaxMind GeoIP2) dan `CLIENT_GEO` (W3C Geolocation dengan consent + `accuracy_meters`) **tidak boleh dicampur tanpa label**; angka "presisi" yang datang dari GeoIP adalah klaim palsu. Yang tidak punya keduanya masuk sebagai `SITE_GEO` (koordinat kampus) atau `UNKNOWN`, bukan titik acak.
3. **Jaminan sosial Indonesia adalah kelas B, bukan enum kampus.** Kode program (JHT/JKK/JKM/JP/PBU), tarif negara, dan kelas iuran ditetapkan pemerintah; kampus hanya memetakan peserta dan periode. Karena itu yang disimpan adalah **basis tarif dalam basis poin + `effective_from/to`**, bukan CHECK daftar string, dan **bukan** angka yang dikarang dokumen ini (sumbernya regulasi, dieksekusi sebagai data berversi).
4. **EWMP belum diketahui bentuknya.** Muatan SISTER/EWMP ditandai `[VERIFIKASI-VENDOR]` — objeknya menampung identifier dan jejak sync, **bukan** field karangan. Ini norma yang sama dengan muatan Graph/Zoom di §21.10; mengarang kolom EWMP adalah `RD-05` bentuk lain.

### 24.1 `0078_session_geography.sql` — fakta geografi sesi untuk peta eksekutif

```sql
CREATE TYPE geo_source AS ENUM ('GEOIP_DB','CLIENT_GEO','SITE_GEO','UNKNOWN');
CREATE TYPE geo_surface AS ENUM ('WEB','MOBILE_APP','TABLET');

CREATE TABLE session_geo_facts (                            -- satu baris per observasi lokasi sesi; sesi boleh punya >1 (pindah jaringan)
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  login_event_id uuid REFERENCES login_events(id),
  user_id uuid NOT NULL REFERENCES users(id),
  observed_at timestamptz NOT NULL DEFAULT now(),
  source geo_source NOT NULL,
  surface geo_surface NOT NULL,
  country_code char(2),                                     -- ISO 3166-1 alpha-2; NULL bila basis GeoIP tidak memberi
  region_code text, city text,
  latitude  numeric(9,6)  CHECK (latitude  IS NULL OR (latitude  BETWEEN -90  AND 90)),
  longitude numeric(10,6) CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180)),
  accuracy_meters int CHECK (accuracy_meters IS NULL OR accuracy_meters BETWEEN 1 AND 100000),
  campus_site_id uuid REFERENCES campus_sites(id),           -- SITE_GEO: titik datang dari kampus, bukan dari perangkat
  retention_days int NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 7 AND 730),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((source = 'SITE_GEO') = (campus_site_id IS NOT NULL)),
  CHECK (source <> 'CLIENT_GEO' OR accuracy_meters IS NOT NULL),
  CHECK (source <> 'UNKNOWN' OR (latitude IS NULL AND longitude IS NULL)),
  CHECK (expires_at > observed_at)
);
CREATE INDEX idx_geo_facts_window ON session_geo_facts(tenant_id, observed_at DESC) WHERE expires_at > now();
CREATE INDEX idx_geo_facts_cluster ON session_geo_facts(tenant_id, country_code, region_code, observed_at DESC);

CREATE VIEW session_geo_live_buckets                        -- satu fisik, satu view: agregasi 60 detik untuk peta (security_invoker WAJIB)
WITH (security_invoker = true) AS
SELECT tenant_id, country_code, region_code,
       date_trunc('minute', observed_at) AS bucket_at,
       source,
       count(*) AS observations,
       count(DISTINCT user_id) AS distinct_users
FROM session_geo_facts
WHERE expires_at > now()
GROUP BY tenant_id, country_code, region_code, date_trunc('minute', observed_at), source;
```

**Kenapa begini.** `retention_days` + `expires_at` ada di baris, bukan hanya di kebijakan, karena peta sesi adalah **data pribadi lintas yurisdiksi**: satu baris yang tidak punya tanggal mati akan bertahan selamanya di tabel yang dibaca dashboard. `CHECK ((source = 'SITE_GEO') = (campus_site_id IS NOT NULL))` menutup pemalsuan paling murah — menaruh koordinat kampus sebagai "lokasi login mahasiswa" lalu menyebutnya real-time. `accuracy_meters` wajib untuk `CLIENT_GEO` karena tanpa akurasi, titik GPS tidak dapat dibedakan dari tebakan. View agregasi (`security_invoker = true`) dipakai karena peta tidak pernah butuh identitas individu; kalau view berjalan dengan hak pemiliknya, satu endpoint peta menembus RLS seluruh sesi (`AGENTS §3.10`).

**RLS, retensi, dan apa yang TIDAK dilakukan.** `session_geo_facts` ber-`ENABLE` + `FORCE` + `tenant_isolation`, dan **insert-only**: `REVOKE UPDATE, DELETE` + pemicu `app.reject_mutation()` (pola CE-5.2); koreksi = baris baru. Tidak ada `user_id` di proyeksi view. IP mentah **tidak** menjadi kolom di mana pun (`ip_hash` tetap bytea di §3). Basis MaxMind adalah berkas offline berlisensi: **tidak ada panggilan jaringan ke pihak ketiga dari rute HTTP** (`AGENTS §3.9` nol-egress berlaku untuk data pribadi juga), dan `dimension-audit` menuntut nomor ENV yang sah sebelum kode ditulis.

### 24.2 `0079_social_insurance.sql` — kepesertaan dan iuran jaminan sosial

```sql
CREATE TYPE remittance_state AS ENUM ('PENDING','REMAPPED','REMITTED','REJECTED');

CREATE TABLE social_insurance_participations (              -- satu baris per orang per program per masa berlaku
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL,                                   -- pegawai/dosen (§11.3) pemilik orang; tidak ada salinan nama
  program text NOT NULL,                                    -- kelas B: JHT|JKK|JKM|JP|PBU — kodenya dari regulasi, nilainya Data berversi
  dictionary_entry_id uuid,                                 -- menunjuk `reference_dictionary_entries` (`0028`, masih `CRD-6`) saat DDL-nya terbit
  member_number_bidx bytea,                                 -- blind index nomor peserta (lookup), bukan nomor telanjang
  member_number_encrypted bytea,                            -- amplop dua kunci (§16.3.4)
  base_wage_rupiah bigint NOT NULL CHECK (base_wage_rupiah >= 0),
  employer_rate_bp int NOT NULL CHECK (employer_rate_bp BETWEEN 0 AND 2500),   -- basis poin: 200 = 2,00 %
  employee_rate_bp int NOT NULL CHECK (employee_rate_bp BETWEEN 0 AND 2500),
  risk_class_code text,                                     -- kelas risiko kecelakaan kerja (JKK), dari regulasi
  effective_from date NOT NULL, effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK (is_active = false OR effective_to IS NULL)
);
CREATE INDEX idx_si_participant ON social_insurance_participations(tenant_id, staff_id, program, effective_from DESC);
CREATE UNIQUE INDEX idx_si_one_active ON social_insurance_participations(tenant_id, staff_id, program) WHERE is_active;

CREATE TABLE social_insurance_contributions (               -- tagihan iuran per run gaji: tidak pernah dihitung dua kali
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  participation_id uuid NOT NULL REFERENCES social_insurance_participations(id),
  payroll_run_id uuid NOT NULL,                             -- pemilik gaji (§22.2.2, `0054`); penunjuk keluar, bukan salinan
  period_month date NOT NULL CHECK (period_month = date_trunc('month', period_month)),
  employer_amount_rupiah bigint NOT NULL CHECK (employer_amount_rupiah >= 0),
  employee_amount_rupiah bigint NOT NULL CHECK (employee_amount_rupiah >= 0),
  state remittance_state NOT NULL DEFAULT 'PENDING',
  voucher_number text, remitted_at timestamptz,
  remittance_file_id uuid REFERENCES attachments(id),        -- bukti setor tetap satu pemilik berkas (§23.1)
  recalculated_from uuid REFERENCES social_insurance_contributions(id),  -- REKONSILIASI membuat baris baru, tidak menimpa
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, participation_id, period_month),
  CHECK (state <> 'REMITTED' OR (voucher_number IS NOT NULL AND remitted_at IS NOT NULL)),
  CHECK (recalculated_from IS NULL OR recalculated_from <> id)
);
CREATE INDEX idx_si_contrib_period ON social_insurance_contributions(tenant_id, period_month, state);
```

**Kenapa tarif disimpan sebagai basis poin + masa berlaku.** Nominal iuran berubah oleh regulasi, dan perubahan itu harus dapat direkonstruksi untuk gaji bulan lalu (`BR-R12`). Menyimpan `rate numeric` akan memaksa `float` ke jalur uang (dilarang `AGENTS §3.4`), dan menaruh tarif di CHECK akan mengunci angka negara ke dalam kode kampus. Karena itu `*_rate_bp` (10 000 = 100 %) ber-`effective_from/to`, dan nominal hasil perkalian **tidak dihitung ulang saat dibaca** — baris kontribusi menyimpan hasil pada saat run, dengan `recalculated_from` sebagai rantai bila koreksi diperlukan.

**Yang tidak dikarang.** Dokumen ini **tidak** menetapkan berapa persen JHT atau JP, berapa kelas PBU, atau ambang upat minimum: itu data kelas B (`reference_dictionary_entries`, nomor `0028` yang DDL-nya masih menjadi tagihan `CRD-6`). Kolom `dictionary_entry_id` sengaja boleh `NULL` sekarang dan wajib diisi saat `0028` terbit — CI §24.4 butir 2 menagihnya. Nomor peserta diperlakukan sebagai PII spesifik: **blind index + terenkripsi**, tidak pernah terbaca di log, dan proyeksi UI hanya menampilkan 4 digit terakhir.

### 24.3 `0080_ewmp_sync.sql` — jejak sinkronisasi EWMP, tanpa field karangan

```sql
CREATE TYPE ewmp_sync_state AS ENUM ('QUEUED','RUNNING','SUCCEEDED','PARTIAL','FAILED');

CREATE TABLE ewmp_sync_batches (                            -- bentuk muatan [VERIFIKASI-VENDOR]: identifier + jejak, bukan kolom tebakan
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL,                                   -- dosen pemilik profil
  sister_identity_ref text,                                 -- pointer ke `feeder_identities`/SISTER (`0028`/`0055`), bukan salinan
  payload_digest char(64) NOT NULL CHECK (payload_digest ~ '^[a-f0-9]{64}$'),  -- SHA-256 muatan yang dikirim; isi TIDAK disimpan di DB
  state ewmp_sync_state NOT NULL DEFAULT 'QUEUED',
  engine_note text,                                          -- catatan degradasi/mode turun, tampil apa adanya
  attempts int NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  requested_by uuid NOT NULL, approved_by uuid,             -- kirim data nasional = aksi VALIDATE ber-empat-mata
  queue_op_id uuid,                                          -- `queue_operations` (`0030`) pemilik antrean
  succeeded_at timestamptz, failed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state <> 'SUCCEEDED' OR succeeded_at IS NOT NULL),
  CHECK (state <> 'FAILED' OR failed_reason IS NOT NULL),
  CHECK (state NOT IN ('SUCCEEDED','PARTIAL') OR approved_by IS NOT NULL),
  CHECK (approved_by IS NULL OR approved_by <> requested_by)
);
CREATE INDEX idx_ewmp_state ON ewmp_sync_batches(tenant_id, state, created_at DESC);
CREATE UNIQUE INDEX idx_ewmp_one_per_staff_period ON ewmp_sync_batches(tenant_id, staff_id, payload_digest);
```

**Kenapa setipis ini, dan itu disengaja.** Tidak ada satu pun kolom seperti `jdaf`, `jabatan`, `riwayat_pengangkatan`, atau `skp` di tabel ini, karena bentuk resmi muatan EWMP belum diverifikasi terhadap dokumentasi SISTER yang berlaku. Yang bisa dijanjikan hari ini adalah: **digest muatan** (bukti apa yang dikirim), **state antrean**, **empat-mata**, dan **idempotensi** (`UNIQUE (tenant_id, staff_id, payload_digest)` mengirim muatan yang sama dua kali = satu batch). Saat spesifikasi vendor terverifikasi, fieldnya naik sebagai **Expand** (`0081`) di bagian ini, bukan sebagai `ALTER` diam-diam di migrasi lain. Ini pembeda antara "spesifikasi jujur" dan "spesifikasi yang terlihat selesai".

### 24.4 Register, ambang, dan query CI gugus §24

| Berkas | Isi | Prasyarat | Status |
|---|---|---|---|
| `0078_session_geography.sql` | enum `geo_source`/`geo_surface` + `session_geo_facts` + view `session_geo_live_buckets` | `0001` (`sessions`, `login_events`, `users`), `0044`/§19.1 (`campus_sites`), `0020` (`attachments` tidak dipakai tapi retensi konsisten) | DDL ditulis — **eksekusi menunggu jalur DB (`G-02`) + kunci ENV terdaftar** |
| `0079_social_insurance.sql` | enum `remittance_state` + `social_insurance_participations` + `social_insurance_contributions` | `0001`, §11.3 (`staff`), `0054` (`payroll_runs`), `0020` (bukti setor), `0028` (kamus kelas B — masih `CRD-6`) | DDL ditulis — tarif **tidak** ditetapkan dokumen ini |
| `0080_ewmp_sync.sql` | enum `ewmp_sync_state` + `ewmp_sync_batches` | `0001`, `0030` (`queue_operations`), `0028`/`0055` (identitas SISTER) | DDL ditulis — muatan `[VERIFIKASI-VENDOR]` |

**Ambang yang ikut naik ke katalog parameter (§21.3).** Empat kunci, semuanya `source_of_truth='PARAM'` dan tidak ada yang menyimpan rahasia: `analytics.map.enabled` (BOOL, default `false` — peta tidak tampil sebelum basis GeoIP terpasang), `analytics.session.active_window_s` (SEC, 60–900, baku 300), `analytics.map.ip_retention_days` (DAY, 7–730, baku 90), `analytics.map.geo_source_priority` (ORDERED_LIST dalam JSON, urutan `CLIENT_GEO,GEOIP_DB,SITE_GEO`). Kelas risikonya `OPS` kecuali `ip_retention_days` yang `REGULATORY` (memendekkan retensi di bawah 7 hari = menghapus bukti; `min_value` menutupnya).

**Query verifikasi CI.** (1) `SELECT count(*) FROM session_geo_facts WHERE source='SITE_GEO' AND campus_site_id IS NULL` → **0**; (2) `social_insurance_participations` dengan `dictionary_entry_id IS NULL` setelah `0028` terbit → **0**; (3) `social_insurance_contributions` dengan dua baris aktif `(participation_id, period_month)` → **0**; (4) uji dua-tenant: peta bucket tidak mengembalikan baris tenant lain (bocor = 0); (5) `UPDATE`/`DELETE` pada `session_geo_facts` dan `social_insurance_contributions` sebagai `sica_app` → **error**, bukan senyap; (6) view `session_geo_live_buckets` terbukti `security_invoker = true` di `pg_views`/`pg_class` (view `security_definer` menembus RLS — ditolak); (7) `ewmp_sync_batches` dengan `approved_by = requested_by` → **0**; (8) `dimension-audit` tidak lagi mencetak `GeoIP = 0`, `BPJS = 0`, `EWMP = 0`.

**Penahan yang tidak dihapus bagian ini.** (a) **Lisensi & berkas GeoIP2** adalah urusan pengadaan: tanpa `GEOIP_DB_PATH` yang sah, `analytics.map.enabled` wajib `false` dan layar menampilkan **degradasi**, bukan titik kosong. (b) **Redis** belum menjadi dependensi nyata di `package.json` — "active session store" adalah spesifikasi, bukan keadaan; `AGENTS §3.8` mengecualikan sementara pola senada di KRS, dan pengecualian itu tidak boleh dipakai sebagai preseden di sini. (c) Nomor izin untuk `analytics.*`, `hris.insurance.*`, `sister.ewmp.*` **belum ber-nomor** (`CRD-5`), jadi tidak satu pun baris §24 boleh diruteni sebelum namanya diputus pemilik katalog. (d) Retensi data lokasi harus masuk `retention_rules` + DPIA sebelum baris pertama dihapus otomatis (`BR-R14`).
