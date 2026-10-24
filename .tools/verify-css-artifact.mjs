import fs from 'node:fs';
import path from 'node:path';

const dir = 'apps/web/.next/static/css';
if (!fs.existsSync(dir)) {
  console.log('TIDAK ADA direktori CSS build: ' + dir);
  process.exit(0);
}
// `next build` menaruh artefak di `.next/static/css/<nama>.css`, tetapi `next dev`
// dan build dengan route group menghasilkan subdirektori (`.next/static/css/app/layout.css`).
// Pemindaian datar pernah membaca NOL berkas dan tetap melaporkan MISS tanpa pernah bilang
// "tidak ada yang dipindai" — jadi direktori ini dijelajahi secara rekursif.
function cssFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...cssFiles(full));
    else if (entry.name.endsWith('.css')) out.push(full);
  }
  return out;
}
const files = cssFiles(dir);
let all = '';
for (const f of files) all += fs.readFileSync(f, 'utf8');

if (files.length === 0) {
  console.log('BERKAS CSS TIDAK DITEMUKAN di ' + dir + ' — jalankan `pnpm --filter @sica/web build` lebih dulu.');
  process.exit(1);
}

console.log('berkas CSS = ' + files.map((f) => path.relative(dir, f)).join(', '));
console.log('total ukuran = ' + all.length + ' byte');

const checks = [
  ['token primary Velzon', /--sica-primary:\s*#0ab39c/],
  ['isian solid tombol', /--sica-primary-solid:\s*#078574/],
  ['ink primary', /--sica-primary-ink:\s*#046c5a/],
  ['on-primary-soft', /--sica-on-primary-soft:\s*#046c5a/],
  ['gelap on-primary-soft', /--sica-on-primary-soft:\s*#5eead4/],
  ['danger solid', /--sica-danger-solid:\s*#c04a32/],
  ['info solid', /--sica-info-solid:\s*#1e78a8/],
  ['muted terkoreksi', /--sica-text-muted:\s*#6b6f82/],
  ['on-warning gelap diperbaiki', /--sica-on-warning:\s*#4a3410/],
  ['badge-soft-warning baca token', /\.badge-soft-warning\s*\{[^}]*var\(--sica-on-warning-soft\)/],
  ['eyebrow baca token', /\.eyebrow\s*\{[^}]*var\(--sica-on-primary-soft\)/],
  ['kelas .card ada', /\.card\s*\{/],
  ['.table-head ada', /\.table-head\s*\{/],
  ['.velzon-input ada', /\.velzon-input\s*\{/],
  ['.skeleton + shimmer', /\.skeleton\s*\{/],
  ['override font-black', /\.font-black[^}]*font-weight:\s*600\s*!important/],
  ['scrollbar tipis', /scrollbar-width:\s*thin/],
  ['tema dark block', /\[data-bs-theme=['"]?dark['"]?\]/],
  ['baris atas gelap (pengganti semi-dark)', /\[data-topbar=['"]?dark['"]?\]/],
  ['layout-style gradient', /\[data-layout-style=['"]?gradient['"]?\]/],
  ['layout-style separated', /\[data-layout-style=['"]?separated['"]?\]/],
  ['layout-width boxed', /\[data-layout-width=['"]?boxed['"]?\]/],
  ['lapisan bootstrap', /@layer bootstrap/],
  ['lapisan velzon', /@layer velzon/],
  ['urutan layer terdaftar', /@layer\s+reset\s*,\s*bootstrap\s*,\s*velzon\s*;/],
  ['preflight terikat @layer reset', /@layer\s+reset\s*\{\s*\*,\s*::?(?:before|after)/],
  ['kerangka login velzon', /\.auth-fluid-sidebg\s*\{[^}]*padding/],
  ['token --bs-\* hasil proyeksi', /--bs-body-bg:\s*var\(--sica-surface-canvas\)/],
  ['kosakata Velzon bg-*-subtle', /\.bg-warning-subtle\s*\{/],
  ['kosakata Velzon text-*-emphasis', /\.text-warning-emphasis\s*\{/],
  ['kerangka .topnav', /\.topnav\s*\{/],
  ['Bootstrap .navbar-nav', /\.navbar-nav\s*\{/],
  ['utilitas bg-primary-solid', /\.bg-primary-solid\s*\{/],
  ['utilitas text-primary-ink', /\.text-primary-ink\s*\{/],
  ['token sidebar-active ada', /--sica-text-sidebar-active:\s*#[0-9a-fA-F]{3,6}/],
  ['animate-fade-up', /animate-fade-up|@keyframes fade-up/],
];

let fail = 0;
for (const [name, re] of checks) {
  const ok = re.test(all);
  if (!ok) fail++;
  console.log((ok ? 'OK   ' : 'MISS ') + name);
}

/**
 * Pengawal keputusan 2026-10-24 (UI_UX_DESIGN §2.6): reset universal HARUS
 * berada di dalam `@layer reset`. Deklarasi tanpa layer mengalahkan deklarasi
 * ber-layer berapa pun spesifikitasnya, jadi satu `* { padding: 0 }` liar
 * meniadakan seluruh `padding`/`margin` kerangka Bootstrap + Velzon — inilah
 * yang memotong panel kiri layar login sampai ke tepi layar dan membuat
 * `.auth-fluid-sidebg` dihitung browser bernilai `0px`.
 */
const unlayeredStarReset = all.match(/(?:^|[;{}])\*\s*\{[^{}]*padding\s*:\s*0[^{}]*\}/g) || [];
const starOk = unlayeredStarReset.length === 0;
if (!starOk) fail++;
console.log(`${starOk ? 'OK   ' : 'MISS '}tidak ada reset universal tanpa layer (temuan ${unlayeredStarReset.length})`);
for (const hit of unlayeredStarReset.slice(0, 3)) console.log('       → ' + hit.slice(0, 90));

const banned = [
  ['sisa --sica-color-', /--sica-color-/g],
  ['gray- hardcode', /\bgray-[0-9]00\b/g],
  ['biru Velzon lama sebagai warna', /#3577[fF]1/g],
];
/**
 * `gray-*` dan sejumlah heksa PALES keluar dari lapisan Bootstrap
 * (`--bs-gray-100`, `--bs-warning: #f7b84b`, …) — itu turunan palet yang
 * dikonfigurasi `_velzon-config.scss`, bukan kelas aplikasi. Karena itu
 * pemindaian dilaporkan PER BERKAS: angka pada berkas aplikasi = temuan,
 * angka pada berkas lapisan = atribusi Bootstrap.
 */
console.log('--- pemindaian kelas terlarang di CSS jadi (per berkas) ---');
for (const [name, re] of banned) {
  const parts = [];
  let ours = 0;
  for (const f of files) {
    const rel = path.relative(dir, f);
    const text = fs.readFileSync(f, 'utf8');
    const isLayer = /@layer bootstrap/.test(text);
    const n = (text.match(re) || []).length;
    if (!isLayer) ours += n;
    parts.push(`${rel}${isLayer ? ' [lapisan]' : ''}=${n}`);
  }
  console.log(`${name} → MILIK APLIKASI ${ours} dari total ${(all.match(re) || []).length} (${parts.join(', ')})`);
}
console.log('MISS = ' + fail);
