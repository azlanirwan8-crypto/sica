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

job('PRD.md', 'rekap-48',
  '**Rekap dihitung dari tabel di atas (bukan ditulis tangan):** baris modul = `48` · `PENUH` = 11 · `SEBAGIAN` = 21 · `NOL` = 16. Kode entitlement usulan yang tersisa di kolom ketiga = **18**',
  '**Rekap dihitung ulang dari tabel di atas (skrip, bukan tangan):** baris modul = `48` · `PENUH` = 11 · `SEBAGIAN` = 23 · `NOL` = 14. Kode entitlement usulan yang tersisa di kolom ketiga = **17**');

job('PRD.md', 'usulan-daftar',
  '(`hris`, `sister`, `scholarship`, `publication`, `student_affairs`, `fieldwork`, `career`, `mobility`, `ppks`, `library`, `asset`, `clinic`, `residence`, `event`, `research`, `crm`, `procurement`, `endowment`)',
  '(`asset`, `clinic`, `crm`, `endowment`, `event`, `fieldwork`, `hris`, `library`, `mobility`, `procurement`, `publication`, `ppks`, `research`, `residence`, `scholarship`, `student_affairs`) — `sister` **ditarik**, lihat §5.12.4');

job('PRD.md', 'intro-usulan', '+18 usulan registri di bawah', '+17 usulan registri di bawah');

job('PRD.md', 'tolak-row',
  '| Modul bisnis sebagai tempat penyimpanan parameter |',
  [
    '| `sister` sebagai SKU untuk M-08 | **Ditarik 2026-10-20 setelah diukur** | Katalog entitlement yang **sudah diterapkan** melabeli `hr_bkd` sebagai `SDM / BKD / SISTER` (`packages/database/migrations/0004_entitlement_modules.sql:90`, terukur `grep`). Membuat `sister` menjadi modul baru berarti satu fakta kepegawaian dijual dua kali dan `moduleOf(permission)` kehilangan satu rumah. Lih§5.12.4 |',
    '| Modul bisnis sebagai tempat penyimpanan parameter |',
  ].join(NL));

const sec5124 = [
  '#### 5.12.4 Tabrakan yang ditemukan setelah registri ditulis (dan cara saya memutusnya)',
  '',
  'Registri §5.12.1 pertama kali ditulis dari pemetaan peran-ke-modul, **sebelum** saya membaca baris katalog yang benar-benar sudah diterapkan. Hasilnya satu usulan saya salah, dan itu saya betulkan di tempat, bukan dibuang diam-diam:',
  '',
  '- **Terukur:** `grep -n "hr_bkd" packages/database/migrations/0004_entitlement_modules.sql` → `(\x27...160\x27, \x27hr_bkd\x27, \x27SDM / BKD / SISTER\x27, \x27ADDON\x27, ...)`. Jadi **M-06 (HRIS), M-07 (BKD), dan M-08 (SISTER) hari ini berada di satu gerbang jual yang sama**, dan labelnya sudah menyebut SISTER secara eksplisit.',
  '- **Vonis.** (1) `sister` **dicabut** dari daftar usulan — M-08 tetap di bawah `hr_bkd` sebagai transport; menjual sinkronisasi sebagai SKU terpisah tidak memenuhi kriteria 1 §5.12 dan akan membuat `tenant_modules` punya dua baris untuk satu keputusan pembelian. (2) `hris` **tetap usulan, dengan syarat**: memisahkan HRIS dari `hr_bkd` adalah **migrasi katalog** (label baris `...160` berubah maknanya, `tenant_modules` yang sudah ACTIVE harus dipetakan ulang, dan izin `identity.*`/`hr.*` harus di-repartition di `RBAC_MATRIX §4.5`), bukan sekadar menambah satu elemen enum. Selama migrasi itu belum dinomori `DATA_MODEL` dan belum diputus pemiliknya, **M-06 dilayani oleh `hr_bkd`** dan layar HRIS menyaring dari izin, bukan dari modul baru. (3) Kriteria 3 (rahasia data sendiri) justru **menolak** penggabungan permanen: isi payroll/PPh21 tidak boleh terbaca oleh peran yang hanya memegang BKD — itu ditegakkan lewat hak tingkat field (`FIELD_RULES`/`SERVER_ONLY`), bukan lewat kode entitlement kedua.',
  '- **Pelajaran yang saya catat supaya tidak berulang.** Registri harus dibaca **dari artefak yang diterapkan ke dokumen**, bukan sebaliknya. Ini pola yang sama dengan `RD-05` (path katalog) dan `RD-37` (berkas yang diklaim ada): yang salah bukan idenya, melainkan keberanian menulis angka sebelum mengukur.',
  '',
].join(NL);

job('PRD.md', 'sec-5124', NL + '### 5.13 Audit deduplikasi', NL + sec5124 + '### 5.13 Audit deduplikasi');

job('PRD.md', 'tolak-salah-kata', 'Lih§5.12.4', 'Lihat §5.12.4');

job('AUDIT_READINESS.md', 'rd58',
  'Terhitung dari `PRD §5.12.1` (tally dihitung program, bukan ditulis tangan): `PENUH` 11 · `SEBAGIAN` 21 · `NOL` 16.',
  'Terhitung ulang dari `PRD §5.12.1` (skrip, bukan tangan) pada 2026-10-20: `PENUH` 11 · `SEBAGIAN` 23 · `NOL` 14 dari 48 baris — angka ini bergerak lagi setiap kali satu mata rantai (FR/DDL/rute/layar) terbit, jadi yang mengikat adalah **cara hitungnya**, bukan angkanya.');

job('AUDIT_READINESS.md', 'rd58b',
  'Modul `NOL` belum punya FR, DDL, endpoint, maupun pola layar; sebagian `SEBAGIAN` hanya disebut di dokumen benchmark/glosarium',
  'Modul `NOL` belum punya FR, DDL, endpoint, maupun pola layar; sebagian `SEBAGIAN` hanya disebut di dokumen benchmark/glosarium. **Ditambahkan dari temuan agen PRD:** usulan entitlement `sister` ternyata sudah tercakup di `hr_bkd` pada katalog yang diterapkan (`0004_entitlement_modules.sql:90`), dan `hris` tidak dapat dilepas tanpa migrasi katalog — dua-duanya kini divonis di `PRD §5.12.4`');

console.log(rep.join(NL));
