/**
 * m02-izin-gap.mjs — scratch kajian: daftar KODE IZIN yang dituntut rute M-02 di `API_SPEC`
 * (§4.14 kamus/atribut, §4.16 parameter, §4.17 menu, §4.6.4 impor) dan cek apakah kodenya punya
 * baris katalog ber-nomor di `RBAC §4.5`. Kode yang dituntut rute tetapi tidak bernomor = grant
 * tidak bisa ditulis (`CRD-5b` kelas `G-15`); ini yang menentukan apakah M-02 perlu gelombang baru.
 */
import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const spec = readFileSync('docs/API_SPEC.md', 'utf8').split(NL);
const rb = readFileSync('docs/RBAC_MATRIX.md', 'utf8');
const numbered = new Set([...rb.matchAll(/^\|\s*(\d{1,3})\s*\|\s*`([a-z_][a-z0-9_.]*)`/gm)].map((m) => m[2]));
const usulan = new Set([...rb.matchAll(/`([a-z_][a-z0-9_]*(?:\.[a-z0-9_]+)+)`/g)].map((m) => m[1]));
const SECTIONS = ['4.14', '4.16', '4.17', '4.6.4', '4.6.3', '4.19'];
const inSec = (i, cur) => SECTIONS.some((s) => cur.startsWith(s));
let cur = '';
const need = new Map();
for (let i = 0; i < spec.length; i++) {
  const h = spec[i].match(/^#{3,4}\s+([\d.]+)/);
  if (h) cur = h[1];
  if (!inSec(i, cur) || !spec[i].startsWith('|')) continue;
  for (const m of spec[i].matchAll(/`([a-z_][a-z0-9_]*(?:\.[a-z0-9_]+)+)`/g)) {
    const code = m[1];
    if (!/^[a-z_.]+$/.test(code)) continue;
    if (!/(view|create|update|delete|manage|validate|approve|reject|consume|merge|reorder|deactivate|retire|activate|commit|proof|record|provision|pull|reconcile|edit|run|verify|history|impact|usage|export|grant|mark|toggle|restore|revert|register)$|\.view$|\.manage$/.test(code)) continue;
    if (!need.has(code)) need.set(code, cur);
  }
}
const rows = [...need.entries()].sort((a, b) => a[0].localeCompare(b[0]));
let ok = 0, usul = 0, absen = 0;
for (const [code, sec] of rows) {
  const hasNum = numbered.has(code);
  const named = usulan.has(code);
  if (hasNum) ok++; else if (named) usul++; else absen++;
  if (!hasNum) console.log((named ? 'NAMA-TANPA-NOMOR ' : 'TIDAK ADA DI KATALOG ') + code.padEnd(40) + '§' + sec);
}
console.log(NL + 'kode dituntut rute M-02 = ' + rows.length + ' · ber-nomor = ' + ok + ' · bernama tanpa nomor = ' + usul + ' · tidak terdaftar sama sekali = ' + absen);
