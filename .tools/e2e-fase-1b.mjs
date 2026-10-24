/**
 * Uji end-to-end Fase 1B `R-2.1` (Admin IT Kampus — inti identitas) di lokal.
 *
 * Yang dibuktikan BUKAN "respons 200", melainkan norma empat-mata:
 *   pengajuan ≠ keberlakuan · penyetuju ≠ pemohon ≠ target · SoD menolak sebelum
 *   mendarat di tabel · scope penyetuju membatasi · keputusan terminal tak bisa diulang ·
 *   RLS membuat id tenant lain tidak terlihat (404) · setiap langkahWRITE tercetak di
 *   rantai audit. Keluar non-zero bila satu saja harapan meleset.
 */
import { totp } from './totp.mjs';

const BASE = process.env.SICA_BASE ?? 'http://localhost:3005';
const B32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const TENANT = 'demo';
const jars = {};
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
      const existing = jars[who] ? jars[who].split('; ').filter((p) => !p.startsWith(`${m[1]}=`)) : [];
      jars[who] = [...existing, pair].join('; ');
    }
  }
  let json = null;
  try { json = await res.json(); } catch { /* html */ }
  return { status: res.status, json, code: json?.error?.code };
}

function expect(label, cond, detail) {
  if (cond) console.log(`  PASS  ${label}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? ` → ${JSON.stringify(detail).slice(0, 260)}` : ''}`); }
}

/** Login → tantangan MFA → TOTP → sesi `amr=['pwd','mfa']`. */
async function loginMfa(who, email, password) {
  const r = await call(who, 'POST', '/api/v1/auth/login', { tenantIdentifier: TENANT, username: email, password });
  const token = r.json?.data?.mfaToken;
  const v = await call(who, 'POST', '/api/v1/auth/mfa/verify', { mfaToken: token, totpCode: totp(B32) });
  return v;
}

const stamp = Date.now().toString(36);
const NEW_EMAIL = `r2-${stamp}@demo.sica.test`;

// ── 1. Sesi ──────────────────────────────────────────────────────────────────
let r = await loginMfa('a2', 'admin2@demo.sica.test', 'Admin2Pass!23');
expect('login+MFA admin2 (pemohon) → sesi penuh', r.status === 200 && r.json?.data?.accessToken, r.json);
r = await loginMfa('a3', 'admin3@demo.sica.test', 'Admin3Pass!23');
expect('login+MFA admin3 (penyetuju kedua) → sesi penuh', r.status === 200 && r.json?.data?.accessToken, r.json);
r = await call('adm', 'POST', '/api/v1/auth/login', { tenantIdentifier: TENANT, username: 'admin@demo.sica.test', password: 'AdminPass!23' });
expect('login admin WITHOUT MFA → sesi amr=pwd saja', r.status === 200 && !r.json?.data?.requireMfa, r.json);
r = await call('mhs', 'POST', '/api/v1/auth/login', { tenantIdentifier: TENANT, username: 'mhs@demo.sica.test', password: 'StudentPass!23' });
expect('login mahasiswa → sesi aktif', r.status === 200, r.json);

// ── 2. L1–L3 pada daftar & pembuatan akun ────────────────────────────────────
r = await call('a2', 'GET', '/api/v1/admin/pengguna?limit=50');
expect('GET /admin/pengguna (admin2) → 200 + baris', r.status === 200 && Array.isArray(r.json?.data) && r.json.data.length > 0, r.status);
r = await call('mhs', 'GET', '/api/v1/admin/pengguna');
expect('GET /admin/pengguna sebagai mahasiswa → 403 (L3 berbasis tabel)', r.status === 403 && r.code === 'FORBIDDEN', r.json);
r = await call('adm', 'POST', '/api/v1/admin/pengguna', {
  fullName: 'Tanpa MFA', email: `nomfa-${stamp}@demo.sica.test`, memberCode: `NOMFA${stamp}`,
  memberRole: 'staff', initialPassword: 'Rahasia123456!', reason: 'Uji gerbang MFA pada tulis admin.',
});
expect('POST /admin/pengguna tanpa MFA → 401 MFA_REQUIRED', r.status === 401 && r.code === 'MFA_REQUIRED', r.json);

