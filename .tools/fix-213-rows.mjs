import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const f = 'docs/DATA_MODEL.md';
const lines = readFileSync(f, 'utf8').split(NL);

// 1. buang blok yatim baris 26-28 yang terseset sesudah catatan "Ralat penomoran" (duplikasi dari siklus lalu)
const orphan = lines.findIndex((l, i) => i > 5220 && /^\| 26 \| Pilihan kanal vicon \+ rantai fallback \|/.test(l));
if (orphan < 0) { console.error('blok yatim tidak ditemukan'); }
else { lines.splice(orphan, 3); console.log('blok yatim 26-28 dihapus dari §21.3'); }

// 2. sisip empat baris analytics.* sesudah baris 29
const i29 = lines.findIndex((l) => /^\| 29 \| Ambang tonton modul asinkron \|/.test(l));
if (i29 < 0) console.error('baris 29 tidak ditemukan');
else {
  const added = [
    '| 30 | Peta sebaran sesi boleh dibuka | `master_system_parameters` | `analytics.map.enabled` = `false` (`BOOL`) | mati secara baku; menyala hanya bila `GEOIP_DB_PATH` tersedia (`ENV_CONTRACT §8`); keadaan mati = widget menampilkan sebab, bukan peta kosong | `OPS` |',
    '| 31 | Jendela sesi dianggap aktif | `master_system_parameters`; store Redis `session:active:{tenant}` | `analytics.session.active_window_s` = `300` (`SEC`) | 60–900; di luar rentang ditolak transport **dan** `CHECK` DB (uji dua lapis, pola `AC-PG-4`) | `OPS` |',
    '| 32 | Retensi gejala sesi (geografi) | `master_system_parameters` + kolom `session_geo_facts.retention_days` (`0078`) | `analytics.map.ip_retention_days` = `90` (`DAY`) | 7–730; **di bawah 7 hari ditolak CHECK DB** karena menghapus bukti, bukan mengubah preferensi | `REGULATORY` — dua penyetuju + MFA |',
    '| 33 | Urutan sumber geolokasi saat dua-duanya ada | `master_system_parameters` | `analytics.map.geo_source_priority` = `["CLIENT_GEO","GEOIP_DB","SITE_GEO"]` (`JSON`) | harus permutasi tiga nilai itu tanpa duplikat; label sumber **tetap tampil** di UI apa pun urutannya (`ARCHITECTURE §13.8` vonis 8) | `OPS` |',
  ];
  lines.splice(i29 + 1, 0, ...added);
  console.log('baris 30-33 ditambahkan ke katalog §21.3');
}
let t = lines.join(NL);
t = t.replace('Katalog sekarang **29 baris**;', 'Katalog sekarang **33 baris** (baris 30–33 terbit 2026-10-21 bersama gugus peta sesi, `§24`);');
t = t.replace('Enam dari 29 butir di atas', 'Enam dari 33 butir di atas');
writeFileSync(f, t, 'utf8');
console.log('catatan jumlah katalog diselaraskan');
