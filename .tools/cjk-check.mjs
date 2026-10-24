import { readFileSync } from 'node:fs';

if (process.argv.length <= 2) {
  console.log('MERAH — tidak ada berkas yang diberikan. Tanpa berkas, alat ini memindai KOSONG dan tidak berhak mencetak "0".');
  console.log('Pemakaian: node .tools/cjk-check.mjs docs/AUDIT_READINESS.md .tools/nama.mjs   (atau lewat `node .tools/gate-run.mjs`)');
  process.exit(2);
}

const SUSPECT = (c) =>
  (c >= 0x3000 && c <= 0x303f) ||
  (c >= 0x4e00 && c <= 0x9fff) ||
  (c >= 0xff00 && c <= 0xff60) ||
  (c >= 0x0400 && c <= 0x04ff) ||
  (c >= 0x0e00 && c <= 0x0e7f);

let total = 0;
for (const f of process.argv.slice(2)) {
  const s = readFileSync(f, 'utf8');
  const lines = s.split(String.fromCharCode(10));
  const hits = [];
  lines.forEach((l, i) => {
    if (l.includes('nonlatin-sampled')) return;
    for (const ch of l) {
      const c = ch.codePointAt(0);
      if (c > 127 && SUSPECT(c)) {
        hits.push(`  ${i + 1}: U+${c.toString(16)} ${JSON.stringify(ch)} :: ${l.slice(Math.max(0, l.indexOf(ch) - 40), l.indexOf(ch) + 40)}`);
        break;
      }
    }
  });
  if (hits.length) {
    console.log(`${f}: ${hits.length} SUSPECT baris`);
    console.log(hits.slice(0, 12).join(String.fromCharCode(10)));
    total += hits.length;
  }
}
console.log(total === 0 ? 'CJK/CYRILLIC/THAI = 0' : `TOTAL SUSPECT = ${total}`);
process.exit(total ? 1 : 0);
