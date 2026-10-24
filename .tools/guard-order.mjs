/**
 * guard-order.mjs — penjaga regresi "izin mendahului bentuk" (AGENTS §3.8, RD-155, RD-165).
 *
 * Alasan alat ini ada: audit forensik 2026-10-24 mengukur 41 handler yang menjawab
 * `422 VALIDATION_FAILED` ber-`details` field-level kepada sesi yang tidak berhak,
 * dan angka itu TIDAK terdaftar di mana pun sebelumnya karena register lama hanya
 * menghitung `admin/**`. Sebuah temuan yang ditutup tanpa penjaga akan kembali.
 *
 * Aturan yang ditegakkan per handler `export async function GET|POST|PUT|PATCH|DELETE`:
 * pemanggilan penjaga (izin/identitas/state) harus mendahului pemindaian bentuk
 * (`safeParse`, `.parse(`, `UUID_RE.test`, `isUuid(`). Rute publik (`auth/**`) dikecualikan
 * karena bentuk memang sumber identitas. Satu pengecualian sadar didaftar di `ALLOW`
 * dengan alasan; menambah entri baru ke `ALLOW` adalah keputusan, bukan perbaikan diam-diam.
 *
 * Known-answer dipasang karena kelas kegagalannya sudah berulang (RD-103/RD-109): kalau
 * scanner tidak lagi membaca berkas yang seharusnya ia kenal, ia harus MENGHENTI, bukan
 * mencetak hijau.
 *
 * Penggunaan: node .tools/guard-order.mjs [--list]
 * Keluar: 0 + baris `guard-order: HIJAU` bila patuh; 1 + `MERAH` bila ada pelanggaran.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'apps/web/src/app/api/v1';
const GUARD = /(requirePlatform|requireAdmin|requireDataPrincipal|requireParameter|requirePrincipal|holdsScoped|ensureModuleActive|ctx\.authenticated|access\.granted|guard\.granted)/;
const SHAPE = /(safeParse|\.parse\(|UUID_RE\.test|isUuid\()/;

/** Rute publik: bentuk = sumber identitas, jadi parse-dahulu memang benar. */
const PUBLIC_PREFIX = ['auth/'];

/** Pengecualian sadar: `metode path` → alasan yang harus dibaca manusia, bukan angka. */
const ALLOW = new Map([
  /* 2026-10-24: `POST admin/permintaan-hak` tidak lagi dikecualikan — gerbang kelas kasar
     (`requireAdminReadAny` atas tiga izin tulis) kini mendahului parse, lalu izin presisi
     ditegakkan sesudah parse. Riwayat pengecualian tinggal di RD-165. */
]);

function routeFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...routeFiles(p));
    else if (name === 'route.ts') out.push(p);
  }
  return out;
}

const rows = [];
for (const file of routeFiles(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\s*\(/g)) {
    const rest = src.slice(m.index + 1);
    const nxt = rest.search(/\nexport (async )?function/);
    const body = nxt < 0 ? rest : rest.slice(0, nxt);
    const shapeAt = body.search(SHAPE);
    if (shapeAt < 0) continue;
    const guardAt = body.search(GUARD);
    rows.push({ key: m[1] + ' ' + rel, ok: guardAt >= 0 && guardAt < shapeAt });
  }
}

const violations = rows.filter((r) => !r.ok
  && !PUBLIC_PREFIX.some((p) => r.key.includes(' ' + p))
  && !ALLOW.has(r.key));

/* Known-answer — bila salah satu meleset, scanner-nya yang rusak, bukan dokumennya. */
const has = (key) => rows.some((r) => r.key === key && r.ok);
const KA = [
  ['admin/organisasi POST harus dikenali & guard-first', () => has('POST admin/organisasi/route.ts')],
  ['admin/pengguna GET harus dikenali & guard-first (RD-165)', () => has('GET admin/pengguna/route.ts')],
  ['platform/audit-events GET harus dikenali & guard-first (RD-165)', () => has('GET platform/audit-events/route.ts')],
  ['admin/pengguna POST harus dikenali & guard-first (RD-165)', () => has('POST admin/pengguna/route.ts')],
  ['total handler tervalidasi bentuk harus >= 50 (scanner buta = gagal)', () => rows.length >= 50],
  ['rute auth memang terdaftar sebagai publik', () => rows.some((r) => r.key.includes(' auth/'))],
];
const kaFailed = KA.filter(([, fn]) => !fn());

const listOnly = process.argv.includes('--list');
console.log('guard-order: handler tervalidasi bentuk = ' + rows.length
  + ' · guard-first = ' + (rows.length - rows.filter((r) => !r.ok).length)
  + ' · parse-first non-publik = ' + violations.length
  + ' · pengecualian sadar = ' + ALLOW.size);
if (listOnly) for (const r of rows.filter((x) => !x.ok)) console.log('  ' + r.key);
for (const [key, why] of ALLOW) console.log('  DIIZINKAN ' + key + ' :: ' + why);

if (violations.length) {
  console.log('guard-order: MERAH — ' + violations.length + ' handler menjawab bentuk sebelum izin');
  for (const v of violations) console.log('  ' + v.key);
  process.exit(1);
}
if (kaFailed.length) {
  console.log('guard-order: MERAH — known-answer gagal (' + kaFailed.length + '); scanner tidak lagi membaca fakta yang ia harus tahu');
  for (const [name] of kaFailed) console.log('  ' + name);
  process.exit(1);
}
console.log('guard-order: HIJAU — tidak ada oracle 422-before-403 di luar pengecualian terdokumentasi');
