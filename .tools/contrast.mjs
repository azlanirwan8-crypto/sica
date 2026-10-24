function lin(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function lum(rgb) {
  const [r, g, b] = rgb;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function hex(h) {
  const m = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16));
}
function ratio(a, b) {
  const l1 = Array.isArray(a) ? lum(a) : lum(hex(a));
  const l2 = Array.isArray(b) ? lum(b) : lum(hex(b));
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

const DARK_CARD = '#1e2227';

function darkSoft(rgbStr) {
  const m = rgbStr.match(/([\d.]+) ([\d.]+) ([\d.]+) \/ ([\d.]+)/);
  const a = Number(m[4]);
  const base = hex(DARK_CARD);
  return [0, 1, 2].map((i) => Math.round(Number(m[i + 1]) * a + base[i] * (1 - a)));
}

const rows = [
  ['primary', '#089e85', '#e6f7f5', '#0ab39c', '10 179 156 / 0.14'],
  ['success', '#0ab39c', '#e6f7f5', '#0ab39c', '10 179 156 / 0.14'],
  ['info', '#1f87c1', '#e8f5fc', '#299cdb', '41 156 219 / 0.16'],
  ['warning', '#a97a2c', '#fdf4e6', '#f8fafc', '247 184 75 / 0.16'],
  ['danger', '#d94c30', '#fdeee9', '#f06548', '240 101 72 / 0.16'],
  ['secondary', '#405189', '#eceef6', '#7c8dc9', '124 141 201 / 0.16'],
  ['neutral', '#475569', '#f1f5f9', '#b0bccd', '27 32 38 / 1'],
];
console.log('PAKT SAAT INI (badge/btn soft & label, teks 10-11px butuh 4.5:1)');
for (const [n, lt, lb, dt, ds] of rows) {
  console.log('  ' + n.padEnd(10) + ' light=' + ratio(lt, lb).toFixed(2) + ':1  dark=' + ratio(dt, darkSoft(ds)).toFixed(2) + ':1');
}

console.log('KANDIDAT PERBAIKAN (light)');
const props = [
  ['primary #078b76', '#078b76', '#e6f7f5'],
  ['primary #046c5a', '#046c5a', '#e6f7f5'],
  ['success #046c5a', '#046c5a', '#e6f7f5'],
  ['info #1668a0', '#1668a0', '#e8f5fc'],
  ['warning #4a3410', '#4a3410', '#fdf4e6'],
  ['warning #7a5514', '#7a5514', '#fdf4e6'],
  ['danger #a83216', '#a83216', '#fdeee9'],
  ['secondary #2c3a63', '#2c3a63', '#eceef6'],
];
for (const [n, f, b] of props) console.log('  ' + n.padEnd(20) + ratio(f, b).toFixed(2) + ':1');

console.log('KANDIDAT PERBAIKAN (dark, teks terang di atas soft)');
const propsD = [
  ['#5eead4', '10 179 156 / 0.14'],
  ['#7dd3c8', '10 179 156 / 0.14'],
  ['#93c5fd', '41 156 219 / 0.16'],
  ['#fcd34d', '247 184 75 / 0.16'],
  ['#fca5a5', '240 101 72 / 0.16'],
  ['#c7d2fe', '124 141 201 / 0.16'],
];
for (const [t, s] of propsD) console.log('  ' + t.padEnd(10) + ratio(t, darkSoft(s)).toFixed(2) + ':1');
