/**
 * apply-api-m03.mjs — kontrak endpoint M-03 (Hak Akses & RBAC) di `docs/API_SPEC.md`.
 *
 * Temuan yang ditutup:
 *   · M-03 hanya punya 4 rute nyata (auth §4.1). Seluruh CRUD inti identitas — pengguna, peran,
 *     penugasan, permintaan hak, layanan mandiri — tidak pernah punya kontrak path.
 *   · `§4.6` baris 20 dan `§5` masih menulis `access_change_requests` tanpa path; `§4.6.6`
 *     memakai path lama `/admin/access/requests` yang tidak pernah menjadi kontrak final.
 *   · DSAR (M-05) belum punya kontrak sendiri dan sebelumnya menumpang izin perubahan hak.
 *
 * Semua rute ditulis SATU METODE PER BARIS agar terbaca `.tools/crud-matrix.mjs` (regex alat
 * menolak metode yang dibungkus backtick). Satu path = satu pemilik kontrak.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const T = 'docs/API_SPEC.md';
let text = readFileSync(T, 'utf8');
const must = (needle, value, label) => {
  const n = text.split(needle).length - 1;
  if (n !== 1) { console.error('MERAH — jangkar ' + label + ' cocok ' + n + ' kali. Berkas tidak ditulis.'); process.exit(1); }
  text = text.replace(needle, value);
};

/* ---------- 1. label modul pada heading §4.1 ---------- */
must('### 4.1 Modul Otentikasi & Sesi (`/api/v1/auth/*`)',
  '### 4.1 Modul Otentikasi & Sesi (`/api/v1/auth/*`) — M-03',
  'heading §4.1');

/* ---------- 2. baris indeks §4.6 nomor 20 ---------- */
must('| 20 | `pengguna` (`users`), `hak-akses` (`role-assignments`), `sesi` (`sessions`) | perubahan izin → `access_change_requests` (empat-mata) |',
  '| 20 | `pengguna` (`users`), `hak-akses` (`role-assignments`), `sesi` (`sessions`) | **§4.6.9** — CRUD pengguna/peran/penugasan, permintaan hak empat-mata, layanan mandiri `/me/**`; path lama `/admin/access/requests` dibatalkan, bukan dialias |',
  'indeks §4.6 baris 20');

/* ---------- 3. §4.6.6: path lama dibatalkan, kontrak pindah ke §4.6.9 ---------- */
must('| Hak akses | `POST /admin/access/requests` · `POST /admin/access/requests/:id/approve` | empat-mata, `VALIDATE`; penolakan wajib `reason` (AC-AKA-2) | `identity.accessrequest.approve` sudah ada; **penolakan bukan izin kedua** (vonis `RBAC §4.5.1`) — ia hasil negatif dari transisi `VALIDATE` yang sama dan tetap wajib `reason`, sehingga `K-3` ditutup sebagai ralat bukan sebagai izin baru |',
  '| Hak akses | **lihat §4.6.9** (kontrak penuh, 34 rute) | empat-mata, `VALIDATE`; penolakan wajib `reason` (**AC-ADM-6**) | rute lama `/admin/access/requests` **dibatalkan**, bukan dialias: satu path harus punya satu pemilik kontrak. Persetujuan memakai `POST /api/v1/admin/permintaan-hak/:id/approve`; penolakan memakai izin `VALIDATE` yang sama (vonis `RBAC §4.5.1`), bukan kode kedua |',
  'baris §4.6.6 hak akses');

/* ---------- 4. §4.6.7: scope-site menunjuk kontrak §4.6.9 ---------- */
must('| Penugasan scope `SITE` — `/api/v1/admin/role-assignments/:id/scope-site` | `PATCH` | `identity.assignment.scope` (112) | `0044` (ALTER `user_role_assignments`) |',
  '| Penugasan scope `SITE` — **lihat §4.6.9** | `PATCH` (satu metode, kontrak penuh di §4.6.9) | `identity.assignment.scope` (112, **usulan — belum di `PERMISSION_SPECS`**) | `0044` (ALTER `user_role_assignments`) |',
  'baris §4.6.7 scope-site');

