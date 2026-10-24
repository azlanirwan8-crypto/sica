import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const rep = [];
const job = (file, label, a, b) => {
  const p = D + file;
  let s = readFileSync(p, 'utf8');
  const i = s.indexOf(a);
  if (i === -1) { rep.push(file + ' ' + label + ': MISS'); return; }
  if (s.lastIndexOf(a) !== i) { rep.push(file + ' ' + label + ': AMBIG'); return; }
  s = s.slice(0, i) + b + s.slice(i + a.length);
  writeFileSync(p, s, 'utf8');
  rep.push(file + ' ' + label + ': OK');
};

/* 1 — nama berkas migrasi yang salah di ROADMAP (berkas nyata = 0003_people_biodata.sql) */
job('ROADMAP_TASKS.md', 'rm-0003', 'migrations/0003_biodata_feeder.sql', 'migrations/0003_people_biodata.sql (nama `0003_biodata_feeder` tidak pernah ada di `packages/database/migrations/` — terukur 2026-10-20)');

/* 2 — dua nama untuk nomor 0008 */
job('ROADMAP_TASKS.md', 'rm-0008', '**`0008_curriculum_prerequisites`** (prasyarat & ekivalensi — ADM-3)', '**`0008_curriculum_prereq_equivalency`** (satu nama dengan pemilik nomor di `DATA_MODEL §14.7` — dulu ditulis `0008_curriculum_prerequisites`, itu kembaran nama, ADM-3)');

/* 3 — typo yangregistri */
job('DATA_MODEL.md', 'dm-typo', 'menuangkan **21 modul bisnis** yangregistri', 'menuangkan **21 modul bisnis** yang registri');

/* 4 — satu register: §14.7 menunjuk §22.9, tidak membuat indeks kedua */
job('DATA_MODEL.md', 'dm-147-pointer',
  '**Catatan penomoran (diralat 2026-10-19 — `RD-20`):**',
  [
    '**Satu indeks, dua tempat.** Nomor `0051`–`0072` (gugus 47 modul) didaftarkan **rinci** di §22.9 dan **indeks master-nya tetap bagian ini**: §22.9 adalah rincian dari §14.7, bukan register kedua. Aturan pakainya: nomor baru lahir di §14.7 (baris ringkas + rujukan ke subbagian yang memiliki DDL-nya), dan hanya subbagian pemilik objek yang boleh menuliskan `CREATE TABLE`. Ini menutup pola `RD-32` (dua tempat menyatakan hal sama) sebelum gugus 47 modul sempat mengulanginya. Terukur 2026-10-20: `0051`–`0072` = 22 nomor, **nol** di antaranya yang sudah menjadi berkas di `packages/database/migrations/` (7 berkas nyata).',
    '',
    '**Catatan penomoran (diralat 2026-10-19 — `RD-20`):**',
  ].join(NL));

console.log(rep.join(NL));