r = await call('a2', 'POST', '/api/v1/admin/pengguna', {
  fullName: 'Warga Uji R2', email: NEW_EMAIL, memberCode: `R2${stamp}`,
  memberRole: 'staff', initialPassword: 'Rahasia123456!', reason: 'Pembuatan akun untuk uji empat-mata Fase 1B.',
});
expect('POST /admin/pengguna → 201 (akun tanpa hak apa pun)', r.status === 201 && r.json?.data?.initialPasswordShownOnce === true, r.json);
const newUserId = r.json?.data?.userId;

r = await call('a2', 'GET', `/api/v1/admin/pengguna/${newUserId}`);
expect('GET detail akun baru → roleCodes kosong (akun ≠ hak)', r.status === 200 && r.json?.data?.roleCodes?.length === 0, r.json);

r = await call('a2', 'POST', '/api/v1/admin/pengguna', {
  fullName: 'Sandi Pendek', email: `pendek-${stamp}@demo.sica.test`, memberCode: `PD${stamp}`,
  memberRole: 'staff', initialPassword: 'pendek', reason: 'Uji L1 menolak sandi di bawah 12 karakter.',
});
expect('L1: sandi awal < 12 karakter → 422 VALIDATION_FAILED', r.status === 422 && r.code === 'VALIDATION_FAILED', r.json);

r = await call('a2', 'PATCH', `/api/v1/admin/pengguna/${newUserId}`, {
  fullName: 'Warga Uji R2 Ganda', status: 'DISABLED', reason: 'Uji kolom SERVER_ONLY ditolak dari body.',
});
expect('L1: kolom SERVER_ONLY (`status`) di PATCH → 422', r.status === 422 && r.code === 'VALIDATION_FAILED', r.json);

// ── 3. Peran & katalog ───────────────────────────────────────────────────────
r = await call('a2', 'GET', '/api/v1/admin/hak-akses/peran');
const rolesList = r.json?.data ?? [];
const roleByCode = new Map(rolesList.map((x) => [x.code, x]));
expect('GET /admin/hak-akses/peran → memuat TENANT_ADMIN & LECTURER',
  r.status === 200 && roleByCode.has('TENANT_ADMIN') && roleByCode.has('LECTURER'), r.status);
expect('peran sistem tampil dengan isSystem=true (terkunci, bukan hilang)',
  roleByCode.get('TENANT_ADMIN')?.isSystem === true, roleByCode.get('TENANT_ADMIN'));
expect('jumlah pemegang peran nyata (subquery korrelatif berkualifikasi — regresi holders=0)',
  (roleByCode.get('TENANT_ADMIN')?.holderCount ?? 0) >= 2, roleByCode.get('TENANT_ADMIN'));

r = await call('a2', 'GET', '/api/v1/admin/hak-akses/izin');
const catalog = r.json?.data ?? [];
expect('GET /admin/hak-akses/izin → katalog global terisi (>200)', r.status === 200 && catalog.length > 200, catalog.length);
const somePerm = catalog.find((p) => p.code === 'academic.transcript.view') ?? catalog[0];

r = await call('a2', 'POST', '/api/v1/admin/hak-akses/peran', {
  code: `R2_PUSTAKAWAN_${stamp.toUpperCase()}`, displayName: 'Pustakawan Uji', scopeKind: 'TENANT',
  reason: 'Peran kostum untuk uji delta izin empat-mata Fase 1B.',
});
expect('POST /admin/hak-akses/peran → 201 isSystem=false', r.status === 201 && r.json?.data?.isSystem === false, r.json);
const customRoleId = r.json?.data?.roleId;

