/**
 * apply-rbac-m03.mjs — menutup lubang RBAC untuk M-03 (Hak Akses & RBAC).
 *
 * Yang diperbaiki, semuanya di `docs/RBAC_MATRIX.md`:
 *   (a) tabel kebutuhan `§4.2 identity` masih menyimpang dari kontrak normatif
 *       (`packages/contracts/src/authz.ts:126–151`): `mfa.manage` ditulis C,D padahal UPDATE,
 *       `accessrequest.approve` ditulis U padahal VALIDATE, `password.reset` dan `loginstats.view`
 *       tidak tercantum, dan impersonasi ditulis C,D padahal OTHER;
 *   (b) 26 kode `identity.*` yang SUDAH normatif tidak punya satu pun baris ber-nomor, sehingga
 *       menu §6 dan API_SPEC tidak dapat menunjuk titik aksi (`AGENTS §3.8`). Baris 329–352
 *       ditambahkan sebagai PADANAN (mirror), bukan promosi: angka usulan tetap 291, target 513;
 *   (c) `identity.accessrequest.*` dipakai untuk dua keputusan berbeda — perubahan hak dan DSAR.
 *       DSAR dipindah ke usulan `audit.dsar.view/.decide` (M-05) dan celah `G-31` didaftarkan;
 *   (d) row 317/318 (impersonasi) diselaraskan ke verba kontrak `OTHER` dan berstatus mirror;
 *   (e) baris menu §6 untuk M-03 diberi label eksplisit + baris `/admin/permintaan-hak` ditambah,
 *       supaya atribusi menu tidak lagi menebak lewat resource/SKU.
 *
 * Semua edit berjangkar; satu jangkar meleset = tidak ada yang ditulis.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const T = 'docs/RBAC_MATRIX.md';
let text = readFileSync(T, 'utf8');
const must = (needle, value, label) => {
  const n = text.split(needle).length - 1;
  if (n !== 1) { console.error('MERAH — jangkar ' + label + ' cocok ' + n + ' kali. Berkas tidak ditulis.'); process.exit(1); }
  text = text.replace(needle, value);
};

/* ---------- (0) header: rentang celah ---------- */
must('celah kini `G-01…G-30`.',
  '§4.5.8 menambahkan **24 baris padanan bernomor** untuk kode `identity.*` yang **sudah normatif** di kontrak (bukan promosi; usulan tetap 291, target promosi tetap 513, total baris katalog 328 → 352); celah kini `G-01…G-31`.',
  'rentang celah header');

/* ---------- (a) tabel kebutuhan §4.2 identity = cermin 26 kode normatif ---------- */
const LAMA_IDENTITAS = [
  '**`identity`** — users, tenant_memberships, roles, permissions, assignments, sessions, mfa',
  '',
  '| Permission | Aksi | Sumber daya |',
  '|---|---|---|',
  '| `identity.profile.view` / `.update` | R, U | Profil & akun sendiri |',
  '| `identity.session.view` / `.revoke` | R, D | Perangkat aktif & riwayat login |',
  '| `identity.mfa.manage` | C, D | Faktor TOTP/WebAuthn & recovery code |',
  '| `identity.user.view` / `.create` / `.update` / `.deactivate` | C R U | Induk akun |',
  '| `identity.membership.view` / `.create` / `.update` | C R U | Keanggotaan + `member_code` |',
  '| `identity.role.view` / `.create` / `.update` / `.delete` | C R U D | Role sistem vs kustom (`is_system` melarang delete) |',
  '| `identity.permission.view` | R | Katalog permission |',
  '| `identity.assignment.view` / `.grant` / `.revoke` | C R D | Penugasan role ber-scope + masa berlaku |',
  '| `identity.accessrequest.view` / `.approve` | R, U | `access_change_requests` (alur empat-mata) |',
  '| `identity.impersonation.grant` / `.revoke` | C, D | `impersonation_grants` dengan `grant_kind=\'PLATFORM_SUPPORT\'` (nama `platform_support_grants` **kalah**, `DATA_MODEL §14.7`); titik aksinya kini ber-nomor **317–318** di §4.5.3 (khusus platform) |',
].join(NL);

