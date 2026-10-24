import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';

/* MEMBATALKAN BAGIAN HASIL GENERATOR.
   `crud-completer.mjs` ternyata memfabrikasi pasangan izin yang salah: `helpdesk.impact.update`
   ditempel ke `/helpdesk/sla-policies/:id`, `hr.payroll.update` ke `/admin/engine/pph21-bracket/runs/:id`,
   dan satu baris `DELETE /helpdesk/tickets/:id` tercetak dua kali. Angka "321 baris / 204 izin"
   terdengar rapi tetapi salah secara semantik — dan dokumen spesifikasi yang salah lebih mahal
   daripada dokumen yang bolong tapi jujur. Yang disimpan hanya §7.25–§7.31 (ditulis tangan,
   satu per satu dipikirkan); sisanya diganti menjadi tiket yang nama dan pemiliknya jelas. */

const spec = readFileSync(D + 'API_SPEC.md', 'utf8');
const s0 = spec.indexOf('### 7.25–7.31 Penutup celah CRUD');
const s1 = spec.indexOf('#### 7.32 Pelengkap famili');
const s2 = spec.indexOf('### 7.23 Rekap dan status jujur');
if (!(s0 >= 0 && s1 >= 0 && s2 > s1)) { console.log('anchor tidak ditemukan (0=' + s0 + ' 1=' + s1 + ' 2=' + s2 + ') — tidak diubah'); process.exit(1); }
const manual = spec.slice(s0, s1);

const replacement = manual + [
  '#### 7.32 Pelengkap CRUD yang MASIH BOLONG — dinyatakan sebagai tagihan, bukan diisi otomatis',
  '',
  '**Kenapa bagian ini kosong dan itu disengaja.** Percobaan pertama mengisi kekosongan ini dengan generator (`.tools/crud-completer.mjs`) menghasilkan 321 baris rute dan 204 izin "baru" dalam satu detik. Ketika keluarannya dibaca — bukan dipercaya — generator itu terbukti **memasangkan izin dengan objek yang salah**: `helpdesk.impact.update` ditempel ke `/helpdesk/sla-policies/:id`, `hr.payroll.update` ditempel ke `/admin/engine/pph21-bracket/runs/:id`, dan `DELETE /helpdesk/tickets/:id` tercetak dua kali. Angka besar yang salah lebih berbahaya daripada lubang yang ditandai, karena yang pertama terbaca seperti selesai. Seluruh keluaran generator itu **dihapus** pada 2026-10-21 dan kebutuhan yang sebenarnya didaftarkan sebagai tiket di `ROADMAP §2.22` (`CRD-1`…`CRD-4`) dengan pemilik dokumen yang jelas.',
  '',
  '**Kebutuhan terukur yang tersisa (dari `node .tools/crud-matrix.mjs`).**',
  '',
  '| Kebutuhan | Jumlah modul | Rumah yang berhak | Tiket |',
  '|---|---:|---|---|',
  '| jalur UPDATE (`PUT`/`PATCH`) untuk objek induk belum ditulis | 30 | `API_SPEC §7` per modul + izin di `RBAC §4.5` | `CRD-1` |',
  '| jalur transisi berhenti (soft-delete/`void`/`withdrawn`) belum ditulis per modul | 35 | `API_SPEC §7` + norma `BR-G1` di `DATA_MODEL` | `CRD-2` |',
  '| keluarga yang baru punya baris sejak §7.25 (M-05, M-07, M-20, M-23/M-30, M-27, M-31/M-32, M-33/M-34, APP) belum punya DDL milik sendiri | 8 | `DATA_MODEL §22` (pemilik nama objek) | `CRD-3` |',
  '| `career.*` menuntut satu nilai `PermissionModule` baru di `authz.ts` (kini 13) | 1 gugus | keputusan produk `P-12`, bukan penulis rute | `CRD-4` |',
  '',
  '**Larangan untuk tiket ini.** Baris rute tidak boleh ditulis dengan menebak nama izin dari pola string; satu baris rute = satu objek yang namanya sudah dimiliki `DATA_MODEL` + satu kode izin yang sudah ada di katalog ATAU naik sebagai baris `§4.5.x` dengan peran sasaran yang diputus manusia. Melanggar aturan ini adalah `RD-73`/`RD-83`, dan generator yang mengulanginya harus dibuang, bukan dibenahi dengan prompt.',
  '',
  '',
].join(NL) + spec.slice(s2);

writeFileSync(D + 'API_SPEC.md', spec.slice(0, s0) + replacement, 'utf8');

/* RBAC §4.5.3 disusun ulang: HANYA kode yang benar-benar dipakai baris §7.25–§7.31 yang
   belum ada di katalog, dan itu diekstrak dari API_SPEC itu sendiri (bukan dari salinan) */
