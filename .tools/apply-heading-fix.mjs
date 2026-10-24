// apply-heading-fix.mjs — memindahkan dua heading yang menempel pada induk yang salah (temuan LONCAT
// milik .tools/heading-dup.mjs, didaftarkan sebagai RD-107). Hanya memindah baris heading, tidak
// menulis ulang isi — jadi tidak ada nomor bagian yang berubah dan tidak ada rujukan yang menjadi basi.
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

const pindah = (fail, ambil, letakkanSebelum, label) => {
  const L = readFileSync(fail, 'utf8').split(NL);
  const i = L.findIndex(ambil);
  if (i < 0) { console.error('ASERSI GAGAL — ' + label + ': heading sumber tidak ditemukan di ' + fail + '.'); process.exit(1); }
  // ambil blok sampai baris kosong sebelum heading berikutnya
  let e = i;
  while (e + 1 < L.length && !/^#{2,4} /.test(L[e + 1])) e++;
  const blok = L.slice(i, e + 1);
  const sisa = [...L.slice(0, i), ...L.slice(e + 1)];
  const j = sisa.findIndex(letakkanSebelum);
  if (j < 0) { console.error('ASERSI GAGAL — ' + label + ': heading tujuan tidak ditemukan di ' + fail + '.'); process.exit(1); }
  const out = [...sisa.slice(0, j), ...blok, ...sisa.slice(j)];
  // rapikan: jangan ada tiga baris kosong berturut-turut di sekitar bekas pemindahan
  const bersih = [];
  for (const l of out) {
    if (l === '' && bersih.length >= 2 && bersih[bersih.length - 1] === '' && bersih[bersih.length - 2] === '') continue;
    bersih.push(l);
  }
  writeFileSync(fail, bersih.join(NL), 'utf8');
  console.log(label + ': ' + blok.length + ' baris dipindah dari :' + (i + 1) + ' ke sebelum :' + (j + 1) + ' di ' + fail);
};

// API_SPEC: `## 5.` menempel tepat sebelum `### 4.19` -> harus berada tepat sebelum `### 5.1`
pindah('docs/API_SPEC.md',
  (l) => /^## 5\. Inventaris Endpoint Lengkap\s*$/.test(l),
  (l) => /^### 5\.1 Otentikasi & sesi/.test(l),
  'API_SPEC §5');

// PROGRESS: `## 10. Riwayat laporan (lanjutan)` + tabelnya menempel di tengah bab 5 -> taruh sesudah
// seluruh 5.x, tepat sebelum `## 11.`
pindah('docs/PROGRESS_REPORT.md',
  (l) => /^## 10\. Riwayat laporan \(lanjutan\)\s*$/.test(l),
  (l) => /^## 11\. Riwayat laporan \(bagian 3\)/.test(l),
  'PROGRESS §10');
