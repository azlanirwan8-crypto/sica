import { readFileSync, writeFileSync } from 'node:fs';

const file = 'C:/SICA/docs/ARCHITECTURE.md';
const before = readFileSync(file, 'utf8');
let s = before;

const jobs = [
  { name: 'cjk-1117', re: 'kolom yang[^\x00-\x7F]+ Feeder', to: 'kolom yang ditujukan ke Feeder' },
  { name: 'cjk-delta', re: '=[^\\x00-\\x7F]{1,10}: simpan', to: '= setelah berhasil: simpan' },
  { name: 'cyrillic', re: 'menghentikan tebak-b\\S*', to: 'menghentikan tebak-buta' },
  { name: 'airmen', re: 'airmen', to: 'watermark' },
  { name: 'ambu', re: 'tanpa panjang ambu secara kriptografis', to: 'tanpa panjang bersifat ambigu secara kriptografis' },
  { name: 'luh', re: '\\(luh puncak\\)', to: '(di luar puncak)' },
  { name: 'beler', re: 'beler \\*worker\\* solver', to: 'perlu \\*worker\\* solver' },
  { name: 'berkeras', re: 'kecuali yang berkeras', to: 'kecuali yang memang gerbang keras' },
  { name: 'hukumdist', re: 'hukum distributif', to: 'sifat distributif' },
  { name: 'rantaiglobal', re: 'satu rantai global membuat laju tulis nilai menjadi serial', to: 'satu rantai global memaksa seluruh tulis nilai serial' },
];

const report = [];
for (const j of jobs) {
  const rx = new RegExp(j.re, 'g');
  const hits = s.match(rx);
  const n = hits ? hits.length : 0;
  if (n > 0) s = s.replace(rx, j.to);
  report.push(`${j.name}: ${n}`);
}

writeFileSync(file, s, 'utf8');
console.log(report.join('\n'));

const lines = readFileSync(file, 'utf8').split('\n');
const bad = [];
lines.forEach((line, i) => {
  for (let c = 0; c < line.length; c += 1) {
    const code = line.codePointAt(c);
    const hit =
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0x0e00 && code <= 0x0e7f) ||
      (code >= 0x0400 && code <= 0x04ff);
    if (hit) {
      bad.push(`${i + 1} U+${code.toString(16).toUpperCase()} :: ${line.slice(Math.max(0, c - 45), c + 45)}`);
      break;
    }
  }
});
console.log('--- sisa non-Latin:', bad.length);
bad.forEach((b) => console.log(b));
