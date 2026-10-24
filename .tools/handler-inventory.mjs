// handler-inventory.mjs — PEMILIK pertanyaan "sebanyak apa kode yang nyata ada dan menyentuh basis data".
// Kenapa alat ini harus ada: seluruh pengukuran saya selama ini membaca `docs/`. Ketika dokumen menulis
// "nol handler untuk gugus ini", itu benar untuk katalog rute §7 — tetapi kalimat yang sama, dibaca sebagai
// "tidak ada kode apa pun", adalah klaim yang salah dan tidak diukur oleh alat mana pun. Auditor kode
// menjawabnya dengan tangan; itu melanggar aturan main kita (RD-55: setiap angka publik punya skrip pemilik).
// Cara pakai: node .tools/handler-inventory.mjs
// Prinsip: alat ini TIDAK menilai kualitas desain. Ia hanya menghitung, dan mencetak bukti untuk tiap angka.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'C:/SICA';
const NL = String.fromCharCode(10);
const files = [];
(function walk(dir) {
  let ents;
  try { ents = readdirSync(dir); } catch { return; }
  for (const e of ents) {
    if (e === 'node_modules' || e === '.next' || e === '.git' || e === 'build' || e === 'dart_tool') continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else files.push(p);
  }
})(join(ROOT, 'apps'));
(function walk(dir) {
  let ents;
  try { ents = readdirSync(dir); } catch { return; }
  for (const e of ents) {
    if (e === 'node_modules' || e === '.git') continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else files.push(p);
  }
})(join(ROOT, 'packages'));

