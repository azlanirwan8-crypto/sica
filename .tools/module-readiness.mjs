/**
 * module-readiness.mjs — LAPORAN KESIAPAN PER MODUL (47 modul + SuperApp = 48 baris).
 *
 * Prinsip yang menahan alat ini dari mengarang:
 *   · SATU pertanyaan satu pemilik (RD-95). Alat ini tidak menghitung ulang apa pun: ia
 *     MENJALANKAN pemiliknya dan menggabungkan keluarannya —
 *       - atribusi rute + verba + vonis CRUD  = `.tools/crud-matrix.mjs --json`
 *       - ketertelusuran dokumen (Sevima/regulasi/DDL-berlabel/layar/seed/lubang) = `.tools/module-provenance.mjs`
 *       - permukaan kode nyata (route.ts dan kelasnya)  = `.tools/handler-inventory.mjs --json`
 *       - menu per modul  = matriks `RBAC §6` (Role × Modul × Menu × Aksi), dipetakan ke M-xx
 *         lewat tabel partisi entitlement→modul `RBAC §4.5.1` (milik dokumen, bukan kurasi alat)
 *       - izin ber-nomor vs usulan per modul = baris katalog `RBAC §4.5` dan `§4.5.6`
 *   · Vonis readiness adalah FUNGSI dari aturan yang dicetak di bawah, bukan kalimat saya. Kalau
 *     satu komponen tidak terbaca, alat ini BERHENTI (senyap-hijau adalah kelas kegagalan RD-103).
 *   · "Siap develop" tingkat SISTEM tidak dinyatakan di sini: gerbang global `DEV-G1…G7` menahan
 *     SEMUA modul (penegakan 3 lapis = 0 pemanggilan produksi; 7 dari 81 migrasi; 0 tes menyentuh
 *     DB; 0 dari 24 gerbang CI tertanam). Koloninya menyatakan kesiapan SPESIFIKASI modul.
 *
 * Aturan status (dieksekusi, bukan dideklarasikan di dokumen lain):
 *   BELUM  bila modul punya salah satu dari:
 *     (1) verba wajib belum ber-rute (vonis `crud-matrix`), (2) nol izin BER-NOMOR yang terpetakan
 *     (grant tidak bisa ditulis), (3) nol baris menu di `RBAC §6`, (4) nol rujukan layar di `UI_UX`,
 *     (5) nol rujukan seed di `SEED_DATA`, (6) klaim ≥1 FR di registri tetapi TIDAK ada satu pun
 *     yang dikutip sebuah acceptance criteria (`fr-ac-gap`) — tanpa AC tidak ada definisi selesai.
 *   CATATAN yang tidak mengubah vonis: nol tabel berlabel modul (`PRV-4` — objek boleh hidup di
 *   heading tematik), rute tanpa handler, izin yang hanya terpetakan lewat partisi SKU, dan modul
 *   yang registri kebutuhannya menulis rujukan § dan bukan ID FR (tidak terukur, bukan kurang).
 *   SIAP-SPESIFIKASI bila keenam penahan nol — dan tetap tertahan gerbang global.
 *
 * Penggunaan: node .tools/module-readiness.mjs [--json|--summary] [--only=M-13,M-19]
 */
import { execFileSync as run } from 'node:child_process';
import { readFileSync } from 'node:fs';

const NL = String.fromCharCode(10);
const argv = process.argv.slice(2);
const JSON_MODE = argv.includes('--json');
const SUMMARY = argv.includes('--summary');
const only = (argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];

