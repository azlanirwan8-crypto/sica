import fs from 'node:fs';

const themePath = 'apps/web/src/styles/velzon-theme.css';
const globalsPath = 'apps/web/src/app/globals.css';

const theme = fs.readFileSync(themePath, 'utf8');
const globals = fs.readFileSync(globalsPath, 'utf8').split('\n');

const cleaned = globals.filter((l) => !l.includes('@import') || !l.includes('velzon-theme'));

const head = cleaned.slice(0, 3);
const tail = cleaned.slice(3);

const banner = [
  '',
  '/* ============================================================================',
  '   DESIGN SYSTEM VELZON - token, lima tema, primitif kelas.',
  '',
  '   Bagian ini dulu tinggal di src/styles/velzon-theme.css dan di-import dari sini.',
  '   Digabung 2026-10-19 karena pipeline CSS Next.js memproses tiap berkas CSS',
  '   sebagai modul berdiri sendiri: postcss.config.mjs tidak memuat plugin',
  '   postcss-import, sehingga layer base/components di berkas yang di-import',
  '   tidak pernah melihat direktif tailwind base pasangannya dan build gagal',
  '   dengan pesan "at-layer base is used but no matching tailwind base directive".',
  '   Tailwind CLI - yang saya pakai sebagai pemeriksa awal - men-inline import',
  '   sendiri, sehingga cacat ini lolos dari alat verifikasi. Pelajarannya dicatat',
  '   di PROGRESS_REPORT 5.33: alat verifikasi wajib memakai pipeline yang sama',
  '   dengan produksi, bukan yang paling mudah dijalankan.',
  '   ========================================================================== */',
  '',
];

const out = [...head, ...banner, ...theme.split('\n'), '', ...tail].join('\n');
fs.writeFileSync(globalsPath, out, 'utf8');

console.log('globals lama = ' + globals.length + ' baris');
console.log('globals baru = ' + out.split('\n').length + ' baris');
console.log('sisa import tema = ' + (out.includes('velzon-theme.css') ? 'ADA' : 'TIDAK'));
console.log('@layer base = ' + (out.match(/^@layer base \{/gm) || []).length);
console.log('@layer components = ' + (out.match(/^@layer components \{/gm) || []).length);
console.log('@tailwind = ' + (out.match(/^@tailwind /gm) || []).length);
