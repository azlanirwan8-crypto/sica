import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const spec = readFileSync(D + 'API_SPEC.md', 'utf8').split(NL);
const prd = readFileSync(D + 'PRD.md', 'utf8').split(NL);

/* MATRIKS CRUD PER MODUL — PEMILIK VONIS CRUD (satu pertanyaan satu pengukur, `RD-95`).
   Mengapa alat ini perlu: `coverage-47.mjs` hanya menghitung baris `API_SPEC §7` dan tabel
   `DATA_MODEL §22`, sehingga 25 modul dilaporkan "tanpa rute" padahal rutenya hidup di §4
   (KRS, presensi, keuangan, master data, parameter, menu, kanal). itu kelas kesalahan
   `RD-76`: alat yang irisan salah menghasilkan temuan palsu.

   Aturan yang berlaku sejak 2026-10-21 (kajian M-01, `RD-105`/`RD-108`):
     · SUMBER RUTE = §4 + §6 + §7. Blok `## 5. Inventaris Endpoint Lengkap` DILEWATI: ia rekap dari
       rute yang sama, dan memasukkannya menghitung rute dua kali plus menamainya dengan heading
       yang kebetulan mendahuluinya (M-01 pernah tercetak punya 152 rute).
     · ATRIBUSI satu sumber per baris, berurutan: sel `Modul` penulis rute → label heading `(M-14 · M-15)`
       → peta REGION kurasi saya → kamus segmen jalur. Jumlah tiap level dicetak di catatan keandalan,
       termasuk baris yang TIDAK terpetakan (itu tagihan `PRV-3`, bukan angka yang boleh hilang).
     · TUNTUTAN VERBA dibaca dari kolom verba partisi namespace `RBAC §4.5.1` — bukan asumsi CRUD seragam,
       dan bukan pengecualian yang saya karangkan di alat (M-01 pernah dikecualikan dari CREATE di sini). */

const REGION = {
  /* `4.1` hanya otentikasi/sesi = M-03 (dulu M-01 ikut karena wilayah, padahal M-01 tidak menulis
     `/auth/*`; itu kelas `RD-116`: rute tetangga dinobatkan lewat peta wilayah). `4.6` adalah
     payung data master = M-02; subbagian yang pemiliknya lain WAJIB berlabel `(M-xx)` di heading
     (4.6.9 → M-03, 4.6.10 → M-05) dan label heading menang atas peta ini. `4.17` editor pohon menu
     = M-02 (MDP-5); M-03 tidak menulis menu, ia hanya memberi grant lewat `admin.hak-akses`. */
  '4.1': ['M-03'], '4.2': ['M-13', 'M-14', 'M-19', 'M-26'], '4.3': ['M-18'],
  '4.4': ['M-16'], '4.5': ['M-01'], '4.6': ['M-02'],
  '4.7': ['M-10'], '4.8': ['M-09'], '4.9': ['M-30', 'M-35'], '4.10': ['M-10', 'M-11'],
  '4.12': ['M-38', 'M-12'], '4.14': ['M-02'], '4.16': ['M-02'], '4.17': ['M-02'],
  '4.18': ['M-18', 'M-15'], '4.19': ['M-02', 'M-15', 'M-16', 'M-18'],
  '7.1': ['M-04'], '7.2': ['M-06'], '7.3': ['M-08'], '7.4': ['M-11'], '7.5': ['M-21', 'M-22'],
  '7.6': ['M-24'], '7.7': ['M-25'], '7.8': ['M-28'], '7.9': ['M-29'], '7.10': ['M-36'],
  '7.11': ['M-39'], '7.12': ['M-40'], '7.13': ['M-41'], '7.14': ['M-42'], '7.15': ['M-43'],
  '7.16': ['M-44'], '7.17': ['M-45'], '7.18': ['M-46'], '7.19': ['M-47'], '7.20': ['M-35'],
  '7.21': ['M-16', 'M-17'],
};

/* Token modul yang AMAN batas dan AMAN konteks: hanya diambil dari **tanda kurung label** yang isinya
   seluruhnya daftar `M-xx` (contoh rumah: `### 4.19 Kanal vicon terkelola — ... (M-02 · M-15 · M-16 · M-18)`).
   Menebak dari seluruh teks heading salah arah: sub-heading `#### 4.2.11 ... (M-13, bandingkan M-18)`
   akan menyeret rute ke M-18 hanya karena menyebutnya. `M-\d\d` polos juga salah: "FR-CRM-01" memuat
   deretan yang sama (`RD-104`). */
const parenMods = (s) => {
  const out = [];
  for (const m of String(s).matchAll(/\(([^()]*)\)/g)) {
    const isi = m[1].trim();
    if (/^M-\d\d(?:\s*[·,\/\-]\s*M-\d\d)*$/.test(isi.replace(/\s+/g, ' '))) out.push(...modToks(isi));
  }
  return [...new Set(out)];
};

