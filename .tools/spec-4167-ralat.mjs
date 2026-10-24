import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const rep = [];
const job = (file, label, a, b) => {
  const p = D + file;
  let s = readFileSync(p, 'utf8');
  const i = s.indexOf(a);
  if (i === -1) { rep.push(label + ': MISS'); return; }
  if (s.lastIndexOf(a) !== i) { rep.push(label + ': AMBIG'); return; }
  s = s.slice(0, i) + b + s.slice(i + a.length);
  writeFileSync(p, s, 'utf8');
  rep.push(label + ': OK');
};

const EDITS = [
  ['API_SPEC.md', 'spec-item3-25',
    '3. **Katalog `DATA_MODEL §21.3` punya 24 permintaan dan enam di antaranya ditolak menjadi key-value**',
    '3. **Katalog `DATA_MODEL §21.3` punya 25 baris (terukur `grep` baris bernomor) dan enam di antaranya ditolak menjadi key-value**'],
  ['API_SPEC.md', 'spec-item4-status',
    '→ izin di `RBAC_MATRIX §4.5` (**belum**) → path + kode error di sini (**selesai 2026-10-20**) → pola layar di `UI_UX_DESIGN §14` (**belum**) → task di `ROADMAP_TASKS` (usulan ADM-1 / R-2) → **baru** kode.',
    '→ izin di `RBAC_MATRIX §4.5` (**selesai 2026-10-20**: baris 146–161 terbit dengan status `usulan`) → path + kode error di sini (**selesai 2026-10-20**) → pola layar di `UI_UX_DESIGN` §14/§15/§16 (**selesai 2026-10-20**) → task di `ROADMAP_TASKS` §2.17 (`SPE-*`) → **baru** kode. Yang **belum** dari rantai ini tinggal satu mata: promosi 146–161 ke `PERMISSION_SPECS` (`SPE-3`) — dan itu memang bukan pekerjaan dokumen.'],
  ['ROADMAP_TASKS.md', 'rm-849-usulan',
    '146–157 (**usulan**; 7 kode API_SPEC §4.16.7 **belum punya baris**)',
    '146–157 (**terbit 2026-10-20, status `usulan`**; API_SPEC §4.16.7 juga mengusulkan `approve`/`register`/`history.view`/`impact.view`/`pattern.manage` yang **belum punya baris** → `SPE-3` harus membawa keduanya, bukan hanya yang 12 baris)'],
];

for (const [f, label, a, b] of EDITS) job(f, label, a, b);

const A = '| `UPDATE` | kelas `REGULATORY`/`SECURITY` **tidak** punya edit langsung';
const B = '| `UPDATE` | verba untuk `REGULATORY`/`SECURITY` memang ada (baris RBAC 155/157, dengan `CHECK approved_by <> requested_by`), tetapi nilai itu **berlaku** hanya setelah `approve` di baris berikutnya — lulus `UPDATE` tanpa pengesahan tidak mengubah apa pun';
job('API_SPEC.md', 'spec-table-edit-rows', A, B);

console.log(rep.join(NL));
