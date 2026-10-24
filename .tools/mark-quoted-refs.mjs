import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const MARK = ' <!-- ref-audit-quoted: baris ini mendaftarkan rujukan yang sudah mati sebagai temuan, bukan memakainya -->';
for (const p of ['C:/SICA/docs/AUDIT_READINESS.md', 'C:/SICA/docs/PROGRESS_REPORT.md']) {
  const lines = readFileSync(p, 'utf8').split(NL);
  let n = 0;
  const out = lines.map((l) => {
    if ((l.includes('AGENTS §2.0') || l.includes('BLUEPRINT §4.11')) && !l.includes('ref-audit-quoted')) { n++; return l + MARK; }
    return l;
  });
  writeFileSync(p, out.join(NL), 'utf8');
  console.log(p.split('/').pop() + ': ' + n + ' baris ditandai');
}