/* ---------- 5. §4.6.9 + §4.6.10 ---------- */
const BARU = [
  '#### 4.6.9 Inti identitas: pengguna, peran, penugasan, permintaan hak & layanan mandiri (M-03) — 2026-10-22',
  '',
  '**Status: `spec-only` — nol `route.ts` di bawah `apps/web/src/app/api/v1/admin/**` dan `apps/web/src/app/api/v1/me/**`.** Yang berjalan hari ini hanya empat rute otentikasi §4.1 (`login`, `mfa/verify`, `refresh`, `me`); sisanya kontrak yang harus dikode setelah izin masuk `PERMISSION_SPECS` dan migrasi `0082` berberkas. Rujukan DDL: [DATA_MODEL §3](file:///c:/SICA/docs/DATA_MODEL.md) (`users`, `tenant_memberships`, `roles`, `permissions`, `role_permissions`, `user_role_assignments`, `access_change_requests`) dan §14.3.3 (migrasi `0082`). Izin: **26 kode normatif** `identity.*` — 24 ber-nomor di [RBAC §4.5.8](file:///c:/SICA/docs/RBAC_MATRIX.md) baris 329–352, dua impersonasi di baris 317–318; semuanya **sudah** ada di [`authz.ts`](file:///C:/SICA/packages/contracts/src/authz.ts) baris 126–151, bukan usulan.',
  '',
  '**Satu jalan untuk satu perubahan hak.** Memberi, mencabut, mengubah scope, dan mengubah komposisi izin role **tidak pernah** menulis `user_role_assignments`/`role_permissions` secara langsung. Keempatnya membuat baris `access_change_requests` berstatus `PENDING` (`202 { requestId, status }`) dengan `request_kind` `GRANT`/`REVOKE`/`SCOPE_CHANGE`/`ROLE_PERMISSION_CHANGE`; efeknya baru lahir saat **orang kedua** memanggil `POST /api/v1/admin/permintaan-hak/:id/approve` (`VALIDATE` 352) atau menolaknya dengan alasan. Ini menutup dua jalur eskalasi sekaligus: admin yang menyetujui permintaannya sendiri (`403 SELF_APPROVAL_FORBIDDEN`, 56) dan admin yang menyetujui grant untuk dirinya sendiri (baris 56 yang sama, `details.reason = \'APPROVER_IS_TARGET\'`).',
  '',
  '**Batas empat-mata yang ditegakkan, bukan diandaikan.** (a) `approver_id <> requester_id` dan `approver_id <> target_user_id` adalah `CHECK` di `0082` (`chk_acr_approver_not_target`), bukan hanya tombol tersembunyi; (b) scope yang diberikan wajib **himpunan bagian** scope penyetuju — pelanggaran `403 ADMIN_SCOPE_MISMATCH` (16), dan L4 `holdsScoped` wajib dipanggil (hari ini fungsi ada tetapi nol call site, `SEC-11`); (c) role sistem (`is_system = true`) tidak dapat diubah/dihapus — `409 CONFLICT` (12); (d) keputusan terminal tidak dapat diulang — `409 DECISION_ALREADY_MADE` (55); (e) penolakan wajib `reason ≥ 10` karakter dan memakai izin `VALIDATE` yang sama, bukan kode kedua; (f) penyetuju wajib sesi ber-MFA — `401 MFA_REQUIRED` (2) **sebelum** baris ditulis.',
  '',
  '**Berlaku pada pemeriksaan berikutnya, bukan pada token yang beredar.** Setelah keputusan sah: assignment baru/berubah dibaca dari `user_role_assignments` + `valid_to` pada setiap permintaan (bukan label peran di carrier); `refresh` untuk sesi yang haknya dicabut ditolak; cache izin per pengguna dibuang; pencabutan menutup `valid_to`/status dan **tidak menghapus baris**. Setiap pengajuan, persetujuan, dan penolakan menulis `audit_logs` berisi actor, target, before/after, alasan, IP, dan `request_id` (FR-IDT-05).',
  '',
  '**Layanan mandiri (`/me/**`) adalah jalur SELF, bukan pintu belakang admin.** Setiap `:id` diselesaikan di dalam transaksi dengan `WHERE tenant_id = ctx.tenantId` (anti-IDOR, `SEC-02`–`SEC-04`); pengguna hanya menyentuh baris miliknya (`subject_user_id = token.sub`), dan kolom `SERVER_ONLY` (`students.nim`, `students.status_akademik`, `grades.status`, `grades.letter`, `invoices.status`, `payments.status`, `ledger.*`, `enrollments.status`, `mfa_factors.secret`, `pddikti_*_id`) tidak pernah diterima dari body. Membaca/mengelola MFA dijaga satu kode `identity.mfa.manage` (334, `UPDATE`): katalog sengaja tidak memecahnya menjadi `INSERT`/`DELETE` karena enrolmen, pencabutan, dan rotasi recovery code adalah **satu tindakan kelola** dengan gerbang yang sama.',
  '',
  '**Batas realita yang tidak boleh disembunyikan.** Kontrak ini **belum berjalan**. Di kode hari ini, `POST /api/v1/auth/mfa/verify` menerima kode enam digit apa pun (temuan `SEC-01`, CRITICAL), `withModule` belum punya call site (`SEC-09`), dan `holdsScoped` belum dipanggil (`SEC-11`). Rute di bawah **tidak boleh** dianggap "siap pakai" karena spesifikasinya lengkap; gerbang global `DEV-G1…DEV-G7` tetap menahan pengodean.',
  '',
  '| Rute | Aksi | Izin (nomor §4.5) | Gerbang wajib | Catatan kontrak |',
  '|---|---|---|---|---|',
  '| GET /api/v1/admin/pengguna | READ | `identity.user.view` (336) | L1–L6 · MFA tidak | list §2.4; filter `q`, `status`, `roleId`, `scopeKind`; PII diproyeksikan per peran, bukan difilter di CSS |',
  '| POST /api/v1/admin/pengguna | INSERT | `identity.user.create` (337) | MFA ya | body `{username, fullName, email?, memberRole, reason}`; `PMB_OPERATOR` hanya boleh `APPLICANT`; sandi awal sekali-tampil, tidak pernah di log |',
  '| GET /api/v1/admin/pengguna/:id | READ | `identity.user.view` (336) | MFA tidak | id lintas tenant → `404 NOT_FOUND` (5), bukan `403`, agar keberadaan baris tidak bocor |',
  '| PATCH /api/v1/admin/pengguna/:id | UPDATE | `identity.user.update` (338) | MFA ya | `SERVER_ONLY` di body → `422 VALIDATION_FAILED` (6); perubahan email memaksa verifikasi ulang |',
  '| PATCH /api/v1/admin/pengguna/:id/nonaktif | UPDATE | `identity.user.deactivate` (339) | MFA ya | nonaktif = status + `valid_to` assignment ditutup; sesi dicabut; **tidak ada** `DELETE` baris pengguna |',
  '| POST /api/v1/admin/pengguna/:id/reset-password | UPDATE | `identity.user.update` (338) — **bukan** 331 (itu SELF) | MFA ya | token reset sekali pakai TTL 30 menit; semua sesi pengguna dicabut; respons tidak pernah memuat sandi |',
  '| GET /api/v1/admin/pengguna/:id/keanggotaan | READ | `identity.membership.view` (340) | MFA tidak | `tenant_memberships` + `member_code`; satu akun dapat punya banyak membership per unit |',
  '| POST /api/v1/admin/pengguna/:id/keanggotaan | INSERT | `identity.membership.create` (341) | MFA ya | `member_code` unik per tenant; unit wajib berada di bawah scope aktor |',
  '| PATCH /api/v1/admin/keanggotaan/:id | UPDATE | `identity.membership.update` (342) | MFA ya | pindah unit/status dicatat before/after di `audit_logs` |',
  '| GET /api/v1/admin/hak-akses/peran | READ | `identity.role.view` (343) | MFA tidak | sertakan `is_system` dan jumlah pemegang; role sistem tampil terkunci, bukan hilang |',
  '| POST /api/v1/admin/hak-akses/peran | INSERT | `identity.role.create` (344) | MFA ya | `is_system=false`; izin awal (bila ada) hanya id dari katalog `permissions`, bukan string bebas |',
  '| GET /api/v1/admin/hak-akses/peran/:id | READ | `identity.role.view` (343) | MFA tidak | detail + delta izin yang sedang `PENDING` (bila ada) |',
  '| PATCH /api/v1/admin/hak-akses/peran/:id | UPDATE | `identity.role.update` (345) | MFA ya | **hanya** nama/deskripsi; izin tidak pernah diubah lewat PATCH — gunakan `PUT …/izin` |',
  '| DELETE /api/v1/admin/hak-akses/peran/:id | DELETE | `identity.role.delete` (346) | MFA ya | `is_system=true` → `409 CONFLICT` (12); role masih dipakai → `409 REFERENCE_IN_USE` (19), bukan hapus paksa |',
  '| GET /api/v1/admin/hak-akses/izin | READ | `identity.permission.view` (347) | MFA tidak | katalog `resource × verb × module`; dipakai layar matriks izin (G-09) |',
  '| GET /api/v1/admin/hak-akses/peran/:id/izin | READ | `identity.role.view` (343) | MFA tidak | daftar izin efektif role; `PENDING` ditandai terpisah dan **belum berlaku** |',
  '| PUT /api/v1/admin/hak-akses/peran/:id/izin | UPDATE | `identity.role.update` (345) | MFA ya · **empat-mata** | body `{grant:[permissionId], revoke:[permissionId], reason}`; menulis `access_change_requests` `ROLE_PERMISSION_CHANGE` dan menjawab `202 { requestId }`; `role_permissions` **tidak berubah** sampai approve; `is_system=true` → `409 CONFLICT` (12) |',
  '| GET /api/v1/admin/hak-akses/penugasan | READ | `identity.assignment.view` (348) | MFA tidak | filter `userId`, `roleId`, `scopeKind`, `validTo`; termasuk assignment yang sudah kedaluwarsa |',
  '| POST /api/v1/admin/hak-akses/penugasan | INSERT | `identity.assignment.grant` (349) | MFA ya · **empat-mata** | body `{userId, roleId, scope, validTo?, reason}`; scope wajib subset scope aktor (`403 ADMIN_SCOPE_MISMATCH`, 16); menjawab `202 { requestId }`, **bukan** menulis assignment |',
  '| DELETE /api/v1/admin/hak-akses/penugasan/:id | DELETE | `identity.assignment.revoke` (350) | MFA ya · **empat-mata** | menulis permintaan `REVOKE` (202); baris assignment baru ditutup (`valid_to`) setelah approve; tidak ada hard delete |',
  '| PATCH /api/v1/admin/hak-akses/penugasan/:id/scope-site | UPDATE | `identity.assignment.scope` (112 — **usulan**) | MFA ya · **empat-mata** | menulis permintaan `SCOPE_CHANGE` (202); **rute diblokir** sampai kode 112 dipromosikan ke `PERMISSION_SPECS` (`G-15`); tanpa dimensi SITE, "hak hanya di kampus cabang" tidak dapat dinyatakan |',
  '| GET /api/v1/admin/permintaan-hak | READ | `identity.accessrequest.view` (351) | MFA tidak | pemohon melihat miliknya (`SELF`), penyetuju melihat tenant; filter `status`, `requestKind`; alasan terlihat, bukan diringkas menjadi boolean |',
  '| POST /api/v1/admin/permintaan-hak/:id/approve | VALIDATE | `identity.accessrequest.approve` (352) | MFA ya · **empat-mata** | menerapkan transisi; penyetuju ≠ pemohon ≠ target; terminal → `409 DECISION_ALREADY_MADE` (55); `ROLE_PERMISSION_CHANGE` menerapkan delta izin role secara atomik |',
  '| POST /api/v1/admin/permintaan-hak/:id/reject | VALIDATE | `identity.accessrequest.approve` (352) — **satu izin, hasil negatif** | MFA ya · **empat-mata** | `reason ≥ 10` wajib; tidak ada izin `.reject` kedua (vonis `RBAC §4.5.1`, `G-12`) |',
  '| GET /api/v1/admin/monitoring/login-stats | READ | `identity.loginstats.view` (335) | MFA tidak | agregat per hari/perangkat; tanpa PII per-record; sumber `login_events`/`audit_logs` |',
  '| GET /api/v1/me/profile | READ | `identity.profile.view` (329) | SELF | hanya baris milik token; kolom `SERVER_ONLY` tidak diproyeksikan |',
  '| PATCH /api/v1/me/profile | UPDATE | `identity.profile.update` (330) | SELF | `SERVER_ONLY` di body → `422 VALIDATION_FAILED` (6); NIM/status akademik hanya berubah lewat layanan akademik |',
  '| POST /api/v1/me/password | UPDATE | `identity.password.reset` (331) | MFA ya · SELF | wajib sandi lama; kebijakan panjang/breach + `password_history` 5 terakhir; sesi lain dicabut |',
  '| GET /api/v1/me/sessions | READ | `identity.session.view` (332) | SELF | sesi aktif + riwayat; sesi saat ini ditandai |',
  '| DELETE /api/v1/me/sessions/:id | DELETE | `identity.session.revoke` (333) | SELF | hanya sesi sendiri; mencabut refresh-token family, bukan hanya access token |',
  '| GET /api/v1/me/mfa | READ | `identity.mfa.manage` (334, `UPDATE`) | MFA ya · SELF | daftar faktor + status; `mfa_factors.secret` tidak pernah dikirim |',
  '| POST /api/v1/me/mfa | UPDATE | `identity.mfa.manage` (334) | MFA ya · SELF | mulai/konfirmasi enrolmen TOTP/WebAuthn; recovery code ditampilkan **sekali** |',
  '| DELETE /api/v1/me/mfa/:id | UPDATE | `identity.mfa.manage` (334) | MFA ya · SELF | faktor terakhir tidak dapat dihapus tanpa recovery code aktif; `DELETE` HTTP tetap satu tindakan kelola |',
  '| POST /api/v1/me/mfa/recovery-codes | UPDATE | `identity.mfa.manage` (334) | MFA ya · SELF | rotasi kode pemulihan; kode lama langsung tidak berlaku |',
  '',
  '**Kode error yang dipakai (tanpa kode baru).** `UNAUTHORIZED` (1) · `MFA_REQUIRED` (2) · `FORBIDDEN` (3) · `NOT_FOUND` (5) · `VALIDATION_FAILED` (6) · `RATE_LIMIT_EXCEEDED` (9) · `CONFLICT` (12) · `ADMIN_SCOPE_MISMATCH` (16) · `REFERENCE_IN_USE` (19) · `DECISION_ALREADY_MADE` (55) · `SELF_APPROVAL_FORBIDDEN` (56). Tidak ada kode baru untuk keadaan yang sudah punya baris; `APPROVER_IS_TARGET` adalah `details.reason` pada baris 56, bukan kode kedua.',
  '',
  '**Urutan baca untuk implementasi (tidak boleh dibalik).** (1) promosikan `identity.assignment.scope` (112) bila route SITE akan dikode — hari ini **jangan**; (2) berkas migrasi `0082` + `gen-rbac-seed.mjs`; (3) `requireDataPrincipal` + `holdsScoped` di setiap rute (bukan perluasan carrier); (4) Zod `strict()` di `packages/contracts`; (5) baru handler. Rute yang tidak memenuhi lima lapis pertama tetap `spec-only`, bukan "hampir selesai".',
  '',
  '#### 4.6.10 Permintaan Subjek Data (DSAR) — M-05 — 2026-10-22',
  '',
  '**Status: `spec-only`, izin masih usulan.** `data_subject_requests` ([DATA_MODEL §23](file:///c:/SICA/docs/DATA_MODEL.md)) adalah jalur UU PDP 27/2022: subjek meminta salinan/koreksi/penghapusan terbatas, DPO memutuskan, dan yang terjadi adalah **anonimisasi tampilan** atau koreksi terbatas — bukan penghapusan arsip akademik/keuangan yang punya kewajiban retensi. Tiga kode di [RBAC §4.5.6](file:///c:/SICA/docs/RBAC_MATRIX.md) — `audit.dsar.submit`, `audit.dsar.view`, `audit.dsar.decide` — **belum** ada di `PERMISSION_SPECS`; rute di bawah tidak boleh dikode sebelum dipromosikan (`G-31`, keputusan pemilik `CRD-5b`). DSAR **tidak** memakai `identity.accessrequest.*`: izin itu milik alur perubahan hak, dan meminjamnya membuat DPO dapat menyetujui pemberian peran.',
  '',
  '| Rute | Aksi | Izin (usulan §4.5.6) | Gerbang wajib | Catatan kontrak |',
  '|---|---|---|---|---|',
  '| POST /api/v1/me/permintaan-subjek-data | INSERT | `audit.dsar.submit` | SELF · rate limit | subjek hanya untuk dirinya (`subject_user_id = token.sub`); `kind` ∈ `ACCESS`/`RECTIFY`/`ERASE_LIMITED`; jawaban `202 { requestId }`; tidak memberi hak membaca kasus orang lain |',
  '| GET /api/v1/admin/permintaan-subjek-data | READ | `audit.dsar.view` | MFA ya · DPO | antrean + status; isi kasus diproyeksikan, bukan disalin ke log |',
  '| POST /api/v1/admin/permintaan-subjek-data/:id/decide | VALIDATE | `audit.dsar.decide` | MFA ya · DPO ≠ subjek | keputusan terminal `409 DECISION_ALREADY_MADE` (55); penolakan wajib alasan; `ERASE_LIMITED` tidak pernah menghapus baris yang punya kewajiban retensi |',
  '',
  '**Batas yang mengikat.** (a) DSAR bukan `DELETE` tabel bisnis: retensi akademik/keuangan tetap berlaku, dan keputusan yang meminta penghapusan penuh wajib ditolak dengan alasan tertulis; (b) setiap keputusan menulis `audit_logs` + alasan + identitas pemutus; (c) `audit.dsar.*` tidak boleh diberikan kepada `COMPLIANCE_OFFICER` sebagai pengganti `identity.*` — DPO **tidak** memegang hak perubahan peran (`G-31`); (d) bila kelak subjek meminta salinan data, jalur ekspor memakai izin baca sumbernya + `audit.export`, bukan izin DSAR baru.',
  '',
].join(NL);
must(NL + '### 4.7 Webhook pembayaran (`/api/v1/payments/webhook/:gateway`)', BARU + NL + '### 4.7 Webhook pembayaran (`/api/v1/payments/webhook/:gateway`)', 'sisip §4.6.9/§4.6.10');

