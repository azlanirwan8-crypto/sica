import fs from 'node:fs';

const file = 'apps/web/src/modules/auth/components/login-form.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');
const bs = String.fromCharCode(92);
const target = '  if (value.includes(' + bs + "'\"" + bs + bs + "'\"" + bs + ') || ';
const idx = lines.findIndex((l) => l.includes('value.includes(') && l.includes('.test(value))'));
if (idx < 0) {
  console.log('BARIS target tidak ditemukan');
  process.exit(1);
}
console.log('lama  [' + (idx + 1) + ']: ' + lines[idx]);
const u = bs + 'u';
const cc = bs + 'p{Cc}';
const sClass = bs + 's';
lines[idx] =
  '  if (value.includes(' + "'"+ bs + bs + "'" + ') || /[' + sClass + cc + ']/' + u + '.test(value)) return DEFAULT_DESTINATION;';
console.log('baru  [' + (idx + 1) + ']: ' + lines[idx]);
fs.writeFileSync(file, lines.join('\n'), 'utf8');
