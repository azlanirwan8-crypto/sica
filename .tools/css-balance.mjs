import fs from 'node:fs';

const file = process.argv[2];
const text = fs.readFileSync(file, 'utf8');

let i = 0;
let line = 1;
let depth = 0;
let inComment = false;
let inString = null;
const stack = [];
let problems = 0;

while (i < text.length) {
  const ch = text[i];
  const next = text[i + 1];
  if (ch === '\n') { line++; i++; continue; }

  if (inComment) {
    if (ch === '*' && next === '/') { inComment = false; i += 2; continue; }
    i++;
    continue;
  }
  if (inString) {
    if (ch === '\\') { i += 2; continue; }
    if (ch === inString) inString = null;
    i++;
    continue;
  }
  if (ch === '/' && next === '*') { inComment = true; i += 2; continue; }
  if (ch === '/' && next === '/') { const nl = text.indexOf('\n', i); i = nl < 0 ? text.length : nl; continue; }
  if (ch === '"' || ch === "'") { inString = ch; i++; continue; }
  if (ch === '{') { depth++; stack.push(line); i++; continue; }
  if (ch === '}') {
    depth--;
    const opened = stack.pop();
    if (depth < 0) { console.log('KURANG kurung kurawal pada baris ' + line + ' (depth ' + depth + ')'); problems++; depth = 0; }
    i++;
    continue;
  }
  i++;
}

if (inComment) console.log('KOMENTAR tidak ditutup — dimulai setelah baris terakhir yang dibuka');
if (depth !== 0) console.log('BALANCE akhir depth=' + depth + ' masih terbuka dari baris ' + stack.join(','));
console.log('selesai. depth=' + depth + ' problems=' + problems + ' totalBaris=' + line);