/* irisan wilayah = sampai heading `### 4.x`/`### 7.x` berikutnya */
const headIdx = spec.map((l, i) => (/^### (4|7)\.\d+/.test(l) ? i : -1)).filter((i) => i >= 0);
/* IRISAN UNTUK TOKEN = heading bernomor APAPUN (`### 6.2`, `#### 4.19.1`, ...), bukan hanya §4/§7.
   Versi ini sempat memakai `headIdx` untuk keduanya, sehingga seluruh blok `## 6` (engine) dan
   bagian lain mewarisi heading §4 TERAKHIR — M-01 tercetak memiliki 96 rute padahal §4.20 hanya
   17 barisnya. Kelas cacat yang sama seperti `RD-108`: atribusi jatuh ke tetangga yang kebetulan. */
const tokIdx = spec.map((l, i) => (/^#{3,6}\s+\d+\.\d+/.test(l) ? i : -1)).filter((i) => i >= 0);

/* Peta SEGMENT→modul berdasarkan bukti: segmen ini memang tercetak sebagai jalur di
   API_SPEC (dipindai, bukan dikarang). Wilayah §4/§7 tetap dipakai bila menyebut M-xx. */
const SEGMENT = {
  helpdesk: 'M-04', hr: 'M-06', hris: 'M-06', sister: 'M-08', pddikti: 'M-34', feeder: 'M-34',
  scholarship: 'M-11', beasiswa: 'M-11', research: 'M-44', lppm: 'M-44', publication: 'M-21',
  journal: 'M-21', ipr: 'M-22', haki: 'M-22', 'student-affairs': 'M-24', skkm: 'M-24',
  fieldwork: 'M-25', kkn: 'M-25', pkl: 'M-25', career: 'M-28', vacancy: 'M-28',
  mobility: 'M-29', kui: 'M-29', ppks: 'M-36', library: 'M-39', asset: 'M-40',
  clinic: 'M-41', residence: 'M-42', dormitory: 'M-42', canteen: 'M-42', events: 'M-43',
  humas: 'M-43', procurement: 'M-46', pbj: 'M-46', endowment: 'M-47', crm: 'M-45',
  mbkm: 'M-38', thesis: 'M-20', rama: 'M-20', graduation: 'M-23', wisuda: 'M-23',
  yudisium: 'M-30', skpi: 'M-30', diploma: 'M-30', legalisation: 'M-30', sivil: 'M-35',
  tracer: 'M-27', alumni: 'M-27', lkps: 'M-31', accreditation: 'M-31', iku: 'M-32',
  quality: 'M-37', spmi: 'M-37', audit: 'M-05', security: 'M-05', mfa: 'M-05',
  bkd: 'M-07', attendance: 'M-18', krs: 'M-13', enrollment: 'M-13', timetable: 'M-14',
  schedule: 'M-14', classroom: 'M-14', grading: 'M-19', grade: 'M-19', khs: 'M-19',
  transcript: 'M-19', curriculum: 'M-12', obe: 'M-12', cpl: 'M-12', finance: 'M-10',
  invoice: 'M-10', payment: 'M-10', tariff: 'M-10', lms: 'M-16', exam: 'M-17',
  proctoring: 'M-17', pmb: 'M-09', application: 'M-09', nim: 'M-09', master: 'M-02',
  settings: 'M-02', parameters: 'M-02', menu: 'M-02', conference: 'M-16', 'academic': 'M-13',
};

/* Token modul berbatas: `M-\d\d` polos cocok di dalam "FR-CRM-01"/"FR-KBM-01" dan pernah
   membuat M-01 memiliki izin yang bukan miliknya (`RD-104`). Lookbehind menolak huruf/angka di
   depan, lookahead menolak "M-012". */
const modToks = (s) => [...(String(s).match(/(?<![A-Za-z0-9])M-\d\d(?![0-9])/g) || [])];
const attrib = {};
const izinBeda = new Map();

const perModul = new Map();
/* Peta resource → modul, dibangun dari KATALOG RBAC §4.5 (baris yang kolom kebutuhannya menulis
   `M-xx`) dan dari partisi §4.5.1. Ini level atribusi baru (`RD-110`): baris rute di `API_SPEC`
   hampir selalu menyebut kode izinnya (`settings.conference.view`, `teaching.session.manage`), dan
   kode itu punya pemilik yang tercatat di katalog. Selama ini alat saya melewatkan bukti itu dan
   jatuh ke label heading — sehingga SEMUA rute §4.19 (9 baris) diwariskan ke keempat modul yang
   disebut heading `(M-02 · M-15 · M-16 · M-18)`, termasuk provisioning kanal yang pemiliknya
   `teaching.*` (M-15/M-16) dan penarikan bukti yang pemiliknya `attendance.*` (M-18). M-02
   tercetak punya rute yang tidak dia tulis. */
const resMap = new Map();
{
  const rb = readFileSync(D + 'RBAC_MATRIX.md', 'utf8').split(NL);
  for (const l of rb) {
    const m = l.match(/^\|\s*(\d{1,3})\s*\|\s*`([a-z_][a-z0-9_.]*)`\s*\|/);
    if (!m) continue;
    const mods = modToks(l);
    if (!mods.length) continue;
    const res = m[2].split('.')[0];
    if (!resMap.has(res)) resMap.set(res, new Set());
    for (const x of mods) resMap.get(res).add(x);
  }
}
const bump = (m, k) => {
  if (!perModul.has(m)) perModul.set(m, { C: 0, R: 0, U: 0, D: 0, V: 0, rute: [], ruteObj: [] });
  perModul.get(m)[k]++;
};
const seen = new Set();
/* `## 5. Inventaris Endpoint Lengkap` adalah REKAP dari rute yang sudah ditulis di §4/§6/§7 — kolomnya
   `Metode | Rute | Status | § | Catatan`, dan path-nya tidak berprefiks `/api/v1`. Versi lama memindai
   seluruh berkas tanpa memisahkan rekap ini, sehingga (a) jumlah rute tiap modul TERHITUNG DOBEL dan
   (b) baris rekap diwarisi heading `### 4.x/7.x` TERAKHIR yang kebetulan berada di depannya — M-01 sempat
   tercetak memiliki 152 rute padahal §4.20 hanya 17 (`RD-108`). Sekarang blok `## 5.` sengaja
   dilewati; jumlah baris yang dilewati dicetak supaya bisa dibantah. */
const skipRange = (() => {
  const s = spec.findIndex((l) => /^## 5\.\s/.test(l));
  if (s < 0) return [-1, -1];
  let e = spec.length;
  for (let i = s + 1; i < spec.length; i++) if (/^## /.test(spec[i])) { e = i; break; }
  return [s, e];
})();
let skipRekap = 0;
/* Batas kedua yang baru dipasang siklus ini (`RD-109`): hanya bagian yang MEMANG mendefinisikan
   endpoint yang boleh dipindai — `## 4`, `## 6`, `## 7`. `## 1` (Header wajib), `## 2` (amplop
   respons) dan `## 3` (skema Zod global) berisi CONTOH pemanggilan, bukan rute. Selama pemindaian
   global, contoh `GET /api/v1/master/lookups?group=…` di §1.1 dan §2.4 ikut menjadi rute dan
   dinamai oleh SEGMENT (`menu`/`settings`/`master` → M-02), sehingga M-02 tercetak memiliki
   `/me/menu` dan `/settings/effective` "dari §1.1". Jumlah baris contoh yang dibuang dicetak,
   supaya klaim ini bisa dibantah dengan angka, bukan dengan opini. */
const ENDPOINT_SECTIONS = new Set(['4', '6', '7']);
const inEndpoint = (() => {
  const flag = new Array(spec.length).fill(false);
  let cur = null;
  for (let i = 0; i < spec.length; i++) {
    const m = spec[i].match(/^## (\d+)\./);
    if (m) cur = m[1];
    flag[i] = cur !== null && ENDPOINT_SECTIONS.has(cur);
  }
  return flag;
})();
let skipKonvensi = 0;
let skipGabung = 0;
let normUuid = 0;
let normQuery = 0;
/* Pemindaian GLOBAL: setiap baris yang memuat `METHOD /jalur` di seluruh API_SPEC,
   atribu modulnya dari segmen jalur (bukti), dengan fallback ke peta wilayah §4/§7. */
for (let i = 0; i < spec.length; i++) {
  const l = spec[i];
  if (i >= skipRange[0] && i < skipRange[1]) { if (/^\|\s*(GET|POST|PUT|PATCH|DELETE|WS)\s*\|/.test(l)) skipRekap++; continue; }
  if (!inEndpoint[i]) { if (/(GET|POST|PUT|PATCH|DELETE)\s+\/\S/.test(l)) skipKonvensi++; continue; }
  let m = l.match(/^#{4}\s[\d.]+\s+(GET|POST|PUT|PATCH|DELETE)\s+`?(\/[^\s`]+)/) ||
          l.match(/(?:^|\|)\s*(GET|POST|PUT|PATCH|DELETE)\s*\|?\s*`?(\/[\w\/_.:{}-]+)/) ||
          l.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)/);
  if (!m) {
    /* Baris gabungan `| GET · POST | …` dulu LOLOS tanpa jejak (`RD-119`): M-04 terukur 10 rute
       padahal §7.1 memuat 26. Parser tidak mengekspansi sendiri — rute harus dipecah di dokumen —
       tetapi jumlah baris yang dibuang WAJIB tercetak supaya angka CRUD terbaca sebagai batas bawah
       yang terukur, bukan vonis yang benar. */
    if (/^\|\s*(?:GET|POST|PUT|PATCH|DELETE)(?:\s*[·,\/]\s*(?:GET|POST|PUT|PATCH|DELETE))+\s*\|/.test(l)) skipGabung++;
    continue;
  }
  const meth = m[1].toUpperCase();
  let path = m[2];
  if (!path.startsWith('/')) path = '/' + path;
  /* Path contoh memakai UUID literal (`/admin/tuition-tariff-matrix/0196e2b7-…/approve`). Itu
     bukan rute: ia adalah nilai `{id}` di dalam contoh. Segmen UUID dinormalisasi ke `{id}` supaya
     tidak dihitung sebagai rute kedua, dan query string dibuang karena bukan bagian dari identitas
     rute. Keduanya dicatat di catatan #7, bukan dilakukan diam-diam. */
  if (/\?/.test(path)) { normQuery++; path = path.replace(/\?.*$/, ''); }
  const uuidSeg = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/i;
  if (uuidSeg.test(path)) { normUuid++; path = path.replace(new RegExp(uuidSeg.source, 'gi'), '/{id}'); }
  const segs = path.replace(/^\/api\/v1/, '').split('/').filter(Boolean);
  const mods = new Set();
  // Atribusi UTAMA = kolom `Modul` yang memang ditulis penulis rute (mis. `M-05·M-31·M-32`). Ini bukan
  // tebakan: `ROADMAP §2.25 PRV-3` justru meminta label eksplisit itu supaya peta kurasi manusia bisa
  // dihapus. Versi lama hanya menebak dari segmen jalur, sehingga `GET /admin/audit-events/:id` tidak
  // terbaca sebagai READ untuk M-05 (`audit-events` != `audit`) dan `GET /quality/...` salah rumah ke
  // M-37. Kelas kesalahan yang sama seperti `RD-76`/`RD-95`: alat menebak padahal dokumen sudah menjawab.
  if (l.startsWith('|')) {
    for (const cell of l.split('|')) {
      const t = cell.trim();
      if (/^M-\d\d(?:[·,\/]\s*M-\d\d)*$/.test(t)) for (const x of modToks(t)) mods.add(x);
    }
  }
  /* RANTAI PRIORITAS (satu baris rute satu sumber atribusi, bukan gabungan — `RD-108`).
     Versi lama mengumpulkan semua level sekaligus, jadi satu baris §7 yang sudah menulis `M-05·M-31·M-32`
     di kolom Modul tetap menerima seluruh isi peta wilayah heading-nya. Sekarang:
       1. sel `Modul` yang ditulis penulis rute  → bukti terkuat, tidak ditimpa apa pun
       2. label modul pada heading induk, bentuk `(M-14 · M-15)` → keputusan dokumen
       3. peta wilayah REGION kurasi saya         → fallback, jumlah pemakainya dicetak
       4. kamus SEGMENT (tebakan nama segmen)     → fallback terakhir, juga dicetak */
  const h = [...tokIdx].reverse().find((x) => x <= i);
  const headLine = h !== undefined ? spec[h] : '';
  const headMods = parenMods(headLine);
  const hr = [...headIdx].reverse().find((x) => x <= i);
  const key = hr !== undefined ? (spec[hr].match(/^### ([47]\.\d+)/) || [])[1] : undefined;
  let asal = 'tidak-terpetakan';
  /* Level 2 baru (`RD-110`) dipakai sebagai PEMERIKSA SILANG, bukan sebagai sumber atribusi — dan
     itu keputusan, bukan kemalasan. Diukur dulu: ketika kolom `Izin` dijadikan atribusi, M-18
     kehilangan 7 rute dan M-15/M-16 kehilangan UPDATE/DELETE-nya — BUKAN karena rutenya hilang,
     tetapi karena katalog saya sendiri belum melabeli cukup baris `teaching.*`/`attendance.*` ke
     pemiliknya. Alat yang menghukum modul karena pelabelan saya yang tipis adalah kelas cacat
     `RD-104`: tuduhan palsu yang lahir dari scanner. Yang dilakukan sekarang: hitung selisihnya
     dan cetak, supaya pelabelan yang kurang menjadi kerja terukur, bukan vonis yang salah. */
  const fromIzin = new Set();
  if (l.startsWith('|')) {
    for (const cell of l.split('|')) {
      const t = cell.trim().replace(/`/g, '');
      const mm = t.match(/^([a-z_][a-z0-9_]*)\.[a-z0-9_.]+$/);
      if (!mm) continue;
      for (const x of (resMap.get(mm[1]) || [])) fromIzin.add(x);
    }
  }
  if (mods.size) asal = 'sel';
  else if (headMods.length) { for (const x of headMods) mods.add(x); asal = 'label-heading'; }
  else if (key && REGION[key]) { for (const x of REGION[key]) mods.add(x); asal = 'peta-kurasi'; }
  else {
    for (const sg of segs) { const mm = SEGMENT[sg.toLowerCase()]; if (mm) { mods.add(mm); asal = 'tebakan-segmen'; break; } }
  }
  if (fromIzin.size && mods.size && [...fromIzin].some((x) => !mods.has(x))) {
    const p = path.replace(/^\/api\/v1/, '').replace(/\?.*$/, '');
    if (!izinBeda.has(p)) izinBeda.set(p, { mod: [...mods].sort().join(','), izin: [...fromIzin].sort().join(','), head: headMods.join(',') || '—' });
  }
  attrib[asal] = (attrib[asal] || 0) + 1;
  if (!mods.size) continue;
  const verb = meth === 'GET' ? 'R' : meth === 'DELETE' ? 'D' : meth === 'PUT' || meth === 'PATCH' ? 'U'
    : (/(approve|decision|validate|lock|unlock|publish|release|grant|reconcile|verify|announce|convert|settle|close|confirm|reject|decide)/i.test(path) ? 'V' : 'C');
  for (const mod of mods) {
    const k = mod + '|' + meth + '|' + path.replace(/^\/api\/v1/, '').replace(/\?.*$/, '').replace(/\/+$/, '');
    if (seen.has(k)) continue;
    seen.add(k);
    bump(mod, verb);
    perModul.get(mod).rute.push(meth + ' ' + path);
    perModul.get(mod).ruteObj.push({ m: meth, p: path.replace(/^\/api\/v1/, ''), v: verb });
  }
}

/* Known-answer pemindaian (`RD-109`) — dipasang karena kelas cacatnya sudah berulang: alat yang
   mencetak angka tanpa satu pun pernyataan yang pasti-salah-kalau-scanner-nya-rusak. Kalau salah
   satu gagal, alat berhenti dan TIDAK ada matriks yang dicetak. */
const punya = (mod, re) => (perModul.get(mod)?.rute || []).some((x) => re.test(x.replace(/\s+\/api\/v1/, ' ')));
const KA = [
  ['M-02 wajib punya GET /admin/master/lookups', () => punya('M-02', /^GET \/admin\/master\/lookups$/)],
  ['M-02 wajib punya PUT /admin/system-parameters', () => punya('M-02', /\/admin\/system-parameters/)],
  ['M-01 wajib punya GET /tenant/modules', () => punya('M-01', /^GET \/tenant\/modules$/)],
  ['M-02 TIDAK boleh mewarisi /tenant/modules (itu entitlement M-01)', () => !perModul.has('M-02') || !punya('M-02', /\/tenant\/modules/)],
  /* Siklus M-03 (`RD-116`/`RD-117`): peta wilayah lama memberi M-01 rute `/auth/*` dan memberi
     M-03 seluruh §4.6 (termasuk tarif, impor, kamus). Known-answer ini memaku batas pemilik. */
  ['M-03 wajib punya POST /auth/login (otentikasi = M-03)', () => punya('M-03', /^POST \/auth\/login$/)],
  ['M-03 wajib punya GET /admin/hak-akses/peran (inti RBAC)', () => punya('M-03', /^GET \/admin\/hak-akses\/peran$/)],
  ['M-03 wajib punya POST /admin/permintaan-hak/:id/approve', () => punya('M-03', /^POST \/admin\/permintaan-hak\/[^/]+\/approve$/)],
  ['M-01 TIDAK boleh mewarisi /auth/login (itu M-03)', () => !perModul.has('M-01') || !punya('M-01', /\/auth\//)],
  ['M-03 TIDAK boleh mewarisi /admin/master/lookups (itu M-02)', () => !perModul.has('M-03') || !punya('M-03', /\/admin\/master\/lookups/)],
  ['M-03 TIDAK boleh mewarisi /admin/tuition-tariff-matrix (itu M-10)', () => !perModul.has('M-03') || !punya('M-03', /\/admin\/tuition-tariff-matrix/)],
  ['M-03 TIDAK boleh mewarisi /admin/impor (itu M-02)', () => !perModul.has('M-03') || !punya('M-03', /\/admin\/impor/)],
  ['M-02 TIDAK boleh mewarisi /admin/hak-akses/peran (itu M-03)', () => !perModul.has('M-02') || !punya('M-02', /\/admin\/hak-akses\/peran/)],
  /* Siklus M-04 (`RD-119`): §7.1 dulu ditulis sebagai baris gabungan `GET · POST` sehingga parser
     membuangnya diam-diam dan M-04 terukur 10 rute padahal 26. Known-answer ini memaku rute pembatal
     (hasil pemecahan) dan publish (verba VALIDATE) milik M-04. */
  ['M-04 wajib punya GET /helpdesk/tickets', () => punya('M-04', /^GET \/helpdesk\/tickets$/)],
  ['M-04 wajib punya POST /helpdesk/tickets/{id}/cancel', () => punya('M-04', /^POST \/helpdesk\/tickets\/[^/]+\/cancel$/)],
  ['M-04 wajib punya POST /helpdesk/knowledge-base/{id}/publish', () => punya('M-04', /^POST \/helpdesk\/knowledge-base\/[^/]+\/publish$/)],
  /* Siklus M-05 (`RD-121`): jejak audit punya kontrak HTTP tetapi tidak punya rumah — `platform/audit-events`
     tercetak milik M-01 (barisnya sendiri menulis "pemilik namespace M-05"), dan jangkar/verifier sama sekali
     tidak terhitung karena dulu hanya berbentuk kalimat (§4.6.7) dan blok ilustrasi (§6.10.8). Known-answer ini
     memaku bahwa §4.21 memang terbaca DAN bahwa dua tetangga tidak boleh lagi mewarisinya. */
  ['M-05 wajib punya GET /platform/audit-events (bukan milik M-01)', () => punya('M-05', /^GET \/platform\/audit-events$/)],
  ['M-05 wajib punya GET /admin/audit-events (list — layar /admin/audit tidak boleh tanpa rute)', () => punya('M-05', /^GET \/admin\/audit-events$/)],
  ['M-05 wajib punya GET /admin/audit-anchors', () => punya('M-05', /^GET \/admin\/audit-anchors$/)],
  ['M-05 wajib punya POST /admin/audit-anchors/{anchorId}/seal', () => punya('M-05', /^POST \/admin\/audit-anchors\/[^/]+\/seal$/)],
  ['M-05 wajib punya GET /admin/audit-verifications/{verificationId}', () => punya('M-05', /^GET \/admin\/audit-verifications\/[^/]+$/)],
  ['M-05 wajib punya GET /admin/permintaan-subjek-data/{requestId}', () => punya('M-05', /^GET \/admin\/permintaan-subjek-data\/[^/]+$/)],
  ['M-01 TIDAK boleh memegang /platform/audit-events (namespace M-05)', () => !perModul.has('M-01') || !punya('M-01', /\/platform\/audit-events/)],
  ['M-02 TIDAK boleh mewarisi /admin/audit-anchors (peta wilayah §4.6 bukan pemilik)', () => !perModul.has('M-02') || !punya('M-02', /\/admin\/audit-anchors/)],
  ['tidak ada rute ber-UUID literal yang tersisa', () => ![...perModul.values()].some((v) => v.rute.some((x) => /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(x)))],
  ['rute hasil CONTOH §1–§3 sudah dibuang (matriks tidak menyusut di bawah 300)', () => [...perModul.values()].reduce((a, v) => a + v.rute.length, 0) >= 300],
];
const kaGagal = KA.filter(([_, f]) => !f()).map(([s]) => s);
if (kaGagal.length) {
  console.error('MERAH — known-answer crud-matrix gagal: ' + kaGagal.join(' · '));
  console.error('Artinya pemindaian rute atau peta atribusinya yang rusak, bukan dokumennya. Tidak ada matriks yang dicetak.');
  process.exit(1);
}

/* daftar modul + status dari registri PRD §5.12.1 (sumber kebenaran registri) */
const regIdx = prd.findIndex((l) => /^#### 5\.12\.1/.test(l));
const reg = [];
for (let i = regIdx; i < prd.length; i++) {
  const m = prd[i].match(/^\|\s*(M-\d{2}|APP)\s*\|\s*([^|]+)\|[^|]*\|\s*(PENUH|SEBAGIAN|NOL)\s*\|/);
  if (m) reg.push({ id: m[1], nama: m[2].split('·')[0].trim().slice(0, 30), status: m[3] });
  if (reg.length >= 48) break;
}

const JSON_MODE = process.argv.includes('--json');
if (!JSON_MODE) {
console.log('## Matriks CRUD (sumber rute: API_SPEC §4 yang dipetakan + §7 yang berkolom M-xx)');
console.log('| M | Modul | Registri | C | R | U | D | VALIDATE | total rute | vonis CRUD wajib |');
console.log('|---|---|---|---:|---:|---:|---:|---:|---:|---|');
}

/* Revisi 2026-10-21 (`RD-100`). Versi lama menuntut C,R,U,D SERAGAM ke semua modul dan karenanya
   menuduh dirinya sendiri di catatan kaki: "DELETE di SICA sengaja jarang — nol baris DELETE berarti
   dihapus lewat transisi state, bukan tidak ada". Vonis dan keterangan tidak boleh bertolak belakang.
   Sekarang yang dituntut hanyalah verba yang DIIZINKAN untuk namespace modul itu, dan izin itu dibaca
   dari pemiliknya: partisi namespace `RBAC_MATRIX §4.5.1` (kolom verba), bukan daftar yang saya rawat
   di alat. Tiga keadaan tambahan dihitung sebagai pemenuhan, dan masing-masing dicetak dengan alasannya:
     · D = 0 tetapi ada rute transisi terminal (void/cancel/retire/archive/deactivate/recall/lift) -> vonis
     · U = 0 tetapi ada gerbang VALIDATE -> perubahan keadaan memang lewat gerbang, bukan lewat PATCH
     · modul tanpa baris partisi -> diperlakukan CRUD penuh DAN dinyatakan, tidak diam-diam dilonggarkan
   Lantai keras yang tidak bisa dihapus oleh vonis apa pun: READ >= 1 dan (C+U+D+V) >= 1 untuk modul
   ber-entitas. Modul yang tidak bisa membaca atau tidak bisa menulis apa pun tetap KURANG. */
const rbLines = readFileSync(D + 'RBAC_MATRIX.md', 'utf8').split(NL);
const ALL6 = ['READ', 'INSERT', 'UPDATE', 'DELETE', 'VALIDATE', 'OTHER'];
const allowed = new Map();
{
  let inPart = false;
  for (let i = 0; i < rbLines.length; i++) {
    const l = rbLines[i];
    if (l.startsWith('#### 4.5.1')) { inPart = true; continue; }
    if (inPart && l.startsWith('#### 4.5.2')) break;
    if (!inPart || !l.startsWith('|')) continue;
    const c = l.split('|').map((s) => s.trim());
    if (c.length < 5) continue;
    /* Sel SKU bisa berawalan keterangan, contoh nyata `RBAC §4.5.1`: "(bukan SKU) `platform`".
       `replace(/\s*\(.*$/,'')` memotong dari tanda kurung PERTAMA sehingga sel itu menjadi kosong dan
       barisnya dibuang — partisi `platform`→M-01, `helpdesk`→M-04, `credential`, `analytics` hilang dan
       M-01 dilaporkan "tanpa partisi". Yang dibuang hanya keterangan, bukan nama (`RD-105`). */
    const ns = (c[1] || '').replace(/`/g, '').replace(/^\([^)]*\)\s*/, '').replace(/\s*\(.*$/, '').replace(/\s*—.*$/, '').trim();
    if (!/^[a-z_]+$/.test(ns)) continue;
    let verbs = [];
    if (/enam verba/i.test(c[3] || '')) verbs = ALL6;
    else verbs = ALL6.filter((v) => new RegExp('\\b' + v + '\\b').test(c[3] || ''));
    if (!verbs.length) continue;
    for (const mod of new Set((c[2].match(/(?<![A-Za-z0-9])M-\d\d(?![0-9])/g) || []))) {
      if (!allowed.has(mod)) allowed.set(mod, new Set());
      for (const v of verbs) allowed.get(mod).add(v);
    }
  }
}
const TERMINAL = /(void|cancel|retire|archive|deactivate|recall|lift|withdraw|revoke|reset|blanket)/i;
const notes = { noDeleteByVonis: [], updateViaValidate: [], deleteViaState: [], noPartition: [] };
let kurang = [];
const jsonRows = [];
for (const r of reg) {
  const v = perModul.get(r.id) || { C: 0, R: 0, U: 0, D: 0, V: 0, rute: [], ruteObj: [] };
  /* `M-01` pernah dikecualikan secara sepihak di dua baris ini ("modul fondasi tidak butuh CREATE").
     Itu kurasi saya, bukan dokumen. Setelah partisi `RBAC §4.5.1` membaca namespace `platform`
     (verba READ INSERT UPDATE OTHER) dan `entitlement`, tuntutan M-01 datang dari kolom verba dokumen
     itu sendiri; `APP` tetap tidak ber-entitas karena ia klien, bukan modul berpendataan (`RD-105`). */
  const isEntitas = r.id !== 'APP';
  const paths = v.rute.join(' | ');
  const hasTerminalRoute = TERMINAL.test(paths);
  const a = allowed.get(r.id);
  if (!a) notes.noPartition.push(r.id);
  const may = { R: !a || a.has('READ'), C: !a || a.has('INSERT'), U: !a || a.has('UPDATE'), D: (!a || a.has('DELETE')) && isEntitas };
  if (['M-26', 'M-31', 'M-32', 'M-33', 'M-34'].includes(r.id)) { may.C = false; may.D = false; }
  const miss = [];
  if (may.C && v.C === 0) miss.push('CREATE');
  if (v.R === 0) miss.push('READ');
  if (may.U && v.U === 0 && v.V === 0) miss.push('UPDATE');
  else if (may.U && v.U === 0 && v.V > 0) notes.updateViaValidate.push(r.id);
  if (may.D && v.D === 0) {
    if (hasTerminalRoute) notes.deleteViaState.push(r.id);
    else miss.push('DELETE');
  } else if (!may.D && isEntitas && v.D === 0) notes.noDeleteByVonis.push(r.id);
  if (isEntitas && v.R > 0 && (v.C + v.U + v.D + v.V) === 0) miss.push('TULIS');
  const tot = v.C + v.R + v.U + v.D + v.V;
  if (miss.length) kurang.push(r.id + ' ' + r.nama + ' → ' + miss.join(','));
  jsonRows.push({ id: r.id, nama: r.nama, status: r.status, C: v.C, R: v.R, U: v.U, D: v.D, V: v.V, tot, miss, may, exempt: notes.deleteViaState.includes(r.id) || notes.updateViaValidate.includes(r.id) || notes.noDeleteByVonis.includes(r.id), routes: v.rute, routeList: v.ruteObj });
  if (JSON_MODE) continue;
  console.log('| ' + r.id + ' | ' + r.nama + ' | ' + r.status + ' | ' + v.C + ' | ' + v.R + ' | ' + v.U + ' | ' + v.D + ' | ' + v.V + ' | ' + tot + ' | ' + (miss.length ? 'KURANG: ' + miss.join(',') : 'lengkap') + ' |');
}
if (JSON_MODE) { console.log(JSON.stringify({ rows: jsonRows, notes, kurang: kurang.length })); process.exit(0); }
console.log('');
console.log('modul dengan CRUD wajib belum lengkap = ' + kurang.length + ' dari ' + reg.length);
kurang.forEach((k) => console.log('  - ' + k));
console.log('');
console.log('CATATAN KEANDALAN ALAT (wajib dibaca bersama angkanya):');
console.log('  1. Atribusi rute memakai SATU sumber per baris dengan prioritas: sel `Modul` penulis rute → label heading `(M-14 · M-15)` → peta wilayah §4→modul (kurasi saya) → kamus segmen jalur. Kolom `Izin` TIDAK menjadi sumber atribusi; ia diperiksa silang dan selisihnya dicetak di catatan #8 (katalog yang belum cukup berlabel tidak boleh menghukum modul). Terukur siklus ini: ' +
  Object.entries(attrib).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '=' + v).join(' · ') +
  '. Baris yang masih bergantung pada kurasi saya harus berkurang tiap siklus, dan angkanya tidak boleh disembunyikan.');
console.log('  2. Tuntutan verba per modul dibaca dari partisi namespace `RBAC §4.5.1` (kolom verba), BUKAN dari asumsi CRUD seragam. Nama yang READ-only tidak dihukum karena tidak bisa menghapus.');
console.log('  3. DELETE di SICA sengaja jarang: norma penghapusan adalah **transisi state** (`void`/`cancel`/`retire`/`archive`/`deactivate`). Kalau D = 0 TETAPI rute transisi terminal ada, modul itu dihitung lengkap dan didaftarkan di baris `via-state` berikut, bukan diam-diam:');
console.log('       via-state (' + notes.deleteViaState.length + '): ' + (notes.deleteViaState.join(', ') || '—'));
console.log('       tanpa-DELETE-oleh-namespace (' + notes.noDeleteByVonis.length + '): ' + (notes.noDeleteByVonis.join(', ') || '—'));
console.log('       UPDATE-lewat-gerbang-VALIDATE (' + notes.updateViaValidate.length + '): ' + (notes.updateViaValidate.join(', ') || '—'));
console.log('       tanpa-partisi-§4.5.1 (diperlakukan CRUD penuh) (' + notes.noPartition.length + '): ' + (notes.noPartition.join(', ') || '—'));
console.log('  4. READ untuk modul read-model (M-26, M-31, M-32, M-33, M-34) melayani lewat agregasi, jadi barisnya boleh 0 dan itu vonis, bukan lubang.');
console.log('  5. Lantai keras yang tidak dihapus vonis apa pun: READ >= 1 dan (C+U+D+V) >= 1 untuk modul ber-entitas; dilanggar = KURANG.');
console.log('  6. Baris REKAP `API_SPEC §5 Inventaris` yang DILEWATI = ' + skipRekap + ' (sudah dihitung di §4/§6/§7 sebagai spesifikasi aslinya; memasukkannya kembali berarti menghitung rute dua kali dan menamainya dengan heading yang kebetulan mendahuluinya — `RD-108`).');
console.log('  7. Batas wilayah + normalisasi (`RD-109`): hanya `## 4`/`## 6`/`## 7` yang dipindai; baris `METHOD /path` di bagian konvensi (`## 1` header wajib, `## 2` amplop respons, `## 3` skema Zod) adalah CONTOH dan dibuang = ' + skipKonvensi + ' · segmen UUID literal dalam contoh dinormalisasi ke `{id}` = ' + normUuid + ' · query string dibuang dari identitas rute = ' + normQuery + '. Peta kurasi juga dikoreksi: `§4.5` bukan milik M-02 (activate/deactivate modul adalah entitlement M-01; M-02 tidak menulis subscription). Known-answer yang dipatok: `M-02` wajib punya `GET /admin/master/lookups` dan `PUT /admin/system-parameters`, `M-01` wajib punya `GET /tenant/modules`, `M-02` TIDAK boleh mewarisinya, tidak boleh ada UUID tersisa, dan total rute tidak boleh menyusut di bawah 300 — salah satu gagal = alat berhenti, tidak ada matriks dicetak.');
console.log('  8. SILANG-bukti kolom `Izin` lawan atribusi yang dipakai: ' + izinBeda.size + ' path berbeda. Kalau pemilik kode izin di katalog tidak sama dengan modul yang memegang rutenya, salah satu belum dilabeli — ini KERJA PELABELAN (`PRV-4`), bukan vonis CRUD, karena itu hanya dicetak dan tidak mengubah angka di atas. Alasan ia tidak dijadikan sumber atribusi: diukur dulu, dan hasilnya M-18 kehilangan 7 rute serta M-15/M-16 kehilangan UPDATE/DELETE bukan karena rutenya hilang tetapi karena katalog saya sendiri belum melabeli cukup baris `teaching.*`/`attendance.*` — menghukum modul karena pelabelan yang tipis adalah kelas cacat `RD-104`. Sampel: ' +
  [...izinBeda.entries()].slice(0, 6).map(([p, x]) => '`' + p + '` dipegang=' + x.mod + ' · pemilik-izin=' + x.izin).join(' ; '));
console.log('  9. Baris rute ber-METODE-GABUNGAN (`| GET · POST | …`) yang parser TIDAK ekspansi = ' + skipGabung + ' — ia dihitung dan dicetak, bukan dibuang diam-diam (`RD-119`). Parser sengaja tidak menebak verba dari gabungan: rute itu harus dipecah jadi baris eksplisit di API_SPEC. Selama ' + skipGabung + ' > 0, angka CRUD modul pemiliknya adalah BATAS BAWAH dan vonis "KURANG" atas verba yang hilang harus dibaca bersama catatan ini.');
console.log('');
console.log('peta wilayah → modul: ' + Object.entries(REGION).map(([k, v]) => '§' + k + '=' + v.join('+')).join('  '));
