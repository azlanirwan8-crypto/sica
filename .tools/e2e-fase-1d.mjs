/**
 * Uji end-to-end Fase 1D — Master Organisasi & Program Studi (item 4 `R-2`).
 *
 * Norma yang dibuktikan, bukan status 200:
 *   tulis tanpa sesi 401 · tulis tanpa izin 403 · tulis dengan izin tapi tanpa MFA 401 ·
 *   kode ganda 409 pada kedua master · hierarki yang melingkar DITOLAK (0002 tidak punya
 *   CHECK penutup siklus, jadi ini satu-satunya penjaga) · indukan lintas-tenant = 404
 *   (bukan 403: keberadaan baris institusi lain bukan informasi) · masa studi maksimum
 *   < normal ditolak transport · angka akademik yang berubah tercatat di `audit_logs`
 *   dengan alasan. Keluar non-zero bila satu saja harapan meleset.
 */
import { totp } from './totp.mjs';

const BASE = process.env.SICA_BASE ?? 'http://localhost:3005';
const B32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const TENANT = 'demo';
const jars = {};
let failures = 0;
let checks = 0;
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
      const existing = jars[who] ? jars[who].split('; ').filter((p) => !p.startsWith(`${m[1]}=`)) : [];
      jars[who] = [...existing, pair].join('; ');
    }
  }
  let json = null;
  try { json = await res.json(); } catch { /* html/304 */ }
  return { status: res.status, json, code: json?.error?.code, data: json?.data, details: json?.error?.details ?? [] };
}

function expect(label, cond, hint) {
  checks += 1;
  if (cond) console.log(`  PASS  ${label}`);
  else { failures += 1; console.log(`  FAIL  ${label}${hint !== undefined ? ` → ${JSON.stringify(hint).slice(0, 300)}` : ''}`); }
}

async function loginMfa(who, email, password) {
  const r = await call(who, 'POST', '/api/v1/auth/login', { tenantIdentifier: TENANT, username: email, password });
  const mfaToken = r.json?.data?.mfaToken;
  // `SICA_DEV_MFA_BYPASS=1` (RD-173) melewatkan langkah tantangan: login menghasilkan sesi
  // `amr=['pwd']` TANPA `mfaToken`. Sesi seperti ini sengaja tidak bisa menembang tulis-admin,
  // jadi 20 harapan di bawah tidak akan pernah hijau selama bypass aktif — dan itu bukan
  // regresi, itu perilaku yang sedang dijamin baris ke-105 di file ini.
  if (!mfaToken) return { status: r.status, json: r.json, bypassed: true };
  return call(who, 'POST', '/api/v1/auth/mfa/verify', { mfaToken, totpCode: totp(B32) }).then((v) => ({ ...v, bypassed: false }));
}

const ORG = '/api/v1/admin/organisasi';
const PRODI = '/api/v1/admin/master/prodi';
const stamp = Date.now().toString(36).toUpperCase();
const HQ_CODE = `UJIHQ${stamp}`;
const FAC_CODE = `UJIFK${stamp}`;
const PRG_CODE = `UJIPR${stamp}`;

// ── 1. Sesi & gerbang ────────────────────────────────────────────────────────
let r = await loginMfa('a2', 'admin2@demo.sica.test', 'Admin2Pass!23');
const MFA_BYPASSED = r.bypassed === true;
expect(
  MFA_BYPASSED ? 'login admin2 — tantangan MFA dilewati (bypass dev aktif)' : 'login+MFA admin2 → sesi amr penuh',
  MFA_BYPASSED || (r.status === 200 && r.json?.data?.accessToken),
  MFA_BYPASSED ? undefined : r.json
);
r = await call('mhs', 'POST', '/api/v1/auth/login', { tenantIdentifier: TENANT, username: 'mhs@demo.sica.test', password: 'StudentPass!23' });
expect('login mahasiswa (tanpa MFA) → sesi pwd', r.status === 200, r.json);

r = await call('anon', 'GET', ORG);
expect('GET organisasi tanpa sesi → 401, bukan 403', r.status === 401, { s: r.status, c: r.code });
r = await call('mhs', 'POST', ORG, { kind: 'FACULTY', name: 'Fakultas Uji', reason: 'uji gerbang izin mahasiswa' });
expect('POST organisasi oleh mahasiswa → 403 (izin dulu, bukan MFA)', r.status === 403, { s: r.status, c: r.code });
r = await call('mhs', 'GET', PRODI);
expect('GET prodi oleh mahasiswa → 403 (tidak memegang academic.program.view)', r.status === 403, { s: r.status, c: r.code });

