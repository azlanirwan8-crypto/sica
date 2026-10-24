import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const P = 'C:/SICA/docs/ENV_CONTRACT.md';
const src = readFileSync(P, 'utf8');
const lines = src.split(NL);

/* blok = heading `## ` sampai tepat sebelum heading `## ` berikutnya */
const heads = lines.map((l, i) => (/^## /.test(l) ? i : -1)).filter((i) => i !== -1);
const blockOf = (startIdx) => {
  const next = heads.find((h) => h > startIdx);
  return { from: startIdx, to: next === undefined ? lines.length : next };
};

const isNote = (l) => /^## 5\. Catatan penomoran/.test(l);
const isCred = (l) => /^## 7\. Kredensial kanal vicon/.test(l);

const noteIdx = lines.map((l, i) => (isNote(l) ? i : -1)).filter((i) => i >= 0);
const credIdx = lines.map((l, i) => (isCred(l) ? i : -1)).filter((i) => i >= 0);
if (noteIdx.length < 2 && credIdx.length < 2) { console.log('tidak ada duplikasi (note=' + noteIdx.length + ' cred=' + credIdx.length + ') — tidak ada yang diubah'); process.exit(0); }

/* potong semua blok duplikat, sisakan satu salinan tiap jenis; lalu tempel ulang
   bagian §7 di ujung berkas supaya urutan jadi 4 → 5 (catatan) → 6 → 7 */
const drop = [];
for (const i of noteIdx.slice(1)) { const b = blockOf(i); drop.push(b); }
for (const i of credIdx.slice(1)) { const b = blockOf(i); drop.push(b); }
const keepCred = blockOf(credIdx[0]);
drop.push(keepCred);

const keep = lines.map((_, i) => !drop.some((b) => i >= b.from && i < b.to));
const rest = lines.filter((_, i) => keep[i]);
const credBlock = lines.slice(keepCred.from, keepCred.to);

const trimmed = rest.join(NL).replace(/\s+$/, '') + NL + NL + credBlock.join(NL).replace(/\s+$/, '') + NL;
writeFileSync(P, trimmed, 'utf8');
console.log('duplikat dihapus: note ' + noteIdx.length + '→1, cred ' + credIdx.length + '→1 (dipindah ke ujung)');
const after = readFileSync(P, 'utf8').split(NL);
console.log('urutan heading: ' + after.filter((l) => /^## /.test(l)).map((l) => l.replace(/^## /, '').split('.')[0]).join(' → '));