const kept = readFileSync(D + 'API_SPEC.md', 'utf8').slice(s0, s0 + replacement.length);
const usedCodes = new Map();
for (const m of kept.matchAll(/^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`\s*\|\s*`([a-z_]+\.[a-z_0-9]+\.[a-z_0-9]+)`\s*\|\s*([^|]+)\|/gm)) {
  if (usedCodes.has(m[3])) continue;
  usedCodes.set(m[3], { meth: m[1], path: m[2], mod: m[4].trim() });
}
const VERBA = { GET: 'READ', POST: 'INSERT', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };
const full = readFileSync(D + 'RBAC_MATRIX.md', 'utf8');
const known = new Set();
for (const m of full.matchAll(/^\|\s*\d{1,3}\s*\|\s*`([a-z_]+\.[a-z_0-9]+\.[a-z_0-9]+)`\s*\|/gm)) known.add(m[1]);
/* yang dikenal juga termasuk kode yang dicetak di badan §4.5.3 sebelum pemotongan */
const idx0 = full.indexOf('#### 4.5.3');
const idx1 = full.indexOf('### 4.6 Scope SITE');
if (idx0 === -1 || idx1 === -1) { console.log('anchor RBAC tidak ditemukan — §4.5.3 tidak disusun ulang'); process.exit(1); }
const rows = [];
let no = 302;
const career = [];
for (const [code, u] of [...usedCodes.entries()].sort()) {
  if (known.has(code)) continue;
  const verb = VERBA[u.meth] || 'OTHER';
  if (code.startsWith('career.')) career.push(no);
  rows.push('| ' + no + ' | `' + code + '` | `' + code.split('.')[0] + '` | `' + u.path + '` | `' + verb + '` | FR-CRUD `' + u.mod + '` · §7.25–§7.31 penutup CRUD 2026-10-21 | ' + (verb === 'DELETE' ? '`TENANT_ADMIN`, `HEAD_OF_PROGRAM` — hanya transisi `VOID`/`withdrawn`/`inactive`, bukan `DELETE` SQL' : verb === 'VALIDATE' ? 'pemegang `VALIDATE` gugus terkait; penyetuju ≠ pemohon (SoD `BR-G4`)' : 'sesuai pemegang `' + code.split('.').slice(0, 2).join('.') + '.view` pada scope objeknya') + ' | ' + (verb === 'DELETE' ? '**MFA ya** · baris tetap terbaca di jejak audit (`BR-G1`)' : verb === 'VALIDATE' ? '**MFA ya** · `SERVER_ONLY` tetap berlaku' : 'MFA tidak · `SERVER_ONLY` tetap berlaku · anti-IDOR: `:id` diselesaikan ke baris di dalam transaksi') + ' | usulan |');
  no++;
}
const sec = [
  '#### 4.5.3 Katalog izin pelengkap CRUD (2026-10-21) — ' + rows.length + ' baris 302+ (hanya yang benar-benar dirujuk §7.25–§7.31)',
  '',
  'Bagian ini **disusun ulang** setelah keluaran generator `.tools/crud-completer.mjs` dibatalkan: generator itu memfabrikasi 204 pasangan izin yang sebagian salah objek (`RD-83`). Daftar di bawah hanya memuat kode yang tercetak sebagai "Izin acuan" pada baris §7.25–§7.31 dan belum ada di katalog; sisanya tetap wewenang `§4.5`–`§4.5.2`. Status seluruhnya `usulan` sampai `gen-rbac-seed.mjs` mempromosikannya (`AGENTS §3.8`).',
  '',
  (career.length ? '**Tagihan keputusan (`P-12`).** ' + career.length + ' kode berawalan `career.` (baris ' + career.join(', ') + ') tidak dapat masuk `PERMISSION_SPECS` hari ini karena `packages/contracts/src/authz.ts` hanya mengenal **13 nilai `PermissionModule`** dan `career` bukan salah satunya. Yang harus diputus lebih dulu adalah **produk**, bukan rute: menambah nilai `career`, atau memetakan tracer/alumni ke `academic` — memilih diam dan tetap menulis `career.*` adalah pola `RD-61` yang sudah dua kali kita bayar.' : ''),
  '',
  '| # | Permission | Modul | Titik aksi | `verb` | Sumber | Peran sasaran | Catatan penegakan | Status |',
  '|---|---|---|---|---|---|---|---|---|',
  ...rows,
  '',
  '',
].join(NL);
writeFileSync(D + 'RBAC_MATRIX.md', full.slice(0, idx0) + sec + full.slice(idx1), 'utf8');
console.log('§7.32 diganti jadi tagihan; §4.5.3 disusun ulang = ' + rows.length + ' izin (karier ' + career.length + ')');
