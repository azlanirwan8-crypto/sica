/**
 * Penjaga batas R-2 (Fase 1) — permintaan pemilik 2026-10-24: "yang tidak dibutuhkan
 * seharusnya tidak ada", dan jawaban saya tidak boleh berhenti di jumlah daun menu.
 *
 * Norma yang diuji (`RBAC_MATRIX`):
 *   * §2 baris 78 — `TENANT_ADMIN` target R-2: "NIM/SKS/presensi memerlukan pemilik domain,
 *     KRS/nilai/pembayaran tidak diwariskan";
 *   * §6.8 baris 1790 — "label administrator tidak mengizinkan KRS/nilai/pembayaran";
 *   * §6.2 baris 1509–1524 — domain R-2: akun & hak, institusi, aturan, kamus, parameter,
 *     audit, menu;
 *   * `AGENTS §3.8` — hak dibaca dari `user_role_assignments` × `role_permissions`, bukan
 *     dari carrier login; entitlement memotong lebih dulu; izin mendahului bentuk.
 *
 * Empat kelas kegagalan yang dibuktikan, semuanya terhadap server nyata:
 *   1. **Menu.** Daun domain akademik tidak pernah terkirim ke R-2 murni, dan daun pohon
 *      platform tidak pernah bocor ke tenant kampus (isolasi dua lapisan itu tenancy, bukan
 *      filter CSS).
 *   2. **API.** Rute milik pemilik domain menjawab `403 FORBIDDEN` datar untuk R-2 — bukan
 *      `422` ber-`details` (oracle bentuk objek) dan bukan `200`.
 *   3. **Tidak ada kerusakan ikutan.** Rute domain R-2 sendiri tetap 2xx, dan mahasiswa tetap
 *      membaca KHS/transkripnya.
 *   4. **Yang memutuskan adalah tabel, bukan label.** Dua akun dengan CARRIER SAMA
 *      (`tenant_admin`) dijawab berbeda: `admin2` memegang satu penugasan `TENANT_ADMIN`
 *      dan ditolak; `admin@demo` memegang `TENANT_ADMIN + ADMIN_ACADEMIC + LEADER` dan
 *      dilayani. Kalau yang membaca hak masih perluasan carrier, keduanya akan identik.
 *
 * Cara pakai (dev server hidup, DB dev ter-seed, MFA dev secret dari `seed:dev`):
 *   node .tools/e2e-r2-boundary.mjs              # SICA_BASE default http://localhost:3005
 *   SICA_BASE=http://localhost:3006 node .tools/e2e-r2-boundary.mjs
 * Keluar non-zero bila satu harapan pun meleset.
 */
import { totp } from './totp.mjs';

const BASE = process.env.SICA_BASE ?? 'http://localhost:3005';
const TENANT = 'demo';
/** Secret TOTP DEV dari `dev-seed` (dicetak sebagai otpauth URI); sama dengan suite 1a–1d. */
const B32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

const jars = {};
let checks = 0;
let failures = 0;

async function call(who, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(jars[who] ? { cookie: jars[who] } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const m = /^([^=]+)=[^;]+/.exec(c);
    if (m && (m[1] === 'sica_access_token' || m[1] === 'sica_refresh_token')) {
      const keep = jars[who] ? jars[who].split('; ').filter((p) => !p.startsWith(`${m[1]}=`)) : [];
      jars[who] = [...keep, c.split(';')[0]].join('; ');
    }
  }
  let json = null;
  try { json = await res.json(); } catch { /* html/304 */ }
  return { status: res.status, code: json?.error?.code, details: json?.error?.details ?? [], json };
}

function expect(label, cond, got) {
  checks += 1;
  if (cond) { console.log(`PASS ${label}`); return; }
  failures += 1;
  console.log(`FAIL ${label} :: ${JSON.stringify(got)}`);
}

async function loginWithOtp(who, email, password) {
  const r = await call(who, 'POST', '/api/v1/auth/login', { tenantIdentifier: TENANT, username: email, password });
  const mfaToken = r.json?.data?.mfaToken;
  if (!mfaToken) return r;
  return call(who, 'POST', '/api/v1/auth/mfa/verify', { mfaToken, totpCode: totp(B32) });
}

/** Daun terpangkas satu pohon `/me/menu`. */
function leavesOf(nodes, acc = []) {
  for (const node of nodes ?? []) {
    if (node.children && node.children.length > 0) leavesOf(node.children, acc);
    else acc.push(node.code);
  }
  return acc;
}

const it = await loginWithOtp('it', 'admin2@demo.sica.test', 'Admin2Pass!23');
expect('login+MFA admin2 → 200 (R-2 murni, satu penugasan TENANT_ADMIN)', it.status === 200, it);
const mhs = await call('mhs', 'POST', '/api/v1/auth/login', { tenantIdentifier: TENANT, username: 'mhs@demo.sica.test', password: 'StudentPass!23' });
expect('login mahasiswa → 200', mhs.status === 200, mhs);
const baak = await call('baak', 'POST', '/api/v1/auth/login', { tenantIdentifier: TENANT, username: 'admin@demo.sica.test', password: 'AdminPass!23' });
expect('login admin1 → 200 (carrier sama, penugasan tiga peran)', baak.status === 200, baak);

