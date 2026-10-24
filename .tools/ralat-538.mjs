import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';

const rep = [];
const put = (file, anchor, text, label) => {
  const p = D + file;
  let s = readFileSync(p, 'utf8');
  const i = s.indexOf(anchor);
  if (i === -1) { rep.push(label + ': MISS'); return; }
  if (s.lastIndexOf(anchor) !== i) { rep.push(label + ': AMBIG'); return; }
  s = s.slice(0, i) + text + s.slice(i + anchor.length);
  writeFileSync(p, s, 'utf8');
  rep.push(label + ': OK');
};
const tail = (file, text, label) => {
  const p = D + file;
  const s = readFileSync(p, 'utf8');
  writeFileSync(p, s.replace(/\n*$/, NL) + text, 'utf8');
  rep.push(label + ': OK');
};

const sec538 = [
  '### 5.38 Siklus ralat konsistensi silang (2026-10-20) — tanpa objek baru',
  '',
  'Siklus ini tidak menambah spesifikasi. Isinya hanya memperbaiki angka dan rujukan yang **saya tulis sendiri** pada §5.37, lalu mengukur ulang.',
  '',
  '1. **Delapan frasa "berhenti di 145" di API_SPEC.** Ketika §4.16/§4.17 ditulis, register `RBAC_MATRIX §4.5` memang berhenti di 145; pada jam yang sama agen RBAC menerbitkan baris **146–161**. Angka yang benar berubah menjadi basi di dalam satu siklus, dan pembaca yang hanya melihat API_SPEC akan menyimpulkan izin parameter & menu belum terdaftar. Perbaikan: enam titik diubah menjadi "kini mencapai **161**" dengan gugus yang tepat (146–157 `settings.param.*`, 158–161 `platform.menu.*`), §4.16.7 diberi **ralat bertanggal** yang menjelaskan bahwa kolom "usulan # 146+" sudah punya alamat kanonik sementara statusnya tetap `usulan` dan `grep` di `authz.ts` tetap 0 hasil, dan §4.18 (presensi) diperbaiki karena gugus itu memang **belum** masuk register — jadi bedanya sekarang eksplisit, bukan tersamar oleh satu angka umum.',
  '2. **Tiga blok tabel rusak di AUDIT_READINESS §12.** Sel yang memuat `view` dan `edit` dalam satu pola, daftar alternatif `grep`, dan pola regex berpipa mengandung karakter pipa yang dipecah renderer menjadi kolom ekstra (terukur: `kolom=5/6`, `5/7`, `4/6`). Semua ditulis ulang tanpa pipa literal.',
  '3. **Rujukan alat yang tidak ada.** Tiga tempat menyebut `validate-md.mjs`; yang nyata adalah `.tools/check-docs.mjs`. Ini kelas cacat yang sama dengan `RD-37`/`RD-05` (klaim alat/berkas yang tidak ada), jadi nama alatnya saya seragamkan, bukan saya pertahankan dengan alasan.',
  '4. **Klaim placeholder saya koreksi sendiri.** §5.37 menulis "nol placeholder dokumen — dua kemunculan `TODO`". Ukuran sebenarnya: `TBD` 0, `FIXME` 0, `TODO` **8 pada 5 dokumen** — semuanya kutipan penanda kode nyata atau contoh yang dilarang, bukan lubang spesifikasi. Lihat paragraf Placeholder di §5.37 yang sudah diganti.',
  '',
  '**Verifikasi.** `scan-nonlatin` → `scanned=25 nonLatinHits=0`; `check-docs` → `TABEL KONSISTEN` (24 dokumen + AGENTS.md); tidak ada lagi klaim register yang salah di API_SPEC. Tidak ada perubahan kode, jadi `tsc`/`vitest`/`next build` tidak dijalankan.',
  '',
  '**Pelajaran proses yang saya catat supaya tidak berulang:** menulis banyak dokumen dalam satu hari membuat angka silang basi sebelum dibaca orang. Aturan untuk siklus berikutnya — **angka milik satu dokumen induk hanya boleh dikutip oleh dokumen lain dalam bentuk rujukan, bukan salinan numerik**; kalau perlu menyebut angka, sebut beserta tanggal dan alat ukurnya. Inilah sebabnya §4.16.7 kini menunjuk ke `RBAC_MATRIX §4.5`, bukan mengulang "145" atau "161" sebagai fakta miliknya.',
  '',
].join(NL);

put('PROGRESS_REPORT.md', NL + '## 11. Riwayat laporan (bagian 3)' + NL, NL + sec538 + '## 11. Riwayat laporan (bagian 3)' + NL, 'progress-5.38');

tail('PROGRESS_REPORT.md', [
  '| 5.38 | 2026-10-20 | Siklus ralat tanpa objek baru: delapan frasa "berhenti di 145" di API_SPEC diselaraskan dengan register RBAC 146–161 (§4.16.7 diberi ralat bertanggal; §4.18 memang belum tercantum), tiga blok tabel AUDIT_READINESS §12 diperbaiki (pipa literal dalam sel), rujukan alat `validate-md` → `check-docs.mjs` yang nyata, dan klaim placeholder dikoreksi menjadi terukur (`TBD` 0, `FIXME` 0, `TODO` 8 pada 5 dokumen, semuanya kutipan kode). Verifikasi ulang: `nonLatinHits=0`, `TABEL KONSISTEN`. |',
  '',
].join(NL), 'progress-row-538');

const sec124 = [
  '',
  '### 12.4 Ralat konsistensi silang (siklus 5.38, 2026-10-20)',
  '',
  '| ID | Temuan | Kelas | Titik aksi |',
  '|---|---|---|---|',
  '| RD-55 | **Angka silangan dokumen basi di dalam satu siklus.** API_SPEC mengutip "register berhenti di 145" sementara agen RBAC menerbitkan 146–161 pada jam yang sama; AUDIT_READINESS §12 sendiri punya tiga blok tabel rusak karena pipa literal; dan `validate-md.mjs` dirujuk di tiga tempat padahal alat yang ada adalah `check-docs.mjs`. Ketiganya cacat penulisan, bukan cacat desain | MINOR (higiene dokumen) | Diperbaiki siklus ini; normanya: dokumen lain **merujuk**, tidak menyalin angka; bila angka perlu disebut, sebut tanggal dan alat ukur |',
  '',
  'Ukuran akhir setelah ralat: `scan-nonlatin` `nonLatinHits=0` (25 berkas), `check-docs` `TABEL KONSISTEN` (24 dokumen + AGENTS.md), `TODO` tersisa 8 dan semuanya kutipan penanda kode nyata (`TBD`/`FIXME` = 0).',
  '',
].join(NL);

put('AUDIT_READINESS.md', NL + '## 13. Riwayat tambahan (bagian 2)' + NL, NL + sec124 + '## 13. Riwayat tambahan (bagian 2)' + NL, 'audit-12.4');

tail('AUDIT_READINESS.md', [
  '| 1.4 | 2026-10-20 | §12.4: ralat konsistensi silang — delapan frasa "berhenti di 145" di API_SPEC diselaraskan dengan baris 146–161 (ralat bertanggal di §4.16.7; §4.18 presensi dinyatakan memang belum tercantum), tiga blok tabel §12 diperbaiki, rujukan alat phantom `validate-md` → `check-docs.mjs`, kuantifikasi ulang placeholder (`TODO` = 8 kutipan kode, `TBD`/`FIXME` = 0). Gap baru `RD-55` dinormakan sebagai aturan rujukan-ke-rujukan, bukan salinan numerik. |',
  '',
].join(NL), 'audit-row-14');

console.log(rep.join(NL));
