import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const arch = readFileSync(D + 'ARCHITECTURE.md', 'utf8').split(NL);

const i131 = arch.findIndex((l) => /^### 13\.1/.test(l));
const i132 = arch.findIndex((l) => /^### 13\.2/.test(l));
const i134 = arch.findIndex((l) => /^### 13\.4/.test(l));
const i135 = arch.findIndex((l) => /^### 13\.5/.test(l));

/* katalog peristiwa: hanya baris tabel yang kolom pertamanya `nama.peristiwa` */
const events = [];
for (const l of arch.slice(i131, i132)) {
  const m = l.match(/^\|\s*`([a-z_]+\.[a-z_]+\.[a-z_]+)`\s*\|\s*(M-\d{2}|APP)[^|]*\|([^|]*)\|/);
  if (m) events.push({ name: m[1], publisher: m[2], consumers: m[3] });
}
const byPub = new Map();
for (const e of events) {
  if (!byPub.has(e.publisher)) byPub.set(e.publisher, []);
  byPub.get(e.publisher).push(e);
}

/* register §13.1.1 (`RD-74`): hop yang peristiwanya belum ada di katalog tetapi sudah
   didaftarkan dengan penerbit, konsumen, dan prasyarat objek. Lobang terdaftar berbeda
   dengan lobang diam-diam, dan alat ini tidak boleh menyamakan keduanya. */
const i1311 = arch.findIndex((l) => /^#### 13\.1\.1/.test(l));
const registered = [];
if (i1311 !== -1) {
  for (const l of arch.slice(i1311, i132)) {
    const m = l.match(/^\|\s*`([a-z_]+\.[a-z_]+\.[a-z_]+)`\s*\|\s*(M-\d{2}|APP)\s*\|([^|]*)\|([^|]*)\|/);
    if (m) registered.push({ name: m[1], publisher: m[2], consumers: m[3], chain: m[4].trim() });
  }
}

/* skenario §13.4: blok + M-xx yang muncul di dalamnya */
const scenBlocks = [];
let cur = null;
for (let i = i134; i < i135; i++) {
  const h = arch[i].match(/^#### (Skenario [^\n]+)/);
  if (h) { cur = { title: h[1], mods: new Set(), events: new Set() }; scenBlocks.push(cur); continue; }
  if (!cur) continue;
  for (const m of arch[i].matchAll(/\b(M-\d{2}|APP)\b/g)) cur.mods.add(m[1]);
  for (const m of arch[i].matchAll(/`([a-z_]+\.[a-z_]+\.[a-z_]+)`/g)) cur.events.add(m[1]);
}

/* Sepuluh rantai pemilik: hop = [penerbit, penerima, pola nama peristiwa yang sah].
   RALAT ALAT 2026-10-21 (RD-62 berulang): versi pertama menuntut rx cocok dengan TEKS
   kolom konsumen yang isinya kode modul (`M-10, M-11`), bukan kata bisnis — sehingga
   hop yang sebenarnya ber-peristiwa dilaporkan sebagai lobang. Cara ukur yang benar:
   penerbit = `from` DAN (konsumen memuat `to` ATAU nama cocok rx). */
const CHAINS = [
  ['1. Marketing PMB → Portal → Billing → NIM → KRS', [['M-45', 'M-09', /lead|crm/], ['M-09', 'M-10', /application|document|selection|reregistration|invoice|tariff/], ['M-09', 'M-02', /nim/], ['M-10', 'M-13', /paid|settle|clear|invoice/], ['M-13', 'M-13', /krs/]]],
  ['2. Bimbingan KP/PKL → logbook DPL → nilai mitra → KHS', [['M-25', 'M-25', /logbook|fieldwork/], ['M-25', 'M-19', /grade|evaluation/], ['M-25', 'M-19', /credit|conversion/]]],
  ['3. Bimbingan TA → sidang → RAMA → clearance yudisium', [['M-20', 'M-20', /proposal|logbook|thesis/], ['M-20', 'M-20', /defense|sidang|schedule/], ['M-20', 'M-30', /clearance|completion|defense|grade/]]],
  ['4. SIM-LPPM → SINTA/HAKI → BKD → SISTER → IKU 5', [['M-44', 'M-07', /research|grant|output/], ['M-07', 'M-08', /bkd|sister/], ['M-44', 'M-32', /output|iku|metric/]]],
  ['5. E-Procurement → anggaran BAUK → aset SIMAK BMN', [['M-46', 'M-10', /procurement|budget|po|received/], ['M-46', 'M-40', /asset|received/]]],
  ['6. Endowment → imbal hasil → beasiswa & hibah', [['M-47', 'M-11', /endowment|allocation/], ['M-47', 'M-44', /endowment|grant/]]],
  ['7. KRS War → solver jadwal → presensi → BKD → SISTER', [['M-13', 'M-14', /krs|seat|enroll/], ['M-14', 'M-18', /session|schedule|timetable/], ['M-18', 'M-07', /attendance/]]],
  ['8. Presensi & LMS → gradebook AST → CPL OBE → KHS → transkrip', [['M-18', 'M-19', /attendance/], ['M-16', 'M-19', /lms|activity/], ['M-19', 'M-12', /grade|attainment/], ['M-19', 'M-34', /transcript|grade|khs/]]],
  ['9. Yudisium → PIN → SIVIL publik → tracer', [['M-30', 'M-35', /graduation|yudisium|pin/], ['M-35', 'M-27', /diploma|sivil|alumni/]]],
  ['10. Auto-feed real-time ke Feeder, LKPS, IKU 1–8', [['M-19', 'M-34', /grade|feeder|locked|khs/], ['M-18', 'M-34', /attendance|verdict/], ['M-31', 'M-32', null]]],
];

/* Hop yang menurut vonis arsitek BUKAN hop peristiwa: M-31 dan M-32 adalah read-model
   dan dilarang menerbitkan (`ARCHITECTURE §13.1.1` aturan butir 3). Rantainya nyata,
   penyalurannya agregasi terjadwal, bukan peristiwa — dihitung terjejak dengan catatan. */
const NON_EVENT_HOPS = [['10', 3, 'M-31 → M-32: read-model tidak menerbitkan (aturan §13.1.1 butir 3); yang ada adalah job agregasi terjadwal + snapshot berversi, bukan peristiwa outbox']];

const scenTitles = scenBlocks.map((b) => b.title);
console.log('peristiwa di katalog §13.1 = ' + events.length + ' (unik ' + new Set(events.map((e) => e.name)).size + ') · register §13.1.1 = ' + registered.length);
console.log('blok skenario §13.4 = ' + scenBlocks.length + ' :: ' + scenTitles.join(' | '));
console.log('');
console.log('| Rantai pemilik | hop | hop berperistiwa | hop terdaftar §13.1.1 | hop non-peristiwa | hop di skenario | vonis |');
console.log('|---|---:|---:|---:|---:|---:|---|');
let gaps = 0;
const gapDetail = [];
const regDetail = [];
for (let chainNo = 0; chainNo < CHAINS.length; chainNo++) {
  const [name, hops] = CHAINS[chainNo];
  let withEv = 0, withScen = 0, withReg = 0, withNon = 0;
  hops.forEach(([from, to, rx], idx) => {
    const list = byPub.get(from) || [];
    const cands = list.filter((e) => e.consumers.includes(to) || (rx && rx.test(e.name)));
    const inScen = scenBlocks.some((b) => b.mods.has(from) && b.mods.has(to));
    if (inScen) withScen++;
    if (cands.length) { withEv++; return; }
    const nh = NON_EVENT_HOPS.find((h) => h[0] === String(chainNo + 1) && h[1] === idx + 1);
    if (nh) { withNon++; return; }
    const reg = registered.filter((r) => new RegExp('rantai ' + (chainNo + 1) + '\\b').test(r.chain));
    if (reg.length) {
      withReg++;
      regDetail.push(name + ' hop#' + (idx + 1) + ' ' + from + '→' + to + ' = ' + reg.map((r) => '`' + r.name + '`').join(', ') + ' (terdaftar §13.1.1)');
      return;
    }
    gapDetail.push(name + ' hop#' + (idx + 1) + ' ' + from + '→' + to + ' TIDAK ADA PERISTIWA, TIDAK TERDAFTAR');
  });
  const short = hops.length - withEv - withReg - withNon;
  const v = short === 0
    ? 'terjejak penuh' + (withReg ? ' (' + withReg + ' lobang terdaftar)' : '') + (withNon ? ' (' + withNon + ' hop non-peristiwa)' : '')
    : 'LOBANG ' + short;
  if (short !== 0) gaps++;
  console.log('| ' + name + ' | ' + hops.length + ' | ' + withEv + ' | ' + withReg + ' | ' + withNon + ' | ' + withScen + ' | ' + v + ' |');
}
console.log('');
console.log('rantai berlobang TANPA pendataan = ' + gaps + ' dari ' + CHAINS.length);
if (regDetail.length) { console.log('Lobang terdaftar (§13.1.1):'); regDetail.forEach((g) => console.log('  + ' + g)); }
console.log('Lobang tanpa pendataan:');
gapDetail.forEach((g) => console.log('  - ' + g));
if (!gapDetail.length) console.log('  (nol)');
console.log(gaps === 0
  ? 'chain-audit: HIJAU — sepuluh rantai terjejak; setiap lobang punya baris register dengan penerbit + prasyarat, dan hop read-model dinyatakan eksplisit'
  : 'chain-audit: MERAH — ' + gaps + ' rantai punya hop yang neither ber-peristiwa, terdaftar, maupun dinyatakan non-peristiwa');