const BARU_IDENTITAS = [
  '**`identity`** — users, tenant_memberships, roles, permissions, assignments, sessions, mfa',
  '',
  '| Permission | Aksi | Sumber daya |',
  '|---|---|---|',
  '| `identity.profile.view` / `.update` | R, U | Profil & akun sendiri |',
  '| `identity.password.reset` | U | Ganti/reset kata sandi; reset paksa oleh admin dijaga `identity.user.update` + MFA |',
  '| `identity.session.view` / `.revoke` | R, D | Perangkat aktif & riwayat login |',
  '| `identity.mfa.manage` | U | Faktor TOTP/WebAuthn & recovery code — satu aksi kelola (`UPDATE`), bukan `INSERT`/`DELETE` terpisah |',
  '| `identity.loginstats.view` | R | Statistik login & perangkat (agregat, `resource=\'admin.monitoring\'`) |',
  '| `identity.user.view` / `.create` / `.update` / `.deactivate` | C R U | Induk akun; `deactivate` = `UPDATE` status, bukan `DELETE` |',
  '| `identity.membership.view` / `.create` / `.update` | C R U | Keanggotaan + `member_code` |',
  '| `identity.role.view` / `.create` / `.update` / `.delete` | C R U D | Role sistem vs kustom (`is_system` melarang delete) |',
  '| `identity.permission.view` | R | Katalog permission |',
  '| `identity.assignment.view` / `.grant` / `.revoke` | R C D | Penugasan role ber-scope + masa berlaku |',
  '| `identity.accessrequest.view` / `.approve` | R, VALIDATE | `access_change_requests` (alur empat-mata). **Bukan** DSAR: DSAR memakai usulan `audit.dsar.*` (`G-31`) |',
  '| `identity.impersonation.grant` / `.revoke` | OTHER | `impersonation_grants` dengan `grant_kind=\'PLATFORM_SUPPORT\'` (nama `platform_support_grants` **kalah**, `DATA_MODEL §14.7`); titik aksinya ber-nomor **317–318** di §4.5.3 (khusus platform) |',
  '',
  'Tabel ini **cermin baca** dari 26 kode normatif di [`packages/contracts/src/authz.ts`](file:///C:/SICA/packages/contracts/src/authz.ts) baris 126–151, bukan katalog kedua. Baris ber-nomor untuk 24 di antaranya ada di §4.5.8 (**329–352**, status `normatif (mirror)`), dan dua sisanya di §4.5.3 (**317–318**, kini juga `normatif (mirror)`). `identity.assignment.scope` (baris 112) **tidak** termasuk 26 kode itu: ia masih usulan dan tidak boleh dipakai kode sampai dipromosikan.',
].join(NL);
must(LAMA_IDENTITAS, BARU_IDENTITAS, 'tabel kebutuhan identity §4.2');

