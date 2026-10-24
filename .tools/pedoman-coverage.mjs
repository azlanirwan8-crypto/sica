import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

/* PENJAGA PEDOMAN (PRD 5.20). Menolak, bukan memuji:
   1) jumlah baris registri WAJIB sama dengan jumlah baris registri modul PRD 5.12.1;
   2) himpunan kode modul kedua tabel WAJIB identik (tidak ada modul tanpa pedoman, tidak ada baris yatim);
   3) kolom "Dasar" tidak boleh kosong dan tidak boleh hanya berisi penanda;
   4) penanda yang dipakai harus dikenal (VERIFIKASI-LEGAL / VERIFIKASI-VENDOR);
   5) cakupan regulasi induk dicetak supaya bisa dibandingkan antar siklus. */

const prd = readFileSync('docs/PRD.md', 'utf8');
const lines = prd.split(NL);

const idxReg = lines.findIndex((l) => l.startsWith('#### 5.12.1'));
const idxPed = lines.findIndex((l) => /^### 5\.20\b/.test(l));
const fails = [];
if (idxReg < 0) fails.push('PRD 5.12.1 tidak ditemukan');
if (idxPed < 0) fails.push('PRD 5.20 tidak ditemukan');
if (fails.length) { console.log('MERAH · ' + fails.join(' · ')); process.exit(1); }

const ids = (arr) => arr.map((r) => r.id);
const modul = [];
for (const l of lines.slice(idxReg)) {
  const m = l.match(/^\|\s*(M-\d{2}|APP)\s*\|\s*([^|]+)\|[^|]*\|\s*(?:PENUH|SEBAGIAN|NOL)\s*\|/);
  if (m) modul.push({ id: m[1], nama: m[2].split('·')[0].trim() });
  if (modul.length >= 48) break;
}

const ped = [];
for (const l of lines.slice(idxPed)) {
  if (/^#{2,4}\s/.test(l) && !/^### 5\.20/.test(l)) break;
  const m = l.match(/^\|\s*(M-\d{2}|APP)\s*\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]*)\|\s*$/);
  if (m) ped.push({ id: m[1], nama: m[2].trim(), dasar: m[3].trim(), sevima: m[4].trim(), batas: m[5].trim() });
}

if (ped.length !== modul.length) fails.push(`jumlah baris pedoman = ${ped.length}, registri modul = ${modul.length}`);
const missing = modul.filter((r) => !ped.some((p) => p.id === r.id)).map((r) => r.id);
const yatim = ped.filter((p) => !modul.some((r) => r.id === p.id)).map((p) => p.id);
if (missing.length) fails.push('modul tanpa baris pedoman: ' + missing.join(', '));
if (yatim.length) fails.push('baris pedoman tanpa modul: ' + yatim.join(', '));

const MARKER = ['VERIFIKASI-LEGAL', 'VERIFIKASI-VENDOR'];
const LEX = /(UU|PP|PMK|Perpres|Permendikbud\w*|Permenristekdikti|SISTER|PDDikti|PDID|SIVIL|IKU|SPMI|BAN-?PT|LAM|SINTA|DJKI|LKPP|BMN|PBJ|KIP-K|PPKS|MARC21|Dublin Core|SJSN|PPh|Cipta Kerja|Ketenagakerjaan|ITE|PSTE|IRTE|SN-?Dikti|53\/2023|30\/2021|43\/2007|43\/2009|40\/2004|86\/2013|168\/2023|11\/2008|71\/2019|28\/2014|20\/2016|17\/2023|11\/2019|27\/2022|59\/2018|Kelas|kelas|statuta|kebijakan|standar|tidak ada dasar)/;
for (const p of ped) {
  if (!p.dasar) fails.push(p.id + ': kolom Dasar kosong');
  else if (!LEX.test(p.dasar)) fails.push(p.id + ': Dasar tidak memuat nama regulasi/standar yang dikenal → ' + p.dasar.slice(0, 60));
  for (const mk of (p.dasar.match(/VERIFIKASI-[A-Z]+/g) || [])) if (!MARKER.includes(mk)) fails.push(p.id + ': penanda tidak dikenal ' + mk);
  if (!p.sevima) fails.push(p.id + ': kolom Rujukan Sevima kosong');
}

const legal = ped.filter((p) => p.dasar.includes('VERIFIKASI-LEGAL')).length;
const vendor = ped.filter((p) => p.dasar.includes('VERIFIKASI-VENDOR') || p.batas.includes('VERIFIKASI-VENDOR')).length;
const sn = ped.filter((p) => /53\/2023|SN-?Dikti/.test(p.dasar)).length;
const pdp = ped.filter((p) => /UU PDP|27\/2022/.test(p.dasar)).length;
const sevimaNone = ped.filter((p) => /Tidak ada padanan/i.test(p.sevima)).length;

console.log(`baris pedoman = ${ped.length} · registri modul = ${modul.length}`);
console.log(`cakupan 53/2023 di kolom Dasar = ${sn}/${ped.length} · UU PDP = ${pdp}/${ped.length}`);
console.log(`modul dengan penanda VERIFIKASI-LEGAL = ${legal} · VERIFIKASI-VENDOR = ${vendor}`);
console.log(`modul TANPA padanan Sevima = ${sevimaNone} (justifikasi = kolom Dasar, bukan "kompetitor tidak punya")`);
console.log(fails.length ? 'MERAH · ' + fails.length + ' temuan · ' + fails.slice(0, 10).join(' | ') : 'HIJAU — registri pedoman 5.20 lengkap dan seragam dengan registri modul');
if (fails.length) process.exit(1);
