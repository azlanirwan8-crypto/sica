/**
 * egress-scan.mjs — gerbang CI-G4 (AGENTS §3.9 "Nol kunci API, nol egress").
 *
 * Memindai seluruh direktori engine (nama `engine`/`engines` di bawah apps/ dan packages/,
 * ditambah apps/worker bila ada) dari panggilan keluar: fetch(, axios, https.request,
 * http.request, XMLHttpRequest, WebSocket. Temuan = keluar 1 (build gagal).
 *
 * Selftest selalu dijalankan lebih dulu: fixture yang memanggil `fetch(` WAJIB terdeteksi —
 * bila tidak, alat ini keluar 1 walau scan asli bersih. Dengan begitu gerbang tidak bisa
 * menjadi seremonial karena pemindainya diam-diam rusak.
 *
 * Keluaran vonis: `egress-scan: HIJAU — direktori engine=N · berkas dipindai=M · pelanggaran=0`
 * atau `egress-scan: MERAH — ...` dengan daftar path:line.
 */
import { readdirSync, readFileSync, statSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOTS = ['apps', 'packages'];
const EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const CALL_PATTERNS = [
  /\bfetch\s*\(/,
  /\brequire\s*\(\s*['"]axios['"]\s*\)/,
  /\bfrom\s+['"]axios['"]/,
  /\bhttps?\.request\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bnew\s+WebSocket\s*\(/,
];

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next' || name === '.turbo') continue;
      walk(p, out);
    } else if (EXT.test(name)) {
      out.push(p);
    }
  }
  return out;
}

function scanDir(engineDir) {
  const violations = [];
  for (const file of walk(engineDir, [])) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (CALL_PATTERNS.some((re) => re.test(line))) {
        violations.push(`${file.replace(/\\/g, '/')}:${i + 1}`);
      }
    });
  }
  return violations;
}

function findEngineDirs() {
  const found = [];
  const visit = (dir, depth) => {
    if (depth > 6) return;
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      const p = join(dir, name);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (!st.isDirectory()) continue;
      if (name === 'node_modules' || name === '.next' || name === '.turbo') continue;
      if (/^engines?$/.test(name)) found.push(p);
      else visit(p, depth + 1);
    }
  };
  for (const root of ROOTS) visit(root, 0);
  if (exists('apps/worker')) found.push('apps/worker');
  return found;
}

function exists(p) {
  try { statSync(p); return true; } catch { return false; }
}

function selftest() {
  const dir = mkdtempSync(join(tmpdir(), 'egress-selftest-'));
  const engine = join(dir, 'engines');
  const sub = join(engine, 'sub');
  mkdirSync(sub, { recursive: true });
  writeFileSync(join(engine, 'clean.ts'), 'export function sum(a: number, b: number): number { return a + b; }\n');
  writeFileSync(join(sub, 'bad.ts'), "const r = await fetch('https://evil.example');\n");
  const violations = scanDir(engine);
  rmSync(dir, { recursive: true, force: true });
  if (violations.length !== 1 || !violations[0].endsWith('bad.ts:1')) {
    console.error('egress-scan: MERAH — SELFTEST GAGAL: fixture `fetch(` tidak terdeteksi tepat (dapat: ' + JSON.stringify(violations) + ')');
    process.exit(1);
  }
  console.log('egress-scan: selftest lulus — fixture pelanggaran egress terbukti ditolak.');
}

selftest();

const engineDirs = findEngineDirs();
const all = [];
for (const d of engineDirs) all.push(...scanDir(d));
const scanned = engineDirs.reduce((n, d) => n + walk(d, []).length, 0);

if (all.length > 0) {
  console.error('egress-scan: MERAH — ' + all.length + ' pelanggaran egress di direktori engine:');
  for (const v of all) console.error('  ' + v);
  process.exit(1);
}
console.log('egress-scan: HIJAU — direktori engine=' + engineDirs.length + ' · berkas dipindai=' + scanned + ' · pelanggaran=0');
