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

job('INTEGRATIONS.md', 'int-alg18',
  '(nomor engine/section yang **ditagihkan** DATA_MODEL §21.3 nomor 21 ke ARCHITECTURE §12.17 — bagian itu **belum ditulis**, jadi baris ini adalah kontrak yang menunggu pemiliknya)',
  '(nomor engine/section yang **ditagihkan** DATA_MODEL §21.3 nomor 21 ke ARCHITECTURE §12.17 — **tertulis 2026-10-20**, jadi pemiliknya sudah ada; yang masih kurang adalah berkasnya: `0021`/`nim_assignments` belum berwujud dan `reference_kind_usage` belum menandai kunci pola NIM)');

job('DATA_MODEL.md', 'dm-219-ui',
  '| `master_system_parameters` + riwayat | `0049` | belum ada | `0007` (kamus) + layar Admin UI_UX §14 |',
  '| `master_system_parameters` + riwayat | `0049` | belum ada | `0007` (kamus) + nol konsumen di kode; **pola layarnya sudah ditulis** (`UI_UX §14`, 2026-10-20) sehingga penahan riilnya adalah DDL + `SPE-3`, bukan desain |');

job('DATA_MODEL.md', 'dm-219-paramperm',
  '| `parameter_permissions` | `0050` | belum ada | keputusan RBAC_MATRIX atas kode `settings.param.*` (usulan) |',
  '| `parameter_permissions` | `0050` | belum ada | keputusan RBAC_MATRIX **sudah diambil** (baris 146–157 terbit 2026-10-20 dengan status `usulan`); yang menahan adalah promosi ke `PERMISSION_SPECS` + `gen-rbac-seed.mjs` (`SPE-3`), bukan keputusannya |');

console.log(rep.join(NL));
