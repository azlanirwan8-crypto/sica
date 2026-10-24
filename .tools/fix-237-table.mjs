import { readFileSync, writeFileSync } from 'node:fs';
const f = '.tools/frag-sec23b.md';
const lines = readFileSync(f, 'utf8').split('\n');
let n = 0;
const out = lines.map((l) => {
  if (/^`(00|7)[0-9]{2}` \| .* \| .* \| .*$/m.test(l.trim()) && !l.startsWith('|')) {
    n++;
    return '| ' + l.trim() + ' |';
  }
  return l;
});
writeFileSync(f, out.join('\n'), 'utf8');
console.log(`baris register dipayungi pipe: ${n}`);
