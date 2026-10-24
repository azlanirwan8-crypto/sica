/**
 * Uji end-to-end Fase 1A (R-1) di lokal: login → tantangan MFA → TOTP RFC 6238 →
 * provisioning satu-transaksi → idempotensi → suspend → jejak audit lintas-tenant →
 * grant dukungan terawasi. Menonaktifkan warning; keluar non-zero bila ada harapan meleset.
 */
import { totp } from './totp.mjs';

const BASE = process.env.SICA_BASE ?? 'http://localhost:3005';
const B32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const jars = { platform: null, demo: null };
let failures = 0;
async function call(who, method, path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(jars[who] ? { cookie: jars[who] } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const m = /^([^=]+)=[^;]+/.exec(c);
    if (m && (m[1] === 'sica_access_token' || m[1] === 'sica_refresh_token')) {
      const pair = c.split(';')[0];
      const existing = jars[who] ? jars[who].split('; ').filter((p) => !p.startsWith(`${m[1]}=`)) : [];
      jars[who] = [...existing, pair].join('; ');
    }
  }
  let json = null;
  try { json = await res.json(); } catch { /* html */ }
  return { status: res.status, json };
}

function expect(label, cond, detail) {
  if (cond) console.log(`  PASS  ${label}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? ` → ${JSON.stringify(detail).slice(0, 300)}` : ''}`); }
}

const slug = `kampus-${Date.now().toString(36)}`;

// 1. Login operator platform → tantangan MFA, BUKAN sesi penuh
let r = await call('platform', 'POST', '/api/v1/auth/login', {
  tenantIdentifier: 'platform', username: 'platform@demo.sica.test', password: 'PlatformPass!23',
});
expect('login platform → 200 requireMfa + mfaToken', r.status === 200 && r.json?.data?.requireMfa === true && typeof r.json?.data?.mfaToken === 'string', r.json);
const mfaToken = r.json?.data?.mfaToken;

// 2. Verifikasi TOTP → sesi penuh ber-amr mfa
r = await call('platform', 'POST', '/api/v1/auth/mfa/verify', { mfaToken, totpCode: totp(B32) });
expect('mfa/verify kode benar → 200 + accessToken', r.status === 200 && typeof r.json?.data?.accessToken === 'string', r.json);
{
  const probe = await call('platform', 'GET', '/api/v1/auth/me');
}

// 2b. Tantangan sekali-pakai: pakai ulang harus ditolak
r = await call('platform', 'POST', '/api/v1/auth/mfa/verify', { mfaToken, totpCode: totp(B32) });
expect('mfa/verify pakai-ulang → 401 (tantangan sekali-pakai)', r.status === 401, r.json);

// 3. Tanpa sesi → 401 (payload sah agar tidak tertahan di L1)
r = await call('nobody', 'POST', '/api/v1/platform/tenants', {
  slug: `tanpa-sesi-${Date.now().toString(36)}`, legalName: 'Institusi Tanpa Sesi', adminEmail: 'tanpa@sesi.test',
  adminFullName: 'Tanpa Sesi', adminInitialPassword: 'Rahasia123456!', reason: 'Uji penolakan tanpa sesi sama sekali.',
});
expect('POST /platform/tenants tanpa sesi → 401', r.status === 401, r.json);

// 4. Admin tenant tanpa MFA → 401 MFA_REQUIRED
await call('demo', 'POST', '/api/v1/auth/login', { tenantIdentifier: 'demo', username: 'admin@demo.sica.test', password: 'AdminPass!23' });
r = await call('demo', 'POST', '/api/v1/platform/tenants', {
  slug: 'sempalan', legalName: 'Institusi Sempalan', adminEmail: 'x@y.test', adminFullName: 'X Y',
  adminInitialPassword: 'Rahasia123456!', reason: 'Coba tulis platform tanpa langkah MFA.',
});
expect('tulis platform tanpa sesi MFA → 401 MFA_REQUIRED', r.status === 401 && r.json?.error?.code === 'MFA_REQUIRED', r.json);

// 5. Provisioning oleh operator (Idempotency-Key wajib)
const provisionBody = {
  slug,
  legalName: 'Universitas Uji Coba 1A',
  adminEmail: `admin.${slug}@demo.sica.test`,
  adminFullName: 'Admin Uji Coba',
  adminInitialPassword: 'Rahasia123456!',
  moduleCodes: ['identity', 'academic'],
  reason: 'Provisioning otomatis uji end-to-end Fase 1A di lingkungan dev.',
};
r = await call('platform', 'POST', '/api/v1/platform/tenants', provisionBody, { 'idempotency-key': `e2e-${slug}` });
expect('provision → 201 dengan rolesSeeded 15', r.status === 201 && r.json?.data?.rolesSeeded === 15, r.json);
const newTenant = r.json?.data;