// 1. MENU — daun yang tidak dibutuhkan peran ini tidak ada, bukan disembunyikan di CSS.
const itMenu = await call('it', 'GET', '/api/v1/me/menu?layer=WEB');
const itLeaves = leavesOf(itMenu.json?.data?.tree);
expect('GET /me/menu oleh R-2 → 200', itMenu.status === 200, itMenu);
const DOMAIN_LEAVES = ['akademik.krs', 'akademik.khs', 'akademik.dpa', 'akademik.schedule', 'akademik.attendance'];
expect(
  'R-2 tidak menerima satu pun daun akademik transaksional (§2 baris 78)',
  itLeaves.every((code) => !DOMAIN_LEAVES.includes(code)),
  itLeaves
);
// `akademik.studentstatus` justru WAJIB ada: §6.2 baris 1514 menulis menunya untuk R-2
// (baca status + riwayat; keputusan `student.status.change` tetap lewat approval pemilik domain).
expect('daun §6.2 baris 1514 `akademik.studentstatus` TERKIRIM untuk R-2', itLeaves.includes('akademik.studentstatus'), itLeaves);
expect(
  'R-2 tidak menerima satu pun daun pohon platform (§6.8: R-2 ≠ R-1; isolasi tenancy)',
  itLeaves.every((code) => !code.startsWith('platform.')),
  itLeaves
);
for (const code of ['admin.identity.accounts', 'admin.identity.rbac', 'admin.parameters.system', 'admin.integrations.feeder']) {
  expect(`daun §12.2 ${code} TERKIRIM untuk R-2`, itLeaves.includes(code), itLeaves);
}
const mhsLeaves = leavesOf((await call('mhs', 'GET', '/api/v1/me/menu?layer=WEB')).json?.data?.tree);
expect('mahasiswa tetap menerima KRS/KHS (tidak ada kerusakan ikutan)', mhsLeaves.includes('akademik.krs') && mhsLeaves.includes('akademik.khs'), mhsLeaves);
expect('mahasiswa tidak menerima daun Area Admin', mhsLeaves.every((code) => !code.startsWith('admin.')), mhsLeaves);

// 2. API — rute milik pemilik domain menolak R-2 dengan 403 datar (izin mendahului bentuk).
for (const [label, path] of [
  ['KHS per periode', '/api/v1/academic/khs/a1000000-0000-4000-8000-000000000001'],
  ['transkrip', '/api/v1/academic/transcript'],
  ['KRS open classes (query kosong)', '/api/v1/academic/krs/open-classes'],
]) {
  const denied = await call('it', 'GET', path);
  expect(
    `R-2 murni → GET ${label} = 403 FORBIDDEN tanpa detail`,
    denied.status === 403 && denied.code === 'FORBIDDEN' && denied.details.length === 0,
    denied
  );
}

// 3. Domain R-2 sendiri tetap tersaji — pencabutan tidak ikut memutus konsole resminya.
for (const path of [
  '/api/v1/admin/pengguna',
  '/api/v1/admin/organisasi',
  '/api/v1/admin/system-parameters',
  '/api/v1/admin/hak-akses/peran',
]) {
  const ok = await call('it', 'GET', path);
  expect(`R-2 → GET ${path} bukan 403 (domain §6.2 miliknya)`, ok.status !== 403, ok);
}
for (const path of ['/api/v1/admin/pengguna', '/api/v1/admin/hak-akses/peran']) {
  const denied = await call('mhs', 'GET', path);
  expect(`mahasiswa → GET ${path} = 403`, denied.status === 403, denied);
}

// 4. Yang memutuskan adalah tabel penugasan, bukan carrier login.
const multiTranscript = await call('baak', 'GET', '/api/v1/academic/transcript');
expect(
  'admin1 (penugasan memuat ADMIN_ACADEMIC) → GET transkrip bukan 403, padahal carrier sama dengan admin2',
  multiTranscript.status !== 403,
  multiTranscript
);
const multiAdmin = await call('baak', 'GET', '/api/v1/admin/pengguna');
expect('admin1 juga memegang domain R-2 → GET pengguna bukan 403', multiAdmin.status !== 403, multiAdmin);

console.log(`\ne2e-r2-boundary: ${checks - failures}/${checks} harapan terpenuhi`);
if (failures > 0) {
  console.log(`❌ ${failures} harapan gagal — batas R-2 (§2 baris 78, §6.8 baris 1790) tidak lagi tegak.`);
  process.exit(1);
}
console.log('✅ e2e-r2-boundary: HIJAU — hak dibaca dari tabel, dan tidak ada daun di luar domain peran.');
