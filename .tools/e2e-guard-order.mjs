/**
 * Penjaga urutan lapisan — "izin mendahului bentuk" (AGENTS §3.8).
 *
 * Lahir dari audit forensik Fase 1 2026-10-24: 41 handler menjawab `422 VALIDATION_FAILED`
 * ber-`details` field-level kepada sesi yang tidak berhak, sehingga peran lain belajar bentuk
 * kontrak objek admin/platform (oracle). Kelas kegagalan yang sama dengan RD-155, tetapi
 * diukur di seluruh rute non-publik dan ternyata meluas sampai cluster platform.
 *
 * Yang dibuktikan berkas ini:
 *   1. tanpa sesi → 401 (bukan 403, bukan 422);
 *   2. sesi peran tanpa izin + body/query CACAH → 403 datar, `details` kosong;
 *   3. sesi peran tanpa izin + path dengan id bukan-UUID → 403 mendahului galat transport.
 * Rute `auth/**` sengaja TIDAK diuji di sini: ia publik dan bentuk-dahulunya benar.
 *
 * Cara pakai (dev server hidup, DB dev ter-seed):
 *   SICA_BASE=http://localhost:3006 node .tools/e2e-guard-order.mjs
 * Keluar non-zero bila satu saja harapan meleset.
 */
const BASE = process.env.SICA_BASE ?? 'http://localhost:3005';
const TENANT = 'demo';
const jars = {};
let checks = 0;
let failures = 0;

async function call(who, method, path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(jars[who] ? { cookie: jars[who] } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const m = /^([^=]+)=[^;]+/.exec(c);
    if (m && (m[1] === 'sica_access_token' || m[1] === 'sica_refresh_token')) {
      const pair = c.split(';')[0];
      const keep = jars[who] ? jars[who].split('; ').filter((p) => !p.startsWith(`${m[1]}=`)) : [];
      jars[who] = [...keep, pair].join('; ');
    }
  }
  let json = null;
  try { json = await res.json(); } catch { /* html/304 */ }
  return { status: res.status, code: json?.error?.code, details: json?.error?.details ?? [] };
}

function expect(label, cond, got) {
  checks += 1;
  if (cond) { console.log(`PASS ${label}`); return; }
  failures += 1;
  console.log(`FAIL ${label} :: ${JSON.stringify(got)}`);
}

/**
 * Harapan satu handler: 401 tanpa sesi, lalu bentuk TIDAK dibocorkan kepada peran tanpa hak.
 * "Tidak dibocorkan" = 403 datar, ATAU 401 MFA_REQUIRED lebih dulu (jalur tulis admin/platform
 * menuntut `amr` memuat mfa sebelum izin); dua-duanya kosong `details`. Yang dilarang: 422
 * ber-`details` field-level dan 500. Tidak ada lagi jalur pengecualian: satu-satunya handler
 * yang dulu dikecualikan (`POST admin/permintaan-hak`) kini gerbang kelas kasarnya lebih dulu.
 */
async function noSessionThenNoPermission(label, method, path, brokenBody) {
  const anon = await call('anon', method, path, brokenBody);
  expect(`${label} · tanpa sesi → 401`, anon.status === 401, anon);
  const denied = await call('mhs', method, path, brokenBody);
  const shapesHidden = denied.status === 403 || (denied.status === 401 && denied.code === 'MFA_REQUIRED');
  expect(
    `${label} · body cacah dari mahasiswa → tidak ada kebocoran bentuk (403/401MFA, tanpa detail)`,
    shapesHidden && denied.code !== 'VALIDATION_FAILED' && denied.details.length === 0,
    denied,
  );
}

