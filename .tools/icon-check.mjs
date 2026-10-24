// icon-check.mjs — bukti bahwa setiap glif `ri-*` yang dipakai kode benar-benar ada di
// `remixicon@4.5.0` (UI_UX_DESIGN §2.6: kerangka memakai Remix). Nama glif yang salah tidak
// pernah memunculkan galat — ia hanya menjadi kotak kosong di layar, yaitu bug yang terlihat
// oleh pengguna tetapi tidak oleh `tsc`. Karena itu diperiksa dari sumbernya, bukan dipercaya.
//
// Pemakaian: node .tools/icon-check.mjs            → semua file .ts/.tsx di apps/web/src
//            node .tools/icon-check.mjs --quiet     → hanya vonis (dipakai gerbang)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cssPath = path.join(
  root,
  'node_modules/.pnpm/remixicon@4.5.0/node_modules/remixicon/fonts/remixicon.css'
);
if (!fs.existsSync(cssPath)) {
  console.error('remixicon.css tidak ditemukan — jalankan `pnpm install` lebih dulu.');
  process.exit(2);
}

const known = new Set([...fs.readFileSync(cssPath, 'utf8').matchAll(/\.ri-[a-z0-9-]+(?=:)/g)].map((m) => m[0].slice(1)));

const srcDir = path.join(root, 'apps/web/src');
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(p);
  }
})(srcDir);

/** @type {Map<string, string[]>} */
const misses = new Map();
let used = 0;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/['"`](ri-[a-z0-9-]+)['"`]/g)) {
    const name = m[1];
    used += 1;
    if (known.has(name)) continue;
    const list = misses.get(name) ?? [];
    list.push(path.relative(root, file));
    misses.set(name, list);
  }
}

const quiet = process.argv.includes('--quiet');
for (const [name, where] of [...misses].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`MISSING ${name}  ← ${[...new Set(where)].join(', ')}`);
}
if (!quiet) console.log(`glif dirujuk: ${used} · unik dikenal: ${known.size} · salah nama: ${misses.size}`);
if (misses.size > 0) process.exit(1);
if (!quiet) console.log('OK — seluruh nama ikon Remix ada di remixicon.css');
