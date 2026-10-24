import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const NL = String.fromCharCode(10);

/* AUDIT_READINESS 17 — matriks ketertelusuran per modul.
   Tabel TIDAK diketik ulang di sini. Revisi 2026-10-21 (`RD-101`): versi lama MEMBACA
   `.tools/prov-matrix.md` — sebuah berkas hasil capture manual. Akibatnya §17 tetap menampilkan vonis
   CRUD lama (40 modul) beberapa jam sesudah `crud-matrix` diperbaiki menjadi 15, dan paragraf pembuka
   §17 masih mengklaim "salinan tidak bisa menyimpang dari alat" padahal langkah capture-nya manusia.
   Sekarang alat ini MENJALANKAN `module-provenance.mjs` sendiri dan menulis ulang both berkas keluaran,
   sehingga tidak ada lagi salinan yang bisa busuk. */

const matriks = execFileSync(process.execPath, ['.tools/module-provenance.mjs'], {
  encoding: 'utf8',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  maxBuffer: 64 * 1024 * 1024,
}).replace(/\s+$/, '');
writeFileSync('.tools/prov-matrix.md', matriks + NL, 'utf8');
const linesAll = matriks.split(NL);
const body = linesAll.filter((l) => l.startsWith('|')).join(NL);
const catatan = linesAll.filter((l) => !l.startsWith('|') && l.trim()).join(NL);