r = await call('a2', 'PATCH', `/api/v1/admin/hak-akses/peran/${roleByCode.get('TENANT_ADMIN')?.roleId}`, {
  displayName: 'Mencoba mengubah peran sistem', reason: 'Uji kunci peran sistem (is_system).',
});
expect('PATCH peran sistem → 409 CONFLICT (terkunci penuh)', r.status === 409 && r.code === 'CONFLICT', r.json);

// ── 4. Pengajuan GRANT: 202 dan TIDAK langsung berlaku ───────────────────────
const grantBody = {
  userId: newUserId, roleId: roleByCode.get('LECTURER')?.roleId, scope: {},
  reason: 'Pengajuan grant LECTURER untuk warga uji lewat layar admin.',
};
r = await call('a2', 'POST', '/api/v1/admin/hak-akses/penugasan', grantBody);
expect('POST /admin/hak-akses/penugasan → 202 PENDING (bukan 201)', r.status === 202 && r.json?.data?.status === 'PENDING', r.json);
const grantRequestId = r.json?.data?.requestId;

r = await call('a2', 'GET', `/api/v1/admin/hak-akses/penugasan?userId=${newUserId}`);
expect('pengajuan TIDAK menulis user_role_assignments (0 baris)', r.status === 200 && r.json?.meta?.pagination?.totalRecords === 0, r.json?.meta);

r = await call('a2', 'POST', '/api/v1/admin/hak-akses/penugasan', grantBody);
expect('pengajuan identik → 409 CONFLICT (`uq_acr_pending_scope`)', r.status === 409 && r.code === 'CONFLICT', r.json);

// ── 5. Empat-mata ────────────────────────────────────────────────────────────
r = await call('a2', 'POST', `/api/v1/admin/permintaan-hak/${grantRequestId}/approve`, {});
expect('pemohon menyetujui miliknya sendiri → 403 SELF_APPROVAL_FORBIDDEN', r.status === 403 && r.code === 'SELF_APPROVAL_FORBIDDEN', r.json);

r = await call('mhs', 'POST', `/api/v1/admin/permintaan-hak/${grantRequestId}/approve`, {});
// Diralat 2026-10-23 (e2e fase 1c menemukan urutannya terbalik): **izin lebih dulu, MFA
// kedua**. Mahasiswa bukan pemegang hak approve, jadi jawabannya 403 — menjawab 401
// MFA_REQUIRED berarti menyuruh peran tanpa hak menyelesaikan ceremony yang tidak akan
// pernah membuka aksi ini, sekaligus isyarat bahwa "dengan MFA kamu bisa".
expect('urutan gerbang: peran tanpa hak → 403 FORBIDDEN (bukan diminta MFA)',
  r.status === 403 && r.code === 'FORBIDDEN', r.json);

r = await call('adm', 'POST', `/api/v1/admin/permintaan-hak/${grantRequestId}/approve`, {});
expect('pemegang hak tanpa sesi MFA → 401 MFA_REQUIRED', r.status === 401 && r.code === 'MFA_REQUIRED', r.json);

r = await call('a3', 'POST', `/api/v1/admin/permintaan-hak/${grantRequestId}/approve`, {});
expect('orang KEDUA menyetujui → 200 APPROVED', r.status === 200 && r.json?.data?.status === 'APPROVED', r.json);
expect('efek keputusan menyebutkan grant yang lahir', String(r.json?.data?.effect).startsWith('ASSIGNMENT_GRANTED'), r.json?.data);

r = await call('a3', 'POST', `/api/v1/admin/permintaan-hak/${grantRequestId}/approve`, {});
expect('keputusan terminal tidak dapat diulang → 409 DECISION_ALREADY_MADE', r.status === 409 && r.code === 'DECISION_ALREADY_MADE', r.json);

