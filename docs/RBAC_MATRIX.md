# RBAC_MATRIX.md — Matriks Otorisasi Resmi SICA (Role × Modul × Menu × Aksi)

| | |
|---|---|
| **Versi** | 1.2 |
| **Status** | **Katalog normatif** — sumber kebenaran tunggal untuk daftar role, hak akses, dan menu |
| **Cakupan** | Seluruh persona SICA (Web + Mobile), 19 modul entitlement, katalog permission ber-scope |
| **Bahasa Dokumen** | Indonesia (kode & database tetap Inggris) |
| **Dokumen Induk** | [`SECURITY_COMPLIANCE.md`](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md) §3 (model RBAC+ABAC), [`DATA_MODEL.md`](file:///c:/SICA/docs/DATA_MODEL.md) §3/§9/§12 (DDL & seed), [`PRD.md`](file:///c:/SICA/docs/PRD.md) §3 (persona) |

---

## 1. Cara Membaca Dokumen Ini

### 1.1 Prinsip penegakan (tidak boleh dilanggar)

1. **Role tidak pernah global-temporal-abadi.** Hak melekat pada *assignment* yang punya scope (tenant/org/prodi/kelas/periode) dan masa berlaku (`valid_from`/`valid_to`). Alasannya di [SECURITY_COMPLIANCE.md §3.1](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md#L102).
2. **Guard = hak kasar, Service = hak halus.** `RequiresPermission(PERM.x)` memutuskan *boleh tidak aksi ini*; service memutuskan *atas data siapa* (relasi kelas, periode terbuka, status `LOCKED`). Keduanya wajib ada — permission saja tidak pernah cukup.
3. **Permission hanya boleh dibaca dari katalog `PERM`.** Dilarang menaruh string literal hak akses di controller/route. Katalog di §4 adalah satu-satunya sumber; implementasinya di `packages/domain/src/authz/permissions.ts` (paket belum dibuat — lihat §8).
4. **Peran dibaca dari klaim JWT terverifikasi**, bukan dari klien, bukan dari cookie mentah ([api-response.ts:49-72](file:///C:/SICA/apps/web/src/lib/api-response.ts#L49-L72)).
5. **Akses lintas tenant → 404, bukan 403**, agar keberadaan resource tidak bocor ([SECURITY_COMPLIANCE.md:164](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md#L164)).
6. **Entitlement memotong lebih dulu dari role.** Modul yang tidak `ACTIVE`/`TRIAL` untuk tenant → `404 MODULE_NOT_AVAILABLE` walau actor punya permission ([lib/entitlement.ts:125-135](file:///C:/SICA/apps/web/src/lib/entitlement.ts#L125-L135)).

### 1.2 Legenda

| Simbol | Arti |
|---|---|
| **C / R / U / D** | Create / Read / Update / Delete pada sumber daya modul tersebut |
| **P** | Penuh — C, R, U, D dalam scope-nya |
| **T** | Tulis terbatas — R penuh + C/U/V pada objek milik sendiri atau hasil penugasan |
| **S** | Diajukan→divalidasi — bisa menulis draft/mengajukan (`INSERT`), sah setelah pihak lain melakukan `VALIDATE` |
| **B** | Baca saja (read-only) dalam scope-nya |
| **A** | Baca agregat/anonim (tidak per-record) |
| **—** | Tidak ada hak; menu tidak muncul, endpoint menolak `403`/`404` |
| ✅ | Sudah terimplementasi di kode (rute API atau halaman tersedia) |
| 🟡 | Sebagian — ada rute/halaman tetapi gating peran belum ditegakkan |
| 📝 | Baru didokumentasikan — belum ada kode |

**Enam aksi kanonik (FR-IDT-04).** Penyimpanan izin memakai kosakata aksi hasil adopsi benchmark ([DATA_MODEL §14.4](file:///c:/SICA/docs/DATA_MODEL.md), [SECURITY_COMPLIANCE §3.3](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md), [BENCHMARK_SEVIMA §2A.6](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md)): `READ · INSERT · UPDATE · DELETE · VALIDATE · OTHER`. Notasi `C R U D` pada tabel di bawah adalah singkatan baca; pemetaan bakunya:

| Aksi kanonik | Verba pada kode §4 | Contoh pemakaian |
|---|---|---|
| `READ` | `view` | daftar & detail |
| `INSERT` | `create`, `generate`, `submit`, `propose`, `request`, `join`, `upload`, `respond`, `record` | draft nilai, pengajuan KRS, catat pembayaran |
| `UPDATE` | `update`, `manage`, `write`, `lock`, `publish`, `void`, `activate`, `deactivate`, `assign`, `sync`, `send`, `run`, `withdraw`, `close`, `publish` | ubah aturan, kunci nilai, aktifkan modul |
| `DELETE` | `delete`, `revoke`, `release`, `leave`, `archive`, `leave` | lepas tautan ortu, cabut cekal (hard delete data akademik dilarang) |
| `VALIDATE` | `approve`, `verify`, `confirm`, `endorse` | approval KRS oleh DPA, koreksi nilai oleh Kaprodi, keringanan/void oleh Bendahara, status `LUNAS` |
| `OTHER` | `export`, `print`, `override`, `impersonation.grant`, `breakglass.use`, `recompute` | ekspor massal, cetak PDF ber-QR, buka gerbang paksa, impersonation, hitung ulang IPK |

`OTHER` **bukan** tempat "apa saja yang tersisa" — setiap aksinya wajib terdaftar eksplisit di §4. Satu-satunya sumber kode string permission adalah §4 dokumen ini; enum `permission_verb` di DATA_MODEL hanya lapisan transport untuk layar matriks izin.

---

## 2. Katalog Role Resmi

22 role — gabungan 5 nilai enum yang sudah berjalan, 10 role sistem yang dikunci `DATA_MODEL.md` §9, 11 persona `PRD.md` §3, label katalog `id.json`, dan **7 role usulan** (bertanda 🟡) untuk menutup modul yang hari ini tidak punya pemilik.

### 2.1 Layer Platform

| Kode Role | Nama Tampilan | Scope | Asal | Deskripsi |
|---|---|---|---|---|
| `PLATFORM_OPERATOR` | Operator Platform SICA | lintas-tenant | enum `super_admin` ✅ · PRD persona | Provisioning tenant, paket & kuota, feature flag, `break-glass` dan `platform_support_grants` — seluruh aksinya ter-audit ganda. **Bukan** admin kampus. |

> `super_admin` pada enum `member_role` adalah wadah satu lapis untuk level platform. Per [packages/database/src/schema/enums.ts:21-26](file:///C:/SICA/packages/database/src/schema/enums.ts#L21-L26) superadmin hidup di level platform, bukan di dalam satu tenant.

### 2.2 Layer Administrasi Institusi

| Kode Role | Nama Tampilan | Scope | Asal | Deskripsi |
|---|---|---|---|---|
| `TENANT_ADMIN` | Admin Perguruan Tinggi | `TENANT` | enum `tenant_admin` ✅ · PRD FR-ADM-06 | Pemegang otoritas tertinggi dalam satu tenant: struktur organisasi, user/role/permission, aktivasi modul, periode, aturan akademik global. |
| `ADMIN_ACADEMIC` | Admin Akademik (BAAK) | `ORG` | DATA_MODEL §9 · PRD persona | CRUD akademik lintas prodi: master data, penugasan, tutup periode, transkrip, penyelesaian kasus rekonsiliasi status. |
| `HEAD_OF_PROGRAM` | Ketua Program Studi | `PROGRAM` | DATA_MODEL §9 · PRD persona | Kendali kurikulum, kelas paralel, yudisium prodi; **satu-satunya** penyetuju koreksi nilai pasca-kunci (BR-G4). |
| `ADMIN_FINANCE` | Admin Keuangan / UKT | `TENANT` | DATA_MODEL §9 · PRD persona · BENCHMARK `keuangan` | Tarif & kelompok tagihan, engine penagihan massal, matriks gerbang keuangan, laporan piutang. Terhadap void/keringanan ia **pemohon** (BR-K2). |
| `TREASURER` | Bendahara / Penyetuju Keuangan | `TENANT` | DATA_MODEL §9 (`FINANCE approver`) · PRD persona · BENCHMARK `keuangan_approver` | **Penyetuju** void & keringanan (`VALIDATE`), konfirmasi pembayaran manual, rekonsiliasi harian, deposit. Mutually exclusive dengan `ADMIN_FINANCE` — pemohon ≠ penyetuju (BR-K2, AC-KEU-3). |
| `LEADER` | Pimpinan (Rektor/Warek/Dekan) | `ORG` | DATA_MODEL §9 · PRD persona · katalog `pimpinan` | Baca agregat lintas unit + approve SK resmi + e-sign (BR-R15). Tidak mengedit data operasional. |
| `FEEDER_OPERATOR` | Operator Feeder PDDIKTI | `TENANT` | DATA_MODEL §9 · BR-R11 · FR-FDR-01..03 | Menjalankan pra-validasi & kirim periode ke PDDIKTI, membaca error per record. Diangkat dengan SK Pimpinan; kredensial di Vault, bukan env biasa. |
| `PMB_OPERATOR` 🟡 | Petugas ADM / PMB | `ORG` | usulan — FR-P2-01/02 | Kurasi cohort, verifikasi berkas pendaftar, penentuan kelulusan seleksi & registrasi ulang. Hari ini tidak ada pemilik modul `pmb`. |
| `HR_BKD_OFFICER` 🟡 | Petugas SDM / BKD | `ORG` | usulan — FR-P2-07, tabel `staff` | Data induk dosen & tendik, validasi BKD sebelum kirim SISTER, presensi pegawai. Modul `hr_bkd` belum punya pemilik. |
| `QUALITY_OFFICER` 🟡 | Petugas SPMI / AMI | `ORG` | usulan — FR-P2-06 | Siklus PPEPP, penjadwalan audit mutu internal, tindak lanjut CAPA, ekspor instrumen akreditasi. |
| `UNIT_CLEARANCE_OFFICER` 🟡 | Petugas Unit Penunjang | `ORG` | usulan — BR-A7, BR-S4 | Menandai `clearances` & pasang/cabut `blockades` untuk dimensi Perpustakaan, Laboratorium, Kemahasiswaan, Keuangan-unit. |
| `COMPLIANCE_OFFICER` 🟡 | DPO / Auditor Internal | `TENANT` | usulan — BR-R14, UU PDP | Read-only audit trail + tangani `data_subject_requests`, verifikasi hash-chain, siapkan bukti SOC 2/ISO 27001. Tidak bisa mengubah data bisnis. |

**Catatan wadah enum `staff`.** Nilai enum `staff` [enums.ts:26](file:///C:/SICA/packages/database/src/schema/enums.ts#L26) bukan satu peran, melainkan **wadah** bagi sembilan role administratif di atas (`ADMIN_ACADEMIC`, `ADMIN_FINANCE`, `TREASURER`, `FEEDER_OPERATOR`, `PMB_OPERATOR`, `HR_BKD_OFFICER`, `QUALITY_OFFICER`, `UNIT_CLEARANCE_OFFICER`, `COMPLIANCE_OFFICER`). Selama `roles` + `user_role_assignments` belum ada, pembeda hak hanya bisa dibaca dari `role_in_class` dan pemeriksaan ad-hoc service — inilah **celah G-02** yang didaftarkan di §8.

### 2.3 Layer Pengajaran (scope kelas/periode)

| Kode Role | Nama Tampilan | Scope | Asal | Deskripsi |
|---|---|---|---|---|
| `LECTURER` | Dosen Pengampu | `CLASS` | enum `dosen` ✅ · DATA_MODEL §9 | Roster, presensi, dan nilai **hanya** untuk kelas di mana ia tercatat di `class_assignments` pada periode berjalan. |
| `COORDINATOR` | Koordinator Kelas | `CLASS` | `classes.ts:119` `role_in_class` | Dosen pengampu dengan hak lebih: buka sesi presensi, koreksi massal roster, usul jadwal pengganti. |
| `ADVISER` | Dosen PA / Pembimbing Akademik | `PERIOD` | DATA_MODEL §9 · PRD persona | Validasi & approve KRS mahasiswa bimbingan, termasuk **approval massal per angkatan** (FR-AKA-11). |
| `EXAMINER` | Penguji | `CLASS` | `classes.ts:119` | Input nilai komponen ujian/sidang pada TA yang diuji; tanpa hak tulis presensi reguler. |
| `LAB_ASSIST` | Asisten Praktikum / Tutor | `CLASS` | `classes.ts:119` (BR-A11) | Nilai komponen praktikum & presensi lab saja; tidak bisa menyentuh nilai teori maupun kunci akhir. |

### 2.4 Layer Lingkung Diri (scope `SELF`)

| Kode Role | Nama Tampilan | Scope | Asal | Deskripsi |
|---|---|---|---|---|
| `STUDENT` | Mahasiswa | `SELF` | enum `mahasiswa` ✅ · DATA_MODEL §9 | Submit KRS, presensi diri, lihat nilai/tagihan/jadwal sendiri. Satu-satunya role default pada `tenant_memberships` [auth.ts:57](file:///C:/SICA/packages/database/src/schema/auth.ts#L57). |
| `ALUMNI` | Alumni | `SELF` | DATA_MODEL §9 · PRD persona | Pasca-lulus: baca ijazah/transkrip, ajukan legalisir, isi tracer study. Tidak lagi punya hak akademik aktif. |
| `GUARDIAN` | Orang Tua / Wali 🟡 | `SELF` (tautan `student_guardians`) | usulan — katalog `ortu`, FR-P2, modul `parent_portal` | Monitor presensi, nilai, dan tagihan mahasiswa yang ditautkan. Read-only, dicabut oleh mahasiswa/aturan prodi. |
| `APPLICANT` | Pendaftar PMB 🟡 | `SELF` | usulan — PRD persona | Pra-nim: buat & lengkapi aplikasi, bayar biaya seleksi, ikuti CBT, lihat pengumuman. Hak tulis hanya pada aplikasinya sendiri. |

---

## 3. Model Data Otorisasi

### 3.1 Empat tabel inti (DDL di [DATA_MODEL.md:283-320](file:///c:/SICA/docs/DATA_MODEL.md#L283-L320))

| Tabel | Kunci | Isi |
|---|---|---|
| `permissions` | `code UNIQUE`, kolom `module` | Katalog global, kode stabil, **tanpa `tenant_id`** (dikecualikan dari generator RLS — wajib dicatat di sini) |
| `roles` | `(tenant_id, code) UNIQUE`, `is_system`, `scope_kind` | Role sistem (preset, tak bisa dihapus) + role kustom tenant |
| `role_permissions` | `(role_id, permission_id)` | Jembatan banyak-ke-banyak |
| `user_role_assignments` | `user_id`, `role_id`, `scope_*`, `valid_from`, `valid_to` | ⚑ **Tabel terpenting.** Satu user bisa memegang role sama di banyak scope dengan masa berlaku |

`scope_kind` ∈ `TENANT` · `ORG` · `PROGRAM` · `CLASS` · `PERIOD` · `SELF` (CHECK constraint di DDL).

**Dua kolom yang wajib ditambahkan** agar matriks ini bisa di-query (bukan hanya dibaca manusia), menurut keputusan [FR-IDT-04 / DATA_MODEL §14.4](file:///c:/SICA/docs/DATA_MODEL.md):

| Kolom | Tipe | Fungsi |
|---|---|---|
| `permissions.resource` | `text NOT NULL` | Kunci menu layar, mis. `admin.master.prodi`, `academic.krs.submit` — satu baris = satu titik aksi pada satu menu |
| `permissions.verb` | `permission_verb NOT NULL` | ∈ `READ/INSERT/UPDATE/DELETE/VALIDATE/OTHER` (§1.2); gabungan `resource:verb` = satu izin atomik |

Tanpa keduanya, layar matriks izin `/admin/pengguna/hak-akses` tidak dapat merender "menu × 6 kotak centang × scope" dan audit hak akses hanya bisa dibaca sebagai daftar kode. Ini dicatat sebagai celah **G-09** di §8.2.

**`permissions` adalah tabel global tanpa `tenant_id`** — pengecualian ini adalah register resmi satu-satunya untuk lapis otorisasi; tabel referensi global lain (mis. `provinces`, `religions` milik FR-ADM-07) didaftarkan di `DATA_MODEL.md`, bukan di sini.

### 3.2 Resolusi hak saat request (urutan tetap)

```
1. Verifikasi JWT RS256 → klaim sub, tid, role, rc, sid          (fail-closed)
2. tenants.status == ACTIVE ?              tidak → 423 LOCKED
3. membership.status == ACTIVE ?           tidak → 403
4. tenant_modules[module] ACTIVE/TRIAL ?   tidak → 404 MODULE_NOT_AVAILABLE
5. role_permissions punya PERM.x ?         tidak → 403
6. assignment scope & valid_to cocok ?     tidak → 404
7. Service: relasi data + status periode + workflow state  (hak halus)
8. academic_rules.gates / blockades belum menahan ?  ya → 403 GATE_BLOCKED
```

Cache izin di Redis TTL 5 menit + invalidasi event-driven saat assignment/role berubah; **mutasi finansial & nilai selalu cek langsung tanpa cache** ([SECURITY_COMPLIANCE.md:147](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md#L147)).

---

## 4. Katalog Permission

### 4.1 Konvensi penamaan

`<modul>.<sumber daya>.<aksi>` — aksi CRUD baku `view` / `create` / `update` / `delete`; aksi workflow memakai verba eksplisit (`submit`, `approve`, `reject`, `lock`, `unlock`, `void`, `confirm`, `sync`, `send`, `export`, `print`, `activate`, `deactivate`, `revoke`, `generate`, `manage`).

**Tujuh kode terkunci (jangan diganti — sudah di-ship sebagai konstanta di [SECURITY_COMPLIANCE.md §3.2](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md#L107-L115)):**

| Kode terkunci | Modul | Padanan aksi | Catatan |
|---|---|---|---|
| `grading.value.write` | `assessment` | C + U draft nilai | Namespace `grading` ≠ kode modul |
| `grading.unlock` | `assessment` | U buka kunci nilai | |
| `enrollment.krs.submit` | `enrollment` | C pengajuan KRS | ✅ dipakai [krs/submit](file:///C:/SICA/apps/web/src/app/api/v1/academic/krs/submit/route.ts) |
| `enrollment.krs.approve` | `enrollment` | U persetujuan KRS | ✅ dipakai [krs/approve](file:///C:/SICA/apps/web/src/app/api/v1/academic/krs/approve/route.ts) |
| `finance.invoice.void` | `finance` | U pembatalan (reversing entry) | |
| `finance.payment.confirm` | `finance` | U konfirmasi manual pembayaran | |
| `student.status.change` | `academic` | U status mahasiswa | |

Namespace warisan (`grading.*`, `student.*`) sengaja **tidak** disamakan dengan kode modul; pemetaan ke modul dilakukan lewat kolom `permissions.module`. Semua kode baru wajib memakai prefiks modul yang tepat agar tidak menambah pengecualian.

### 4.2 Katalog per modul

Aksi ditulis `C R U D` bila keempatnya tersedia sebagai permission terpisah.

**`identity`** — users, tenant_memberships, roles, permissions, assignments, sessions, mfa

| Permission | Aksi | Sumber daya |
|---|---|---|
| `identity.profile.view` / `.update` | R, U | Profil & akun sendiri |
| `identity.session.view` / `.revoke` | R, D | Perangkat aktif & riwayat login |
| `identity.mfa.manage` | C, D | Faktor TOTP/WebAuthn & recovery code |
| `identity.user.view` / `.create` / `.update` / `.deactivate` | C R U | Induk akun |
| `identity.membership.view` / `.create` / `.update` | C R U | Keanggotaan + `member_code` |
| `identity.role.view` / `.create` / `.update` / `.delete` | C R U D | Role sistem vs kustom (`is_system` melarang delete) |
| `identity.permission.view` | R | Katalog permission |
| `identity.assignment.view` / `.grant` / `.revoke` | C R D | Penugasan role ber-scope + masa berlaku |
| `identity.accessrequest.view` / `.approve` | R, U | `access_change_requests` (alur empat-mata) |
| `identity.impersonation.grant` / `.revoke` | C, D | `platform_support_grants` (khusus platform) |

**`academic`** — organizations, academic_years/periods/calendar, study_programs, curricula, courses, prerequisites, rooms, academic_rules, students, lecturers, staff, guardians, status, blockades, clearances, dokumen

| Permission | Aksi | Sumber daya |
|---|---|---|
| `academic.organization.view/.create/.update/.delete` | C R U D | Fakultas/prodi/unit |
| `academic.period.view/.create/.update/.close` | C R U | Tahun & periode + `DRAFT/OPEN/CLOSED` |
| `academic.periodreopen.request/.approve` | C, U | Pembukaan periode tertutup (BR-A9) |
| `academic.calendar.view/.create/.update/.delete` | C R U D | Kalender & tanggal kunci |
| `academic.program.view/.create/.update/.delete` | C R U D | Prodi, jenjang, plafon SKS, ambang IPK, akreditasi |
| `academic.curriculum.view/.create/.update/.publish` | C R U | Kurikulum + versi aktif |
| `academic.course.view/.create/.update/.delete` | C R U D | Mata kuliah, SKS per jenis, prasyarat |
| `academic.room.view/.create/.update/.delete` | C R U D | Ruang/lab + kapasitas (FR-AKA-15, BR-A4) |
| `academic.rule.view/.create/.update` | C R U | `academic_rules` per prodi-per-periode |
| `academic.gate.view/.configure` | R, U | Pemetaan gerbang tarif→aksi (FR-KEU-06) |
| `academic.blockade.view/.create/.release` | C R D | Cekal 4 dimensi (BR-A7) |
| `academic.student.view/.create/.update/.archive` | C R U | Induk mahasiswa (hard-delete dilarang) |
| `academic.studentstatus.view` / `student.status.change` | R, U | Status + riwayat (BR-S1–S5) |
| `academic.lecturer.view/.create/.update` | C R U | Induk dosen/NIDN |
| `academic.guardian.view/.create/.update` | C R U | Data ortu/wali (PII — lihat §7.4) |
| `academic.clearance.view/.update` | R, U | Tanda bebas tanggungan per unit (BR-S4) |
| `academic.document.view/.print` | R | PDF KRS/KHS/Transkrip/Kartu Ujian + QR verifikasi (FR-AKA-14) |
| `academic.transcript.view/.issue` | R, C | Transkrip berversi (FR-AKA-07) |
| `academic.feedercode.view/.update` | R, U | Kode stat & riwayat akreditasi PDDIKTI (BR-A17, DATA_MODEL §11.4) |
| `academic.export.own` / `academic.export.bulk` | R | Ekspor massal = izin khusus + audit |

**`teaching`** — classes, class_assignments, class_schedules, class_sessions, class_waitlists

| Permission | Aksi | Sumber daya |
|---|---|---|
| `teaching.class.view/.create/.update/.delete` | C R U D | Kelas paralel per periode |
| `teaching.assignment.view/.create/.update/.delete` | C R U D | Penugasan dosen + `role_in_class` |
| `teaching.schedule.view/.create/.update/.delete` | C R U D | Ploting mingguan + deteksi bentrok (BR-A4) |
| `teaching.session.view/.generate/.update` | C R U | Sesi pertemuan + kalender libur (FR-AKA-15) |
| `teaching.roster.view` | R | Daftar mahasiswa kelas ampuan |
| `teaching.workload.view` | R | Beban mengajar vs plafon BKD (BR-A11) |
| `teaching.waitlist.view/.manage` | R, U | Antrean & auto-generate kelas (BR-A10) |
| `teaching.virtualroom.view/.create` | R, C | Link Zoom/Meet untuk mode ONLINE (BR-A12) |

**`enrollment`** — enrollments, class_waitlists

| Permission | Aksi | Sumber daya |
|---|---|---|
| `enrollment.krs.view` | R | KRS (diri sendiri / scope bimbingan) |
| `enrollment.krs.submit` 🔒 | C | Ajukan KRS saat jendela OW |
| `enrollment.krs.approve` 🔒 | U | Setujui (ADVISER/Kaprodi) |
| `enrollment.krs.reject` | U | Tolak + alasan wajib |
| `enrollment.krs.batchapprove` | U | Approval massal per angkatan (FR-AKA-11) |
| `enrollment.krs.withdraw` | U | Batalkan baris sebelum terkunci |
| `enrollment.krsedit.request/.approve` | C, U | Sunting KRS / late-KRS ber-approval (FR-AKA-04) |
| `enrollment.waitlist.join/.leave` | C, D | Tahan SKS di antrean (BR-A10) |
| `enrollment.effective.view` | R | Hasil akhir pasca-approval |

**`attendance`** — attendances, class_sessions

| Permission | Aksi | Sumber daya |
|---|---|---|
| `attendance.qr.generate` | C | Bangkitkan QR rotasi 30 detik (pengampu/koordinator) |
| `attendance.qr.scan` | U | Scan QR + geofencing GPS (milik sendiri) |
| `attendance.record.view` | R | Presensi per pertemuan |
| `attendance.record.create/.update` | C, U | Input manual/koreksi dalam batas ubah presensi (FR-AKA-12) |
| `attendance.summary.view` | R | Rekap % hadir + ambang syarat ujian (BR-A15) |

**`assessment`** — grade_components, grades, grade_scales/bands, grade_corrections

| Permission | Aksi | Sumber daya |
|---|---|---|
| `assessment.composition.view/.create/.update` | C R U | Bobot komponen wajib == 100% (FR-AKA-09) |
| `assessment.scale.view/.manage` | R, U | Skala & pita konversi per kurikulum |
| `assessment.grade.view` | R | Nilai per komponen / huruf mutu |
| `grading.value.write` 🔒 | C, U | Draft nilai per mahasiswa (pengampu) |
| `assessment.grade.publish` | U | Umumkan sementara ke mahasiswa |
| `assessment.grade.lock` | U | Kunci nilai → dasar KHS definitif |
| `grading.unlock` 🔒 | U | Buka kunci (khusus Kaprodi, ter-audit) |
| `assessment.correction.request/.approve` | C, U | Alur koreksi pasca-kunci (BR-G4, AC-NIL-1) |
| `assessment.examcard.view/.issue` | R, C | Kartu Ujian UTS/UAS (BR-A15, FR-AKA-14) |
| `assessment.yudisium.eligibility.view` | R | Cek min SKS, ambang IPK, bebas E/K, clearance (BR-S4, BR-S5, BR-R3, BR-R6) |

**`finance`** — fee_components, fee_tariff_groups, invoices, invoice_items/installments, payments, ledger, deposits, payment_waivers

| Permission | Aksi | Sumber daya |
|---|---|---|
| `finance.tariff.view/.create/.update` | C R U | Komponen tarif per prodi/angkatan/jenjang (versioned) |
| `finance.invoice.view` | R | Tagihan (diri sendiri / scope tenant) |
| `finance.invoice.create/.generate` | C | Generator massal idempoten per periode (FR-KEU-02) |
| `finance.invoice.update` | U | Korentasi sebelum dibayar |
| `finance.invoice.void` 🔒 | U | Void via reversing entry — dual-approval (BR-K2) |
| `finance.installment.view/.create` | R, C | Cicilan (FR-KEU-07) |
| `finance.payment.view` | R | Status 4-keadaan tagihan |
| `finance.payment.confirm` 🔒 | U | Konfirmasi manual/verifikasi webhook |
| `finance.payment.record` | C | Catat pembayaran non-gateway |
| `finance.deposit.view/.manage` | R, U | Deposit & saldo (append-only) |
| `finance.waiver.request/.approve` | C, U | Keringanan/dispensasi ber-approval (FR-KEU-05) |
| `finance.ledger.view` | R | Ledger append-only |
| `finance.reconcile.run` | C | Rekonsiliasi harian vs statement bank |
| `finance.gate.override` | U | Buka gerbang KRS paksa — wajib approval + alasan + audit |
| `finance.report.view` | R | Piutang & pendapatan |

**`feeder_pddikti`** — pddikti_mappings, pddikti_sync_runs, pddikti_correction_requests

| Permission | Aksi | Sumber daya |
|---|---|---|
| `feeder.mapping.view/.manage` | R, CUD | Kamus entitas lokal → kode PDDIKTI (FR-FDR-01) |
| `feeder.validate.run` | C | Pra-validasi kelayakan + error per record (FR-FDR-02) |
| `feeder.sync.run/.view` | C, R | Kirim/simpan periode, log, retry aman (FR-FDR-03, BR-R10) |
| `feeder.period.send` | U | Eksekusi kirim setelah `diff` di-approve |
| `feeder.correction.request/.approve` | C, U | Koreksi data terkirim (hard-delete dilarang) |
| `feeder.credential.manage` | U | Kredensial feed operator → Vault/KMS (BR-R11) |

**`audit`** — audit_logs, audit_chain_head

| Permission | Aksi | Sumber daya |
|---|---|---|
| `audit.log.view` | R | Baca jejak append-only (retensi 7 tahun) |
| `audit.chain.verify` | R | Verifikasi hash-chain anti-rubah |
| `audit.export` | R | Ekspor bukti audit (kolom dibatasi + volume dibatasi) |

> `audit_logs` **tidak punya** C/U/D untuk pengguna mana pun — hanya ditulis sistem; `sica_app` ditolak `UPDATE`/`DELETE` (AC-AUD-1).

**`tenant_modules` / paket (entitlement)**

| Permission | Aksi | Sumber daya |
|---|---|---|
| `entitlement.module.view` | R | `GET /tenant/modules` — mengemudikan sidebar |
| `entitlement.catalog.view` | R | Katalog global 19 modul |
| `entitlement.module.activate/.deactivate` | C, U | Aktif/nonaktif add-on + graf dependensi |
| `entitlement.seat.view/.manage` | R, U | Metering `PER_SEAT` (LMS, thesis, hr_bkd) |
| `entitlement.trial.grant` | C | Status `TRIAL`/`PENDING_PAYMENT` |
| `platform.plan.view/.manage` | R, CUD | `plans`, `plan_modules` (khusus platform) |
| `platform.tenant.view/.provision/.suspend` | R, C, U | Provisioning & `tenant.status` (khusus platform) |
| `platform.quota.manage` / `platform.flag.manage` | U | `tenant_quotas`, `subscriptions`, feature flag |
| `platform.breakglass.use` | C | Akses darurat lintas tenant — dua identitas, ter-audit |

### 4.3 Katalog permission modul Add-on

| Modul | Permission | Aksi |
|---|---|---|
| `pmb` | `pmb.registration.view/.submit` · `pmb.payment.view/.pay` · `pmb.document.verify` · `pmb.cohort.view/.manage` · `pmb.selection.rank/.announce` · `pmb.reregistrasi.update` · `pmb.nim.generate` | C R U |
| `cbt` | `cbt.itembank.view/.create/.update/.delete` · `cbt.session.view/.schedule` · `cbt.exam.start/.submit` · `cbt.grade.auto.view` · `cbt.proctor.log.view` | C R U D |
| `lms` | `lms.material.view/.create/.update/.delete` · `lms.assignment.view/.create/.grade` · `lms.submission.view/.submit` · `lms.forum.view/.post` · `lms.progress.update` | C R U D |
| `mbkm` | `mbkm.catalog.view/.manage` · `mbkm.application.view/.submit/.approve` · `mbkm.contract.update` · `mbkm.activity.log.write` · `mbkm.partnergrade.write` · `mbkm.conversion.request/.approve` | C R U |
| `thesis` | `thesis.title.propose/.approve` · `thesis.supervisor.assign` · `thesis.logbook.write/.endorse` · `thesis.seminar.register/.schedule` · `thesis.similarity.check` · `thesis.defense.grade.write` · `thesis.clearance.view` | C R U |
| `spmi` | `spmi.standard.view/.manage` · `spmi.audit.plan/.execute` · `spmi.capa.track` · `spmi.instrumen.export` | C R U |
| `hr_bkd` | `hr.profile.view/.manage` · `hr.portofolio.write` · `hr.bkd.calc/.submit/.approve` · `hr.sister.sync` · `hr.staffattendance.view` | C R U |
| `parent_portal` | `parent.link.view/.create/.revoke` · `parent.student.view` · `parent.finance.view` · `parent.consent.manage` | C R D |
| `graduation` | `graduation.yudisium.register/.verify/.issue` · `graduation.wisuda.register/.schedule` · `graduation.diploma.issue` · `graduation.pin.sync` · `graduation.legalisir.request/.approve` · `graduation.tte.sign` | C R U |
| `tracer_iku` | `tracer.profile.view/.update` · `tracer.survey.respond` · `tracer.employment.write` · `tracer.iku.report.view` · `tracer.vacancy.manage` | C R U |

**Larangan identifier.** Semua kode permission wajib ASCII dengan pola `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$` — lint rule `no-restricted-syntax` di CI menolak kode yang memuat karakter non-ASCII. Istilah Indonesia tetap boleh pada kolom *sumber daya*, tidak pernah pada kode.

### 4.4 Permission untuk kebutuhan Area Admin baru (PRD §5.8, hasil benchmark)

13 FR baru lahir dari studi Sevima. Tanpa kode izinnya, menu Admin yang dijanjikan tidak bisa ditegakkan — jadi daftar di bawah **menambah** §4.2 dan ikut menjadi katalog.

| FR | Kebutuhan | Permission baru | Aksi kanonik | Pemilik |
|---|---|---|---|---|
| FR-ADM-07 | Kamus/data referensi per tenant (unsur nilai, jenis matakuliah, rumpun, slot waktu, status hadir, agama, pekerjaan, penghasilan, wilayah…) | `academic.reference.view/.create/.update/.delete` | `READ` `INSERT` `UPDATE` `DELETE` | `ADMIN_ACADEMIC`; `READ` semua role tugas |
| FR-ADM-08 | Skema enrollment ("sistem kuliah") — mengikat kelas yang boleh diambil **dan** tarifnya | `enrollment.scheme.view/.manage` | `READ` `UPDATE` | `TENANT_ADMIN` + `HEAD_OF_PROGRAM` (prodi) |
| FR-ADM-09 | Meta-konfigurasi mandiri: visibilitas/label/urutan kolom, template laporan, blok tanda tangan | `settings.meta.view/.update` | `READ` `UPDATE` | `TENANT_ADMIN`; `READ` semua |
| FR-ADM-10 | Panel "Kesehatan Data" pra-`LIVE` (NIM duplikat, dosen tanpa NIDN, prodi tanpa akreditasi…) | `academic.health.run/.view` | `OTHER` | `TENANT_ADMIN`, `ADMIN_ACADEMIC`, `PLATFORM_OPERATOR` |
| FR-ADM-11 | Diagnosa "mengapa terkunci" pada setiap halaman transaksi | `academic.denialreason.view` | `READ` | semua role (hanya atas penolakan miliknya sendiri) |
| FR-ADM-12 | Impact analysis sebelum hapus/nonaktif master (fakultas→prodi→kurikulum→matkul→kelas) | `academic.impact.view` | `READ` | `ADMIN_ACADEMIC`, `HEAD_OF_PROGRAM` |
| FR-ADM-13 | Impersonation berjustifikasi (alasan + MFA + TTL + audit) | `identity.impersonation.grant/.revoke` | `INSERT` `DELETE` | `PLATFORM_OPERATOR`; `TENANT_ADMIN` hanya scope tenant sendiri |
| FR-AKA-16 | Pemaketan KRS mahasiswa baru (`first_semester_packed_sks`) | `enrollment.pack.view/.apply` | `READ` `UPDATE` | `ADMIN_ACADEMIC`, `HEAD_OF_PROGRAM` |
| FR-AKA-17 | Pindah program studi (pemetaan NIM asal→tujuan, riwayat dipindah bukan hapus) | `academic.transfer.request/.approve` | `INSERT` `VALIDATE` | `STUDENT`/`ADMIN_ACADEMIC` ajukan → `ADMIN_ACADEMIC` setujui |
| FR-AKA-18 | Dua tahap publikasi nilai + kunci/buka massal + **hitung ulang** IP/IPS/IPK/transkrip | `assessment.grade.publish` · `assessment.grade.lock` · `assessment.grade.lockmassal` · `assessment.recompute` | `UPDATE` `OTHER` | `LECTURER` (kelas ampuan), `HEAD_OF_PROGRAM` (buka kunci), `ADMIN_ACADEMIC` (hitung ulang) |
| FR-KUR-02 | Ekivalensi & konversi matakuliah (RPL, pindah prodi, MBKM) | `academic.equivalency.view/.manage` | `READ` `INSERT` `UPDATE` `DELETE` | `HEAD_OF_PROGRAM`, `ADMIN_ACADEMIC` |
| FR-RPT-02 | Monitoring operasional admin: kepatuhan nilai, utilisasi ruang, statistik login | `academic.monitoring.view` · `teaching.roomutilization.view` · `identity.loginstats.view` | `READ` | `TENANT_ADMIN`, `ADMIN_ACADEMIC`, `LEADER` (agregat) |
| FR-DOC-02 | Persuratan akademik: template + token variabel + penomoran otomatis + TTE | `document.letter.view/.create` · `document.numbering.manage` · `document.tte.sign` | `READ` `INSERT` `UPDATE` `VALIDATE` | `ADMIN_ACADEMIC`, `STAFF` (TU), `LEADER` (tanda tangan) |

Catatan: `finance.waiver.request/.approve`, `feeder.validate.run`, `academic.periodreopen.*` sudah ada di §4.2 dan **tidak** diduplikasi di sini.

---

## 5. Matriks Akses Ringkas (Role × Modul)

Kolom = 19 modul katalog [`MODULE_CODES`](file:///C:/SICA/packages/contracts/src/entitlement.ts#L9-L16). Nilai = tingkat hak dalam scope role tersebut (legenda §1.2). `C*` = modul Add-on, hanya berlaku bila `tenant_modules` status `ACTIVE`/`TRIAL`.

Aksi entitlement & platform (`tenant_modules`, `plans`, provisioning tenant) tidak menjadi kolom sendiri karena bukan modul katalog — kodenya ada di §4.2 kelompok *Entitlement & platform* dan dipakai silang oleh `PLATFORM_OPERATOR`, `TENANT_ADMIN`, `LEADER`.

**Kolom yang masih terbuka (G-10).** Katalog 19 modul belum memuat `litabmas`, `documents`/`persuratan` + `esign`, dan `kerjasama` yang dimiliki pembanding (didaftarkan di [PRD §5.8](file:///c:/SICA/docs/PRD.md)). Sementara keputusan belum diambil, permission persuratan ditampung di `document.*` (§4.4) dan penelitian ditampung sebagai grant `AUDIT_MU_REVIEW`/`hr.portofolio.write`; grid ini **wajib** bertambah kolomnya begitu modul resmi masuk `MODULE_CODES`.

Aksi entitlement & platform (`tenant_modules`, `plans`, provisioning tenant) **tidak** menjadi kolom sendiri karena bukan modul katalog — kodenya ada di §4.2 kelompok `tenant_modules / paket` dan dipakai silang oleh `PLATFORM_OPERATOR`, `TENANT_ADMIN`, serta `LEADER` (lihat §6.1–§6.2).

| Role | identity | academic | teaching | enrollment | attendance | assessment | finance | feeder | audit | pmb* | cbt* | lms* | mbkm* | thesis* | spmi* | hr_bkd* | parent* | graduation* | tracer* |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `PLATFORM_OPERATOR` | A | A | A | A | A | A | A | A | **P** | A | — | — | — | — | — | — | — | A | A |
| `TENANT_ADMIN` | **P** | **P** | **P** | B | B | B | **P** | **P** | **P** | P | B | P | P | B | P | P | B | P | P |
| `ADMIN_ACADEMIC` | B | **P** | **P** | T | T | T | B | **P** | B | T | T | — | T | B | B | B | — | T | B |
| `HEAD_OF_PROGRAM` | — | T | **P** | T | B | **P** | — | B | B | B | B | B | T | T | T | B | — | T | B |
| `LEADER` | B | A | A | A | A | A | B | B | B | A | — | — | A | — | T | A | — | T | T |
| `ADMIN_FINANCE` | — | B | — | B | — | — | **P** | B | B | T | — | — | — | — | — | — | — | T | — |
| `TREASURER` | — | B | — | — | — | — | T | — | B | B | — | — | — | — | — | — | — | B | — |
| `FEEDER_OPERATOR` | — | T | B | B | B | B | B | **P** | B | B | — | — | — | — | B | — | — | B | — |
| `PMB_OPERATOR` 🟡 | T | T | — | — | — | — | B | T | B | **P** | T | — | — | — | — | — | — | — | — |
| `HR_BKD_OFFICER` 🟡 | T | T | B | — | — | — | B | B | B | — | — | — | — | — | B | **P** | — | — | — |
| `QUALITY_OFFICER` 🟡 | — | B | B | — | B | B | — | B | B | — | — | — | B | B | **P** | B | — | B | T |
| `UNIT_CLEARANCE_OFFICER` 🟡 | — | T | — | B | B | B | B | — | B | — | — | — | — | B | — | — | — | T | — |
| `COMPLIANCE_OFFICER` 🟡 | B | A | A | A | A | A | A | B | **P** | A | — | — | — | — | B | A | B | A | A |
| `LECTURER` | B | B | T | B | **P** | T | — | — | — | — | T | T | T | T | B | T | — | B | — |
| `COORDINATOR` | B | B | **P** | B | **P** | T | — | — | — | — | T | T | T | T | B | T | — | B | — |
| `ADVISER` | B | B | B | **T** | — | B | — | — | — | — | — | — | B | B | — | — | — | — | — |
| `EXAMINER` | B | — | B | — | — | T | — | — | — | — | B | — | — | T | — | — | — | — | — |
| `LAB_ASSIST` | B | — | B | — | T | S | — | — | — | — | — | B | — | B | — | — | — | — | — |
| `STUDENT` | T | B | B | S | S | B | S | — | — | — | S | T | S | S | — | — | B | S | S |
| `ALUMNI` | T | B | — | — | — | B | B | — | — | — | — | B | — | B | — | — | — | T | T |
| `GUARDIAN` 🟡 | T | B | B | B | B | B | B | — | — | — | — | — | — | — | — | — | **T** | — | — |
| `APPLICANT` 🟡 | T | — | — | — | — | — | B | — | — | **T** | T | — | — | — | — | — | — | — | — |

**Cara membaca tiga nilai paling sering disalahpahami:**

- `PLATFORM_OPERATOR` bernilai **A** (agregat) pada modul bisnis, bukan B. Data per-record hanya terjangkau lewat `platform.breakglass.use` yang menghasilkan **dua identitas** di audit log ([SECURITY_COMPLIANCE.md:65](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md#L65)).
- `STUDENT` pada `enrollment`/`attendance`/`finance` bernilai **S**, bukan T: menulis pengajuan/scan/pembayaran, tetapi sah setelah approval DPA, verifikasi geofence, atau rekonsiliasi gateway.
- `HEAD_OF_PROGRAM` pada `assessment` bernilai **P** — satu-satunya role yang punya `grading.unlock` dan menyetujui `assessment.correction.approve` (BR-G4). Dosen pengampu sendiri **tidak** boleh membuka kunci nilainya.

---

## 6. Matriks Detail — Role × Modul × Menu × Aksi CRUD

Kolom **Aksi** memakai notasi `C R U D` subset dari katalog §4. Kolom **Permission** menunjuk kode kunci; daftar lengkap ada di §4.

### 6.1 Cluster Platform

| Role | Modul | Menu | Aksi | Permission | Deskripsi |
|---|---|---|---|---|---|
| `PLATFORM_OPERATOR` | `tenant_modules` | Platform → Paket & Modul | C R U D | `platform.plan.manage`, `entitlement.seat.manage`, `entitlement.trial.grant` | Definisi `plans`/`plan_modules`, harga, batas kursi; bukan aktivasi tenant (itu `TENANT_ADMIN`) |
| `PLATFORM_OPERATOR` | `identity` | Platform → Provisioning Tenant | C R U | `platform.tenant.provision`, `platform.tenant.suspend` | Buat tenant + seed 22 role sistem (§9 DATA_MODEL), domain, status `SUSPENDED` |
| `PLATFORM_OPERATOR` | `tenant_modules` | Platform → Kuota & Flag | U | `platform.quota.manage`, `platform.flag.manage` | `tenant_quotas`, `subscriptions`, konversi `feature_flags` → baris `tenant_modules` |
| `PLATFORM_OPERATOR` | semua | Platform → Statistik Agregat | R | `platform.tenant.view` | Metering `tenant_usage`, utilisasi, noisy-neighbour alert — tanpa PII per-record |
| `PLATFORM_OPERATOR` | `audit` | Platform → Audit Lintas Tenant | R | `audit.log.view`, `audit.export` | Baca jejak semua tenant; ekspor bukti SOC 2/ISO |
| `PLATFORM_OPERATOR` | `identity` | Platform → Dukungan Terawasi | C D | `identity.impersonation.grant`, `.revoke` | `platform_support_grants`: ticket-id + alasan + TTL ≤30 mnt + MFA; tenant dapat melihat & mencabut |
| `PLATFORM_OPERATOR` | semua | Platform → Break-Glass | C | `platform.breakglass.use` | Akses darurat per-record saat insiden; wajib alasan, MFA, notifikasi tenant, dua identitas di audit |
| `COMPLIANCE_OFFICER` 🟡 | `audit` | Pengaturan → Jejak Audit | R | `audit.log.view`, `audit.chain.verify`, `audit.export` | Verifikasi hash-chain, deteksi nilai diubah di luar jendela input, siapkan bukti audit |
| `COMPLIANCE_OFFICER` 🟡 | `identity` | Pengaturan → Permintaan Subjek Data | R U | `identity.accessrequest.view`, `.approve` | Tangani `data_subject_requests` UU PDP: anonimisasi tampilan, **bukan** hapus arsip |
| `COMPLIANCE_OFFICER` 🟡 | semua | Pengaturan → Laporan Kepatuhan | R | `<modul>.report.view` | Read agregat per modul untuk DPO/reviu internal; tanpa hak tulis data bisnis |

### 6.2 Cluster Administrasi Institusi

| Role | Modul | Menu | Aksi | Permission | Deskripsi |
|---|---|---|---|---|---|
| `TENANT_ADMIN` | `identity` | Pengaturan → User & Role | C R U D | `identity.user.*`, `identity.membership.*`, `identity.role.*`, `identity.assignment.grant` | Frabrikasi akun, role kustom (`is_system=false`), penugasan ber-scope + `valid_to`; perubahan hak butuh approval empat-mata |
| `TENANT_ADMIN` | `academic` | Pengaturan → Profil Institusi | C R U | `academic.organization.*`, `academic.program.*`, `academic.period.*`, `academic.calendar.*` | Fakultas/prodi/jenjang, tahun akademik, periode `DRAFT/OPEN/CLOSED`, kalender & tanggal kunci |
| `TENANT_ADMIN` | `academic` | Pengaturan → Aturan Akademik | C R U | `academic.rule.*`, `academic.gate.configure` | Satu objek konfigurasi per prodi-per-periode: jendela KRS, band SKS, prasyarat, kuesioner, denda, generate sesi, batas ubah presensi (FR-AKA-12) |
| `TENANT_ADMIN` | `tenant_modules` | Pengaturan → Modul & Paket | R C U | `entitlement.module.view`, `.activate`, `.deactivate` | ✅ satu-satunya aksi tulis modul yang sudah punya rute; aktivasi butuh `scope_kind=TENANT` |
| `TENANT_ADMIN` | `academic` | Akademik → Status Mahasiswa | R U | `academic.studentstatus.view`, `student.status.change` | AKTIF/CUTI/DO/LULUS/STOP ber-approval + riwayat (BR-S1–S5) |
| `TENANT_ADMIN` | `audit` | Pengaturan → Audit | R | `audit.log.view` | Seluruh aksi administratif tenant |
| `ADMIN_ACADEMIC` | `academic` | Akademik → Data Induk | C R U D | `academic.course.*`, `academic.curriculum.*`, `academic.student.*`, `academic.lecturer.*` | Kurikulum, matkul + SKS per jenis, prasyarat, induk mahasiswa/dosen, kode feeder |
| `ADMIN_ACADEMIC` | `teaching` | Akademik → Kelas & Jadwal | C R U D | `teaching.class.*`, `teaching.assignment.*`, `teaching.schedule.*`, `teaching.session.generate` | Urutan penyiapan semester (§7.5); deteksi bentrok ruang & dosen (BR-A4) |
| `ADMIN_ACADEMIC` | `enrollment` | Akademik → KRS Lintas Prodi | R U | `enrollment.krs.view`, `.batchapprove`, `enrollment.krsedit.approve` | Monitor OW, sunting KRS/late-KRS manual ber-approval + audit |
| `ADMIN_ACADEMIC` | `attendance` | Presensi → Rekap Massal | R U | `attendance.summary.view`, `attendance.record.update` | Koreksi presensi lintas kelas dalam batas ubah |
| `ADMIN_ACADEMIC` | `assessment` | Nilai → Transkrip & Cetak | R C | `academic.transcript.issue`, `academic.document.print` | Terbitkan transkrip berversi + PDF QR verifikasi (FR-AKA-14) |
| `ADMIN_ACADEMIC` | `feeder_pddikti` | Laporan → PDDIKTI | C R U | `feeder.validate.run`, `feeder.sync.run` | Buka/urutkan period, pra-validasi, kirim |
| `ADMIN_ACADEMIC` | `pmb`* | PMB → Registrasi Ulang | C U | `pmb.reregistrasi.update`, `pmb.nim.generate` | Konversi pendaftar lolos → NIM + akun ter-provision |
| `ADMIN_ACADEMIC` | `graduation`* | Wisuda → Verifikasi Syarat | R U | `graduation.verify`, `graduation.status.update` | Cek min SKS/IPK/bebas E-K/clearance (BR-S4, BR-S5) |
| `HEAD_OF_PROGRAM` | `academic` | Akademik → Kurikulum Prodi | R C U | `academic.curriculum.update`, `academic.course.update` | only prodi-nya; publish versi kurikulum |
| `HEAD_OF_PROGRAM` | `teaching` | Akademik → Kelas Paralel Prodi | C R U D | `teaching.class.*`, `teaching.assignment.*` | Buka kelas paralel, tentukan koordinator & pengampu, tolak overload BKD (BR-A11) |
| `HEAD_OF_PROGRAM` | `enrollment` | KRS → Approval (scope prodi) | R U | `enrollment.krs.approve`, `.reject`, `.batchapprove` | Penyetuju akhir bila DPA tidak ada/berhalangan |
| `HEAD_OF_PROGRAM` | `assessment` | Nilai → Kunci & Koreksi | R C U D | `grading.value.write`, `assessment.grade.lock`, `grading.unlock`, `assessment.correction.approve` | 🔑 **satu-satunya** pemegang `grading.unlock`; koreksi wajib alasan + before/after audit (AC-NIL-1) |
| `HEAD_OF_PROGRAM` | `thesis`* | Skripsi → Penugasan Pembimbing | C U | `thesis.supervisor.assign`, `thesis.seminar.schedule` | Tetapkan pembimbing & penguji |
| `HEAD_OF_PROGRAM` | `graduation`* | Yudisium → Usulan Kelulusan | R U | `graduation.yudisium.verify`, `.issue` | Usulkan SK Yudisium ke Pimpinan |
| `LEADER` | `dashboard` | Dashboard Eksekutif | R | `academic.report.view`, `finance.report.view`, `feeder.sync.view` | KPI FR-P2-09: tren maba, rasio dosen-mhs, rata-rata IPK, efisiensi penagihan, kepatuhan PDDIKTI, kohort retensi/DO |
| `LEADER` | `academic` | Pimpinan → Keputusan Strategis | R | `academic.period.view`, `academic.program.view` | **Read + approval only**; ubah aturan didelegasikan ke `TENANT_ADMIN`/`ADMIN_ACADEMIC` |
| `LEADER` | `graduation`* | Pimpinan → SK Yudisium & Ijazah | R U | `graduation.yudisium.issue`, `graduation.diploma.issue`, `graduation.tte.sign` | Tetapkan SK, tanda tangan TTE tersertifikasi (BR-R15) |
| `LEADER` | `spmi`* | Mutu → Revi Manajemen | R U | `spmi.capa.track`, `spmi.instrumen.export` | Sahkan tindak lanjut CAPA & siap akreditasi |
| `LEADER` | `tracer_iku`* | Pimpinan → IKU | R | `tracer.iku.report.view` | Capaian IKU 1 (tracer study) & pelaporan |
| `ADMIN_FINANCE` | `finance` | Keuangan → Tarif & Tagihan | C R U D | `finance.tariff.*`, `finance.invoice.generate`, `finance.waiver.request` | Komponen tarif versioned per prodi/angkatan/jenjang; engine tagihan idempoten (BR-K1, AC-KEU-2). Keringanan: **pengaju** |
| `ADMIN_FINANCE` | `finance` | Keuangan → Gerbang KRS | R U | `finance.gate.view`, `finance.gate.override`, `academic.gate.configure` | Matriks komponen→aksi yang dibatasi; override hanya dengan approval + alasan + audit (FR-KEU-06) |
| `ADMIN_FINANCE` | `finance` | Keuangan → Pembatalan Tagihan | R C | `finance.invoice.void` (ajukan) | Berkedudukan **pemohon**; persetujuan milik `TREASURER` (BR-K2, AC-KEU-3) |
| `ADMIN_FINANCE` | `academic` | Keuangan → Status Akademik | R | `academic.studentstatus.view`, `academic.feedercode.view` | Verifikasi jalur masuk & status aktif sebelum menagih (BR-A17) |
| `TREASURER` | `finance` | Keuangan → Antrean Persetujuan | R U | `finance.waiver.approve`, `finance.invoice.void` (setuju), `finance.payment.confirm` | Kumpulan aksi `VALIDATE`; **tidak dapat** mengajukan sendiri — baris grant ini mutual-exclusion dengan `ADMIN_FINANCE` |
| `TREASURER` | `finance` | Keuangan → Pembayaran | R C U | `finance.payment.record`, `finance.installment.create`, `finance.deposit.manage` | Catat pembayaran non-gateway, cicilan, deposit; status 4-keadaan (FR-KEU-07) |
| `TREASURER` | `finance` | Keuangan → Rekonsiliasi | R C | `finance.ledger.view`, `finance.reconcile.run` | Rekonsiliasi harian vs statement bank; alert delta (mencegah pembayaran tak ter-match) |
| `FEEDER_OPERATOR` | `feeder_pddikti` | Laporan → Pemetaan Feeder | C R U D | `feeder.mapping.manage` | Kamus entitas lokal→kode PDDIKTI sebagai **tabel data**, bukan kode program |
| `FEEDER_OPERATOR` | `feeder_pddikti` | Laporan → Kirim Periode | C R U | `feeder.validate.run`, `feeder.period.send`, `feeder.sync.view` | Pra-validasi + approve `diff` sebelum write; retry aman idempoten (BR-R10, FR-FDR-03) |
| `FEEDER_OPERATOR` | `feeder_pddikti` | Laporan → Koreksi Data Terkirim | C R | `feeder.correction.request`, `.approve` | Tidak ada hard delete (BR-R10); koreksi via usulan resmi |
| `FEEDER_OPERATOR` | `academic` | Laporan → Perbaikan Sumber Data | R U | `academic.feedercode.update` | Perbaiki kode stat mahasiswa/akreditasi di sisi lokal, bukan di PDDIKTI |
| `PMB_OPERATOR` 🟡 | `pmb`* | PMB → Pendaftaran & Seleksi | C R U D | `pmb.cohort.manage`, `pmb.document.verify`, `pmb.selection.rank`, `.announce` | Kurasi jalur seleksi, verifikasi berkas, perankingan kuota prodi, pengumuman |
| `PMB_OPERATOR` 🟡 | `cbt`* | PMB → Ujian Seleksi | C R U | `cbt.session.schedule`, `cbt.proctor.log.view` | Jadwalkan sesi CBT, pantau log integritas peserta |
| `PMB_OPERATOR` 🟡 | `identity` | PMB → Akun Pendaftar | C R | `identity.user.create` (terbatas `APPLICANT`) | Provision akun pra-NIM; **tidak** boleh membuat role admin |
| `PMB_OPERATOR` 🟡 | `finance` | PMB → Biaya Pendaftaran | R | `finance.payment.view` | Verifikasi lunas biaya seleksi |
| `HR_BKD_OFFICER` 🟡 | `hr_bkd`* | SDM → Data Indik Pegawai | C R U | `hr.profile.manage` | NIDN/NUPTK/NIP, jabatan fungsional, riwayat kepegawaian (tabel `staff`) |
| `HR_BKD_OFFICER` 🟡 | `hr_bkd`* | SDM → BKD & SISTER | R C U | `hr.bkd.calc`, `hr.bkd.submit`, `hr.bkd.approve`, `hr.sister.sync` | Validasi 16 SKS (BR-A11) sebelum kirim SISTER |
| `HR_BKD_OFFICER` 🟡 | `academic` | SDM → Master Dosen | R U | `academic.lecturer.update` | Selaraskan induk dosen dengan data kepegawaian |
| `QUALITY_OFFICER` 🟡 | `spmi`* | Mutu → Standar & PPEPP | C R U D | `spmi.standard.manage` | Penetapan & pelaksanaan standar mutu internal |
| `QUALITY_OFFICER` 🟡 | `spmi`* | Mutu → AMI & CAPA | C R U | `spmi.audit.plan`, `.execute`, `spmi.capa.track` | Jadwalkan audit, rekam temuan, tutup tindak lanjut |
| `QUALITY_OFFICER` 🟡 | `spmi`* | Mutu → Ekspor Instrumen | R | `spmi.instrumen.export` | 9 kriteria BAN-PT / LAM-INFOKOM / LAM-PTKES langsung dari DB |
| `UNIT_CLEARANCE_OFFICER` 🟡 | `academic` | Akademik → Clearance Unit | R U | `academic.clearance.update` | Tanda `passed` Perpustakaan/Lab/Kemahasiswaan (BR-S4) — hanya dimensi unitnya |
| `UNIT_CLEARANCE_OFFICER` 🟡 | `academic` | Akademik → Cekal | C R D | `academic.blockade.create`, `.release` | Pasang/cabut cekal dimensi unit; wajib alasan + audit (BR-A7) |
| `UNIT_CLEARANCE_OFFICER` 🟡 | `graduation`* | Yudisium → Clearance Akhir | R | `thesis.clearance.view`, `graduation.verify` | Gerbang bebas tanggungan sebelum SK Yudisium |

### 6.3 Cluster Pengajaran

| Role | Modul | Menu | Aksi | Permission | Deskripsi |
|---|---|---|---|---|---|
| `LECTURER` | `teaching` | Pengajaran → Kelas Saya | R U | `teaching.roster.view`, `teaching.session.update` | Hanya kelas di `class_assignments` periode berjalan |
| `LECTURER` | `attendance` | Presensi → Sesi & QR | C R U | `attendance.qr.generate`, `attendance.record.create`, `attendance.summary.view` | QR rotasi 30 detik; koreksi dalam batas ubah presensi |
| `LECTURER` | `assessment` | Nilai → Input Nilai | C R U | `assessment.composition.view`, `grading.value.write`, `assessment.grade.publish`, `assessment.grade.lock` | Bobot harus 100% sebelum form terbuka (AC-NIL-4); kunci saat final |
| `LECTURER` | `assessment` | Nilai → Usul Koreksi | C | `assessment.correction.request` | Pasca-`LOCKED`: usul + alasan; persetujuan milik Kaprodi |
| `LECTURER` | `lms`* | Virtual Campus → Materi & Tugas | C R U D | `lms.material.*`, `lms.assignment.grade` | Sinkron kelas dari hasil KRS tanpa setup (AC-LMS-1) |
| `LECTURER` | `thesis`* | Skripsi → Logbook Bimbingan | C R U | `thesis.logbook.endorse` | Paraf digital per sesi |
| `LECTURER` | `hr_bkd`* | SDM → Portofolio & BKD | C R | `hr.portofolio.write`, `hr.bkd.submit` | Tridharma; auto-terisi dari presensi & kelas |
| `COORDINATOR` | `teaching` | Pengajaran → Koordinasi Kelas | C R U D | `teaching.class.update`, `teaching.assignment.update`, `teaching.waitlist.manage` | Usul jadwal pengganti, kelola antrean/auto-kelas (BR-A10) |
| `COORDINATOR` | `attendance` | Presensi → Koreksi Massal | U | `attendance.record.update` (massal ter-batch) | Presensi massal di-batch flush, bukan `FOR UPDATE` per request |
| `ADVISER` | `enrollment` | Akademik → Approval DPA | R C U | `enrollment.krs.view`, `.approve`, `.reject`, `.batchapprove` | ✅ halaman tersedia; daftar hanya mahasiswa bimbingan scope `PERIOD` |
| `ADVISER` | `academic` | Bimbingan → Status Wah | R | `academic.studentstatus.view`, `academic.transcript.view` | IPS & riwayat untuk memutuskan band SKS |
| `ADVISER` | `mbkm`* | MBKM → Persetujuan Activity | R U | `mbkm.application.approve`, `mbkm.conversion.request` | plafond 20 SKS (BR-M1) |
| `EXAMINER` | `thesis`* | Skripsi → Nilai Ujian | C U | `thesis.defense.grade.write` | Komponen ujian saja |
| `EXAMINER` | `assessment` | Nilai → Komponen Ujian | C R U | `grading.value.write` (komponen milik penguji) | Tidak bisa mempublikasikan/mengunci nilai akhir |
| `LAB_ASSIST` | `attendance` | Presensi → Lab | C R U | `attendance.record.create` (sesi lab) | Presensi praktikum |
| `LAB_ASSIST` | `assessment` | Nilai → Komponen Praktikum | C | `grading.value.write` (komponen) | **S**: nilai asisten masuk rekap setelah pengampu mengunci |
| `LAB_ASSIST` | `lms`* | Virtual Campus → Sesi Asisten | R U | `lms.progress.update` | Pantau watch-time untuk presensi online (BR-A13) |

### 6.4 Cluster Lingkung Diri

| Role | Modul | Menu | Aksi | Permission | Deskripsi |
|---|---|---|---|---|---|
| `STUDENT` | `identity` | Pengaturan → Profil & Keamanan | R U C D | `identity.profile.*`, `identity.session.revoke`, `identity.mfa.manage` | Reset password self-service, daftar perangkat aktif, cabut sesi |
| `STUDENT` | `enrollment` | Akademik → KRS Online | R C U D | `enrollment.krs.view`, `.submit`, `.withdraw`, `enrollment.waitlist.join/.leave` | ✅ submit & open-classes sudah ada; terkunci permanen pasca-submit (AC-KRS-5) |
| `STUDENT` | `attendance` | Presensi → Scan QR | U | `attendance.qr.scan` | ✅ Geofence Haversine ≤ radius; ditolak bila IP/R2/UA palsu |
| `STUDENT` | `assessment` | Akademik → KHS / Nilai | R | `assessment.grade.view`, `academic.transcript.view`, `academic.document.print` | ✅ KHS & transkrip; tertutup bila kuesioner belum diisi (BR-A8) |
| `STUDENT` | `academic` | Akademik → Jadwal Kuliah | R | `teaching.class.view`, `teaching.session.view` | Jadwal mingguan & sesi hari ini |
| `STUDENT` | `finance` | Keuangan → Tagihan & Bayar | R C | `finance.invoice.view`, `finance.installment.view`, `finance.waiver.request` | Status 4-keadaan; gerbang pembuka KRS (BR-A14) |
| `STUDENT` | `lms`* | Virtual Campus → Belajar | R C | `lms.material.view`, `lms.submission.submit`, `lms.forum.post` | Submit tugas & kuis |
| `STUDENT` | `thesis`* | Skripsi → Proposal & Logbook | C R U | `thesis.title.propose`, `thesis.logbook.write`, `thesis.seminar.register` | Syarat ≥100 SKS & IPK ≥2,50 diverifikasi otomatis (BR-S3) |
| `STUDENT` | `mbkm`* | MBKM → Daftar Kegiatan | C R | `mbkm.catalog.view`, `mbkm.application.submit` | Konversi maks 20 SKS |
| `STUDENT` | `graduation`* | Wisuda → Daftar & Legalisir | C R | `graduation.wisuda.register`, `graduation.legalisir.request`, `academic.transcript.view` | Kloter seremoni terpisah dari yudisium |
| `STUDENT` | `parent_portal`* | Profil → Tautan Orang Tua | C R D | `parent.link.create`, `.revoke`, `parent.consent.manage` | **Mahasiswa** yang memberi/cabut izin ortu |
| `ALUMNI` | `graduation`* | Alumni → Ijazah & Transkrip | R | `graduation.diploma.issue` (view), `academic.transcript.view` | Unduh ijazah digital + transkrip ber-TTE |
| `ALUMNI` | `graduation`* | Alumni → Legalisir | C R | `graduation.legalisir.request` | Ajukan online, pantau status |
| `ALUMNI` | `tracer_iku`* | Alumni → Tracer Study | C R U | `tracer.survey.respond`, `tracer.profile.update`, `tracer.employment.write` | Memenuhi IKU 1 |
| `GUARDIAN` 🟡 | `parent_portal`* | Portal Orang Tua → Pantau | R | `parent.student.view`, `parent.finance.view` | Presensi, nilai, tagihan anak tertaut; read-only |
| `GUARDIAN` 🟡 | `parent_portal`* | Portal Orang Tua → Tautan | C R D | `parent.link.manage`, `parent.consent.manage` | Minta/putus tautan; persetujuan bisa dicabut mahasiswa/aturan prodi |
| `APPLICANT` 🟡 | `pmb`* | Pendaftaran → Aplikasi Saya | C R U | `pmb.application.create/.update`, `pmb.document.upload` | Berkas ditolak wajib disertai alasan jelas |
| `APPLICANT` 🟡 | `finance` | Pendaftaran → Biaya Seleksi | R C | `finance.payment.view`, `pmb.payment.pay` | VA/QRIS biaya pendaftaran |
| `APPLICANT` 🟡 | `cbt`* | Pendaftaran → Ujian Seleksi | C R | `cbt.exam.start`, `cbt.exam.submit` | Proteksi fullscreen, auto-grading instan |
| `APPLICANT` 🟡 | `pmb`* | Pendaftaran → Pengumuman | R | `pmb.selection.view` | Status lolos & instruksi registrasi ulang |

---

## 7. Aturan Lintas-Role yang Menentukan Desain

### 7.1 Pemisahan tugas (*segregation of duties*)

| Aturan | Pencegahan | Ditegakkan di |
|---|---|---|
| Pemohon `finance.invoice.void` ≠ penyetuju — `ADMIN_FINANCE` mengajukan, `TREASURER` menyetujui | Tagihan dibatalkan sendiri oleh pencatatnya | Grant kedua role ini **mutually exclusive** saat assignment + dual-approval di service (BR-K2, AC-KEU-3) |
| `grading.value.write` (dosen) ≠ `grading.unlock` (Kaprodi) | Nilai "titipan" & koreksi senyap | `assessment.correction.*` workflow + audit (BR-G4) |
| `identity.assignment.grant` butuh approval orang kedua (`access_change_requests`) | Admin jahat menaikkan hak sendiri | Empat-mata + `audit_logs` (FR-ADM-06) |
| `feeder.period.send` hanya setelah `diff` di-approve | Feeder merusak data produksi | Append-log + approval sebelum kirim (SECURITY §5) |
| `finance.gate.override` selalu ber-audit + alasan | Bypass gerbang keuangan | Tidak ada jalur "buka KRS" tanpa approval (A04) |
| DPO/auditor tidak punya permission tulis apa pun | Bukti audit bisa dimanipulasi | `audit.log.view` read-only (AC-AUD-1) |

### 7.2 Multi-role & pemilih role saat login

Satu orang boleh memegang beberapa role sekaligus (Dosen Pengampu + Kaprodi + Pembimbing) — **PRD §3 catatan penentu desain**. Konsekuensinya:

1. Login menghasilkan *daftar* assignment, lalu **role selector** (`rc` = active role context di JWT klaim) — FR-IDT-02.
2. `role_ctx` di-**issue ulang** setiap login dan setiap kali assignment berubah; `valid_to` ditegakkan di guard (mitigasi privilege escalation, SECURITY A01).
3. Menu, dashboard, dan endpoint domain disusun dari `rc` aktif — bukan dari gabungan semua role. Campur-role hanya untuk permission-check agregat ("boleh tidak user ini sama sekali").
4. `LAB_ASSIST`/`EXAMINER`/`COORDINATOR` **tidak** membuat role baru di enum; mereka atribut `class_assignments.role_in_class` pada assignment `LECTURER` — hak kelas mana yang dapat ditulis disaring dari kolom itu.

### 7.3 Predikat ABAC yang memotong setelah permission

Permission hanya menjawab "boleh aksi ini?". Empat predikat berikut tetap bisa menolak `403`:

| Predikat | Sumber | Aturan |
|---|---|---|
| **Status periode** | `academic_periods.status`, `academic_rules` | Periode `CLOSED` → semua operasi tulis blokir (BR-A9); jendela OW & deadline nilai H+N (BR-G1) |
| **Gerbang keuangan** | `academic_rules.gates`, `invoices.status` | Tagihan belum `LUNAS`/tanpa dispensasi → KRS/KHS/kartu ujian/semester antara/yudisium ditahan (FR-KEU-06, BR-A14) |
| **Cekal per jenis** | `blockades` | Akademik/Keuangan/Perpustakaan/Kemahasiswaan menahan aksi terkait sampai dicabut unit pemilik (BR-A7) |
| **Ambang presensi** | `attendances` rekap | Hadir <75% → kartu ujian tidak terbit & entri nilai akhir terkunci (BR-A15) |

### 7.4 Aturan perlindungan PII per role

| Data | Yang boleh lihat | Larangan |
|---|---|---|
| Biodata & kontak mahasiswa | `STUDENT` (diri), `ADVISER`/`ADMIN_ACADEMIC`/`ADMIN_FINANCE` (scope tugas) | Tidak ada endpoint pencarian lintas mahasiswa; lookup butuh relasi kelas/prodi (SECURITY §5) |
| NIK/NIP, rekening, data sensitif | Hanya role dengan permission modul + field-level encryption | Tidak pernah tampil penuh di log/UI |
| Data ortu/wali (`student_guardians`) | `GUARDIAN` via tautan + consent; `STUDENT` atas tautannya | Ijazah/transkrip tidak otomatis terbuka ke ortu |
| Nilai/tagihan per-record vs agregat | `LEADER`, `COMPLIANCE_OFFICER` hanya agregat | `A` ≠ `B`: eksekutif tidak boleh query per-NIM |
| Ekspor massal | `academic.export.bulk`, `finance.report.view` + izin khusus | Wajib audit kolom & volume; dosen tidak bisa sedot satu angkatan |

### 7.5 Urutan penyiapan semester (dependensi antar role)

```
TENANT_ADMIN  → Tahun Akademik → Periode
ADMIN_ACADEMIC→ Pengaturan Prodi & Aturan → Ruang
HEAD_OF_PROGRAM→ Kelas Paralel → Dosen Pengampu/Koordinator
ADMIN_ACADEMIC→ Generate Sesi (kalender libur) 
ADVISER       → Penugasan Dosen PA → (mahasiswa boleh isi KRS)
```

Menu tahap berikutnya **tidak boleh** terbuka sebelum tahap sebelumnya lengkap — ini yang membuat "Alur Penataan Tahun Ajaran Baru" (PRD §5.4) gagal di SIAKAD konvensional.

---

## 8. Status Implementasi vs Dokumen

### 8.1 Yang sudah berjalan di kode hari ini

| Komponen | Lokasi | Status |
|---|---|---|
| Enum 5 role per-tenant | [enums.ts:21-27](file:///C:/SICA/packages/database/src/schema/enums.ts#L21-L27), [migrations/0006](file:///C:/SICA/packages/database/migrations/0006_member_role.sql) | ✅ berjalan |
| Klaim `role` pada JWT terverifikasi | [api-response.ts:49-72](file:///C:/SICA/apps/web/src/lib/api-response.ts#L49-L72) | ✅ fail-closed |
| Gerbang entitlement modul + graf dependensi | [lib/entitlement.ts:125-135](file:///C:/SICA/apps/web/src/lib/entitlement.ts#L125-L135) | ✅ teruji unit |
| Rute aktivasi/deaktivasi modul | [tenant/modules/[code]/activate](file:///C:/SICA/apps/web/src/app/api/v1/tenant/modules/%5Bcode%5D/activate/route.ts) | 🟡 gating lemah (lihat §8.2 G-01) |
| Submit KRS | [krs/submit/route.ts](file:///C:/SICA/apps/web/src/app/api/v1/academic/krs/submit/route.ts) | 🟡 cek profil mahasiswa, belum `enrollment.krs.submit` |
| Approval KRS DPA | [krs/approve/route.ts:30-35](file:///C:/SICA/apps/web/src/app/api/v1/academic/krs/approve/route.ts#L30-L35) | 🟡 `TODO` verifikasi role ADVISER |
| Input nilai | [grading/route.ts:71](file:///C:/SICA/apps/web/src/app/api/v1/academic/grading/route.ts#L71) | 🟡 cek "pengampu atau administrator" ad-hoc |
| Generate / scan QR presensi | [qr/generate](file:///C:/SICA/apps/web/src/app/api/v1/attendance/qr/generate/route.ts), [qr/scan](file:///C:/SICA/apps/web/src/app/api/v1/attendance/qr/scan/route.ts) | 🟡 belum ada guard `attendance.qr.*` |
| Dashboard per role | [dashboard.service.ts:197-293](file:///C:/SICA/apps/web/src/modules/academic/services/dashboard.service.ts#L197-L293) | ✅ cabang mahasiswa/dosen/admin |
| Tabel `roles`/`permissions`/`role_permissions`/`user_role_assignments` | [DATA_MODEL.md:283-320](file:///c:/SICA/docs/DATA_MODEL.md#L283-L320) | ❌ **belum ada migrasi** |
| `packages/domain/src/authz/permissions.ts` (katalog `PERM`) | — | ❌ paket belum dibuat (baru `contracts`, `database`, `logger`) |

### 8.2 Celah yang harus ditutup (diurutkan risiko)

| ID | Celah | Bahaya | Perbaikan |
|---|---|---|---|
| **G-01** | [`isAdminRole`](file:///C:/SICA/apps/web/src/modules/entitlement/guards.ts#L6-L12) mencocokkan **substring** `admin`/`operator`/`super`/`leader` dari klaim JWT | Role kustom bernama misalnya `operator_magang_readonly` otomatis dapat hak aktivasi modul → privilege escalation senyap | Ganti ke perbandingan **enum eksak** terhadap role codes §2 + cek `role_permissions` `entitlement.module.activate` |
| **G-02** | 22 role desain hidup di 5 nilai enum | 9 role administratif tak terbedakan; laporan hak akses tidak bisa diaudit | Migrasi `roles` + `user_role_assignments`; enum `member_role` jadi ringkas (kluster) saja |
| **G-03** | Permission hanya 7 kode vs ~160 aksi di §4 | Otorisasi ad-hoc per service, tidak ada matriks dapat-diaudit | Terbitkan katalog `PERM` penuh dari §4 + seed `permissions`/`role_permissions` |
| **G-04** | Scope (prodi/kelas/periode) belum ditegakkan lewat assignment | Dosen secara teori dapat membaca dan menulis data lintas kelas bila service lupa cek relasi | Guard membaca `scope_*` + `valid_to`; CI fixture 2 tenant wajib 404 |
| **G-05** | Menu tidak disaring dari `tenant_modules` — [top-nav.tsx:89-112](file:///C:/SICA/apps/web/src/components/layout/top-nav.tsx#L89-L112) statis | Kampus bisa membuka menu modul yang tidak dibeli → pelanggaran PRD §5.7 "nol akses menu modul tak dibeli" | `GET /tenant/modules` → filter nav Web & bottom-nav Mobile (ROADMAP baris sidebar) |
| **G-06** | `GUARDIAN`, `APPLICANT`, `ALUMNI`, dan 6 role 🟡 lainnya tidak punya wadah di enum | Modul `parent_portal`/`pmb` & persona PRD tak bisa dilayani walau dijual | Masuk ke migrasi `roles`; atau perluasan enum eksplisit |
| **G-07** | Tidak ada MFA enforcement per role di kode (FR-IDT-01: MFA untuk semua peran tulis-admin) | Akun admin terkompromi = damage maksimal | Guard `identity.mfa.manage` pada semua aksi `INSERT/UPDATE/DELETE/VALIDATE` role R-01…R-09, R-15, R-16 |
| **G-08** ~~EdDSA vs RS256~~ | **CLOSED 2026-10-19** — `.cursor/rules/02-security.mdc` sudah disinkron ke **RS256** sesuai AUD-11 ([SECURITY_COMPLIANCE.md:80](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md#L80)) dan implementasi `jwt.service.ts`/`jwt-edge.ts` | — (lihat §11 poin 6) | — |
| **G-09** | `permissions` belum punya kolom `resource` + `verb` ([DATA_MODEL §14.4](file:///c:/SICA/docs/DATA_MODEL.md), FR-IDT-04) | Layar matriks izin tidak bisa merender menu × 6 aksi × scope; audit hak akses jadi daftar kode yang tidak terstruktur | Tambah 2 kolom + enum `permission_verb` saat migrasi (ADM-8) |
| **G-10** | Katalog 19 modul belum mencakup `litabmas`, `documents`/`persuratan` + `esign`, `kerjasama` (dicatat di [PRD §5.8](file:///c:/SICA/docs/PRD.md)) | Persona `Admin LPPM`/`Reviewer`/persuratan akademik tidak punya modul → permission-nya menggantung ke `academic.document.*` | Putuskan produk: tambah `MODULE_CODES` baru (perlu migrasi katalog + grid §5) atau lipat ke `documents` di bawah `academic` |

### 8.3 Rencana implementasi bertahap

| Tahap | Pekerjaan | Validasi |
|---|---|---|
| **1. Skema** | Migrasi expand-only `roles`, `permissions`, `role_permissions`, `user_role_assignments` (+ RLS generator untuk 3 tabel tenant-scoped; `permissions` global → pengecualian tercatat di §3.1) | `EXPLAIN (ANALYZE, BUFFERS)` + tes RLS `NOBYPASSRLS` |
| **2. Katalog** | `packages/domain/src/authz/permissions.ts` dari §4; compile Zod→OpenAPI agar Dart ikut (guardrail §3.4) | Unit test 1:1 jumlah kode vs tabel `permissions` |
| **3. Seed** | Perbaiki [DATA_MODEL.md §9](file:///c:/SICA/docs/DATA_MODEL.md#L1039-L1058): 22 role (kode `TREASURER` menggantikan `'FINANCE approver'` yang berisi spasi) + grant §6 dalam transaksi tunggal | Query verifikasi §8 DATA_MODEL |
| **4. Guard** | `RequiresPermission(PERM.x)` di semua rute §8.1 berstatus 🟡; hapus `isAdminRole` substring (G-01) | Suite regresi 2 tenant → 100% `404` |
| **5. Nav** | Sidebar/top-nav & bottom-nav disaring `tenant_modules` × role | Snapshot test menu per role |
| **6. Selector** | Multi-role picker saat login + re-issue `rc` (FR-IDT-02) | Tes eskalasi-hak saat assignment dicabut |

---

## 9. Pemetaan Nama dari Dokumen Lain (agar tidak ada yang tertinggal)

### 9.1 Persona PRD §3 → role resmi

| Persona PRD | Role resmi | Catatan |
|---|---|---|
| Mahasiswa | `STUDENT` | 94% populasi |
| Dosen Pengampu | `LECTURER` | + atribut `COORDINATOR`/`LAB_ASSIST` per kelas |
| Dosen PA / Pembimbing Akademik | `ADVISER` | scope `PERIOD` |
| Kaprodi | `HEAD_OF_PROGRAM` | scope `PROGRAM` |
| Admin Akademik (BAAK) | `ADMIN_ACADEMIC` | |
| Admin Keuangan / Bendahara | `ADMIN_FINANCE` + `TREASURER` | PRD menggabung; SICA memisah untuk dual-approval void |
| Operator Feeder PDDIKTI | `FEEDER_OPERATOR` | BR-R11/R19 |
| Pimpinan (Rektor/Warek/Dekan) | `LEADER` | read + approve + e-sign |
| Platform Operator SICA | `PLATFORM_OPERATOR` | enum `super_admin` |
| Alumni | `ALUMNI` | |
| Pendaftar (CBT/PMB) | `APPLICANT` | |
| *(tidak ada di PRD)* | `TENANT_ADMIN`, `PMB_OPERATOR`, `HR_BKD_OFFICER`, `QUALITY_OFFICER`, `UNIT_CLEARANCE_OFFICER`, `COMPLIANCE_OFFICER`, `GUARDIAN`, `EXAMINER` | Diangkat dari DATA_MODEL §9, modul add-on, FR-P2, cekal/clearance, UU PDP, dan `role_in_class` |

### 9.2 Nilai enum → role resmi (peta transisi)

| enum `member_role` | Role resmi yang diwadahi |
|---|---|
| `super_admin` | `PLATFORM_OPERATOR` |
| `tenant_admin` | `TENANT_ADMIN` (+ `ADMIN_ACADEMIC`, `ADMIN_FINANCE`, `LEADER` bila belum ada tabel role) |
| `dosen` | `LECTURER`, `COORDINATOR`, `ADVISER`, `EXAMINER`, `HEAD_OF_PROGRAM`, `LAB_ASSIST` |
| `mahasiswa` | `STUDENT` |
| `staff` | `ADMIN_ACADEMIC`, `ADMIN_FINANCE`, `TREASURER`, `FEEDER_OPERATOR`, `PMB_OPERATOR`, `HR_BKD_OFFICER`, `QUALITY_OFFICER`, `UNIT_CLEARANCE_OFFICER`, `COMPLIANCE_OFFICER` |

### 9.3 Label katalog landing (`id.json`) → role resmi

| Label UI | Role |
|---|---|
| `mahasiswa` | `STUDENT` |
| `dosen` | `LECTURER` (+ `ADVISER`, `COORDINATOR`, `EXAMINER`) |
| `baak` | `ADMIN_ACADEMIC` (+ `TENANT_ADMIN`) |
| `pimpinan` | `LEADER` |
| `ortu` | `GUARDIAN` |

### 9.4 Grup menu Sevima → modul & role pemilik SICA

| Menu Sevima | Modul SICA | Role pemilik utama |
|---|---|---|
| Profil akademik | `academic` | `ADMIN_ACADEMIC` |
| Kohort | `academic` (angkatan/periode) | `ADMIN_ACADEMIC` |
| Program reguler/KLS/pascasarjana | `academic.program` (jenjang) | `TENANT_ADMIN` |
| KRS | `enrollment` | `STUDENT` (submit) · `ADVISER` (approve) |
| Unit akademik | `academic.organization` | `TENANT_ADMIN` |
| Status mahasiswa | `academic.studentstatus` | `ADMIN_ACADEMIC` · `STUDENT` (ajukan) |
| Event akademik | `academic.calendar` + `graduation` | `ADMIN_ACADEMIC` · `LEADER` (SK) |
| Jadwal ujian | `teaching.session` + `assessment.examcard` | `COORDINATOR` · `EXAMINER` |
| Transkrip nilai | `assessment` + `academic.transcript` | `LECTURER` (tulis) · `ADMIN_ACADEMIC` (terbit) |
| Kurikulum program studi | `academic.curriculum` | `HEAD_OF_PROGRAM` |
| Dokumen | `academic.document` + `graduation` | `ADMIN_ACADEMIC` · `ALUMNI` (ajukan) |
| Status mata kuliah dosen | `hr_bkd` + `teaching.assignment` | `HR_BKD_OFFICER` · `HEAD_OF_PROGRAM` |
| Feeder PDDikti | `feeder_pddikti` | `FEEDER_OPERATOR` |
| Yudisium | `graduation` | `HEAD_OF_PROGRAM` (usul) · `LEADER` (sahkan) · `UNIT_CLEARANCE_OFFICER` (clearance) |

---

## 10. Rujukan Silang & Riwayat

| Dokumen | Yang berubah karena matriks ini |
|---|---|
| [`DATA_MODEL.md`](file:///c:/SICA/docs/DATA_MODEL.md) §9 | Seed 10 → 22 role; kode `'FINANCE approver'` dinormalisasi `TREASURER`; tambah `permissions` seed dari §4 |
| [`SECURITY_COMPLIANCE.md`](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md) §3 | Katalog `PERM` 7 kode → rujukan ke §4; tambah rujukan matriks |
| [`AGENTS.md`](file:///c:/SICA/AGENTS.md) §2 | Dokumen ke-19 ditambahkan ke peta rujukan + kategori tugas "Otorisasi & Hak Akses" |
| [`INDEX.md`](file:///c:/SICA/docs/INDEX.md) §1 | Baris dokumen baru |
| [`ROADMAP_TASKS.md`](file:///c:/SICA/docs/ROADMAP_TASKS.md) | Tugas G-01…G-08 masuk backlog |
| [`.cursor/rules/02-security.mdc`](file:///c:/SICA/.cursor/rules/02-security.mdc) | G-08 (EdDSA → RS256) + rujukan matriks |

**Riwayat**

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 2026-10-19 | Katalog 22 role, ~160 permission, matriks Role × Modul × Menu × Aksi CRUD, aturan ABAC/SoD/PII, dan pendaftaran 8 celah implementasi (G-01…G-08). |
| 1.1 | 2026-10-19 | §11 Rekonsiliasi dengan dokumen Area Admin baru ([BENCHMARK_SEVIMA.md](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md), [PRD §5.8](file:///c:/SICA/docs/PRD.md), [DATA_MODEL §14](file:///c:/SICA/docs/DATA_MODEL.md), [API_SPEC §4.6](file:///c:/SICA/docs/API_SPEC.md), [UI_UX_DESIGN §9](file:///c:/SICA/docs/UI_UX_DESIGN.md), [SECURITY_COMPLIANCE §3.3](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md)): pemetaan 15 peran tampilan ↔ 22 peran normatif, pemetaan kosakata aksi `VALIDATE↔approve`, kepemilikan menu, ikatan celah ke Slice ADM-1/ADM-8, dan **G-08 dinyatakan CLOSED** (rule Cursor disinkron ke RS256). Dokumen didaftarkan sebagai **#19** di [AGENTS.md](file:///c:/SICA/AGENTS.md) §2.2 & [INDEX.md](file:///c:/SICA/docs/INDEX.md) §1. |
| 1.2 | 2026-10-19 | Kosakata aksi kanonik dijadikan eksplisit di §1.2 (tabel pemetaan `READ/INSERT/UPDATE/DELETE/VALIDATE/OTHER` → verba kode §4, dengan larangan `OTHER` sebagai sisa). §2.2 & §6.2 & §7.1 diralat agar **BR-K2 benar arah**: `ADMIN_FINANCE` = pemohon void/keringanan, `TREASURER` = penyetuju (`VALIDATE`), grant keduanya *mutually exclusive*. §3.1 menambah keharusan kolom `permissions.resource` + `permissions.verb` dan mendaftarkan celah **G-09** di §8.2; klaim `rc` ditambahkan pada langkah resolusi §3.2; penegasan bahwa §4 adalah satu-satunya sumber string permission. |

*Matriks ini adalah sumber kebenaran hak akses. Endpoint, menu, dan seed role baru wajib dirujuk ke sini sebelum didokumentasikan di tempat lain.*


---

## 11. Rekonsiliasi dengan dokumen Admin & benchmark (2026-10-19)

Dokumen ini tetap **sumber kebenaran hak akses**. Dokumen Area Admin yang baru saja ditulis wajib membaca aturan di sini lebih dulu, dan hal-hal berikut disepakati agar tidak ada dua norma yang bertabrakan:

| # | Titik temu | Keputusan |
|---|---|---|
| 1 | **Katalog peran** | [BENCHMARK_SEVIMA.md §3](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md) hanya memuat **15 peran tampilan** untuk keperluan pemetaan menu; katalog normatif tetap **22 peran** di §2 di sini. Nama singkat di dokumen benchmark dipetakan: `super_admin`→`PLATFORM_OPERATOR`, `admin`→`TENANT_ADMIN`/`ADMIN_ACADEMIC`, `kaprodi`→`HEAD_OF_PROGRAM`, `dosen`→`LECTURER`(+`COORDINATOR`/`LAB_ASSIST`/`EXAMINER` per kelas), `dosen_wali`→`ADVISER`, `operator_feeder`→`FEEDER_OPERATOR`, `keuangan`/`keuangan_approver`→`ADMIN_FINANCE`/`TREASURER`, `pimpinan`→`LEADER`, `mahasiswa`→`STUDENT`, `pendaftar`→`APPLICANT`, `ortu`→`GUARDIAN`, `alumni`→`ALUMNI`, `staff`→`HR_BKD_OFFICER`/`UNIT_CLEARANCE_OFFICER`, `auditor_mutu`→`QUALITY_OFFICER`/`COMPLIANCE_OFFICER`. |
| 2 | **Kosakata aksi** | Kode permission di §4 memakai pola `modul.sumber.aksi` (`create/read/update/delete/approve`). **`approve` adalah padanan dari `VALIDATE`** yang diadopsi dari model Sevima ([SECURITY_COMPLIANCE §3.3](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md), [DATA_MODEL §14.4](file:///c:/SICA/docs/DATA_MODEL.md), [PRD `FR-IDT-04`](file:///c:/SICA/docs/PRD.md)). Pemetaan resmi: `INSERT↔create`, `READ↔read`, `UPDATE↔update`, `DELETE↔delete`, `VALIDATE↔approve`, `OTHER↔` aksi terdaftar eksplisit (`generate`, `period.transition`, `feeder.push`, `impersonate`). **Satu-satunya sumber kode string = §4 dokumen ini**; tabel `permission_verb` di DATA_MODEL hanya enum lapisan transport. |
| 3 | **Kepemilikan menu Admin** | Pohon rute `/admin/**` di [BENCHMARK_SEVIMA §4.1](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md) dan [UI_UX_DESIGN §9](file:///c:/SICA/docs/UI_UX_DESIGN.md) adalah **tampilan**; siapa yang boleh membukanya ditentukan oleh §6 matriks di dokumen ini. Item menu tanpa baris permission di §4 **tidak boleh dibuat**. |
| 4 | **4 lapis penegakan rute `/admin/*`** | Sama dengan §3.2 dokumen ini (guard kasar + service halus); API_SPEC §4.6 hanya memformalkan urutan pemanggilannya. Tidak menambah mekanisme otorisasi baru. |
| 5 | **Celah yang menjadi pekerjaan ADM-1** | `G-01` (substring `isAdminRole`), `G-02` (22 peran di 5 enum), `G-03` (7 kode permission vs ~160), `G-04` (scope belum ditegakkan), `G-05` (menu tak disaring entitlement), `G-06` (role 🟡 tanpa wadah), `G-07` (MFA per role belum ditegakkan) — semua ditutup di **Slice ADM-1/ADM-8** ([ROADMAP §2.5.1 & §2.5.8](file:///c:/SICA/docs/ROADMAP_TASKS.md)). |
| 6 | **`G-08` (EdDSA vs RS256)** | **CLOSED 2026-10-19** — `.cursor/rules/02-security.mdc` §3.2 telah disinkronkan ke **RS256**, konsisten dengan `SECURITY_COMPLIANCE.md` AUD-11 dan `jwt.service.ts`/`jwt-edge.ts`. |

**Verifikasi klaim sebelum adopsi (bukan salin-bulat):** `G-01` dikonfirmasi di [apps/web/src/modules/entitlement/guards.ts:6-11](file:///C:/SICA/apps/web/src/modules/entitlement/guards.ts#L6-L11) (`ADMIN_TOKENS.some(token => normalized.includes(token))` — pencocokan substring nyata); `G-08` dikonfirmasi di `.cursor/rules/02-security.mdc:103` sebelumnya menulis "JWT EdDSA"; Approval KRS masih `TODO` verifikasi role di [krs/approve/route.ts:31](file:///C:/SICA/apps/web/src/app/api/v1/academic/krs/approve/route.ts#L31) (konsisten dengan status `[~]` ROADMAP §2.3).

---

<!-- SICA-47:BEGIN enterprise-47 -->

## 12. Perluasan Enterprise: Role Baru & Matriks 47 Modul (dikunci 2026-10-20)

### 12.1 Role Tambahan

22 role §2 tetap berlaku. Role berikut ditambahkan (seed `roles.is_system = true`; tenant dapat membuat role kustom turunan via M-03):

| Kode | Label | Scope | Profil dashboard |
|---|---|---|---|
| `IT_ADMIN` | Admin IT Kampus | tenant | `ADMIN_IT` |
| `DEAN` | Dekan | fakultas | `PIMPINAN_AKADEMIK` |
| `HR_ADMIN` | Admin HRD | tenant | `STAF_OPERASIONAL` |
| `EMPLOYEE` | Pegawai/Tendik | self | — (modul ber-izin) |
| `BKD_ASSESSOR` | Asesor BKD | penugasan | `DOSEN` |
| `LPPM_ADMIN`, `GRANT_REVIEWER` | Admin LPPM, Reviewer hibah | tenant / penugasan | — |
| `MARKETING_PMB`, `PMB_AGENT`, `SCHOOL_COUNSELOR` | Tim Marketing, Agen/Mitra PMB, Guru BK SMA | tenant / self (eksternal) | — |
| `SCHOLARSHIP_ADMIN` | Admin Beasiswa | tenant | `STAF_OPERASIONAL` |
| `PROCUREMENT_COMMITTEE`, `PPK_OFFICER`, `VENDOR` | Panitia PBJ, PPK, Vendor | tenant / self (eksternal) | `STAF_OPERASIONAL` (internal) |
| `SCHEDULER`, `LAB_STAFF`, `SARPRAS_ADMIN`, `ASSET_ADMIN` | Penjadwal BAAK, Laboran, Admin Sarpras, Admin BMN | tenant/org | `STAF_OPERASIONAL` |
| `INVIGILATOR`, `THESIS_SUPERVISOR` | Pengawas ujian, Pembimbing TA | kelas / penugasan | `DOSEN` |
| `JOURNAL_MANAGER`, `IPR_MANAGER` | Pengelola Jurnal, Pengelola HAKI | tenant | — |
| `GRADUATION_COMMITTEE` | Panitia Wisuda | tenant | `STAF_OPERASIONAL` |
| `STUDENT_AFFAIRS_ADMIN` | Admin Kemahasiswaan | tenant | — |
| `FIELD_SUPERVISOR`, `PARTNER_MENTOR`, `MBKM_SUPERVISOR` | DPL, Pembimbing Mitra, Pembimbing MBKM | penugasan / eksternal | `DOSEN` (internal) |
| `ALUMNI_ADMIN`, `CAREER_ADMIN`, `EMPLOYER` | Admin Alumni, Admin Karir, Mitra Perusahaan | tenant / eksternal | — |
| `INTL_OFFICE_ADMIN` | Admin KUI | tenant | — |
| `ENDOWMENT_MANAGER`, `DONOR` | Pengelola Dana Abadi, Donatur | tenant / self | — |
| `LIBRARIAN`, `CLINIC_DOCTOR`, `COUNSELOR`, `DORM_MANAGER`, `PR_EVENT_ADMIN`, `EVENT_PARTICIPANT` | Pustakawan, Dokter, Konselor, Pengelola Asrama, Humas, Peserta event | tenant / self | — |
| `PPKS_TASKFORCE`, `PPKS_REPORTER` | Satgas PPKS, Pelapor (anonim) | tenant / anonim | — |
| `INTERNAL_AUDITOR` | Auditor Mutu Internal | penugasan | — |
| `ALL_USERS`, `PUBLIC` | pseudo-role: setiap user terautentikasi / anonim | — | — |

Role tanpa profil seed memperoleh dashboard dari modul yang ber-izin READ (PRD §10.3).

### 12.2 Pemetaan Nama Role di Instruksi → Kode

Super Admin → `PLATFORM_OPERATOR`; Admin IT → `TENANT_ADMIN`/`IT_ADMIN`; Security Auditor → `COMPLIANCE_OFFICER`; BAAK → `ADMIN_ACADEMIC`/`SCHEDULER`; BAUK → `ADMIN_FINANCE`/`TREASURER`; Rektorat → `LEADER`; Kaprodi → `HEAD_OF_PROGRAM`; Dosen Wali/DPA → `ADVISER`; Dosen Penguji → `EXAMINER`; Admin PDDikti → `FEEDER_OPERATOR`; Admin PMB → `PMB_OPERATOR`; Camaba → `APPLICANT`; LPM → `QUALITY_OFFICER`; Admin Kepegawaian → `HR_BKD_OFFICER`.


### 12.3 Matriks Ringkas Role × Modul (huruf aksi)

| Role | Modul & aksi |
|---|---|
| `ADMIN_ACADEMIC` | M-02: R; M-12: RX; M-13: RUXLKPT; M-14: RAX; M-15: CRUDXLKPT; M-16: RX; M-17: RX; M-18: RUXKPT; M-19: RXPT; M-23: RAX; M-30: CRUDXLKPT; M-33: RA; M-34: R; M-35: CRUAXLP |
| `ADMIN_FINANCE` | M-06: RAJXL; M-09: R; M-10: CRUDAJXLPT; M-11: RX; M-40: RX; M-42: RX; M-44: RAJX; M-46: RAX; M-47: RAJX |
| `ADVISER` | M-13: RUAJX; M-18: R; M-24: R; M-26: RX |
| `ALL_USERS` | M-04: CRU |
| `ALUMNI` | M-27: CRU; M-28: CR |
| `ALUMNI_ADMIN` | M-27: CRUDXPT |
| `APPLICANT` | M-09: CRU |
| `ASSET_ADMIN` | M-40: CRUDAJXLKPT |
| `BKD_ASSESSOR` | M-07: RAJX |
| `CAREER_ADMIN` | M-28: CRUDAJXPT |
| `CLINIC_DOCTOR` | M-41: CRUXK |
| `COMPLIANCE_OFFICER` | M-01: RX; M-02: RX; M-03: RX; M-05: RAJXP; M-10: RX |
| `COORDINATOR` | M-16: CRUX |
| `COUNSELOR` | M-41: CRU |
| `DEAN` | M-07: RX; M-12: RAJXK; M-13: R; M-19: RX; M-20: R; M-25: R; M-30: RAJX; M-31: RAX; M-32: RX; M-37: R; M-38: R; M-44: RX |
| `DONOR` | M-47: CR |
| `DORM_MANAGER` | M-42: CRUDAJXPT |
| `EMPLOYEE` | M-06: CR |
| `EMPLOYER` | M-28: CRU |
| `ENDOWMENT_MANAGER` | M-47: CRUDXPT |
| `EVENT_PARTICIPANT` | M-43: CR |
| `EXAMINER` | M-20: RU |
| `FEEDER_OPERATOR` | M-34: CRUDAJXLKPT; M-35: CRUX |
| `FIELD_SUPERVISOR` | M-25: RUAJL |
| `GRADUATION_COMMITTEE` | M-23: CRUDAXLKPT |
| `GRANT_REVIEWER` | M-44: RU |
| `HEAD_OF_PROGRAM` | M-07: RAJX; M-12: CRUDAJXLPT; M-13: RX; M-14: R; M-19: RAJXK; M-20: CRUAJXLKPT; M-25: RX; M-26: RXP; M-29: RAJ; M-31: CRUX; M-37: RU; M-38: CRUDAJXLKPT; M-44: RX |
| `HR_ADMIN` | M-06: CRUDAJXLKPT |
| `HR_BKD_OFFICER` | M-07: RXLKPT; M-08: CRUXPT |
| `INTERNAL_AUDITOR` | M-37: CRU |
| `INTL_OFFICE_ADMIN` | M-29: CRUDAJXPT |
| `INVIGILATOR` | M-17: RUAJLK |
| `IPR_MANAGER` | M-22: CRUDAJXPT |
| `IT_ADMIN` | M-02: CRUDXPT; M-03: CRUDXT; M-04: CRUDAJXLKPT; M-05: RX; M-34: RXP; M-35: R; M-40: CRU; APP: RLKPT |
| `JOURNAL_MANAGER` | M-21: CRUDAJXPT |
| `LAB_STAFF` | M-14: CRU |
| `LEADER` | M-06: RX; M-07: RX; M-09: RX; M-10: RX; M-11: RX; M-22: RX; M-24: RX; M-27: RX; M-29: RX; M-31: RX; M-32: RXP; M-35: A; M-36: RX; M-37: RX; M-44: RAX; M-45: RX; M-47: RAJX |
| `LECTURER` | M-06: CR; M-07: CRUX; M-08: R; M-12: CRU; M-13: R; M-14: R; M-15: RU; M-16: CRUDXPT; M-17: CRUDAJXPT; M-18: CRUAJXL; M-19: CRUXL; M-21: CR; M-22: CR; M-39: R; M-44: CRUX; APP: CR |
| `LIBRARIAN` | M-20: RX; M-30: RAJ; M-39: CRUDAJXPT |
| `LPPM_ADMIN` | M-21: RX; M-25: CRUDAJXLKPT; M-44: CRUDAJXLKPT |
| `MARKETING_PMB` | M-09: R; M-45: CRUDAJXPT |
| `MBKM_SUPERVISOR` | M-38: RUA |
| `PARTNER_MENTOR` | M-25: CRU |
| `PLATFORM_OPERATOR` | M-01: CRUDAJXLKPT; M-05: R |
| `PMB_AGENT` | M-45: CRU |
| `PMB_OPERATOR` | M-09: CRUDAJXLKPT; M-45: R |
| `PPKS_REPORTER` | M-36: CR |
| `PPKS_TASKFORCE` | M-36: CRUAJXLKP |
| `PPK_OFFICER` | M-46: RAJXLK |
| `PROCUREMENT_COMMITTEE` | M-10: R; M-46: CRUDXPT |
| `PR_EVENT_ADMIN` | M-43: CRUDAJXPT |
| `PUBLIC` | M-35: R |
| `QUALITY_OFFICER` | M-12: RX; M-27: RX; M-31: CRUDAXLKPT; M-32: CRUXPT; M-37: CRUDAJXLKPT |
| `SARPRAS_ADMIN` | M-33: CRUDXLKPT; M-40: CRUX; M-46: CR |
| `SCHEDULER` | M-14: CRUDAXLKPT; M-15: RU; M-33: CRUAXLK |
| `SCHOLARSHIP_ADMIN` | M-11: CRUDAJXLKPT |
| `SCHOOL_COUNSELOR` | M-45: CR |
| `STUDENT` | M-10: R; M-11: CR; M-13: CRU; M-14: R; M-15: R; M-16: CR; M-17: CR; M-18: CR; M-19: RX; M-20: CRU; M-22: CR; M-23: CRU; M-24: CR; M-25: CRU; M-26: CRX; M-27: R; M-28: CR; M-29: CR; M-30: R; M-38: CR; M-39: R; M-41: CR; M-42: CR; M-43: CR; APP: CR |
| `STUDENT_AFFAIRS_ADMIN` | M-24: CRUDAJXPT |
| `TENANT_ADMIN` | M-01: R; M-02: CRUDXPT; M-03: CRUDAJXPT; M-04: RX; M-05: R; M-08: RP |
| `THESIS_SUPERVISOR` | M-20: RUAJ |
| `TREASURER` | M-06: RAX; M-10: RAJXLK; M-47: RA |
| `UNIT_CLEARANCE_OFFICER` | M-30: RAJ |
| `VENDOR` | M-46: CRU |

### 12.4 Catatan Rekonsiliasi

- Hibah READ yang ditambahkan agar profil dashboard instruksi konsisten: `LECTURER`→M-13 (R), `STUDENT`→M-27 (R, survei exit), `HEAD_OF_PROGRAM`→M-14 (R), M-44 (RX), `DEAN`→M-07/M-13/M-19/M-20/M-25/M-37/M-38/M-44, `IT_ADMIN`→M-35 (R), `TENANT_ADMIN`→M-01 (R, status langganan sendiri).
- **G-10** (litabmas/persuratan/kerjasama) — `litabmas` ditutup oleh M-44, `kerjasama` oleh `partners` (M-25/M-28/M-38); `documents/persuratan` tetap terbuka (di luar 47 modul).
- Matriks detail per aksi: [SECURITY_COMPLIANCE.md §10.4](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md).

<!-- SICA-47:END enterprise-47 -->
