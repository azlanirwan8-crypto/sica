import { readFileSync, readdirSync } from 'node:fs';

/*
 * pemisah "kutipan" vs "placeholder spesifikasi".
 * Sebuah token dianggap KUTIPAN bila ia (a) berada di dalam blok berpagar, atau
 * (b) berada di dalam span backtick pada barisnya — artinya dokumen sedang
 * menunjuk teks orang lain (marker `TODO` di kode, `code='XXXL'` di kamus),
 * bukan meninggalkan lubang spesifikasi. Placeholder spesifikasi = token telanjang.
 */
const D = 'C:/SICA/docs/';
const toks = ['TODO', 'TBD', 'FIXME', 'XXX'];
const targets = [['AGENTS.md', 'C:/SICA/AGENTS.md']]
  .concat(readdirSync(D).filter((f) => f.endsWith('.md')).map((f) => [f, D + f]));

const spans = (line) => {
  const out = [];
  let open = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== '`') continue;
    if (open === -1) open = i;
    else { out.push([open, i]); open = -1; }
  }
  return out;
};

const offenders = [];
const rows = [];
for (const t of toks) {
  let quoted = 0, bare = 0, perFile = [];
  for (const [label, p] of targets) {
    const lines = readFileSync(p, 'utf8').split(String.fromCharCode(10));
    let fence = false, n = 0;
    lines.forEach((line, idx) => {
      if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return; }
      const re = new RegExp('\\b' + t + '\\b', 'g');
      let m;
      while ((m = re.exec(line))) {
        const inCode = fence || spans(line).some(([a, b]) => m.index > a && m.index < b);
        if (inCode) quoted++;
        else { bare++; n++; offenders.push(label + ':' + (idx + 1) + ' ' + t + ' :: ' + line.trim().slice(0, 90)); }
      }
    });
    if (n) perFile.push(label.replace('.md', '') + '=' + n);
  }
  rows.push(t.padEnd(5) + ' kutipan=' + String(quoted).padStart(3) + ' spesifikasi=' + String(bare).padStart(2) +
    (perFile.length ? ' :: ' + perFile.join(' ') : ''));
}
console.log(rows.join(String.fromCharCode(10)));
console.log(offenders.length
  ? 'LUBANG SPESIFIKASI = ' + offenders.length + String.fromCharCode(10) + offenders.join(String.fromCharCode(10))
  : 'placeholder-count: HIJAU — nol token telanjang; seluruh kemunculan adalah kutipan dalam kode inline/blok berpagar');