/* ---------- (b) §4.5.8 padanan bernomor 24 kode identity ---------- */
const H38 = [
  '',
  '#### 4.5.8 Padanan bernomor katalog inti identitas (baris 329–352) — M-03 — 2026-10-22',
  '',
  '**Status: NORMATIF (MIRROR) — bukan promosi.** Dua puluh empat kode `identity.*` di bawah **sudah** menjadi bagian dari **222 izin normatif** lewat `PERMISSION_SPECS` ([authz.ts](file:///C:/SICA/packages/contracts/src/authz.ts) baris 126–149). Yang hilang selama ini adalah **nomor baris**, sehingga menu §6, `API_SPEC`, dan laporan modul tidak dapat menunjuk titik aksi tanpa mengutip kode telanjang (`AGENTS §3.8`). Karena itu baris ini tidak menambah kode, tidak menambah grant, dan **tidak** menaikkan target promosi: usulan tetap **291** (`§4.5` 161 + `§4.5.1` 130), target tetap **513** (222 normatif + 291 usulan), sedangkan total baris katalog menjadi **352**. Verba di bawah dibaca dari kontrak, bukan dikarang di sini; `identity.assignment.scope` (112) sengaja **tidak** ikut karena masih usulan.',
  '',
  '| # | Permission | Modul | `resource` | `verb` | FR/acuan | Pemegang · scope | Gerbang (MFA · SoD) | Status |',
  '|---|---|---|---|---|---|---|---|---|',
  '| 329 | `identity.profile.view` | `identity` | `identity.profile` | `READ` | FR-IDT-01 · M-03 · **AC-ADM-6** | Semua peran (`SELF`) | MFA tidak · hanya profil sendiri; PII peran lain tidak ikut proyeksi | normatif (mirror) |',
  '| 330 | `identity.profile.update` | `identity` | `identity.profile` | `UPDATE` | FR-IDT-01 · M-03 | Semua peran (`SELF`) | MFA tidak · kolom `SERVER_ONLY` tidak diterima dari body | normatif (mirror) |',
  '| 331 | `identity.password.reset` | `identity` | `identity.profile` | `UPDATE` | FR-IDT-01 · M-03 | Semua peran (`SELF`); reset paksa oleh `TENANT_ADMIN` lewat `identity.user.update` | MFA ya untuk reset paksa · sesi lama dicabut setelah sandi berubah | normatif (mirror) |',
  '| 332 | `identity.session.view` | `identity` | `identity.session` | `READ` | FR-IDT-01 · M-03 | Semua peran (`SELF`); `TENANT_ADMIN` (`TENANT`) | MFA tidak · perangkat, agen, IP terakhir | normatif (mirror) |',
  '| 333 | `identity.session.revoke` | `identity` | `identity.session` | `DELETE` | FR-IDT-01 · M-03 · **AC-ADM-6** | Semua peran (`SELF`); `TENANT_ADMIN` atas sesi pengguna tenant | MFA ya bila mencabut sesi orang lain · token berikutnya ditolak, baris sesi tidak dihapus | normatif (mirror) |',
  '| 334 | `identity.mfa.manage` | `identity` | `identity.mfa` | `UPDATE` | FR-IDT-01 · M-03 | Semua peran (`SELF`) | MFA ya · enrolmen baru tidak boleh menghapus faktor terakhir; `mfa_factors.secret` `SERVER_ONLY` | normatif (mirror) |',
  '| 335 | `identity.loginstats.view` | `identity` | `admin.monitoring` | `READ` | FR-RPT-02 · M-03 | `TENANT_ADMIN`, `ADMIN_ACADEMIC`, `LEADER` (agregat) | MFA tidak · agregat; tanpa PII per-record | normatif (mirror) |',
  '| 336 | `identity.user.view` | `identity` | `admin.pengguna` | `READ` | FR-IDT-03 · M-03 · **AC-ADM-6** | `TENANT_ADMIN` (`TENANT`); `ADMIN_ACADEMIC`/`PMB_OPERATOR` (`ORG`, akun tupoksi) | MFA tidak · PII diproyeksikan per peran (§7.4) | normatif (mirror) |',
  '| 337 | `identity.user.create` | `identity` | `admin.pengguna` | `INSERT` | FR-IDT-03 · M-03 · **AC-ADM-6** | `TENANT_ADMIN`; `PMB_OPERATOR` hanya `APPLICANT` pra-NIM | MFA ya · role admin tidak dapat dibuat dari jalur PMB | normatif (mirror) |',
  '| 338 | `identity.user.update` | `identity` | `admin.pengguna` | `UPDATE` | FR-IDT-03 · M-03 · **AC-ADM-6** | `TENANT_ADMIN` | MFA ya · `students.nim`/`students.status_akademik` `SERVER_ONLY` | normatif (mirror) |',
  '| 339 | `identity.user.deactivate` | `identity` | `admin.pengguna` | `UPDATE` | FR-IDT-03 · M-03 · **AC-ADM-6** | `TENANT_ADMIN` | MFA ya · nonaktif ≠ hapus; sesi dicabut; baris tidak dihapus | normatif (mirror) |',
  '| 340 | `identity.membership.view` | `identity` | `admin.pengguna` | `READ` | FR-IDT-03 · M-03 | `TENANT_ADMIN` | MFA tidak | normatif (mirror) |',
  '| 341 | `identity.membership.create` | `identity` | `admin.pengguna` | `INSERT` | FR-IDT-03 · M-03 | `TENANT_ADMIN` | MFA ya · `member_code` unik per tenant | normatif (mirror) |',
  '| 342 | `identity.membership.update` | `identity` | `admin.pengguna` | `UPDATE` | FR-IDT-03 · M-03 | `TENANT_ADMIN` | MFA ya · pindah unit dicatat before/after | normatif (mirror) |',
  '| 343 | `identity.role.view` | `identity` | `admin.hak-akses` | `READ` | FR-IDT-04 · M-03 · **AC-ADM-6** | `TENANT_ADMIN`, `COMPLIANCE_OFFICER` (baca) | MFA tidak · role sistem terlihat terkunci | normatif (mirror) |',
  '| 344 | `identity.role.create` | `identity` | `admin.hak-akses` | `INSERT` | FR-IDT-04 · M-03 · **AC-ADM-6** | `TENANT_ADMIN` | MFA ya · `is_system=false`; izin dipilih dari katalog, bukan string bebas | normatif (mirror) |',
  '| 345 | `identity.role.update` | `identity` | `admin.hak-akses` | `UPDATE` | FR-IDT-04 · M-03 · **AC-ADM-6** | `TENANT_ADMIN` | MFA ya · perubahan izin role = perubahan hak, lewat `access_change_requests` (empat-mata) | normatif (mirror) |',
  '| 346 | `identity.role.delete` | `identity` | `admin.hak-akses` | `DELETE` | FR-IDT-04 · M-03 · **AC-ADM-6** | `TENANT_ADMIN` | MFA ya · hanya `is_system=false`; role terpakai ditolak `409 CONFLICT` | normatif (mirror) |',
  '| 347 | `identity.permission.view` | `identity` | `admin.hak-akses` | `READ` | FR-IDT-04 · M-03 · `G-09` | `TENANT_ADMIN`, `COMPLIANCE_OFFICER` | MFA tidak · katalog + metadata menu; bukan grant | normatif (mirror) |',
  '| 348 | `identity.assignment.view` | `identity` | `admin.hak-akses` | `READ` | FR-ADM-06 · M-03 · **AC-ADM-6** | `TENANT_ADMIN`, `COMPLIANCE_OFFICER` | MFA tidak · termasuk `valid_to` dan scope | normatif (mirror) |',
  '| 349 | `identity.assignment.grant` | `identity` | `admin.hak-akses` | `INSERT` | FR-ADM-06 · M-03 · **AC-ADM-6** | `TENANT_ADMIN` yang ≠ target; persetujuan oleh orang kedua | MFA ya · empat-mata `requested_by <> approved_by`, `approver_id <> target_user_id` (`0082`) | normatif (mirror) |',
  '| 350 | `identity.assignment.revoke` | `identity` | `admin.hak-akses` | `DELETE` | FR-ADM-06 · M-03 · **AC-ADM-6** | `TENANT_ADMIN`; pencabut boleh ≠ pemberi | MFA ya · `DELETE` = menutup `valid_to`; baris tidak dihapus; berlaku pada cek otorisasi berikutnya | normatif (mirror) |',
  '| 351 | `identity.accessrequest.view` | `identity` | `admin.hak-akses` | `READ` | FR-ADM-06 · M-03 · **AC-ADM-6** | Pemohon (`SELF`), `TENANT_ADMIN` (penyetuju) | MFA tidak · alasan + `request_kind` terlihat | normatif (mirror) |',
  '| 352 | `identity.accessrequest.approve` | `identity` | `admin.hak-akses` | `VALIDATE` | FR-ADM-06 · M-03 · **AC-ADM-6** | `TENANT_ADMIN` yang bukan pemohon dan bukan target | MFA ya · terminal `409 DECISION_ALREADY_MADE`; eskalasi scope `403 ADMIN_SCOPE_MISMATCH`; penolakan wajib alasan | normatif (mirror) |',
  '',
].join(NL);
must(NL + '### 4.6 Scope SITE & hak tingkat field gelombang 2 (2026-10-20)', H38 + NL + '### 4.6 Scope SITE & hak tingkat field gelombang 2 (2026-10-20)', 'titik sisip §4.5.8');