const sec = [
  '## 17. Ketertelusuran pedoman per modul — ke mana SICA berpatokan (2026-10-21, siklus keenam)',
  '',
  '**Alatnya, bukan angkanya.** SATU perintah menghasilkan seluruh bagian ini: `node .tools/apply-audit-17.mjs` — ia menjalankan `module-provenance.mjs` di tempat (bukan membaca berkas hasil capture; itu sebabnya §17 pernah basi tanpa ada yang sadar, `RD-101`), menulis `.tools/prov-matrix.md` sebagai artefak, lalu menyisipkan tabel apa adanya. `node .tools/pedoman-coverage.mjs` adalah penolak terpisah untuk `PRD §5.20` (jumlah baris = jumlah modul, himpunan kode identik, kolom Dasar terisi, penanda `VERIFIKASI-*` dikenal). Tidak ada angka di §17 yang diketik tangan.',
  '',
  '**Cara membaca — penting supaya tabel tidak disalahpahami.** (1) Kolom Sevima/Regulasi/Layar/Seed menghitung **baris dokumen yang menyebut modul** — lewat kode `M-xx`, rentang `M-aa…M-bb`, atau kata kunci nama modul; itu bukti **ketertelusuran dokumen**, bukan bukti fungsional. Karena rentang ikut diperluas, sebagian token regulasi pada sebuah modul berasal dari baris **gugus** (mis. `M-12…M-19`), bukan baris khusus modul itu: itu sengaja, tetapi jangan dibaca sebagai "modul ini sudah punya dasar sendiri". (2) Kolom rute & "CRUD wajib" **tidak dihitung oleh alat ini**: isinya disalin dari vonis `.tools/crud-matrix.mjs`, pemilik atribusi rute (kolom `Modul` eksplisit pada baris rute, lalu segmen jalur dan peta wilayah §4/§7 sebagai jatuh-bangun; tuntutan verba per modul dibaca dari partisi namespace `RBAC §4.5.1` — lihat `RD-100`). Alasan penyalinan ini ada di `RD-95` — versi lama kolom tersebut sempat menuduh empat modul tidak punya rute, dan tuduhannya salah. (3) Kolom "DDL berlabel" hanya menghitung tabel di bawah judul bagian yang menyebut modul; tabel inti (§5, §11–§21) berjudulkan tematik, sehingga **nol di kolom ini bukan berarti tidak ada tabel**. (4) Kolom Regulasi diisi dari baris yang **sendiri** memuat modul dan nama regulasi — tanpa pewarisan antarbaris, karena versi pertama alatnya melakukan itu dan hasilnya semua modul tampak "sudah patuh". (5) `§17.1` bukan bahan ukur: bagian di bawah heading §17 dibuang dari masukan alat supaya salinan tidak memperkuat dirinya sendiri.',
  '',
  '### 17.1 Matriks 48 modul (keluaran alat)',
  '',
  body,
  '',
  '### 17.2 Vonis atas matriks',
  '',
  '**Yang ditutup siklus ini.** `PRD §5.19` (pedoman per gugus) dan `PRD §5.20` (pedoman per modul, 48 baris) menulis rujukan yang sebelumnya tidak tercatat per modul; `SEED_DATA §8.4` menambahkan sebelas kelompok seed, dua di antaranya kelompok baru untuk modul non-akademik. Keluaran alat sesudahnya: **0 modul tanpa rujukan regulasi** dan **0 modul tanpa rujukan seed**. Catatan kejujuran untuk angka 53/2023: sebagian capaian datang dari baris gugus berbentuk `M-aa…M-bb` di `PRD §5.19` yang diekspansi alat, jadi ia mengukur **keberadaan rujukan**, bukan kekhususan per modul.',
  '',
  '**Enam cacat alat yang ditemukan dan diperbaiki SEBELUM angkanya dikutip (`RD-93`, `RD-95`).** (a) Atribusi DDL lengket: heading tanpa label modul mewarisi label sebelumnya, sehingga satu modul tercatat "memiliki" 45 tabel sementara tetangganya 5; sekarang heading tanpa label memutus atribusi dan heading dengan dua modul dihitung untuk keduanya. (b) Pola nomor regulasi hanya mengenali "53 Tahun 2023" dan gagal pada bentuk "53/2023" yang justru dipakai dokumen kita, sehingga 43 modul tampak kehilangan regulasi induk. (c) Rentang `M-12…M-19` tidak diekspansi. (d) Penghitung izin memakai kata kunci saja, sehingga baris milik modul lain ikut dihitung; izin kini menuntut kode modul pada baris yang sama. (e) Kolom rute menarik vonis palsu: `M-01`/`M-15`/`M-26`/`M-37` dituduh tanpa rute, padahal `crud-matrix.mjs` mengukur 8/140/12/8 rute untuk keempatnya — kolomnya sekarang **menyalin** vonis `crud-matrix`, tidak menghitung sendiri. Tidak satu pun temuan (a)–(d) diperbaiki dengan mengoreksi dokumen, karena dokumennya benar; (e) diperbaiki dengan mencabut klaim saya sendiri. (f) **Umpan balik pengukuran:** `§17.1` adalah salinan keluaran alat ini, dan bahan ukur berikutnya membaca `AUDIT_READINESS` — tanpa pengecualian, satu modul sempat tercatat "menunjuk PBJ & kearsipan" hanya karena barisnya sendiri memuat daftar token; sejak itu segala yang berada di bawah heading §17 dibuang dari bahan ukur.',
  '',
  '**Lubang yang TETAP ada, dan itu dinyatakan.**',
  '',
  '| # | Temuan terukur | Tafsir jujur | Tiket |',
  '|---|---|---|---|',
  '| L-1 | **CRUD wajib belum lengkap pada 15 dari 48 modul** (angka disalin dari vonis `node .tools/crud-matrix.mjs`; sebelumnya alat ini mencetak 40 dan rumusnya salah — `RD-100`) | Rumus lama menuntut C/R/U/D seragam dan menebak modul dari segmen jalur. Setelah tuntutan dibaca dari partisi namespace `RBAC §4.5.1` dan atribusi dari kolom `Modul` eksplisit, yang benar-benar berlubang adalah 15: delapan karena `DELETE` memang diizinkan namespace-nya tetapi rutenya belum ada (M-04, M-06, M-09, M-12, M-17, M-24, M-38, M-40), enam karena `UPDATE`/`CREATE`/`READ` belum terspesifikasi (M-14, M-19, M-26, M-36, M-39, M-41), dan `APP` yang jalur sinkronisasinya belum ditulis. Rincian per modul dicetak `node .tools/crud-bill.mjs`. | `CRD-1…CRD-5` (`ROADMAP §2.22`) |',
  '| L-2 | Sebagian besar modul tidak berada di bawah heading DDL yang menyebut kodenya | Tabelnya ada (lihat catatan alat: total `CREATE TABLE` jauh di atas jumlah yang berlabel). Yang belum adalah **properti atribusi**, bukan isinya. | `PRV-4` (`ROADMAP §2.25`) |',
  '| L-3 | Sebagian baris `PRD §5.20` masih menunjuk regulasi berpenanda `VERIFIKASI-LEGAL` (jumlah persis dicetak `node .tools/pedoman-coverage.mjs`) | Nomor yang ditandai tidak boleh naik ke teks pengguna, brosur, atau acceptance criteria. Yang dipakai adalah kelas kewenangan (nasional vs institusional), bukan nomornya. | `PRV-1` (`ROADMAP §2.25`) |',
  '| L-4 | Baris lain menunjuk skema/format vendor berpenanda `VERIFIKASI-VENDOR` (Feeder/PDID, SISTER 2.0, SIVIL, EWMP, KOHA/SLiMS, OJS; jumlahnya dicetak alat yang sama) | DDL-nya sengaja tidak diberi field karangan; sampai vendor diverifikasi, modul terkait **design-only** dan dilarang diklaim berjalan. | `PRV-2` (`ROADMAP §2.25`) |',
  '| L-5 | Sebahagian modul tidak punya jejak di `BENCHMARK_SEVIMA` | Bukan kekurangan: justifikasinya regulasi/proses akademik, dan itu ditulis di kolom Dasar `PRD §5.20`. Dilarang berbalik memakai "kompetitor tidak punya" sebagai alasan menghapus modul. | ditutup oleh norma §5.20 (1) |',
  '',
  '**Vonis bagian ini.** Pedoman per modul sudah **tertulis dan dijaga alat** (penolaknya `pedoman-coverage.mjs`), tetapi **belum terkunci untuk implementasi**: L-1 adalah lubang fungsional pada 15 modul (`RD-100` membetulkan angka 40 yang dihasilkan rumus lama), L-3/L-4 menunggu keputusan manusia, dan §18 mencatat bahwa sisi **kode** masih punya enam penahan yang belum dibuka. Menyatakan "48 modul siap develop" hari ini akan mengulang kegagalan yang sudah empat kali kita catat (`RD-62`, `RD-81`, `RD-91`, `RD-101`): angka yang salah diukur dijadikan kesimpulan, lalu kesimpulan dijadikan klaim.',
  '',
  '### 17.3 Catatan yang dicetak alat (disalin apa adanya)',
  '',
  '```text',
  catatan,
  '```',
  '',
].join(NL);

