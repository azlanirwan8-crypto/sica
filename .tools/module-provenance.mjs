import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

/* MATRIKS KETERTELUSURAN PER MODUL (revisi ke-3 pada siklus yang sama).
   Cacat yang diperbaiki sebelum angkanya dikutip di mana pun (RD-62/RD-76):
   (a) v1: kolom REGULASI disemprot ke seluruh INTEGRATIONS sehingga semua modul "lulus";
   (b) v1: kolom LAYAR berbasis heading, padahal UI_UX menandai modul di dalam baris;
   (c) v1: kolom SEED mencari kode `M-xx` yang memang tidak pernah dipakai SEED_DATA;
   (d) v2: kolom DDL memakai atribusi "lengket" — heading tanpa label modul mewarisi label
       heading sebelumnya, sehingga M-36 tercatat 45 tabel dan M-41 hanya 5. Sekarang:
       label = SEMUA token modul pada heading terdekat yang menyebut modul; heading tanpa
       token modul memutus atribusi (tidak ada pewarisan);
   (e) v2: ruang regulasi hanya PRD, padahal sitasi sah bisa hidup di INTEGRATIONS/SECURITY/
       BENCHMARK. Sekarang satu token dihitung bila baris yang SAMA menyebut modul dan regulasi. */

const DOCS = {
  PRD: 'docs/PRD.md',
  BENCHMARK: 'docs/BENCHMARK_SEVIMA.md',
  DATA_MODEL: 'docs/DATA_MODEL.md',
  API_SPEC: 'docs/API_SPEC.md',
  RBAC: 'docs/RBAC_MATRIX.md',
  UI_UX: 'docs/UI_UX_DESIGN.md',
  SEED: 'docs/SEED_DATA.md',
  AUDIT: 'docs/AUDIT_READINESS.md',
  INTEGRATIONS: 'docs/INTEGRATIONS.md',
  SECURITY: 'docs/SECURITY_COMPLIANCE.md',
  BLUEPRINT: 'docs/BLUEPRINT_ENTERPRISE.md',
};
const src = {};
for (const [k, p] of Object.entries(DOCS)) src[k] = readFileSync(p, 'utf8');

/* ANTI-UMPAN-BALIK. `AUDIT_READINESS §17.1` adalah salinan keluaran alat ini. Kalau bagian itu
   ikut dibaca, setiap siklus angka naik karena alat membaca tabelnya sendiri (M-33 sempat tercatat
   menyebut PBJ & kearsipan hanya karena barisnya sendiri memuat daftar token). Segala yang berada
   di bawah heading §17 dibuang dari bahan pengukuran. */
const CUT = src.AUDIT.indexOf('## 17. Ketertelusuran pedoman per modul');
if (CUT > 0) src.AUDIT = src.AUDIT.slice(0, CUT);

const regIdx = src.PRD.indexOf('#### 5.12.1');
const reg = [];
for (const line of src.PRD.slice(regIdx).split(NL)) {
  const m = line.match(/^\|\s*(M-\d{2}|APP)\s*\|\s*([^|]+)\|([^|]*)\|\s*(PENUH|SEBAGIAN|NOL)\s*\|([^|]*)\|/);
  if (m) reg.push({ id: m[1], nama: m[2].split('·')[0].trim(), ent: m[3].trim(), status: m[4], fr: m[5].trim() });
  if (reg.length >= 48) break;
}

/* Bentuk nomor regulasi di dokumen kita beragam: "53/2023", "53 Tahun 2023", "53 2023".
   Pola lama hanya menerima "53 Tahun 2023" sehingga 43 modul tercatat "tidak menyebut 53/2023"
   padahal menyebutnya dengan garis miring — cacat alat, bukan cacat dokumen (RD-62). */
