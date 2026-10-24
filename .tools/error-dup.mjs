import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const L = readFileSync('C:/SICA/docs/API_SPEC.md', 'utf8').split(NL);

/* 1. register otoritatif §2.3: baris  | nomor | HTTP | `KODE` | sebab | */
const s23 = L.findIndex((l) => /^### 2\.3/.test(l));
const e23 = L.findIndex((l) => /^## 3\./.test(l));
const reg = new Map();
for (let i = s23; i < e23; i++) {
  const m = L[i].match(/^\|\s*(\d+)\s*\|\s*(\d{3})\s*\|\s*`([A-Z][A-Z0-9_]+)`/);
  if (m) reg.set(Number(m[1]), { code: m[3], http: m[2], line: i + 1 });
}
const byCode = new Map();
for (const [n, v] of reg) byCode.set(v.code, n);

/* 2. tabel turunan mana pun: | nomor | `KODE` | HTTP | ... |  ATAU  | nomor | `KODE` | ... | */
let checked = 0, mismatch = [], orphan = [];
for (let i = 0; i < L.length; i++) {
  if (i >= s23 && i < e23) continue;
  const m = L[i].match(/^\|\s*(\d+)\s*\|\s*`([A-Z][A-Z0-9_]+)`\s*\|/);
  if (!m) continue;
  const n = Number(m[1]), code = m[2];
  if (n > 160) continue;           // bukan nomor register §2.3
  if (!/^[A-Z][A-Z0-9_]{5,}$/.test(code)) continue;
  checked++;
  const known = reg.get(n);
  if (!known) { orphan.push(n + ' ' + code + ' @' + (i + 1)); continue; }
  if (known.code !== code) mismatch.push('nomor ' + n + ': §2.3=' + known.code + ' tapi turunan=' + code + ' @' + (i + 1));
}
console.log('§2.3 otoritatif: nomor=' + reg.size + ' tertinggi=' + Math.max(...reg.keys()) + ' unik=' + new Set([...reg.values()].map((v) => v.code)).size);
console.log('baris turunan yang diperiksa=' + checked);
console.log('ketidakcocokan nomor↔nama=' + mismatch.length);
mismatch.slice(0, 20).forEach((x) => console.log('  ! ' + x));
console.log('nomor di turunan yang tidak ada di register=' + orphan.length);
orphan.slice(0, 10).forEach((x) => console.log('  ? ' + x));
const dup = [...byCode.entries()].filter(([, n]) => n !== undefined).length;
console.log(dup === reg.size ? 'pemetaan kode→nomor konsisten (satu nama satu nomor di register)' : 'ADA DUA NOMOR UNTUK SATU NAMA');
console.log(mismatch.length || orphan.length ? 'error-dup: MERAH' : 'error-dup: HIJAU');