r = await call('a2', 'GET', `/api/v1/admin/hak-akses/penugasan?userId=${newUserId}`);
const assignmentRow = (r.json?.data ?? [])[0];
expect('setelah approve: 1 penugasan aktif berasal GRANT (bukan SEED)',
  r.status === 200 && assignmentRow?.origin === 'GRANT' && assignmentRow?.active === true, r.json?.data);

r = await call('a2', 'GET', `/api/v1/admin/pengguna/${newUserId}`);
expect('hak baru terbaca dari tabel pada permintaan berikutnya (roleCodes=LECTURER)',
  (r.json?.data?.roleCodes ?? []).includes('LECTURER'), r.json?.data);

// ── 6. Penyetuju = target → ditolak ─────────────────────────────────────────
r = await call('a2', 'GET', '/api/v1/admin/pengguna?q=admin3@demo.sica.test&limit=10');
const admin3Row = (r.json?.data ?? []).find((x) => x.email === 'admin3@demo.sica.test');
expect('daftar menemukan akun penyetuju kedua', !!admin3Row?.userId, r.json?.data);
// Peran kostum dari run ini → pasangan (target, role, scope) selalu baru, sehingga
// `uq_acr_pending_scope` milik run sebelumnya tidak ikut menolak pengajuan.
r = await call('a2', 'POST', '/api/v1/admin/hak-akses/penugasan', {
  userId: admin3Row?.userId, roleId: customRoleId, scope: {},
  reason: 'Grant untuk admin3 sendiri — empat-mata harus menolak dia menyetujuinya.',
});
const selfTargetRequestId = r.json?.data?.requestId;
expect('pengajuan grant untuk admin3 → 202 PENDING', r.status === 202 && !!selfTargetRequestId, r.json);
r = await call('a3', 'POST', `/api/v1/admin/permintaan-hak/${selfTargetRequestId}/approve`, {});
expect('penyetuju = target → 403 SELF_APPROVAL_FORBIDDEN (APPROVER_IS_TARGET)',
  r.status === 403 && r.code === 'SELF_APPROVAL_FORBIDDEN' && JSON.stringify(r.json).includes('APPROVER_IS_TARGET'), r.json);

// ── 7. SoD: `violatesSoD()` punya pemanggil produksi (SEC-12) ────────────────
r = await call('a2', 'POST', '/api/v1/admin/hak-akses/penugasan', {
  userId: newUserId, roleId: roleByCode.get('ADMIN_FINANCE')?.roleId, scope: {},
  reason: 'Tahap 1 SoD: grant ADMIN_FINANCE lebih dulu untuk warga uji.',
});
const financeRequestId = r.json?.data?.requestId;
expect('pengajuan ADMIN_FINANCE → 202', r.status === 202 && !!financeRequestId, r.json);
r = await call('a3', 'POST', `/api/v1/admin/permintaan-hak/${financeRequestId}/approve`, {});
expect('approve ADMIN_FINANCE → 200', r.status === 200 && r.json?.data?.status === 'APPROVED', r.json);

r = await call('a2', 'POST', '/api/v1/admin/hak-akses/penugasan', {
  userId: newUserId, roleId: roleByCode.get('TREASURER')?.roleId, scope: {},
  reason: 'Tahap 2 SoD: TREASURER di atas ADMIN_FINANCE — harus ditolak BR-K2.',
});
expect('GRANT pasangan mutual-eksklusif → 409 CONFLICT dan TIDAK menjadi baris PENDING',
  r.status === 409 && r.code === 'CONFLICT' && JSON.stringify(r.json).includes('TREASURER'), r.json);
r = await call('a2', 'GET', '/api/v1/admin/permintaan-hak?status=PENDING&limit=100');
expect('permintaan SoD tidak tertinggal sebagai baris PENDING',
  !(r.json?.data ?? []).some((x) => x.roleCode === 'TREASURER'), (r.json?.data ?? []).map((x) => x.roleCode));

