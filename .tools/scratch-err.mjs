// scratch: berapa baris register kode error API_SPEC yang menyebut modul M-xx
import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const L = readFileSync('docs/API_SPEC.md', 'utf8').split(String.fromCharCode(10));
const s = L.findIndex((l) => /^### 2\.3/.test(l));
let e = L.length;
for (let i = s + 1; i < L.length; i++) { if (/^## 3\./.test(L[i])) { e = i; break; } }
const RE_ROW = new RegExp('^\\|\\s*(\\d+)\\s*\\|\\s*\\d{3}\\s*\\|\\s*' + String.fromCharCode(96));
const RE_MOD = /(?<![A-Za-z0-9])M-\d\d(?![0-9])/g;
let n = 0, withMod = 0;
const contoh = [];
for (let i = s; i < e; i++) {
  if (!RE_ROW.test(L[i])) continue;
  n++;
  const toks = [...L[i].matchAll(RE_MOD)].map((x) => x[0]);
  if (toks.length) { withMod++; if (contoh.length < 6) contoh.push((i + 1) + ' ' + toks.join(',')); }
}
console.log('baris register error = ' + n + ' · yang menyebut M-xx = ' + withMod);
console.log(contoh.join(NL));