/* ---------- (c) usulan DSAR dipisah dari perubahan hak (§4.5.6) ---------- */
must('| `audit.event.view` | `audit.event` | READ | `audit` |',
  '| `audit.dsar.decide` | `audit.dsar` | VALIDATE | `audit` | BELUM DIPUTUS — pemegangnya DPO/`COMPLIANCE_OFFICER`, **bukan** pemohon; dipisah dari `identity.accessrequest.*` (`G-31`) | `API_SPEC 4.6.10 Permintaan Subjek Data (M-05)` |' + NL +
  '| `audit.dsar.view` | `audit.dsar` | READ | `audit` | BELUM DIPUTUS — bahan keputusan DPO: anonimisasi tampilan, bukan hapus arsip | `API_SPEC 4.6.10 Permintaan Subjek Data (M-05)` |' + NL +
  '| `audit.event.view` | `audit.event` | READ | `audit` |',
  'sisip usulan audit.dsar.*');

/* ---------- (d) 317/318: verba kontrak OTHER + status mirror ---------- */
must('`INSERT` | FR-ADM-13 · §4.2 (C,D)',
  '`OTHER` | FR-ADM-13 · §4.2 (OTHER)', 'verba baris 317');
must('`DELETE` | FR-ADM-13 · §6.1',
  '`OTHER` | FR-ADM-13 · §6.1', 'verba baris 318');
