import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const rep = [];
const job = (file, label, a, b) => {
  const p = D + file;
  let s = readFileSync(p, 'utf8');
  const i = s.indexOf(a);
  if (i === -1) { rep.push(file + ' ' + label + ': MISS'); return; }
  if (s.lastIndexOf(a) !== i) { rep.push(file + ' ' + label + ': AMBIG'); return; }
  s = s.slice(0, i) + b + s.slice(i + a.length);
  writeFileSync(p, s, 'utf8');
  rep.push(file + ' ' + label + ': OK');
};
const many = (file, label, a, b) => {
  const p = D + file;
  let s = readFileSync(p, 'utf8');
  const n = s.split(a).length - 1;
  if (n === 0) { rep.push(file + ' ' + label + ': MISS'); return; }
  s = s.split(a).join(b);
  writeFileSync(p, s, 'utf8');
  rep.push(file + ' ' + label + ': OK x' + n);
};

/* 1 — baris register 119 */
const ROW118 = '| 118 | 422 | `MENU_ROUTE_KEY_UNKNOWN`';
const i0 = readFileSync(D + 'API_SPEC.md', 'utf8');
const at = i0.indexOf(ROW118);
if (at === -1) rep.push('row-119: MISS-anchor');
else {
  const lineEnd = i0.indexOf(NL, i0.indexOf(NL, at) + 1); // baris 118 adalah satu baris tabel
  const row =
    '| 119 | 501 | `MFA_NOT_IMPLEMENTED` | Tantangan MFA belum dapat diverifikasi server: tidak ada tempat penyimpanan tantangan yang dimiliki `DATA_MODEL`, sehingga `mfaToken` yang keluar dari login adalah token opaque **tanpa ikatan** ke upaya login dan tanpa masa berlaku. Rute **menolak total** — tanpa akses token, tanpa cookie, tanpa identitas — dan **tidak** menyamar menjadi sukses. Ini vonis `SEC-01` (CRITICAL): stub lama menerima enam digit apa pun. Yang benar bukan menghapus MFA dari login, tetapi menutup gerbang sampai tantangan punya rumah. | Tidak — sampai `mfa_factors` + tabel tantangan berdiri dan TOTP diverifikasi server | `admin.errors.MFA_NOT_IMPLEMENTED` | **dipancarkan 2026-10-20** di `apps/web/src/app/api/v1/auth/mfa/verify/route.ts` (menggantikan stub fail-open) |';
  const s = i0.slice(0, lineEnd) + NL + row + i0.slice(lineEnd);
  writeFileSync(D + 'API_SPEC.md', s, 'utf8');
  rep.push('row-119: OK');
}

/* 2 — §4.1.2 ditulis ulang */
job('API_SPEC.md', 'sec-412',
  '#### 4.1.2 POST `/api/v1/auth/mfa/verify`' + NL + 'Memverifikasi 6 digit kode Time-based One-Time Password (TOTP) atau SMS OTP.',
  [
    '#### 4.1.2 POST `/api/v1/auth/mfa/verify`',
    '',
    'Memverifikasi 6 digit kode Time-based One-Time Password (TOTP) terhadap tantangan MFA yang **diterbitkan server**.',
    '',
    '> **Vonis `SEC-01` 2026-10-20 — gerbang ini sengaja tertutup.** Kode hari ini selalu `501 MFA_NOT_IMPLEMENTED` (baris §2.3 nomor 119). Alasannya terukur, bukan malas: `auth.service.ts:144-146` mengembalikan `mfaToken: generateOpaqueToken()` yang **tidak pernah disimpan** dan tidak terikat ke siapa pun, sementara stub lama meloloskan `totpCode` enam digit apa pun lalu mencetak `accessToken` + cookie bagi identitas acak (`mockUserId`/`mockTenantId` dari `crypto.randomUUID()`). Bentuk itu fail-open dan lebih berbahaya daripada `501`, karena klien menafsirkannya sebagai "MFA berhasil".',
    '>',
    '> **Syarat agar 501 ini boleh dicabut** (semua wajib ada sebelum satu baris verifikasi ditulis): (1) objek penyimpanan tantangan dimiliki `DATA_MODEL` dan diberi nomor migrasi — kolom minimal `user_id`, `tenant_id`, `factor_type`, `challenge_hash` (bukan token mentah), `expires_at` (±120 s), `attempt_count` plafon 5, `consumed_at`, `bound_device_id`; (2) `mfa_factors.secret` terbaca lewat dekripsi keyring dan **tidak pernah** menjadi baris `master_system_parameters` (`is_secret = false`, `AGENTS §3.10`); (3) TOTP RFC 6238 dihitung server dengan jendela langkah yang **dibaca dari parameter** `attendance.totp_*`/`auth.totp_step_seconds` (bukan konstanta) dengan **perbandingan waktu-konstan**; (4) satu tantangan satu kali pakai (`consumed_at` + `409` bila dipakai ulang) dan setiap kegagalan dicatat pada riwayat audit; (5) uji eskalasi: kode benar dari tantangan **lain** atau kode dari tenant **lain** → 401. Celah ini terdaftar sebagai `RD-56` di [AUDIT_READINESS §12.5](file:///c:/SICA/docs/AUDIT_READINESS.md).',
  ].join(NL));

/* 3 — angka register 118 -> 119 di pemiliknya */
many('API_SPEC.md', 'cnt-92', '**Jumlah terukur: 118 kode**', '**Jumlah terukur: 119 kode**');
job('API_SPEC.md', 'cnt-253', '6. Baris **42–118** seluruhnya berstatus `spec`', '6. Baris **42–119** seluruhnya berstatus `spec`');
job('API_SPEC.md', 'cnt-3541', '| Kode error terdaftar di §2.3 | **118** |', '| Kode error terdaftar di §2.3 | **119** |');
job('ARCHITECTURE.md', 'cnt-arch', '| **118 baris bernomor** (baris 107–118 adalah gugus', '| **119 baris bernomor** (baris 107–118 adalah gugus');
job('ROADMAP_TASKS.md', 'cnt-rm', '- Register kode error API_SPEC §2.3 = **118** baris', '- Register kode error API_SPEC §2.3 = **119** baris');

console.log(rep.join(NL));
