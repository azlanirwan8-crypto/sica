// perm-usulan.mjs — menutup celah `perm-phantom` dengan dua langkah yang tidak boleh tertukar urutannya:
//  (1) MEMPERBAIKI kutipan API_SPEC yang melanggar vonis namespace/verba milik RBAC §4.5.1 — ini salah
//      tulis, bukan kekurangan register, jadi tidak boleh "disahkan" dengan mendaftarkannya;
//  (2) MENDAFTARKAN sisa titik aksi sebagai baris usulan `#### 4.5.6` yang SENGAJA tanpa nomor dan tanpa
//      peran, supaya rute boleh mengutip nama yang nyata ada sementara keputusan peran tetap milik manusia.
//
// Aturan penulisan (RD-99, lahir dari kegagalan dijalankan pertama kali): TIDAK ADA BERKAS yang ditulis
// sebelum semua pola rename terbukti ada DAN semua hantu tersisa lolos uji namespace/verba. Versi pertama
// melanggar ini dan meninggalkan §4.5.6 berisi 348 baris yang dibangun dari kutipan yang belum diperbaiki.
//
// Kenapa ini BUKAN `crud-completer.mjs` (RD-83): generator itu menyusun izin dari tebakan pola dan
// hasilnya harus dibuang. Baris di sini tidak menambah SATU PUN nama baru — tiap baris adalah kode yang
// sudah tertulis di API_SPEC (dibuktikan `citeLines`), hanya dipindahkan ke register. Nomor katalog tetap
// 301 (dijaga rbac-count), dan kolom peran sengaja berisi "BELUM DIPUTUS".
import { readFileSync, writeFileSync } from 'node:fs';
import { loadRbac, citeLines, actionOf } from './lib-perm.mjs';

const NL = String.fromCharCode(10);
const fail = [];

// ---------- (1) perbaikan kutipan API_SPEC ----------
const apiPath = 'docs/API_SPEC.md';
const api0 = readFileSync(apiPath, 'utf8');
let api = api0;

const FIX = [
  // Pelanggaran verba (vonis §4.5.1: penolakan = hasil negatif dari transisi VALIDATE; read-model ekspor
  // mengikuti izin READ sumbernya, gugus baru tidak menambah izin ekspor).
  {
    from: '`identity.accessrequest.approve` sudah ada; pasangan `.reject` belum (**K-3**)',
    to: '`identity.accessrequest.approve` sudah ada; **penolakan bukan izin kedua** (vonis `RBAC §4.5.1`) — ia hasil negatif dari transisi `VALIDATE` yang sama dan tetap wajib `reason`, sehingga `K-3` ditutup sebagai ralat bukan sebagai izin baru',
    min: 1,
  },
  { from: '`finance.waiver.reject`', to: '`finance.waiver.approve`', min: 1 },
  {
    from: 'penolakan wajib `reason ≥ 10 char`. Pasangan `.reject` **usulan — belum di katalog** (`K-3`)',
    to: 'penolakan wajib `reason ≥ 10 char` dan **bukan izin kedua** (vonis `RBAC §4.5.1`: hasil negatif dari transisi `VALIDATE` pada baris yang sama), sehingga `K-3` tertutup sebagai ralat bukan sebagai izin baru',
    min: 1,
  },
  { from: '`fieldwork.logbook.export`', to: '`fieldwork.logbook.view`', min: 1 },
  { from: '`academic.bkd.export`', to: '`hr.bkd.view`', min: 1 },
  // Pelanggaran namespace: daftar prefiks sah berasal dari baris BERNOMOR katalog (terukur `loadRbac`),
  // dan `admin.*`/`ipr.*`/`studentaffairs.*`/`credential.*` tidak pernah menjadi kode di dalamnya.
  { from: '`academic.bkd.validate`', to: '`hr.bkd.approve`', min: 1 },
  { from: '`academic.bkd.', to: '`hr.bkd.', min: 1 },
  { from: '`ipr.', to: '`iprs.', min: 1 },
  { from: '`studentaffairs.point', to: '`kbm.points', min: 1 },
  { from: '`studentaffairs.', to: '`kbm.', min: 1 },
  { from: '`credential.pin', to: '`graduation.pin', min: 1 },
  { from: '`credential.diploma', to: '`graduation.diploma', min: 1 },
  { from: '`credential.sivil', to: '`graduation.sivil', min: 1 },
  { from: '`admin.user.create`', to: '`identity.user.create`', min: 1 },
  { from: '`admin.krs.dispense`', to: '`enrollment.krs.dispense`', min: 1 },
  { from: '`admin.import.', to: '`platform.import.', min: 1 },
];