must('`DELETE` di sini = menutup grant;',
  '`OTHER` di sini = menutup grant (bukan `DELETE` baris);', 'teks penutup grant 318');
{
  const lines = text.split(NL);
  for (const num of ['317', '318']) {
    const i = lines.findIndex((l) => l.startsWith('| ' + num + ' |'));
    if (i < 0) { console.error('MERAH — baris ' + num + ' tidak ditemukan.'); process.exit(1); }
    if (!lines[i].endsWith('| usulan |')) { console.error('MERAH — baris ' + num + ' tidak berakhir `| usulan |`: ' + lines[i].slice(-40)); process.exit(1); }
    lines[i] = lines[i].slice(0, -'| usulan |'.length) + '| normatif (mirror) |';
  }
  text = lines.join(NL);
}
/* intro §4.5.3: 15 usulan + 2 mirror, bukan 17 usulan */
must('**Tujuh belas baris ini dibutuhkan.** Kajian balik M-01 (2026-10-21) menemukan bahwa **seluruh** permukaan cluster Platform',
  '**Tujuh belas baris ini dibutuhkan, tetapi tidak semuanya usulan.** Dua di antaranya (**317–318**) adalah padanan bernomor dari kode `identity.impersonation.*` yang **sudah** normatif di `PERMISSION_SPECS` (verbanya `OTHER`, sesuai kontrak) — jadi yang menunggu promosi di bagian ini adalah **15 baris**. Kajian balik M-01 (2026-10-21) menemukan bahwa **seluruh** permukaan cluster Platform',
  'intro §4.5.3');

