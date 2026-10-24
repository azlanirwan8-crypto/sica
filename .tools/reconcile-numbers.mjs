import { readFileSync, writeFileSync } from 'node:fs';

const sub = (file, pairs) => {
  let t = readFileSync(file, 'utf8');
  for (const [a, b] of pairs) {
    if (!t.includes(a)) { console.error('ANCHOR hilang di ' + file + ': ' + a.slice(0, 54)); continue; }
    t = t.replace(a, b);
  }
  writeFileSync(file, t, 'utf8');
  console.log('diperbarui: ' + file);
};

sub('docs/API_SPEC.md', [
  ['Hasil siklus ini: **364** kandidat kode, **84** sudah punya baris katalog, **25** dikenal tetapi belum ber-nomor, **5** tertulis sebagai bentuk singkat dua segmen, dan **250** **belum pernah dinamai di mana pun**.',
   'Hasil pengukuran terbaru (2026-10-21 setelah §7.33 terbit): **371** kandidat kode, **84** punya baris katalog, **25** dikenal tetapi belum ber-nomor, **5** bentuk singkat dua segmen, dan **257** belum pernah dinamai di mana pun. Angka ini **naik** dari 250 justru karena gugus GIS/jaminan sosial/EWMP menambah sepuluh nama usulan yang jujur ditandai sebagai usulan — dan yang memutuskannya adalah alat, bukan kalimat di bab ini.'],
  ['| kode izin dikutip API_SPEC tetapi **tidak pernah** dinamai RBAC/authz (terukur `node .tools/perm-phantom.mjs`) | 250 kode |',
   '| kode izin dikutip API_SPEC tetapi **tidak pernah** dinamai RBAC/authz (terukur `node .tools/perm-phantom.mjs`; 250 sebelum §7.33, **257** sesudahnya) | 257 kode |'],
  ['Cara ukur: cacah baris tabel yang sel pertamanya diawali nama metode (`GET`, `POST`, `PATCH`, `PUT`, `DELETE`, `WS`) di dalam tiap sub-bagian §7.1–§7.21.',
   'Cara ukur yang berlaku: `node .tools/route-count.mjs` (pemindaian seluruh isi `## 7`, batas bawah ditentukan **judul** bagian, bukan posisi blok — lihat `RD-86`). Keluaran terbaru: **318** baris tabel · 133 `spec-only` · 185 `blocker` · **0** implemented · 29 gugus. Uraian lama di bawah ini dibiarkan terbaca sebagai riwayat metode, dan angkanya tidak lagi jadi rujukan.'],
]);

sub('docs/ROADMAP_TASKS.md', [
  ['*Cara ukur:* `node .tools/perm-phantom.mjs` (keluaran siklus ini: 364 kandidat · 84 ber-baris · 25 dikenal-tanpa-nomor · 5 singkat · **250 tanpa nama**) harus mencetak `HANTU = 0`;',
   '*Cara ukur:* `node .tools/perm-phantom.mjs` (terbaru: 371 kandidat · 84 ber-baris · 25 dikenal-tanpa-nomor · 5 singkat · **257 tanpa nama**; naik dari 250 karena sepuluh nama usulan §4.5.4/§7.33 sengaja ditandai, bukan diberi nomor) harus mencetak `HANTU = 0`;'],
]);
