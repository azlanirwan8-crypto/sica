import fs from 'node:fs';

const file = 'apps/web/src/modules/auth/components/login-form.tsx';
const bs = String.fromCharCode(92);
const lines = fs.readFileSync(file, 'utf8').split('\n');
const idx = lines.findIndex((l) => l.includes('p{Cc}') && l.includes('.test(value))'));
if (idx < 0) {
  console.log('tidak ditemukan');
  process.exit(1);
}
lines[idx] =
  '  if (value.includes(' + "'" + bs + bs + "'" + ') || /[' + bs + 's' + bs + 'p{Cc}]/u.test(value)) return DEFAULT_DESTINATION;';
console.log('[' + (idx + 1) + ']: ' + lines[idx]);
fs.writeFileSync(file, lines.join('\n'), 'utf8');