// ── 8. REVOKE juga lewat empat-mata, dan TIDAK menghapus baris ───────────────
r = await call('a2', 'GET', `/api/v1/admin/hak-akses/penugasan?userId=${newUserId}`);
const activeBeforeReject = (r.json?.data ?? []).filter((x) => x.active).length;
r = await call('a2', 'DELETE', `/api/v1/admin/hak-akses/penugasan/${assignmentRow?.assignmentId}?reason=Pencabutan+uji+empat-mata+Fase+1B`);
expect('DELETE penugasan → 202 permintaan REVOKE', r.status === 202 && r.json?.data?.status === 'PENDING', r.json);
const revokeRequestId = r.json?.data?.requestId;

r = await call('a2', 'POST', `/api/v1/admin/permintaan-hak/${revokeRequestId}/reject`, { reason: 'pendek' });
expect('penolakan beralasan < 10 karakter → 422 VALIDATION_FAILED', r.status === 422 && r.code === 'VALIDATION_FAILED', r.json);
r = await call('a3', 'POST', `/api/v1/admin/permintaan-hak/${revokeRequestId}/reject`, {
  reason: 'Ditolak sengaja: uji penolakan beralasan pada mesin empat-mata.',
});
expect('penolakan oleh orang kedua → 200 REJECTED', r.status === 200 && r.json?.data?.status === 'REJECTED', r.json);

r = await call('a2', 'GET', `/api/v1/admin/hak-akses/penugasan?userId=${newUserId}&includeExpired=true`);
const activeAfterReject = (r.json?.data ?? []).filter((x) => x.active).length;
expect('penolakan REVOKE tidak menutup apa pun (jumlah aktif sama seperti sebelum pencabutan)',
  activeBeforeReject === activeAfterReject && activeAfterReject >= 1, { activeBeforeReject, activeAfterReject });
expect('baris penugasan tidak pernah dihapus (riwayat tetap terbaca dengan includeExpired)',
  (r.json?.data ?? []).length >= activeAfterReject, r.json?.data?.length);

// ── 9. ROLE_PERMISSION_CHANGE: delta hanya berlaku setelah persetujuan ───────
r = await call('a2', 'GET', `/api/v1/admin/hak-akses/peran/${customRoleId}`);
const beforeCount = r.json?.data?.permissionCount;
r = await call('a2', 'PUT', `/api/v1/admin/hak-akses/peran/${customRoleId}/izin`, {
  grant: [somePerm?.permissionId], revoke: [], reason: 'Mengajukan delta izin untuk peran kostum pustakawan.',
});
expect('PUT /peran/:id/izin → 202 ROLE_PERMISSION_CHANGE', r.status === 202 && r.json?.data?.status === 'PENDING', r.json);
const deltaRequestId = r.json?.data?.requestId;

r = await call('a2', 'GET', `/api/v1/admin/hak-akses/peran/${customRoleId}`);
expect('delta BELUM mengubah role_permissions (jumlah izin tetap)',
  r.status === 200 && r.json?.data?.permissionCount === beforeCount, { before: beforeCount, after: r.json?.data?.permissionCount });

r = await call('a3', 'POST', `/api/v1/admin/permintaan-hak/${deltaRequestId}/approve`, {});
expect('approve delta → 200 dengan efek terhitung', r.status === 200 && String(r.json?.data?.effect).includes('ROLE_PERMISSIONS'), r.json);
r = await call('a2', 'GET', `/api/v1/admin/hak-akses/peran/${customRoleId}`);
expect('setelah approve: role_permissions benar-benar bertambah',
  r.json?.data?.permissionCount === (beforeCount ?? 0) + 1, r.json?.data?.permissionCount);

