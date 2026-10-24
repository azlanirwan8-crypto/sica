/**
 * apply-rbac-62-m02.mjs — menaruh M-02 di MATRIKS peran × menu × aksi (`RBAC §6.2`), bukan hanya di
 * daftar rute admin §6.5. Kenapa: sebelum siklus ini laporan 48 modul mencetak "Menu §6 = 2" untuk
 * M-02, dan keduanya tersambung lewat kebetulan prefik rute API. Padahal layar Kamus, Atribut
 * Kustom, Parameter Sistem, Meta Konfigurasi, Impor, dan Editor Menu adalah menu nyata dengan peran
 * dan aksi yang sudah punya baris katalog ber-nomor. Sekalian: baris 158–161 (`platform.menu.*`)
 * adalah mesin menu FR-ADM-26 milik M-02 yang ber-prefix `platform` hanya karena carrier lisensinya
 * di sana — pemilik fungsionalnya sekarang ditulis.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const T = 'docs/RBAC_MATRIX.md';
let lines = readFileSync(T, 'utf8').split(NL);

/* 1. label pemilik pada baris 158–161 */
let labeled = 0;
lines = lines.map((l) => {
  const m = l.match(/^\|\s*(15[89]|16[01])\s*\|\s*`platform\.menu\./);
  if (!m) return l;
  if (/M-02/.test(l)) return l;
  const c = l.split('|');
  c[c.length - 2] = c[c.length - 2].replace(/\s+$/, '') + ' · pemilik fungsional: **M-02** (FR-ADM-26, mesin menu sebagai data); prefix `platform` hanya carrier lisensi (`G-29`)';
  labeled++;
  return c.join('|');
});
if (labeled !== 4) { console.error('MERAH — baris 158–161 yang dilabeli = ' + labeled + ' (dijadwalkan 4).'); process.exit(1); }

/* 2. delapan baris menu §6.2 */
const ROWS = [
  '| `TENANT_ADMIN` | `master` · M-02 | Data Master → Kamus & Referensi | C R U D | `master.kind.view` (127), `master.kind.manage` (128), `master.item.view/.create/.update/.deactivate/.reorder` (129–133), `master.item.merge` (134) | satu layar "Data Referensi" bertab (FR-ADM-19): tab dibaca dari katalog gugus, bukan daftar di kode; menambah nilai baru mengubah dropdown tanpa deploy (AC-MD-2); `merge` ber-alasan dan satu langkah (AC-MD-8) |',
  '| `ADMIN_ACADEMIC` | `master` · M-02 | Data Master → Kamus & Referensi | C R U D | sama + `master.impact.view` (135), `master.usage.view` (136) | BAAK memegang kamus wilayah akademik; hapus keras atas nilai terpakai ditolak service layer dan penolakannya membawa `offeredRemedy` (AC-MD-9, `409 LOOKUP_ITEM_IN_USE`) |',
  '| `HEAD_OF_PROGRAM` | `master` · M-02 | Data Master → Kamus Prodi | R U | `master.item.view` (129), `master.item.update` (131), `master.item.reorder` (133) | hanya kind ber-scope prodi; **tidak** dapat mendaftar jenis kamus baru (128 tetap Admin) dan tidak dapat melonggarkan kamus nasional kelas B (AC-MD-7) |',
  '| `TENANT_ADMIN` | `settings` · M-02 | Pengaturan → Parameter Sistem | R C U | `settings.param.view.<kelas>` (146/148/150/152/154/156), `settings.param.edit.<kelas>` (147/149/151/153/155/157), `settings.param.register` (323), `settings.param.pattern.manage` (324), `settings.param.history.view` (325), `settings.param.impact.view` (326) | enam kelas parameter dalam satu layar dengan baca-per-kelas; kunci baru lahir dengan kelas + `min/max_value` + unit + modul pemilik; nilai `pending` tidak terbaca siapa pun (AC-PG-2/AC-PG-3) |',
  '| `TENANT_ADMIN` | `settings` · M-02 | Pengaturan → Persetujuan Parameter | R U | `settings.param.approve.regulatory` (327), `settings.param.approve.security` (328) | empat-mata ditegakkan `CHECK` di DB, penyetuju **berbeda** dari pemohon dan tidak memegang peran atas objek yang dipengaruhi ambangnya; MFA wajib (BR-PG2, AC-PG-4) |',
  '| `TENANT_ADMIN` | `settings` · M-02 | Pengaturan → Atribut Kustom | C R U D | `settings.customattr.view/.create/.update/.activate/.retire` (137–141), `settings.customattr.value.view/.value.update` (142/143), `settings.customattr.history.view` (144) | mendefinisikan atribut tidak boleh menciptakan keadaan mesin; berpilihan wajib menunjuk `options_kind` kamus; aktivasi butuh empat-mata dan plafon 40 atribut terspesialisasi (AC-MD-4/AC-MD-5) |',
  '| `TENANT_ADMIN` | `settings` · M-02 | Pengaturan → Meta Konfigurasi Form & Laporan | R U | `settings.meta.view` (321), `settings.meta.update` (322) | label/urutan/visibilitas kolom + template laporan + blok tanda tangan per tenant (FR-ADM-09); perubahan PII dibacakan ke peran subjek data dan tidak pernah membuka kolom `SERVER_ONLY` (AC-MD-10) |',
  '| `TENANT_ADMIN` | `master` · M-02 | Area Admin → Impor Data Master | R V C | `master.import.validate` (319), `master.import.commit` (320) | tiga langkah unggah → validasi → komitmen dengan dua aksi berbeda; temuan `BLOCK` berarti nol baris tertulis (AC-ADM-2) |',
  '| `TENANT_ADMIN` | `platform` · M-02 | Pengaturan → Menu & Grant | C R U D | `platform.menu.view` (158), `platform.menu.manage` (159), `platform.menu.grant` (160), `platform.menu.revoke` (161) | pohon menu per tenant sebagai data (FR-ADM-26), kedalaman maksimum empat tanpa siklus; **penyaringan menu bukan kontrol akses** — gerbang server tetap `requireDataPrincipal` + scope (AC-PG-8) |',
];
const i62 = lines.findIndex((l) => l === '| `TENANT_ADMIN` | `audit` | Pengaturan → Audit | R | `audit.log.view` | Seluruh aksi administratif tenant |');
if (i62 < 0) { console.error('MERAH — jangkar baris `Pengaturan → Audit` di §6.2 tidak ditemukan.'); process.exit(1); }
lines.splice(i62 + 1, 0, ...ROWS);

const text = lines.join(NL);
if ((text.match(/· M-02 \| /g) || []).length < 9) { console.error('MERAH — sembilan baris menu M-02 tidak semuanya tertempel.'); process.exit(1); }
writeFileSync(T, text, 'utf8');
console.log('HIJAU — 4 baris katalog (158–161) menyebut pemilik fungsional M-02 · 9 baris peran×menu×aksi baru di §6.2.');
