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

job('API_SPEC.md', 'katalog-24-a', '(mesin parameter + katalog 24 kunci)', '(mesin parameter + katalog 25 baris — 24 permintaan pemilik + satu kunci hasil vonis TTL)');
job('API_SPEC.md', 'katalog-24-b', 'nomor migrasi, katalog 24 parameter, kosakata modus', 'nomor migrasi, katalog 25 baris parameter, kosakata modus');
job('DATA_MODEL.md', 'katalog-24-c', '| 24 parameter katalog §21.3 |', '| 25 baris katalog §21.3 |');
job('PRD.md', 'katalog-24-d', 'riwayat hanya-tambah, katalog 24 parameter, kosakata modus', 'riwayat hanya-tambah, katalog 25 baris parameter, kosakata modus');
job('ROADMAP_TASKS.md', 'katalog-24-e', 'katalog 24 parameter + garis lima rumah konfigurasi', 'katalog 25 baris parameter + garis lima rumah konfigurasi');
job('ROADMAP_TASKS.md', 'katalog-24-f', '`SPE-1`…`SPE-2` (`0049` + katalog 24)', '`SPE-1`…`SPE-2` (`0049` + katalog 25)');
job('ROADMAP_TASKS.md', 'katalog-24-g', 'SPE-2 — Seed katalog 24 parameter + enam penolakan key-value', 'SPE-2 — Seed katalog 25 baris parameter + enam penolakan key-value');
job('UI_UX_DESIGN.md', 'katalog-24-h', 'riwayat insert-only, katalog 24 parameter, kosakata', 'riwayat insert-only, katalog 25 baris parameter, kosakata');

job('API_SPEC.md', 'spec-414-rantai',
  '→ izin di `RBAC_MATRIX §4.5` (**belum**) → path + kode error di sini (**selesai 2026-10-20**) → pola layar + Dynamic Form Generator di `UI_UX_DESIGN §13` (**bagian itu belum ada**) → task di',
  '→ izin di `RBAC_MATRIX §4.5` (**selesai 2026-10-20**: baris 127–145, status `usulan`) → path + kode error di sini (**selesai 2026-10-20**) → pola layar + Dynamic Form Generator di `UI_UX_DESIGN §13` (**selesai 2026-10-20**) → task di');

console.log(rep.join(NL));
