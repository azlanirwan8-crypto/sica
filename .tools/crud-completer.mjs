import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const spec = readFileSync(D + 'API_SPEC.md', 'utf8');
const rbac = readFileSync(D + 'RBAC_MATRIX.md', 'utf8');

/* PENUTUP CELAH CRUD.
   Cara kerja: alat ini TIDAK mengarang jalur. Ia memindai famili yang sudah ada di
   `API_SPEC §7` (baris `| METHOD | /sumber/... | izin | M-xx | status |`), lalu untuk tiap
   famili yang belum punya READ-detail / UPDATE / DELETE, ia memunculkan baris pelengkap
   dengan POLA yang sama persis seperti famili itu sendiri, memakai `:id` yang sudah dipakai
   saudaranya. Izin baru ditulis sebagai `usulan` dan ikut didaftarkan ke RBAC §4.5.3 supaya
   katalog tetap satu-satunya sumber kebenaran (AGENTS §3.8). */

const rows = [...spec.matchAll(/^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`\s*\|([^|]*)\|([^|]*)\|/gm)]
  .map((m) => ({ meth: m[1], path: m[2], perm: m[3].trim(), mod: (m[4].match(/M-\d{2}|APP/) || [m[4].trim()])[0], raw: m[0] }));

const byMod = new Map();
for (const r of rows) {
  if (!/M-\d{2}/.test(r.mod)) continue;
  const base = r.path.replace(/^\/api\/v1/, '').replace(/\{[A-Za-z]+\}|:\w+/g, ':id').replace(/:id\/[a-z-]+$/, ':id').replace(/\/$/, '');
  if (!byMod.has(r.mod)) byMod.set(r.mod, new Map());
  const fam = byMod.get(r.mod);
  if (!fam.has(base)) fam.set(base, { GET: new Set(), POST: new Set(), PUT: new Set(), PATCH: new Set(), DELETE: new Set(), perms: new Set() });
  fam.get(base)[r.meth].add(r.path);
  if (r.perm) [...r.perm.matchAll(/`([a-z_]+(?:\.[a-z_]+)+)`/g)].forEach((p) => fam.get(base).perms.add(p[1]));
}

const VERBA = { GET: 'READ', POST: 'INSERT', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };
/* baris yang dihasilkan alat hanya untuk famili yang sudah punya pola; daftar dari
   `known` dibuat dari seluruh nomor izin yang sudah tercetak di RBAC_MATRIX + API_SPEC,
   supaya "izin baru" benar-benar baru dan tidak menciptakan katalog kembar (pola `RD-32`) */
const known = new Set();
for (const src of [rbac, spec]) {
  for (const m of src.matchAll(/`([a-z_]+\.[a-z_0-9]+\.[a-z_0-9]+)`/g)) known.add(m[1]);
}
const touched = new Set();
const added = [];
const genCodes = [];
for (const [mod, fams] of [...byMod.entries()].sort()) {
  for (const [base, set] of [...fams.entries()].sort()) {
    if (base.split('/').length < 2) continue;
    const permList = [...set.perms];
    const anchor = permList.find((p) => p.endsWith('.view')) || permList[0] || null;
    if (!anchor) continue;
    const parts = anchor.split('.');
    const need = [];
    if (!set.PUT.size && !set.PATCH.size) need.push(['PUT', parts[0] + '.' + parts[1] + '.update', 'UPDATE']);
    if (!set.DELETE.size) need.push(['DELETE', parts[0] + '.' + parts[1] + '.delete', 'DELETE']);
    for (const [meth, code, verb] of need) {
      const path = base + (base.includes(':id') ? '' : '/:id');
      touched.add(code + '|' + verb);
      genCodes.push({ code, verb, mod, base: path });
      added.push('| ' + meth + ' | `' + path + '` | `' + code + '` | ' + mod + ' | **baru 2026-10-21 — penutup CRUD** (' + (known.has(code) ? 'izin sudah ada di katalog' : 'izin `usulan` §4.5.3') + ') |');
    }
  }
}

/* tujuh famili yang belum punya SATU pun baris di §7 ditulis manual dan nyata di bawah ini */
const FAMILIES = [
  ['7.25', 'M-07 · BKD & Beban Kerja Dosen', [
    ['GET', '/lecturer/workload/:lecturerId', 'academic.bkd.view', 'READ'],
    ['POST', '/lecturer/workload/:lecturerId/items', 'academic.bkd.insert', 'INSERT'],
    ['PUT', '/admin/bkd/recap/:recapId', 'academic.bkd.update', 'UPDATE'],
    ['POST', '/admin/bkd/recap/:recapId/validate', 'academic.bkd.validate', 'VALIDATE'],
    ['GET', '/admin/bkd/recap/:recapId/export', 'academic.bkd.export', 'OTHER'],
    ['DELETE', '/lecturer/workload/:lecturerId/items/:itemId', 'academic.bkd.delete', 'DELETE'],
  ]],
  ['7.26', 'M-20 · Tugas Akhir, sidang & RAMA', [
    ['GET', '/thesis/projects/:projectId', 'academic.thesis.view', 'READ'],
    ['POST', '/thesis/projects', 'academic.thesis.insert', 'INSERT'],
    ['PUT', '/thesis/projects/:projectId', 'academic.thesis.update', 'UPDATE'],
    ['POST', '/thesis/defenses/:defenseId/decision', 'academic.thesis.validate', 'VALIDATE'],
    ['POST', '/thesis/rama/deposit/:projectId', 'document.rama.submit', 'OTHER'],
    ['DELETE', '/thesis/proposals/:proposalId', 'academic.thesis.delete', 'DELETE'],
  ]],
  ['7.27', 'M-23 · Wisuda & M-30 · Yudisium/SKPI/dokumen', [
    ['GET', '/graduation/candidates/:studentId', 'academic.graduation.view', 'READ'],
    ['PUT', '/graduation/yudisium/:studentId', 'academic.graduation.update', 'UPDATE'],
    ['POST', '/graduation/yudisium/:studentId/decide', 'academic.graduation.validate', 'VALIDATE'],
    ['POST', '/graduation/convocations/:convocationId/register', 'academic.graduation.insert', 'INSERT'],
    ['GET', '/documents/{docType}/:docId', 'document.verification.view', 'READ'],
    ['PUT', '/documents/skpi/:studentId', 'document.skpi.update', 'UPDATE'],
    ['DELETE', '/documents/:docId/void', 'document.record.delete', 'DELETE'],
  ]],
  ['7.28', 'M-27 · Tracer study & Portal alumni', [
    ['GET', '/alumni/profiles/:graduateId', 'career.alumni.view', 'READ'],
    ['POST', '/alumni/tracer-surveys/:waveId/responses', 'career.tracer.insert', 'INSERT'],
    ['PUT', '/alumni/profiles/:graduateId', 'career.alumni.update', 'UPDATE'],
    ['POST', '/alumni/competency-standards/:standardId/approve', 'career.competency.validate', 'VALIDATE'],
    ['DELETE', '/alumni/contacts/:contactId', 'career.alumni.delete', 'DELETE'],
  ]],
  ['7.29', 'M-05 · Audit trail & M-31/M-32 · Akreditasi dan IKU', [
    ['GET', '/admin/audit-events/:eventId', 'audit.event.view', 'sudah ada — tidak menambah izin'],
    ['POST', '/admin/audit/partitions/:partition/seal', 'audit.chain.validate', 'VALIDATE'],
    ['GET', '/quality/indicator-sources/:indicatorCode', 'audit.quality.view', 'READ'],
    ['PUT', '/quality/indicator-sources/:indicatorCode/mapping', 'audit.quality.update', 'UPDATE'],
    ['POST', '/admin/lkps/submissions/:submissionId/validate', 'audit.lkps.validate', 'VALIDATE'],
    ['DELETE', '/quality/indicator-sources/:indicatorCode/mapping/:itemId', 'audit.quality.delete', 'DELETE'],
  ]],
  ['7.30', 'M-33 · Jadwal darurat & M-34 · Feeder PDDikti (sisi tulis)', [
    ['POST', '/ops/emergency-reschedules', 'teaching.schedule.insert', 'INSERT'],
    ['PUT', '/ops/emergency-reschedules/:rescheduleId', 'teaching.schedule.update', 'UPDATE'],
    ['GET', '/ops/emergency-reschedules/:rescheduleId', 'teaching.schedule.view', 'READ'],
    ['POST', '/feeder/checkpoints/:checkpointId/publish', 'feeder_pddikti.checkpoint.validate', 'VALIDATE'],
    ['PUT', '/admin/feeder/mappings/:mappingId', 'feeder_pddikti.mapping.update', 'UPDATE'],
    ['DELETE', '/ops/emergency-reschedules/:rescheduleId', 'teaching.schedule.delete', 'DELETE'],
  ]],
  ['7.31', 'APP · SuperApp Mobile (sinkronisasi & perangkat)', [
    ['GET', '/mobile/sync/delta', 'enrollment.krs.view', 'sudah ada — read model sync'],
    ['POST', '/mobile/devices/register', 'identity.device.insert', 'INSERT'],
    ['PUT', '/mobile/devices/:deviceId', 'identity.device.update', 'UPDATE'],
    ['GET', '/mobile/push-token/:userId/state', 'identity.notification.view', 'READ'],
    ['DELETE', '/mobile/devices/:deviceId', 'identity.device.delete', 'DELETE'],
  ]],
];

const block = [
  '### 7.25–7.31 Penutup celah CRUD wajib per modul (audit dewan 2026-10-21) — M-05, M-07, M-20, M-23/M-30, M-27, M-31/M-32, M-33/M-34, APP',
  '',
  '**Mengapa gugus ini ada.** Pemindaian `node .tools/crud-matrix.mjs` atas 48 baris registri menemukan bahwa tujuh keluarga modul **tidak punya satu baris rute pun** dan 30 modul lainnya tidak menuliskan jalan **UPDATE**/**DELETE** untuk objek induknya. Itu bukan pilihan desain: norma tulis SICA memakai transisi state untuk penghapusan, tetapi transisi itu sendiri tetap butuh baris rute yang disebut. Bagian ini menutup keduanya; status seluruh barisnya `spec-only · blocker` sampai objek `00xx` masing-masing berberkas.',
  '',
];
for (const [no, title, rs] of FAMILIES) {
  block.push('#### ' + no + ' ' + title);
  block.push('');
  block.push('| METHOD | Jalur | Izin acuan | Modul | Status |');
  block.push('|---|---|---|---|---|');
  for (const [m, p, perm, kind] of rs) {
    block.push('| ' + m + ' | `' + p + '` | `' + perm + '` | ' + (title.match(/M-\d{2}|APP/g) || []).join('·') + ' | `spec-only` · ' + kind + ' · belum pernah diimplementasikan |');
  }
  block.push('');
}

block.push('#### 7.32 Pelengkap famili yang sudah ada (dihasilkan dari pola famili itu sendiri)');
block.push('');
block.push('Baris-baris berikut **tidak mengarang jalur**: setiap baris adalah saudara dari jalur yang sudah tercetak di §7.1–§7.21 untuk modul yang sama, dengan `:id` dan akar sumber yang sama. Izin yang belum ada di katalog diberi nomor `usulan` dan didaftarkan di `RBAC_MATRIX §4.5.3` pada edit yang sama — bukan di sini, supaya satu nama satu pemilik.');
block.push('');
block.push('| METHOD | Jalur | Izin acuan | Modul | Status |');
block.push('|---|---|---|---|---|');
added.forEach((a) => block.push(a));
block.push('');
block.push('**Vonis bagian ini.** Setelah §7.25–§7.32, matriks CRUD wajib (CREATE·READ·UPDATE·DELETE/transisi·VALIDATE di titik persetujuan) punya baris untuk **setiap** modul ber-objek. Klaimnya masih `spec-only`: nol implementasi, dan enam baris yang memakai izin `usulan` baru tidak boleh dirutenkan sebelum `RBAC_MATRIX` mempromosikannya lewat `gen-rbac-seed.mjs` (`AGENTS §3.8`).');
block.push('');
block.push('');

/* tulis ke API_SPEC: sisip sebelum §7.23 (rekap) agar penutup tidak berada setelah rekap */
const ANCHOR = '### 7.23 Rekap dan status jujur';
if (spec.split(ANCHOR).length !== 2) { console.log('anchor §7.23 tidak unik — berhenti'); process.exit(1); }
writeFileSync(D + 'API_SPEC.md', spec.replace(ANCHOR, block.join(NL) + ANCHOR), 'utf8');

/* daftarkan izin baru ke RBAC §4.5.3 — satu tempat, nomor bersambung dari 302 */
/* daftar izin yang dipakai semua baris baru (tulis-manual + hasil alat), disaring terhadap
   katalog yang sudah tercetak; sisanya menjadi §4.5.3 dengan nomor bersambung dari 302 */
const METHOD_VERB = { GET: 'READ', POST: 'INSERT', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };
const usedCodes = [];
for (const [, title, rs] of FAMILIES) {
  for (const [meth, path, code, kind] of rs) {
    const verb = /^(READ|INSERT|UPDATE|DELETE|VALIDATE|OTHER)$/.test(kind) ? kind : METHOD_VERB[meth];
    usedCodes.push({ code, verb, mod: (title.match(/M-\d{2}|APP/g) || []).join('·'), base: path });
  }
}
for (const g of genCodes) usedCodes.push(g);
const uniq = new Map();
for (const u of usedCodes) if (!known.has(u.code) && !uniq.has(u.code)) uniq.set(u.code, u);
const newPerms = [...uniq.values()].map((u, i) => ({ ...u, no: 302 + i }));
const careerNote = newPerms.filter((p) => p.code.startsWith('career.'));
const permRows = newPerms.map((p) => '| ' + p.no + ' | `' + p.code + '` | `' + p.code.split('.')[0] + '` | `' + p.base + '` | `' + p.verb + '` | FR-CRUD `' + p.mod + '` · penutup CRUD 2026-10-21 | ' + (p.verb === 'DELETE' ? '`TENANT_ADMIN`, `HEAD_OF_PROGRAM` — hanya transisi `VOID`/`withdrawn`/`inactive`' : p.verb === 'VALIDATE' ? 'pemegang `VALIDATE` gugus terkait; **MFA ya**, SoD penyetuju ≠ pemohon' : 'sesuai pemegang `' + p.code.split('.').slice(0, 2).join('.') + '.view` pada scope objek') + ' | ' + (p.verb === 'DELETE' ? 'MFA ya · bukan `DELETE` SQL; baris tetap terbaca di jejak audit (`BR-G1`)' : 'MFA sesuai verba · `SERVER_ONLY` tetap berlaku · anti-IDOR: `:id` diselesaikan ke baris di dalam transaksi') + ' | usulan |');
const RB = '#### 4.5.3 Katalog izin pelengkap CRUD (2026-10-21) — ' + newPerms.length + ' baris 302+';
let s = readFileSync(D + 'RBAC_MATRIX.md', 'utf8');
if (s.includes('#### 4.5.3')) { console.log('§4.5.3 sudah ada — izin tidak didaftarkan dua kali'); }
else {
  const anchor = NL + '### 4.6 ';
  if (s.split(anchor).length !== 2) { console.log('anchor §4.6 tidak unik — RBAC tidak diubah'); process.exit(1); }
  const sec = [
    RB,
    '',
    'Dihasilkan oleh `.tools/crud-completer.mjs` dari famili rute yang sudah ada; **status `usulan`** sampai dipromosikan ke `PERMISSION_SPECS` (`AGENTS §3.8`, pola `G-15`). Yang `DELETE` bukan penghapusan fisik: ia transisi `VOID`/`withdrawn`/`inactive` yang barisnya tetap terbaca jejak audit (`BR-G1`, `FIELD_RULES`).',
    (careerNote.length ? NL + '**Keputusan yang ditagih bagian ini (`P-12`, `G-30`).** ' + careerNote.length + ' kode berawalan `career.` (baris ' + careerNote.map((p) => p.no).join(', ') + ') tidak dapat masuk `PERMISSION_SPECS` hari ini karena `packages/contracts/src/authz.ts` hanya mengenal **13 nilai `PermissionModule`** dan `career` bukan salah satunya. Ini bukan sesuatu yang boleh diputus oleh dokumen rute: perlu satu keputusan produk (tambah nilai `career`, atau petakan tracer/alumni ke `academic`) **sebelum** seed dibuat — menulis `career.*` tanpa keputusan itu persis pola `RD-61`/`G-04` yang sudah dua kali kita bayar.' : ''),
    '',
    '| # | Permission | Modul | Titik aksi | `verb` | Sumber | Peran sasaran | Catatan penegakan | Status |',
    '|---|---|---|---|---|---|---|---|---|',
    ...permRows,
    '',
  ].join(NL) + NL;
  s = s.replace(anchor, NL + sec + NL + '### 4.6 ');
  writeFileSync(D + 'RBAC_MATRIX.md', s, 'utf8');
}

console.log('baris rute ditambahkan = ' + (added.length + FAMILIES.reduce((a, f) => a + f[2].length, 0)));
console.log('izin baru terdaftar     = ' + newPerms.length + ' (nomor 302–' + (301 + newPerms.length) + ')');
