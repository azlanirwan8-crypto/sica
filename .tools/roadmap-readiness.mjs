import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const lines = readFileSync('C:/SICA/docs/ROADMAP_TASKS.md', 'utf8').split(NL);

/* PEMBACA KESIAPAN ROADMAP v2.
   v1 salah irisan: gugus tugas di berkas ini ditulis `### 2.x` (tingkat 3), bukan `## 2.x`,
   sehingga 21 gugus dilaporkan sebagai "1" dan baris checklist Fase yang memang pendek
   dihitung sebagai task tanpa dependensi — vonisnya jadi menjatuhkan dokumen karena alatnya cacat.
   Ini persis kelas kegagalan `RD-76`, jadi versi 2 memotong irisan berdasarkan heading nyata
   dan melaporkan DUA register terpisah: (A) checklist per Phase, (B) gugus tugas bernomor. */

const H = /^\s*(#{2,4})\s/;
const levelOf = (l) => { const m = l.match(H); return m ? m[1].length : 0; };
const idx = lines.map((l, i) => (H.test(l) ? i : -1)).filter((i) => i >= 0);
/* irisan berhenti pada heading SETINGKAT atau lebih tinggi — v2 memakai semua heading
   sehingga wilayah `## Phase 1` terpotong oleh `###` pertama dan checklist-nya hilang (0) */
const region = (start) => {
  const lv = levelOf(lines[start]);
  const next = idx.find((i) => i > start && levelOf(lines[i]) <= lv);
  return lines.slice(start, next === undefined ? lines.length : next);
};

/* --- (A) checklist Phase --- */
const phases = lines.map((l, i) => ({ l, i })).filter((x) => /^## Phase \d/.test(x.l));
let aOpen = 0, aPart = 0, aDone = 0;
for (const p of phases) {
  const r = region(p.i);
  aOpen += r.filter((l) => /^[-*] \[ \]/.test(l)).length;
  aPart += r.filter((l) => /^[-*] \[~\]/.test(l)).length;
  aDone += r.filter((l) => /^[-*] \[[xX]\]/.test(l)).length;
}

/* --- (B) gugus tugas `### 2.x` (termasuk sub `#### 2.x.y`) --- */
/* Bentuk task di berkas ini DUA rupa: bullet `- [ ] **SPE-1 —** …` dengan butiran
   `*Dependensi:*`/`*DoD terukur:*` di dalam baris, DAN tabel `| W-13.1 | … |` yang
   kolom dependensi/DoD-nya ada di HEADER tabel, bukan di sel baris. v2 hanya membaca
   rupa pertama sehingga gugus bertabel dilaporkan "0 DoD" — cacat alat, bukan cacat
   dokumen. v3 mengenal dua rupa itu. */
const IDSEL = /^\|\s*(?:`|\*\*)?([A-Z][A-Z0-9]{0,4}[-.][\d.]+|APP-\d+)/;
const DEPRE = /Dependensi|Prasyarat|Tergantung|Didahului|Menunggu/i;
const DODRE = /DoD|Definition of Done|Kriteria selesai|Gerbang|Selesai bila|Uji /i;
const gugus = lines.map((l, i) => ({ l, i })).filter((x) => /^### 2\.\d+/.test(x.l));
const rows = [];
let tAll = 0, tDep = 0, tDod = 0, tIzin = 0, tTahan = 0, gInduk = 0, gStatus = 0, gLarangan = 0;
for (const g of gugus) {
  const r = region(g.i);
  let dep = 0, dod = 0, izin = 0, tahan = 0, n = 0;
  let hdr = null;
  for (let i = 0; i < r.length; i++) {
    const l = r[i];
    if (/^\|/.test(l)) {
      if (/^\|[\s|:-]+$/.test(l)) { hdr = r[i - 1] || ''; continue; }
      if (!IDSEL.test(l)) continue;
      const inTable = hdr !== null;
      n++;
      if (DEPRE.test(l) || (inTable && DEPRE.test(hdr))) dep++;
      if (DODRE.test(l) || (inTable && DODRE.test(hdr))) dod++;
      if (/Izin acuan|RBAC|baris \d+|`\w+\.\w+\.\w+`/i.test(l)) izin++;
      if (/penahan|blocker|📋|📝|🟡|❌|belum/i.test(l)) tahan++;
      continue;
    }
    hdr = null;
    if (/^\s*[-*] \[[ x~]\] \*\*`?[A-Z]+[-.\d]/.test(l)) {
      n++;
      if (DEPRE.test(l)) dep++;
      if (DODRE.test(l)) dod++;
      if (/Izin acuan|RBAC|baris \d+/i.test(l)) izin++;
      if (/penahan|blocker|📋|📝/i.test(l)) tahan++;
    }
  }
  const induk = r.some((l) => /Rujukan induk/i.test(l)) ? 1 : 0;
  const status = r.some((l) => /Status terukur|diukur/i.test(l)) ? 1 : 0;
  const larangan = r.some((l) => /Larangan|tidak boleh|dilarang/i.test(l)) ? 1 : 0;
  gInduk += induk; gStatus += status; gLarangan += larangan;
  tAll += n; tDep += dep; tDod += dod; tIzin += izin; tTahan += tahan;
  const name = g.l.replace(/^### /, '').slice(0, 46);
  rows.push('| ' + name + ' | ' + n + ' | ' + dep + ' | ' + dod + ' | ' + izin + ' | ' + tahan + ' | ' + (induk ? 'ya' : '—') + ' | ' + (larangan ? 'ya' : '—') + ' |');
}

console.log('## Register A — checklist per Phase');
console.log('| Phase | baris |');
console.log('|---|---|');
for (const p of phases) console.log('| ' + p.l.replace(/^## /, '').slice(0, 52) + ' | ' + region(p.i).filter((l) => /^[-*] \[[ x~]\]/.test(l)).length + ' |');
console.log('checkbox Phase: selesai ' + aDone + ' · sebagian ' + aPart + ' · belum ' + aOpen + ' (total ' + (aDone + aPart + aOpen) + ')');
console.log('');
console.log('## Register B — gugus tugas `### 2.x`');
console.log('| Gugus | task | +Dependensi | +DoD | +Izin acuan | +penanda status/penahan | Rujukan induk | Larangan |');
console.log('|---|---:|---:|---:|---:|---:|:---:|:---:|');
rows.forEach((r) => console.log(r));
console.log('');
console.log('TOTAL gugus = ' + gugus.length + ' · task = ' + tAll + ' · ber-Dependensi ' + tDep + ' (' + Math.round(100 * tDep / Math.max(tAll, 1)) + '%) · ber-DoD ' + tDod + ' (' + Math.round(100 * tDod / Math.max(tAll, 1)) + '%) · ber-Izin ' + tIzin + ' · berpenanda-penahan ' + tTahan);
console.log('gugus dengan jangkar Rujukan induk = ' + gInduk + '/' + gugus.length + ' · dengan blok Larangan = ' + gLarangan + '/' + gugus.length);
const ok = tAll > 0 && tDep / tAll >= 0.8 && tDod / tAll >= 0.8;
console.log(ok
  ? 'roadmap-readiness: HIJAU — tiap task gugus menyatakan dependensi dan kriteria selesai'
  : 'roadmap-readiness: PERLU DILIHAT — task tanpa dependensi/DoD = ' + (tAll - tDep) + '/' + (tAll - tDod) + ' (dibaca per gugus di atas, bukan sebagai rata-rata)');
