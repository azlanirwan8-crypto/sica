import fs from 'node:fs';

const files = process.argv.slice(2);
const countPipes = (row) => {
  let n = 0;
  for (let i = 0; i < row.length; i++) {
    if (row[i] === '|' && (i === 0 || row[i - 1] !== '\\')) n++;
  }
  return n;
};

let bad = 0;
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  let block = [];
  let start = 0;
  let inFence = false;
  let fences = 0;
  const flush = () => {
    if (block.length > 1) {
      const counts = [...new Set(block.map(countPipes))];
      if (counts.length > 1) {
        console.log(`MISMATCH ${f}:${start} kolom=${counts.join('/')} | ${block.map((r, i) => `${i + 1}:${countPipes(r)}`).join(' ')}`);
        console.log(`   ${block[0].slice(0, 110)}`);
        bad++;
      }
    }
    block = [];
  };
  lines.forEach((l, i) => {
    if (l.trimStart().startsWith('```')) { fences++; inFence = !inFence; flush(); return; }
    if (inFence) return;
    if (l.trim().startsWith('|')) {
      if (block.length === 0) start = i + 1;
      block.push(l);
    } else flush();
  });
  flush();
  const cjkRe = new RegExp('[\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF]', 'g');
  const cjk = (fs.readFileSync(f, 'utf8').match(cjkRe) || []).length;
  console.log(`${f.padEnd(38)} baris=${lines.length} fence=${fences}${fences % 2 ? ' GANJIL!' : ''} cjk=${cjk}`);
}
console.log(bad === 0 ? 'TABEL KONSISTEN' : `${bad} blok tabel bermasalah`);
