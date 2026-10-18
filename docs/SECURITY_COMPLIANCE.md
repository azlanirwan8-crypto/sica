# SICA — Security & Compliance Architecture

| | |
|---|---|
| Versi | 0.1 |
| Model ancaman | Multi-tenant SaaS yang menyimpan data akademik & keuangan mahasiswa (PII, nilai, tagihan, dokumen) |
| Kerangka | Zero-Trust, OWASP Top 10 (2021) + OWASP ASVS L2, NIST SP 800-63B, SOC 2 Type II (TSC 2017), ISO/IEC 27001:2022 Annex A · **Regulasi**: UU PDP 27/2022 + **PP 33/2026**, SN-Dikti **Permendiktisaintek 39/2025** (+ amendemen 10/2026), Permenristekdikti 61/2016 & 59/2018, Kepmendiktisaintek 358/M/KEP/2026 (IKU), UU 43/2009 + Perka ANRI (retensi), PP 82/2012 & PP 71/2019 (TTE) |
| Dokumen terkait | [INDEX.md](file:///c:/SICA/docs/INDEX.md) · [PRD.md](file:///c:/SICA/docs/PRD.md) · [ARCHITECTURE.md](file:///c:/SICA/docs/ARCHITECTURE.md) · [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md) · [GLOSSARY.md](file:///c:/SICA/docs/GLOSSARY.md) |

---

## 1. Postur: Zero-Trust per Lapis

**Asumsi dasar: tidak ada lapisan yang boleh dipercaya sendirian.** Klien bisa dimanipulasi, proxy bisa bocor, satu bug di service layer tidak boleh menjadi kebocoran lintas tenant — karena itu otoritas terakhir ada di **database (RLS)** dan setiap keputusan memakai konteks yang divalidasi server-side.

| Lapis | Kontrol yang Diterapkan | Apa yang BUKAN kontrol keamanan di lapis ini |
|---|---|---|
| Edge | WAF, rate limit per tenant+IP, block list, TLS 1.2+, HSTS preload | "IP sudah diverifikasi" — tidak untuk otorisasi |
| Transport | mTLS internal service↔DB (postgres `hostssl` + client cert), no plaintext | DNS, header `X-Forwarded-For` mentah |
| Gateway/API | AuthN (verifikasi JWT + cek session aktif), AuthZ (RBAC+ABAC), Zod whitelist parse | klaim `tenant_id` di body/header klien |
| Service | Transaksi + `SET LOCAL app.tenant_id`, domain rules dari DB, guard per-aksi | guard saja (bisa dilewati kode baru) |
| **Repository** | **selalu butuh `TenantContext` wajib + policy check sebelum mutasi** | filter "sudah ada di query" |
| **Database** | **RLS `FORCE`, `NOBYPASSRLS` untuk `sica_app`, constraint & trigger, audit append-only** | — (ini jaring terakhir) |
| Storage | object key yang digenerate (bukan nama file user), presigned TTL ≤ 60 detik, versioning, scan | path dari klien |
| Worker/job | scope tenant eksplisit per job, idempotency, retry ber-backoff + dead-letter | "job internal aman" |
| Observability | redaksi PII & secret di log, trace tanpa body, retensi log pendek | dashboard sebagai tempat data mahasiswa |
| Manusia | MFA wajib untuk peran tulis, akses break-glass ber-justifikasi + TTL pendek + audit | kredensial admin bersama |

---

## 2. Arsitektur Autentikasi

### 2.1 Password & faktor
- Hash: **Argon2id**, parameter minimum OWASP: `memory=64 MiB, iterations=3, parallelism=1`; salt 16 byte per hash; **pepper** dari KMS digabung ke input (sehingga bocoran DB tidak cukup untuk offline cracking).
- **Upgrade Parameter Otomatis**: Saat login berhasil, sistem membandingkan versi parameter hash yang tersimpan dengan baseline terbaru; jika parameter lama terdeteksi (mis. pasca-kebijakan kenaikan memori Argon2id), sistem otomatis melakukan re-hash dan update ke database tanpa mengganggu pengalaman user.
- Kebijakan: panjang min 12, cek terhadap breach corpus dengan **k-anonymity** (kirim 5-char prefix SHA-1, cocokkan suffix) — password plaintext tidak pernah keluar sistem.
- `password_history` 5 terakhir; tidak boleh reuse.
- MFA: **wajib** untuk semua peran dengan hak tulis (Admin PT, Admin Akademik, Keuangan, SDM, Kaprodi, Pimpinan, Feeder Operator, Platform Operator); **WebAuthn/passkey** disarankan, TOTP diizinkan; recovery code 8× sekali-pakai, di-hash.
- Mahasiswa & dosen: MFA opsional, dapat dipaksa per tenant (`tenant_settings.mfa_policy`).

### 2.2 Token & sesi (JWT + Session Revocation)
Model: **access token short-lived + server-side session yang bisa dicabut**. JWT murni tidak bisa direvoke; menolak itu = bug arsitektur.

```
Login (email/NIM + password [+ MFA])
  → buat baris `sessions` (sid, user_id, tenant_ctx, device, ip-hash, expires_at)
  → issue access token **RS256** (RSA-SHA256), TTL 10–15 menit  [diperbarui: konsisten dgn ENV_CONTRACT/ADR; sebelumnya tertulis EdDSA — lihat AUD-11]
      claims: sub(userId) · tid(tenantId) · sid · role · iss · aud · iat · exp · jti · nbf? · amr · scope
  → cookie: HttpOnly · Secure · SameSite=Strict · Path=/ · scope ke host Persis (BUKAN wildcard *.domain)
  → refresh token: 14 hari, opaque (bukan JWT), disimpan sebagai SHA-256 hash di `refresh_tokens`,
      rotasi setiap pemakaian, family_id untuk deteksi reuse
  → tiap request: verifikasi sig → cek `sid` ada di Redis revocation set → cek tenant & user status → cek `rc` masih valid
  → logout / revocation: hapus session + matikan family refresh + tambah sid ke denylist TTL=sisa exp
```

| Skenario | Kontrol |
|---|---|
| Token dicuri | TTL 10 menit + `sid` revocation + binding device fingerprint (soft) + SameSite=Strict |
| Refresh token dicuri | rotasi + **reuse detection**: token lama dipakai → seluruh family dicabut + user dinotifikasi (NIST 800-63B) |
| Admin jahat / akun kompromi | perubahan hak akses butuh approval dua orang (empat-mata) untuk peran finansial; semua tercatat |
| User dihapus/pindah kampus/dikeluarkan | `users.status`, `tenant_memberships.status`, `tenants.status` dicek per request — bukan hanya saat login |
| Session tetap hidup setelah tenant suspended | `tenant.status != ACTIVE` → guard menolak 423, tanpa peduli validitas token |
| Cookie lintas tenant pada wildcard domain | dilarang: cookie di-scoping ke host persis; bila pakai satu domain, `tenant_id` selalu divalidasi membership server-side |

**Impersonation (dukungan tenant):** tidak ada "login sebagai mahasiswa". Yang ada adalah `platform_support_grants`: operator mengajukan dengan ticket-id + alasan + TTL (mis. 30 menit) + MFA, tenant dapat melihat & mencabut, seluruh aksinya tercatat sebagai *dua* identitas (siapa yang bertindak & siapa yang ditiru).

### 2.4 Status Implementasi Primitif Autentikasi (audit 2026-10-18)
Dielaborasi & diimplementasi (terverifikasi `tsc` 0 error + `vitest` 59 test lulus):
| Komponen | Lokasi | Status |
|---|---|---|
| JWT **RS256** sign/verify (Node `crypto`, tanpa dep) | `apps/web/src/modules/auth/services/jwt.service.ts` | ✅ nyata; validasi sig + exp/nbf/iss/aud + tololansi clock |
| Verifikasi identitas di API | `apps/web/src/lib/api-response.ts::extractRequestContext` | ✅ **fail-closed** — `userId/tenantId/role/sid` diambil dari klaim terversifikasi, BUKAN cookie mentah (menutup AUD-02/03 jalur verifikasi) |
| Password hashing | `password.service.ts` | 🟡 **interim `ScryptPasswordHasher`** (peppered, Node crypto, teruji) di belakang interface `PasswordHasher`; **Argon2id target** aktif setelah paket `argon2` terpasang (`pnpm install`) |
| Refresh token opaque + SHA-256 hash + family/reuse | `token.service.ts` | ✅ primitif nyata (generate/hash/safeEqual/family); persistensi `refresh_tokens` butuh DB |
| Login issuer token | `app/api/v1/auth/login/route.ts` | 🟡 sign JWT **nyata** bila `JWT_PRIVATE_KEY` ada (else 500 fail-secure); **lookup user & cek hash dari DB masih stub** (AUD-03) |
| Sesi revocation (cek `sid` di Redis) | — | ❌ belum; butuh Redis + `sessions` (bagian task integrasi) |
| Verifikasi di Edge middleware | `middleware.ts` → `edge-auth.ts` → `jwt-edge.ts` | ✅ **fail-secure** — verifikasi tanda tangan RS256 (WebCrypto + JWK, `JWT_PUBLIC_KEY_JWK`) sebelum izinkan `/dashboard`/`/academic`; token cacat/kedaluwarsa/unconfigured → tolak (AUD-02 CLOSED). Klaim `tid`/`sub` → header `x-tenant-id`/`x-user-id` |

Env baru: `JWT_ISSUER` (def. `sica`), `JWT_AUDIENCE` (def. `sica-web`) — didaftarkan di `config/env.ts` & ENV_CONTRACT.
**Decisions (AUD-11):** algoritma akses token distandarkan **RS256** (bukan EdDSA) agar konsisten ENV_CONTRACT + key PEM yang sudah di-kontrak-kan.

### 2.3 Rate limiting & brute force
`packages/domain` tidak menangani ini — lapisan infra:
- Redis sliding window, key = `hash(ip) + tenant + route-class`; budget berbeda untuk `auth.login` (5/15mnt), `auth.mfa` (5/5mnt), `krs.submit` (per OW window, mis. 20/mnt), `api.read` (200/mnt), `feeder.kirim` (batch).
- **Progressive delay** (bukan hard-lock yang bisa dipakai untuk DoS akun orang lain) + lockout akun dengan release oleh admin + notifikasi ke user.
- `429` tidak membeberkan sisa budget di endpoint sensitif.
- Rate limit di level gateway **dan** di query (token bucket enrollment per kelas) — dua-duanya, karena gateway tidak paham kuota.

---

## 3. RBAC + ABAC (otorisasi)

### 3.1 Model
```
Permission (katalog global, kode stabil, contoh: grading.value.write)
  Role (per tenant; role sistem + role kustom tenant)
    RolePermission
      UserRoleAssignment(user_id, tenant_id, role_id,
                         scope_prodi_id?, scope_org_id?, scope_class_id?, scope_period_id?,
                         valid_from, valid_to)     ← ⚑ inti dari desain ini
```
**Mengapa scope di assignment, bukan di role:** dosen yang sama bisa pengampu di prodi A, PA di prodi B, dan tidak punya hak apa pun di periode lalu. Role tanpa konteks akan memaksa pembuatan role turunan tak terhingga (`Dosen Prodi A 2025`, ...) — pola yang membuat sistem akademik runtuh secara administratif.

### 3.2 Enforcement di kode
```ts
// core/authz/permissions.ts — katalog tunggal; tidak ada string literal lepas di controller
export const PERM = {
  gradingWrite: 'grading.value.write',
  gradingUnlock: 'grading.unlock',
  krsSubmit: 'enrollment.krs.submit',
  krsApprove: 'enrollment.krs.approve',
  invoiceVoid: 'finance.invoice.void',
  paymentConfirm: 'finance.payment.confirm',
  studentStatusChange: 'student.status.change',
} as const;

// Guard = hak kasar (boleh tidak untuk aksi ini); Service = hak halus (atas data siapa)
@Injectable()
export class RequiresPermission { /* membaca PERM dari metadata, cek cache izin */ }

@Post('grades/:gradeId')
@UseGuards(AuthGuard, TenantGuard, new RequiresPermission(PERM.gradingWrite))
updateGrade(
  @Ctx() ctx: TenantContext,            // tid + uid + rc, hasil validasi server-side
  @Body(new ZodPipe(UpdateGradeDto)) dto: UpdateGradeDto,   // whitelist: unknown keys DIBUANG
  @Param('gradeId') gradeId: string
) {
  // Otoritas data: bukan cukup punya permission — harus kelas yang diampunya,
  // di periode yang masih membuka input nilai (BR-G1), dan status nilai belum LOCKED.
  return this.gradingService.update(ctx, { gradeId, ...dto });
}
```
```ts
// service — cek relasi sebelum mutasi; repository tidak boleh menerima id tanpa konteks
if (!await this.assignments.isLecturerOf(ctx, classId)) throw new Forbidden('NOT_YOUR_CLASS');
if (grade.status === 'LOCKED') throw new Conflict('GRADE_LOCKED_USE_CORRECTION_WORKFLOW');
```
```ts
// repository — TenantContext wajib di signature: lupa filter = compile error, bukan kebocoran senyap
async findById(ctx: TenantContext, id: string) {
  return db.select().from(grades)
    .where(and(eq(grades.tenantId, ctx.tenantId), eq(grades.id, id)));  // + RLS di DB
}
```
**Empat titik kegagalan yang diuji (bukan diasumsikan aman):** permission cukup tapi data milik prodi lain · permission di-cache tapi sudah dicabut · `tenant_id` benar tapi periode salah · filter di query tapi RLS tidak aktif (migration membuat tabel tanpa policy → **CI gate menolak**).

Cache izin di Redis dengan TTL 5 menit dan **invalidasi event-driven** saat assignment/role berubah; mutasi finansial & nilai memakai cek langsung (tanpa cache) — harga 1 query ekstra jauh di bawah harga satu nilai salah kunci.

---

## 4. OWASP Top 10 — mitigasi terintegrasi di kode

### A01 Broken Access Control — risiko tertinggi di SICA
| Vektor | Mitigasi |
|---|---|
| IDOR: `/api/mahasiswa/:id` milik prodi lain | lookup selalu ber-`TenantContext` + scope check + RLS; tidak ada endpoint "cari by id" global |
| Lupa `WHERE tenant_id` di query ad-hoc | RLS `USING`/`WITH CHECK` + `FORCE ROW LEVEL SECURITY` |
| Peran di client (`localStorage.role`) | peran dibaca dari sesi server-side; klien tidak pernah jadi sumber keputusan |
| BOLA di berkas (KHS/ijazah PDF) | object key opaque; unduh via signed URL + otorisasi per-request; tidak pernah path dari klien |
| Privilege escalation saat pindah role | `role_ctx` di-.issue ulang tiap login & saat assignment berubah; `valid_to` ditegakkan di guard |
| Mass assignment (user kirim `role_id`/`tenant_id`/`status`) | Zod DTO whitelist, `unknownKeys: 'strip'`; kolom sensitif hanya bisa diubah lewat endpoint khusus ber-approval |
| Lintas tenant lewat ekspor/report builder | report engine jalan sebagai `sica_readonly` dengan GUC tenant; tidak ada SQL user |

**Suite regresi wajib (CI blocking):** fixture 2 tenant (A/B) + 2 dataset tiap objek → 100% request sebagai user-A atas resource-B harus `404` (bukan `403`, agar tidak membocorkan keberadaan). Didesain sebagai tabel, dijalankan otomatis dari katalog objek.

### A02 Cryptographic Failures
At-rest: volume/RDS encryption + field-level AES-256-GCM via KMS envelope untuk: rekening/VA, data sensitif tertentu, recovery code. In-transit: TLS 1.2+, HSTS `max-age=63072000; includeSubDomains; preload`. Key: rotasi tahunan, separate per environment, tidak ada key di git/env (secret scan di CI). Hashing: Argon2id; token: hash SHA-256 sebelum disimpan. Log: redaksi terpusat (Pino redact paths) — tidak pernah body penuh, `Authorization`, nomor VA, NIK.

### A03 Injection
Drizzle builder → parameterized. `sql.raw` **dilarang** kecuali dari file `.sql` yang di-review (whitelist lint rule `no-restricted-syntax`), tidak pernah menerima input user. Sorting/filter dari klien dipetakan ke whitelist kolom (bukan string kolom langsung):
```ts
const SORTABLE = { nim: students.nim, nama: students.fullName, ip: ipK } as const;
const col = SORTABLE[q.sort as keyof typeof SORTABLE] ?? students.nim;   // tak ada interpolasi
```
`ILIKE`: escape wildcard (`%`, `_`, `\`). XSS: React escaping default; `dangerouslySetInnerHTML` diblokir lint; sanitasi rich-text (RPS/catatan bimbingan) dengan DOMPurify server-side. **CSV/Excel formula injection** — nyata di SICA karena ekspor nilai/tagihan: sel yang dimulai `= + - @ TAB CR` di-prefix apostrof. PDF (KHS/ijazah/surat): template auto-escape + validasi field sebelum render.

### A04 Insecure Design
| Ancaman desain | Kontrol |
|---|---|
| Koreksi nilai senyap | workflow + approval Kaprodi + alasan wajib + audit + hitung ulang KHS + notifikasi (BR-G4) |
| Nilai/nim dihapus | tidak ada hard delete untuk data akademik; soft-archive + status |
| Tagihan dobel/hilang saat retry | engine idempotent (`generation_run_id`, unique `(tenant,student,period,component)`) |
| Replay pembayaran | unique `provider_ref` + idempotency key + ledger |
| Negatif/pecahan uang | `CHECK (amount_rupiah > 0)` di semua tabel uang; void via reversing entry |
| Kuota kelas jebol saat OW | advisory lock per `class_id` dalam transaksi |
| Periode tutup tapi masih bisa tulis | guard status periode + `CHECK` trigger (BR-A9) |
| Bypass gerbang keuangan | tidak ada jalur "buka KRS" tanpa approval + alasan + audit |

### A05 Security Misconfiguration
Harden: `helmet` (CSP nonce, `frame-ancestors 'none'`, COOP/CORP), `x-powered-by` off, error page tidak stack-trace di produksi (envelope error tanpa detail), `PORT`/health endpoint internal-only, Postgres `listen_addresses` privat + `hostssl` + client cert, S3 block public access + bucket policy, CORS allowlist origin per tenant (bukan `*` dengan credentials), Redis `requirepass`/TLS + `protected-mode yes`, tidak ada default admin password (provisioning menghasilkan kredensial sekali-pakai), `NEXT_PUBLIC_*` review (tidak ada secret di bundle publik). IaC di-review + `terraform plan` di CI + drift detection.

**Header Content Security Policy (CSP) Standar Produksi:**
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{RANDOM_NONCE}' 'strict-dynamic'; style-src 'self' 'nonce-{RANDOM_NONCE}'; img-src 'self' data: https://blob.sica.id; font-src 'self'; connect-src 'self' https://api.sica.id; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';
```
*Catatan: Nonce dibangkitkan kriptografis per-request di middleware Next.js & NestJS, diteruskan ke elemen script/style RSC.*

### A06 Vulnerable & Outdated Components
`pnpm` lockfile commit + `--frozen-lockfile` di CI; Dependabot + `pnpm audit --audit-level=high` blocking; SBOM CycloneDX tiap build; pin versi major; **postinstall scripts dibatasi** (`pnpm.onlyBuiltDependencies` allowlist) — vektor supply chain utama di ekosistem npm; base image minimal non-root + read-only FS + scan di pipeline; patch SLA: Critical 24 jam, High 7 hari, Medium 30 hari, Low 90 hari (§6).

### A07 Identification & Authentication Failures
Lihat §2. Tambahan: `login_events` (kegagalan, geolocasi kasar, device) + alert anomali; reset password ber-token sekali-pakai TTL 15 menit + invalidasi sesi lain saat password berubah; session listing "perangkat aktif" untuk user; no username enumeration (`401` seragam); CSRF: SameSite=Strict + verifikasi `Origin`/`referer` untuk state-changing + token ganda pada form berbasis POST.

### A08 Software & Data Integrity Failures
CI hanya build dari sumber ter-verifikasi; artefak image di-sign (cosign/Sigstore) + verify di runtime; `npm provenance` untuk paket; **tidak ada auto-update data massal tanpa approval** (import Excel tagihan/mahasiswa = jalur ber-risko → dry-run + diff report + approval + audit). CI/CD: branch protection, minimal 1 review, secret di OIDC (bukan long-lived token), environment-gated deploy.

### A09 Logging & Failure Reporting
`audit_logs` (append-only, hash-chained, §DATA_MODEL) ≠ `application logs` ≠ `security events` — ketiganya dipisah:
- **audit**: siapa-apa-kapan-sebelum/sesudah, disimpan lama, tidak pernah PII utuh yang tidak perlu.
- **app log**: terstruktur JSON, correlation-id, redaksi, retensi 30 hari.
- **security event**: login/MFA/role-change/break-glass/anomali kuota → deteksi + alert.
Gagal aman: timeout transaksi = rollback (bukan state setengah-jadi); dead-letter queue dengan alert, tidak ada diam-diam drop; **ketersediaan bukan alasan** — `status.tenant != ACTIVE` lebih baik daripada data silang.

### A10 SSRF
Semua outbound ke pihak ketiga (gateway, webhook tenant, feeder, unduh foto) melewati **egress proxy dengan allowlist host/tujuan** + tolak IP range privat/link-local/metadata (`169.254.169.254`) + `redirect: 'error'` + no DNS rebind (resolusi IP divalidasi sebelum fetch) + timeout ketat. Webhook masuk: verifikasi tanda tangan + replay window + idempotency.

---

## 5. Ancaman Khusus Domain Akademik (di atas OWASP)

| Ancaman | Mitigasi |
|---|---|
| Mahasisiwa/alumni mencari NIM orang lain untuk social engineering | tidak ada endpoint pencarian lintas mahasiswa; lookup butuh relasi (kelas/prodi) |
| Nilai "titipan" oleh admin | semua ubah nilai butuh workflow; laporan berkala "nilai diubah di luar jendela input" ke pimpinan |
| Pemalsuan status bayar | `payment.confirmation` terpisah dari `webhook`; rekonsiliasi harian vs statement bank; alert delta |
| Ijazah/transkrip palsu | dokumen punya verification-code + PDF ber-signature; publik bisa verifikasi ke endpoint khusus (tanpa PII berlebih) |
| Feeder merusak data produksi | sync bersifat append-log + `diff` yang harus di-approve sebelum write ke PDDIKTI |
| Noisy neighbor (kampus besar mematikan yang kecil) | kuota concurrency per tenant + antrian terpisah + alert utilisasi + limit export |
| Scraping data & credentials stuffing dari IP kampus | rate limit per tenant+IP, device anomaly, MFA role tulis |
| Dosen mengambil data satu angkatan untuk ekspor pribadi | ekspor ber-audit dengan pembatasan kolom & volume; ekspor massal = izin khusus |

---

## 6. Kerangka Kepatuhan: Kesiapan SOC 2 Type II & ISO/IEC 27001:2022

Dokumen ini mendefinisikan kerangka kesiapan (*readiness framework*) menuju sertifikasi SOC 2 Type II dan ISO/IEC 27001:2022. Sertifikasi SOC 2 Type II memerlukan masa operasional ter-audit (3–6 bulan), sedangkan ISO 27001 mensyaratkan implementasi Sistem Manajemen Keamanan Informasi (SMKI / ISMS) formal yang diaudit oleh badan sertifikasi terakreditasi. Standar ini menjadi prasyarat kualifikasi pengadaan bagi perguruan tinggi negeri maupun swasta.

### 6.1 Pemetaan Kriteria SOC 2 (Trust Services Criteria 2017)

| Kriteria | Kontrol Keamanan di SICA | Bukti Kepatuhan (*Evidence Artifacts*) |
|---|---|---|
| **CC1 (Lingkungan Pengendalian)** | Pemisahan peran database (`sica_app`, `sica_owner`, `sica_readonly`), pemisahan tugas (*segregation of duties*) antara keuangan dan akademik, tinjauan hak akses berkala. | Matriks RACI, katalog role DB, laporan reviu akses kuartalan. |
| **CC2 (Komunikasi & Informasi)** | Kebijakan keamanan tertulis, program orientasi staf, pelatihan kesadaran keamanan tahunan, dokumen `SECURITY.md`. | Materi training, log kehadiran, formulir kepatuhan karyawan. |
| **CC3 (Penilaian Risiko)** | Risk register formal, tinjauan risiko kuartalan, pemodelan ancaman (*threat modeling*) pada setiap modul baru. | Dokumen risk register, notula reviu risiko, dokumen STRIDE. |
| **CC4 (Aktivitas Pengendalian)** | CI quality gate (typecheck strict, lint arsitektur, RLS policy test suite, automated secret scan), exception register. | Log eksekusi pipeline CI/CD, daftar pengecualian ber-approval. |
| **CC5 (Manajemen Vendor & Sub-prosesor)** | Registri sub-prosesor (AWS/Cloudflare/DOKU), uji kelayakan vendor, klausul DPA standar, evaluasi SLA berkala. | Daftar sub-prosesor, salinan DPA, sertifikat SOC 2/ISO vendor. |
| **CC6 (Pengendalian Akses Logis)** | Autentikasi MFA wajib untuk peran tulis, otorisasi RBAC+ABAC berbasis scope, prosedur Joiner-Mover-Leaver otomatis, break-glass ber-audit. | Matriks permission per tenant, log audit impersonasi dan break-glass. |
| **CC7 (Operasi Sistem & Perubahan)** | Monitoring terpusat, alert latensi & error, Infrastructure as Code (IaC), manajemen perubahan (PR review + migration dry-run + rollback plan). | Change log GitHub, runbook operasional, laporan postmortem insiden. |
| **CC8 (Mitigasi Insiden)** | Prosedur klasifikasi insiden (SEV1–SEV4), rotasi on-call engineer, playbook pemulihan insiden, SLA notifikasi tenant ≤72 jam. | Register insiden, playbook insiden, laporan resmi postmortem. |
| **CC9 (Keberlangsungan Operasional)** | Backup otomatis + Point-in-Time Recovery (PITR), replikasi multi-region, uji pemulihan bencana (*DR drill*) terjadwal, RPO ≤15 mnt, RTO ≤4 jam. | Laporan uji drill restore per kuartal, sertifikat verifikasi backup. |
| **A1 (Ketersediaan / Availability)** | Arsitektur multi-AZ, horizontal auto-scaling, komitmen SLA uptime 99,5%, uji beban open wiring (k6), isolasi resource antar-tenant. | Laporan k6 load test, status page publik, metrik SLO bulanan. |
| **C1 (Kerahasiaan / Confidentiality)** | Klasifikasi data bertingkat (§7), field-level encryption untuk PII sensitif, penegakan retensi arsip, mekanisme ekspor data mandiri. | Kebijakan klasifikasi data, modul ekspor terenkripsi, NDA staf. |
| **P1 (Pelindungan Data Pribadi)** | Registri aktivitas pemrosesan (RoPA), pemetaan dasar hukum pemrosesan, SLA penanganan hak subjek data, notifikasi kebocoran data. | Record of Processing Activities (RoPA), SOP hak subjek data. |

### 6.2 Prioritas Kendali ISO/IEC 27001:2022 (Annex A)

Implementasi SMKI SICA memprioritaskan klausul kendali Annex A berikut:
- **A.5 Kendali Organisasional**: Kebijakan keamanan informasi (5.1), peran dan tanggung jawab (5.2), pemisahan tugas (5.3), hubungan dengan pemasok (5.19–5.22), kepatuhan terhadap hukum dan privasi (5.31–5.34).
- **A.6 Kendali Personel**: Penyaringan latar belakang (6.1), syarat ketenagakerjaan (6.2), kesadaran dan pelatihan keamanan informasi (6.3).
- **A.7 Kendali Fisik**: Keamanan fasilitas pemrosesan data (didelegasikan ke cloud provider Tier-IV bersertifikasi ISO 27001/SOC 2).
- **A.8 Kendali Teknis**: Pengendalian akses pengguna (8.2–8.5), perlindungan malware (8.7), manajemen kerentanan teknis (8.8), konfigurasi aman (8.9), penghapusan data aman (8.10), enkripsi kriptografis (8.24), pengembangan perangkat lunak aman (8.25–8.31).

### 6.3 Spesifikasi Audit Logging & Bukti Kepatuhan

Setiap operasi tulis dan akses kritis wajib dicatat pada tabel `audit_logs` secara otomatis dengan spesifikasi berikut:

1. **Cakupan Peristiwa yang Wajib Dicatat**:
   - **Autentikasi & Sesi**: Login, logout, kegagalan login, verifikasi MFA, reset password, dan pencabutan sesi.
   - **Administrasi Akses**: Penambahan user, perubahan role, penugasan hak akses (*assignment*), dan persetujuan perubahan kewenangan.
   - **Siklus Akademik**: Pengajuan, persetujuan, penolakan KRS, perubahan status mahasiswa (Cuti/DO/Lulus), pembukaan/penutupan periode.
   - **Integritas Nilai**: Input nilai, penguncian nilai, serta **alur koreksi nilai pasca-kunci** (menyimpan nilai lama, nilai baru, dan alasan persetujuan Kaprodi).
   - **Transaksi Keuangan**: Penerbitan invoice, penerimaan pembayaran, pembatalan/void invoice, pemberian keringanan/waiver, dan perubahan tarif.
   - **Operasi Platform**: Penggunaan hak break-glass dan impersonasi support.
   - **Ekstraksi Data**: Ekspor data massal (mencatat aktor, entitas sumber, filter kolom, dan jumlah baris data).

2. **Atribut Rekaman Audit**:
   `id`, `tenant_id`, `actor_user_id`, `actor_role_ctx`, `target_entity`, `target_id`, `action`, `before_state (jsonb)`, `after_state (jsonb)`, `reason`, `request_id`, `ip_hash`, `user_agent_hash`, `occurred_at`, `prev_hash`, `hash`.

3. **Karakteristik Keamanan Audit**:
   - **Append-Only**: Peran aplikasi runtime (`sica_app`) tidak memiliki hak akses `UPDATE` maupun `DELETE` di tingkat database.
   - **Tamper-Evident Cryptographic Chain**: Setiap baris audit diverifikasi dengan rantai hash SHA-256 (`prev_hash` ke baris sebelumnya).
   - **WORM Storage Mirroring**: Log audit disinkronkan ke object storage Write-Once-Read-Many (WORM) dengan retensi minimum 5 tahun.

### 6.4 Jadwal & Ruang Lingkup Penetration Testing (Pentest Cadence)

Untuk memastikan ketahanan sistem secara berkelanjutan dan memenuhi standar kepatuhan institusional:

| Jenis Pengujian | Frekuensi | Pelaksana | Ruang Lingkup & Fokus Pengujian |
|---|---|---|---|
| **Automated Vulnerability Scan** | Mingguan (CI/CD & staging) | Tim Internal (Trivy, OWASP ZAP, Snyk) | Pemindaian container image, analisis dependensi (CVE), SAST/DAST otomatis. |
| **Internal Penetration Testing** | **Kuartalan (Q1–Q4)** | Tim Internal Security SICA | Validasi ketat isolasi multi-tenant (uji bypass RLS), uji regresi OWASP ASVS L2, simulasi privilege escalation, dan fuzzing API kritis. |
| **External Independent Pentest** | **Tahunan (1× per tahun)** | Firma Keamanan Siber Independen (Akreditasi BSSN / CREST) | Audit Black-box & Grey-box menyeluruh pada seluruh surface API, aplikasi web portal, pengujian eksfiltrasi data, dan penerbitan laporan audit formal. |

---

## 7. Klasifikasi Data & Pelindungan Privasi (UU PDP No. 27/2022 & PP 33/2026)

### 7.1 Matriks Klasifikasi Data SICA

| Klasifikasi | Contoh Elemen Data | Mekanisme Perlindungan | Hak Akses | Kebijakan Retensi |
|---|---|---|---|---|
| **Terbatas-Tinggi** | Hash password, refresh token, MFA secret, API key, kunci enkripsi KMS. | Hash Argon2id, enkripsi KMS envelope, tidak pernah dicatat di log. | Sistem internal runtime saja. | Pendek (sesuai siklus rotasi token/kunci). |
| **Pribadi Sensitif** | NIK, riwayat kesehatan mahasiswa, data rekening bank, catatan sanksi/pelanggaran. | Enkripsi field-level (AES-256-GCM), data masking di antarmuka UI. | Peran berwenang khusus, wajib tercatat audit trail. | Sesuai masa studi + ketentuan perundang-undangan. |
| **Pribadi Akademik** | Nama lengkap, NIM, email, nomor telepon, foto profil, nama orang tua/wali. | Enkripsi TLS in-transit, enkripsi volume at-rest, otorisasi RBAC berbasis scope. | Mahasiswa bersangkutan, dosen PA, dan pejabat akademik terkait. | **Permanen** (bagian dari rekaman akademik). |
| **Rekaman Inti** | Riwayat nilai, KHS, transkrip nilai, nomor ijazah nasional, ledger keuangan. | Integritas mutlak: immutable record, versioned snapshot, tanda tangan digital SHA-256. | Pemilik data dan pejabat berwenang institusi. | **Permanen** (mandat BR-R12 untuk ijazah/transkrip/SKPI; tagihan ≥10 tahun/JRA). |
| **Operasional** | Log aplikasi, metrik performa server, status antrean worker. | Redaksi PII otomatis, agregasi metrik, pembersihan berkala. | Tim engineering dan DevOps. | 30 hingga 90 hari kalender. |

### 7.2 Dasar Hukum Pemrosesan Data Pribadi (UU PDP Pasal 20)

Dalam arsitektur SICA, dasar hukum pemrosesan data akademik inti **bukan persetujuan (consent)**, melainkan **pemenuhan kewajiban hukum** (pelaporan resmi ke PDDIKTI) dan **pelaksanaan perjanjian pendidikan** antara perguruan tinggi dan mahasiswa:

| Kategori Data | Dasar Hukum Pemrosesan | Memerlukan Persetujuan (*Consent*)? | Implikasi Desain Perangkat Lunak |
|---|---|---|---|
| **Rekaman Akademik & Nilai** | Kewajiban Hukum & Kontrak Belajar | **Tidak** | Penarikan persetujuan (*withdraw consent*) tidak dapat digunakan untuk membatalkan pencatatan riwayat akademik resmi. |
| **Data Keuangan & Pembayaran** | Kontrak & Kewajiban Hukum | **Tidak** | Termasuk data spesifik keuangan pribadi; wajib dilindungi dengan enkripsi field-level dan pembatasan akses ketat. |
| **Tracer Study & Alumni** | Persetujuan (*Consent*) | **Ya (Opsional)** | Sistem menyediakan opsi persetujuan yang dapat ditarik sewaktu-waktu oleh alumni tanpa mempengaruhi legalitas data kelulusan. |
| **Publikasi Prestasi / Foto Publik** | Persetujuan Eksplisit | **Ya** | Pengaturan preferensi privasi mandiri per mahasiswa; default sistem adalah tertutup/minimal. |

> [!NOTE]
> **Prinsip Hak Penghapusan Data (Right to Erasure) dalam Domain Akademik:**
> Sesuai UU PDP Pasal 42–44 jo. UU Kearsipan No. 43/2009, hak penghapusan data dibatasi oleh kewajiban penyimpanan arsip statis nasional. Arsip kelulusan (Ijazah, Transkrip, SKPI) wajib disimpan secara permanen. Oleh karena itu, permintaan penghapusan data akademik ditangani melalui mekanisme **anonymize-for-display dan pembatasan pemrosesan operasional**, bukan penghapusan fisik dari basis data.

### 7.3 Kewajiban Kepatuhan Pengembang & Penyedia Layanan (SaaS Provider)

SICA dirancang untuk memenuhi seluruh kewajiban hukum penyelenggara sistem elektronik dan pengolah data pribadi:

1. **Pemisahan Peran Pengendali dan Prosesor Data**:
   - Perguruan Tinggi bertindak sebagai **Pengendali Data Pribadi (*Data Controller*)**.
   - SICA bertindak sebagai **Prosesor Data Pribadi (*Data Processor*)**.
   - Hubungan kedua pihak diikat melalui *Data Processing Agreement* (DPA) formal yang menjamin kepatuhan terhadap standar keamanan teknis.
2. **Katalog Pemrosesan Data (*Record of Processing Activities* / RoPA)**:
   Modul administrasi menyediakan registri pemrosesan per tenant (`data_processing_bases`) yang mendokumentasikan tujuan pemrosesan, kategori data, dan masa retensi.
3. **Alur Pemenuhan Hak Subjek Data**:
   Penyediaan modul `data_subject_requests` untuk memfasilitasi hak akses, hak koreksi data tidak akurat, hak pembatasan pemrosesan, dan hak portabilitas data dalam format terbuka (JSON/CSV).
4. **Prosedur Notifikasi Insiden Siber (≤ 3×24 Jam)**:
   SOP penanganan kegagalan perlindungan data pribadi dengan notifikasi tertulis kepada Badan Pelindungan Data Pribadi dan institusi kampus terdampak paling lambat dalam waktu 72 jam sejak insiden terkonfirmasi.
5. **Data Protection Officer (DPO) & DPIA**:
   Penyediaan fungsi pengawasan privasi independen dan pelaksanaan *Data Protection Impact Assessment* (DPIA) secara berkala sebelum merilis modul baru yang memproses data berskala besar.
6. **Kedaulatan & Lokasi Data (*Data Residency*)**:
   Seluruh infrastruktur basis data dan penyimpanan arsip berlokasi fisik di wilayah hukum Republik Indonesia pada pusat data Tier-IV yang terdaftar resmi sebagai Penyelenggara Sistem Elektronik (PSE) di Kementerian Komunikasi dan Digital.
7. **Pemberlakuan Regulasi PP No. 33/2026**:
   Peraturan Pemerintah pelaksana UU PDP berlaku efektif per **16 Januari 2027** dengan sanksi denda administratif hingga **2% dari total pendapatan atau aset tahunan**. Seluruh arsitektur SICA dirancang patuh penuh sebelum tenggat waktu tersebut.

---

## 8. Analisis Benchmark Pasar & Keunggulan Kompetitif SICA

Berdasarkan analisis SLA dan penawaran teknis penyedia SIAKAD terkemuka di pasar (seperti SEVIMA siAkadCloud), berikut perbandingan komparatif standar keandalan dan arsitektur SICA:

| Parameter Evaluasi | Standar Industri Pasar | Standar Keunggulan SICA | Manfaat Strategis bagi Perguruan Tinggi |
|---|---|---|---|
| **Komitmen Uptime (SLA)** | 99,0% per bulan (toleransi downtime ~7,2 jam/bulan) | **99,5% pada periode aktif** (toleransi downtime <3,6 jam/bulan) | Ketersediaan tinggi pada momen puncak Open Wiring dan pembayaran UKT. |
| **Dukungan Operasional** | Hari kerja 07.30–21.00 WIB | Jam operasional standar + **Dukungan Siaga (On-Call) SEV1 24/7** | Jaminan respons cepat saat periode penutupan nilai dan pelaporan semester. |
| **Strategi Cadangan (Backup)** | Backup 3× per hari, retensi 90 hari | **Point-in-Time Recovery (PITR) + Retensi Arsip Inti Permanen** | Rekaman akademik terlindungi permanen; rollback granular hingga hitungan detik. |
| **Waktu Pemulihan (RTO)** | Maksimum 4 jam | **RTO ≤ 4 jam dengan Uji Restore Kuartalan Terdokumentasi** | Bukti kesiapan pemulihan bencana yang tervalidasi, bukan sekadar komitmen di atas kertas. |
| **Isolasi Multi-Tenancy** | Tidak dipublikasikan secara terbuka | **PostgreSQL Row-Level Security (RLS) + Automated CI Policy Gate** | Jaminan keamanan data antar-kampus yang terisolasi di tingkat kernel database. |
| **Akuntabilitas Jejak Audit** | Log aplikasi standar | **Append-Only Hash-Chained Audit Trail + Portal Audit Mandiri** | Siap diaudit oleh SPI, BPK, KAP, maupun asesor akreditasi BAN-PT/LAM. |
| **Ekosistem API & Integrasi** | API terbatas dengan autentikasi IP manual | **OpenAPI 3.1 Terbuka + Webhook Outbox + Lingkungan Sandbox** | Integrasi mulus dengan ekosistem lokal kampus (perpustakaan, presensi RFID, ERP keuangan). |
| **Kebijakan Kredensial Awal** | Pola bawaan mudah ditebak (NIM + Tanggal Lahir); ganti akun lewat tiket vendor | **Kata sandi awal acak kriptografis; aktivasi mandiri via email resmi** | Menutup celah pengambilalihan akun (*account takeover*) massal sejak hari pertama. |
| **Autentikasi Ganda (MFA)** | OTP email opsional | **FIDO2 / WebAuthn Passkey + TOTP Wajib untuk Peran Administratif** | Perlindungan berlapis terhadap kebocoran kata sandi administrator institusi. |
| **Impersonasi Akses Bantuan** | Fitur 'Login As' tanpa restriksi transparan | **Akses terbatas berbasis tiket, waktu kedaluwarsa pendek, dan audit ganda** | Mencegah penyalahgunaan kewenangan oleh operator penyedia layanan. |
| **Integrasi Identitas Kampus** | Penautan akun manual | **Dukungan Federasi Single Sign-On (SAML 2.0 / OpenID Connect)** | Terhubung langsung dengan Google Workspace atau Microsoft 365 milik institusi. |
| **Portabilitas Data (*Data Exit*)** | Mekanisme migrasi keluar tidak terdefinisi | **Ekspor Mandiri Lengkap (CSV, PDF, Hash Manifest)** | Menghilangkan risiko vendor lock-in; institusi memiliki kendali penuh atas datanya. |

---

## 9. Tata Kelola Keamanan Siklus Hidup Perangkat Lunak (Secure SDLC)

Untuk memastikan bahwa seluruh klaim keamanan dapat dibuktikan secara objektif:

### 9.1 Kebijakan Kendali Pipeline CI/CD (Blocking Gates)
1. **Verifikasi Tipe Data Ketat**: Pemeriksaan TypeScript dengan konfigurasi `strict: true`, `noUncheckedIndexedAccess`, dan pelarangan tipe `any`.
2. **Linting Arsitektur & Kueri**: Penegakan aturan larangan interpolasi SQL mentah (`sql.raw`) dan larangan impor lintas batas modul.
3. **Automated Unit & Integration Testing**: Pengujian integrasi terhadap database PostgreSQL nyata via Testcontainers, mencakup verifikasi matriks izin dan isolasi RLS 2-tenant.
4. **Security Scans Otomatis**:
   - SAST (*Static Application Security Testing*) pada setiap pull request.
   - Secret scanning untuk mencegah kebocoran kredensial ke repositori.
   - Audit ketergantungan otomatis (`pnpm audit`) untuk memblokir kerentanan berstatus *High* dan *Critical*.
   - Pembuatan *Software Bill of Materials* (SBOM) berstandar CycloneDX pada setiap build.
5. **Migration Verification Gate**: Validasi otomatis eksekusi migrasi skema dan uji pembalikan (*rollback dry-run*) pada lingkungan staging.

### 9.2 Peninjauan Khusus (*Human Review Gate*)
Persetujuan manual dari Tech Lead / Security Officer diwajibkan untuk setiap perubahan yang menyentuh:
- Skema basis data dan RLS security policy di `packages/db`.
- Logika formulasi perhitungan nilai, IPK, dan predikat kelulusan di `packages/domain`.
- Buku besar keuangan (*ledger*) dan penanganan webhook pembayaran di `modules/finance`.
- Matriks izin RBAC/ABAC di `core/authz`.
- Pemetaan data sinkronisasi PDDIKTI Neo Feeder.

### 9.3 Suite Uji Keamanan Regresi Otomatis
Suite pengujian otomatis mencakup skenario keamanan berikut pada setiap rilis:
- Uji isolasi akses lintas tenant (percobaan akses resource Tenant B oleh user Tenant A harus menghasilkan respons `404 Not Found`).
- Uji pencegahan manipulasi ID (*Insecure Direct Object Reference* / IDOR).
- Uji idempotensi callback pembayaran (mencegah pencatatan saldo ganda akibat pengiriman ulang webhook).
- Uji ketahanan kuota enrollment kelas di bawah beban konkurensi tinggi.
- Uji pemblokiran bypass gerbang keuangan dan cekal administrasi.
- Uji penolakan modifikasi rekaman audit dari peran aplikasi.
- Uji sanitasi formula Excel/CSV untuk mencegah *Formula Injection*.
