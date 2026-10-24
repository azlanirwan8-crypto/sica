/**
 * append-551.mjs — menambah baris riwayat §5.51 dan memutakhirkan sel header PROGRESS_REPORT.
 * Baris riwayat ditulis sebagai data, bukan dengan menyalin baris tetangga: alat ini memverifikasi
 * bahwa berkas berakhir pada baris riwayat `| 5.50 |` sebelum menempelkan `| 5.51 |`, supaya
 * sisip buta tidak pernah menghasilkan tabel terputus.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const T = 'docs/PROGRESS_REPORT.md';
const src = readFileSync(T, 'utf8');
const lines = src.split(NL);
while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
const last = lines[lines.length - 1];
if (!/^\| 5\.50 \|/.test(last)) {
  console.error('MERAH — baris terakhir bukan riwayat 5.50: ' + last.slice(0, 60));
  process.exit(1);
}
const row = '| 5.51 | 2026-10-21 | **Format laporan baku ke pemilik produk ditetapkan, lalu alatnya yang diubah — bukan tabelnya yang diketik ulang.** Kolom wajib: `M · Modul · CRUD (C·R·U·D·V) · Rute→handler · Menu §6 · Tabel · Izin · Kode · STATUS SIAP DEV? · Kurang di mana`, dinormakan di `AGENTS §6.1` bersama satu pemilik angka per kolom (`RD-95`), dua larangan baca (`Tabel=0` itu lubang atribusi `PRV-4`, bukan tabel yang hilang; `SPESIFIKASI SIAP` itu vonis spesifikasi, sedangkan `DEV-G1…G7`+`CI-G1…G7` menahan 48 modul), dan tiga perintah cetak (`module-readiness`, `--only=`, `--summary`). `crud-matrix --json` kini mengeluarkan `routeList` supaya enumerasi rute per modul tidak perlu dipindai dua kali; `module-readiness` mencetak tabel sebelas kolom + blok `### Rincian per modul` (semua `METHOD path` per verba, daftar menu lengkap, jumlah tabel berlabel, rincian izin). Vonis `Kode`: kode entitlement/SKU registri, **bukan** kode error — terukur hanya 4 dari 154 baris register `API_SPEC §2.3` yang menyebut token `M-xx`, jadi atribusi error per modul tidak bisa dipindaikan tanpa mengarang. `AUDIT_READINESS §20` diregenerasi dari keluaran alat (96 baris modul; 1092 → 1576 baris). `gate-run` **GATE=29 · INFO=9 · FAIL=0**. |';
writeFileSync(T, lines.join(NL) + NL + row + NL, 'utf8');

const now = readFileSync(T, 'utf8');
const upd = now.replace(
  /\| \*\*Terakhir Diperbarui\*\* \| 2026-10-21 \(siklus kesebelas[^)]*\) \|/,
  '| **Terakhir Diperbarui** | 2026-10-21 (siklus keduabelas — format laporan baku ke pemilik produk dinormakan di `AGENTS §6.1` dan dicetak oleh alat, bukan diketik; lihat §5.51, `AUDIT_READINESS §20`) |'
);
if (upd === now) {
  console.error('MERAH — sel header "Terakhir Diperbarui" tidak cocok pola; tidak diubah.');
  process.exit(1);
}
writeFileSync(T, upd, 'utf8');
console.log('HIJAU — baris 5.51 ditempel dan sel header ditukar ke siklus keduabelas.');
