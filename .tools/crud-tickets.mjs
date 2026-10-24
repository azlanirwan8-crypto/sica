import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const out = [];

/* ── 1. RBAC §4.5.3: buang baris yang kodenya SUDAH ada di bagian lain katalog ──
   `enrollment.krs.view` ternyata sudah tercetak di §4.2 (tabel tanpa nomor baris), sehingga
   penomongan 302 tadi menciptakan sumber kebenaran kedua — persis pola `RD-32`. */
const RP = D + 'RBAC_MATRIX.md';
let rbac = readFileSync(RP, 'utf8');
const i0 = rbac.indexOf('#### 4.5.3');
const i1 = rbac.indexOf('### 4.6 Scope SITE');
const sec = rbac.slice(i0, i1);
const outside = rbac.slice(0, i0) + rbac.slice(i1);
const kept = [];
for (const line of sec.split(NL)) {
  const m = line.match(/^\|\s*\d+\s*\|\s*`([a-z_]+\.[a-z_0-9]+\.[a-z_0-9]+)`\s*\|/);
  if (!m) continue;
  if (outside.includes('`' + m[1] + '`')) { out.push('buang duplikat: ' + m[1]); continue; }
  if (!kept.includes(line)) kept.push(line);
  else out.push('buang kembar dalam §4.5.3: ' + m[1]);
}
let no = 302;
const renum = kept.map((l) => l.replace(/^\|\s*\d+\s*\|/, (s) => '| ' + (no++) + ' |'));
const head = ['#### 4.5.3 Katalog izin pelengkap CRUD (2026-10-21) — ' + renum.length + ' baris' + (renum.length ? ' 302+' : ' (nol)')];
const body = [
  '',
  'Bagian ini **disusun ulang dua kali** dalam satu siklus. Pertama, keluaran generator `.tools/crud-completer.mjs` (204 izin) dibatalkan karena memasangkan izin dengan objek yang salah (`RD-83`). Kedua, dua baris sisanya dihapus setelah diperiksa terhadap seluruh katalog: `enrollment.krs.view` sudah dimiliki §4.2, dan menomori ulang kode yang sama menjadi sumber kebenaran kedua (`RD-32`). Yang tersisa di bawah hanyalah kode yang benar-benar belum pernah ada di berkas ini.',
  '',
  '**Norma yang mengikat bagian ini.** Nama resource bebas (`career.`, `ppks.`, `endowment.`), tetapi kolom **Modul wajib salah satu dari 13 nilai `PermissionModule`** di `packages/contracts/src/authz.ts` — `career.*` masuk sebagai `academic`, bukan `career`, mengikuti baris 257–260. Pemeriksaan ini dijaga `.tools/rbac-module-union.mjs`, bukan oleh ingatan penulis.',
  '',
];
const table = renum.length ? ['', '| # | Permission | Modul | Titik aksi | `verb` | Sumber | Peran sasaran | Catatan penegakan | Status |', '|---|---|---|---|---|---|---|---|---|', ...renum] : ['', '_Nol baris baru: seluruh izin yang dipakai §7.25–§7.31 sudah dimiliki katalog sebelumnya._'];
writeFileSync(RP, rbac.slice(0, i0) + head.join(NL) + NL + body.join(NL) + NL + table.join(NL) + NL + NL + rbac.slice(i1), 'utf8');
out.push('§4.5.3 kini ' + renum.length + ' baris');

/* ── 2. API_SPEC §7.32: koreksi klaim `career` yang baru saja saya terbukti salah ── */
const AP = D + 'API_SPEC.md';
let spec = readFileSync(AP, 'utf8');
const salah = '| `career.*` menuntut satu nilai `PermissionModule` baru di `authz.ts` (kini 13) | 1 gugus | keputusan produk `P-12`, bukan penulis rute | `CRD-4` |';
const benar = '| kode `career.*` **tidak** menuntut nilai baru — kolom `Modul`-nya sudah benar `academic` mengikuti baris 257–260; yang menuntut penjagaan justru kebalikannya: jangan pernah menulis `career` ke kolom `Modul` | 1 penjaga | `.tools/rbac-module-union.mjs` + `authz.ts` (13 nilai) | `CRD-4` |';
if (!spec.includes(salah)) out.push('API_SPEC: baris career tidak ditemukan (mungkin sudah dibetulkan)');
else { spec = spec.replace(salah, benar); out.push('API_SPEC: klaim `career` dikoreksi'); }
spec = spec.replace('dengan tiket di `ROADMAP §2.22` (`CRD-1`…`CRD-4`) dengan pemilik dokumen yang jelas.',
  'dengan tiket di [ROADMAP §2.22](file:///c:/SICA/docs/ROADMAP_TASKS.md) (`CRD-1`…`CRD-4`) dengan pemilik dokumen yang jelas.');
/* ralat jujur di penutup §7.32 */
spec = spec.replace('**Larangan untuk tiket ini.**',
  '**Ralat 2026-10-21 (diri sendiri).** Baris keempat tabel di atas semula saya tulis sebagai "`career.*` menuntut satu nilai `PermissionModule` baru". Itu **salah**: `RBAC_MATRIX` baris 257–260 sudah memakai kode `career.*` dengan kolom `Modul = academic`, dan itulah norma yang benar (nama resource bebas, Modul terbatas 13 nilai). Saya menuliskan klaim itu tanpa membuka `authz.ts` lebih dulu — persis kelas kesalahan `RD-61`. Yang benar adalah sebaliknya: yang perlu dijaga adalah **jangan** mengisi kolom `Modul` dengan nama resource.\n\n**Larangan untuk tiket ini.**');
writeFileSync(AP, spec, 'utf8');