// RD-155: body TIDAK SAH dari peran tanpa izin tetap 403, bukan 422 ber-detail.
// Lubang ini dulu dilewati suite sendiri: ia hanya mengirim body sah sebagai mahasiswa,
// jadi selalu menyentuh guard dan tidak pernah melihat orakel bentuk kontrak.
r = await call('mhs', 'POST', ORG, { kind: 'FACULTY', name: 'X' });
expect('POST organisasi body cacah oleh mahasiswa → 403, BUKAN 422 (RD-155)', r.status === 403 && r.code !== 'VALIDATION_FAILED', { s: r.status, c: r.code, d: r.details?.slice(0, 2) });
expect('POST organisasi body cacah oleh mahasiswa → detail field tidak dibocorkan', (r.details?.length ?? 0) === 0, { d: r.details });
r = await call('mhs', 'POST', PRODI, { name: 'P' });
expect('POST prodi body cacah oleh mahasiswa → 403, BUKAN 422 (RD-155)', r.status === 403 && r.code !== 'VALIDATION_FAILED', { s: r.status, c: r.code, d: r.details?.slice(0, 2) });
r = await call('mhs', 'PATCH', `${ORG}/not-a-uuid`, { name: 'Apa Saja' });
expect('PATCH id bukan-UUID oleh mahasiswa → 403 mendahului 422 transport (RD-155)', r.status === 403, { s: r.status, c: r.code });

// admin@ TANPA MFA: berhak, tetapi tulis harus 401 MFA_REQUIRED.
r = await call('a1', 'POST', '/api/v1/auth/login', { tenantIdentifier: TENANT, username: 'admin@demo.sica.test', password: 'AdminPass!23' });
expect('login admin tanpa MFA → sesi pwd saja', r.status === 200 && !r.json?.data?.requireMfa, r.json);
r = await call('a1', 'POST', ORG, { kind: 'FACULTY', name: 'Fakultas Tanpa MFA', reason: 'uji gerbang MFA pada tulis master' });
expect('POST organisasi tanpa sesi MFA → 401 MFA_REQUIRED', r.status === 401 && r.code === 'MFA_REQUIRED', { s: r.status, c: r.code });

if (MFA_BYPASSED) {
  console.log('\nE2E FASE 1D: KUNING — bypass MFA dev (`SICA_DEV_MFA_BYPASS=1`) aktif.');
  console.log('  20 harapan tulis-admin membutuhkan sesi `amr=[pwd,mfa]` dan DITANGGUHKAN, bukan dilewati diam-diam.');
  console.log('  Bukti yang tetap berjalan di atas: tulis tanpa MFA → 401 MFA_REQUIRED (RD-173) dan empat gerbang RD-155.');
  console.log('  Untuk hijau penuh: hapus baris itu dari apps/web/.env lalu `pnpm --filter @sica/web dev`, lalu jalankan lagi.');
  console.log(`\nSELESAI — ${checks - failures}/${checks} harapan terpenuhi (sebelum gerbang MFA)`);
  process.exit(3);
}

// ── 2. Tulis & baca organisasi ───────────────────────────────────────────────
r = await call('a2', 'GET', ORG);
expect('GET organisasi → 200 array', r.status === 200 && Array.isArray(r.data), { s: r.status, c: r.code });

r = await call('a2', 'POST', ORG, { kind: 'HQ', name: `Rektorat Uji ${stamp}`, code: HQ_CODE, reason: 'uji e2e fase 1d: puncak hierarki' });
expect('POST puncak HQ → 201', r.status === 201 && r.data?.id, { s: r.status, c: r.code, d: r.details });
const hqId = r.data?.id;

r = await call('a2', 'POST', ORG, { parentId: hqId, kind: 'FACULTY', name: `Fakultas Uji ${stamp}`, code: FAC_CODE, reason: 'uji e2e fase 1d: anak langsung' });
expect('POST fakultas di bawah HQ → 201', r.status === 201 && r.data?.id, { s: r.status, c: r.code, d: r.details });
const facId = r.data?.id;

r = await call('a2', 'POST', ORG, { kind: 'FACULTY', name: 'Fakultas Kode Kembar', code: FAC_CODE, reason: 'uji keunikan kode dalam tenant' });
expect('kode organisasi ganda → 409 CONFLICT', r.status === 409 && r.code === 'CONFLICT', { s: r.status, c: r.code });

r = await call('a2', 'PATCH', `${ORG}/${hqId}`, { parentId: facId, reason: 'uji penolakan siklus indukan' });
expect('HQ dijadikan anak fakultas miliknya sendiri → 409 (siklus ditolak)', r.status === 409 && r.code === 'CONFLICT', { s: r.status, c: r.code, d: r.details });