const rel = (p) => relative(ROOT, p).replace(/\\/g, '/');
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
const DB_MARK = /@sica\/database|\bpostgres\b|\bsql\`|drizzle|\btx\.insert\b|\bdb\.select\b/i;
const MOCK_MARK = /\bMock\b|generateMock|TODO|dummy|hardcoded|fabricat/i;
// Impor lapisan DB boleh STATIK, DINAMIK, atau require. Versi pertama hanya mengenali `from '@sica/database'`
// lalu menyimpulkan "dev-seed tidak menyentuh DB" — padahal `dev-seed.ts:23` menulis
// `await import('@sica/database')` dan `:54` `tx.insert(...)`. Kesimpulan yang salah itu akan menuduh
// dokumen yang benar; ini persis kelas RD-76, dan ini terjadi pada alat yang BARU saya tulis, dua kali.
const REAL_DB_IMPORT = /from\s+['"]@sica\/database['"]|import\s*\(\s*['"]@sica\/database['"]\s*\)|require\s*\(\s*['"]@sica\/database['"]\s*\)|postgres\s*\(|new\s+Pool\s*\(|drizzle\s*\(/;

// ---------- 1. Handler HTTP ----------
const routes = files.filter((p) => /\/app\/api\/.*[\\\/]route\.ts$/.test(rel(p))).sort();
const dbBacked = [], mockish = [], hybrid = [], neither = [];
for (const p of routes) {
  const t = read(p);
  let hit = DB_MARK.test(t) || REAL_DB_IMPORT.test(t);
  if (!hit) {
    // Satu level impor: rute yang memanggil service juga dihitung menyentuh DB bila servicenya iya.
    // Alias `@/` WAJIB ikut diselesaikan — versi pertama hanya mengejalur relatif (`./x`) dan karena itu
    // melaporkan 7 rute DB-backed padahal `auth/login` dan `krs/submit` memanggil service yang mengimpor
    // `@sica/database`. Angka yang terlalu rendah sama berbahayanya dengan angka yang terlalu tinggi.
    for (const im of t.matchAll(/from\s+['"](\.[^'"]+|@\/[^'"]+)['"]/g)) {
      const spec = im[1];
      const base = spec.startsWith('@/') ? join(ROOT, 'apps/web/src', spec.slice(2)) : join(p, '..', spec.replace(/^\.\//, ''));
      for (const cand of ['.ts', '/index.ts', '.tsx']) {
        const q = base + cand;
        if (existsSync(q) && DB_MARK.test(read(q))) { hit = true; break; }
      }
      if (hit) break;
    }
  }
  const isMock = MOCK_MARK.test(t);
  if (hit && isMock) hybrid.push(rel(p));
  else if (hit) dbBacked.push(rel(p));
  else if (isMock) mockish.push(rel(p));
  else neither.push(rel(p));
}
// Dua dimensi dilaporkan TERPISAH karena keduanya menarik dan tidak boleh saling menutupi: sebuah rute
// boleh jadi "menyentuh DB" DAN "masih punya cabang mock/TODO" (contoh nyata: krs/approve). Versi pertama
// memakai else-if sehingga kategori kedua hilang dan DB-backed tampak lebih bersih dari adanya.
if (process.argv.includes('--json')) {
  const cls = new Map();
  for (const x of dbBacked) cls.set(x, 'DB');
  for (const x of hybrid) cls.set(x, 'DB_MOCK');
  for (const x of mockish) cls.set(x, 'MOCK');
  for (const x of neither) cls.set(x, 'UNPROVEN');
  console.log(JSON.stringify([...cls.entries()].map(([path, k]) => ({ path, cls: k }))));
  process.exit(0);
}
console.log('## Permukaan HTTP');
console.log('route.ts = ' + routes.length + ' · menyentuh DB saja = ' + dbBacked.length + ' · menyentuh DB TAPI masih mock/TODO = ' + hybrid.length + ' · mock/TODO saja = ' + mockish.length + ' · tidak terbukti = ' + neither.length);
console.log('  DB bersih : ' + dbBacked.map((x) => x.replace('apps/web/src/app/api/v1/', '/')).join(' '));
console.log('  DB + TODO : ' + hybrid.map((x) => x.replace('apps/web/src/app/api/v1/', '/')).join(' '));
console.log('  mock saja : ' + mockish.map((x) => x.replace('apps/web/src/app/api/v1/', '/')).join(' '));
console.log('  tak terbukti : ' + neither.map((x) => x.replace('apps/web/src/app/api/v1/', '/')).join(' '));

// ---------- 2. Lapis penegakan ----------
const HELPERS = ['requireDataPrincipal', 'holdsScoped', 'withModule', 'requirePermission', 'requirePrincipal', 'verifyJwtEdge'];
console.log(NL + '## Lapis penegakan (definisi vs pemanggilan di produksi)');
for (const h of HELPERS) {
  const all = files.filter((p) => /\.(ts|tsx)$/.test(p) && new RegExp('\\b' + h + '\\b').test(read(p)));
  const def = all.filter((p) => new RegExp('export (async )?function ' + h + '\\b|export const ' + h + '\\b').test(read(p)));
  const test = all.filter((p) => /\/tests\//.test(rel(p)) || /\.test\./.test(p));
  // Pemanggilan = ada `h(`. Berkas yang HANYA mengimpor ulang (`export { h } from ...`) tidak dihitung:
  // tanpa aturan ini `holdsScoped` tampak "dipakai di produksi" karena satu baris re-export, dan SEC-11
  // yang sebenarnya akan terlihat tertutup oleh alat.
  const callRe = new RegExp('(?<![.\\w])' + h + '\\s*\\(');
  const prod = all.filter((p) => !def.includes(p) && !test.includes(p) && callRe.test(read(p).replace(/^export\s*\{[^}]*\}[^;]*;?/gm, '')));
  const reexportOnly = all.filter((p) => !def.includes(p) && !test.includes(p) && !prod.includes(p));
  console.log('  ' + h.padEnd(21) + ' definisi=' + def.length + ' · pemanggilan-produksi=' + prod.length + ' · hanya-tes=' + test.length + ' · hanya-impor-ulang=' + reexportOnly.length
    + (prod.length ? '' : '   <= TIDAK DIPAKAI DI PRODUKSI'));
  if (prod.length) console.log('        dipanggil di: ' + prod.map(rel).join(', '));
}

// ---------- 3. SEC-07: header kiriman klien ----------
const mw = join(ROOT, 'apps/web/src/middleware.ts');
const mwText = read(mw);
const strips = /headers\.delete\(\s*['"]x-(tenant-id|user-id)['"]/i.test(mwText);
const setsTenant = /x-tenant-id/i.test(mwText);
console.log(NL + '## SEC-07 (header identitas kiriman klien)');
console.log('  middleware menyetel x-tenant-id = ' + setsTenant + ' · middleware MENGHAPUS x-tenant-id/x-user-id lebih dulu = ' + strips
  + (setsTenant && !strips ? '  <= MASIH TERBUKA (dokumen SEC-07 benar)' : ''));

// ---------- 4. Dependensi yang dijanjikan ----------
const PKGS = ['package.json', 'apps/web/package.json', 'packages/contracts/package.json', 'packages/database/package.json'];
const WANT = ['bullmq', 'ioredis', 'redis', 'ws', 'socket.io', 'tesseract.js', 'onnxruntime-node', ' ort', 'maxmind', 'pdfjs-dist', 'tesseract'];
console.log(NL + '## Dependensi nyata di manifest (bukan yang disebut dokumen)');
const pjText = PKGS.map((p) => read(join(ROOT, p))).join('\n');
for (const w of ['bullmq', 'ioredis', 'redis', 'ws', 'socket.io', 'tesseract.js', 'onnxruntime-node', 'maxmind', 'pdfjs-dist']) {
  const re = new RegExp('"@?[-a-z0-9./]*' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"\\s*:');
  console.log('  ' + w.padEnd(18) + (re.test(pjText) ? 'ADA' : 'TIDAK ADA'));
}

// ---------- 5. Kunci environment ----------
const envText = read(join(ROOT, 'apps/web/src/config/env.ts'));
console.log(NL + '## ENV_CONTRACT vs env.ts');
for (const k of ['JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY_JWK', 'REDIS_URL', 'REDIS_SESSION_URL', 'TENANT_ENCRYPTION_MASTER_KEY', 'GEOIP_DB_PATH']) {
  console.log('  ' + k.padEnd(30) + (new RegExp('\\b' + k + '\\b').test(envText) ? 'terdaftar di env.ts' : 'TIDAK ADA di env.ts'));
}

// ---------- 6. Tes ----------
const tests = files.filter((p) => /(\.test\.|\.spec\.)ts$/.test(rel(p)) || (rel(p).endsWith('.dart') && /\/test\//.test(rel(p))));
const sqlTests = tests.filter((p) => REAL_DB_IMPORT.test(read(p)));
console.log(NL + '## Tes');
console.log('  berkas tes = ' + tests.length + ' · yang menyentuh DB sungguhan = ' + sqlTests.length
  + (sqlTests.length === 0 ? '  <= RLS dan SQL tidak pernah dieksekusi di CI' : ''));

// ---------- 7. Migrasi ----------
const migDir = join(ROOT, 'packages/database/migrations');
const migs = existsSync(migDir) ? readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort() : [];
console.log(NL + '## Migrasi di disk');
console.log('  berkas .sql = ' + migs.length + ' · tertinggi = ' + (migs[migs.length - 1] || '-') + ' · nomor yang dirujuk dokumen sampai 0081 => LUBANG = ' + Math.max(0, 81 - migs.length));

// ---------- 8. Mobile ----------
const dart = files.filter((p) => rel(p).endsWith('.dart') && !/\/test\//.test(rel(p)));
const screens = dart.filter((p) => /_screen\.dart$/.test(p));
const apiClient = dart.find((p) => /api_client\.dart$/.test(p));
const usesBearer = apiClient ? /Authorization|Bearer/.test(read(apiClient)) : false;
const usesCookie = apiClient ? /cookie/i.test(read(apiClient)) : false;
const platformDirs = ['android', 'ios'].filter((d) => existsSync(join(ROOT, 'apps/mobile', d)));
console.log(NL + '## Mobile (Flutter)');
console.log('  .dart = ' + dart.length + ' · layar = ' + screens.length + ' · direktori platform = ' + (platformDirs.join(',') || 'TIDAK ADA (android/ios belum dibuat)'));
console.log('  kontrak kirim kredensial di klien = ' + (usesBearer ? 'Authorization: Bearer + header' : '?') + ' · cookie = ' + (usesCookie ? 'ada' : 'TIDAK ADA')
  + ' · server membaca dari cookie = ' + (/sica_access_token/.test(read(join(ROOT, 'apps/web/src/lib/api-response.ts')) + read(join(ROOT, 'apps/web/src/lib/auth.ts'))) ? 'ya' : '?'));

// ---------- 9. Seed ----------
const seedRunner = join(ROOT, 'packages/database/src/seeds/seed-runner.ts');
const sr = read(seedRunner);
const devSeed = files.filter((p) => /dev-seed.*\.ts$/.test(p));
console.log(NL + '## Seed');
console.log('  seed-runner.ts menyentuh DB = ' + (REAL_DB_IMPORT.test(sr) ? 'ya' : 'TIDAK (stub)') + ' · berkas dev-seed = ' + devSeed.map(rel).join(', '));
console.log('  dev-seed yang mengimpor lapisan DB = ' + devSeed.filter((p) => REAL_DB_IMPORT.test(read(p))).map(rel).join(', ') + ' · sisanya menulis teks SQL tanpa koneksi: ' + (devSeed.filter((p) => !REAL_DB_IMPORT.test(read(p))).map(rel).join(', ') || '—'));
console.log('  mahasiswa ter-seed = ' + (devSeed.map((p) => read(p)).join('').match(/nim\s*:/g) || []).length + ' · dosen ter-seed = ' + (devSeed.map((p) => read(p)).join('').match(/code:\s*'NIDN/g) || []).length);

console.log(NL + '## VERDICT');
console.log('  ' + routes.length + ' handler; ' + (dbBacked.length + hybrid.length) + ' terbukti menyentuh lapisan DB (' + hybrid.length + ' di antaranya masih punya cabang mock/TODO); ' + sqlTests.length + ' tes mengeksekusi SQL; ' + migs.length + ' berkas migrasi dari 81 nomor yang dirujuk dokumen.');
console.log('  Angka di atas adalah MILIK alat ini. Dokumen boleh MENGACU ke sini, tidak menyalinnya (RD-55).');