/* ---------- (e) menu §6 + T-3 ---------- */
must('| `COMPLIANCE_OFFICER` 🟡 | `identity` | Pengaturan → Permintaan Subjek Data | R U | `identity.accessrequest.view`, `.approve` | Tangani `data_subject_requests` UU PDP: anonimisasi tampilan, **bukan** hapus arsip |',
  '| `COMPLIANCE_OFFICER` 🟡 | `audit` · M-05 | Pengaturan → Permintaan Subjek Data | R, APPROVE | `audit.dsar.view`, `audit.dsar.decide` (usulan, `G-31`) | Tangani `data_subject_requests` UU PDP: anonimisasi tampilan, **bukan** hapus arsip; **tidak** memegang `identity.accessrequest.*` — pemisahan dari perubahan hak menutup jalur eskalasi `G-31` |',
  'baris menu DSAR');
must('| `PMB_OPERATOR` 🟡 | `identity` | PMB → Akun Pendaftar |',
  '| `PMB_OPERATOR` 🟡 | `identity` · M-09 | PMB → Akun Pendaftar |', 'baris menu akun pendaftar');
must('| `TENANT_ADMIN` | `identity` | Pengaturan → User & Role |',
  '| `TENANT_ADMIN` | `identity` · M-03 | Pengaturan → User & Role |', 'baris menu User & Role');
must('| `TENANT_ADMIN` | `identity` · M-03 | Pengaturan → User & Role | C R U D | `identity.user.*`, `identity.membership.*`, `identity.role.*`, `identity.assignment.grant` | Frabrikasi akun, role kustom (`is_system=false`), penugasan ber-scope + `valid_to`; perubahan hak butuh approval empat-mata |',
  '| `TENANT_ADMIN` | `identity` · M-03 | Pengaturan → User & Role | C R U D | `identity.user.*`, `identity.membership.*`, `identity.role.*`, `identity.assignment.grant` | Frabrikasi akun, role kustom (`is_system=false`), penugasan ber-scope + `valid_to`; perubahan hak butuh approval empat-mata |' + NL +
  '| `TENANT_ADMIN` | `identity` · M-03 | Pengaturan → Permintaan Perubahan Hak | R, APPROVE | `identity.accessrequest.view`, `.approve` (352) | Antrean `access_change_requests` dengan `request_kind` GRANT/REVOKE/SCOPE_CHANGE; **penyetuju ≠ pemohon dan ≠ target**, penolakan wajib alasan, keputusan terminal `409 DECISION_ALREADY_MADE` (**AC-ADM-6**) |',
  'sisip menu permintaan perubahan hak');
must('| F. Pengguna | `/admin/pengguna` | `identity` |',
  '| F. Pengguna | `/admin/pengguna` | `identity` · M-03 |', 'grup F /admin/pengguna');
must('| F. Pengguna | `/admin/pengguna/hak-akses` | `identity` |',
  '| F. Pengguna | `/admin/pengguna/hak-akses` | `identity` · M-03 |', 'grup F /admin/pengguna/hak-akses');
must('| F. Pengguna | `/admin/pengguna/hak-akses` | `identity` · M-03 | `TENANT_ADMIN` (draf) | orang kedua via `access_change_requests` | render `resource × verb × scope` (FR-IDT-04, G-09) |',
  '| F. Pengguna | `/admin/pengguna/hak-akses` | `identity` · M-03 | `TENANT_ADMIN` (draf) | orang kedua via `access_change_requests` | render `resource × verb × scope` (FR-IDT-04, G-09) |' + NL +
  '| F. Pengguna | `/admin/permintaan-hak` | `identity` · M-03 | `TENANT_ADMIN` (penyetuju ≠ pemohon) | orang kedua via `access_change_requests` | antrean empat-mata `request_kind` GRANT/REVOKE/SCOPE_CHANGE; alasan wajib, penolakan beralasan (**AC-ADM-6**) |',
  'sisip grup F /admin/permintaan-hak');
