// apply-dm-m01.mjs — menambah heading §3.2 (Identitas & akses, M-03) di dalam blok DDL §3 dengan
// menutup pagar ```sql lebih dulu dan membukanya lagi. Berbasis asersi: kalau bentuk berkas tidak
// seperti yang diharapkan, alat berhenti — tidak menebak posisi (kelas kegagalan RD-103).
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const P = 'docs/DATA_MODEL.md';
const L = readFileSync(P, 'utf8').split(NL);

const iIdent = L.findIndex((l) => /^-- \u2500\u2500 IDENTITAS GLOBAL/.test(l));
if (iIdent < 0) { console.error('ASERSI GAGAL — penanda IDENTITAS GLOBAL hilang.'); process.exit(1); }
const iUsers = L.findIndex((l, i) => /^CREATE TABLE users \(/.test(l) && i > iIdent && i - iIdent <= 8);
if (iUsers < 0) { console.error('ASERSI GAGAL — `CREATE TABLE users` tidak berada dalam 8 baris setelah IDENTITAS GLOBAL.'); process.exit(1); }
if (L.some((l) => /^### 3\.2 /.test(l))) { console.log('§3.2 sudah ada — tidak ada yang ditulis.'); process.exit(0); }

const blok = [
  '```',
  '',
  '### 3.2 Identitas & akses (M-03)',
  '',
  'Dua belas tabel mulai `users` adalah rumah **M-03** (registri [PRD §5.12.1](file:///c:/SICA/docs/PRD.md):',
  '"Menyimpan dan menegakkan penugasan peran ber-scope"). Pemisahannya dari §3.1 bukan selera: hak',
  'dibaca dari `user_role_assignments` (scope + `valid_to`), sedangkan `tenants`/`plans`/`subscriptions`',
  'adalah keadaan komersial yang hanya dapat ditulis jalur platform (`RBAC §4.5.3` baris 302\u2013318).',
  'Tanpa dua heading berlabel ini, alat pemeta modul tidak bisa membedakan enam tabel M-01 dari dua',
  'belas tabel M-03 karena keduanya berada di bawah judul tematik yang sama (celah atribusi `PRV-4`).',
  '',
  '```sql',
  '',
];

const out = [...L.slice(0, iIdent), ...blok, ...L.slice(iIdent)];
writeFileSync(P, out.join(NL), 'utf8');
const fences = (out.join(NL).match(/^```/gm) || []).length;
console.log('§3.2 (M-03) disisipkan sebelum baris ' + (iIdent + 1) + ' (pagar sql ditutup lalu dibuka lagi)');
console.log('jumlah baris pagar ``` di DATA_MODEL = ' + fences + ' (harus genap) ' + (fences % 2 === 0 ? 'OK' : 'GANJIL — BERHENTI'));
if (fences % 2 !== 0) process.exit(1);