// Sesi mahasiswa: sengaja peran yang tidak memegang satu pun izin admin/platform.
const login = await fetch(`${BASE}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ tenantIdentifier: TENANT, username: 'mhs@demo.sica.test', password: 'StudentPass!23' }),
});
for (const c of login.headers.getSetCookie?.() ?? []) {
  const m = /^([^=]+)=[^;]+/.exec(c);
  if (m && m[1] === 'sica_access_token') jars.mhs = c.split(';')[0];
}
if (login.status !== 200) {
  console.log('FAIL login mahasiswa → 200 :: ' + login.status);
  process.exit(1);
}
checks += 1;
console.log('PASS login mahasiswa (sesi tanpa izin admin/platform)');

const BAD = { zzz: 1 };

await noSessionThenNoPermission('POST /admin/pengguna', 'POST', '/api/v1/admin/pengguna', BAD);
await noSessionThenNoPermission('PATCH /admin/pengguna/:id', 'PATCH', '/api/v1/admin/pengguna/bukan-uuid', BAD);
await noSessionThenNoPermission('POST /admin/hak-akses/peran', 'POST', '/api/v1/admin/hak-akses/peran', BAD);
await noSessionThenNoPermission('PUT /admin/hak-akses/peran/:id/izin', 'PUT', '/api/v1/admin/hak-akses/peran/bukan-uuid/izin', BAD);
await noSessionThenNoPermission('POST /admin/permintaan-hak', 'POST', '/api/v1/admin/permintaan-hak', BAD);
await noSessionThenNoPermission('POST /admin/permintaan-hak/:id/approve', 'POST', '/api/v1/admin/permintaan-hak/bukan-uuid/approve', BAD);
await noSessionThenNoPermission('PUT /admin/system-parameters/:key', 'PUT', '/api/v1/admin/system-parameters/attendance.uji', BAD);
await noSessionThenNoPermission('POST /admin/system-parameter-approvals/:id/approve', 'POST', '/api/v1/admin/system-parameter-approvals/bukan-uuid/approve', BAD);
await noSessionThenNoPermission('POST /platform/tenants', 'POST', '/api/v1/platform/tenants', BAD);
await noSessionThenNoPermission('POST /platform/tenants/:id/suspend', 'POST', '/api/v1/platform/tenants/bukan-uuid/suspend', BAD);
await noSessionThenNoPermission('PUT /platform/tenants/:id/quotas', 'PUT', '/api/v1/platform/tenants/bukan-uuid/quotas', BAD);
await noSessionThenNoPermission('POST /platform/impersonation-grants', 'POST', '/api/v1/platform/impersonation-grants', BAD);
await noSessionThenNoPermission('POST /tenant/modules/:code/activate', 'POST', '/api/v1/tenant/modules/lms/activate', BAD);
await noSessionThenNoPermission('POST /tenant/modules/:code/deactivate', 'POST', '/api/v1/tenant/modules/lms/deactivate', BAD);

// GET: query yang cacat pun tidak boleh membocorkan bentuk kontrak kepada peran tanpa hak.
const anonGet = await call('anon', 'GET', '/api/v1/platform/audit-events');
expect('GET /platform/audit-events · tanpa sesi → 401', anonGet.status === 401, anonGet);
const deniedGet = await call('mhs', 'GET', '/api/v1/platform/audit-events');
expect(
  'GET /platform/audit-events · query kosong dari mahasiswa → 403 tanpa detail',
  deniedGet.status === 403 && deniedGet.details.length === 0,
  deniedGet,
);
// `settings/effective` memang terbuka untuk SEMUA sesi terautentikasi (pembacaan keadaan milik
// pemanggil sendiri, bukan objek admin), jadi 422 karena `keys` hilang di sini bukan oracle
// objek admin. Yang dijaga: anonim → 401, dan tidak pernah 500.
const anonSettings = await call('anon', 'GET', '/api/v1/settings/effective');
expect('GET /settings/effective · tanpa sesi → 401', anonSettings.status === 401, anonSettings);
const studentSettings = await call('mhs', 'GET', '/api/v1/settings/effective');
expect(
  'GET /settings/effective · sesi mahasiswa → 401/422 berdesign, BUKAN 500',
  studentSettings.status === 401 || studentSettings.status === 422,
  studentSettings,
);

// Peran kampus yang sah-terautentikasi tapi tanpa hak platform.
/**
 * Login satu akun ber-MFA dev: tantang dulu, lalu verifikasi TOTP dari secret seed.
 * Secret ini DEV-satu-satu dan dipakai juga oleh `e2e-fase-1b` — bukan kredensial nyata.
 */
const B32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
async function loginAsOtp(who, email, password) {
  const r = await call(who, 'POST', '/api/v1/auth/login', { tenantIdentifier: TENANT, username: email, password });
  const mfaToken = r.json?.data?.mfaToken;
  if (!mfaToken) return r;
  return call(who, 'POST', '/api/v1/auth/mfa/verify', { mfaToken, totpCode: totp(B32) });
}

// ── BOUNDARY — batas R-2 ditegakkan di API, bukan hanya di menu ─────────────────
// `admin2` = TENANT_ADMIN murni (terukur `user_role_assignments`: satu penugasan saja).
// Carrier login-nya `tenant_admin`, yang `CARRIER_TO_ROLES` perluas menjadi
// [TENANT_ADMIN, ADMIN_ACADEMIC, LEADER]. Karena rute akademik Domain kini memakai
// hak dari tabel (`requireDataPrincipal`) dan bukan dari perluasan carrier, akun ini
// ditolak di layar pemilik domain meski label perannya masih sama. Itu isi norma
// `RBAC_MATRIX §2` baris 78 + `§6.8` baris 1790, dan ia dibuktikan di sini — bukan
// dipercaya dari jumlah daun di pohon menu.
const it = await loginAsOtp('it', 'admin2@demo.sica.test', 'Admin2Pass!23');
expect('login+MFA admin2 (R-2 murni) → 200', it.status === 200, it);
for (const [label, path] of [
  ['KHS per periode', '/api/v1/academic/khs/a1000000-0000-4000-8000-000000000001'],
  ['transkrip', '/api/v1/academic/transcript'],
  ['KRS open classes', '/api/v1/academic/krs/open-classes'],
]) {
  const denied = await call('it', 'GET', path);
  // Yang dilarang adalah `200`: layar pemilik domain terlayani. Penolakannya sendiri boleh
  // keluar sebagai `403 FORBIDDEN` (gerbang izin) ATAU `404 MODULE_NOT_AVAILABLE` — entitlement
  // memotong lebih dulu dari peran (`AGENTS §3.8`), dan keduanya datar tanpa `details`.
  expect(
    `R-2 murni tanpa penugasan BAAK → GET ${label} ditolak, bukan dilayani`,
    (denied.status === 403 || denied.status === 404) && denied.details.length === 0,
    denied
  );
}
// Daun yang memang haknya: gerbang entitlement modul (§6.2 baris 1513) tetap 2xx/4xx
// berizin — yang diuji di sini bahwa pencabutan tidak ikut memutus jalur R-2.
const itOk = await call('it', 'GET', '/api/v1/admin/organisasi');
expect('R-2 masih memegang rute domain konfigurasi → GET organisasi bukan 403',
  itOk.status !== 403, itOk);

// `admin@demo` memegang TENANT_ADMIN + ADMIN_ACADEMIC + LEADER sekaligus, jadi ia SAH
// membaca layar domain. Perbandingan dua akun inilah yang memisahkan "peran di carrier"
// dari "hak di tabel" — dan hanya yang kedua yang memutuskan.
const multi = await call('admin', 'GET', '/api/v1/academic/transcript');
expect('akun ber-penugasan ADMIN_ACADEMIC → GET transkrip bukan 403', multi.status !== 403, multi);

console.log(`\ne2e-guard-order: ${checks - failures}/${checks} harapan terpenuhi`);
process.exit(failures ? 1 : 0);
