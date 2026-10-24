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

/* 1 — baris register 144 */
const p = D + 'API_SPEC.md';
let s = readFileSync(p, 'utf8');
const anchor143 = '| 143 | 409 | `AWARD_SNAPSHOT_STALE`';
const i143 = s.indexOf(anchor143);
if (i143 === -1) rep.push('row-144: MISS');
else {
  const end = s.indexOf(NL, i143);
  const row = '| 144 | 501 | `MFA_NOT_IMPLEMENTED` | Tantangan MFA belum dapat diverifikasi server. Alasan terukur: `auth.service.ts:144-146` mengembalikan `mfaToken: generateOpaqueToken()` yang tidak pernah disimpan dan tidak terikat ke satu pun upaya login, sementara `auth/mfa/verify/route.ts` tidak membaca `mfaToken` dan menerima enam digit apa pun (`RD-56`, `SEC-01`). Rute **menolak total** — tanpa token, tanpa cookie, tanpa identitas — dan **tidak** menyamar jadi sukses; stub lama justru itu. Cabut 501 ini hanya setelah objek tantangan dinomori `DATA_MODEL`, `mfa_factors` punya `tenant_id`+RLS+`secret bytea` (`SC-G4-11`), TOTP dihitung server dengan jendela dari parameter dan perbandingan waktu-konstan, serta uji eskalasi dua tenant hijau. | Tidak — sampai empat syarat di kolom samping lulus | `admin.errors.MFA_NOT_IMPLEMENTED` | `spec` — hari ini rute justru fail-open; baris ini adalah kontrak **pengganti**, bukan deskripsi |';
  s = s.slice(0, end) + NL + row + s.slice(end);
  writeFileSync(p, s, 'utf8');
  rep.push('row-144: OK');
}

/* 2 — §4.1.2 ditulis ulang dengan vonis */
job('API_SPEC.md', 'sec-412',
  '#### 4.1.2 POST `/api/v1/auth/mfa/verify`' + NL + 'Memverifikasi 6 digit kode Time-based One-Time Password (TOTP) atau SMS OTP.',
  [
    '#### 4.1.2 POST `/api/v1/auth/mfa/verify`',
    '',
    'Memverifikasi 6 digit kode Time-based One-Time Password (TOTP) terhadap tantangan MFA yang **diterbitkan dan disimpan server**.',
    '',
    '> **Vonis `SEC-01` 2026-10-20 — gerbang ini harus ditutup sebelum boleh ada isinya.** Sasaran kontrak: `501 MFA_NOT_IMPLEMENTED` (baris §2.3 nomor 144) selama tantangan belum punya rumah objek. Basis keputusan, semuanya terukur hari ini: `mfaToken` dari login adalah token opaque yang **tidak** disimpan (`auth.service.ts:144-146`); rute verifikasi **tidak** membacanya; dan satu-satunya syarat yang diperiksa adalah bentuk enam digit, yang sudah dijamin skema Zod — lalu server mencetak `accessToken` + cookie untuk identitas acak. Bentuk itu fail-open dan lebih buruk daripada 501, karena klien menafsirkannya sebagai "MFA berhasil".',
    '>',
    '> **Empat syarat mencabut 501** (semua wajib, berurutan): (1) objek penyimpanan tantangan dinomori di `DATA_MODEL §14.7` — kolom minimal `tenant_id`, `user_id`, `factor_type`, `challenge_hash` (bukan token mentah), `expires_at` ±120 s, `attempt_count` plafon 5, `consumed_at`, `bound_device_id`; (2) `mfa_factors` berdiri dengan `tenant_id` + RLS `ENABLE`/`FORCE` + `secret bytea` (`SC-G4-11`, menutup `SEC-14`/`SEC-30`) dan rahasianya **tidak pernah** menjadi baris `master_system_parameters` (`AGENTS §3.10`: `is_secret = false`); (3) TOTP RFC 6238 dihitung server, jendela langkah dibaca dari parameter (`auth.totp_step_seconds`, `auth.totp_window_steps`) dengan **perbandingan waktu-konstan** (`crypto.timingSafeEqual`, pola yang sudah hidup di `password.service.ts:77` dan `token.service.ts:51`); (4) satu tantangan satu kali pakai dan setiap kegagalan masuk riwayat audit. Uji yang menahan: kode benar dari tantangan **lain** → 401; kode dari tenant **lain** → 401; tantangan kedaluwarsa → 401; pemakaian ulang → 409.',
  ].join(NL));

/* 3 — sinkron angka silang: angka diganti rujukan + tanggal */
job('ROADMAP_TASKS.md', 'rm-51',
  '- Register kode error API_SPEC §2.3 = **118** baris (terukur `grep -cE "^\\| [0-9]+ \\|"` pada bagian §2.3 = 118; baris **107–118** adalah gugus par',
  '- Register kode error API_SPEC §2.3: **pemilik angkanya hanya `API_SPEC §2.3`** — berkas ini merujuk, tidak menyalin (norma `RD-55`). Yang terukur 2026-10-20: §7 gelombang ketujuh menaikkan register sampai baris **144** (`501 MFA_NOT_IMPLEMENTED`). Ukur ulang dengan `grep -oE \x27^\\| [0-9]{1,3} \\| [45][0-9]{2} \\|\x27 docs/API_SPEC.md | wc -l` bila angka dibutuhkan untuk tiket.');

job('ARCHITECTURE.md', 'arch-1327', '| API_SPEC §2.3 (kode error) | **118 baris bernomor** (baris 107–118 adalah gugus',
  '| API_SPEC §2.3 (kode error) | **rujuk, jangan salin** — cacah terakhir yang terukur 2026-10-20 adalah sampai baris 144 (baris 107–118 adalah gugus');

job('AUDIT_READINESS.md', 'audit-123', '| Register kode error API_SPEC §2.3 | 91 → 106 → **118** |',
  '| Register kode error API_SPEC §2.3 | 91 → 106 → 118 → **144** (2026-10-20; §7 gelombang ketujuh + `MFA_NOT_IMPLEMENTED`) |');

job('AUDIT_READINESS.md', 'rd56-pointer', '— kini ditulis sebagai "nomor berikut yang bebas" supaya tidak menjadi rujukan phantom —',
  '— kini tertulis resmi sebagai **baris 144 `MFA_NOT_IMPLEMENTED`** di `API_SPEC §2.3` dan §4.1.2, sehingga rujukan itu nyata —');

console.log(rep.join(NL));