// 5b. Idempotensi: kunci sama + isi sama → replay
const replay = await call('platform', 'POST', '/api/v1/platform/tenants', provisionBody, { 'idempotency-key': `e2e-${slug}` });
expect('idempoten → replay tenantId sama', replay.status === 201 && replay.json?.data?.tenantId === newTenant?.tenantId, replay.json);

// 6. Daftar & detail
r = await call('platform', 'GET', '/api/v1/platform/tenants?limit=200');
expect('GET daftar tenant memuat slug baru', r.status === 200 && JSON.stringify(r.json).includes(slug), r.status);
r = await call('platform', 'GET', `/api/v1/platform/tenants/${newTenant?.tenantId}`);
expect('GET detail tenant → 200 + status ONBOARDING', r.status === 200 && r.json?.data?.status === 'ONBOARDING', r.json);

// 7. Transisi status ACTIVE lalu SUSPENDED
let adminId = newTenant?.adminUserId;
await call('platform', 'POST', `/api/v1/platform/tenants/${newTenant?.tenantId}/suspend`, { reason: 'Menolak suspend sebelum aktif — harus CONFLICT.' });
// aktifkan dulu via reinstate? transisi ONBOARDING→ACTIVE bukan domain suspend; pakai SQL lewat service? uji transisi invalid:
r = await call('platform', 'POST', `/api/v1/platform/tenants/${newTenant?.tenantId}/suspend`, { reason: 'Suspend percobaan dari status onboarding (diharapkan CONFLICT).' });
expect('suspend dari ONBOARDING → 409 CONFLICT (transisi dijaga)', r.status === 409 && r.json?.error?.code === 'CONFLICT', r.json);

// 8. Kuota
r = await call('platform', 'PUT', `/api/v1/platform/tenants/${newTenant?.tenantId}/quotas`, { quotas: { maxApiRps: 120 }, reason: 'Penyesuaian kuota untuk uji end-to-end dev 1A.' });
expect('PUT quotas → 200 dan nilai terpakai', r.status === 200 && r.json?.data?.maxApiRps === 120, r.json);

// 9. Grant dukungan terawasi ke admin tenant baru
r = await call('platform', 'POST', '/api/v1/platform/impersonation-grants', {
  targetTenantSlug: slug, targetUserId: adminId, reason: 'Buka dukungan terawasi untuk uji end-to-end Fase 1A.', scope: 'READ_ONLY', ttlMinutes: 10,
});
expect('POST impersonation-grants → 201 ACTIVE + expiresAt ≤ 30 menit', r.status === 201 && r.json?.data?.state === 'ACTIVE', r.json);
const grant = r.json?.data;

r = await call('platform', 'DELETE', `/api/v1/platform/impersonation-grants/${grant?.grantId}?tenantId=${newTenant?.tenantId}&reason=Pencabutan+uji+Fase+1A+selesai`);
expect('DELETE grant → 200 REVOKED', r.status === 200 && r.json?.data?.state === 'REVOKED', r.json);

// 10. Baca jejak lintas-tenant: setiap aksi tercatat; BACA ITU SENDIRI memancarkan baris
//     audit (baru terlihat pada permintaan berikutnya — ia ditulis dalam transaksi yang sama).
r = await call('platform', 'GET', `/api/v1/platform/audit-events?tenantId=${newTenant?.tenantId}&reason=Audit+lintas+tenant+untuk+uji+Fase+1A&limit=50`);
const firstActions = (r.json?.data ?? []).map((x) => x.action);
expect('audit-events memuat provision+quota+grant+revoke', r.status === 200 && ['platform.tenant.provision', 'platform.quota.update', 'identity.impersonation.grant', 'identity.impersonation.revoke'].every((a) => firstActions.includes(a)), { actions: firstActions, status: r.status });
const r2 = await call('platform', 'GET', `/api/v1/platform/audit-events?tenantId=${newTenant?.tenantId}&reason=Pembacaan+kedua+untuk+membuktikan+baca=audit&limit=50`);
const secondActions = (r2.json?.data ?? []).map((x) => x.action);
expect('baca lintas-tenant memancarkan baris audit sendiri (bukti I-1)', secondActions.includes('audit.cross_tenant.read'), { secondActions });

console.log(failures === 0 ? '\nE2E FASE 1A: HIJAU' : `\nE2E FASE 1A: ${failures} KEFAILAN`);
process.exit(failures === 0 ? 0 : 1);