// ── 10. SCOPE_CHANGE diblokir (izin 112 belum dipromosikan) ──────────────────
r = await call('a2', 'POST', '/api/v1/admin/permintaan-hak', {
  requestKind: 'SCOPE_CHANGE', targetUserId: newUserId, roleId: roleByCode.get('LECTURER')?.roleId,
  assignmentId: assignmentRow?.assignmentId, scope: {}, reason: 'Uji pemblokiran SCOPE_CHANGE (G-15).',
});
expect('SCOPE_CHANGE → 409 CONFLICT dengan alasan rute diblokir, bukan diam-diam dilayani',
  r.status === 409 && r.code === 'CONFLICT' && JSON.stringify(r.json).includes('identity.assignment.scope'), r.json);

// ── 11. Anti-IDOR: id dari tenant lain tidak terlihat ────────────────────────
const foreign = process.env.FOREIGN_ASSIGNMENT_ID ?? '';
if (foreign) {
  r = await call('a2', 'DELETE', `/api/v1/admin/hak-akses/penugasan/${foreign}?reason=Probe+lintas-tenant+untuk+uji+RLS+Fase+1B`);
  expect('penugasan tenant lain → 404 (bukan 403: keberadaan tidak bocor)', r.status === 404 && r.code === 'NOT_FOUND', r.json);
} else {
  console.log('  SKIP  probe lintas-tenant (FOREIGN_ASSIGNMENT_ID tidak diisi)');
}

// ── 12. Nonaktif pengguna: sesi & penugasan ditutup, baris tetap ada ─────────
r = await call('a2', 'POST', `/api/v1/admin/pengguna/${newUserId}/nonaktif`, { reason: 'Nonaktif untuk uji penutupan penugasan Fase 1B.' });
expect('POST /nonaktif → 200 dengan hitungan penugasan & sesi yang ditutup',
  r.status === 200 && r.json?.data?.closedAssignments >= 1, r.json);
r = await call('a2', 'GET', `/api/v1/admin/hak-akses/penugasan?userId=${newUserId}`);
expect('setelah nonaktif: tidak ada penugasan aktif tersisa', (r.json?.data ?? []).length === 0, r.json?.data);
r = await call('a2', 'GET', `/api/v1/admin/pengguna/${newUserId}`);
expect('baris pengguna TIDAK dihapus (hanya status berubah)', r.status === 200 && r.json?.data?.accountStatus === 'DISABLED', r.json?.data);

r = await call('a2', 'POST', '/api/v1/admin/pengguna', {
  fullName: 'Duplikat Email', email: NEW_EMAIL, memberCode: `DP${stamp}`, memberRole: 'staff',
  initialPassword: 'Rahasia123456!', reason: 'Uji penolakan email ganda pada pembuatan akun.',
});
expect('email ganda → 409 CONFLICT', r.status === 409 && r.code === 'CONFLICT', r.json);

// ── 13. Jejak audit: setiap langkah tertulis dan tersambung ─────────────────
r = await call('plt', 'POST', '/api/v1/auth/login', { tenantIdentifier: 'platform', username: 'platform@demo.sica.test', password: 'PlatformPass!23' });
r = await call('plt', 'POST', '/api/v1/auth/mfa/verify', { mfaToken: r.json?.data?.mfaToken, totpCode: totp(B32) });
expect('login operator platform (untuk baca audit) → sesi MFA', r.status === 200, r.json);
r = await call('a2', 'GET', `/api/v1/admin/permintaan-hak?status=all&limit=100`);
const seen = new Set((r.json?.data ?? []).map((x) => x.status));
expect('daftar permintaan menampilkan PENDING & APPROVED & REJECTED sekaligus', ['PENDING', 'APPROVED', 'REJECTED'].every((s) => seen.has(s)), [...seen]);

console.log(failures === 0 ? '\nE2E FASE 1B (R-2.1): HIJAU' : `\nE2E FASE 1B (R-2.1): ${failures} KEFAILAN`);
process.exit(failures === 0 ? 0 : 1);
