// splice-frag.mjs — sisipkan satu fragmen markdown tepat sebelum heading anchor (berbasis asersi).
// Pemakaian: node .tools/splice-frag.mjs <file> <anchorRegex> <fragmen>
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const [fail, reSrc, fragPath] = process.argv.slice(2);
if (!fail || !reSrc || !fragPath) { console.error('ASERSI GAGAL — pemakaian: splice-frag.mjs <file> <anchorRegex> <fragmen>'); process.exit(1); }
const RE = new RegExp(reSrc);
const L = readFileSync(fail, 'utf8').split(NL);
const frag = readFileSync(fragPath, 'utf8').replace(/\r\n/g, NL).split(NL);
const hits = L.map((l, i) => (RE.test(l) ? i : -1)).filter((i) => i >= 0);
if (hits.length !== 1) { console.error('ASERSI GAGAL — anchor harus tepat satu, dapat ' + hits.length + ' di ' + fail); process.exit(1); }
const j = hits[0];
writeFileSync(fail, [...L.slice(0, j), ...frag, ...L.slice(j)].join(NL), 'utf8');
console.log(frag.length + ' baris disisipkan sebelum baris ' + (j + 1) + ' di ' + fail);