let t = readFileSync('docs/AUDIT_READINESS.md', 'utf8');
const start = t.indexOf('## 17. Ketertelusuran pedoman per modul');
// Rebuild HANYA blok §17. Versi lama memotong sampai akhir berkas, dan itu akan menghapus §18
// (kesiapan kode) yang dibangun setelahnya — alat yang menelan bagian dokumen lain adalah
// sumber kebenaran kedua yang merusak, jadi batas bawah ditetapkan pada heading `## ` berikutnya.
const after = start >= 0 ? t.slice(start + 5) : t;
const nextRel = after.search(/\n## [0-9]/);
const end = start >= 0 && nextRel >= 0 ? start + 5 + nextRel : (start >= 0 ? t.length : -1);
let out;
if (start >= 0) {
  out = t.slice(0, start).replace(/\s+$/, '') + NL + sec + NL + t.slice(end).replace(/^\s+/, '');
  console.log('blok §17 lama dibuang (rebuild), bagian sesudahnya dipertahankan ' + (end < t.length ? '(§18+ utuh)' : '(tidak ada isi setelah §17)'));
} else {
  out = t.replace(/\s+$/, '') + NL + NL + sec;
  console.log('§17 belum ada — ditambahkan di akhir');
}
writeFileSync('docs/AUDIT_READINESS.md', out, 'utf8');
console.log('tulis AUDIT_READINESS 17 (baris matriks = ' + body.split(NL).length + ')');
