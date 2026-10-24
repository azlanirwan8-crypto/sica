/**
 * apply-prd-m02.mjs — menutup tiga lubang M-02 di `PRD.md` yang tidak terlihat oleh penjaga mana pun:
 *   (a) registri `§5.12.1` menulis kebutuhan sebagai `FR-ADM-07/09/12/19…29` — bentuk campur yang
 *       hanya dibaca alat sampai nomor 19, sehingga FR-ADM-20…29 (mesin kamus & parameter) tidak
 *       pernah terhitung milik M-02 diukur pun. Ditulis ulang menjadi daftar ber-spasi;
 *   (b) `FR-ADM-21` (penggabungan kode), `FR-ADM-12` (dampak sebelum hapus/ubah) dan `FR-ADM-09`
 *       (meta-konfigurasi mandiri) belum punya SATU pun acceptance criteria — padahal `AGENTS §3.11`
 *       melarang progress tanpa norma yang bisa diterima/ditolak. Ditambah `AC-MD-8/9/10`;
 *   (c) paragraf konsekuensi AC belum mendaftarkan tiga kriteria baru itu, sehingga pembaca §5.10
 *       mengira tujuh `AC-MD` sudah genap.
 * Semua edit berjangkar persis; satu jangkar meleset = tidak ada yang ditulis.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const T = 'docs/PRD.md';
let text = readFileSync(T, 'utf8');
const must = (needle, value, label) => {
  const n = text.split(needle).length - 1;
  if (n !== 1) { console.error('MERAH — jangkar ' + label + ' cocok ' + n + ' kali. Berkas tidak ditulis.'); process.exit(1); }
  text = text.replace(needle, value);
};

/* (a) sel kebutuhan registri M-02 */
must('| M-02 | Master Parameter · Admin IT | `—` (gerbang peran `TENANT_ADMIN`) | SEBAGIAN | FR-ADM-07/09/12/19…29, §5.10–§5.11 |',
  '| M-02 | Master Parameter · Admin IT | `—` (gerbang peran `TENANT_ADMIN`) | SEBAGIAN | FR-ADM-07 · FR-ADM-09 · FR-ADM-12 · FR-ADM-15 · FR-ADM-19 … FR-ADM-29, §5.10–§5.11 |',
  'sel kebutuhan M-02');

