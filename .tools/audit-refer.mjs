import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const p = 'C:/SICA/docs/AUDIT_READINESS.md';
let s = readFileSync(p, 'utf8');
const rep = [];
const job = (label, a, b) => {
  const i = s.indexOf(a);
  if (i === -1) { rep.push(label + ': MISS'); return; }
  if (s.lastIndexOf(a) !== i) { rep.push(label + ': AMBIG'); return; }
  s = s.slice(0, i) + b + s.slice(i + a.length);
  rep.push(label + ': OK');
};

/* §12.4 — vonis tanpa angka; angka tinggal di log siklus yang bertanggal */
job('12.4-no-numbers',
  '**Angka placeholder di baris ini sudah dua kali basi dan kini dipindahkan ke alat ukur.** Ukur `node .tools/placeholder-count.mjs` pada 2026-10-21: `TODO` **21** pada 15 baris di 6 dokumen, `TBD` **6**, `FIXME` **5**, `XXX` **1** — **seluruhnya kutipan**, bukan placeholder dokumen: tiap kemunculan adalah penanda `TODO` yang memang ada di berkas `route.ts` nyata, atau kalimat yang sedang melaporkan hitungan itu sendiri. Vonisnya tidak berubah (nol placeholder spesifikasi), angka laporannya berubah setiap kali dokumen bertambah, dan karena itu angka ini tidak lagi ditulis tangan di tempat lain. Lihat `RD-62`.',
  '**Angka placeholder tidak lagi ditulis di bagian ini** — ia sudah dua kali basi dalam satu siklus, dan penyebabnya bagian ini sendiri (lihat `RD-62`). Yang normatif di sini hanyalah vonisnya: **nol placeholder spesifikasi** di `/docs`. Tiap kemunculan token adalah penanda `TODO` yang memang ada di berkas kode nyata (mis. `route.ts:46-47`, `krs/approve/route.ts:31`) atau kalimat yang sedang melaporkan hitungan. Cara mengukur: `node .tools/placeholder-count.mjs`. Hasil bertanggal tinggal di `PROGRESS_REPORT §5.39.2`, karena log siklus memang dibuat bertanggal; tempat lain menunjuk alatnya, bukan menyalin angkanya.');

/* RD-62 butir (a) — merujuk, tidak menyalin */
job('rd62a-no-numbers',
  '(a) Siklus 5.38 memublikangkan "`TODO` 8 pada 5 dokumen; `TBD`/`FIXME` 0". Ukuran ulang 2026-10-21: `TODO` **21** pada 15 baris di 6 dokumen, `TBD` **6**, `FIXME` **5**, `XXX` **1**. Vonisnya tetap sama (semuanya kutipan, nol placeholder spesifikasi) tetapi angka publikasinya sudah tidak benar sejak gelombang ketujuh menambah baris.',
  '(a) Siklus 5.38 memublikangkan "`TODO` 8 pada 5 dokumen; `TBD`/`FIXME` 0", dan satu hari kemudian angka itu sudah tidak benar — bukan karena dokumennya salah tulis, melainkan karena dokumennya bertambah. Vonisnya tidak berubah (**nol placeholder spesifikasi**; semua kemunculan adalah kutipan), tetapi yang diterbitkan sekarang adalah **alat ukurnya**, bukan hasilnya; hasil bertanggal tinggal di `PROGRESS_REPORT §5.39.2`. Ironi yang layak dicatat di sini: kalimat yang melaporkan jumlah token justru menambah token, sehingga penghitung apa pun naik setiap kali ralat ditulis.');

writeFileSync(p, s, 'utf8');
console.log(rep.join(NL));