/* ---------- 6. rekap §5 ---------- */
must('| Hak akses (empat-mata) | `POST /admin/access/requests`, `/requests/:id/approve` | `spec-only` | §4.6.6 |',
  '| Hak akses & identitas (M-03) | 34 rute §4.6.9: pengguna, peran, penugasan, permintaan hak, `/me/**` | `spec-only` | §4.6.9 |',
  'rekap §5 hak akses');

/* ---------- verifikasi ---------- */
const block = text.slice(text.indexOf('#### 4.6.9'), text.indexOf('### 4.7 Webhook pembayaran'));
const rute = (block.match(/^\| (GET|POST|PATCH|PUT|DELETE) \/api\/v1\//gm) || []).length;
if (rute !== 37) { console.error('MERAH — §4.6.9+§4.6.10 harus memuat 37 rute (34 M-03 + 3 M-05), dapat ' + rute + '.'); process.exit(1); }
for (const p of ['/api/v1/admin/permintaan-hak/:id/approve', '/api/v1/admin/hak-akses/peran/:id/izin', '/api/v1/me/mfa/recovery-codes', '/api/v1/me/permintaan-subjek-data']) {
  if (!block.includes(p)) { console.error('MERAH — rute wajib hilang: ' + p); process.exit(1); }
}
if (block.includes('/admin/access/requests')) { console.error('MERAH — path lama masih muncul di blok baru.'); process.exit(1); }
writeFileSync(T, text, 'utf8');
console.log('HIJAU — §4.6.9 (34 rute M-03) + §4.6.10 (3 rute DSAR M-05) ditulis · path lama dibatalkan · rekap §5 diperbarui.');
