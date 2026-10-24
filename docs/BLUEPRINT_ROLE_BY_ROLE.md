# BLUEPRINT_ROLE_BY_ROLE.md — Blueprint Eksekusi Per-Peran (Role-by-Role)

| | |
|---|---|
| **Versi** | 1.0 |
| **Tanggal** | 2026-10-19 |
| **Status** | **Spesifikasi eksekusi** — satu peran selesai = satu lapisan fungsi tertutup dengan fixture uji |
| **Cakupan** | 6 lapisan peran (`R-1`…`R-6`) × (pohon menu · hak tingkat tombol · hak tingkat field · objek DB · endpoint · komponen UI · edge case · DoD) |
| **Peran penyusun** | Principal Systems Architect · Security & RBAC Auditor · Domain Expert SIAKAD Enterprise |
| **Bahasa** | Indonesia (kode & DB tetap Inggris) |
| **Sumber kebenaran yang lebih tinggi** | [RBAC_MATRIX.md](file:///c:/SICA/docs/RBAC_MATRIX.md) (peran & izin) · [AUDIT_READINESS.md](file:///c:/SICA/docs/AUDIT_READINESS.md) (celah nyata) · [BLUEPRINT_ENTERPRISE.md](file:///c:/SICA/docs/BLUEPRINT_ENTERPRISE.md) (matriks & state machine) · [BENCHMARK_SEVIMA.md](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md) (bukti pembanding) |

---

## 0. Cara membaca blueprint ini

### 0.1 Prinsip pembagian kerja
Dokumen lain menjawab **"apa"** (izin, field, state machine). Dokumen ini menjawab **"siapa lebih dulu, dan apa yang bisa ia klik"**. Urutan lapisan bukan preferensi estetika: setiap lapisan adalah **prasyarat data** bagi lapisan berikutnya.

| Lapisan | Peran | Kenapa urut begini |
|---|---|---|
| **R-1** | Admin Aplikasi (platform, lintas tenant) | Tanpa provisioning tenant + paket + break-glass ter-audit, tidak ada "kampus" untuk disetel |
| **R-2** | Admin IT Kampus (`TENANT_ADMIN`) + penataan RBAC | Semua lapisan berikutnya membaca hak dari penugasan yang dibuat di sini; layar peran tidak boleh didahului tabelnya |
| **R-3** | Admin Akademik (BAAK) & Admin Keuangan (BAUK) | Master data + tarif + gerbang = fondasi transaksi. BAAK dan BAUK sengaja **satu lapisan, dua peran** karena SoD hanya bermakna bila keduanya ada |
| **R-4** | Kaprodi, Dekan 🧩, Dosen Pengampu, Dosen Wali | Lapisan "penyelenggaraan": kelas, jadwal, presensi, nilai, persetujuan |
| **R-5** | Mahasiswa (semua skema) & Orang Tua/Wali | Lapisan "diri sendiri": tidak bisa diverifikasi sebelum R-4 menghasilkan data riil |
| **R-6** | Operator Feeder PDDikti & integrasi eksternal (gateway, ILS, TTE, SISTER) | Pengumpul data paling akhir — ia mengirim apa yang sudah benar, bukan membentuknya |

**Dua pengecualian sadar terhadap urutan di atas:**
1. `R-6` sebagian **harus** lebih awal: kamus `Get*` PDDikti dan sinkron `reference_items` (BENCH-131) adalah **input** master data R-3, bukan output. Ia dipecah: `R-6a kamus & pemetaan` (dini), `R-6b kirim & rekonsiliasi` (akhir).
2. Catatan awal bahwa `0011` belum diterapkan adalah **snapshot historis**, bukan kondisi kini: penerapan DB dev tercatat di `PROGRESS_REPORT §5.65–§5.66`. Jalur admin/RBAC telah parsial DB-backed (§11); penerapan tiap lingkungan dan penegakan scope tetap harus dibuktikan. Hak R-2 adalah konfigurasi teknis, bukan keputusan periode/modul bisnis secara otomatis.

**Rekomendasi eksekusi:** kerjakan lapisan sebagai *vertical slice*—izin dan scope → migrasi/RLS → service/API → proyeksi field → UI → acceptance/security tests—lalu demonstrasikan dan tutup DoD sebelum pindah peran. Ini adalah rekomendasi proses yang dirinci pada [ROADMAP_TASKS §2.33.2](file:///c:/SICA/docs/ROADMAP_TASKS.md); ia tidak mengubah urutan maupun sumber kebenaran izin dalam `RBAC_MATRIX.md`.

### 0.2 Aksi granular yang dipakai dokumen ini
Permintaan analisis memakai delapan aksi. RBAC SICA menyimpan enam verba ([BLUEPRINT §0.4](file:///c:/SICA/docs/BLUEPRINT_ENTERPRISE.md)). **Tombol** di UI memakai delapan nama; **izin** di katalog tetap enam verba. Pemetaan:

| Aksi tombol | Verba katalog | Konsekuensi penegakan |
|---|---|---|
| CREATE | `INSERT` | — |
| READ | `READ` | Masking level field diterapkan di **proyeksi**, bukan di layar |
| UPDATE | `UPDATE` | Termaksud **LOCK** (menutup state) dan sunting biasa |
| DELETE | `DELETE` | Data akademik: **tidak pernah hard delete** — `DELETE` selalu berarti nonaktif-soft + audit |
| APPROVE | `VALIDATE` | Wajib alasan/oprasional, MFA untuk peran admin, `access_change_requests` bila mengubah hak |
| REJECT | `VALIDATE` | **Wajib** `reason` (AC-AKA-2) — pasangan `.reject` belum ada untuk 8 dari 9 `.approve` (K-3) |
| EXPORT | `OTHER` | Hanya kode ekspor eksplisit dalam katalog; scope diri/massal, volume dan kolom tercatat, bukan grant global `export.*` |
| LOCK | `UPDATE` | Menutup state yang **belum** disahkan |
| UNLOCK | `VALIDATE` | Membuka state yang **sudah** disahkan — bukan UPDATE (BR-G4). **Hari ini salah verba di katalog (K-5/SEC-GAP RD-16)** |
| DISPENSE / OVERRIDE | `VALIDATE` | Menyimpangkan aturan; **nol kode** di katalog (K-1) |

### 0.3 Mekanisme hak tingkat field (baru — belum pernah dispesifikasi)
Dokumen sebelumnya hanya menetapkan hak per **aksi pada resource**. Enterprise SIAKAD menuntut lebih: peran yang sama sering boleh READ satu objek tetapi **tidak boleh melihat atau menulis kolom tertentu**. Contoh nyata dari audit: NIK & nama ibu (DUKCAPIL), koordinat GPS presensi, `grades.status`, `ledger` jumlah.

**Keputusan desain: aturan field didefinisikan di kode, bukan sebagai baris database.**

```
packages/contracts/src/authz.ts  (tambahan)
export const FIELD_RULES = {
  'academic.mahasiswa': {
    personal_nik:            { read: ['ADMIN_ACADEMIC','HR_BKD_OFFICER','STUDENT:own'], mask: '*', write: ['ADMIN_ACADEMIC'] },
    guardian_income_rupiah:  { read: ['ADMIN_FINANCE','STUDENT_AFFAIRS_OFFICER','GUARDIAN:own'], mask: 'REDACTED', write: ['ADMIN_FINANCE'] },
    nim:                     { read: ['*'], write: ['SERVER_ONLY'], immutable_after: 'NIM_ISSUED' },
    status_akademik:         { read: ['*'], write: ['SERVER_ONLY'] },
  },
  'assessment.nilai': {
    raw_score:  { read: ['LECTURER:assigned','HEAD_OF_PROGRAM','STUDENT:own_after_publish'], write: ['LECTURER:assigned'] },
    status:     { read: ['*'], write: ['SERVER_ONLY'] },      // transisi lewat aksi, bukan sunting
    letter:     { read: ['*'], write: ['SERVER_ONLY'] },      // turunan band — tidak pernah manual
  },
  'finance.ledger':      { '*': { read: ['ADMIN_FINANCE','TREASURER','LEADER','COMPLIANCE_OFFICER'], write: ['SERVER_ONLY'] } },
  'attendance.record':   { gps_lat/gps_lng: { read: ['LECTURER:assigned'], mask: 'COARSE', retention_days: 90 } },
  'kepegawaian.payroll': {                    // ditambahkan siklus M-06 (2026-10-22) — nominal gaji = rahasia jabatan
    amount:             { read: ['ADMIN_FINANCE','TREASURER','STAFF:own','LECTURER:own'], mask: 'REDACTED', write: ['SERVER_ONLY'] },
    take_home:          { read: ['ADMIN_FINANCE','TREASURER','STAFF:own','LECTURER:own'], mask: 'REDACTED', write: ['SERVER_ONLY'] },
    potongan_pph:       { read: ['ADMIN_FINANCE','TREASURER','STAFF:own','LECTURER:own'], mask: 'REDACTED', write: ['SERVER_ONLY'] },
    posting_ref:        { read: ['ADMIN_FINANCE','TREASURER'], mask: 'REDACTED', write: ['SERVER_ONLY'] },   // id jurnal milik M-10, bukan milik HRIS
    payroll_run_status: { read: ['*'], write: ['SERVER_ONLY'] },                                            // DRAFT→…→VOID hanya lewat approve/post/void
    employment_status:  { read: ['HR_BKD_OFFICER','LEADER','STAFF:own','LECTURER:own'], write: ['SERVER_ONLY'] },
    nip_internal:       { read: ['HR_BKD_OFFICER','ADMIN_FINANCE','STAFF:own','LECTURER:own'], mask: '*', write: ['SERVER_ONLY'] },
    weight_bp:          { read: ['HR_BKD_OFFICER','LEADER','STAFF:own'], write: ['HR_BKD_OFFICER'], validate_for: ['LEADER'] },
  }
} as const;
```

**Enam aturan yang membuat mekanisme ini aman, bukan hiasan:**
1. **Proyeksi, bukan penyembunyian DOM.** Masking dilakukan di service/repository sebelum respons keluar. Menyembunyikan kolom di React **bukan** kontrol akses (AGENTS §3.8).
2. **`SERVER_ONLY` = kolom yang hanya berubah lewat transisi state.** `grades.status`, `invoices.status`, `ledger`, `payments.status`, `payroll_runs.status`, `payslip_lines.amount`, `employees.employment_status`. Tidak ada rute yang menerimanya dari body — ini menutup SEC-02 (klien menulis `period_id`/`status`).
3. **`'X:own'` / `'X:assigned'` = penugasan, bukan peran.** Resolver mengevaluasinya dengan `user_role_assignments.scope_*` + relasi (`advisement_assignments`, `class_assignments`). Hari ini `holdsScoped` **ada tapi tidak dipanggil** (SEC-11) → seluruh isi dokumen ini **tidak dapat ditegakkan** sampai itu dibalik.
4. **Write-restriction lebih ketat daripada read.** Banyak kolom boleh dibaca lintas peran tetapi hanya boleh ditulis oleh satu peran, dan perubahannya wajib lewat aksi beralasan (`immutable_after`, `validate_for`).
5. **Auditor/operator tidak memperoleh unmask universal.** `COMPLIANCE_OFFICER` dan `PLATFORM_OPERATOR` hanya melihat field yang diperlukan untuk tujuan sah, scope dan grant eksplisit. Break-glass dibatasi alasan, TTL, MFA dan audit dua identitas; bukan hak keputusan bisnis. Setiap baca lintas-tenant memicu audit, tetap minimisasi PII.
6. **Dikontrakkan, tidak dikarang.** Tiap layar di §1–§6 mencantumkan aturan field yang berlaku padanya; developer tidak memutuskan sendiri kolom mana yang disembunyikan.
7. **Retensi & DPIA mengikuti mask.** Kolom bergeo/PII tinggi punya `retention_days`; ini menjawab BENCH-81 (koordinat presensi) dan BR-R14.

### 0.4 Lapis penegakan yang wajib ada di SETIAP lapisan peran
Enam lapis dengan bukti terpisah; penomoran bukan urutan eksekusi. Pada tulis admin, identitas/permission mendahului validasi body/param: tanpa izin tetap `403` walaupun body cacah. Scope target diselesaikan dari row DB, bukan dipercaya dari klien. Temuan lama L3/L4 tidak berarti seluruh handler kini nihil; penutupan tiap jalur mengikuti bukti audit terbaru (§11).

```
L1  transport   : Zod whitelist (unknown key dibuang) + skema per aksi
L2  identity    : JWT RS256 server-verified; tenant & user HANYA dari token (SEC-07: header klien dihapus)
L3  permission  : requireDataPrincipal(PERM.x) berbasis user_role_assignments (bukan carrier) — SEC-10
L4  row/scope   : holdsScoped(access, PERM.x, {programId|orgId|classId|periodId|studentId}) — SEC-11
L5  state       : penjaga state machine (periode OPEN, status LOCKED, gerbang tagihan, clearance)
L6  tenancy DB  : RLS ENABLE+FORCE+policy; query dalam withTenantContext; tanpa GUC → deny (sudah benar)
```

**Anti-IDOR, dinyatakan sebagai aturan kode (bukan imbauan):** setiap fungsi service/repository yang menerima id entitas **wajib** membuktikan kepemikikan sebelum mutate — pola baku:

```ts
// BENAR — baris diselesaikan DI DALAM transaksi + scope dibuktikan
const row = await repo.findByIdForUpdate(ctx, enrollmentId);         // WHERE tenant_id = ctx.tenantId AND id = $1
if (!await scope.isAdviserOf(ctx, row.classId)) return forbidden('NOT_YOUR_STUDENT');
if (row.status !== 'SUBMITTED') return conflict('KRS_NOT_SUBMITTED');

// SALAH — pola yang hari ini ada di krs/approve & qr/generate (SEC-03/SEC-04)
await approve(body.enrollmentIds);                                   // id dari klien, nol pembacaan DB
```

**Enam pertanyaan yang harus dijawab tiap endpoint tulis, di dokumen atau di kode:** (1) milik siapa baris ini? (2) dalam tenant mana? (3) dalam scope pemanggil? (4) pada state apa objek induk (periode/nilai/tagihan)? (5) siapa actor-nya (user vs sistem)? (6) audit baris apa yang dipancarkan? Bila ada satu yang "tidak dicek", endpoint itu **belum boleh digabung**.

### 0.5 Legenda status tiap baris
| Penanda | Arti |
|---|---|
| ✅ | Ada di kode dan ditegakkan (dengan bukti `file:line`) |
| 🟡 | Ada sebagian: kontrak/skema/guard ada, penegakan penuh belum (misinya = memindahkan, bukan membuat) |
| ❌ | Belum ada sama sekali |
| 🧩 | Perlu keputusan produk/peran/modul baru sebelum bisa dibuat (rujuk `P-*` / `G-*` / `D-*`) |
| ⛔ | **Dilarang** — pola yang sudah kita tolak (anti-pattern Sevima atau celah keamanan) |

---

## 1. R-1 — ADMIN APLIKASI (Platform / Super Admin, lintas tenant)

### 1.1 Identitas & scope
| Aspek | Spesifikasi |
|---|---|
| Kode peran | `PLATFORM_OPERATOR` (carrier login `super_admin`) |
| Wadah saat ini | Peran platform terpisah dari role tenant; inventaris rekursif **8 route.ts/9 metode DB-backed** (§1.4/§11). Layar dan seluruh AC tidak otomatis lengkap karena handler ada. |
| Scope | Target tenant eksplisit untuk provisioning/kuota/lisensi; agregat lintas tenant tanpa PII per-record. Dukungan per-record lewat grant terbatas, bukan assignment bisnis massal. |
| Autentikasi | MFA wajib untuk tulis/aksi sensitif; tidak ada jalur login-sebagai diam-diam. |
| Impersonation | `impersonation_grants` memiliki jalur DB-backed grant/revoke; alasan, tiket, MFA, TTL ≤ 30 menit, dua identitas audit serta keterlihatan tenant tetap gerbang penerimaan. Bukan tabel kedua `platform_support_grants`. |
| Hak atas data | R-1 tidak mewarisi keputusan KRS/nilai/pembayaran, termasuk melalui impersonation. Dukungan dibatasi tujuan/scope, minimisasi field dan audit; kewenangan bisnis harus ditetapkan terpisah sesuai RBAC/SoD. |

### 1.2 Pohon menu
| Menu | Sub-menu / layar | Rute | Aksi tersedia | Gerbang |
|---|---|---|---|---|
| **Tenant** | Daftar & profil (status `ONBOARDING/ACTIVE/SUSPENDED/ARCHIVED`) | `/platform/tenants` | R · C prodeo · U status · EXPORT | — |
| | Provisioning wizard (domain, paket, admin pertama, data institusi awal) | `/platform/tenants/new` | C | 4 langkah + diff (FR-ADM-15 pola) |
| | Detail tenant: modul aktif, kuota, pemakaian | `/platform/tenants/[id]` | R · U kuota | `platform.tenant.*` |
| **Paket & entitlement** | Katalog `modules` + `module_dependencies` | `/platform/modul` | R · C · U · `activate/deactivate` | ⛔ jangan jual modul tanpa model data (P-10: `cbt`, `tracer_iku`, `pmb` hari ini di-seed tanpa tabel) |
| | Langganan per tenant | `/platform/langganan` | R · C · U | `subscriptions` |
| **Operasional** | Antrean job & DLQ (rekonsiliasi, feeder, notifikasi) | `/platform/operasi/antrean` | R metadata redacted · retry idempoten ber-audit; tanpa purge | spec-only/permission pending; BullMQ/Redis belum terpasang (RD-11) |
| | Kesehatan sistem lintas tenant (readiness, replika, RLS probe) | `/platform/operasi/kesehatan` | R · EXPORT | `/api/v1/health/ready` ⚠️ jangan bocorkan versi ke unauthenticated (SEC-17/health) |
| | Log audit lintas tenant + **verifikasi hash-chain** | `/platform/audit` | R · EXPORT | 🔒 `audit_logs` append-only |
| **Dukungan** | Break-glass / impersonation + riwayat | `/platform/dukungan/impersonation` | grant/revoke sesuai katalog | grant/revoke DB-backed; layar dan break-glass penuh belum terbukti (§11) |
| | Tiket/insiden (rujukan `ISSUE_RESOLUTION`) | `/platform/dukungan/insiden` | R · C · U | — |
| **Platform config** | Rate limit & kuota per tenant, feature flags | `/platform/pengaturan` | R · U | ⚠️ empat angka rate limit bertabrakan (RD-14) — putuskan satu |

### 1.3 Hak tingkat field (ringkas)
| Objek | Field | READ | WRITE | Catatan |
|---|---|---|---|---|
| `tenants` | `status`, `plan_id`, `quota` | R-1 | **hanya** R-1 | transisi status = `VALIDATE` + alasan |
| `tenant_quotas` | `max_api_rps`, `seats`, `storage_gb` | R-1, R-2 (miliknya sendiri) | R-1 | `seats` perlu batas atas (SEC-08) |
| `users` (global) | `email`, `mfa_enabled`, `failed_attempts` | R-1 | R-1 + pemilik diri | ⛔ R-2 tidak boleh membaca email user lintas-tenant (UU PDP) |
| `modules`, `plan_modules` | semua | R-1 | R-1 | katalog global: SELECT-only bagi aplikasi (RBAC §3.1) |
| `audit_logs` | semua | R-1, `COMPLIANCE_OFFICER` | **⛔ SERVER_ONLY** | `UPDATE/DELETE` ditolak DB (AC-AUD-1) |

### 1.4 Endpoint
| Method & path | Permission katalog | Batas target | Status |
|---|---|---|---|
| `GET /api/v1/platform/tenants` | `platform.tenant.view` | agregat/direktori, bukan PII bisnis | DB-backed |
| `POST /api/v1/platform/tenants` | `platform.tenant.provision` | provisioning target eksplisit + MFA | DB-backed |
| `GET /api/v1/platform/tenants/:id` | `platform.tenant.view` | target diselesaikan server | DB-backed |
| `POST /api/v1/platform/tenants/:id/suspend` dan `.../:id/reinstate` | `platform.tenant.suspend` | transisi beralasan + MFA | DB-backed, dua metode |
| `PUT /api/v1/platform/tenants/:id/quotas` | `platform.quota.manage` | target tenant + plafon/usage | DB-backed |
| `POST /api/v1/platform/impersonation-grants` | `identity.impersonation.grant` | target membership, TTL, MFA, audit dua identitas | DB-backed |
| `DELETE /api/v1/platform/impersonation-grants/:id` | `identity.impersonation.revoke` | grant target diselesaikan server | DB-backed |
| `GET /api/v1/platform/audit-events` | `audit.log.view` | scope/PII/audit akses, bukan akses bisnis penuh | DB-backed |

Total rekursif 8 berkas/9 metode tidak menyatakan semua L1–L6/AC selesai. Lisensi, billing, flags/trials belum memiliki endpoint; telemetri rinci, DSAR/ekspor data tenant dan maintenance mengikuti spesifikasi/pending §11, tanpa mengarang permission atau path runtime.

### 1.5 Komponen UI (Velzon)
- `VelzonDataGrid` dengan pemilih tenant (searchable, tampilkan `code`, `status` chip, pemakaian kuota sebagai bar).
- Kartu paket: `card` + `badge` status entitlement (`ACTIVE/TRIAL/EXPIRED/DISABLED`) — warna token Velzon success/warning/danger/secondary.
- Panel break-glass: modal konfirmasi **berbasis angka** ("Anda akan melihat 12 480 mahasiswa tenant X"), hitung mundur TTL, tombol akhiri selalu terlihat.
- Strip `StateMachineStrip` (UI_UX §9.7) untuk transisi status tenant — status `LIVE`/`ACTIVE` **tidak bisa** diset selama panel Kesehatan Data masih merah (FR-ADM-10).

### 1.6 Edge case yang harus tertangani
1. **Provisioning gagal di tengah** (tenant terbuat, admin pertama tidak) → rollback transaksi tunggal; jangan ada tenant yatim.
2. **Suspend tenant dengan tagihan berjalan** → blokir login, tetapi data tetap terbaca untuk DSAR; jangan hard-delete.
3. **Break-glass saat admin tenant sedang menulis** → impersonation wajib menandai baris audit `actor+target`, dan setiap mutasi selama itu diberi `via_impersonation=true`.
4. **Kuota terlampaui saat traffic puncak** → 429 dengan header retry-after; jangan matikan tenant diam-diam (K-18).
5. **Modul dijual tapi belum punya data model** → ⛔ tolak aktivasi (P-10); jangan tampilkan menu kosong seperti yang dilakukan pembanding (D-4).

### 1.7 DoD lapisan R-1
- [ ] Rute `/api/v1/platform/**` ada + guard **berbasis tabel** (`requireDataPrincipal`), bukan carrier.
- [ ] MFA wajib untuk semua aksi tulis R-1 (menutup G-07 untuk peran ini lebih dulu).
- [ ] `impersonation_grants` sebagai satu objek kanonik; uji TTL, dua identitas audit dan pencabutan. Tidak membuat tabel `platform_support_grants` kedua.
- [ ] Uji: baca lintas-tenant **selalu** memancarkan audit; impersonation tanpa alasan → 422; `UPDATE audit_logs` → permission denied (AC-AUD-1 nyata di DB, bukan mock).
- [ ] Tidak ada aktivasi modul tanpa DDL (P-10) → gerbang CI membandingkan `MODULE_CODES` vs tabel yang ada.

---

## 2. R-2 — ADMIN IT KAMPUS (`TENANT_ADMIN`) + penataan RBAC

### 2.1 Identitas & scope
| Aspek | Spesifikasi |
|---|---|
| Kode peran | `TENANT_ADMIN` (carrier `tenant_admin`), scope `TENANT` |
| Wadah | Peran/katalog ada; admin **28 route.ts/39 metode DB-backed** rekursif. Layar, scope dan AC masih parsial; bukan nol rute atau selesai seluruhnya. Grant lama luas perlu migrasi (§11). |
| Autentikasi | MFA wajib untuk aksi `INSERT/UPDATE/DELETE/VALIDATE` (FR-IDT-01; hari ini **belum ditegakkan**, G-07) |
| Batas khas | **Tidak boleh** menjadi pemohon dan penyetuju perubahan hak dirinya sendiri → empat-mata lewat `access_change_requests` (RBAC §7) |
| ⛔ | Tidak boleh membaca data PII lintas-peran yang bukan tupoksinya; hak atas data akademik tetap lewat grant eksplisit |

### 2.2 Pohon menu
**Matriks lama ini adalah inventaris navigasi gabungan, bukan grant otomatis R-2.** Periode/reopen, aturan akademik, skala nilai, cekal dan clearance hanya ditangani pemilik domain berizin serta ber-scope; IT dapat mengikat konfigurasi tetapi tidak mengambil keputusan itu. Target menu IT dan status implementasi terkini ada di §11.2; perubahan grant memerlukan migrasi, tidak dianggap telah terjadi.

| Menu | Sub-menu | Rute | Aksi | Catatan |
|---|---|---|---|---|
| **Institusi** | Profil PT (kode PDDikti, akreditasi PT, pejabat, blok tanda tangan) | `/admin/institusi` | R · U | `pddikti_pt_code` belum di DDL (RD-29) |
| | Struktur organisasi (fakultas/jurusan/unit/lab) | `/admin/institusi/organisasi` | C R U · DEAKTIFKAN (impact) | `organizations` kurang 7 kolom (RD-29) |
| | Gedung & ruangan | `/admin/institusi/gedung`, `/ruangan` | C R U D · IMPORT | 🧩 `buildings`/`time_slots` tanpa DDL (§4.1) |
| **Periode** | Tahun akademik · periode · transisi status | `/admin/periode` | C R U · **AP/UL** reopen | `CLOSING` tidak ada di matriks transisi API_SPEC — RD/SEC gap |
| | Kalender akademik (tanggal kunci + libur + tenggat Feeder) | `/admin/kalender` | C R U D | tenggat CP1/CP2 auto-terisi (BR-R9) |
| **Modul** | Katalog read-only, status lisensi, on/off lokal | `/admin/modul` | baca; opt-out lokal target pending | API activate/deactivate tenant masih menulis `tenant_modules`: gap migrasi pemisahan lisensi platform dari pilihan lokal, bukan izin menciptakan lisensi (§11.2) |
| **Pengguna** | Keanggotaan (user ↔ tenant ↔ carrier) | `/admin/pengguna` | C R U · nonaktifkan | `tenant_memberships.role` belum di DATA_MODEL (K-16) |
| | **Peran & grant** | `/admin/hak-akses/peran` | C R U · **AP** | 🧩 tertahan `0011` + daftar peran beku (RD-17); komposisi izin role diajukan sebagai `ROLE_PERMISSION_CHANGE` (`0082`), tidak disimpan langsung |
| | Penugasan ber-scope (prodi/org/kelas/periode + `valid_to`) | `/admin/hak-akses/penugasan` | C R U D · EXPORT | **inti RBAC**; hari ini scope dibaca-lalu-dibuang (SEC-11) |
| | Permintaan perubahan hak (antrean empat-mata) | `/admin/permintaan-hak` | R · **AP** | `identity.accessrequest.approve` (352) ada; `.reject` **tidak perlu** — penolakan adalah hasil negatif `VALIDATE` yang sama dengan alasan wajib (`K-3` ditutup sebagai ralat, bukan izin baru) |
| | Impersonation (versi tenant, TTL lebih pendek) | `/admin/impersonation` | C R · akhiri | 🧩 |
| **Aturan akademik** | Wizard 4 langkah per prodi × periode | `/admin/pengaturan/akademik` | R · U · AP · diff | `academic_rules.params` tanpa skema Zod (RD E W-06) → **kunci** sebelum ADM-6 |
| | Skala nilai · komposisi · jendela KHS/kartu ujian | `/admin/pengaturan/nilai` | C R U D · **LK** | 🧩 per prodi (BENCH-94); `int4range` bug (BENCH-89) |
| | Kamus data referensi (`reference_items`) + sinkron Feeder | `/admin/referensi` | C R U D · IMPORT · EXPORT | `sync` endpoint belum di API_SPEC |
| | Cekal & clearance | `/admin/pengaturan/cekal` | R · C · **DS** · release | 4 vs 5 dimensi (K-10/K-11); `expires_at` hilang (RD-29) |
| **Operasional** | Impor massal (3 langkah) | `/admin/impor` | C · **AP** komit | ⛔ belum bisa: `platform.import.*` belum ber-nomor (K-2; nama terdaftar di `RBAC §4.5.6`) |
| | Kesehatan Data + gerbang `ACTIVE` | `/admin/kesehatan` | R · EXPORT | nol rute & nol model hasil run |
| | Audit viewer (tenant sendiri) + statistik login | `/admin/audit` | R · EXPORT | pemancar audit belum ada di kode (RD-15) |
| | Pengaturan tenant (locale, timezone, NIM format, penomoran, IP allowlist) | `/admin/pengaturan/tenant` | R · U | `tenant_settings` ✅ DDL, ❌ layar |

### 2.3 Hak tingkat tombol (contoh keputusan yang harus eksplisit)
| Tombol | Izin | Penjaga state | Perilaku bila ditolak |
|---|---|---|---|
| Tutup periode | `academic.period.update` | tidak ada KRS `DRAFT`, tidak ada nilai `DRAFT`, tidak ada `SUSPENSE` keuangan | `423 PERIOD_CLOSED` + strip sebab (FR-ADM-11) |
| **Reopen** periode | `academic.periodreopen.approve` | **dua actor berbeda** + `bap_number` untuk reopen tipe lama (BENCH-126) | `403 REOPEN_REQUIRES_APPROVAL` |
| Simpan perubahan hak | `identity.assignment.grant` | self-approval dilarang; MFA aktif | `409 SELF_APPROVAL_FORBIDDEN` |
| Nonaktifkan master | `admin.<objek>.deactivate` | impact-analysis: `409 REFERENCE_IN_USE` + daftar rujukan | tawarkan nonaktif-soft, jangan hapus (FR-ADM-12) |
| Komit impor | `platform.import.commit` | **nol** temuan `BLOCK` (AC-ADM-2) | `422 IMPORT_HAS_BLOCKING_ROWS` |
| Set `status=ACTIVE` tenant | `tenant.lifecycle` | panel Kesehatan Data hijau | `422 DATA_HEALTH_GATE_FAILED` |

### 2.4 Hak tingkat field
| Objek | Field | READ | WRITE | Catatan |
|---|---|---|---|---|
| `user_role_assignments` | `scope_*`, `valid_from/to` | R-2 | R-2 **dengan** `VALIDATE` (empat-mata) | ⛔ jangan izinkan `UPDATE` langsung |
| `students` | `status_akademik` | R-2, R-3 | **R-3 saja** (`ADMIN_ACADEMIC`) | R-2 mengelola akun, bukan status akademik — pemisahan tanggung jawab |
| `invoices`, `ledger` | semua | ⛔ **R-2 tidak membaca nilai uang** | ⛔ | SoD: admin IT tidak boleh melihat/bendahara-bukan-dia (RBAC §7) |
| `rooms` | `latitude/longitude/geofence_radius_m` | R-2 (setup), R-4 (kelasnya) | R-2 | ⚠️ kolom belum ada (BENCH-73) |
| `tenant_settings` | `nim_format`, `document_numbering` | R-2 | R-2 + `VALIDATE` | NIM format wajib anti-tabrakan (BENCH-04) |
| `mfa_factors` | `secret` | ⛔ tidak pernah keluar | service-only | ⛔ teks polos di DB (SEC-14) — wajib terenkripsi |

### 2.5 Endpoint
Inventaris rekursif `/api/v1/admin/**` = **28 berkas/39 metode DB-backed**. Kontrak tiap path/verb milik `API_SPEC §4.6`; pola `/admin/{objek}` tidak berarti seluruh objek sudah punya CRUD atau permission generik `admin.*`.

| Permukaan | Izin katalog / status target | Batas |
|---|---|---|
| Directory, membership, role, assignment | `identity.user.*`, `identity.membership.*`, `identity.role.*`, `identity.assignment.*` sesuai kode eksplisit | implementasi parsial; tenant/scope target diselesaikan server, grant tidak boleh melampaui pemberi |
| Keputusan perubahan hak | `identity.accessrequest.approve` (352, VALIDATE) | bukan pemohon/target, MFA; penolakan hasil negatif izin yang sama, bukan kode baru |
| Organisasi/prodi, kamus/meta, parameter | katalog objek §4 RBAC; parameter approve 375/376, bukan wildcard grant | DB-backed parsial; domain menyetujui kebijakan, IT hanya binding |
| Periode/reopen dan aturan akademik | kode domain sesuai RBAC/API, bukan hak otomatis R-2 | state, dua actor/BAP bila disyaratkan, scope program/periode; bukan klaim seluruh endpoint hidup |
| Impor master | `master.import.validate`/`master.import.commit` (319/320) sesuai status katalog | izin domain/scope, nol komit bila BLOCK; tidak memakai `platform.import.*` |
| Kesehatan data, SSO, DSAR dan maintenance | kontrak/izin tiap menu §11.2; yang belum ada **permission pending/spec-only** | tidak mengarang path runtime, tidak menolak target hanya karena backend belum ada |

### 2.6 Komponen UI
- **Satu pola daftar→drawer** untuk 32 objek (UI_UX §9.2): `VelzonDataGrid` + `offcanvas` drawer + kolom `Status` + aksi `Nonaktifkan` sebelum `Hapus`.
- Wizard 4 langkah dengan **diff-before-save** (pengganti 9 tab Sevima) — tampilkan `<sebelum> → <sesudah>` per parameter, simpan = satu transaksi + satu audit.
- Matriks hak: grid `resource × verb` (6 kolom) + penanda scope; perubahan **tidak** langsung tersimpan — masuk keranjang lalu menjadi `access_change_requests`.
- Dampak-penghapusan: dialog angka ("42 mahasiswa, 7 kelas, 3 kurikulum akan terputus") — tombol bahaya aktif setelah angka terbaca.
- Semua label dari `admin.*` — ⚠️ kunci i18n **belum ada** dan paritas `id`/`en` sudah bocor (RD-19).

### 2.7 Edge case
1. **Scope yang diberikan lebih luas daripada pemberi** → tolak (`403 SCOPE_ESCALATION`); ini celah klasik RBAC ber-scope.
2. **Dua admin mengedit aturan prodi yang sama bersamaan** → `version` optimis + `409 CONFLICT_VERSION` (hari ini `version` hanya ada di 3 tabel dan tidak ada kontrak HTTP-nya).
3. **Admin IT mencoba menyetujui permintaannya sendiri** → `409 SELF_APPROVAL_FORBIDDEN`.
4. **Reopen periode lalu nilai berubah** → wajib memicu rekalkulasi KHS/transkrip + PDM Feeder (BENCH-92) — R-2 tidak boleh menganggap ini urusan R-6.
5. **Impor 20 000 baris dengan 1 NIM duplikat** → nol baris tertulis (AC-ADM-2); laporan baris-gagal dapat diunduh.
6. **Tenant mengaktifkan modul yang bergantung modul belum aktif** → `422 MODULE_DEPENDENCY_UNMET` (sudah ada kontraknya, belum ditegakkan).

### 2.8 DoD lapisan R-2
- [ ] `0011` **diterapkan** + `requireDataPrincipal` menggantikan perluasan carrier di ≥ 7 rute tulis (SEC-10); pencabutan grant terasa **sebelum** JWT kedaluwarsa (invalidasi event-driven).
- [ ] Setiap rute `/admin/**` memuat L3+L4; fixture dua tenant → lintas tenant = `404`, lintas scope = `403`.
- [ ] Empat-mata untuk perubahan hak; self-approval ditolak; MFA untuk semua tulis admin (G-07 tertutup untuk peran ini).
- [ ] 32 objek CRUD seragam + impact-analysis + soft-delete; tidak ada `DELETE` fisik untuk data yang dirujuk.
- [ ] Katalog peran **dibekukan** satu daftar (RD-17) dan layar menampilkannya dari `ROLE_CODES`, bukan hardcoded.
- [ ] Kunci i18n `admin.*` lengkap id/en + gerbang diff kunci.

## 3. R-3 — ADMIN AKADEMIK (BAAK) & ADMIN KEUANGAN (BAUK)

Satu lapisan, **dua peran yang tidak boleh digabung**. Alasan bukan estetika organisasi: BR-K2 dan `MUTUALLY_EXCLUSIVE_ROLES` hanya punya makna bila pemohon dan penyetuju adalah dua akun berbeda. `AUDIT_READINESS §5.2 SEC-12` menemukan `violatesSoD()` **tidak dipanggil di mana pun** — artinya hari ini satu orang bisa memegang keduanya tanpa ada yang menolak.

### 3.A `ADMIN_ACADEMIC` (BAAK) — scope `ORG` / lintas prodi

#### 3.A.1 Identitas
| Aspek | Spesifikasi |
|---|---|
| Wadah 🟡 | `ROLE_CODES` ✅ + seed ✅ (grant besar) — layar ❌ |
| Scope | `ORG` (fakultas) atau `TENANT` (BAAK pusat); **selalu** dievaluasi dari `user_role_assignments.scope_org_id` — bukan dari label "admin" |
| MFA | Wajib untuk `INSERT/UPDATE/DELETE/VALIDATE` (G-07) |
| ⛔ | Tidak boleh menulis nilai mahasiswa (milik `LECTURER`), tidak boleh membaca angka keuangan (milik BAUK) |

#### 3.A.2 Pohon menu
| Menu | Sub-menu | Rute | Aksi | Catatan |
|---|---|---|---|---|
| **Master akademik** | Kurikulum & versi & masa berlaku | `/admin/cetak-biru/kurikulum` | C R U D · **LK** publish | `curricula` kurang `effective_to/status/min_sks_elective` (RD-29) |
| | Mata kuliah (SKS 4 macam, tipe, bahasa) | `/admin/cetak-biru/matakuliah` | C R U D | ⚠️ 4 nama kolom SKS bertabrakan (K-13) — **satu** keputusan dulu |
| | Prasyarat & ko-requisite | `/admin/cetak-biru/prasyarat` | C R U D | `TAKEN/CO_REQ` vs `PREREQUISITE_PASSED/…` (K-13) |
| | Ekivalensi & konversi (RPL/pindahan/MBKM) | `/admin/cetak-biru/ekivalensi` | C R U D · **AP** | 🧩 tabel `course_equivalencies` ada DDL-nya, belum rute |
| | OBE: CPL/CPSK/matriks capaian | `/admin/cetak-biru/obe` | C R U · EXPORT | 🧩 7 objek tanpa DDL (§4.2), SKPI bergantung sini (BENCH-115) |
| **Mahasiswa** | Biodata & status akademik | `/admin/mahasiswa` | R · U · **DS** change-status · IMPORT · EXPORT | status = `VALIDATE` + alasan; riwayat `student_status_history` |
| | Pindah prodi / cuti / DO / aktif kembali | `/admin/mahasiswa/status` | C · **AP RJ** | 🧩 `student_transfers` tanpa DDL; NIM asal→tujuan (BENCH-11) |
| | Pairing dosen wali + **kuota wali** | `/admin/mahasiswa/wali` | C R U D | 🧩 `advisement_assignments` tanpa DDL + kuota (BENCH-39) |
| | Studi peringatan (SP1/SP2) & DO otomatis | `/admin/mahasiswa/peringatan` | R · C surat · **AP** | 🧩 `study_warnings` + ambang BR-S1 belum representabel |
| **Penyelenggaraan** | Generate kelas massal & kelas paralel | `/admin/kelas` | C R U D · **AP** paralel · IMPORT | `409 MAX_PARALLEL_CLASSES_EXCEEDED` |
| | **Sebaran kelas** (kelas × prodi × skema) | `/admin/kelas/sebaran` | C R U D | ⛔ **objek belum ada** — tanpa ini KRS lintas prodi/MKDU mustahil (BENCH-35) |
| | **Paket KRS cohort** (prodi × periode × rentang angkatan) | `/admin/penyelenggaraan/paket-krs` | R · C · U · **AP** publish · archive (U) | `krs_packages`/`krs_package_lines` sudah dispesifikasikan; create/publish tetap usulan RBAC (`CRD-5b`), hard DELETE tidak dirender |
| | Jadwal & plotting (ruang × hari × blok) | `/admin/jadwal` | C R U D · **LK** publish | ⛔ tanpa `EXCLUDE` constraint → perang plotting (BENCH-52) |
| | **Jadwal ujian** (UTS/UAS/CBT/sidang) | `/admin/jadwal/ujian` | C R U D · terbit kartu | ⛔ `exam_schedules` tidak ada sama sekali (BENCH-60) |
| | generate pertemuan & realisasi minggu | `/admin/jadwal/pertemuan` | C R U · **AP** ganti jadwal | `week_pattern`/status sesi ❌ di kode (BENCH-56/57) |
| **Nilai & KHS** | Rekap nilai lintas kelas/prodi | `/admin/nilai` | R · **UL** · **AP** koreksi · **LK** · EXPORT · recompute | ⚠️ `grading.unlock` verb salah (K-5); recompute belum ada |
| | Publikasi KHS (umumkan vs kunci) | `/admin/nilai/publikasi` | **AP** publish · R | 🧩 `grade_publish_states` tanpa DDL (BENCH-117 pola) |
| | Pemutihan nilai (blanket reset) | `/admin/nilai/pemutihan` | **DS AP** | ⛔ berbahaya: isi 100 + auto-lock (BENCH-87) — wajib `VALIDATE` dua orang, izin belum ada |
| **Kelulusan** | Cekal & clearance multidimensi | `/admin/kelulusan/cekal` | C R **DS** release | 4 vs 5 dimensi (K-10/K-11) |
| | Yudisium: batch, peserta, SK, predikat | `/admin/kelulusan/yudisium` | C R **AP RJ** · EXPORT · TTE | ⛔ `graduation_records` dobel (RD-06/AUD-09) — jangan bangun di atasnya |
| | Transkrip & SKPI + legalisir | `/admin/kelulusan/transkrip` | R · C · EXPORT · **REVOKED** | ⛔ baris transkrip tidak dipersist (BENCH-117) → arsip tak terpenuhi |
| **Feeder (input side)** | Pemetaan & pra-validasi (lihat §6) | `/admin/feeder/pemetaan` | R · C · U | BENCH-123 mapping 3 bentuk |
| **Laporan** | Kepatuhan nilai, utilisasi ruang, statistik login | `/admin/laporan` | R · EXPORT | `academic.export.bulk` ≠ `export.own` |

#### 3.A.3 Hak tingkat field — yang paling sensitif
| Objek.field | READ | WRITE | Aturan khusus |
|---|---|---|---|
| `students.personal_nik_encrypted`, `guardians.nama_ibu` | `ADMIN_ACADEMIC`, `HR_BKD_OFFICER`, pemilik diri | `ADMIN_ACADEMIC` | dipakai validasi DUKCAPIL (BENCH-136); **jangan** pernah keluar di ekspor massal |
| `students.nim` | semua peran akademik | `ADMIN_ACADEMIC` + `PMB_OPERATOR` | `immutable_after: NIM_ISSUED`; daur ulang hanya bila belum ke Feeder (BENCH-03) |
| `students.status_akademik` | `*akademik`, `LEADER` | **`ADMIN_ACADEMIC` saja**, lewat aksi | transisi = 1 baris `student_status_history` + audit; ⛔ bukan `PATCH` kolom |
| `grades.raw_score` | pengampu, kaprodi, mahasiswa setelah publish | `LECTURER` saja | BAAK **tidak** boleh mengedit angka mahasiswa — hanya membuka kunci lewat `VALIDATE` |
| `grades.status`, `letter` | `*` | **SERVER_ONLY** | menutup SEC-02 (klien mengirim status/periode) |
| `enrollments` (kursi) | `*` | lewat aksi KRS | ⛔ jangan izinkan sunting `enrolled_count` manual (invariance I-2) |
| `krs_packages.entry_year_from/to`, `code`, `name`, `is_auto_fill`, `krs_package_lines.class_id/seq/is_required` | `ADMIN_ACADEMIC`, `HEAD_OF_PROGRAM` dalam scope | draft creator lewat izin package; create/publish belum ber-grant | `packed_sks`/`sks_snapshot` dihitung server; `state`, `version`, `requested_by`, `approved_by`, `published_at` server-only; paket PUBLISHED immutable; BR-R2 tetap menang |
| `invoices.*`, `ledger.*` | ⛔ **BAAK tidak punya hak baca uang** | ⛔ | SoD; jika BAAK butuh "sudah bayar atau belum", ia membaca **`blockades`/gate status boolean**, bukan nominal |

#### 3.A.4 Endpoint inti
| Endpoint | Permission | L4 scope | Status |
|---|---|---|---|
| `GET /api/v1/admin/mahasiswa?...` | `academic.student.view` | `scope_org_id` membatasi baris | ❌ |
| `PATCH /api/v1/admin/mahasiswa/:id/status` | `academic.student.status` + `VALIDATE` | mahasiswa ∈ scope + alasan wajib | ❌ |
| `POST /api/v1/admin/kelas/sebaran` | `teaching.class.distribute` | kelas & prodi ∈ scope | ❌ 🧩 objek belum ada |
| `GET/POST/PATCH /api/v1/admin/academic/krs-packages` | `enrollment.pack.view`, usulan `enrollment.pack.create`, `enrollment.pack.apply` | program + periode + cohort ∈ scope | ❌ `spec-only`; create belum bernomor |
| `POST /api/v1/admin/academic/krs-packages/:id/publish` | usulan `enrollment.pack.publish` (`VALIDATE`) | penyetuju ≠ penulis, MFA; package scope PROGRAM | ❌ `spec-only`; grant/SoD belum diputus |
| `POST /api/v1/admin/jadwal/conflict-check` | `teaching.schedule.update` | tenant+ruang | ❌ (conflict-detector service ada 🟡 untuk uji, bukan rute) |
| `POST /api/v1/admin/nilai/:classId/unlock` | `grading.unlock` (**verb `VALIDATE`**) | koreksi-request ada + kaprodi prodi itu | ❌ K-5 menghalangi |
| `POST /api/v1/admin/nilai/recompute` | `assessment.recompute` | scope kelas/periode | ❌ |
| `POST /api/v1/admin/yudisium/:id/approve` | `academic.yudisium.approve` | bukan pemohon; clearance semua dimensi | ❌ 🧩 tertahan RD-06 |
| `GET /api/v1/documents/print/:type` | `document.print.*` | dokumen milik pemohon/tenant | ❌ **hanya hidup di INDEX** (RD-33) |

#### 3.A.5 Komponen UI
- Grid master dengan **baris dampak** (impact) dan status chip; drawer form untuk 32 objek; wizard 4 langkah untuk aturan.
- Halaman "mengapa terkunci": strip sebab + tautan perbaikan (FR-ADM-11) — bukan pesan generik; ini jawaban atas titik lemah pembanding (BENCHMARK D-4/D-6).
- Pematian kolom (bukan penghapusan) untuk peran tanpa hak field: tampil `••••••` + tooltip "dibatasi kebijakan", bukan sel kosong yang membingungkan.
- Panel kelulusan menampilkan checklist clearance 5 dimensi dengan status per-dimensi dan penanggung jawab.

#### 3.A.6 Edge case
1. **BAAK lintas fakultas**: assignment `ORG=fakultas A` mencoba mengubah mahasiswa prodi di fakultas B → `403 ADMIN_SCOPE_MISMATCH` (sudah punya kode error).
2. **Kelas lintas prodi tanpa sebaran** → tidak muncul di KRS (BENCH-35) dan **harus** tampak sebagai "disebar ke prodi X?" di admin, bukan hilang misterius.
3. **Pengulangan matakuliah**: `UNIQUE(tenant,student,class)` membolehkan dua enrollment; tanpa aturan attempt yang dihitung (BENCH-45/86) IPK bisa ganda-count. Wajib `repeat_of_id` + aturan "dihitung sekali".
4. **Koreksi nilai setelah yudisium** → wajib memicu versi transkrip baru + PDM (BENCH-92); BAAK tidak boleh menganggap "sudah terkunci" sebagai akhir.
5. **Pemutihan nilai saat sebagian mahasiswa memang tidak ikut ujian** → `[TIDAK-TERVERIFIKASI]` perilakunya di pembanding; keputusan kita: hanya mengisi **`K/Kosong`**, `E` tidak tersentuh, dan auto-lock **wajib** persetujuan kedua.
6. **Cekal keuangan dibuat BAUK, clearance dibaca BAAK** → preseden: `blockades` menahan aksi, `clearances` menahan kelulusan; bila berbeda, **yang paling ketat menang** + tampilkan keduanya (BENCH-104).

#### 3.A.7 DoD
- [ ] Semua tulis ber-`VALIDATE` dengan alasan + MFA; tidak ada satu pun rute yang menulis kolom `SERVER_ONLY`.
- [ ] Sebaran, jadwal ujian, `repeat_of_id`, sebaran→KRS-visibility **satu** perubahan koheren + uji "kelas tidak muncul tanpa sebaran".
- [ ] BAAK tidak punya hak baca nominal keuangan (uji 403 eksplisit).
- [ ] Rekap kepatuhan nilai & utilisasi ruang terbaca dari query teragregasi, bukan N+1.

### 3.B `ADMIN_FINANCE` (pemohon) & `TREASURER` (penyetuju) — BAUK

#### 3.B.1 Identitas & pemisahan
| Aspek | `ADMIN_FINANCE` | `TREASURER` |
|---|---|---|
| Scope | `TENANT` | `TENANT` |
| Posisi SoD | **pemohon** void & keringanan | **penyetuju** void, keringanan, penutupan `SUSPENSE`, tutup buku |
| Carrier | ⛔ **tidak dipetakan** dari `tenant_admin` (sengaja di `CARRIER_TO_ROLES`) — harus assignment eksplisit | sama |
| MFA | wajib | wajib |
| Tidak boleh | menyetujui sendiri (BR-K2) | mengajukan sendiri |

#### 3.B.2 Pohon menu
| Menu | Sub-menu | Rute | Aksi | Peran |
|---|---|---|---|---|
| **Tarif** | Kelompok tarif & komponen biaya | `/admin/keuangan/tarif` | C R U D · **LK** efektif | FIN |
| | Golongan UKT/SPP & penentuan per mahasiswa | `/admin/keuangan/ukt` | C R U · **AP** | FIN |
| | Diskon/beasiswa non-tarif | `/admin/keuangan/keringanan` | C · **AP RJ** (FIN ajukan, TRE setujui) | FIN + TRE |
| **Penagihan** | Generator tagihan (idempoten, batch) | `/admin/keuangan/generate` | C · EXPORT | FIN — ⛔ penjaga: hanya mahasiswa status-semester AKTIF (BENCH-27) |
| | Invoice & status | `/admin/keuangan/tagihan` | R · **DS** void · **AP** · print | FIN/TRE |
| | **Virtual Account** issue/cancel | `/admin/keuangan/va` | C · **AP** cancel | FIN — ⛔ `virtual_accounts` tidak ada (BENCH-20) |
| | Cicilan/rencana pembayaran | `/admin/keuangan/cicilan` | C R U · **AP** | FIN — cicilan ditetapkan **di tarif**, mahasiswa tidak memilih (BENCH-26) |
| **Pembayaran** | Masuk pembayaran (webhook + manual teller) | `/admin/keuangan/pembayaran` | R · C manual · **AP** confirm | FIN/TRE |
| | Rekonsiliasi (auto + suspense) | `/admin/keuangan/rekonsiliasi` | R · C run · **AP** tutup suspense | TRE |
| | Retur/refund & deposit | `/admin/keuangan/refund` | C · **AP RJ** | TRE |
| **Gerbang** | Matriks gerbang tagihan → aksi akademik | `/admin/keuangan/gerbang` | R · U · **DS** override per kasus | FIN (aturan) / DEKAN-KAPRODI (override per kasus) |
| **Buku** | Jurnal/ledger, tutup buku periode | `/admin/keuangan/buku` | R · **AP** close · EXPORT | TRE |
| **Laporan** | Piutang, pendapatan, aging | `/admin/keuangan/laporan` | R · EXPORT | FIN/TRE |


#### 3.B.3 Hak tingkat field
| Objek.field | READ | WRITE | Aturan |
|---|---|---|---|
| `invoices.total_rupiah`, `net_amount` | FIN, TRE, `LEADER`, mahasiswa (miliknya) | **SERVER_ONLY** (turunan baris) | ⛔ jangan `PATCH`; perubahan lewat re-issue/credit note (BENCH-30) |
| `invoices.status` | `*keu` | SERVER_ONLY | transisi `DRAFT→ISSUED→PARTIAL→PAID/OVERDUE/WAIVED/VOID` |
| `ledger.debit/credit`, `account_code` | FIN, TRE, COMPLIANCE | SERVER_ONLY | ⛔ tanpa `invoice_id` wajib — jurnal non-piutang harus mungkin (BENCH-31) |
| `payments.vendor_transaction_id` | TRE, sistem | **UNIQUE per tenant** | idempotensi AC-KEU-1 |
| `blockades (kind=FINANCE)` | FIN membuat, TRE melepas | via aksi | `CHECK lifted_by <> imposed_by` → actor sintetis `system:billing`/`system:reconciliation` (INTEGRATIONS §2.4) |
| `students.guardian_income_rupiah` | FIN (penentuan kelayakan UKT) | ⛔ | masking wajib di ekspor (§0.3 aturan 4) |

#### 3.B.4 Endpoint inti
| Endpoint | Permission | Penjaga | Status |
|---|---|---|---|
| `POST /api/v1/admin/invoices/generate` | `finance.invoice.generate` | periode + status semester + idempoten | ❌ |
| `POST /api/v1/admin/invoices/:id/void` | `finance.invoice.void` (ajukan) | ⛔ bukan penyetuju | ❌ (SoD tidak ditegakkan — SEC-12) |
| `POST /api/v1/admin/invoices/:id/void/approve` | `VALIDATE` | TRE + MFA + alasan | ❌ |
| `POST /api/v1/admin/va` / `…/va/:id/cancel` | `finance.va.generate/cancel` | jatuh tempo & filter conflict (BENCH-22) | ❌ 🧩 |
| `POST /api/v1/payments/webhook/:gateway` | publik + **verifikasi signature** | timing-safe setara panjang; replay window; idempoten | ❌ **belum ada di API_SPEC** (RD-26) |
| `POST /api/v1/admin/reconciliation/runs` | `finance.reconcile.run` | Primary (read-your-writes) | ❌ |
| `POST /api/v1/admin/reconciliation/:id/resolve` | `VALIDATE` | TRE; `SUSPENSE` → match/refund | ❌ |
| `POST /api/v1/admin/books/:period/close` | `finance.book.close` | tidak ada `SUSPENSE` terbuka | ❌ |

#### 3.B.5 Komponen UI
- Form tarif dengan **preview tagihan** (nominal terhitung sebelum simpan) + diff.
- Antrean persetujuan dua kolom: "diajukan saya" (tidak dapat disetujui) vs "menunggu saya" — mencegah pelanggaran SoD secara visual, bukan hanya di API.
- Rekonsiliasi: tiga angka wajib tampil berdampingan (baris gateway · match · suspense) + drill-down; penutup buku **disabled** selama suspense > 0.
- Chip status 7 nilai `invoice_status` → 4 kelompok tampilan (RD-34); jangan pakai 3 chip seperti desain lama.

#### 3.B.6 Edge case
1. **Tiga callback bersamaan** → tepat satu baris ledger (AC-KEU-1) lewat `UNIQUE` + `idempotency_keys`; kontrak HTTP idempotensi belum ditulis (RD-28 catatan).
2. **Pembayaran datang setelah VA expired / setelah dibatalkan** → `SUSPENSE`, **jangan** auto-PAID (BENCH-23).
3. **Overpay / satu transfer banyak invoice** → `payment_allocations` + prioritas denda→pokok→deposit (BENCH-24).
4. **Batal bayar kanal gateway** → ⛔ tidak boleh hapus-balik; wajib `REFUND` via API vendor (BENCH-25); hanya manual/teller yang boleh.
5. **Bebas biaya (waiver) setelah invoice terbit** → credit note + re-issue, bukan edit `total_rupiah` (BENCH-30); dan `void` vs `waiver` dua aksi berbeda.
6. **Cicilan awal membuka gerbang** → kebijakan tenant (BENCH-26 / P-2); **AC-KEU-5 kita saat ini menyangkal** kemungkinan ini — harus direvisi.
7. **Ujian: BAAK melihat gerbang tanpa nominal** → gate mengembalikan boolean + sebab, bukan jumlah rupiah (hak atas field 3.A.3).

#### 3.B.7 DoD
- [ ] `violatesSoD()` benar-benar dipanggil di rute void/waiver/koreksi (SEC-12) dengan uji actor tunggal → 403.
- [ ] Ledger dua kolom + chart of accounts; `AC-KEU-3` terbukti (reversing entry, bukan DELETE) di DB nyata.
- [ ] Webhook gateway masuk API_SPEC + uji signature (perbaikan `timingSafeEqual` panjang berbeda) + uji replay.
- [ ] Tidak ada rute yang menerima `status`/nominal dari body (SERVER_ONLY).

## 4. R-4 — KAPRODI & DEKAN 🧩, DOSEN PENGAMPU, DOSEN WALI

Lapisan "penyelenggaraan". Di sini **scope adalah fitur utama**: dua orang dengan peran identik bisa punya hak berbeda karena `scope_program_id`/`scope_class_id`/`scope_period_id` mereka berbeda. Inilah lapisan yang paling rusak jika `holdsScoped` tetap tidak dipanggil (SEC-11).

### 4.1 `HEAD_OF_PROGRAM` (Kaprodi) — scope `PROGRAM`
#### 4.1.1 Pohon menu
| Menu | Sub-menu | Rute | Aksi | Penjaga khas |
|---|---|---|---|---|
| **Kurikulum prodi** | Versi kurikulum & mata kuliah | `/prodi/kurikulum` | C R U D · **LK** publish | hanya prodi-nya; `NATIONAL_CAP_TIGHTEN_ONLY` |
| | Prasyarat & ko-requisite | `/prodi/kurikulum/prasyarat` | C R U D | pasangan atomik (BENCH-46) |
| | Ekivalensi & konversi MBKM/RPL | `/prodi/kurikulum/ekivalensi` | C R U · **AP RJ** | ⛔ jangan setujui konversi > plafon BR-M1 |
| | OBE: CPL/CPSK & matriks capaian | `/prodi/obe` | C R U · EXPORT | bobot per CPL berjumlah 1 |
| **Kelas & jadwal** | Daftar kelas prodi + paralel | `/prodi/kelas` | C R U D · **AP** paralel | plafon kelas paralel |
| | Plotting jadwal & ruang | `/prodi/jadwal` | C R U · **LK** publish | ⛔ `EXCLUDE` constraint dulu (BENCH-52) |
| | Pengampu & bobot team-teaching | `/prodi/kelas/pengampu` | C R U D | jumlah bobot = SKS kelas (BENCH-62) |
| | Jadwal ujian & kartu ujian | `/prodi/ujian` | C R U · terbit kartu | 🧩 `exam_schedules` belum ada |
| **Presensi & nilai** | Rekap kehadiran per kelas | `/prodi/presensi` | R · EXPORT · **AP** banding | denominator = sesi HELD (BENCH-58/70) |
| | Monitor pengisian nilai | `/prodi/nilai/monitoring` | R · **DS** reminder | keadaan "sebagian dosen belum isi" |
| | Koreksi nilai terkunci | `/prodi/nilai/koreksi` | **AP RJ** · **UL** | 🔒 `VALIDATE` + MFA + alasan; **bukan** UPDATE (K-5) |
| | Hitung ulang (IP/IPS/IPK/transkrip) | `/prodi/nilai/recompute` | **AP** | memicu versi transkrip baru (BENCH-98) |
| **Perwalian & status** | Antrean persetujuan KRS | `/prodi/perwalian` | R · **AP RJ** massal | bila wali diam: kebijakan eskalasi (BENCH-50) |
| | Status akademik & dispensasi | `/prodi/mahasiswa` | R · **DS** · **AP RJ** | ⛔ `enrollment.krs.dispense` belum ada kodenya (K-1) |
| | Yudisium: kelayakan & pengusulan | `/prodi/kelulusan` | R · **AP** usul → DEKAN | ⛔ jangan terbitkan SK sebelum clearance selesai |
| **Feeder (prodi)** | Pra-validasi & kirim periode | `/prodi/feeder` | R · **AP** kirim | 11+ cek saat input (AC-FDR-2) |

#### 4.1.2 Hak tingkat field
| Objek.field | READ | WRITE | Aturan |
|---|---|---|---|
| `courses.sks_*` | prodi-nya | kaprodi prodi-nya | ⚠️ `sks_teori+sks_praktik ≤ sks_total` — tapi 4 nama kolom belum dipilih salah satu (K-13) |
| `classes.capacity` | prodi-nya | kaprodi | ≤ `rooms.capacity` kecuali ONLINE (BENCH-54) |
| `grades.letter`/`raw_score` | semua kelas prodi | **⛔ hanya dosen pengampu** | kaprodi boleh **UL** dan menyetujui koreksi, tidak boleh mengetik angka |
| `enrollments.status` | prodi-nya | lewat aksi (wali/kaprodi) | SERVER_ONLY |
| `attendances.gps_*` | kaprodi (audit) | SERVER_ONLY | mask coarse + retensi 90 hari (BENCH-81) |

### 4.2 `DEKAN` 🧩 (Pimpinan Fakultas) — scope `ORG`
**Status: belum ada wadah** (`ROLE_CODES` 17 tidak memuat; `G-13`). Tiga alternatif keputusan produk sudah tercatat (`D-3`), dan rekomendasi saya tetap **peran baru**, bukan pelonggaran `LEADER`.

| Yang hanya bisa dilakukan Dekan | Aksi | Kenapa `LEADER`/`HEAD_OF_PROGRAM` tidak cukup |
|---|---|---|
| Dispensasi KRS lintas prodi di fakultasnya | **DS** (`VALIDATE`) | kaprodi terbatas satu prodi; `LEADER` read-agregat |
| Menyetujui cuti akademik / pindah prodi dalam fakultas | **AP RJ** | butuh `scope_org_id` yang menyerap prodi anakan |
| Mengusulkan yudisium ke rektorat + tanda tangan SK fakultas | **AP** + TTE | rantai `kaprodi → dekan → rektor` (BENCH-106) |
| Membuka kunci nilai koreksi untuk prodi di bawahnya | **UL** (`VALIDATE`) | delegasi kaprodi berhalangan |
| Monitor agregat per fakultas (kepatuhan nilai, utilisasi ruang) | R + EXPORT | `LEADER` membaca agregat kampus, bukan menulis |

**Penjaga wajib:** Dekan hanya atas prodi yang `organizations.parent` = fakultasnya; ⛔ tidak boleh menyetujui permintaannya sendiri; Plt./delegasi perlu objek `signing_authorities` (BENCH-106), kalau tidak, rantai yudisium **tercekat** saat jabatan kosong — penyebab kegagalan paling umum di lapangan.

### 4.3 `LECTURER` (Dosen Pengampu) — scope `CLASS`
| Menu | Sub-menu | Rute | Aksi | Catatan |
|---|---|---|---|---|
| Kelas saya | Daftar kelas + peserta + roster | `/dosen/kelas` | R · EXPORT(roster) | hanya `class_assignments` miliknya |
| | Jurnal pertemuan (bahan, capaian, foto) | `/dosen/kelas/:id/jurnal` | C R U | 🧩 `session_journals` tanpa DDL; wajib untuk akreditasi/BKD |
| Presensi | Buka sesi + QR + rekap | `/dosen/presensi` | C **OPEN/CLOSE** · R · **AP** banding | 🟡 rute ada; **`qr/generate` = signing oracle** (SEC-03) |
| | Banding kehadiran mahasiswa | `/dosen/presensi/banding` | R · **AP RJ** | 🧩 tabel `attendance_appeals` belum ada |
| Nilai | Input per komponen | `/dosen/nilai/:kelas` | C R U · **LK** | ⛔ hari ini tanpa kolom `grade_component_scores` (BENCH-88) |
| | Umumkan vs kunci | `/dosen/nilai/:kelas/publikasi` | **AP** publish · **LK** | announce ≠ lock (FR-AKA-18) |
| | Minta koreksi nilai terkunci | `/dosen/nilai/koreksi` | C (ajukan) | penyetuju = kaprodi; **bukan** dirinya |
| BKD & beban | Realisasi minggu & bobot mengajar | `/dosen/beban` | R | ⛔ > 18 ditolak Feeder (BENCH-59) |

**Aturan field dosen:** `grades.status` & `letter` SERVER_ONLY; `raw_score` hanya untuk kelas yang ia ampuh **dan** periode `OPEN` **dan** jendela BR-G1 belum lewat. Dosen **tidak** boleh membaca nilai kelas dosen lain (walaupun satu prodi).

### 4.4 `ADVISER` (Dosen Wali) — scope `PERIOD` + daftar binaan
| Aksi | Rute | Permission | Penjaga | Status |
|---|---|---|---|---|
| Lihat draf KRS binaan | `/wali/krs` | `enrollment.krs.view` | mahasiswa ∈ `advisement_assignments` periode ini | ❌ pairing belum ada tabelnya |
| **AP** KRS (individual/massal) | `POST /academic/krs/approve` | `enrollment.krs.approve` | **wajib** cek relasi wali → kini id dari body dipakai buta | 🟡 guard ada, **IDOR-RISK** (SEC-04) |
| **RJ** KRS dengan alasan | sama | `enrollment.krs.reject` | `reason` wajib (AC-AKA-2) | ❌ kode `.reject` belum ada (K-3) |
| Setujui sunting KRS pasca-window | `/wali/krs/sunting` | `enrollment.krsedit.approve` | + expiry | 🧩 |
| Setujui konversi MBKM | `/wali/mbkm` | `enrollment.mbkm.approve` (usulan) | dua penyetuju | ⛔ |
| Rekomendasi yudisium | `/wali/rekomendasi` | `enrollment.krs.recommend` | bukan penyetuju akhir | 🟡 |

**Kebijakan bila wali tidak memvalidasi sampai OW tutup** (BENCH-50) — harus jadi parameter, bukan keputusan kode: `AUTO_APPROVE_ON_EXPIRY` | `BLOCK_STUDENT` | `ESCALATE_TO_KAPRODI`. Rekomendasi default: **eskalasi ke kaprodi** (tidak menghukum mahasiswa, tidak menghapus tanggung jawab).

### 4.5 Edge case lapisan R-4
1. **Dosen mengajar 3 prodi** → assignment tiga baris scope berbeda; UI **tidak** boleh menawarkan pemilih "prodi aktif" sebagai pengganti scope (itu label, bukan hak).
2. **Pergantian pengampu di tengah semester** → nilai lama tetap milik pengampu lama (audit), baru milik pengampu baru; perlu `class_assignments.assigned_by/assigned_at` (RD-29 daftar objek dengan DDL tetapi kolom hilang).
3. **Kelas dibatalkan setelah mahasiswa enroll** → kaskade `EFFECTIVE→CANCELLED_BY_PRODI` + kompensasi (BENCH-64).
4. **Nilai `T` (tertunda)** → butuh state `PENDING_COMPONENT` + konversi akhir; SM-4 hari ini tidak punya (BENCH-95).
5. **Dosen berhalangan mengisi sampai deadline** → delegasi ke koordinator + `late_grading_approval` (BENCH-96), bukan penguncian buta.
6. **Kehadiran dihitung dari sesi yang dibatalkan** → ⛔ denominator hanya sesi HELD (BENCH-58).
7. **Team teaching dengan bobot tidak berjumlah SKS** → tolak simpan (`WEIGHT_SUM_NOT_100` analog untuk bobot pengampu) — inilah asal gejala pembanding "SKS Dosen terbaca 0" (BENCH-62).
8. **Kaprodi mencoba membuka kunci nilainya sendiri sebagai dosen** → `VALIDATE` + actor berbeda + `access_change_requests` bila perlu (SoD internal satu orang dua topi).

### 4.6 DoD lapisan R-4
- [ ] `holdsScoped` dipanggil di **setiap** rute tulis R-4; fixture: dosen A mencoba nilai kelas dosen B → 403; kaprodi prodi X menyetujui yudisium prodi Y → 403.
- [ ] `qr/generate` berhenti jadi signing oracle: kelas/sesi diverifikasi, koordinat dari `rooms` (SEC-03).
- [ ] `krs/approve` pindah ke `requireDataPrincipal` + relasi wali + MFA (SEC-04, K-3, G-07).
- [ ] Pemisahan `umumkan` vs `kunci` vs `lockbulk` dengan uji transisi; `grading.unlock` berverba `VALIDATE` (K-5).
- [ ] Jurnal sesi + banding presensi + `exam_schedules` punya DDL & rute (BENCH-60/78, §4.5 register).
- [ ] `DEKAN` diputus (D-3): kalau ya → satu commit berisi `ROLE_CODES` + grant + seed + baris matriks RBAC.

---

## 5. R-5 — MAHASISWA (semua skema) & ORANG TUA/WALI

Prinsip paling sering dilanggar: **empat jenis mahasiswa bukan empat peran** (reguler/non-reguler/pindahan/RPL/MBKM = atribut `enrollment_schemes`). Yang berubah bagi `STUDENT` hanya **apa yang boleh ia kirim**, bukan layar apa yang boleh ia buka.

### 5.1 `STUDENT` — scope `SELF`
#### 5.1.1 Pohon menu (Web + Mobile parity — AGENTS §3.4)
| Menu | Sub-menu | Rute | Aksi | Penjaga |
|---|---|---|---|---|
| Beranda | Kartu periode, tenggat, status | `/mahasiswa` | R | ⛔ jangan tampilkan nominal bila gerbang mengizinkanboolean saja (3.A.3) |
| **KRS** | Kelas tersedia (daring/berkas) | `/mahasiswa/krs` | C · **DS** ajukan dispensasi | 7 kondisi visibility (BENCH-35); AKM aktif (BENCH-37); gerbang tagihan; cekal |
| | Paket cohort (pratinjau/prapilih) | `/mahasiswa/krs` | R melalui `enrollment.krs.view` | hanya program/angkatan/periode dari principal; preview read-only; mahasiswa tetap meninjau sebelum submit |
| | Draf & submit | sama | C · **AP** (kirim) | lease/hold kursi (P-1); `429 QUEUE_POSITION` saat war |
| | Status persetujuan | `/mahasiswa/krs/status` | R | `SUBMITTED/APPROVED/REJECTED` + sebab |
| | Sunting KRS (ajuan) | `/mahasiswa/krs/sunting` | C ajukan | `krs_amendments` + expiry |
| | Drop mandiri (dalam window) | `/mahasiswa/krs/drop` | D(soft) | window + efek tarif (BENCH-43) |
| **KHS / Transkrip** | KHS per semester, IP/IPS/IPK | `/mahasiswa/khs` | R · EXPORT(pdf) | hanya setelah `publish` (≠ `lock`) |
| | Transkrip sementara + QR verifikasi | `/mahasiswa/transkrip` | R · EXPORT | digest publik (BENCH-121) |
| **Keuangan** | Tagihan & jatuh tempo | `/mahasiswa/tagihan` | R · EXPORT(kuitansi) | nomor & status, bukan agregat tenant |
| | Bayar (VA/QRIS) | `/mahasiswa/bayar` | C bayar | kanal aktif; ⛔ jangan buat VA di klien |
| | Cicilan & pengajuan keringanan | `/mahasiswa/keuangan` | C ajukan | keputusan BAUK (bukan dirinya) |
| **Presensi** | Rekap & % kehadiran | `/mahasiswa/presensi` | R | denominator HELD |
| | Scan QR sesi | `/mahasiswa/presensi/scan` | C hadir | geofence + TTL + single-use (BENCH-75) |
| | Ajukan banding (sakit/izin) | `/mahasiswa/presensi/banding` | C ajukan + bukti | window + `evidence_url` (BENCH-78/79) |
| **Kelulusan** | Ajukan yudisium | `/mahasiswa/yudisium` | C ajukan | checklist clearance per dimensi terlihat |
| | Status SK/ijazah/transkrip/PISN | `/mahasiswa/kelulusan` | R · EXPORT | hanya bila diterbitkan |
| | Isi data diri & biodata Feeder | `/mahasiswa/biodata` | U (kolom tertentu) | `SERVER_ONLY` untuk status/NIM |
| | Aktivitas & prestasi (SKPI) | `/mahasiswa/aktivitas` | C ajukan · R status | 🧩 `student_activities` belum ada (BENCH-112) |
| Notifikasi | Preferensi kanal & peristiwa | `/mahasiswa/notifikasi` | R · U | `notification_preferences` tanpa DDL (RD-32) |

#### 5.1.1b Perbedaan per skema enrollment (bukan peran)
| Skema (`enrollment_schemes.code`) | Yang berbeda untuk `STUDENT` |
|---|---|
| `REGULER` | alur KRS penuh di §5.1.1 |
| `NON_REGULER` | plafon/paket per kelas malam; tarif per SKS (BENCH-35 kondisi skema) |
| `PINDAHAN` | awal dengan `recognized_sks` + ekivalensi wajib; ⛔ plafon tidak boleh dihitung ganda |
| `RPL` | pengakuan portofolio (`rpl_assessments` BENCH-14) sebelum KRS pertama |
| `MBKM` | **pengiriman log aktivitas mitra** menggantikan sebagian KRS; konversi dua-approval (BENCH SM-8) |

#### 5.1.2 Hak tingkat field untuk dirinya sendiri
| Objek.field | READ | WRITE | Aturan |
|---|---|---|---|
| `students.nim`, `status_akademik`, `cumulative_sks`, `ipk` | milik diri | ⛔ | read-only; koreksi lewat jalur permintaan (FR-FDR-04) |
| `krs_packages` + `krs_package_lines` | paket `PUBLISHED` yang cocok dengan program/cohort/periode diri | ⛔ definisi paket bukan milik mahasiswa | hanya proyeksi kelas, `packedSks`, plafon BR-R2, status wajib/opsional; kelas tetap tunduk ke distribusi dan jadwal I-12 |
| `students.personal_*` (biodata Feeder) | milik diri | milik diri **kecuali** kolom ter-key (`nik`, `tempat_lahir`) | kolom kunci → ajukan koreksi, bukan `UPDATE` (BENCH-111) |
| `grades.raw_score/letter` | milik diri setelah publish | ⛔ | sebelum publish → `423 NOT_PUBLISHED` |
| `invoices.*` | milik diri | ⛔ | pembayaran lewat aksi, bukan sunting |
| `attendances.gps_*` | ⛔ tidak perlu ditampilkan | SERVER_ONLY | hanya jarak & status yang relevan bagi mahasiswa |

#### 5.1.3 Endpoint & kontrak
| Endpoint | Permission | Status | Catatan |
|---|---|---|---|
| `GET /api/v1/academic/krs/open-classes` | `enrollment.krs.view` | 🟡 **mock** + tanpa guard (SEC-05) | wajib filter 7 kondisi + `remainingQuota` dari aturan jelas |
| `GET /api/v1/academic/krs/packages/current` | `enrollment.krs.view` | `spec-only` | Student SELF; `studentId`/tenant tidak diterima dari klien; `package: null` saat tidak ada yang cocok |
| `POST /api/v1/academic/krs/submit` | `enrollment.krs.submit` | ✅ DB-backed, advisory lock, idempoten | prasyarat & gerbang tagihan **belum** ditegakkan (BENCH-46) |
| `GET /api/v1/academic/khs/[periodId]` | `assessment.khs.view` | 🟡 **IDOR-RISK** (SEC-06) | `periodId` dari URL, mahasiswa tidak diturunkan dari token |
| `GET /api/v1/academic/transcript` | `academic.transcript.view` | 🟡 PII tetap (SEC-06) | derivasi dari `ctx.userId` |
| `POST /api/v1/attendance/qr/scan` | `attendance.qr.scan` | ✅ scope & geofence & HMAC | single-use nonce belum (BENCH-75) |
| `POST /api/v1/finance/payments` | `finance.payment.pay` | ❌ | ⛔ jangan pernah izinkan klien mengirim `amount` |

#### 5.1.4 Komponen UI (Velzon)
- Kartu KRS: badge kuota sisa (hijau→kuning→merah), **penghitung SKS hidup** dengan plafon band IPS, status prasyarat per MK (lolos/sedang/tidak), panel paket cohort yang memprapilih kelas lokal tanpa auto-submit, tombol submit **disabled** dengan sebab terlihat.
- Strip status transaksi: `StateMachineStrip` menampilkan KRS state + gerbang yang menahan + "siapa berikutnya" (wali/BAUK).
- Presensi scan: overlay QR + radius visual + hasil dalam ≤ 2 detik; kegagalan menampilkan **sebab** (di luar radius / sesi tertutup / token dipakai), bukan "gagal".
- KHS/IPK: angka selalu dihitung server; ⛔ tidak ada kalkulasi IPK di klien (dua interpretasi = bug akreditasi).
- Offline Mobile: baca-only cache (jadwal, KHS ter-cache); ⛔ submit KRS/bayar tidak pernah optimistik.

### 5.2 `GUARDIAN` (Orang Tua/Wali) — scope `SELF` tertaut
**Prinsip: hak orang tua adalah consent mahasiswa, bukan default.** Pembanding menyetelnya dari sisi admin; kita menyetelnya dari sisi pemilik data (UU PDP).

| Menu | Isi | Aksi | Consent |
|---|---|---|---|
| Ringkasan akademik anak | IPK kumulatif, SKS, status | R | `consent_scope.academic = true` |
| Presensi & % kehadiran | rekap, bukan koordinat | R | `consent_scope.attendance` |
| Tagihan & status bayar | status & jatuh tempo; **nominal atas consent** | R | `consent_scope.finance` |
| Notifikasi tenggat | email/WA | R | kanal terverifikasi |
| **Tidak tersedia** | sunting data apa pun, unduh transkrip resmi, lihat nilai komponen mentah | ⛔ | — |

| Aturan khusus | Isi |
|---|---|
| Tertaut multi-anak | `student_guardians` banyak-ke-banyak; setiap tautan = consent sendiri |
| Pencabutan consent | mahasiswa dapat mencabut → strip langsung hilang; ⛔ jangan hanya menyembunyikan menu (proyeksi server) |
| Identitas | orang tua **tidak punya** NIM; login email + OTP; ⛔ jangan memakai kredensial mahasiswa |
| Retensi | data ortu (pekerjaan/penghasilan) kelas retensi sendiri (BENCH-117 pola) |

### 5.3 Edge case lapisan R-5
1. **Cekal muncul setelah KRS submit** → beku `FROZEN`, jangan hilang (BENCH-51).
2. **Mahasiswa dua angkatan / dual degree** → assignment per prodi; ⛔ UI tidak boleh mengizinkan "pilih prodi" sebagai sumber hak.
3. **KRS war 150 pengguna 1 kursi** → lease + antrean, bukan 404/500; pesan posisi & perkiraan waktu (BENCH-41).
4. **Bayar lewat VA setelah kedaluwarsa** → dana masuk `SUSPENSE`, status tagihan tidak berubah sendiri (BENCH-23).
5. **Nilai `K` (kosong) vs `T`** → `K` menahan KHS; `T` menahan yudisium; dua pesan berbeda untuk mahasiswa (BENCH-95).
6. **Orang tua menuntut data anak dewasa (≥ 18)** → dasar pemrosesan + consent; tanpa consent → kosong di level API, dengan catatan audit (bukan penolakan membingungkan).
7. **Mahasiswa DO lalu aktif kembali lalu lulus** → SM-5 harus punya jalur; SM-6 harus menerima `INELIGIBLE→ELIGIBLE` (BENCH-109 pola).

### 5.4 DoD lapisan R-5
- [ ] Semua rute mahasiswa menurunkan subjek dari **token**, tidak pernah dari query/body (menutup SEC-06).
- [ ] Visibility KRS 7 kondisi diuji per kondisi (fixture: kelas tanpa sebaran → tidak muncul; kurikulum beda tanpa ekivalensi → tidak muncul; AKM kosong → `423`).
- [ ] Paritas Mobile: KRS, presensi scan, tagihan/bayar, KHS — bottom-nav **disaring** `tenant_modules × peran` (hari ini statis; G-05 sisa).
- [ ] `GUARDIAN` masking dibuktikan di respons (bukan DOM), dengan uji consent dicabut.
- [ ] Tidak ada kalkulasi IPK/kuota di klien (property test determinisme AC-NIL-2).

## 6. R-6 — INTEGRATOR PDDIKTI & LAYANAN EKSTERNAL

Lapisan paling matang **di dokumen** (`INTEGRATIONS §1.4` adalah yang terbaik di seluruh set) dan paling tipis **di kode** (nol tabel bridge, nol rute, nol model hasil validasi). Karena itu lapisan ini dipecah dua: `R-6a` (kamus & pemetaan — **dini**, karena ia input master data R-3) dan `R-6b` (kirim & rekonsiliasi — **akhir**).

### 6.1 `FEEDER_OPERATOR` — scope `TENANT`
| Aspek | Spesifikasi |
|---|---|
| Wadah | `ROLE_CODES` ✅ + seed ✅ + grant ✅ — **layar & rute ❌** |
| Angkat | diangkat surat keputusan rektor (BR-R11); kredensial **tidak pernah** di DB/env plaintext |
| MFA | wajib (satu-satunya peran yang mengirim data nasional) |
| ⛔ | tidak boleh mengirim tanpa pra-validasi; tidak boleh `DELETE` jalur Feeder dalam mode reopen apa pun (invariance I-15 usulan) |

#### 6.1.1 Pohon menu
| Menu | Sub-menu | Rute | Aksi | Catatan |
|---|---|---|---|---|
| **Kamus** (R-6a) | Pemetaan entitas → kode PDDikti | `/admin/feeder/pemetaan` | R · C · U · IMPORT | ⛔ tiga bentuk `pddikti_mappings` (BENCH-123) — satu DDL dulu |
| | Sinkron `Get*` + diff kamus | `/admin/feeder/kamus` | C run · R diff | 🧩 `reference_dictionary_versions` belum ada (BENCH-131) |
| | Versi & tanggal efektif kode | `/admin/feeder/kamus/versi` | R · EXPORT | temuan `FEEDER_DICTIONARY_STALE` |
| **Kelayakan** | Pra-validasi per objek (CP1/CP2) | `/admin/feeder/validasi` | C run · R temuan · EXPORT | 11 cek + ±14 tambahan lapangan (BENCH-132) |
| | Matriks objek × checkpoint × aksi | `/admin/feeder/matriks` | R | ⛔ narasi saja hari ini; perlu tabel normative (BENCH-124) |
| **Kirim** | Antrean kirim + `dry_run` | `/admin/feeder/kirim` | C · **AP** kirim · R status | two-person approval (BENCH-134) |
| | Log sync, retry, DLQ | `/admin/feeder/log` | R · U retry · EXPORT | `error_code 100` / `-1` / `-2` → matriks tindakan (BENCH-129) |
| | Bridge: registrasi agen & kesehatan | `/admin/feeder/bridge` | C R U · **AP** rotasi kredensial | ⛔ `feeder_bridges/jobs/identities` tidak ada (BENCH-127) |
| **Koreksi** | Permintaan PDM | `/admin/feeder/pdm` | C · **AP RJ** · EXPORT lampiran | 6 kolom inti + SPTJM + BAP (BENCH-133) |
| | Buka periode Tipe 1 / Tipe 2 | `/admin/feeder/reopen` | C · **AP** | kapabilitas berbeda: Tipe 1 = INSERT data pokok+transaksional; Tipe 2 = UPDATE transaksional saja (BENCH-125) |
| **Verifikasi** | Tarik data (pull) untuk rekonsiliasi migrasi | `/admin/feeder/tarik` | C run · R selisih | ⛔ arah pull tidak pernah dimodelkan (BENCH-128) |

#### 6.1.2 Hak tingkat field
| Objek.field | READ | WRITE | Aturan |
|---|---|---|---|
| `pddikti_mappings.*` | operator, `ADMIN_ACADEMIC` | operator + `ADMIN_ACADEMIC` | kamus **nilai** dan peta **field** dipisah; `sex_type('M','F')` internal tetap, dipetakan ke `L/P` |
| `feeder_credentials.token_ref` | ⛔ tidak pernah keluar | service-only | referensi Vault, bukan nilai; `expires_at` terlihat |
| `pddikti_sync_runs.raw_log` | operator, COMPLIANCE | SERVER_ONLY | redaksi PII sebelum persist (UU PDP) |
| `students.nik/nama_ibu` | operator **hanya saat validasi** | ⛔ | mask; dasar pemrosesan `feeder_reporting` terdaftar (BENCH-136) |
| `students.pddikti_id`, `enrollments.pddikti_kelas_id` | operator, kaprodi | **hanya dari respons bridge** | ID PDDikti tidak boleh dikarang SICA (I-14 usulan) |

#### 6.1.3 Endpoint
| Endpoint | Permission | Penjaga | Status |
|---|---|---|---|
| `POST /api/v1/admin/feeder/validate` | `feeder.validate.run` | semua objek target punya `tenant_id` benar | ❌ |
| `POST /api/v1/admin/feeder/push` | `feeder.period.send` | ⛔ menahan bila ada temuan `BLOCK` (`409 FEEDER_BLOCKING_FINDINGS`) + approval kedua | ❌ |
| `GET /api/v1/admin/feeder/runs/:id` | `feeder.sync.view` | milik tenant | ❌ |
| `POST /api/v1/admin/feeder/pull` | `feeder.pull.run` | sandbox/produksi dibedakan (BENCH-135) | ❌ |
| `POST /api/v1/admin/feeder/corrections` | `feeder.correction.request` | + `.approve` oleh operator senior (K-3: `.reject` belum) | ❌ |
| `POST /api/v1/admin/feeder/bridges` | `feeder.bridge.manage` | kredensial ke Vault, tak pernah di respons | ❌ |

### 6.2 Layanan eksternal lain (bukan peran, tapi perlu pemilik)
| Integrasi | Peran pemilik | Kontrak yang hilang | Bukti |
|---|---|---|---|
| Payment gateway (Midtrans/Xendit) | `TREASURER` (bisnis) + R-2 (teknis) | rute webhook + signature + replay window + `payment_channels` DDL | RD-26, BENCH-20 |
| PDDikti Neo Feeder | `FEEDER_OPERATOR` | bridge, jobs, identities, kamus versi | BENCH-127/131 |
| Perpustakaan / ILS (Koha, SLiMS) | `UNIT_CLEARANCE_OFFICER` | kontrak inbound utang/denda + auto-pass N hari | BENCH-105 |
| SISTER (dikti) | `HR_BKD_OFFICER` 🧩 | ⛔ **data dosen tidak pernah ditulis ke Feeder** (BR-R16); hanya pencocokan NIDN | RBAC §9.5 |
| DUKCAPIL | tidak langsung | hanya via validasi Feeder (`FEEDER_DUKCAPIL_MISMATCH`) — ⛔ jangan klaim akses langsung | INTEGRATIONS §1.4 |
| TTE PSrE (BSrE/Peruri/Privy) | `LEADER`, `DEKAN`, rektorat | vendor-agnostic (`document_signatures.provider`); keputusan D-9 | PRD NFR-R5 |
| WhatsApp/Email gateway | R-2 (konfigurasi) | `event_code` katalog + `notification_preferences` DDL | RD-32 |
| Object storage (R2/S3) | R-1/R-2 | presign endpoint + `attachments` DDL + sanitasi key | RD-27 |

### 6.3 Edge case lapisan R-6
1. **Token kedaluwarsa di tengah kirim sebagian** → resume `offset`, jangan kirim ulang dari nol (menduplikasi baris).
2. **Bridge offline** → antre di `PENDING_BRIDGE`, jangan 500; operator melihat status agen (`last_seen`).
3. **Sandbox dipakai ke produksi** (atau sebaliknya) → `409 FEEDER_ENVIRONMENT_MISMATCH`.
4. **Kredit/nilai sudah diterima lalu data lokal berubah** → `ACCEPTED→SUPERSEDED` + UPDATE, bukan INSERT ganda.
5. **Akreditasi prodi kedaluwarsa saat kirim** → `BLOCK`; jangan izinkan override senyap (BR-R7).
6. **Kamus wilayah/agama berubah kode** → temuan `FEEDER_DICTIONARY_STALE` + diff, bukan kegagalan saat kirim.
7. **Reopen tipe 2 mencoba menghapus biodata** → ⛔ ditolak (norma nasional), bukan "gagal di Feeder".

### 6.4 DoD lapisan R-6
- [ ] Satu DDL `pddikti_mappings` yang melayani kamus nilai **dan** peta field; generator pemetaan tidak lagi mengarang `L/P`.
- [ ] `feeder_bridges`/`feeder_jobs`/`feeder_identities` ada + idempoten + resumable; `pg`/BullMQ di-dependency contract (RD-11).
- [ ] Matriks `objek × CP1/CP2 × aksi` menjadi tabel (bukan prosa) dan dipakai UI.
- [ ] Kirim `BLOCK` → nol request keluar; approval dua orang; semua temuan tersimpan `pddikti_validation_findings`.
- [ ] Webhook gateway: timing-safe dengan panjang setara + uji replay + uji 3 callback → 1 ledger (AC-KEU-1 nyata).

---

## 7. Matriks silang: SoD, IDOR, dan RLS per lapisan peran

### 7.1 Pasangan SoD yang wajib ditegakkan di **runtime** (hari ini nol penegakan — SEC-12)
| # | Aturan | Pemohon | Penyetuju | Titik penegakan | Bukti sekarang |
|---|---|---|---|---|---|
| SoD-1 | Void/keringanan invoice | `ADMIN_FINANCE` | `TREASURER` | service + `MUTUALLY_EXCLUSIVE_ROLES` | 🟡 aturan di katalog, **tidak ada pemanggil** |
| SoD-2 | Koreksi nilai terkunci | `LECTURER` | `HEAD_OF_PROGRAM` (→ `DEKAN` bila delegasi) | `grade_corrections` + `VALIDATE` | 🟡 tabel ada, rute belum |
| SoD-3 | Reopen periode | `ADMIN_ACADEMIC` | `TENANT_ADMIN` (+ LLDIKTI/BAP untuk tipe lama) | `period_reopen_requests` | ❌ |
| SoD-4 | Perubahan hak/penugasan | peminta | `TENANT_ADMIN` lain | `access_change_requests` empat-mata | 🟡 tabel & seed ada, rute ❌ |
| SoD-5 | Break-glass platform | `PLATFORM_OPERATOR` | atasan platform + TTL 30 menit | `impersonation_grants` | ❌ |
| SoD-6 | Lepas cekal keuangan | sistem (`system:reconciliation`) | pembuat **berbeda** dari pelepas (`CHECK`) | DB CHECK | 🟡 CHECK ada di DDL, tapi jalur rekonsiliasi otomatis menabraknya (INTEGRATIONS §2.4) |
| SoD-7 | Konversi SKS MBKM | koordinator MBKM | kaprodi asal **dan** mitra | `mbkm_contracts` dua penyetuju | ❌ |

### 7.2 Peta risiko IDOR per lapisan — dan penututupnya
| Lapisan | Pola IDOR yang ditemukan | Penututup wajib | Status |
|---|---|---|---|
| R-2 | rute tanpa permission guard (4 rute) | `requirePrincipal(ctx, PERM.x)` + guard `VALIDATE` | ❌ (SEC-05) |
| R-3 BAAK | subjek dibaca dari query (`transcript`, `khs/[periodId]`) | turunkan dari `ctx.userId` / buktikan scope | ❌ (SEC-06) |
| R-3 BAUK | `amount`/`status` diterima dari body | kolom `SERVER_ONLY`; aksi saja | ❌ (SEC-02 pola sama) |
| R-4 | id dari array body tanpa relasi (`enrollmentIds[]`), signing oracle (`sessionId`/`classId`/`geo`) | baca baris dalam `withTenantContext` + `holdsScoped` + koordinat dari `rooms` | ❌ (SEC-03/04) |
| R-5 | `periodId` URL lintas milik | predicate scope + 404 bila bukan milik diri | ❌ (SEC-06) |
| R-6 | id PDDikti diisi klien; kirim tanpa approval kedua | `feeder_identities` hanya dari respons bridge | ❌ (I-14 usulan) |
| semua | header `x-tenant-id`/`x-user-id` dari klien lolos saat token invalid | middleware **menghapus** header itu sebelum menyetel | ❌ (SEC-07) |
| semua | scope dimuat tetapi tidak dibandingkan | panggil `holdsScoped` di tiap rute tulis | ❌ (SEC-11) |
| semua | grant dicabut tetapi JWT masih valid 15 menit | `requireDataPrincipal` + invalidasi event-driven | ❌ (SEC-10) |

### 7.3 Penegakan RLS per lapisan (hasil audit nyata)
| Fakta | Nilai | Arti bagi blueprint |
|---|---|---|
| Tabel `pgTable` | **46** | — |
| Tabel ber-`tenant_id` | **36** | semua punya `ENABLE`+`FORCE`+policy `tenant_isolation` — **tidak ada** tabel ber-RLS tanpa policy, **tidak ada** policy tanpa FORCE ✅ |
| Tabel global (tanpa `tenant_id`) | 10 (`tenants`, `plans`, `users`, `password_history`, `mfa_factors`, `modules`, `module_dependencies`, `plan_modules`, `permissions`, + 1) | 6 katalog disengaja; **3 tabel kredensial** adalah risiko nyata — `mfa_factors.secret` teks polos (SEC-14) |
| GUC tidak diset | policy → `NULL` → **deny** | fail-closed ✅ (tetapi nama GUC salah di 6 dokumen — RD-01) |
| Query domain di luar `withTenantContext` | **0** | ✅ (3 baca katalog global + `SELECT 1` sengaja) |
| Interpolasi SQL mentah | **0** | ✅ semua `sql` terparameterisasi |
| Role aplikasi `NOBYPASSRLS` | **UNVERIFIED** | `client.ts:9-11` default `sica_user`; `0001:185-198` menelan kegagalan → wajib `SELECT rolbypassrls` (P-5) |
| `0011` diterapkan | **belum** | seluruh scope/assignment adalah logika teruji, bukan fakta DB |

**Kesimpulan keamanan yang harus dibaca sebagai satu kalimat:** RLS di level **skema** sudah benar dan gagal-tutup; yang belum adalah **application-scope** (L3/L4) — artinya saat ini sistem melindungi antar-tenant, **belum** melindungi antar-peran di dalam satu tenant. Itulah pekerjaan terbesar lapisan R-2…R-5.

---

## 8. Milestone eksekusi per-peran (untuk `ROADMAP_TASKS.md §2.5.14`)

| Milestone | Lapisan | Isi (hanya yang **bisa** selesai tanpa `0011`/DDL baru ditandai) | Gerbang keluar | Prasyarat |
|---|---|---|---|---|
| **SEC-0** 🔒 | lintas | **P0 keamanan**: SEC-01 MFA stub → SEC-07 header → SEC-03 signing oracle → SEC-05/06 guard rute → SEC-02 `LOCKED`/periode → SEC-12 SoD → SEC-09 `withModule` | 0 rute fail-open; uji eskalasi dua tenant hijau | tidak ada — **jalankan sekarang, sebelum fitur baru** |
| **DOC-0** 🔒 | lintas | RD-01/02 GUC & generator · RD-05 path katalog · RD-03 amplop list · RD-13 enum register · RD-12 kode error · RD-06 AUD-09 · RD-07/08 kosakata keuangan · RD-20 registry migrasi · RD-28/37 cap status & register | kontrak dapat disalin verbatim tanpa tebak | SEC-0 (agar yang ditulis = yang ditegakkan) |
| **R-1** | platform | provisioning tenant, paket & entitlement + gerbang kuota, audit lintas-tenant + verify chain, `impersonation_grants` | R-1 DoD §1.7 | `0012_audit_outbox.sql` |
| **R-2** | tenant admin | 32 objek CRUD seragam + impact + soft-delete; periode & transisi + reopen empat-mata; kalender; kamus referensi; `tenant_settings`; **peran & penugasan ber-scope** | R-2 DoD §2.8 | **`0011` diterapkan** + `requireDataPrincipal` aktif (RD-17 daftar peran beku) |
| **R-3a** | BAAK | master akademik (kurikulum/MK/prasyarat/ekivalensi), mahasiswa & status, pairing wali, generate kelas & jadwal + **sebaran** + **constraint bentrok** | visibility KRS 7 kondisi lulus uji per kondisi | R-2 (scope nyata) |
| **R-3b** | BAUK | tarif & UKT, generator tagihan, **VA**, cicilan, gerbang, ledger/COA, rekonsiliasi, tutup buku | AC-KEU-1/3/5 nyata di DB | DOC-0 (kosakata keuangan), webhook spec (RD-26) |
| **R-4** | kaprodi/dekan/dosen/wali | nilai per komponen + umumkan≠kunci + koreksi/unlock, presensi + jurnal + banding, jadwal ujian + kartu ujian, yudisium berjenjang (+`DEKAN` bila D-3 ya) | §4.6 DoD | R-3a; `0016`–`0018`; K-1/K-3/K-5 tertutup |
| **R-5** | mahasiswa/ortu | KRS penuh (bukan mock) + antrean war, KHS/transkrip, bayar, presensi scan, yudisium, **parity Mobile bottom-nav**, consent ortu | §5.4 DoD | R-4 menghasilkan data riil; P-1 diputus |
| **R-6a** | feeder (awal) | kamus `Get*` + sinkron `reference_items` + versi; `pddikti_mappings` kanonik | master data R-3 dapat divalidasi saat diisi | RD-18 alias modul |
| **R-6b** | feeder (akhir) | bridge/jobs/identities, pra-validasi + temuan, kirim dua-orang, PDM, pull rekonsiliasi | CP1/CP2 terkirim tanpa penolakan | `0019`; BR-R10/11; `bullmq` |
| **Increment add-on historis (bukan R-7)** | lintas R-3…R-6 | PMB (+SM-0) kini masuk slice Fase 1 diperluas (§11.3); sisa kemahasiswaan/SKPI, alumni/legalisir, CBT mengikuti roadmap | tiap modul punya DDL/grant sebelum aktivasi | keputusan dan migrasi terkait tetap harus dibuktikan |

**Cara pakai tabel ini.** Satu baris = satu increment yang bisa didemokan dan diaudit. Lompat baris berarti membangun UI di atas hak yang belum ditegakkan — persis pola yang menghasilkan celah `SEC-*` hari ini. **`SEC-0` dan `DOC-0` bukan bagian dari fitur dan tidak dapat ditunda**: keduanya adalah prasyarat agar kode yang ditulis minggu depan masih benar setelah katalog izin ditutup.

---

## 9. Gerbang verifikasi (documentation lock)

| # | Gerbang | Bentuk gagal-tulis | Status siklus ini |
|---|---|---|---|
| V-1 | Tidak ada izin/peran di dokumen tanpa entri katalog (`packages/contracts/src/authz.ts`) | CI membandingkan §4 RBAC vs `PERMISSION_SPECS` | 🟡 katalog 222 ≠ §4.3 add-on (RD-04) |
| V-2 | Layar transaksi aktif wajib permission normatif + rute; target pending tetap boleh dispesifikasi | ROUTE registry → checklist | admin 28/39 DB-backed rekursif, layar/AC belum lengkap; lihat §11 |
| V-3 | Tidak ada rute tulis tanpa L3+L4+L5 | uji: 403 scope, 404 tenant, 423 state | ❌ 9 rute tanpa scope check |
| V-4 | Tidak ada tabel domain tanpa `tenant_id` + `FORCE` + policy | `check-rls.sh` (sudah ada, belum dijalankan) | ✅ di skema / ⛔ belum di DB |
| V-5 | Tidak ada objek yang dijual (modul di-seed) tanpa DDL | bandingkan `MODULE_CODES` vs `pgTable` | ❌ `cbt`, `pmb`, `tracer_iku`, `litabmas`(usulan) |
| V-6 | Tidak ada klaim benchmark tanpa penanda `[DOK]/[INF]/[USUL]` | grep penanda di §benchmark & API_SPEC | ❌ TTL 30 dtk/radius 50 m tertulis sebagai fakta (BENCH-69) |
| V-7 | Satu istilah = satu nama di semua dokumen (enum, kolom, tabel) | Enum register + pemeriksa tautan | ❌ RD-13, K-11..K-14 |
| V-8 | Tidak ada DoD `[x]` tanpa bukti (test/URL/file) | audit checklist | ❌ PRD §6.3 seluruhnya `[x]` |
| V-9 | Kunci i18n dibaca dari inventaris, bukan dikarang per layar | diff `id.json`/`en.json` | ❌ 56 yatim, namespace `admin.*` belum ada |
| V-10 | Tidak ada field keluar dari proyeksi tanpa aturan §0.3 | uji masking per peran | ❌ mekanisme `FIELD_RULES` belum ada |

**Pernyataan kondisi akhir audit (jujur, tanpa dipotong):** dokumentasi SICA hari ini **belum** 100% siap dieksekusi untuk produksi. Yang siap adalah **kerangka norma** (peran, 6 verba, state machine, model entitlement, RLS di skema). Yang belum siap adalah **lapisan kontrak dan penegakan**: 38 gap dokumen (8 BLOCKER), 18 temuan kode (1 CRITICAL), 41+ objek tanpa DDL, dan 138 delta benchmark (22 BLOCKER). Tidak satu pun menuntut desain ulang — tetapi **semuanya** menuntut keputusan tertulis sebelum kode berikutnya ditulis. Blueprint per-peran ini memberi urutan; [AUDIT_READINESS.md](file:///c:/SICA/docs/AUDIT_READINESS.md) memberi daftarnya.

---

## 10. Riwayat

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 2026-10-19 | Blueprint per-peran pertama: 6 lapisan (`R-1` platform · `R-2` tenant admin + RBAC · `R-3` BAAK & BAUK · `R-4` kaprodi/dekan/dosen/wali · `R-5` mahasiswa & ortu · `R-6` feeder & integrasi) dengan pohon menu + hak tingkat tombol (10 aksi → 6 verba) + **hak tingkat field** (mekanisme `FIELD_RULES`, 7 aturan, `SERVER_ONLY`) + objek DB + endpoint + komponen Velzon + edge case + DoD per lapisan. Menambahkan §7 matriks SoD (7 pasangan), peta IDOR per lapisan (9 pola), dan hasil audit RLS nyata (45 tabel / 36 ber-tenant / fail-closed). §8 memetakan ke milestone `SEC-0`, `DOC-0`, `R-1`…`R-7`; §9 menetapkan 10 gerbang verifikasi (`V-1`…`V-10`) dengan status terukur per siklus. |
| 1.1 | 2026-10-23 | §11 ditambahkan: register pemetaan baris-per-baris **dua pohon menu** (Admin SICA `R-1` & Admin IT Kampus `R-2`) dengan kolom STATUS terukur (`berjalan`/`layar-saja`/`spec-only`/`BELUM`/`DITOLAK`), berikut empat vonis: satu fisik per konsep (`DATA_MODEL §12.6` menolak `tenant_subscriptions`/`tenant_module_entitlements`/`addon_packages`), satu keluarga jalur `/api/v1/platform/**` (menolak `sica-admin`), status sebagai bagian spesifikasi, dan gerbang `DEV-G*`/`CI-G*` tetap menahan klaim siap-koding. |

## 11. Register pemetaan dua pohon menu — Admin SICA (R-1) & Admin IT Kampus (R-2) — 2026-10-23

**Status dan cakupan hitung.** Inventaris rekursif yang tersedia: platform **8 `route.ts` / 9 metode**, admin **28 / 39**, DB-backed. Hitungan glob satu tingkat dahulu (3 berkas) melewatkan rute turunan dan **tidak sah** sebagai total. `DB-backed` bukan bukti seluruh menu, scope, atau AC lulus; `spec-only`/`permission pending` mempertahankan target yang belum diimplementasikan, bukan melarang target itu. Snapshot lama §0–§9 tidak membuktikan kondisi kini; register ini meralat klaim nol rute, nol tabel impersonation dan kuota belum ada. KRS mock/dashboard admin menyesatkan tetap `RD-154`.

**Batas dua tingkat tata kelola IT.** Platform = R-1, tenant = R-2; BAAK/BAUK/HRD, fakultas/pengampu/wali, mahasiswa, dan integrator tetap dipetakan ke R-3…R-6 sesuai tugas, bukan diberi nomor tingkat baru. R-1/R-2 tidak mewarisi keputusan bisnis. Scope selalu target tenant/org/prodi/kelas/periode yang diselesaikan server; `SITE` masih target migrasi. Grant lama yang lebih luas memerlukan migrasi + pengujian, bukan pencabutan fiktif karena dokumen berubah (`PRD FR-ITG-06`, `RBAC §6.8`).

### 11.1 Admin SICA — `PLATFORM_OPERATOR` (lapisan R-1)

| Group menu | Titik aksi | Izin katalog / pending | Objek dan jalur | STATUS / batas |
|---|---|---|---|---|
| Dashboard & kesehatan | CPU/RAM/DB/Redis telemetry, utilisasi/kuota | `platform.tenant.view` (302) untuk agregat existing; telemetry rinci **permission pending** | `tenant_usage`/`tenant_quotas`; `GET /platform/usage` target | `spec-only`; waktu/sumber/ambang/degraded terlihat, tidak memalsukan data Redis yang belum terpasang |
| | Peta GeoIP coarse lokal | usulan peta §4.5.4; tidak dipinjam dari izin tenant | `session_geo_facts`/view bucket, `DATA_MODEL §24`, `API_SPEC §7.33` | `spec-only`; negara/kota/bucket, bukan titik individu, sumber database lokal berlabel; objek sudah **dispesifikasi**, bukan nihil |
| | Log keamanan & anomali | `audit.log.view`; aksi anomali §4.5.5 tetap usulan | `GET /platform/audit-events` nyata; `anomaly_findings`/ALG-25 target | baca jejak DB-backed; deteksi lokal explainable proposal-only **spec-only**, model per tenant bukan pooling data bisnis |
| SaaS | Direktori dan siklus tenant | `platform.tenant.view/.provision/.suspend` (302–304) | `GET/POST /platform/tenants`, `GET /platform/tenants/:id`, `POST .../:id/suspend`, `POST .../:id/reinstate` | DB-backed; bukan bukti semua langkah provisioning AC sudah lengkap |
| | Lisensi modul, masa berlaku dan seats | `entitlement.module.activate/.deactivate`, `entitlement.seat.manage`; 389/390 **usulan** | `tenant_modules`, `plan_modules`, `plans`, `module_dependencies`; lisensi di `API_SPEC §4.20` | jalur lisensi platform **spec-only**; handler tenant lama masih menulis lisensi → gap pemisahan opt-out, jangan dianggap selesai |
| | Resource quota | `platform.quota.manage` (307) | `PUT /platform/tenants/:id/quotas` | **DB-backed, sudah ada**; storage/seats/expiry harus dibedakan menurut objeknya, expiry modul tidak otomatis sama dengan akhir kontrak |
| | Penagihan langganan kampus | 391–394 **usulan** | `platform_invoices`/`platform_payments`, `DATA_MODEL §12.5` | **spec-only**, terpisah M-10; SoD penerbit ≠ penyetuju settle/void; tidak mengklaim migrasi sudah diterapkan |
| | Global release flags / trials | `platform.flag.manage`, `entitlement.trial.grant` | jalur flags/trials `API_SPEC §4.20` | **spec-only**; flag tidak dapat menaikkan lisensi |
| Referensi global | Kamus nasional Dikti/BPS/Kemendagri berversi | katalog master §4.5; kewenangan penerbit nasional **pending** | `reference_dictionary_entries`, label lokal lewat `reference_items` | target versi immutable + sumber + tanggal efektif; kamus lokal bukan bukti ingest nasional lengkap |
| | Aturan platform / gateway | `platform.quota.manage`; kontrol lain **permission pending** | kuota kanonik + operator edge/gateway | dashboard status/pengajuan diterima **spec-only**; runtime enforcement tetap edge/worker, tidak memberi shell melalui UI; aturan akademik tenant bukan kewenangan R-1 |
| Keamanan | Audit global dan verifier | `audit.log.view`, `audit.export`; `audit.verify.run/.view` (106/107) tetap status katalog | `audit_logs`; viewer DB-backed, script verifier tersedia | **tamper-evident**, bukan tamper-proof; CLI verifier tidak membuktikan endpoint/layar verifier hidup |
| | Kebijakan PII | **permission pending** untuk editor kebijakan terpusat | proyeksi `FIELD_RULES`/`SERVER_ONLY`; metadata atribut bukan izin unmask global | `spec-only`; tidak ada bypass PII hanya karena operator/auditor |
| Dukungan | Grant dukungan, pencabutan dan riwayat | `identity.impersonation.grant/.revoke` | `POST /platform/impersonation-grants`, `DELETE /platform/impersonation-grants/:id` | DB-backed; tiket, TTL, MFA, audit dua identitas; grant bukan hak mengambil keputusan bisnis |

### 11.2 Admin IT Kampus — `TENANT_ADMIN` (lapisan R-2)

| Group menu | Titik aksi | Izin katalog / pending | Objek / batas | STATUS |
|---|---|---|---|---|
| Dashboard IT | Telemetry lokal, GeoIP coarse, anomali lokal | `identity.loginstats.view` untuk statistik login; telemetry/peta/keputusan anomali **permission pending** | tenant sendiri; tidak meminjam izin platform, tidak menampilkan PII atau hasil engine sebagai keputusan | `spec-only`, mengikuti FR-ITG-01 dan sumber §5.17/§5.18 PRD |
| Branding & kampus | Branding, profil, struktur organisasi | `settings.meta.view/.update` hanya metadata; `academic.organization.view/.create/.update` (381–383) untuk organisasi; branding/profil tenant lengkap **pending** | organisasi bukan seluruh profil tenant; field regulasi/akademik memerlukan pemilik domain | organisasi DB-backed; branding menyeluruh target `spec-only` |
| | Multi-site | scope `SITE` dan izin target **pending** | `campus_sites`, `DATA_MODEL §19.1`; jangan memperluas ke seluruh tenant | `spec-only`, migrasi `0044`/SITE belum nyata |
| | Domain dan SSL | pengajuan/lihat/verifikasi kepemilikan **permission pending**; bukan grant `platform.tenant.provision` ke tenant | `tenant_domains`; challenge kepemilikan, status operator, expiry sertifikat; secret key server-only | **spec-only diterima**: IT mengajukan, operator terkelola menerbitkan/merotasi SSL |
| Katalog & lisensi | Katalog read-only, status lisensi, local on/off | `entitlement.catalog.view`, `entitlement.module.view`; izin opt-out lokal **pending** | effective enabled = lisensi ACTIVE/TRIAL yang berlaku ∧ opsi lokal ∧ dependensi; local on tidak menciptakan lisensi | baca dan handler activate/deactivate lama ada, **migrasi pemisahan lisensi/opt-out belum ada** |
| | Tagihan SaaS tenant sendiri | **permission pending**, bukan 391 atau `finance.invoice.view` | proyeksi `platform_invoices` hanya tenant dari sesi, baca-saja; tidak menampilkan piutang mahasiswa | **target diterima, spec-only**, bukan keputusan produk yang ditolak |
| Master lokal | Kamus almamater/toga/organisasi/SKKM | katalog `master.*` §4.5 sesuai aksi dan scope; tanpa wildcard grant | `reference_kinds`/`reference_items`; merawat opsi bukan menyetujui alokasi toga, poin SKKM atau keputusan unit | mesin kamus sebagian; cakupan tiap kind/usage dan approval bisnis **pending** |
| | NIM, SKS, presensi dan parameter | `settings.param.view/edit.<class>` + persetujuan 375–380 sesuai katalog | skalar di `master_system_parameters`; pola NIM/band SKS tetap rumah strukturalnya; **pemilik domain menyetujui nilai**, IT hanya binding; 75% bukan hukum universal | parameter DB-backed; pemisahan approval bisnis/grant lama masih gap migrasi |
| Directory & akses | Pengguna, membership, RBAC | `identity.user.*`, `identity.membership.*`, `identity.role.*`, `identity.assignment.*`, `identity.accessrequest.approve` sesuai aksi katalog | assignment target eksplisit + masa berlaku + empat-mata; menu tidak menambah hak | jalur admin DB-backed; tidak membuktikan semua scope/menu dinamis/AC selesai |
| | SSO Google/M365/LDAP | **permission pending** | konfigurasi binding/reference saja; trust/callback/domain terverifikasi; sesi autentikasi PostgreSQL | `spec-only`; tidak mengarang kode izin atau skema provider |
| | DSAR / audit lokal | `audit.dsar.view/.decide` **usulan** untuk DPO; `audit.log.view`, `audit.export` untuk jejak sesuai scope | IT menyiapkan konsol, bukan memutus DSAR atau unmask global; retensi arsip tetap | audit viewer DB-backed; DSAR **spec-only**, hash-chain tamper-evident |
| Integrasi | Feeder, SISTER, Teams/Zoom | `feeder.credential.manage`, `feeder.sync.view`; `sister.*` (174–176) dan vicon 292–297 tetap usulan | hanya `credential_ref`, uji koneksi/status redacted; mengikat teknis tidak memberi `send`/VALIDATE data bisnis | binding menyeluruh **spec-only**, seed/status bukan bukti konektor hidup |
| | PIN/SIVIL | `graduation.pin.sync` **usulan**, milik pelaksana kelulusan | IT hanya binding; nomor/kelayakan ijazah oleh M-35/M-30 dan pemilik bisnis | `spec-only`, bukan keputusan R-2 |
| Maintenance | Backup/restore tenant | **permission pending** per aksi | dry-run terisolasi, penyetuju kedua, quiesce tulis tenant, rollback plan, rekonsiliasi audit sebelum buka; eksekutor operator | **spec-only diterima**; tidak memberi akses restore database lintas tenant |
| | Invalidasi cache | **permission pending** | target namespace tenant + preview dampak + alasan/audit; **bukan FLUSHALL**, bukan sesi auth PostgreSQL | `spec-only`; `ioredis` belum dependensi nyata |
| | Monitor BullMQ + retry DLQ | **permission pending** | hanya metadata redacted, retry idempoten ter-audit; tidak purge/payload secret | `spec-only`; BullMQ belum terpasang, monitor menunggu queue + fencing/idempotensi/DLQ |
| | Error staging Feeder | `feeder.sync.view` untuk log yang sesuai scope; proyeksi teknis khusus **pending** | data error/saran dari staging/hasil validasi, **bukan `login_events`**; sanitized tanpa raw PII/credential/stack internal | `spec-only`; tidak mengklaim viewer penuh sudah ada |

**Aturan penutup.** Satu fisik per konsep dan satu jalur per objek; izin mengikuti katalog, **389–394 tetap usulan**. Target yang backend/izinnya belum ada tetap spesifikasi, tidak otomatis dilarang. Aksi UI `CREATE → INSERT`, `APPROVE → VALIDATE`, `EXPORT → OTHER` **hanya bila ekspor eksplisit terdaftar**; tidak ada verba global baru. Sebelum diterapkan perlu DDL/API, migrasi grant lama, L1–L6, i18n, fixture lintas-tenant, SoD, serta bukti DB. Tidak ada klaim Fase 1 selesai.

### 11.3 Fase 1 diperluas tanpa mengubah lapisan

Cakupan normatif ada di `PRD §5.1.1`: M-01/02/03/05 sebagai fondasi, lalu M-09 PMB/OCR/NIM, M-10 keuangan, M-12 OBE DAG, M-13 KRS Lua/lease/fencing/BullMQ, M-14 CSP/AC-3, M-15/18 moda/presensi QR-geofence, M-16 LMS/Teams, M-19 AST nilai, M-34 Feeder fuzzy proposal. PMB/HRD berada di kelompok pelaksana bisnis (R-3), fakultas/pengampu/wali R-4, mahasiswa/camaba R-5, integrator R-6; bukan R-7 baru. Slice mengikuti dependency, bukan urutan angka modul. Terima lewat `AC-PH1-1…4` + `AC-ITG-1…6`, bukan demonstrasi mock. Dependensi OCR/queue dan uji kegagalan terdistribusi masih blocker; `Redlock O(1)` bukan jaminan correctness.

## 12. Kunci 1:1 daun menu dua peran IT — permintaan pemilik 2026-10-24

**Aturan bagian ini.** Pemilik produk menyerahkan daftar daun menu untuk R-1 (Admin SICA) dan R-2 (Admin IT Kampus) dengan instruksi "tanpa ada yang dikurangi atau disingkat". Instruksi itu dipenuhi **sepenuhnya**: 39 daun (14 R-1 + 25 R-2) masuk, masing-masing **verbatim**, tanpa baris yang digabung atau dibuang. Yang boleh saya ubah bukan daftarnya, melainkan **STATUS**-nya — dan status itu diukur dari kode, bukan dari keinginan. Tiga hal yang membatasi: (a) `AGENTS §3.11` melarang rute/layar lahir sebelum rantai dokumen selesai; (b) `AGENTS §3.9`/`§3.10` melarang kemampuan diklaim sebelum dependensinya nyata dan melarang kosakata mesin menjadi data yang dapat disunting; (c) satu fisik per konsep (`RD-32`) — bagian ini **memetakan ke §11**, tidak membuat register kedua, dan tidak mengubah nomor izin mana pun.

**Distribusi vonis, dihitung dari tabel di bawah (39 baris).** `berjalan` **5** · `berjalan sebagian` **5** · `spec-only` **13** · `BELUM` **8** · memuat vonis `DITOLAK seperti tertulis` **8** (sebagian penuh, sebagian hanya pada satu nama/aksi di dalam barisnya). Angka ini dicetak ulang dari tabel, bukan dari ingatan; bila satu baris berubah status, hitungan ini ikut berubah.

**Legenda STATUS** sama dengan §0.5: `berjalan` (objek + rute + layar nyata) · `berjalan sebagian` (sebagian aksi daun ada, sebagian belum) · `layar-saja` (affordance tanpa pemanggil — temuan, bukan target) · `spec-only` (dinormakan, belum dikode) · `BELUM` (butuh dependensi/objek yang tidak ada) · `DITOLAK` (tidak akan dibangun seperti tertulis; bentuk penggantinya disebut).

### 12.1 R-1 — Admin SICA (`PLATFORM_OPERATOR`)

| # | Daun menu (verbatim pemilik) | Pemilik objek / rute terukur | Izin | STATUS |
|---|---|---|---|---|
| 1.1 | Live Resource Monitor (CPU, RAM, DB Connection Pool, Redis Cluster Global) | hanya `/api/v1/health` + `/health/ready` (ping `SELECT 1`); `os.cpus`/`memoryUsage` **nol**; `ioredis` bukan dependensi; `REDIS_URL` hanya divalidasi string, tidak pernah terhubung | `platform.tenant.view` (302) utk agregat; telemetri rinci **permission pending** | **BELUM** (`RD-11`). Yang boleh didahului: panel uptime + latensi DB + kuota tenant dari objek yang ada, **berlabel sumbernya**, bukan meniru dashboard Redis |
| 1.2 | Peta Sebaran User GIS Real-Time (GeoIP2 / W3C Geolocation) | `session_geo_facts` + migrasi `0078` **belum punya berkas** (`migrations/` = 0001–0012, 0047–0050, 0082–0090); `sessions` hanya `ip_hash`/`user_agent_hash` | usulan peta §4.5.4 | **spec-only**; nama produk **GeoIP2 DITOLAK sebagai sumber** (unduhan berlisensi = egress + kredensial, `§3.9`); bentuk sah = basis geo lokal ter-commit + bucket coarse negara/kota, bukan titik individu (`RD-87`, `RD-127`) |
| 1.3 | Log Keamanan Platform & Isolation Forest Anomaly Alert | `GET /platform/audit-events` DB-backed + layar `/platform/audit`; `anomaly_findings`/ALG-25 tidak ada | `audit.log.view`; `audit.verify.run/.view` (106/107); aksi anomali usulan | **berjalan sebagian** — log = berjalan, deteksi anomali = **spec-only**: lokal, explainable, proposal-only, tanpa pooling data bisnis lintas tenant |
| 2.1 | Direktori Perguruan Tinggi & Status Langganan | `/platform/tenants` GET/POST + `[tenantId]` + suspend/reinstate; layar `/platform/tenants` | 302–304 | **berjalan** |
| 2.2 | Management Add-on Entitlement (PMB OCR, Multi-VA, LMS Teams Vicon, HRIS BKD, E-Procurement, e-Library, Klinik, AI Retention, Multi-Branch) | `tenant_modules`, `plan_modules`, `plans`, `module_dependencies` + activate/deactivate | `entitlement.module.activate/.deactivate` (310–316); 389/390 usulan | **berjalan sebagian** (aktivasi per modul). Tiga dari sembilan nama **tidak dapat dijual hari ini** per `PRD §5.12.5`: **E-Procurement** dan **Multi-Branch** (migrasi `0044` + enum `SITE` tidak ada → `DITOLAK` sebagai SKU sampai objeknya ada); **AI Retention** wajib ditulis dengan batas nol-API-key (ALG-10). PMB OCR / LMS Teams / HRIS BKD / e-Library / Klinik = `spec-only` |
| 2.3 | Pengaturan Expiry Date Lisensi & Limit Kuota (Max Active Students, Max Storage) | `PUT /platform/tenants/:id/quotas`, `tenant_quotas` | 307 | **berjalan**; expiry modul ≠ akhir kontrak (batas §11.1) |
| 2.4 | Global Subscription Billing & Invoicing | `platform_invoices`/`platform_payments` + migrasi `0091`–`0092` **belum ada berkasnya** | 391–394 **usulan** | **spec-only**; SoD penerbit ≠ settle/void baru ditegakkan `ck_pi_void_actor` saat DDL mendarat |
| 2.5 | Feature Toggles Rilis Global | `tenant_settings.feature_flags` | `platform.flag.manage` (308) | **berjalan sebagian** — flag nyata, "rilis" belum: flag tidak dapat menaikkan lisensi |
| 3.1 | Master Lookup Baku Dikti (Agama, Status Marital, Disabilitas, Transportasi, Pembiayaan) | `reference_dictionary_entries` kelas B (`0028`), global dan SELECT-only bagi tenant | katalog master §4.5; kewenangan penerbit nasional **pending** | **berjalan sebagian** — label per-tenant lewat `reference_items` sudah ada; **jalur tulis platform untuk menerbitkan versi nasional = BELUM** |
| 3.2 | Data Wilayah BPS & Kemendagri (Provinsi, Kota/Kab, Kecamatan, Kode Pos) | sama kelas B; pemetaan wilayah sudah dipakai pencocok Feeder | idem | **spec-only** (ingest nasional belum ada) |
| 3.3 | Kamus Kode System & Core System Rules | enum kelas A di PostgreSQL (`permission_verb`, `enrollments.status`, `conference_provider`, …) — register `DATA_MODEL §15` | tidak ada izin "sunting enum" | **DITOLAK sebagai layar sunting** (`AGENTS §3.10`: kosakata protokol/mesin bukan data runtime). Bentuk sah = **viewer baca-saja** + pengajuan lewat migrasi + empat-mata |
| 4.1 | Audit Trail SHA-256 Global (Merkle Tree Hash Chaining) | `audit_logs` + CLI verifier rantai | 106/107 | **berjalan sebagian** — rantai tamper-**evident** terbaca; layar verifier = `spec-only`. Dilarang menyebutnya tamper-proof |
| 4.2 | Konfigurasi Global PII Masking & Privacy Rules (UU PDP 27/2022) | `FIELD_RULES` di `packages/contracts/src/authz.ts` — **kode, bukan baris DB** | permission pending | **DITOLAK sebagai editor terpusat**; yang sah = proyeksi server + pengajuan kebijakan berversi beralasan. Tidak ada bypass PII karena operator atau auditor |
| 4.3 | Global API Gateway & Rate Limiter Configuration | tidak ada parser/env untuk plafon; enforcement di edge/worker | `platform.quota.manage` sebagian | **spec-only**; UI hanya status + pengajuan, bukan knob runtime (`§3.10`: parameter keamanan tidak dapat dilonggarkan lewat UI) |

### 12.2 R-2 — Admin IT Kampus (`TENANT_ADMIN`)

| # | Daun menu (verbatim pemilik) | Pemilik objek / rute terukur | Izin | STATUS |
|---|---|---|---|---|
| 1.1 | Pemantau Local Server & Database Health | sama dengan R-1 1.1, di-scope ke tenant sendiri | pending | **BELUM** — tenant tidak punya "server lokal" di model SaaS ini; yang tersedia = health platform + kuota tenant |
| 1.2 | Peta Sebaran User Aktif Kampus (Geospatial GIS Map) | sama R-1 1.2 | pending | **spec-only**, coarse, tanpa PII individu |
| 1.3 | Alert Anomali Sesi Login & Security Warnings | `login_events` nyata (termasuk `MFA_FAIL`); proyeksi anomali tidak ada | `identity.loginstats.view` | **berjalan sebagian** — log = berjalan, alert = `spec-only` |
| 2.1 | Profil Instansi & Cabang Kampus | `organizations` + layar `/admin/organisasi` DB-backed; `campus_sites` butuh `0044` (tidak ada) | 381–383 + `settings.meta.*` | **berjalan sebagian** — organisasi = berjalan; **cabang/SITE = BELUM** |
| 2.2 | Custom Domain & Sertifikat SSL | tidak ada objek `tenant_domains` | pending | **spec-only**; IT **mengajukan**, operator menerbitkan/merotasi; rahasia tidak pernah lewat body (`§3.12`) |
| 2.3 | Katalog Modul Aktif & Status Lisensi Add-ons Kampus | `GET /tenant/modules` + activate/deactivate | `entitlement.catalog.view`, `entitlement.module.view` | **berjalan sebagian** — baca + toggle dalam batas lisensi ada; **opt-out lokal** masih gap pemisahan lisensi (§11.2) |
| 2.4 | Feature Toggles Operasional Lokal | `tenant_settings.feature_flags` | `platform.flag.manage` adalah hak **R-1** | **DITOLAK sebagai hak tulis tenant** — tenant tidak menyetel flag rilis global; yang sah = on/off modul di dalam batas lisensinya |
| 2.5 | Status Lisensi & Tagihan SaaS Kampus | proyeksi `platform_invoices` terbatas tenant dari sesi | pending (bukan 391, bukan `finance.invoice.view`) | **spec-only diterima**, baca-saja; tidak menampilkan piutang mahasiswa |
| 3.1 | Parameter Referensi Operasional Lokal (Atribut Fisik Almamater, Toga, Ukuran Kaos, Gedung/Ruang, Ormawa, Poin SKKM) | `reference_kinds`/`reference_items` berjalan; **gedung/ruang/lab** butuh `0013` (tidak ada berkasnya) | `master.*` §4.5 sesuai aksi/scope | **berjalan sebagian** — kamus = berjalan; **gedung/ruang = BELUM** (pekerjaan Fase 1B item 4); Poin SKKM butuh persetujuan pemilik domain bisnis, bukan IT |
| 3.2 | Generator Pola NIM Otomatis | aturan **struktural**, bukan key-value (`§3.10`) | `settings.param.*` hanya untuk binding | **spec-only**; pola NIM sengaja **tidak** dipindah ke parameter operasional |
| 3.3 | Batas Maksimal SKS & Threshold Presensi Minimum (75%) | `master_system_parameters` DB-backed + empat-mata + `min/max_value` | 375–380 | **berjalan**; 75% bukan hukum universal dan ambang kelas `SECURITY` tidak dapat dilonggarkan melewati `CHECK` |
| 3.4 | Notification Gateway (WhatsApp Gateway, Email SMTP, SMS OTP) | env `FONNTE_WHATSAPP_TOKEN`/`RESEND_API_KEY` divalidasi, **nol konsumen**; `resend`/`nodemailer` tidak terpasang | pending | **BELUM** — dilarang membuat layar "gateway" yang menyimpan token tanpa satu pun pemanggil (pola `RD-154`) |
| 4.1 | Manajemen Akun Sivitas Akademika (Import/Export/Disable Staf BAAK, BAUK, HRD, Keuangan, Dosen, Mahasiswa) | `/admin/pengguna` GET/POST + `[id]` GET/PATCH + `nonaktif` DB-backed; **import/export tidak ada** | `identity.user.*`, `identity.membership.*` | **berjalan sebagian** — CRUD + nonaktif = berjalan; **impor/ekspor = BELUM** (butuh baris `OTHER` terdaftar + batas PII + idempotensi) |
| 4.2 | Matriks Hak Akses RBAC Granular (CREATE, READ, UPDATE, DELETE, APPROVE, EXPORT per Role) | `/admin/hak-akses` + `peran/[id]/izin` PUT + `penugasan` | `identity.role.*`, `identity.assignment.*` | **berjalan**; kosakata aksi **harus** enam verba kanonik: `APPROVE → VALIDATE`, `EXPORT → OTHER` **hanya bila** barisnya terdaftar (`RBAC §1.2`, `§4.1`) |
| 4.3 | Integrasi Single Sign On (Google Workspace, Microsoft 365, LDAP Local) | **nol** rute callback/`/sso`/`/oidc`, nol paket `passport`/`ldapjs`/SAML | pending | **BELUM**; trust domain + callback terverifikasi wajib lebih dulu, bukan form konfigurasi kosong |
| 4.4 | Konsol Privasi Data & Permohonan Hak Subjek Data UU PDP | tidak ada objek permohonan DSAR | `audit.dsar.view/.decide` **usulan** | **spec-only**; IT menyiapkan konsol, **DPO yang memutuskan** — bukan R-2 |
| 4.5 | Log Audit Trail Aktivitas Pengguna Lokal | `audit_logs` + viewer admin | `audit.log.view`, `audit.export` | **berjalan** (baca) |
| 5.1 | Server Connection PDDikti Feeder Lokal | hanya kolom `pddikti_code` di master; **nol pemanggil API** | `feeder.credential.manage`, `feeder.sync.view` | **spec-only**; hanya `credential_ref`, rahasia di ENV (`§3.12`) |
| 5.2 | API Binding SISTER 2.0 Local Tenant | nol kode (hanya label UI) | 174–176 **usulan** | **spec-only** |
| 5.3 | Auth Provider & Webhook MS Teams / Zoom | nol kode, nol env vicon | 292–297 **usulan** | **spec-only**; kanal = transport, bukan mesin dan bukan pemilik fakta kehadiran |
| 5.4 | Pengaturan Verifikasi PIN SIVIL | nol kode | `graduation.pin.sync` **usulan** | **spec-only**; milik pelaksana kelulusan (M-35), IT hanya binding |
| 6.1 | Backup & Restore Basis Data Lokal | nol `pg_dump`/`pg_restore` di kode dan dokumen | pending | **DITOLAK sebagai tombol restore** (prosedur operasional, bukan layar — vonis siklus lisensi). Bentuk sah = pengajuan + dry-run terisolasi + penyetuju kedua + quiesce tulis tenant + rencana rollback + rekonsiliasi audit (`RD-36`) |
| 6.2 | Cache Flusher & Redis In-Memory Monitor (KRS War Health) | `ioredis` tidak ada; `REDIS_URL` tidak pernah terhubung | pending | **DITOLAK sebagai FLUSHALL**; target = invalidasi **namespace tenant** + pratinjau dampak + alasan ter-audit, menunggu dependensi nyata (`RD-11`) |
| 6.3 | Job Queue & Background Worker Monitor (BullMQ) | `bullmq` tidak ada; jalur KRS masih `pg_advisory_xact_lock` (pengecualian tercatat `§3.8`) | pending | **DITOLAK hari ini**; monitor menunggu antrean + idempotensi + fencing + DLQ yang nyata — bukan panel di atas nol pekerja |
| 6.4 | Staging Feeder Queue & Error Viewer Log | staging queue tidak ada | `feeder.sync.view` | **spec-only**; ter-sanitasi, tanpa PII mentah/kredensial/stack internal, dan **bukan** `login_events` |

### 12.3 Vonis bagian ini

1. **Tidak ada daun yang dibuang.** 39/39 masuk. Yang berubah adalah statusnya, dan status itu keluar dari pengukuran (`package.json`, daftar `migrations/`, `grep` konsumen), bukan dari selera.
2. **Delapan baris memuat vonis `DITOLAK seperti tertulis` dan sudah punya bentuk pengganti**: 1.2 R-1 (GeoIP2 sebagai sumber → basis geo lokal ter-commit), 3.3 R-1 (kamus aturan inti → viewer + migrasi + empat-mata), 4.2 R-1 (editor PII terpusat → proyeksi server + pengajuan berversi), 2.2 R-1 sebagian (E-Procurement & Multi-Branch → bukan SKU sampai `0044`/`SITE` nyata), 2.4 R-2 (flag rilis oleh tenant → on/off modul dalam lisensi), 6.1–6.3 R-2 (restore DB / FLUSHALL / monitor BullMQ → alur pengajuan + namespace tenant + antrean nyata). Membangunnya seperti tertulis akan menciptakan **affordance palsu** — pelajaran `RD-154` yang sudah dua kali terbakar.
3. **Yang bisa langsung dikerjakan tanpa melanggar rantai** (urutan, bukan paralel): (i) **menu-as-data** sebagai eksekusi register ini — padanan Drizzle `menu_items`/`menu_permissions` (`0050` sudah ada di SQL, `RD-161`), `GET /api/v1/me/menu`, lalu `buildNav()` dibaca dari server (`RD-18`/task item 5); (ii) layar R-1 **penerbit kamus nasional kelas B** (3.1/3.2) karena objeknya sudah ada; (iii) **impor/ekspor akun** (4.1 R-2) setelah baris `OTHER` + batas PDP didaftarkan; (iv) **penagihan SaaS** (2.4 R-1) setelah `0091`–`0092` benar-benar menjadi berkas migrasi.
4. **Batas kewenangan tiga tingkat** yang pemilik tetapkan (R-1 infrastruktur global & lisensi & data baku nasional; R-2 konfigurasi satu kampus; BAAK/BAUK/HRD/Dekanat/Dosen/Mahasiswa = end-user yang haknya diatur R-2 melalui matriks) **sudah selaras** dengan `RBAC §2`/`§6` dan lapisan R-3…R-6 di §0 — dinormakan ulang di `RBAC_MATRIX §2.1`, bukan di sini.
5. Bagian ini **tidak** menambah nomor izin, tidak menulis rute, dan tidak mengklaim satu layar pun selesai. Angka hitung tetap milik `.tools/rbac-count.mjs` dan `.tools/handler-inventory.mjs`.

### 12.4 Eksekusi butir 3(i) — `MENU-LOCK-1` terpasang 2026-10-24, dan register ini sekarang terukur

Vonis di §12 sebelumnya hanya bisa dinyatakan sebagai teks sampai daunnya menjadi baris database. Itu sudah berubah; bagian ini mencatat **hasil pelaksanaan**, bukan rencana, dan setiap angkanya keluar dari `pnpm --filter @sica/web verify:menu` (bukan hitungan tangan):

| Yang dikunci | Bentuk di kode/DB | Bukti |
|---|---|---|
| 39 daun (14 R-1 + 25 R-2) | `menu_items` per tenant: **43 baris + 24 grant** (`demo`) · **21 baris + 9 grant** (`platform`); tiap daun membawa `lock: '1.1'…'6.4'` | `verify:menu` membandingkan label baris DB dengan **sel tabel §12.1/§12.2** dokumen: 14/14 dan 25/25 **verbatim**; uji `menu-tree.test.ts` melakukan pembandingan yang sama tanpa DB, sehingga hijau CI tidak bisa dicapai dengan sunting dokumen |
| "Tanpa izin terdaftar = tidak ditawarkan" | 15 daun R-2 + 7 daun R-1 ber`is_visible = false`; sisanya 17 daun terkunci terlihat bagi pemegang grant-nya | `byPermission` pada `prunedCounts`: 21 (admin2) · 9 (operator) · 34 (dosen/mhs) — agregat, tanpa nama cabang |
| Pohon disaring server, bukan klien | `GET /api/v1/me/menu` tiga tahap (`menu-resolver.ts`) + `loadEffectiveAccess` (hak dari `user_role_assignments`, bukan carrier) | Daun terlihat per sesi: operator **8**, admin2 **15**, dosen **7**, mahasiswa **7**; `byEntitlement = 0`; `registry.unknownRouteKeys = []` |
| Layar yang belum ada tidak menjanjikan 404 | `route_key` = kunci registri statis `route-keys.ts` (12 kunci); tanpa kunci → label "Segera" non-klik | `menu-tree.test.ts` memindai `src/app/**/page.tsx` dan menolak kunci yang menunjuk halaman tanpa berkas; `icon-check.mjs` (gerbang `gate-run` ke-34) menolak nama glif di luar `remixicon.css` |
| Satu fisik satu view | `PRIMARY_NAV`/`buildNav` **dihapus**; `top-nav.tsx` dan pintasan Dashboard (`menuHref`) membaca definisi/peta yang sama | `RD-32` tidak boleh hidup dua kali; bukti `tsc` bersih tanpa sisa rujukan |

**Empat hal yang dengan sengaja TIDAK ikut terbuka.** (a) §4.17.2 — editor pohon & grant — tetap `spec-only`: izin `platform.menu.*` sudah katalog, rutenya belum ditulis. (b) `?at=` ditolak (`403` non-audit, `422` bagi pemegang `audit.log.view`), bukan dilayani setengah. (c) `layer=MOBILE` menjawab pohon kosong: belum ada baris MOBILE/BOTH dan belum ada konsumen Dart (`§3.4` masih terbuka). (d) Daun `admin.integrations`/`admin.operations` hanya muncul sebagian bagi `TENANT_ADMIN` karena SISTER/vicon/SIVIL/DSAR masih `usulan` — dan itu **bukan** bug penyaringan, itu vonis §12 yang bekerja.

**Cara membaca tabel §12.1/§12.2 sekarang.** Kolom STATUS tetap vonis spesifikasi per aksi; yang berubah adalah bahwa baris "STATUS" kini punya padanan fisik: `berjalan`/`berjalan sebagian` = daun terlihat dengan atau tanpa `route_key`; `BELUM`/`DITOLAK` = baris ada dengan `is_visible = false`. Tidak ada daun yang dihapus dari register; tidak ada daun yang ditawarkan tanpa pemegang hak terdaftar.

### 12.5 Eksekusi kedua (2026-10-24, siklus 9) — "yang tidak dibutuhkan harusnya tidak ada": akar perbaikannya ada di grant, bukan di pohon

Permintaan pemilik setelah §12.4 adalah audit dua arah: daun yang tidak perlu **tidak boleh** muncul, dan daun yang diperlukan **tidak boleh** kurang. Audit mengukur dari hilir ke hulu (layar → `menu_items` → `menu_permissions` → katalog → peran) dan menemukan bahwa penyaring pohon sudah benar; yang salah adalah **grant**. Ringkasan terukur ada di `PROGRESS_REPORT §5.85` dan `AUDIT_READINESS RD-178`–`RD-180`; bagian ini hanya mencatat apa yang berubah pada register §12.

**(1) Enam daun §12.2 yang belum berbaris, kini berbaris.** Semuanya turunan langsung baris `RBAC §6.2` milik `TENANT_ADMIN` — bukan menu karangan:

| Daun `menu_items` | Baris norma | Gate | Status layar |
|---|---|---|---|
| `akademik.studentstatus` | §6.2 "Akademik → Status Mahasiswa" (R U) | `academic.studentstatus.view` | `BELUM` — daun terlihat, layar belum ditulis |
| `admin.parameters.approvals` | §6.2 "Persetujuan Parameter" (327/328) | `anyOf` `settings.param.approve.regulatory`/`.security` + `requiresMfa` | `berjalan sebagian` — antrean & API empat-mata sudah ada (R-2.1) |
| `admin.parameters.customattr` | §6.2 "Atribut Kustom" (137–141) | `settings.customattr.view` | `BELUM` |
| `admin.parameters.meta` | §6.2 "Meta Konfigurasi Form & Laporan" (321/322) | `settings.meta.view` | `BELUM` |
| `admin.parameters.import` | §6.2 "Area Admin → Impor Data Master" (319/320) | **tanpa gate** — 319/320 masih `usulan` | `is_visible = false`, baris ada, sebab tercatat |
| `admin.identity.menu` | §6.2 "Pengaturan → Menu & Grant" (158–161) | `anyOf` `platform.menu.manage`/`.grant` — **sengaja bukan** `.view` | `BELUM` (§4.17.2 `spec-only`) |

`admin.identity.menu` di-gate pada keluarga tulis karena `platform.menu.view` juga dipegang peran yang hanya boleh membaca label; memberi daun "editor menu" kepada pemegang `.view` akan menampilkan tombol yang pasti ditolak — affordance palsu kelas `RD-154`.

**(2) Satu daun platform dipadamkan, bukan dihapus.** `platform.master.lookup` (kunci `3.1`, kamus data baku nasional) kehilangan `permission`-nya karena baris penerbit nasional di §12.1 bervonis `BELUM`: tidak ada kode katalog untuk "menerbitkan versi kamus nasional". Barisnya tetap ada dengan `is_visible = false`; grant tenant `platform` turun **9 → 8**. Ini penerapan aturan §12.4 "tanpa izin terdaftar = tidak ditawarkan", bukan sensor.

**(3) Daun R-2 tidak berubah bentuk, tetapi grant di belakangnya dirombak.** `TENANT_ADMIN` berhenti mewarisi `...ADMIN_ACADEMIC_GRANTS`; 81 kode bisnis dicabut oleh `0093` dan grant katalognya kini **97 kode unik**. Karena visibilitas adalah proyeksi hak, pencabutan itulah yang membuat "KRS/nilai/presensi/keuangan tidak muncul untuk Admin IT" menjadi **sifat sistem**, bukan aturan render. Daun R-2 yang benar-benar terlihat naik **15 → 18**; enam daun baru di atas tidak semuanya ikut terlihat — yang tanpa gate dan yang `usulan` tetap terpotong, dan itu tercatat di `prunedCounts`.

**(4) Satu-satunya baris §6.2 milik R-2 yang tidak dapat dilayani katalog: Bantuan → Kategori, SLA & Basis Pengetahuan.** Dua belas kode `helpdesk.category/sla/kb/impact` yang dikutip baris itu masih **BELUM DIPUTUS** di §4.3, sehingga daunnya **tidak dibuat** dan kasusnya didaftarkan sebagai `RD-178`, bukan ditambal dengan izin karangan. Vonis "25 daun R-2 lengkap" karena itu berlaku untuk register §12.2, **tidak** untuk seluruh baris §6.2.

**(5) Penjaga baru yang membuat register ini tidak dapat diam-diam mundur.** `audit:menu` (`src/scripts/audit-role-menu.ts`) menyimpan harapan per peran dengan kutipan §6 plus dua aturan struktural: nol daun platform di luar gerbang operator, nol daun kampus yang digate kode bermodul `platform`. `verify:menu` pertanyaan kelima membandingkan `role_permissions` DB dengan katalog per peran per tenant (terukur **0 selisih**: 1 peran × `platform`, 15 peran × `demo`) dan membuktikan kedua pohon tidak berbagi baris tenant. `menu-seed.ts` kini **mencabut** grant yang hilang dari deklarasi (`grantsRevoked`). Ketiganya DB-bound dan sengaja tidak masuk `gate-run` yang statis.

**(6) Yang belum berubah dan tidak boleh dibaca sudah selesai.** §12.3 tetap vonis spesifikasi, bukan izin koding (`DEV-G*`/`CI-G*` masih berdiri). Paritas Mobile belum (nol baris `MOBILE`/`BOTH`). Tidak ada commit pada siklus ini.

### 12.6 Nama kelompok & bentuk navigasi — ralat pemilik siklus 10 (2026-10-24)

Pemilik menunjukkan tangkapan layar Velzon dan daftar menu-submenu yang ia kunci, lalu bertanya mengapa di SICA submenu "digabung semua" dan mengapa posisi menunya berbeda. Audit bentuknya menjawab: **isi register §12.1/§12.2 sudah benar 100%** — pohon data memuat enam kelompok R-2 dan empat kelompok R-1 dengan daun verbatim — tetapi **lapisan render** memalsukannya dua kali: (a) seluruh grup dirender sebagai `.section-label` di dalam satu dropdown akar, dan (b) delapan daun §12 membawa `labelKey` i18n singkat sehingga layar tidak menampilkan label register. Keduanya diperbaiki; rinci di `UI_UX §2.6` + `§17.7` dan `AUDIT_READINESS RD-181`. Yang dicatat di register ini hanyalah konsekuensi yang menyentuh §12: **nama kelompok menjadi bagian dari kontrak**, bukan lagi label internal grup.

| # | `code` grup | Nama kelompok (verbatim, = judul pada daftar pemilik) | Daun |
|---|---|---|---|
| R-1.1 | `platform.monitoring` | Dashboard & Infrastructure Health | 3 |
| R-1.2 | `platform.licensing` | Manajemen SaaS & Tenant Licensing | 5 |
| R-1.3 | `platform.master` | Master System Reference | 3 |
| R-1.4 | `platform.governance` | Keamanan & Platform Control | 4 |
| R-2.1 | `admin.monitoring` | Dashboard IT Kampus | 3 |
| R-2.2 | `admin.institution` | Konfigurasi Tenant, Branding & Active Add-ons | 5 |
| R-2.3 | `admin.parameters` | Master Parameter & Aturan Kampus | 8 |
| R-2.4 | `admin.identity` | Pengguna & Access Control | 7 |
| R-2.5 | `admin.integrations` | Gateway & Integrasi Server | 4 |
| R-2.6 | `admin.operations` | Pemeliharaan & Maintenance Tools | 4 |

`sortOrder` grup (10…60) sudah mengikuti penomoran daftar pemilik sejak awal; yang berubah hanya `label`/`label_en` dan ia **turun ke DB** lewat seed drift-aware (terukur: `menu kampus: 6 diperbarui`, `menu platform: 4 diperbarui`, `+0 baru`, `grant +0/-0` — tidak ada grant yang berubah, jadi tidak ada satu pun hak yang bergeser). Bentuk layar sesudah ralat: **Admin IT = 9 item pada baris menu kedua** — Dashboard, lalu **kelompok 1…6 berdampingan persis penomoran daftar pemilik**, lalu `Akademik` dan `Lainnya` — dan **Operator Platform = 4** (Dashboard + tiga kelompok; `platform.master` terpotong karena resolver membuang grup tanpa daun terlihat — vonis §12 yang bekerja). Tiap dropdown berisi daun kelompoknya **sendiri**, tanpa label bagian.

**Urutan adalah kontrak (ralat siklus 11).** Rakitan pertama promosi masih mengikuti urutan akar di DB, sehingga `Akademik` menyela sebelum kelompok 1. Aturan render sekarang tiga ember — tautan pendaratan → grup terpromosikan menurut `sortOrder` → akar lain — dan dikunci uji di `tests/unit/menu-tree.test.ts`: `sortOrder` grup naik, tanpa duplikat, mulai dari 10, bersarang tepat dua tingkat, nama kelompok persis tabel di atas, dan **nol** daun ber-`lock` membawa `labelKey`.

**Batas yang tidak dilanggar.** Promosi grup menjadi item tingkat pertama adalah **aturan render**, bukan perubahan pohon: `menu_items.parent_id`, `code`, `layer`, grant dan `route_key` tidak disentuh, sehingga `verify:menu` tetap membuktikan 39 daun + label verbatim (terukur `R-1 14/14`, `R-2 25/25`, `0 selisih` grant) dan `audit:menu` tetap hijau dengan angka yang sama seperti §5.85 (8 daun platform / 18 daun kampus). Yang **tidak** ikut berubah: daun `admin.parameters.import` dan `platform.master.lookup` tetap `is_visible = false` (izinnya `usulan`), dan `akademik.studentstatus` tetap berada di akar `akademik` karena itu letak baris `RBAC §6.2`-nya — memindahkannya ke kelompok Admin berarti mengarang hierarki yang tidak didokumenkan.