/* ── 3. ROADMAP §2.22: rumah tiket yang dijanjikan §7.32 ── */
const GP = D + 'ROADMAP_TASKS.md';
let g = readFileSync(GP, 'utf8');
if (g.includes('### 2.22 Penutup kelengkapan CRUD')) out.push('ROADMAP: §2.22 sudah ada, dilewati');
else {
  const anchor = NL + '## Phase 3: Mobile MVP';
  if (g.split(anchor).length !== 2) { out.push('ROADMAP: anchor Phase 3 tidak unik — §2.22 TIDAK ditulis'); }
  else {
    const secG = [
      '### 2.22 Penutup kelengkapan CRUD per modul (`CRD-1`…`CRD-4`) — hasil audit matriks 2026-10-21',
      '',
      '> **Rujukan induk:** [API_SPEC §7.25–§7.32](file:///c:/SICA/docs/API_SPEC.md) (keluarga rute baru + daftar yang masih bolong), [RBAC_MATRIX §4.5.3](file:///c:/SICA/docs/RBAC_MATRIX.md) (izin pelengkap, status `usulan`), [DATA_MODEL §22](file:///c:/SICA/docs/DATA_MODEL.md) (pemilik nama objek), `node .tools/crud-matrix.mjs` (sumber angka). Bagian ini **tidak** menambah norma; ia menagih baris yang belum ditulis.',
      '',
      '**Asal gugus ini.** `crud-matrix` memindai 48 baris registri terhadap seluruh jalur API (1.380 jalur unik) dan menemukan (a) tujuh keluarga modul tanpa satu baris rute pun — kini ditulis tangan di §7.25–§7.31, (b) 30 modul tanpa jalur UPDATE untuk objek induknya, (c) 35 modul tanpa jalur transisi berhenti, (d) delapan keluarga yang rutenya baru tetapi DDL-nya belum bernama. Percobaan mengisi (b) dan (c) dengan generator **dibatalkan** karena hasilnya salah secara semantik (`RD-83`); karena itu tiket di bawah ditulis tangan oleh pemilik dokumen, satu baris satu objek.',
      '',
      '- [ ] **`CRD-1` — Jalur UPDATE untuk objek induk, 30 modul.** *Isi:* satu `PUT /<sumber>/:id` per objek induk modul, dengan `SERVER_ONLY` pada kolom turunan dan `expectedVersion`/`If-Match`. *Cara ukur:* `node .tools/crud-matrix.mjs` harus mencetak `UPDATE = 0` untuk nol modul. *Pemilik:* `API_SPEC §7` (baris) + `RBAC_MATRIX §4.5` (izin `.update`). *Penahan:* izin `.update` yang belum ada tidak boleh dikarang; ia naik sebagai baris `§4.5.x` lebih dulu (`AGENTS §3.8`).',
      '- [ ] **`CRD-2` — Transisi berhenti per modul (soft-delete/`void`/`withdrawn`), 35 modul.** *Isi:* satu baris transisi per modul yang objeknya dapat berhenti, **bukan** `DELETE` SQL; barisnya tetap terbaca di jejak audit. *Cara ukur:* `crud-matrix` mencetak `DELETE = 0` untuk nol modul ber-objek, dan tiap pemegang `DELETE` membawa MFA + SoD. *Pemilik:* `DATA_MODEL` (nama transisi + `BR-G1`) → `API_SPEC` → `RBAC`. *Larangan:* menghapus lewat generator tanpa membaca objeknya.',
      '- [ ] **`CRD-3` — DDL untuk delapan keluarga yang baru punya rute.** M-05 audit partisi, M-07 BKD, M-20 TA/RAMA, M-23 wisuda + M-30 dokumen/SKPI, M-27 tracer/alumni, M-31/M-32 akreditasi-IKP, M-33 jadwal darurat, M-34 feeder tulis, `APP` sinkron. *Isi:* nama tabel + kolom + RLS + nomor migrasi di `DATA_MODEL §22`, lalu `node .tools/ddl-owner.mjs` tetap HIJAU (satu nama satu `CREATE TABLE`, satu pemilik). *Penahan:* `§22` adalah pemilik nama; rute §7.25–§7.31 tetap `spec-only` sampai nomor objek ada.',
      '- [ ] **`CRD-4` — Penjaga kolom `Modul` terhadap 13 nilai `PermissionModule`.** *Isi:* alat `.tools/rbac-module-union.mjs` membandingkan kolom `Modul` pada seluruh baris izin dengan `PERMISSION_MODULES` di `packages/contracts/src/authz.ts`; nama resource (`career`, `ppks`, `endowment`, `mobility`) **bebas**, kolom `Modul` **terbatas**. *Asus:* saya sendiri pernah menulis klaim "`career.*` menuntut nilai `PermissionModule` baru" tanpa membuka `authz.ts` — salah, dan itulah alasan penjaga ini dibuat (`RD-61` berulang). *Cara ukur:* `rbac-module-union` HIJAU; nol baris izin dengan `Modul` di luar himpunan 13.',
      '',
      '**Definisi selesai gugus ini.** `crud-matrix` mencetak `lengkap` untuk 47 modul + `APP` (dengan catatan read-model M-26/M-31/M-32/M-33/M-34 yang vonisnya memang tidak menulis `C`/`D`), `ddl-owner` dan `rbac-count` tetap HIJAU, dan tidak ada satu pun baris hasil tebakan. Sampai di situ CRUD wajib berhenti menjadi klaim naratif.',
      '',
    ].join(NL) + NL;
    g = g.replace(anchor, NL + secG + anchor.replace(NL, ''));
    writeFileSync(GP, g, 'utf8');
    out.push('ROADMAP §2.22 ditulis (CRD-1…CRD-4)');
  }
}
console.log(out.join(NL));