/* (b) tiga blok AC baru, ditempel tepat sebelum AC-ALG-1 */
const AC = [
  '**AC-MD-8 (penggabungan kode: satu langkah, beralasan, dan riwayat tidak ditulis ulang)**',
  'Given dua item pada satu `kind` kamus — A yang sudah dirujuk baris transaksi dan B yang masih `merged_into_id IS NULL`',
  'When admin menggabungkan A → B tanpa `reason`; lalu ketika tujuan B sudah melebur ke item lain; lalu ketika penggabungan diminta lintas `kind`; lalu ketika pembaca lama membuka laporan periode sebelum tanggal merge dengan `?at=`',
  'Then (a) tanpa alasan → `422` di transport (alasan adalah bagian dari aksi, bukan isian opsional); (b) rantai **satu langkah** ditegakkan: tujuan yang sudah melebur ditolak `409 LOOKUP_MERGE_CYCLE`, karena dua langkah membuat "nilai mana yang berlaku hari itu" tidak dapat dijawab; (c) lintas `kind` ditolak dengan sebab, bukan disimpan lalu diabaikan; (d) hanya `master.item.merge` (baris 134) yang boleh, dan **penyetuju berbeda dari pengusul** (empat-mata); (e) nilai historis **tidak pernah** ditulis ulang — `merged_into_id` dibaca lewat resolusi satu langkah bersama `?at=`, sehingga transkrip periode lama menampilkan label yang sama seperti saat diterbitkan dan `audit_logs` memuat before/after + actor + waktu + alasan; hapus keras atas item terpakai tetap ditolak service layer (BR-MD3, `409 LOOKUP_ITEM_IN_USE`). _Rujukan: FR-ADM-21, BR-MD3, [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md) §20.4/§20.8, [API_SPEC.md](file:///c:/SICA/docs/API_SPEC.md) §4.14.2 & §4.14.6, [RBAC_MATRIX.md](file:///c:/SICA/docs/RBAC_MATRIX.md) baris 134._',
  '',
  '**AC-MD-9 🔒 (dampak dibaca lebih dulu, dan penolakan membawa jalan keluar)**',
  'Given admin hendak menonaktifkan/menghapus satu nilai kamus yang terpakai, atau mengubah ambang parameter kelas `SECURITY`/`REGULATORY`',
  'When jalur tulis dipanggil tanpa membaca pratinjau dampak lebih dulu, atau ketika dampak menunjukkan rujukan terpakai, atau ketika nilai parameter diajukan tetapi belum disetujui',
  'Then (a) penolakannya `409 LOOKUP_ITEM_IN_USE` dan **wajib** membawa `offeredRemedy` — nonaktifkan lunak, daftar permukaan yang memakai (`surfaces[]` dari `reference_kind_usage`), jumlah baris + pemakaian terakhir, dan tautan layar rumahnya; (b) angka pemakaian dihitung **di bawah RLS tenant**, bukan dari tabel global, sehingga satu tenant tidak melihat pola pemakaian tenant lain; (c) parameter berkeadaan `pending` tidak terbaca oleh konsumen mana pun — `GET /settings/effective` mengembalikan nilai yang berlaku + `parameter_version`, bukan nilai yang sedang diajukan; (d) penolakan terjadi di service layer, bukan hanya tombol yang disembunyikan di UI; (e) tanpa izin baca dampak (`master.impact.view` 135 / `settings.param.impact.view` 326) jalur tulis tetap gagal — izin tulis tidak menyiratkan izin dampak. _Rujukan: FR-ADM-12, FR-ADM-24, BR-PG1/BR-PG2, AC-PG-2/AC-PG-3, [API_SPEC.md](file:///c:/SICA/docs/API_SPEC.md) §4.14.2/§4.16.3, [RBAC_MATRIX.md](file:///c:/SICA/docs/RBAC_MATRIX.md) baris 132/135/326._',
  '',
  '**AC-MD-10 (meta-konfigurasi mandiri: mengubah tampilan, tidak pernah menciptakan keadaan)**',
  'Given `TENANT_ADMIN` menyusun label, urutan, dan visibilitas kolom pada form data master, template laporan, dan blok tanda tangan (FR-ADM-09)',
  'When permintaannya (a) menandai kolom `SERVER_ONLY` sebagai dapat-disunting, (b) menyembunyikan kolom PII hanya di layar sementara nilainya tetap dikirim ke klien, (c) mengubah visibilitas kolom PII, atau (d) meminta keadaan mesin disimpan sebagai meta; lalu ketika layar Web dan Flutter membaca hasil yang sama',
  'Then (a) ditolak di transport — meta tidak pernah menerima daftar kolom yang bisa ditulis, dan `grades.status`, `grades.letter`, `invoices.status`, `payments.status`, `ledger.*`, `enrollments.status`, `students.nim`, `students.status_akademik`, `mfa_factors.secret`, `pddikti_*_id` tetap hanya berubah lewat transisi keadaan; (b) yang berubah adalah **proyeksi server** (`FIELD_RULES` + `role_view`/`role_edit` pada definisi atribut), bukan penyembunyian sel di klien — uji penolakannya: respons untuk peran tanpa hak tidak memuat kolom itu sama sekali; (c) perubahan tercatat di `audit_logs` sebelum/sesudah + MFA + `settings.meta.update` (baris 322) dan wajib dibacakan ke peran subjek data (UU PDP 27/2022); (d) permintaan yang mencoba menjadi pasangan kunci-nilai di mesin parameter ditolak dengan sebab "rumahnya bukan di sini" (BR-PG1, AC-PG-9); (e) satu perubahan label terlihat identik di Web dan Flutter tanpa deploy (paritas [AGENTS.md](file:///c:/SICA/AGENTS.md) §3.4), dan meta tidak dapat menambah nilai enum baru. _Rujukan: FR-ADM-09, FR-ADM-22, [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md) §14.3/§20.5, [API_SPEC.md](file:///c:/SICA/docs/API_SPEC.md) §4.14.3/§4.14.5, [RBAC_MATRIX.md](file:///c:/SICA/docs/RBAC_MATRIX.md) baris 321–322, [BLUEPRINT_ROLE_BY_ROLE.md](file:///c:/SICA/docs/BLUEPRINT_ROLE_BY_ROLE.md) §0.3._',
  '',
  '',
];
must(NL + '**AC-ALG-1 🔒 (papan jadwal otomatis: parsial tidak pernah disajikan sebagai selesai)**',
  NL + AC.join(NL) + '**AC-ALG-1 🔒 (papan jadwal otomatis: parsial tidak pernah disajikan sebagai selesai)**', 'blok AC-ALG-1');

/* (c) daftarkan tiga AC baru pada paragraf konsekuensi gelombang kelima */
must(NL + NL + '### 5.11 Gelombang keenam — mesin parameter operasional, menu dinamis, presensi multi-modus, dan rantai lifecycle (2026-10-20)',
  NL + NL + '**Tambahan hasil kajian pakar M-02 (2026-10-21, bukan gelombang baru).** Tiga kriteria ditutup: `AC-MD-8` menggabungkan kode (satu langkah, beralasan, riwayat tidak ditulis ulang), `AC-MD-9` pratinjau dampak sebelum tulis/hapus dengan `offeredRemedy`, `AC-MD-10` meta-konfigurasi yang tidak boleh menciptakan keadaan mesin atau membuka kolom `SERVER_ONLY`. Ketiganya menjawab FR yang sebelumnya **tidak punya AC sama sekali** — `FR-ADM-21`, `FR-ADM-12`, `FR-ADM-09` — dan titik aksinya sekarang bernomor di [RBAC_MATRIX.md](file:///c:/SICA/docs/RBAC_MATRIX.md) §4.5 (baris 132/134/135) serta §4.5.7 (baris 319–328). Nomor `AC-MD` berikutnya dimulai dari 11; daftar lengkap dibaca dari `node .tools/fr-ac-gap.mjs`, bukan dari paragraf ini.'
  + NL + NL + '### 5.11 Gelombang keenam — mesin parameter operasional, menu dinamis, presensi multi-modus, dan rantai lifecycle (2026-10-20)',
  'paragraf konsekuensi sebelum §5.11');

const nAc = (text.match(/^\*\*AC-MD-(8|9|10)/gm) || []).length;
if (nAc !== 3) { console.error('MERAH — AC-MD-8/9/10 tidak lengkap (dapat ' + nAc + ').'); process.exit(1); }
if ((text.match(/AC-MD-8/g) || []).length < 2) { console.error('MERAH — AC-MD-8 tidak terdaftar di dua tempat (blok + konsekuensi).'); process.exit(1); }
writeFileSync(T, text, 'utf8');
console.log('HIJAU — sel registri M-02 dibakukan · AC-MD-8/9/10 ditulis · konsekuensi AC didaftarkan.');
