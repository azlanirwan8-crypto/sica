import { readFileSync, readdirSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';

/* Gerbang penomoran heading tingkat-2.
   Lahir dari cacat nyata 2026-10-21: dua skrip sisip menempelkan blok yang sama dua kali
   di ENV_CONTRACT.md (`## 5` dan `## 7` dobel) dan tidak ada alat yang menangkapnya,
   karena check-docs hanya menjaga konsistensi kolom tabel. Yang diperiksa:
   (a) tidak ada heading `## <angka>.` yang muncul dua kali dalam satu berkas,
   (b) angka heading naik terhadap urutan kemunculan (lubang nomor boleh, mundur tidak). */
const PICT = new Set(['AGENTS.md']);
let dup = 0, back = 0, subBack = 0, loncat = 0;
for (const f of readdirSync(D).filter((x) => x.endsWith('.md')).concat(['../../AGENTS.md']).filter((x) => !PICT.has(x))) {
  const p = f.startsWith('..') ? 'C:/SICA/AGENTS.md' : D + f;
  const lines = readFileSync(p, 'utf8').split(NL);
  const seen = new Map();
  let last = 0;
  /* urutan sub-heading dalam satu induk: `### 15.8` sesudah `### 15.7` harus naik.
     Lubang ini saya lewati sendiri pada 2026-10-21 (§15.8 tersisip sebelum §15.7) karena
     gerbang ini hanya membaca `## ` tingkat-2 — kelas cacat yang sama, kedalaman berbeda. */
  const subLast = new Map();
  let lastMajor = 0;
  for (let i = 0; i < lines.length; i++) {
    const sm = lines[i].match(/^#{2,6}\s+(\d+)\.(\d+)(?:\.(\d+))?\s/);
    if (sm) {
      /* (c) anak yang lebih tua dari induknya: `### 4.19` sesudah `## 5.` berarti blok itu tersisip
         di bawah bab yang salah. Kelas cacat yang sama seperti (a)/(b) tapi tidak tertangkap:
         `subLast` hanya membandingkan sesama angka induk, jadi 4.19 sesudah 5 tampak "naik".
         Ditemukan sendiri saat mengkaji M-01: `API_SPEC §4.19` hidup di dalam `## 5` (`RD-107`). */
      if (Number(sm[1]) < lastMajor) { loncat++; console.log('LONCAT  ' + f + ':' + (i + 1) + ' `' + lines[i].trim().slice(0, 60) + '` berada di bawah `## ' + lastMajor + '`'); }
      const prev = subLast.get(sm[1]);
      const cur = Number(sm[2]);
      if (prev !== undefined && cur < prev) { subBack++; console.log('SUB-MUNDUR ' + f + ':' + (i + 1) + ' `## ' + sm[1] + '.' + cur + '` sesudah `' + sm[1] + '.' + prev + '`'); }
      if (prev === undefined || cur >= prev) subLast.set(sm[1], cur);
    }
    const m = lines[i].match(/^## (\d+)(?:\.(\d+))?[.)]?\s/);
    if (!m) continue;
    const key = m[1] + (m[2] ? '.' + m[2] : '');
    const n = Number(m[1]);
    if (seen.has(key)) { dup++; console.log('DOBEL   ' + f + ':' + (i + 1) + ' `## ' + key + '` (kembar dengan :' + seen.get(key) + ')'); }
    else seen.set(key, i + 1);
    if (n < last) { back++; console.log('MUNDUR  ' + f + ':' + (i + 1) + ' `## ' + key + '` sesudah `## ' + last + '`'); }
    if (n >= last) last = n;
    if (m[2] === undefined && n >= lastMajor) lastMajor = n;
  }
}
console.log('heading-dup: dobel=' + dup + ' mundur=' + back + ' sub-mundur=' + subBack + ' loncat=' + loncat + (dup === 0 && back === 0 && subBack === 0 && loncat === 0 ? ' — HIJAU' : ' — PERLU DIPERIKSA'));
