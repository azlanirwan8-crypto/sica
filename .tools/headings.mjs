import fs from 'node:fs';

const f = process.argv[2];
const t = fs.readFileSync(f, 'utf8').split('\n');
const only = process.argv[3];
const re = only ? new RegExp('^#{1,6} .*' + only) : /^#{2,4} /;
t.forEach((l, i) => {
  if (re.test(l)) console.log(i + 1 + ': ' + l.trim());
});
console.log('--- lines=' + t.length);