// Uji kehadiran SEMUA pola lebih dulu; satu pun yang meleset berarti tidak ada berkas yang disentuh.
// "Sudah diterapkan" dibedakan dari "tidak ada": pola lama nol TETAPI nama barunya nyata ada berarti
// rename siklus ini sudah jalan, jadi skrip boleh diulang untuk membangun ulang §4.5.6 tanpa mengulang rename.
const plan = [];
for (const f of FIX) {
  const n = api.split(f.from).length - 1;
  if (n > 0) { plan.push([f, n]); continue; }
  const sudah = api.split(f.to).length - 1;
  if (sudah > 0) { console.log('API_SPEC: sudah diterapkan, dilewati: ' + f.from + '  (x' + sudah + ' nama baru terbaca)'); continue; }
  fail.push('pola tidak ditemukan dan nama sasarannya tidak ada: ' + f.from);
}
if (fail.length) { console.error('MERAH — tidak ada berkas ditulis. ' + fail.join(' | ')); process.exit(1); }
for (const [f, n] of plan) { api = api.split(f.from).join(f.to); console.log('API_SPEC: ' + f.from + '  ->  ' + f.to + '   x' + n); }

// ---------- (2) hantu dihitung dari teks HASIL perbaikan, di memori ----------
// Anti-umpan-balik (`RD-93` adalah kegagalan yang sudah pernah terjadi di alat ini): register yang
// dibangun alat tidak boleh menjadi bahan pengukuran yang membangunnya. Karena §4.5.6 ikut dibaca
// `loadRbac` sebagai nama yang dikenal, hitungan hantu dijalankan atas salinan RBAC TANPA §4.5.6,
// sehingga tabel selalu dibangun dari register kanonik (§4.5, §4.5.1–4.5.5, authz) dan regenerasi ke-N
// menghasilkan tabel yang sama dengan regenerasi pertama. §4.5.4/§4.5.5 tetap dihitung: itu register
// yang ditulis tangan lebih dulu, bukan keluaran skrip ini.
const rbRaw = readFileSync('docs/RBAC_MATRIX.md', 'utf8').split(NL);
const cut = rbRaw.findIndex((l) => l.startsWith('#### 4.5.6 '));
const keepEnd = rbRaw.findIndex((l) => l.startsWith('### 4.6 '));
const rb = loadRbac('docs/RBAC_MATRIX.md', (cut >= 0 && keepEnd > cut ? rbRaw.slice(0, cut).concat(rbRaw.slice(keepEnd)) : rbRaw).join(NL));
const cited = citeLines(api.split(NL));
const ghosts = [...cited.entries()].filter(([code]) => !rb.named.has(code) && code.split('.').length >= 3);
const stillBad = ghosts.filter(([code]) => !rb.prefixes.has(code.split('.')[0]));
if (stillBad.length) fail.push('namespace masih asing: ' + stillBad.map(([c]) => c).join(', '));
const forbidden = ghosts.filter(([code]) => { const a = actionOf(code); return a && String(a.verb).startsWith('FORBIDDEN'); });
if (forbidden.length) fail.push('verba terlarang masih dikutip: ' + forbidden.map(([c]) => c).join(', '));
if (fail.length) { console.error('MERAH — tidak ada berkas ditulis. ' + fail.join(' | ')); process.exit(1); }

writeFileSync(apiPath, api, 'utf8');
console.log('API_SPEC ditulis (' + plan.length + ' pola, ' + plan.reduce((a, x) => a + x[1], 0) + ' penggantian)');