const exec = (f, extra = []) => run(process.execPath, [f, ...extra], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/* Token modul yang AMAN batas. `M-\d\d` polos terbukti salah: "FR-CRM-01" dan "FR-KBM-01"
   memuat deretan huruf yang sama, sehingga M-01 tampak punya 4 izin ber-nomor padahal keempat
   baris itu milik M-45 dan M-24. Lookbehind menolak huruf/angka sebelum token; lookahead menolak
   "M-012". Kelas kegagalan yang sama dengan RD-98 (slug menu dihitung sebagai kode izin) — ini
   keempat kalinya cacatnya di alat saya, bukan di dokumen. */
const modToks = (s) => [...(String(s).match(/(?<![A-Za-z0-9])M-\d\d(?![0-9])/g) || [])];

/* ---------- 1. milik crud-matrix: atribusi rute, verba, vonis ---------- */
const cm = JSON.parse(exec('.tools/crud-matrix.mjs', ['--json']));
if (!cm.rows || cm.rows.length !== 48) {
  console.error('MERAH — crud-matrix mengembalikan ' + ((cm.rows || []).length) + ' baris, diharapkan 48. Penggabungan dihentikan.');
  process.exit(1);
}
const byId = new Map(cm.rows.map((r) => [r.id, r]));

/* ---------- 2. milik module-provenance: ketertelusuran dokumen ---------- */
const prov = exec('.tools/module-provenance.mjs');
const pv = new Map();
for (const l of prov.split(NL)) {
  const c = l.split('|').map((s) => s.trim());
  if (c.length < 13 || !/^(M-\d\d|APP)$/.test(c[1])) continue;
  pv.set(c[1], { sevima: c[4], regulasi: c[5], ddl: Number(c[6]) || 0, rute: Number(c[7]) || 0, vonis: c[8], izin: Number(c[9]) || 0, layar: Number(c[10]) || 0, seed: Number(c[11]) || 0, lubang: c[12] });
}
if (pv.size !== 48) { console.error('MERAH — module-provenance mencetak ' + pv.size + ' baris modul, diharapkan 48.'); process.exit(1); }

/* ---------- 3. milik handler-inventory: handler nyata ---------- */
const handlers = JSON.parse(exec('.tools/handler-inventory.mjs', ['--json']));
/* Pemilik ukuran FR→AC: `.tools/fr-ac-gap.mjs`. Alat itu berhenti sendiri kalau known-answer-nya
   gagal, jadi angka yang saya pakai di sini sudah lolos pemeriksaan; kalau ia mati, saya ikut mati
   (bukan jatuh ke vonis "siap" tanpa ukuran). */
let acGap = new Map();
{
  const raw = exec('.tools/fr-ac-gap.mjs', ['--json']);
  const j = JSON.parse(raw.slice(raw.indexOf('{')));
  for (const r of j.rows) acGap.set(r.id, r);
}
const normHandler = (p) => '/' + p
  .replace(/^apps\/web\/src\/app\/api\/v1\//, '')
  .replace(/\/route\.ts$/, '')
  .replace(/\[([^\]]+)\]/g, ':$1')
  .replace(/^\//, '');
const hSet = new Map(handlers.map((h) => [normHandler(h.path), h.cls]));
const ORDER = { DB: 0, DB_MOCK: 1, MOCK: 2, UNPROVEN: 3 };
/* Bentuk kanonik path spesifikasi HARUS sama dengan bentuk kanonik handler (`normHandler` selalu
   memberi awalan `/`). Versi pertama menghasilkan `academic/krs/submit` tanpa `/` sehingga NOL cocok,
   dan kesalahan itu tertutupi oleh cacat lain: selama rekap `API_SPEC §5` (jalur tanpa prefiks
   `/api/v1`) ikut dipindai `crud-matrix`, jalur itulah yang kebetulan cocok. Setelah §5 dibuang
   (`RD-108`) kebohongan ini muncul sebagai "0 dari 25 rute punya handler" — padahal `/auth/login`
   nyata ada di disk. known-answer di bawah menolak keadaan senyap-hijau itu. */
const normSpec = (p) => '/' + p.replace(/\?.*$/, '').replace(/^\/api\/v1\//, '/').split('/').filter(Boolean).join('/');

/* ---------- 4. RBAC: partisi entitlement→modul, resource→modul, menu §6 + §6.5, izin §4.5/§4.5.6 ---------- */
const rb = readFileSync('docs/RBAC_MATRIX.md', 'utf8').split(NL);
const part = new Map();       // entitlement/SKU -> Set(M-xx)   (partisi §4.5.1 — kasar: satu SKU membawa banyak modul)
const res2mods = new Map();   // suku pertama kode izin (resource) -> Set(M-xx)  — atribusi HALUS dari baris katalog itu sendiri
const route2mods = new Map(); // path rute -> Set(M-xx)  — dari keluaran crud-matrix (pemilik atribusi rute)
{
  let inPart = false;
  for (const l of rb) {
    if (/^#### 4\.5\.1/.test(l)) { inPart = true; continue; }
    if (inPart && /^#### 4\.5\.2/.test(l)) break;
    if (!inPart || !l.startsWith('|')) continue;
    const c = l.split('|').map((s) => s.trim());
    const ent = (c[1] || '').replace(/`/g, '').replace(/^\([^)]*\)\s*/, '').replace(/\s*\(.*$/, '').replace(/\s*—.*$/, '').trim();
    if (!/^[a-z_]+$/.test(ent)) continue;
    const mods = modToks(c[2] || '');
    if (!mods.length) continue;
    if (!part.has(ent)) part.set(ent, new Set());
    for (const m of mods) part.get(ent).add(m);
  }
}
for (const r of cm.rows) for (const rt of r.routes) {
  const p = rt.split(' ')[1];
  if (!route2mods.has(p)) route2mods.set(p, new Set());
  route2mods.get(p).add(r.id);
}
const addRes = (code, mods) => {
  const seg = (code || '').split('.')[0];
  if (!/^[a-z_0-9]+$/.test(seg) || !mods.length) return;
  if (!res2mods.has(seg)) res2mods.set(seg, new Set());
  for (const m of mods) res2mods.get(seg).add(m);
};
if (!part.size) { console.error('MERAH — tabel partisi `RBAC §4.5.1` tidak terbaca; pemetaan menu/izin ke modul mustahil tanpa itu.'); process.exit(1); }

/* Pass 1 — katalog izin: hitung ber-nomor vs usulan per modul DAN bangun peta resource→modul.
   Atribusi HALUS: token M-xx yang memang tertulis pada baris yang sama (kolom FR/kepemilikan pada
   baris bernomor, kolom "Rute yang mengutip" pada §4.5.6). Kalau barisnya tidak membawa token,
   baru jatuh ke partisi SKU — dan itu dicatat sebagai fallback, bukan disamakan dengan bukti. */
const numIzin = new Map(), usulanIzin = new Map(), numEksplisit = new Map();
const usulanDaftar = new Map();  // M-xx -> Set(kode usulan) — dipakai known-answer negatif, bukan untuk dicetak
const daftar = (mp, id, v) => { if (!mp.has(id)) mp.set(id, new Set()); mp.get(id).add(v); };
const bump = (mp, id) => mp.set(id, (mp.get(id) || 0) + 1);
let fallbackBaris = 0;
let usulanDitolak = 0;
let barisBernomor = 0;
{
  let in456 = false;
  for (const l of rb) {
    if (/^#### 4\.5\.6/.test(l)) { in456 = true; continue; }
    if (in456 && /^(###|####|##)\s/.test(l) && !/^#### 4\.5\.6/.test(l)) in456 = false;
    if (!l.startsWith('|')) continue;
    const c = l.split('|').map((s) => s.trim());
    /* Predikat baris katalog BER-NOMOR disamakan dengan milik `rbac-count.mjs` (pemilik angka 301):
       nomor | `kode.dots` | `modul` | … | `VERBA` |. Versi saya sebelumnya cukup "sel pertama angka"
       sehingga 23 baris tabel lain (register/peran/matriks) ikut terhitung — known-answer
       "301" menangkapnya sebelum angkanya keluar. */
    const cat = l.match(/^\|\s*(\d+)\s*\|\s*`([a-z_]+(?:\.[a-z_0-9]+)+)`\s*\|\s*`?([a-z_]+)`?\s*\|[^|]*\|\s*`?([A-Z]+)`?\s*\|/);
    const numbered = !!cat;
    if (numbered) barisBernomor++;
    const usulanRow = in456 && !numbered && /^`[a-z_0-9.]+`$/.test(c[1] || '');
    if (!numbered && !usulanRow) continue;
    const code = numbered ? cat[2] : c[1].replace(/`/g, '');
    /* Baris usulan yang RUANG NAMANYA DITOLAK bukan usulan: ia catatan penarikan. Sebelum aturan ini
       ada, anotasi saya sendiri ("ruang namanya DITOLAK: impor data master adalah pekerjaan M-02,
       sudah dipromosikan sebagai `master.import.commit (320)`") membuat `platform` terpetakan ke M-02
       dan lima menu M-01 (`Platform → Paket & Modul`, `Provisioning Tenant`, `Kuota & Flag`,
       `Statistik Agregat`, `Break-Glass`) tercetak sebagai menu M-02 — tuduhan palsu kelas `RD-91`
       yang kali ini bersumber dari teks yang saya tulis sendiri. Known-answer negatif di bawah
       menjaganya tidak kembali. */
    if (usulanRow && /DITOLAK/.test(c.join(' '))) { usulanDitolak++; continue; }
    const skuFromCatalog = numbered ? cat[3] : '';
    const joined = c.join(' ');
    let mods = modToks(joined);
    const lewatToken = mods.length > 0;
    if (!mods.length) {
      // Dua denah baris katalog: gelombang 4/5 menaruh `FR-… · M-xx` pada kolom kepemilikan,
      // sedangkan katalog gelombang 1–3 (baris 1–161) TIDAK memuat token M-xx sama sekali.
      // Untuk yang kedua, atribusi yang sah adalah SKU pada kolom `Modul` (posisinya sama di
      // kedua denah) → partisi §4.5.1. Versi pertama alat ini mengambil sel kode (c[2]) sebagai
      // SKU sehingga fallback tidak pernah kena dan M-13 dituduh "nol izin ber-nomor" — padahal
      // baris 15/16/63/64 miliknya ada. tuduhan palsu kelas RD-91, dan ia tertangkap karena
      // known-answer: `enrollment.krs.submit` wajib menghasilkan M-13.
      const cand = [skuFromCatalog, (c[3] || ''), (c[4] || '')].map((s) => String(s).replace(/`/g, '').trim());
      /* Untuk baris usulan §4.5.6, resource yang tertera PADA KODE-NYA SENDIRI didahulukan dari sel
         Entitlement (§4.5.6 tidak punya kolom `Modul`; sel Entitlement-nya dibatasi ke 13 nilai
         `PermissionModule` — `G-29`). Sebelum aturan ini, enam belas baris `helpdesk.*` yang ber-
         Entitlement sah `settings` jatuh ke partisi `(bukan SKU) settings` milik M-02, dan satu di
         antaranya (yang tidak menulis token modul) tercatat sebagai usulan M-02 — `RD-115`. Yang
         salah adalah urutan bukti, bukan sel dokumennya; saya sempat membetulkan selnya dan penjaga
         `perm-usulan-audit` menolak, karena `helpdesk` memang bukan nilai yang sah. */
      if (usulanRow) {
        const seg = code.split('.')[0];
        if (part.has(seg)) { mods = [...part.get(seg)]; fallbackBaris++; }
      }
      if (!mods.length) for (const ent of cand) { if (part.has(ent)) { mods = [...part.get(ent)]; break; } }
      if (mods.length && !usulanRow) fallbackBaris++;
    }
    addRes(code, mods);
    for (const m of new Set(mods)) {
      bump(numbered ? numIzin : usulanIzin, m);
      if (!numbered) daftar(usulanDaftar, m, code);
      if (numbered && lewatToken) bump(numEksplisit, m);
    }
  }
}

/* Pass 2 — menu. Dua rumah yang berbeda bentuk:
   §6.1–§6.4 = Role | Modul | Menu | Aksi | Permission | Deskripsi  → atribusi lewat resource izin
   §6.5      = Kelompok | Rute | Modul | Pemilik tulis | ...          → atribusi lewat rute, dan rute
   itu dipetakan ke modul memakai keluaran `crud-matrix` (pemilik atribusi rute), bukan tebakan baru. */
const menus = new Map();
const menuPresisi = new Map();  // M-xx -> Set('resource'|'rute'|'SKU')
let menuBaris = 0, menuTakTerpetakan = 0;
const pushMenu = (m, teks, presisi) => {
  if (!menus.has(m)) { menus.set(m, new Set()); menuPresisi.set(m, new Set()); }
  menus.get(m).add(teks);
  menuPresisi.get(m).add(presisi);
};
{
  let in6 = false;
  for (const l of rb) {
    if (/^## 6\./.test(l)) { in6 = true; continue; }
    if (in6 && /^## [0-9]/.test(l)) break;
    if (!in6 || !l.startsWith('|')) continue;
    const c = l.split('|').map((s) => s.trim());
    if (c.length < 6) continue;
    const role = (c[1] || '').replace(/`/g, '').replace(/[🟡🔵🟢🧩]/g, '').trim();
    const isRoleRow = /^[A-Z_]{3,}$/.test(role);
    const isGroupRow = /^[A-Z]\.\s/.test(c[1] || '');
    if (isRoleRow) {
      const menu = c[3]; const aksi = c[4]; const perms = c[5] || '';
      if (!menu || menu === 'Menu' || /^-+$/.test(menu)) continue;
      menuBaris++;
      const teks = menu + (aksi ? ' [' + aksi + ']' : '');
      // Tiga tingkat atribusi, dan keduanya dicetak supaya pembaca tahu mana yang bukti langsung:
      //   eksplisit = baris menu itu sendiri menulis token modul (tulen, dari penulis matriks);
      //   resource  = suku pertama kode izin, dipetakan lewat baris katalog yang menyebut M-xx;
      //   SKU       = partisi entitlement→modul §4.5.1 (kasar: satu SKU membawa banyak modul).
      const ekspl = new Set(modToks(l));
      const res = [...perms.matchAll(/`([a-z_0-9]+)\.[a-z_.]+`/g)].map((x) => x[1]);
      const halus = new Set(res.flatMap((r) => [...(res2mods.get(r) || [])]));
      const ent = (c[2] || '').replace(/`/g, '').split(' ')[0];
      const kasar = part.get(ent) || new Set();
      if (!ekspl.size && !halus.size && !kasar.size) { menuTakTerpetakan++; continue; }
      /* PRIORITAS EKSKLUSIF (siklus M-03, 2026-10-22). Versi lama MENGGABUNG eksplisit+resource+SKU
         sehingga satu baris menu berlabel `identity · M-09` (Akun Pendaftar PMB) tetap diwariskan ke
         M-03 karena izinnya `identity.user.create`, dan baris DSAR berlabel `audit · M-05` ikut jatuh
         ke M-03 lewat resource `audit` yang dipetakan M-05+M-31+M-37. Itu membuat menu orang lain
         tercetak sebagai milik modul yang dikaji (kelas `RD-117`). Sekarang satu baris satu sumber:
         token M-xx pada baris (bukti penulis) > resource izin > partisi SKU. */
      if (ekspl.size) for (const m of ekspl) pushMenu(m, teks, 'eksplisit');
      else if (halus.size) for (const m of halus) pushMenu(m, teks, 'resource');
      else for (const m of kasar) pushMenu(m, teks, 'SKU');
    } else if (isGroupRow) {
      menuBaris++;
      const ruteSel = c[2] || ''; const menuGroup = c[1];
      const paths = [...ruteSel.matchAll(/`(\/[^`\s]+)`/g)].map((x) => x[1]);
      /* Batas segmen, bukan substring (`RD-117`). Versi lama memakai `rp.includes(p)` sehingga menu
         `/admin` cocok dengan SETIAP rute `/admin/**` dan mencemari semua modul admin. Menu satu
         segmen juga tidak dipakai sebagai bukti (terlalu luas); ia hanya dihitung sebagai tak
         terpetakan, bukan dibagikan ke tetangga. */
      const normPath = (x) => '/' + String(x).replace(/^\/+/, '').replace(/^api\/v1\//, '').replace(/\/+$/, '').replace(/\{([^}]+)\}/g, ':$1');
      const segs = (x) => x.split('/').filter(Boolean).length;
      const mods = new Set();
      for (const p of paths) {
        const mp = normPath(p);
        if (segs(mp) < 2) continue;
        for (const [rp, mm] of route2mods) {
          const rpn = normPath(rp);
          if (rpn === mp || rpn.startsWith(mp + '/')) for (const x of mm) mods.add(x);
        }
      }
      /* Dua jalur, dan keduanya dicetak dengan namanya. Yang kedua baru dipasang setelah kajian
         pakar M-02 (2026-10-21): §6.5 menulis `Modul` sebagai ruang nama izin (`academic`,
         `settings`) dan sejak siklus ini boleh menambahkan token `M-xx` pemilik titik aksi.
         Sebelum itu, baris `/admin/master/kamus` hanya tersambung ke M-02 kalau ada RUTE API yang
         kebetulan berprefiks sama — sehingga modul dengan 16 tabel dan 43 baris katalog tercetak
         punya "2 menu". Atribusi lewat prefik rute itu rapuh; label eksplisit bukan. */
      const eksplGroup = new Set(modToks(c[3] || ''));
      /* Satu baris satu sumber: label `M-xx` penulis lebih kuat daripada rute; rute hanya dipakai
         bila label tidak ada. Versi lama menggabungkan keduanya sehingga baris berlabel M-03 tetap
         menerima modul lain dari prefix rute yang kebetulan sama. */
      if (eksplGroup.size) { for (const m of eksplGroup) pushMenu(m, menuGroup + ' → ' + (paths[0] || ''), 'eksplisit'); }
      else if (mods.size) { for (const m of mods) pushMenu(m, menuGroup + ' → ' + (paths[0] || ''), 'rute'); }
      else if (ruteSel.trim()) menuTakTerpetakan++;
    }
  }
}

/* Known-answer — penjaga agar fallback SKU tidak menjadi pencucian. Empat hal yang sudah terbukti
   dari dokumen (bukan dari alat ini): M-13 memegang `enrollment.krs.*` (baris 15/16/63/64), M-18
   memegang `attendance.*`, M-10 memegang `finance.*`, M-46 memegang `procurement.*` (baris 191–198
   yang memang menulis token M-46). Penyetop kedua: jumlah baris BER-NOMOR yang terbaca harus sama
   dengan 301 — pemilik angka itu `rbac-count.mjs`, jadi kalau pemindaian saya berbeda, yang salah
   adalah pemindaian ini. Versi pertama alat ini menaruh harapan "M-46 = 0 nomor" di blok ini;
   harapan itu saya sendiri yang bubuhkan, dan grep baris 191–198 membantahnya — contoh bagus bahwa
   known-answer juga harus dibuktikan sebelum dipasang. */
{
  const expect = [['M-13', 1], ['M-18', 1], ['M-10', 1], ['M-46', 1]];
  for (const [id, min] of expect) {
    const n = numIzin.get(id) || 0;
    if (n < min) { console.error('MERAH — known-answer pemetaan izin rusak: ' + id + ' ber-nomor=' + n + ' (minimal ' + min + '). Periksa partisi §4.5.1 dan denah baris katalog.'); process.exit(1); }
  }
  const rc = exec('.tools/rbac-count.mjs');
  /* Known-answer NEGATIF (dipasang 2026-10-21 setelah kebocoran atribusi M-02): resource `platform`
     adalah ruang nama M-01 dan tidak boleh terisi M-02 hanya karena sebuah catatan penarikan
     menyebut modul itu; `settings` sebaliknya memang pemegang M-02. Atribusi yang salah arah
     membuat menu orang lain tercetak sebagai milik modul yang sedang dikaji — itu lebih buruk
     daripada nol, karena ia dibaca sebagai bukti. */
  const kaNeg = [['platform', 'M-02', false], ['platform', 'M-01', true], ['settings', 'M-02', true]];
  for (const [seg, id, boleh] of kaNeg) {
    const ada = (res2mods.get(seg) || new Set()).has(id);
    if (ada !== boleh) { console.error('MERAH — known-answer atribusi resource rusak: `' + seg + '` → ' + id + ' = ' + ada + ' (harusnya ' + boleh + ').'); process.exit(1); }
  }
  /* Known-answer NEGATIF menu (`RD-117`): baris berlabel PEMILIK LAIN tidak boleh tercetak sebagai
     menu modul ini hanya karena resource izinnya dipakai bersama. Kasus nyata: Akun Pendaftar PMB
     (`identity · M-09`) dan DSAR (`audit · M-05`) sempat masuk M-03 lewat union resource. */
  const hasMenu = (id, s) => [...(menus.get(id) || [])].some((t) => t.includes(s));
  const kaMenu = [
    ['M-09', 'Akun Pendaftar', true], ['M-03', 'Akun Pendaftar', false],
    ['M-05', 'Permintaan Subjek Data', true], ['M-03', 'Permintaan Subjek Data', false],
    ['M-03', 'User & Role', true], ['M-03', 'Permintaan Perubahan Hak', true],
    ['M-02', 'Kamus & Referensi', true], ['M-01', 'Provisioning Tenant', true],
    ['M-02', 'Provisioning Tenant', false],
  ];
  for (const [id, s, boleh] of kaMenu) {
    if (hasMenu(id, s) !== boleh) { console.error('MERAH — known-answer atribusi menu rusak: ' + id + ' menu "' + s + '" = ' + hasMenu(id, s) + ' (harusnya ' + boleh + ').'); process.exit(1); }
  }
  /* Known-answer negatif kedua (`RD-115`): enam belas baris usulan `helpdesk.*` pernah menaruh
     `settings` di kolom Entitlement, dan satu di antaranya tidak menulis token modul — fallback
     SKU mengambil partisi `(bukan SKU) settings` milik M-02, sehingga izin M-04 dihitung sebagai
     usulan M-02. Sejak kolom itu dibetulkan menjadi `helpdesk`, daftarnya harus bersih. */
  const usulM02 = [...(usulanDaftar.get('M-02') || [])];
  if (usulM02.some((c) => c.startsWith('helpdesk.'))) { console.error('MERAH — known-answer `RD-115` rusak: usulan M-02 memuat kode helpdesk (' + usulM02.filter((c) => c.startsWith('helpdesk.')).join(', ') + ').'); process.exit(1); }
  if ((usulanDaftar.get('M-04') || new Set()).size < 15) { console.error('MERAH — known-answer `RD-115` rusak: M-04 hanya memegang ' + (usulanDaftar.get('M-04') || new Set()).size + ' nama usulan, seharusnya ≥15 (baris helpdesk §4.5.6).'); process.exit(1); }
  /* Label pemilik berubah 2026-10-22 (`rbac-count`): "seluruh usulan" keliru karena baris 1–161
     tidak punya kolom Status; label yang benar "seluruh baris bernomor". Konsumen harus mengikuti
     pemilik, bukan sebaliknya. */
  const ownerTotal = Number(((rc.match(/seluruh baris bernomor\s+baris=\s*(\d+)/) || [])[1] || 'NaN'));
  if (!Number.isInteger(ownerTotal)) { console.error('MERAH — angka total milik `rbac-count.mjs` tidak terbaca; known-answer tidak boleh diam-diam diloloskan.'); process.exit(1); }
  if (barisBernomor !== ownerTotal) {
    console.error('MERAH — baris katalog ber-nomor yang terbaca = ' + barisBernomor + ', padahal `rbac-count.mjs` memiliki ' + ownerTotal + '. Pemindaian ini yang salah, bukan registry-nya.');
    process.exit(1);
  }
}

/* Pass 3 — "menu disebut di dokumen lain". KEHADIRAN dokumen, bukan bukti fungsional: dipakai supaya
   baris "nol §6" tidak dibaca sebagai "modul tidak punya menu", sama seperti kolom DDL berlabel. */
const DOK_LAIN = ['docs/BLUEPRINT_ROLE_BY_ROLE.md', 'docs/PRD.md', 'docs/UI_UX_DESIGN.md', 'docs/BENCHMARK_SEVIMA.md'];
const dokLines = DOK_LAIN.flatMap((f) => readFileSync(f, 'utf8').split(NL).map((l) => ({ f, l })));
const menuDok = new Map();
for (const r of cm.rows) menuDok.set(r.id, dokLines.filter((x) => modToks(x.l).includes(r.id) && /menu/i.test(x.l)).length);

/* ---------- 5. komposisi + vonis per modul ---------- */
const rows = [];
const cocokHandler = new Set();
for (const r of cm.rows) {
  const p = pv.get(r.id) || {};
  const covered = [];
  const kelas = [];
  for (const rt of r.routes) {
    const [meth, path] = rt.split(' ');
    const n = normSpec(path);
    const cls = hSet.get(n);
    if (cls) { covered.push(meth + ' ' + n); kelas.push(cls); cocokHandler.add(n); }
  }
  /* `--only=` hanya memotong KELUARAN, never pencocokan: known-answer di bawah harus selalu menilai
     alat terhadap seluruh disk, kalau tidak ia akan "gagal" justru saat orang memeriksa satu modul. */
  if (only && !only.split(',').includes(r.id)) continue;
  const best = kelas.length ? kelas.sort((a, b) => ORDER[a] - ORDER[b])[0] : 'NONE';
  const ent = [...part.entries()].filter(([, s]) => s.has(r.id)).map(([e]) => e);
  const menuSet = menus.get(r.id) || new Set();
  const presisi = menuPresisi.get(r.id) || new Set();
  const why = [];
  const catatan = [];
  if (r.miss.length) why.push('verba wajib belum ber-rute: ' + r.miss.join('/'));
  const ekspl = numEksplisit.get(r.id) || 0;
  if (!(numIzin.get(r.id) || 0)) {
    why.push((usulanIzin.get(r.id) || 0)
      ? 'belum ada izin BER-NOMOR yang memetakan modul ini (' + usulanIzin.get(r.id) + ' nama terdaftar sebagai usulan — tanpa nomor, grant tidak bisa ditulis; `CRD-5b`)'
      : 'belum ada satu pun baris katalog (ber-nomor maupun usulan) yang memetakan modul ini');
  } else if (!ekspl) {
    catatan.push('izin ber-nomor modul ini hanya terpetakan lewat partisi SKU, bukan lewat baris katalog yang menulis M-xx (pemetaan eksplisit belum ada)');
  }
  if (!menuSet.size) why.push('nol baris menu di RBAC §6 (matriks peran×menu×aksi belum memuat modul ini; menu disebut di dokumen lain: ' + (menuDok.get(r.id) || 0) + ' baris)');
  if (!p.layar) why.push('nol rujukan layar di UI_UX');
  if (!p.seed) why.push('nol rujukan seed di SEED_DATA');
  /* Penahan ketujuh, dipasang oleh kajian pakar M-02 (2026-10-21). Enam penahan lama mengukur
     objek (rute, izin, menu, layar, seed) tetapi buta terhadap pertanyaan "apakah kebutuhan ini
     bisa diterima/ditolak": FR yang tidak pernah berpasangan dengan satu pun AC tidak punya
     definisi selesai, jadi modulnya TIDAK boleh divonis siap hanya karena objeknya lengkap.
     Pemilik ukurannya `.tools/fr-ac-gap.mjs` (bukan bagian ini) — alat ini hanya memakai
     keluarannya, dan alat itu sendiri berhenti kalau known-answer-nya gagal. */
  const ac = acGap.get(r.id);
  if (ac && ac.frs > 0 && ac.paired === 0) why.push(ac.frs + ' FR registri tidak dikutip satu pun acceptance criteria (tidak ada definisi selesai; pemilik ukuran `fr-ac-gap`)');
  else if (ac && ac.frs > 0) catatan.push('FR ' + ac.paired + '/' + ac.frs + ' dikutip AC (' + (ac.belum.length ? 'belum: ' + ac.belum.join(' ') : 'selengkapnya ber-AC') + '; kopling dibaca dari baris yang memuat keduanya = batas bawah, bukan jaminan kualitas)');
  else if (ac && ac.frs === 0) catatan.push('registri §5.12 menyebut § dokumen, bukan ID FR, untuk modul ini → pemetaan kebutuhan→AC tidak dapat diukur (lubang atribusi, bukan vonis)');
  if (!p.ddl) catatan.push('DDL tanpa label modul (objek boleh hidup di heading tematik — ini lubang ATRIBUSI `PRV-4`, bukan bukti ketiadaan tabel)');
  if (menuSet.size && presisi.has('SKU') && !presisi.has('resource') && !presisi.has('rute')) catatan.push('menu terpetakan lewat SKU, bukan lewat resource/rute (kursif)');
  if (r.routes.length && !covered.length) catatan.push('0 dari ' + r.routes.length + ' rute punya handler di disk');
  const status = why.length ? 'BELUM' : 'SIAP-SPESIFIKASI';
  rows.push({
    id: r.id, nama: r.nama, reg: r.status, ent, menu: [...menuSet], menuN: menuSet.size,
    presisi: [...presisi].join('+') || '—', menuDok: menuDok.get(r.id) || 0,
    C: r.C, R: r.R, U: r.U, D: r.D, V: r.V, tot: r.tot, miss: r.miss, vonis: r.miss.length ? 'KURANG: ' + r.miss.join(',') : 'lengkap',
    rute: r.routes.length, handler: covered.length, handlerKelas: best, ruteRinci: (r.routeList || []),
    izinNum: numIzin.get(r.id) || 0, izinEksplisit: numEksplisit.get(r.id) || 0, izinUsul: usulanIzin.get(r.id) || 0,
    ddl: p.ddl || 0, layar: p.layar || 0, seed: p.seed || 0, regulasi: p.regulasi || '—', lubang: p.lubang || '',
    fr: ac ? ac.frs : 0, frPaired: ac ? ac.paired : 0, frBelum: ac ? ac.belum : [],
    status, why, catatan,
  });
}
if (!rows.length) { console.error('MERAH — tidak ada baris terpasang.'); process.exit(1); }
/* Known-answer pencocokan handler — empat jalur yang PASTI ada di disk (terukur
   `.tools/handler-inventory.mjs`: 18 `route.ts`, di antaranya keempatnya) wajib tersambung ke satu
   baris spesifikasi. Kalau nol, yang rusak adalah normalisasi path alat ini — BUKAN kenyataan kode.
   Cacat ini nyata terjadi di siklus ini dan tidak terlihat selama rekap §5 ikut dipindai (`RD-108`). */
{
  const HARUS = ['/auth/login', '/auth/me', '/tenant/modules', '/academic/krs/submit'];
  const buta = HARUS.filter((p) => !cocokHandler.has(p));
  if (buta.length) {
    console.error('MERAH — known-answer pencocokan handler rusak: ' + buta.join(', ') + ' ada di disk tetapi tidak tersambung ke rute spesifikasi. Kelas RD-108 (alat berhenti melihat tanpa menyatakan buta).');
    process.exit(1);
  }
}

/* ---------- 6. keluaran ---------- */
/* FORMAT LAPORAN BAKU (ditetapkan pemilik produk 2026-10-21): setiap perubahan modul dilaporkan
   dengan kolom yang sama — M · Modul · CRUD · Rute→handler · Menu · Tabel · Izin · Kode · STATUS
   SIAP DEV? · Kurang di mana. `Kode` = kode entitlement/SKU registri (`—` berarti gerbangnya peran,
   vonis PRD §5.12.3); `Tabel` = jumlah `CREATE TABLE` yang heading-nya MENYEBUT modul ini — nol bukan
   berarti tidak ada tabel, tapi tidak dilabeli (lubang atribusi `PRV-4`, dinyatakan di catatan).
   Rincian penuh (semua rute per verba + semua menu) dicetak di bagian "Rincian per modul". */
const R = (x, n) => String(x).slice(0, n);const md = [];
md.push('| M | Modul | CRUD (C·R·U·D·V) | Rute→handler | Menu §6 (jumlah · presisi) | Tabel | Izin (eksplisit/ber-nomor/usulan) | Kode | STATUS SIAP DEV? | Kurang di mana |');
md.push('|---|---|---|---|---|---:|---|---|---|---|');
for (const x of rows) {
  const st = x.status === 'SIAP-SPESIFIKASI' ? '**SPESIFIKASI SIAP** — tertahan gerbang global' : 'TIDAK — ' + x.why.length + ' penahan';
  md.push('| ' + x.id + ' | ' + R(x.nama, 24) + ' | ' + x.C + '·' + x.R + '·' + x.U + '·' + x.D + '·' + x.V
    + ' | ' + x.handler + '/' + x.rute + ' (' + x.handlerKelas + ') | ' + x.menuN + ' (' + x.presisi + ') | ' + x.ddl
    + ' | ' + x.izinEksplisit + ' / ' + x.izinNum + ' / ' + x.izinUsul + ' | ' + (x.ent.join(', ') || '`—` gerbang peran')
    + ' | ' + st + ' | ' + ((x.why.join(' · ') || '—') + (x.catatan.length ? ' ‖ CATATAN: ' + x.catatan.join(' · ') : '')) + ' |');
}
const rincian = [];
rincian.push(NL + '### Rincian per modul — SEMUA CRUD yang tersedia dan SEMUA menu yang dipetakan');
rincian.push('', 'Blok di bawah bukan ringkasan: setiap rute yang ditulis `API_SPEC` untuk modul itu dicetak, dikelompokkan per verba milik `crud-matrix`, dan setiap baris menu `RBAC §6` yang dipetakan ke modul itu ditampilkan penuh. Ini bahan jawab kalau ditanya "CRUD apa saja yang sudah ada di modul X".');
for (const x of rows) {
  const group = { C: [], R: [], U: [], D: [], V: [] };
  for (const rt of x.ruteRinci) (group[rt.v] || (group[rt.v] = [])).push(rt.m + ' ' + rt.p);
  rincian.push('', '**' + x.id + ' · ' + x.nama + '** — status: ' + (x.status === 'SIAP-SPESIFIKASI' ? 'SPESIFIKASI SIAP (tertahan gerbang global)' : 'BELUM (' + x.why.join(' · ') + ')'));
  for (const [k, label] of [['C', 'CREATE'], ['R', 'READ'], ['U', 'UPDATE'], ['D', 'DELETE'], ['V', 'VALIDATE/gerbang']]) {
    const list = group[k] || [];
    rincian.push('- ' + label + ' (' + list.length + '): ' + (list.length ? list.map((p) => '`' + p + '`').join(' · ') : '— belum ada rute verba ini'));
  }
  rincian.push('- Menu `RBAC §6` (' + x.menuN + ', presisi ' + x.presisi + '): ' + (x.menu.length ? x.menu.map((p) => '`' + p + '`').join(' ; ') : '— nol baris menu (jumlah baris dokumen lain yang menyebut modul ini: ' + x.menuDok + ')'));
  rincian.push('- Tabel berlabel modul di `DATA_MODEL`: ' + x.ddl + (x.ddl ? '' : ' ‖ ini LUBANG ATRIBUSI (`PRV-4`), bukan bukti tidak ada tabel — objects dapat hidup di heading tematik'));
  rincian.push('- Izin: ' + x.izinEksplisit + ' baris katalog menulis modul ini · ' + x.izinNum + ' baris ber-nomor terpetakan · ' + x.izinUsul + ' nama usulan tanpa nomor (`CRD-5b`)');
  rincian.push('- FR ↔ AC (ukuran `fr-ac-gap`): ' + (x.fr ? x.frPaired + '/' + x.fr + ' FR dikutip acceptance criteria' + (x.frBelum.length ? ' · belum dikutip: ' + x.frBelum.join(' ') : '') : 'registri §5.12 tidak menyebut ID FR untuk modul ini → pemetaan kebutuhan→AC tidak terukur'));
}
const menuMd = [];
menuMd.push('| M | Modul | Menu yang dipetakan RBAC §6 (peran × menu × aksi) | Menu disebut di dokumen lain (baris) | CRUD yang tersedia di spesifikasi |');
menuMd.push('|---|---|---|---:|---|');
for (const x of rows) {
  const crud = ['C:' + x.C, 'R:' + x.R, 'U:' + x.U, 'D:' + x.D, 'V:' + x.V].join(' ');
  /* Pemotongan dilakukan pada BATAS item menu, bukan pada jumlah karakter: memotong di tengah kata
     ("Platform → Br") membuat pembaca mengira menul habis, padahal daftarnya yang dipangkas. */
  const ambil = (arr, max) => {
    let k = Math.min(arr.length, 8), s = '';
    while (k > 1 && arr.slice(0, k).join(' ; ').length > max) k--;
    s = arr.slice(0, k).join(' ; ');
    if (arr.length > k) s += ' (+' + (arr.length - k) + ' lagi)';
    return s;
  };
  menuMd.push('| ' + x.id + ' | ' + R(x.nama, 24) + ' | ' + (R(ambil(x.menu, 240), 300) || '—') + ' | ' + x.menuDok + ' | ' + crud + (x.miss.length ? ' — KURANG ' + x.miss.join('/') : ' — lengkap') + ' |');
}
const siap = rows.filter((x) => x.status === 'SIAP-SPESIFIKASI');
const tally = {};
for (const x of rows) for (const w of x.why) { const k = w.replace(/:.*/, '').replace(/ \(.*/, ''); tally[k] = (tally[k] || 0) + 1; }
const tallyCat = {};
for (const x of rows) for (const w of x.catatan) { const k = w.replace(/ \(.*/, '').replace(/0 dari.*/, 'rute spesifikasinya belum ada handler-nya'); tallyCat[k] = (tallyCat[k] || 0) + 1; }

if (JSON_MODE) { console.log(JSON.stringify({ rows, ringkas: { modul: rows.length, siapSpesifikasi: siap.length, belum: rows.length - siap.length, barisMenu: menuBaris, takTerpetakan: menuTakTerpetakan, partisi: part.size, resourceTerpeta: res2mods.size, barisIzinLewatSKU: fallbackBaris, tally, tallyCat } }, null, 1)); process.exit(0); }

console.log(md.join(NL));
console.log(NL + '### Peta menu & CRUD per modul');
console.log(menuMd.join(NL));
if (!SUMMARY) console.log(rincian.join(NL));
console.log(NL + '### Ringkas');
console.log('modul = ' + rows.length + ' · SPESIFIKASI SIAP = ' + siap.length + ' (' + (siap.map((x) => x.id).join(', ') || '—') + ') · BELUM = ' + (rows.length - siap.length));
console.log('baris menu §6 = ' + menuBaris + ' · yang tidak berhasil dipetakan ke modul = ' + menuTakTerpetakan
  + ' · resource izin terpetakan = ' + res2mods.size + ' · baris izin yang jatuh ke SKU (bukan token M-xx) = ' + fallbackBaris
  + ' · baris usulan ber-ruang-nama DITOLAK yang dikeluarkan dari atribusi = ' + usulanDitolak);
console.log('kelas handler terbaik per modul: ' + ['DB', 'DB_MOCK', 'MOCK', 'UNPROVEN', 'NONE'].map((k) => k + '=' + rows.filter((x) => x.handlerKelas === k).length).join(' '));
console.log('penahan status (menghitung modul):');
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log('  ' + String(n).padStart(3) + ' · ' + k);
console.log('catatan atribusi (TIDAK mengubah status):');
for (const [k, n] of Object.entries(tallyCat).sort((a, b) => b[1] - a[1])) console.log('  ' + String(n).padStart(3) + ' · ' + k);
if (!SUMMARY) console.log(NL + 'catatan alat: kolom Rute→handler membandingkan path spesifikasi dengan berkas `route.ts` yang NYATA ada (pencocokan persis setelah normalisasi `:id`↔`[id]`); ' +
  'kelas terbaik = kelas handler paling bersih yang dimiliki modul itu (DB = menyentuh lapisan DB tanpa cabang mock). Kolom izin memisahkan BER-NOMOR (bisa di-grant) dari USULAN (nama terdaftar, belum diputus manusia — `CRD-5b`). ' +
  'Angka ini bukan vonis kesiapan sistem: `DEV-G1…G7` menahan semua modul, dan itu pemiliknya `.tools/handler-inventory.mjs` + `.tools/ci-gate-map.mjs`.');
