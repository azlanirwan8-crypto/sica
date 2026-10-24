import { readFileSync, writeFileSync } from 'node:fs';

const p = 'C:/SICA/docs/API_SPEC.md';
let s = readFileSync(p, 'utf8');
const rep = [];
const job = (n, a, b) => {
  const i = s.indexOf(a);
  if (i === -1) { rep.push(n + ': MISS'); return; }
  if (s.lastIndexOf(a) !== i) { rep.push(n + ': AMBIG'); return; }
  s = s.slice(0, i) + b + s.slice(i + a.length);
  rep.push(n + ': OK');
};

job('spec-110',
  'register itu kini berhenti di **145** (terukur) dan tidak memuat keduanya (lihat §4.16.6, §4.17.5)',
  'register itu telah memuat baris **146–161** sejak 2026-10-20 (`settings.param.*` = 146–157, `platform.menu.*` = 158–161), tetapi statusnya tetap **`usulan`** dan **nol** di `PERMISSION_SPECS` (lihat §4.16.6, §4.17.5)');

job('spec-253',
  '(register itu kini berhenti di **145**, terukur dengan `grep -cE` yang sama)',
  '(register itu kini mencapai **161**; baris 127–145 gugus ini, 146–161 milik §4.16/§4.17 — terukur dengan `grep -cE` yang sama)');

job('spec-2364',
  '`RBAC_MATRIX §4.5` kini berhenti di **145** dan baris **127–145** adalah',
  '`RBAC_MATRIX §4.5` kini mencapai **161** dan baris **127–145** gugus ini adalah');

job('spec-3566',
  '(register `RBAC_MATRIX §4.5` kini berhenti di **145** dan memuat baris 127–145 untuk gugus ini',
  '(register `RBAC_MATRIX §4.5` kini mencapai **161** dan memuat baris 127–145 untuk gugus ini');

job('spec-3636',
  '**146 ke atas** di `RBAC_MATRIX §4.5` (register itu hari ini berhenti di **145**; `authz.ts` tetap **222** kode, terukur).',
  '**146–161** di `RBAC_MATRIX §4.5` (barisnya sudah dipublikasikan 2026-10-20 dengan status `usulan`; `authz.ts` tetap **222** kode, terukur — jadi belum ada yang dipromosikan).');

job('spec-2995',
  '**Usulan titik aksi (nomor lanjutan milik `RBAC_MATRIX §4.5`, yang hari ini berhenti di 145; `grep` di `authz.ts` atas semua nama di bawah ini = 0 hasil, terukur):**',
  '**Usulan titik aksi.** Ralat 2026-10-20: tabel ini pertama ditulis ketika register `RBAC_MATRIX §4.5` berhenti di 145; sejak siklus yang sama register itu **memublikasikan baris 146–161** untuk persis nama-nama di bawah, sehingga angka "usulan # 146+" di kolom pertama sudah punya alamat kanonik. Yang **tidak** berubah: statusnya tetap **`usulan`** dan `grep` di `authz.ts` atas semua nama di bawah ini = **0 hasil** (terukur). Promosi ke `PERMISSION_SPECS` tetap wajib lewat §4.5, bukan lewat file ini.');

job('spec-3148',
  '(penomoran milik `RBAC_MATRIX §4.5`, yang hari ini berhenti di 145)',
  '(penomoran milik `RBAC_MATRIX §4.5` baris **158–161**, terbit 2026-10-20 dengan status `usulan`)');

writeFileSync(p, s, 'utf8');
console.log(rep.join('\n'));
