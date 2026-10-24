import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const P = 'C:/SICA/docs/ROADMAP_TASKS.md';
const lines = readFileSync(P, 'utf8').split(NL);
const find = (re) => lines.findIndex((l) => re.test(l));
const i20 = find(/^### 2\.20 /);
const i19 = find(/^### 2\.19 /);
const i21 = find(/^### 2\.21 /);
if (!(i20 > 0 && i19 > i20 && i21 > i19)) { console.log('pola tidak cocok: 2.20=' + i20 + ' 2.19=' + i19 + ' 2.21=' + i21 + ' — tidak ada yang diubah'); process.exit(0); }
const b20 = lines.slice(i20, i19);
const b19 = lines.slice(i19, i21);
writeFileSync(P, lines.slice(0, i20).concat(b19, b20, lines.slice(i21)).join(NL), 'utf8');
console.log('§2.19 dituker ke depan §2.20 (blok ' + b19.length + ' dan ' + b20.length + ' baris)');
console.log('urutan kini: ' + readFileSync(P, 'utf8').split(NL).filter((l) => /^### 2\.\d+/.test(l)).map((l) => l.match(/2\.\d+/)[0]).join(' → '));