must('| F. Pengguna | `/admin/audit` | `audit` |',
  '| F. Pengguna | `/admin/audit` | `audit` · M-05 |', 'grup F /admin/audit');
must('`audit.verify.view` (107), `identity.accessrequest.view` · [OTHER]',
  '`audit.verify.view` (107), `audit.dsar.view` (usulan) · [OTHER]', 'T-3 izin baca DSAR');
must('[APPROVE] `identity.accessrequest.approve` (DSAR: anonimisasi tampilan, bukan hapus arsip)',
  '[APPROVE] `audit.dsar.decide` (usulan; DSAR: anonimisasi tampilan, bukan hapus arsip) · **tidak** memegang `identity.accessrequest.approve` (`G-31`)', 'T-3 izin setuju DSAR');

/* ---------- (f) celah G-31 ---------- */
const G31 = [
  '| **G-31** | **Satu izin untuk dua keputusan berbeda: perubahan hak vs hak subjek data (DSAR).** Baris menu DSAR §6.1 dan T-3 memakai `identity.accessrequest.view/.approve` — izin yang sama dengan alur empat-mata `access_change_requests`; akibatnya `COMPLIANCE_OFFICER` yang memegangnya dapat menyetujui **pemberian peran**, jalur eskalasi istimewa. Ditutup di dokumen 2026-10-22: DSAR pindah ke usulan `audit.dsar.view` / `audit.dsar.decide` (§4.5.6, `audit` · M-05) dan `COMPLIANCE_OFFICER` tidak lagi memegang `identity.accessrequest.*`; alur perubahan hak tetap `identity.accessrequest.*` + `request_kind` (DATA_MODEL §14.3.3, migrasi `0082`, AC-ADM-6). | Kode `audit.dsar.*` **belum** ada di `PERMISSION_SPECS` — sampai dipromosikan, DSAR tidak boleh dijalankan dengan izin pinjaman; `identity.accessrequest.*` tidak boleh dipakai untuk `data_subject_requests` | Promosi `audit.dsar.view/.decide` ke `packages/contracts/src/authz.ts` + `gen-rbac-seed.mjs` (keputusan pemilik, `CRD-5b`); hapus `identity.accessrequest.*` dari grant `COMPLIANCE_OFFICER`; uji negatif: DPO tidak dapat menyetujui `access_change_requests` |',
  '',
].join(NL);
must(NL + '### 8.3 Rencana implementasi bertahap', G31 + NL + '### 8.3 Rencana implementasi bertahap', 'sisip G-31');

/* ---------- verifikasi ---------- */
const n38 = (text.match(/^\| (3[2-4]\d|35[0-2]) \| `identity\./gm) || []).length;
if (n38 !== 24) { console.error('MERAH — §4.5.8 tidak memuat 24 baris identity (dapat ' + n38 + ').'); process.exit(1); }
const mirrorCells = (text.match(/\| normatif \(mirror\) \|/g) || []).length;
if (mirrorCells !== 26) {
  console.error('MERAH — sel status mirror harus 26 (24 + 2 impersonasi), dapat ' + mirrorCells + '.');
  process.exit(1);
}
if ((text.match(/G-31/g) || []).length < 4) { console.error('MERAH — G-31 tidak terdaftar di header, tabel celah, dan rujukan menu.'); process.exit(1); }
if (text.includes('identity.accessrequest.approve` (DSAR')) { console.error('MERAH — DSAR masih memakai izin perubahan hak.'); process.exit(1); }
writeFileSync(T, text, 'utf8');
console.log('HIJAU — §4.2 identity dicerminkan ke kontrak · §4.5.8 (329–352) ditulis · DSAR pindah ke audit.dsar.* · G-31 didaftarkan · menu M-03 berlabel eksplisit.');