// Modul sasaran diwarisi dari baris BERNOMOR prefiks yang sama (mayoritas kolom `Modul`), bukan dikarang.
const modVotes = new Map();
for (const [code, meta] of rb.numbered) {
  const p = code.split('.')[0];
  const m = (meta.module || '').replace(/`/g, '').trim();
  if (!m) continue;
  if (!modVotes.has(p)) modVotes.set(p, new Map());
  modVotes.get(p).set(m, (modVotes.get(p).get(m) || 0) + 1);
}
const moduleOf = (p) => {
  const v = modVotes.get(p);
  if (!v) return '';
  return [...v.entries()].sort((a, b) => b[1] - a[1])[0][0];
};
const CLASSES = ['security', 'technical', 'ops', 'academic', 'financial', 'regulatory'];

const rows = ghosts
  .map(([code, info]) => {
    const seg = code.split('.');
    const act = actionOf(code);
    const resLen = seg.length >= 4 && act && CLASSES.includes(seg[seg.length - 1]) ? seg.length - 2 : seg.length - 1;
    const resource = seg.slice(0, resLen).join('.');
    const mod = moduleOf(seg[0]) || 'BELUM ADA';
    const sib = rb.pairVerbs.get(resource);
    const draft = sib ? 'bahan keputusan: `' + sib.keys().next().value + '`' : 'tidak ada saudara se-sumber daya';
    return '| `' + code + '` | `' + resource + '` | ' + (act ? act.verb : '?') + ' | `' + mod + '` | BELUM DIPUTUS — ' + draft + ' | `API_SPEC ' + info.section + '` |';
  })
  .sort();

const head = [
  '#### 4.5.6 Usulan izin titik aksi yang dikutip API_SPEC (2026-10-21) — **belum ber-nomor, belum ber-peran**',
  '',
  '**Kenapa bagian ini ada dan kenapa angkanya besar.** `node .tools/perm-phantom.mjs` mengukur setiap kode izin yang dikutip rute di [API_SPEC](file:///c:/SICA/docs/API_SPEC.md) terhadap register ini. Sebelum bagian ini ditulis, **{{N}}** kode dikutip tanpa pernah dinamai di mana pun — dan angka itu baru bisa terlihat setelah `RD-99` memperbaiki pemindai kutipan: versi lama membuang SHORTHAND rute (mis. "`iprs.application.view` · `.create` · `.update`"), sehingga sebagian permintaan izin tidak pernah diperiksa sama sekali. Selisih jumlah kandidat sebelum/sesudah dicetak alat, tidak dikunci di kalimat ini.',
  '',
  'Sebagian besar kutipan di bawah bukan kesalahan tulis spesifikasi produk: ia adalah **titik aksi nyata** dari rute modul `§7.1`–`§7.33` yang belum sempat masuk katalog ketika gelombang 4 berhenti di baris 291 dan gelombang 5 di 301. Yang *memang* kesalahan tulis sudah diperbaiki lebih dulu oleh `node .tools/perm-usulan.mjs` dan TIDAK didaftarkan di sini: namespace `admin.*`/`ipr.*`/`studentaffairs.*`/`credential.*`/`academic.bkd.*` dipindah ke prefiks yang benar (`identity`/`iprs`/`kbm`/`graduation`/`hr`), verba `.reject` dikembalikan ke vonis §4.5.1 (penolakan = hasil negatif transisi `VALIDATE`), dan `.export` dikembalikan ke izin READ sumbernya. Alat berhenti dengan MERAH kalau masih ada satu pun kutipan ber-namespace asing atau ber-verba terlarang — jadi tabel di bawah hanya berisi nama yang sudah lolos uji itu.',
  '',
  '**Tiga hal yang TIDAK dilakukan bagian ini.** (1) **Tidak memberi nomor.** Pemilik nomor adalah §4.5 dan `node .tools/rbac-count.mjs`; katalog hari ini tetap **301** dan tidak bergeser. (2) **Tidak menunjuk peran.** Kolom "Peran sasaran" berisi `BELUM DIPUTUS` karena grant peran adalah keputusan pemilik produk (`AGENTS §3.8`), bukan keluaran generator — inilah sebabnya bagian ini bukan `crud-completer.mjs` yang dibuang di `RD-83`. (3) **Tidak menambah nama.** Setiap baris dibuktikan oleh setidaknya satu kutipan rute; gerbang `node .tools/perm-usulan-audit.mjs` menolak baris yang tidak dikutip, ber-verb di luar enam verba kanonik, memakai `.reject`/`.export`, atau menyamar sebagai baris bernomor.',
  '',
  '**Cara membacanya.** `Modul` diwarisi dari mayoritas baris bernomor ber-prefiks sama, sehingga ia usulan yang bisa langsung diuji `rbac-module-union.mjs`; nilai `BELUM ADA` berarti prefiks itu belum punya satu pun baris bernomor dan pemilik modulnya wajib diputus lebih dulu. `bahan keputusan: x` hanya menunjuk baris saudara yang perannya sudah ada — itu bahan keputusan, bukan grant.',
  '',
  '**Penahan.** Sama seperti §4.5.4 dan §4.5.5: nama di bawah adalah **kebutuhan nama**, bukan izin. Belum ada di `PERMISSION_SPECS`, belum masuk seed, dan tidak boleh dipakai satu baris kode pun sebelum menjadi baris §4.5 ber-nomor dengan peran yang diputus manusia. Karena itu `perm-phantom` TIDAK menyebut keadaan ini HIJAU: ia memisahkan `USULAN` dari `BERNOMOR` dan melaporkan keduanya; vonis lengkapnya di [ROADMAP §2.22 `CRD-5`](file:///c:/SICA/docs/ROADMAP_TASKS.md).',
  '',
  '| Nama usulan | `resource` | `verb` | `Modul` sasaran | Peran sasaran (diputus manusia) | Rute yang mengutip |',
  '|---|---|---|---|---|---|',
];
const block = head.join(NL).replace('{{N}}', String(rows.length)) + NL + rows.join(NL) + NL;

const rbPath = 'docs/RBAC_MATRIX.md';
const rbi = readFileSync(rbPath, 'utf8').split(NL);
const start = rbi.findIndex((l) => l.startsWith('#### 4.5.6 '));
const anchor = rbi.findIndex((l) => l.startsWith('### 4.6 '));
if (anchor < 0) { console.error('MERAH — anchor `### 4.6` tidak ditemukan; RBAC tidak ditulis.'); process.exit(1); }
const from = start >= 0 ? start : anchor;
rbi.splice(from, anchor - from, ...block.split(NL), '');
writeFileSync(rbPath, rbi.join(NL), 'utf8');
console.log('RBAC §4.5.6: ' + rows.length + ' baris usulan ' + (start >= 0 ? '(regenerasi)' : '(baru)') + ' ditulis sebelum ### 4.6');
console.log('hantu tersisa = ' + ghosts.length + ' — semuanya kini terdaftar sebagai USULAN (peran & nomor masih milik manusia)');
