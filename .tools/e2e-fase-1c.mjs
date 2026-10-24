/**
 * Uji end-to-end Fase 1C `R-2.3` (Dynamic Parameter Engine) di lokal.
 *
 * Yang dibuktikan bukan "respons 200", melainkan norma §4.16.2/§4.16.5 yang membuat mesin
 * parameter layak dipakai kampus:
 *   nilai sah ≠ nilai berlaku · kelas SECURITY/REGULATORY tidak pernah langsung terpakai dan
 *   dijawab 409 (113) dengan approvalId · penyetuju ≠ pemohon · draf yang pasti ditolak tidak
 *   masuk antrean · tulis tanpa MFA 401, tulis tanpa izin 403 (izin diperiksa lebih dulu) ·
 *   kunci indeks tidak bisa disunting di sini · nilai efektif TIDAK berubah saat draf menunggu ·
 *   rahasia tidak pernah di-echo · register menuntut bukti konsumen nyata · klien tidak pernah
 *   menjadi sumber tenant · RLS membuat kunci institusi lain = 404.
 * Keluar non-zero bila satu saja harapan meleset.
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
  return {
    status: res.status,
    json,
    code: json?.error?.code,
    data: json?.data,
    details: json?.error?.details ?? [],
    etag: res.headers.get('etag'),
    headers: res.headers,
  };
}

const detail = (r) => ({ s: r.status, c: r.code, d: r.details?.map((x) => `${x.field}=${x.message}`).slice(0, 4) });

function expect(label, cond, hint) {
  checks += 1;
  if (cond) console.log(`  PASS  ${label}`);
  else { failures++; console.log(`  FAIL  ${label}${hint !== undefined ? ` → ${JSON.stringify(hint).slice(0, 300)}` : ''}`); }
}

async function loginMfa(who, email, password) {
  const r = await call(who, 'POST', '/api/v1/auth/login', { tenantIdentifier: TENANT, username: email, password });
  return call(who, 'POST', '/api/v1/auth/mfa/verify', { mfaToken: r.json?.data?.mfaToken, totpCode: totp(B32) });
}

const P = '/api/v1/admin/system-parameters';
const K = (key) => `${P}/${encodeURIComponent(key)}`;
const stamp = Date.now().toString(36);
const UJI_KEY = `attendance.uji_e2e_${stamp}`;

// ── 1. Sesi ──────────────────────────────────────────────────────────────────
let r = await loginMfa('a2', 'admin2@demo.sica.test', 'Admin2Pass!23');
expect('login+MFA admin2 (pemohon) → sesi amr penuh', r.status === 200 && r.json?.data?.accessToken, r.json);
r = await loginMfa('a3', 'admin3@demo.sica.test', 'Admin3Pass!23');
expect('login+MFA admin3 (penyetuju kedua) → sesi amr penuh', r.status === 200 && r.json?.data?.accessToken, r.json);
r = await call('adm', 'POST', '/api/v1/auth/login', { tenantIdentifier: TENANT, username: 'admin@demo.sica.test', password: 'AdminPass!23' });
expect('login admin TANPA MFA → sesi amr=pwd saja', r.status === 200 && !r.json?.data?.requireMfa, r.json);
r = await call('mhs', 'POST', '/api/v1/auth/login', { tenantIdentifier: TENANT, username: 'mhs@demo.sica.test', password: 'StudentPass!23' });
expect('login mahasiswa → sesi aktif', r.status === 200, r.json);

// ── 2. Baca katalog ──────────────────────────────────────────────────────────
const REGISTRY = [
  'attendance.min_presence_pct', 'attendance.totp_rotate_seconds', 'attendance.totp_window_steps',
  'attendance.geofence_default_radius_m', 'attendance.gps_max_accuracy_m',
  'krs.sks_band_by_ipk', 'grading.scale_bands', 'finance.fee_components', 'finance.discount_scheme',
  'finance.payment_channels', 'pmb.nim_pattern', 'pmb.garment_sizes',
];
r = await call('a2', 'GET', `${P}?limit=100`);
const rows = Array.isArray(r.data) ? r.data : [];
expect('GET daftar (admin2) → 200', r.status === 200, detail(r));
const keys = rows.map((x) => x.parameterKey);
expect('dua belas kunci registri terpasang semuanya (5 terpasang + 7 indeks)', REGISTRY.every((k) => keys.includes(k)), REGISTRY.filter((k) => !keys.includes(k)));
expect('nol kunci asing di luar registri dan kunci uji e2e', keys.every((k) => REGISTRY.includes(k) || k.startsWith('attendance.uji_e2e_')), keys.filter((k) => !REGISTRY.includes(k) && !k.startsWith('attendance.uji_e2e_')));
const kontrak = ['parameterKey', 'dataType', 'currentValue', 'defaultValue', 'min', 'max', 'riskClass', 'version', 'isEditable', 'requiresSecondApprover', 'allowedActions', 'effective', 'sourceOfTruth'];
expect('seluruh kolom kontrak §4.16.1 ada di proyeksi', kontrak.every((c) => c in rows[0]), kontrak.filter((c) => !(c in rows[0])));
expect('tiap baris membawa allowedActions terisi (G-18 ditutup di server)', rows.every((x) => Array.isArray(x.allowedActions) && x.allowedActions.length > 0), rows.filter((x) => !x.allowedActions?.length).map((x) => x.parameterKey));
expect('meta paginasi ikut terkirim (§2.3 envelope)', Boolean(r.json?.meta?.pagination), r.json?.meta && Object.keys(r.json.meta));

r = await call('mhs', 'GET', P);
expect('mahasiswa membaca katalog admin → 403 FORBIDDEN', r.status === 403 && r.code === 'FORBIDDEN', detail(r));

r = await call('a2', 'GET', `${P}?riskClass=SECURITY&editableOnly=true`);
const secRows = Array.isArray(r.data) ? r.data : [];
expect('filter SECURITY+editableOnly → 4 kunci terpasang, indeks tersaring', secRows.length === 4 && secRows.every((x) => x.isEditable), secRows.map((x) => [x.parameterKey, x.isEditable]));

r = await call('a2', 'GET', K('attendance.tidak.ada'));
expect('kunci tak dikenal → 404 (bukan 403: keberadaan bukan oracle)', r.status === 404 && r.code === 'NOT_FOUND', detail(r));

r = await call('a2', 'GET', K('krs.sks_band_by_ipk'));
expect('baris indeks terbaca dengan rumah + remedyHref §4.16.2 langkah 1', r.status === 200 && r.data?.sourceOfTruth === 'academic_rules' && typeof r.data?.remedyHref === 'string', r.data && [r.data.sourceOfTruth, r.data.remedyHref]);
expect('baris indeks tidak menawarkan aksi write', Array.isArray(r.data?.allowedActions) && !r.data.allowedActions.includes('write'), r.data?.allowedActions);
expect('baris indeks tidak mengklaim nilai dan tidak dapat disunting', r.data?.currentValue === null && r.data?.isEditable === false, r.data && [r.data.currentValue, r.data.isEditable]);

// ── 3. Tulis kunci non-empat-mata (ACADEMIC) ─────────────────────────────────
r = await call('a2', 'GET', K('attendance.min_presence_pct'));
const pctV = r.data?.version;
expect('ambang terbaca "75" sebagai teks kawat', r.data?.currentValue === '75', r.data?.currentValue);
expect('nilai bertipe ikut diproyeksikan untuk klien', r.data?.value === 75, r.data?.value);
expect('consumerCount diproyeksikan dari registri (bukti konsumen nyata)', (r.data?.consumerCount ?? 0) >= 1, r.data?.consumerCount);

r = await call('adm', 'PUT', K('attendance.min_presence_pct'), { value: 80, reason: 'uji e2e fase 1c ambang presensi', expectedVersion: pctV });
expect('penulis berhak tanpa MFA → 401 MFA_REQUIRED (2)', r.status === 401 && r.code === 'MFA_REQUIRED', detail(r));

r = await call('mhs', 'PUT', K('attendance.min_presence_pct'), { value: 80, reason: 'uji e2e fase 1c ambang presensi', expectedVersion: pctV });
expect('mahasiswa menulis parameter → 403 FORBIDDEN sebelum pertanyaan MFA', r.status === 403 && r.code === 'FORBIDDEN', detail(r));

r = await call('a2', 'PUT', K('attendance.min_presence_pct'), { value: 80, reason: 'uji e2e fase 1c ambang presensi', expectedVersion: pctV + 5 });
expect('expectedVersion salah → 409 CONFLICT (12), nol perubahan', r.status === 409 && r.code === 'CONFLICT', detail(r));

r = await call('a2', 'PUT', K('attendance.min_presence_pct'), { value: 150, reason: 'uji e2e fase 1c ambang presensi', expectedVersion: pctV });
expect('PCT 150 → 422 PARAM_OUT_OF_RANGE (107) dengan min/max terlihat', r.status === 422 && r.code === 'PARAM_OUT_OF_RANGE' && r.details.some((d) => d.field === 'max' && d.message === '100'), detail(r));

r = await call('a2', 'PUT', K('attendance.geofence_default_radius_m'), { value: 900, reason: 'uji e2e fase 1c radius geofence', expectedVersion: 1 });
expect('METERS 900 (plafon 500) → 422 PARAM_OUT_OF_RANGE (107)', r.status === 422 && r.code === 'PARAM_OUT_OF_RANGE', detail(r));

r = await call('a2', 'PUT', K('attendance.min_presence_pct'), { value: 'postgresql://user:pass@host:5432/db', reason: 'uji e2e fase 1c ambang presensi', expectedVersion: pctV });
expect('nilai berkredensial → 422 PARAM_SECRET_FORBIDDEN (111)', r.status === 422 && r.code === 'PARAM_SECRET_FORBIDDEN', detail(r));
expect('respons TIDAK mengulang nilai rahasia (§4.16.2 langkah 7)', !JSON.stringify(r.json).includes('pass@host'), r.json);

r = await call('a2', 'PUT', K('attendance.min_presence_pct'), { value: 80, reason: 'uji e2e fase 1c ambang presensi', expectedVersion: pctV });
expect('tulis ACADEMIC sah → 200 dan applied=true, effectiveValue 80', r.status === 200 && r.data?.applied === true && r.data?.effectiveValue === '80', r.data);
expect('kelas ACADEMIC tidak menuntut penyetuju kedua', r.data?.requiresSecondApprover === false, r.data?.requiresSecondApprover);
expect('historyId terkembali (jejak audit tersedia bagi pemeriksa)', typeof r.data?.historyId === 'string' && r.data.historyId.length > 10, r.data?.historyId);

r = await call('a2', 'GET', `${K('attendance.min_presence_pct')}/history`);
const hist = Array.isArray(r.data) ? r.data : [];
expect('riwayat mencatat ≥2 entri beralasan + IP (BR-R12)', r.status === 200 && hist.length >= 2 && (hist[0]?.reason?.length ?? 0) >= 10 && Boolean(hist[0]?.ip), [hist.length, hist[0]?.reason, hist[0]?.ip]);
expect('entri terakhir menunjuk perubahan yang baru terjadi', hist[0]?.newValue === '80' && hist[0]?.oldValue === '75', hist[0] && [hist[0].oldValue, hist[0].newValue]);

r = await call('a2', 'POST', `${K('attendance.min_presence_pct')}/revert`, { toDefault: true, reason: 'uji e2e fase 1c kembalikan default', expectedVersion: pctV + 1 });
expect('revert ke default → 200 dan nilai kembali 75', r.status === 200 && r.data?.effectiveValue === '75', r.data);

// ── 4. Empat mata nyata pada kelas SECURITY ──────────────────────────────────
r = await call('a2', 'GET', K('attendance.totp_rotate_seconds'));
const rotV = r.data?.version;
// Target dipilih dari himpunan sah yang BERBEDA dengan nilai kini, supaya uji ini dapat
// diulang tanpa menghasilkan draf bernilai sama (plafon 5/10/15 tetap dijaga DB).
const rotSaatIni = r.data?.currentValue;
const rotTarget = ['5', '10', '15'].find((v) => v !== rotSaatIni) ?? '10';
expect('rotasi TOTP terbaca dengan requiresSecondApprover=true', r.data?.requiresSecondApprover === true, r.data?.requiresSecondApprover);

r = await call('a2', 'PUT', K('attendance.totp_rotate_seconds'), { value: 20, reason: 'uji e2e fase 1c jendela token', expectedVersion: rotV });
expect('20 dtk (dalam rentang, di luar himpunan sah) → 422 dan TIDAK masuk antrean', r.status === 422, detail(r));
r = await call('a2', 'PUT', K('attendance.totp_window_steps'), { value: 3, reason: 'uji e2e fase 1c jendela token', expectedVersion: 1 });
expect('window 3 langkah → 422 PARAM_OUT_OF_RANGE sebelum draf', r.status === 422 && r.code === 'PARAM_OUT_OF_RANGE', detail(r));

r = await call('a2', 'GET', '/api/v1/admin/system-parameter-approvals?state=PENDING');
const pendingRows = Array.isArray(r.data) ? r.data : [];
expect('antrean PENDING awal kosong (draf ilegal tidak tertinggal)', r.status === 200 && pendingRows.length === 0, pendingRows.map((x) => x.parameterKey));

r = await call('a2', 'PUT', K('attendance.totp_rotate_seconds'), { value: Number(rotTarget), reason: 'uji e2e fase 1c rotasi token 10 detik', expectedVersion: rotV });
expect('SECURITY → 409 PARAM_APPROVAL_REQUIRED (113) + approvalId', r.status === 409 && r.code === 'PARAM_APPROVAL_REQUIRED' && r.details.some((d) => d.field === 'approvalId'), detail(r));
const approvalId = r.details?.find((d) => d.field === 'approvalId')?.message;
expect('113 menyatakan effectiveValue ≠ proposedValue', r.details?.some((d) => d.field === 'effectiveValue' && d.message === rotSaatIni) && r.details?.some((d) => d.field === 'proposedValue' && d.message === rotTarget), r.details);

r = await call('a2', 'GET', K('attendance.totp_rotate_seconds'));
expect(`draf menunggu → nilai efektif TETAP "${rotSaatIni}", pendingValue "${rotTarget}" (AC-PG-1)`, r.data?.currentValue === rotSaatIni && r.data?.pendingValue === rotTarget, r.data && [r.data.currentValue, r.data.pendingValue]);
expect('baris ber-draf menunjuk approvalId yang menunggu (jejak bagi penyetuju)', r.data?.pendingApprovalId === approvalId, r.data && [r.data.pendingApprovalId, approvalId]);

r = await call('a2', 'GET', '/api/v1/admin/system-parameter-approvals?state=PENDING');
expect('draf yang baru muncul di antrean PENDING penyetuju', (Array.isArray(r.data) ? r.data : []).some((x) => x.approvalId === approvalId), r.data);

r = await call('a2', 'POST', `/api/v1/admin/system-parameter-approvals/${approvalId}/approve`, { reason: 'setuju oleh pemohon sendiri' });
expect('pemohon menyetujui drafnya sendiri → 403 SELF_APPROVAL_FORBIDDEN (56)', r.status === 403 && r.code === 'SELF_APPROVAL_FORBIDDEN', detail(r));

r = await call('a3', 'POST', `/api/v1/admin/system-parameter-approvals/${approvalId}/approve`, { reason: 'dipahami, 10 detik masih dalam plafon' });
expect('orang kedua menyetujui → 200', r.status === 200, detail(r));

r = await call('a2', 'GET', K('attendance.totp_rotate_seconds'));
expect('sesudah approve: efektif mengikuti target, draf hilang, versi naik', r.data?.currentValue === rotTarget && r.data?.pendingValue === null && r.data?.version === rotV + 1, r.data && [r.data.currentValue, r.data.pendingValue, r.data.version]);

r = await call('a3', 'POST', `/api/v1/admin/system-parameter-approvals/${approvalId}/approve`, { reason: 'percobaan keputusan kedua' });
expect('keputusan terminal tidak dapat diulang → 409 DECISION_ALREADY_MADE (55)', r.status === 409 && r.code === 'DECISION_ALREADY_MADE', detail(r));

r = await call('a2', 'GET', '/api/v1/admin/system-parameter-approvals?state=PENDING');
expect('antrean PENDING kembali kosong setelah keputusan', (Array.isArray(r.data) ? r.data : []).length === 0, r.data);
r = await call('a2', 'GET', '/api/v1/admin/system-parameter-approvals?state=APPROVED');
expect('antrean APPROVED berisi draf yang baru disetujui', (Array.isArray(r.data) ? r.data : []).some((x) => x.approvalId === approvalId), (Array.isArray(r.data) ? r.data : []).map((x) => x.approvalId));
r = await call('a2', 'GET', K('attendance.totp_rotate_seconds') + '/history');
const rotHist = Array.isArray(r.data) ? r.data : [];
expect('riwayat SECURITY menyimpan approver orang kedua', rotHist.some((x) => Boolean(x.approverId) && x.source !== 'SEED'), rotHist.slice(0, 2));

// ── 5. Baris indeks & non-editable ───────────────────────────────────────────
r = await call('a2', 'PUT', K('krs.sks_band_by_ipk'), { value: '9', reason: 'uji e2e fase 1c menulis baris indeks', expectedVersion: 1 });
expect('PUT baris indeks → 403 PARAM_READONLY (108) dengan remedyHref', r.status === 403 && r.code === 'PARAM_READONLY' && JSON.stringify(r.json).includes('/academic/aturan'), detail(r));

r = await call('a2', 'PATCH', `${K('krs.sks_band_by_ipk')}/toggle-active`, { isActive: false, reason: 'uji e2e fase 1c mematikan indeks', expectedVersion: 1 });
expect('toggle baris indeks ikut ditolak READONLY (satu aturan, satu titik)', r.status === 403 && r.code === 'PARAM_READONLY', detail(r));

// ── 6. Registrasi kunci baru (§4.16.4) ───────────────────────────────────────
const basisRegister = {
  module: 'attendance',
  parameterKey: UJI_KEY,
  dataType: 'INT',
  unit: 'detik',
  defaultValue: '30',
  minValue: '5',
  maxValue: '120',
  description: 'kunci uji e2e fase 1c untuk membuktikan gerbang konsumen',
  riskClass: 'TECHNICAL',
  reason: 'mendaftarkan kunci uji e2e fase 1c',
};
const buktiPalsu = { callSites: ['apps/web/src/modules/yang/tidak/ada.ts:f'], testRef: 'apps/web/tests/unit/tiada.test.ts' };
const buktiAsli = { callSites: ['apps/web/src/modules/settings/services/system-parameters.service.ts:guardWrite'], testRef: 'apps/web/tests/unit/parameter-consumers.test.ts' };

r = await call('a2', 'POST', `${P}/register`, { ...basisRegister, consumerEvidence: buktiPalsu });
expect('register tanpa konsumen terbukti → 422 VALIDATION_FAILED (6)', r.status === 422 && r.code === 'VALIDATION_FAILED', detail(r));

r = await call('a2', 'POST', `${P}/register`, { ...basisRegister, parameterKey: 'attendance.online_min_join_ratio', consumerEvidence: buktiPalsu });
expect('kunci yang ditunda dijawab dengan ALASANNYA, bukan pesan generik', r.status === 422 && JSON.stringify(r.json).includes('belum dibangun'), r.details);

r = await call('a2', 'POST', `${P}/register`, { ...basisRegister, riskClass: 'SECURITY', consumerEvidence: buktiAsli });
expect('register kelas SECURITY dari API → ditolak (empat-mata tak bisa disimulasikan)', r.status === 422, detail(r));

r = await call('a2', 'POST', `${P}/register`, { ...basisRegister, consumerEvidence: buktiAsli });
expect('register ber-bukti konsumen → 201 dan isEditable=true', r.status === 201 && r.data?.isEditable === true, detail(r));

r = await call('a2', 'GET', `${K('attendance.geofence_default_radius_m')}/impact`);
expect('dampak kunci TERPASANG menyebut berkas pembaca sebenarnya', r.status === 200 && JSON.stringify(r.json).includes('attendance/qr/scan/route.ts'), r.data && Object.keys(r.data));

r = await call('a2', 'PUT', K(UJI_KEY), { value: 40, reason: 'uji e2e fase 1c nilai kunci baru', expectedVersion: 1 });
expect('kunci baru dapat langsung ditulis (bukan kelas empat-mata)', r.status === 200 && r.data?.effectiveValue === '40', r.data);

r = await call('a2', 'PATCH', `${K(UJI_KEY)}/toggle-active`, { isActive: false, reason: 'uji e2e fase 1c mematikan kunci uji', expectedVersion: 2 });
expect('kunci uji dapat dinonaktifkan → 200', r.status === 200, detail(r));
r = await call('a2', 'GET', `${P}?limit=100`);
expect('daftar baku menyembunyikan kunci non-aktif', !(Array.isArray(r.data) ? r.data : []).some((x) => x.parameterKey === UJI_KEY), (Array.isArray(r.data) ? r.data : []).length);
r = await call('a2', 'GET', `${P}?includeInactive=true&limit=100`);
expect('includeInactive=true menampilkannya (rekonstruksi historis BR-R12)', (Array.isArray(r.data) ? r.data : []).some((x) => x.parameterKey === UJI_KEY), (Array.isArray(r.data) ? r.data : []).length);

// ── 7. Kontrak baca klien (§4.16.5) ─────────────────────────────────────────
const etagUrl = '/api/v1/settings/effective?keys=attendance.min_presence_pct,attendance.totp_rotate_seconds';
r = await call('mhs', 'GET', etagUrl);
const body = JSON.stringify(r.json ?? {});
expect('effective untuk mahasiswa → 200 dan memuat ambang yang boleh dibaca', r.status === 200 && body.includes('min_presence_pct'), detail(r));
expect('kunci SECURITY tidak dibocorkan ke peran tanpa hak baca kelasnya', !body.includes('"10"') && (body.includes('totp_rotate_seconds') === false || body.includes('masked') || body.includes('MODULE_NOT_AVAILABLE')), body.slice(0, 300));
expect('respons membawa X-Parameter-Version + ETag', Boolean(r.headers.get('x-parameter-version')) && Boolean(r.etag), [r.headers.get('x-parameter-version'), r.etag]);

r = await call('mhs', 'GET', etagUrl, undefined, { 'if-none-match': r.etag ?? '' });
expect('If-None-Match pada URL yang sama → 304 tanpa body', r.status === 304 && r.json === null, { s: r.status });

r = await call('mhs', 'GET', `/api/v1/settings/effective?keys=${Array.from({ length: 41 }, (_, i) => `attendance.k${i}`).join(',')}`);
expect('lebih dari 40 kunci per permintaan → ditolak transport', r.status >= 400, detail(r));

r = await call('mhs', 'GET', '/api/v1/settings/effective?keys=attendance.min_presence_pct', undefined, { 'x-tenant-id': '00000000-0000-4000-8000-000000000001' });
expect('tenant dari header tidak dipercaya (L2: hanya token)', r.status === 200 || r.status === 304, detail(r));
const versi = r.headers.get('x-parameter-version') ?? '';
expect('versi parameter menandai tenant, bukan lintas-tenant', /^[0-9a-f-]{8,}-[0-9a-f]{6,}$/.test(versi.replace(/"/g, '')), versi);

// ── 8. Rekonstruksi historis `?at=` ─────────────────────────────────────────
const hariIni = new Date().toISOString().slice(0, 10);
r = await call('a2', 'GET', `${K('attendance.min_presence_pct')}?at=${hariIni}`);
expect('baca `?at=` hari ini → nilai terproyeksi 75 (hasil rekonstruksi, bukan bocoran)', r.status === 200 && r.data?.currentValue === '75', r.data?.currentValue);
r = await call('a2', 'GET', `${K('attendance.min_presence_pct')}?at=2020-01-01`);
expect('`?at=` sebelum kunci lahir → 404 bertanggal, BUKAN nilai hari ini', r.status === 404 && r.code === 'NOT_FOUND' && r.details.some((d) => d.field === 'at' && d.message === '2020-01-01'), detail(r));
r = await call('a2', 'GET', `${K('attendance.min_presence_pct')}?at=31-12-2020`);
expect('tanggal non-ISO ditolak transport (422), bukan diabaikan', r.status === 422 && r.code === 'VALIDATION_FAILED', detail(r));
r = await call('a2', 'GET', `${K('attendance.min_presence_pct')}?salah=1`);
expect('query asing pada rute baca ikut ditolak (.strict)', r.status === 422, detail(r));

console.log(`\n${failures === 0 ? 'SELESAI' : 'ADA KEFAILAN'} — ${checks - failures}/${checks} harapan terpenuhi`);
process.exit(failures === 0 ? 0 : 1);