const thn = (n, y) => new RegExp(n + '\\s*(?:Tahun\\s*)?[/\\-]?\\s*' + y);
const REGULASI = [
  ['53/2023 (SN-Dikti)', /SN-?Dikti/, thn(53, 2023)],
  ['30/2021 (PPKS)', /\bPPKS\b/, thn(30, 2021)],
  ['UU PDP 27/2022', /UU\s*PDP/, thn(27, 2022)],
  ['IKU', /\bIKU\b/],
  ['BAN-PT/LAM', /BAN-?PT|\bLAM\b/],
  ['SPMI', /\bSPMI\b/],
  ['PDDikti Feeder', /PDDikti|PDDIKTI|\bFeeder\b|\bPDM\b/],
  ['SISTER', /SISTER/],
  ['SIVIL/PIN', /SIVIL/],
  ['BPJS', /BPJS/],
  ['PPh 21', /PPh\s*21|PPh21/],
  ['59/2018', /Permenristekdikti/, thn(59, 2018)],
  ['DJKI/HKI', /DJKI|\bHKI\b/],
  ['imigrasi/KITA', /imigrasi|KITA\b|visum/],
  ['UU ITE', /UU\s*ITE/, thn(11, 2008)],
  ['PP 71/2019 PSTE', /PSTE/, thn(71, 2019)],
  ['ketenagakerjaan', /Ketenagakerjaan|Cipta Kerja/],
  ['MBKM', /\bMBKM\b|Kampus Merdeka/],
  ['perpustakaan/kearsipan', /Perpustakaan|kearsipan|MARC21|Dublin Core/, thn(43, 2007), thn(43, 2009)],
  ['BMN/aset', /\bBMN\b|penyusutan/],
  ['PBJ/e-katalog', /\bPBJ\b|e-?[Kk]atalog|\bHPS\b|LKPP|pengadaan/],
  ['kesehatan/rekam medis', /rekam medis|Permenkes/, thn(17, 2023)],
  ['SINTA', /\bSINTA\b/],
];

/* "M-12…M-19" adalah penyebutan yang sah; v2 hanya mencari token persis sehingga modul di dalam
   rentang tercatat "tidak dirujuk" padahal barisnya menyebut rentangnya. Rentang diekspansi. */
const STOP = ['modul', 'dan', 'dengan', 'untuk', 'sistem', 'layanan', 'serta', 'pada', 'yang'];
function kataKunci(nama) {
  const nm = nama.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.includes(w));
  return nm.slice(0, 3);
}
const RE_RANGE = /M-(\d{2})\s*(?:…|\.\.|–|-)\s*M?-(\d{2})/g;
/* Batas token — `l.includes('M-01')` salah karena "FR-CRM-01"/"FR-KBM-01" memuat deretan huruf yang
   sama, sehingga M-01 dihitung sebagai pemilik baris modul lain. Cacat ini baru terlihat ketika
   laporan kesiapan per modul membandingkan M-01 dengan isi katalog `platform.*`. */
const hasTok = (l, id) => new RegExp('(?<![A-Za-z0-9])' + id + '(?![0-9])').test(l);
function lineNames(l, id, nama) {
  const ll = l.toLowerCase();
  if (id === 'APP') return ll.includes('app') || ll.includes('superapp');
  if (hasTok(l, id)) return true;
  if (nama && ll.includes(nama.toLowerCase())) return true;
  const n = Number(id.slice(2));
  for (const m of l.matchAll(RE_RANGE)) {
    const a = Number(m[1]); const b = Number(m[2]);
    if (a <= b && n >= a && n <= b) return true;
  }
  return kataKunci(nama).some((w) => ll.includes(w));
}

/* Ruang regulasi memakai pencocokan KETAT (kode modul, rentang, atau nama lengkap — bukan kata
   kunci). Versi longgar membuat M-02 tampak "berpedoman ke BPJS" hanya karena baris berisi kata
   "parameter" juga menyebut tarif BPJS: ko-eksistensi kata, bukan rujukan. */
function lineNamesStrict(l, id, nama) {
  if (id === 'APP') return l.includes('APP') || l.toLowerCase().includes('superapp');
  if (hasTok(l, id)) return true;
  if (nama && l.toLowerCase().includes(nama.toLowerCase())) return true;
  const n = Number(id.slice(2));
  for (const m of l.matchAll(RE_RANGE)) {
    const a = Number(m[1]); const b = Number(m[2]);
    if (a <= b && n >= a && n <= b) return true;
  }
  return false;
}

