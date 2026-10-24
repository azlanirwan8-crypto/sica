import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const L = readFileSync('C:/SICA/docs/RBAC_MATRIX.md', 'utf8').split(NL);

const scan = (startRe, endRe, label) => {
  const s = L.findIndex((l) => startRe.test(l));
  let e = L.length;
  for (let i = s + 1; i < L.length; i++) if (endRe.test(L[i])) { e = i; break; }
  const nums = []; const verbs = new Map(); const mods = new Map(); const stats = new Map();
  for (let i = s; i < e; i++) {
    const m = L[i].match(/^\|\s*(\d+)\s*\|\s*`([a-z_]+(?:\.[a-z_0-9]+)+)`\s*\|\s*`?([a-z_]+)`?\s*\|[^|]*\|\s*`?([A-Z]+)`?\s*\|/);
    if (!m) continue;
    nums.push(Number(m[1]));
    verbs.set(m[4], (verbs.get(m[4]) ?? 0) + 1);
    mods.set(m[3], (mods.get(m[3]) ?? 0) + 1);
    const cells = L[i].split('|');
    const st = (cells[cells.length - 2] || '').trim();
    if (/^(usulan|normatif \(mirror\)|normatif)$/.test(st)) stats.set(st, (stats.get(st) ?? 0) + 1);
  }
  const uniq = [...new Set(nums)].sort((a, b) => a - b);
  const gaps = [];
  if (uniq.length) for (let v = uniq[0]; v <= uniq[uniq.length - 1]; v++) if (!uniq.includes(v)) gaps.push(v);
  console.log(label.padEnd(24) + ' baris=' + String(nums.length).padStart(3) +
    ' unik=' + uniq.length +
    ' rentang=' + (uniq[0] ?? 0) + '-' + (uniq[uniq.length - 1] ?? 0) +
    ' lubang=' + (gaps.length ? gaps.join(',') : 'tidak ada') +
    ' verba=' + [...verbs.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join(' '));
  if (mods) console.log('  '.padEnd(24) + ' modul=' + [...mods.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join(' '));
  if (stats.size) console.log('  '.padEnd(24) + ' status=' + [...stats.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => (k || '—') + ':' + v).join(' '));
  return gaps;
};

const g13 = scan(/^### 4\.5 /, /^#### 4\.5\.1/, 'gelombang 1-3 (§4.5)');
const g4 = scan(/^#### 4\.5\.1/, /^#### 4\.5\.2/, 'gelombang 4 (§4.5.1)');
const g5 = scan(/^#### 4\.5\.2/, /^#### 4\.5\.3/, 'gelombang 5 (§4.5.2)');
const g6 = scan(/^#### 4\.5\.3/, /^#### 4\.5\.4/, 'gelombang 6 (§4.5.3)');
const g7 = scan(/^#### 4\.5\.7/, /^#### 4\.5\.8/, 'gelombang 7 (§4.5.7)');
const g8 = scan(/^#### 4\.5\.8/, /^### 4\.6 /, 'gelombang 8 (§4.5.8 mirror)');
const all = scan(/^### 4\.5 /, /^### 4\.6 /, 'seluruh baris bernomor');
const ok = !g13.length && !g4.length && !g5.length && !g6.length && !g7.length && !g8.length && !all.length;
console.log('normatif tetap: 222 izin · 17 ROLE_CODES · 607 grant (tidak diubah bagian ini)');
console.log(ok ? 'rbac-count: HIJAU (tidak ada lubang nomor)' : 'rbac-count: MERAH (ada lubang nomor)');
process.exit(ok ? 0 : 1);
