import fs from 'node:fs';

const cjk = /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0400-\u04FF]/;
const fence = String.fromCharCode(96).repeat(3);

for (const f of process.argv.slice(2)) {
  const text = fs.readFileSync(f, 'utf8');
  const lines = text.split('\n');
  let problems = 0;

  lines.forEach((l, i) => {
    if (cjk.test(l)) {
      problems++;
      console.log('CJK ' + f + ':' + (i + 1) + ' ' + l.slice(0, 70));
    }
  });

  let i = 0;
  let tables = 0;
  while (i < lines.length) {
    if (/^\s*\|/.test(lines[i]) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const headerCols = (lines[i].replace(/\\\|/g, '~').match(/\|/g) || []).length;
      let j = i;
      while (j < lines.length && /^\s*\|/.test(lines[j])) {
        const c = (lines[j].replace(/\\\|/g, '~').match(/\|/g) || []).length;
        if (c !== headerCols) {
          problems++;
          console.log('COL ' + f + ':' + (j + 1) + ' exp=' + headerCols + ' got=' + c + ' :: ' + lines[j].slice(0, 60));
        }
        j++;
      }
      tables++;
      i = j;
    } else {
      i++;
    }
  }

  const fences = (text.split(fence).length - 1);
  if (fences % 2 !== 0) {
    problems++;
    console.log('FENCE-UNBALANCED ' + f + ' count=' + fences);
  }
  console.log(f + ' lines=' + lines.length + ' tables=' + tables + ' fences=' + fences + ' problems=' + problems);
}