/* Ruang = baris yang SENDIRI menyebut modul (kode atau nama lengkap). Satu token dihitung
   hanya bila muncul pada baris yang sama dengan penyebutan modul — tidak ada pewarisan baris. */
const SCOPE_DOCS = ['PRD', 'INTEGRATIONS', 'SECURITY', 'BENCHMARK', 'DATA_MODEL', 'AUDIT', 'BLUEPRINT'];
function scopeLines(id, nama) {
  const out = [];
  for (const k of SCOPE_DOCS) {
    for (const l of src[k].split(NL)) {
      if (lineNamesStrict(l, id, nama)) out.push(l);
    }
  }
  return out;
}

/* DDL berlabel: tabel dihitung untuk SETIAP modul yang disebut heading terdekat; heading tanpa
   token modul memutus atribusi. Ini membuat bagian bersama (mis. "M-41 Klinik dan M-36 PPKS")
   dihitung untuk keduanya, dan dihentikan begitu masuk sub-bagian lain yang tidak melabeli. */
function ddlBernamaModul() {
  const lines = src.DATA_MODEL.split(NL);
  const map = new Map();
  let cur = [];
  for (const l of lines) {
    const h = l.match(/^#{2,6}\s+(.+)$/);
    if (h) { cur = h[1].match(/\b(M-\d{2}|APP)\b/g) || []; continue; }
    if (!cur.length) continue;
    if (/^CREATE TABLE /.test(l.trim())) for (const id of cur) map.set(id, (map.get(id) || 0) + 1);
  }
  return map;
}
const dmMap = ddlBernamaModul();
const dmTables = src.DATA_MODEL.split(NL).filter((l) => /^CREATE TABLE /.test(l.trim())).length;

/* Vonis CRUD dipinjam dari pemiliknya: `.tools/crud-matrix.mjs` dijalankan sebagai subprocess dan
   tabelnya diurai. Kalau parse-nya gagal, alat ini berhenti — hasil yang senyap lebih berbahaya
   daripada hasil yang salah. */
import { execFileSync } from 'node:child_process';
const crudOut = execFileSync(process.execPath, ['.tools/crud-matrix.mjs'], { encoding: 'utf8' });
const crudMap = new Map();
for (const l of crudOut.split(NL)) {
  const m = l.match(/^\|\s*(M-\d{2}|APP)\s*\|([^|]+)\|([^|]+)\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([^|]+)\|\s*$/);
  if (m) crudMap.set(m[1], { rute: Number(m[9]), vonis: m[10].trim() });
}
if (crudMap.size < 48) { console.error('GAGAL parse keluaran crud-matrix (baris = ' + crudMap.size + ') — alat ini berhenti, tidak menebak.'); process.exit(1); }

const rows = [];
for (const r of reg) {
  const scope = scopeLines(r.id, r.nama);
  const joined = scope.join(NL);
  const regulasi = REGULASI.filter(([, ...re]) => re.some((x) => x.test(joined))).map(([n]) => n);
  const baris = (doc, f) => doc.split(NL).filter((l) => lineNames(l, r.id, r.nama) && f(l)).length;
  /* Kolom RUTE pernah dihitung dari baris API_SPEC yang menyebut kode modul, dan menghasilkan tuduhan
     palsu: M-01/M-15/M-26/M-37 tampak "tanpa rute" padahal rute mereka teratribusi lewat segmen jalur +
     peta wilayah §4/§7 milik `.tools/crud-matrix.mjs`. Sejak RD-95 kolom ini MENYALIN vonis crud-matrix
     (satu sumber kebenaran untuk atribusi rute), bukan menghitung versinya sendiri. */
  const barisKetat = (doc, f) => doc.split(NL).filter((l) => (hasTok(l, r.id) || lineNames(l, r.id, '')) && f(l)).length;
  const sevimaBm = baris(src.BENCHMARK, () => true);
  const sevimaAu = baris(src.AUDIT, () => true);
  const ddl = dmMap.get(r.id) || 0;
  const izin = barisKetat(src.RBAC, (l) => l.startsWith('|'));
  const layar = baris(src.UI_UX, () => true);
  const seed = baris(src.SEED, () => true);
  const crud = crudMap.get(r.id) || { rute: 0, vonis: 'TIDAK TERHITUNG' };
  const lubang = [];
  if (sevimaBm + sevimaAu === 0) lubang.push('SEVIMA');
  if (regulasi.length === 0) lubang.push('REGULASI');
  if (ddl === 0) lubang.push('DDL-BERLABEL');
  if (crud.vonis !== 'lengkap') lubang.push('CRUD');
  if (izin === 0) lubang.push('IZIN');
  if (layar === 0) lubang.push('LAYAR');
  if (seed === 0) lubang.push('SEED');
  rows.push({ ...r, sevimaBm, sevimaAu, regulasi, ddl, rute: crud.rute, vonis: crud.vonis, izin, layar, seed, lubang });
}

console.log('| M | Modul | Status | Sevima (benchmark:audit) | Regulasi RI (baris yang menyebut modul) | DDL berlabel | Rute (salinan vonis crud-matrix) | CRUD wajib | Baris izin | Layar | Seed | Lubang |');
console.log('|---|---|---|---|---|---:|---:|---|---:|---:|---:|---|');
for (const r of rows) {
  console.log(`| ${r.id} | ${r.nama} | ${r.status} | ${r.sevimaBm}:${r.sevimaAu} | ${r.regulasi.join(', ') || '—'} | ${r.ddl} | ${r.rute} | ${r.vonis} | ${r.izin} | ${r.layar} | ${r.seed} | ${r.lubang.join(', ') || '—'} |`);
}
const t = (k) => rows.filter((r) => r.lubang.includes(k)).length;
console.log(`\nRINGKASAN ${rows.length} modul · tanpa rujukan Sevima=${t('SEVIMA')} · tanpa rujukan regulasi=${t('REGULASI')} · tanpa DDL berlabel modul=${t('DDL-BERLABEL')} · CRUD wajib belum lengkap=${t('CRUD')} · tanpa baris izin=${t('IZIN')} · tanpa rujukan layar=${t('LAYAR')} · tanpa rujukan seed=${t('SEED')}`);
console.log(`modul bersih = ${rows.filter((r) => !r.lubang.length).length} · total lubang = ${rows.reduce((x, r) => x + r.lubang.length, 0)}`);
console.log('catatan alat: kolom SEVIMA/REGULASI/LAYAR/SEED menghitung BARIS yang menyebut modul lewat kode, rentang "M-aa…M-bb", atau kata kunci namanya — bukti ketertelusuran dokumen, BUKAN bukti fungsional. Kolom rute/CRUD bukan hitungan alat ini: isinya disalin dari vonis `.tools/crud-matrix.mjs` (pemilik atribusi rute), supaya tidak ada dua sumber kebenaran untuk pertanyaan yang sama (RD-95).');
console.log(`catatan alat: CREATE TABLE di DATA_MODEL = ${dmTables}; yang berada di bawah heading yang menyebut modul = ${[...dmMap.values()].reduce((x, y) => x + y, 0)}; sisanya ${dmTables - [...dmMap.values()].reduce((x, y) => x + y, 0)} hidup di bagian yang judulnya tematik (§5/§11–§21), jadi kolom "DDL berlabel" BUKAN ukuran ketiadaan tabel.`);
console.log('modul tanpa regulasi: [' + (rows.filter((r) => !r.regulasi.length).map((r) => r.id).join(', ') || 'kosong') + ']');
const sn = rows.filter((r) => r.regulasi.some((x) => x.startsWith('53/2023'))).map((r) => r.id);
console.log(`cakupan 53/2023 (SN-Dikti) pada baris milik modul = ${sn.length}/${rows.length} · yang belum: ${rows.filter((r) => !sn.includes(r.id)).map((r) => r.id).join(', ')}`);
console.log('modul dengan vonis CRUD bukan "lengkap": ' + rows.filter((r) => r.vonis !== 'lengkap').map((r) => r.id).join(', '));
console.log('modul tanpa seed: [' + (rows.filter((r) => r.seed === 0).map((r) => r.id).join(', ') || 'kosong') + ']');