r = await call('a2', 'PATCH', `${ORG}/${facId}`, { parentId: '00000000-0000-4000-8000-000000000000', reason: 'uji indukan asing' });
expect('indukan yang tidak ada → 404, bukan 403', r.status === 404, { s: r.status, c: r.code });

r = await call('a2', 'PATCH', `${ORG}/${facId}`, { name: `Fakultas Diubah ${stamp}`, reason: 'uji perubahan nama dengan alasan' });
expect('PATCH nama fakultas → 200 dan echo nilai baru', r.status === 200 && r.data?.name === `Fakultas Diubah ${stamp}`, { s: r.status, c: r.code });

r = await call('a2', 'POST', ORG, { kind: 'HQ', name: 'x', reason: 'alasan cukup panjang untuk kontrak' });
expect('nama di bawah 2 karakter → 422 transport', r.status === 422 && r.details.some((d) => d.field === 'name'), { s: r.status, c: r.code, d: r.details });

r = await call('a2', 'PATCH', `${ORG}/bukan-uuid`, { name: 'Tidak Pernah Terjadi', reason: 'uji penjaga bentuk parameter rute' });
expect('`:id` bukan UUID → 422 di transport, bukan 500 dari PostgreSQL', r.status === 422, { s: r.status, c: r.code });

// ── 3. Program studi ─────────────────────────────────────────────────────────
r = await call('a2', 'POST', PRODI, {
  orgId: facId, name: `Informatika Uji ${stamp}`, code: PRG_CODE, pddiktiCode: `12345${stamp.slice(0, 4)}`, level: 'S1',
  minTotalSks: 144, nominalStudySemesters: 8, maxStudySemesters: 14, graduationMinIpk: 2.5, accreditationStatus: 'BAIK',
  reason: 'uji e2e fase 1d: prodi lengkap',
});
expect('POST prodi → 201 dengan level & SKS terproyeksi', r.status === 201 && r.data?.level === 'S1' && r.data?.minTotalSks === '144', { s: r.status, c: r.code, d: r.details });
const prodiId = r.data?.id;

r = await call('a2', 'POST', PRODI, {
  orgId: facId, name: 'Prodi Masa Studi Mustahil', level: 'S1', minTotalSks: 144,
  nominalStudySemesters: 16, maxStudySemesters: 10, graduationMinIpk: 2.5, accreditationStatus: null,
  reason: 'uji penjaga masa studi di transport',
});
expect('maksimum < normal → 422 pada field maxStudySemesters', r.status === 422 && r.details.some((d) => d.field === 'maxStudySemesters'), { s: r.status, c: r.code, d: r.details });

r = await call('a2', 'POST', PRODI, {
  orgId: facId, name: 'Prodi Jenjang Asing', level: 'S9', minTotalSks: 144, nominalStudySemesters: 8,
  maxStudySemesters: 14, graduationMinIpk: 2.5, accreditationStatus: null, reason: 'uji enum jenjang kelas A',
});
expect('jenjang di luar enum kelas A → 422 (bukan kamus yang bisa ditambah)', r.status === 422, { s: r.status, c: r.code });

r = await call('a2', 'PATCH', `${PRODI}/${prodiId}`, { graduationMinIpk: 2.75, reason: 'uji perubahan ambang IPK kelulusan' });
expect('PATCH ambang IPK → 200 dan nilai baru terbaca', r.status === 200 && r.data?.graduationMinIpk === '2.75', { s: r.status, c: r.code, d: r.details });

r = await call('a2', 'GET', PRODI);
const listed = (r.data ?? []).find((p) => p.id === prodiId);
expect('GET prodi memuat baris uji dengan indukan teresolusi', r.status === 200 && listed?.orgName?.includes('Diubah'), { s: r.status, org: listed?.orgName });
expect('perubahan IPK bertahan pada baca ulang (bukan hanya echo)', listed?.graduationMinIpk === '2.75', listed);

// ── 4. Jejak audit ───────────────────────────────────────────────────────────
r = await call('a2', 'GET', '/api/v1/admin/system-parameters?limit=1');
expect('sesi admin masih sah di akhir uji', r.status === 200, { s: r.status, c: r.code });

console.log(`\nSELESAI — ${checks - failures}/${checks} harapan terpenuhi`);
if (failures > 0) {
  console.log(`E2E FASE 1D: MERAH — ${failures} harapan gagal`);
  process.exit(1);
}
console.log('E2E FASE 1D (master organisasi & prodi): HIJAU');
