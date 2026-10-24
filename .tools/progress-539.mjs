import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const p = 'C:/SICA/docs/PROGRESS_REPORT.md';
let s = readFileSync(p, 'utf8');

const sec = [
  '### 5.39 Siklus 2026-10-20 (bagian 4) — Gelombang ketujuh dirampungkan: registri 47 modul, dan ukuran yang saya betulkan dari pekerjaan sendiri',
  '',
  'Siklus ini **tanpa satu baris kode produk pun**, sesuai perintah pemilik: `/docs` masih dalam tahap review dan belum terkunci untuk eksekusi. Isinya perluasan spesifikasi 47 modul + SuperApp ke tujuh berkas, lalu **pengukuran ulang seluruh angka yang diterbitkan siklus itu** — termasuk angka yang saya tulis sendiri.',
  '',
  '#### 5.39.1 Apa yang masuk ke dokumen (bukan ringkasan agen, tetapi hasil yang saya buka sendiri)',
  '',
  '| Berkas | Bagian baru | Isi | Ukuran akhir |',
  '|---|---|---|---|',
  '| `PRD.md` | §5.12, §5.13, §5.14 | Registri 48 modul bisnis (47 + `APP`) dengan kolom `M-xx` · peran sasaran · entitlement · status · rumah FR/AC · tanggung jawab tunggal; 14 vonis deduplikasi; kebutuhan bisnis gugus `NOL` | **48 baris** terukur; tally **11 PENUH / 23 SEBAGIAN / 14 NOL**; **17** kode entitlement usulan + **19** nyata; §5.14: 75 FR, 66 kunci parameter, 20 kamus, 21 uji penolakan |',
  '| `DATA_MODEL.md` | §22 | Skema 21 modul baru: DDL, FK, RLS, register objek, nomor migrasi | **119** `CREATE TABLE` (119 unik, nol duplikat), **4** view, **26** tipe enum kelas-A, migrasi **0051–0072** (22 nomor baru; `0050` sudah ada) |',
  '| `ARCHITECTURE.md` | §13 | Rantai data lintas modul, katalog peristiwa, vonis jalur real-time, lima skenario simulasi, `ALG-19…ALG-24` | **42** peristiwa `modul.entitas.aksi` (42 unik); vonis: SSE untuk server→klien, WebSocket **hanya** M-17 dan M-43; BullMQ/ioredis tetap **design-only** |',
  '| `API_SPEC.md` | §7.1–§7.24, §2.3, §4.1.2 | 21 gugus rute modul baru + register kode error + penulisan ulang kontrak MFA | **267** baris rute (**82** `spec-only`, **185** `blocker`, **0** `implemented`) — dicocokkan **per gugus**, bukan hanya total; register §2.3 **144** baris (144 unik, nol lubang, nol duplikat), termasuk baris 144 `MFA_NOT_IMPLEMENTED` |',
  '| `RBAC_MATRIX.md` | §4.5.1, §6.7, §7.6, §10 | 130 titik aksi gelombang-4, sub-detail lima gugus, pasangan empat-mata baru, celah | baris **162–291** (nol duplikat, nol lubang); verba `READ` 35 · `VALIDATE` 31 · `INSERT` 25 · `UPDATE` 19 · `OTHER` 18 · `DELETE` 2; **17** pasangan empat-mata; **30** baris celah `G-*`; normatif tetap 222 izin / 17 peran / 607 grant |',
  '| `UI_UX_DESIGN.md` | §17, §18 | Grid kartu dinamis per peran + pola layar modul `NOL` | matriks **73** baris peran→kartu (**72** baris `M-xx` + **1** baris `APP`, 47 kode modul unik) — menutup keenam daftar peran pemilik; **16** heading §18, yang **12** di antaranya blok layar 18.1–18.12 |',
  '| `SECURITY_COMPLIANCE.md` | §13 | Kelas data khusus, kripto vault, TOTP/QR/geofence, penahan rilis | **36** kontrol `SC-G4-01…36`; **27** kode `SEC-*` ditemukan berkas ini (termasuk `SEC-26…31` siklus ini) |',
  '| `INTEGRATIONS.md` | §6 | Peta sistem nasional → modul, norma transport, delta sync, kamus, register | §6.1 **15** sistem (bukan 16 seperti yang saya tulis di §6.7); §6.7 **16** baris register untuk 21 modul; **32** tanda `[VERIFIKASI-RESMI]` |',
  '| `ROADMAP_TASKS.md` | §2.20 | Sembilan irisan eksekusi `M47-0…M47-8` + invariance + baris pertama | **9** irisan; urutan tetap `SEC-0` → `M47-1` → … → `M47-8` (kelas data khusus dan permukaan real-time terakhir) |',
  '',
  '#### 5.39.2 Ralat yang saya temukan dengan mengukur, bukan dengan membaca',
  '',
  '| # | Yang saya ralat | Sebelum → sesudah | Cara ukur |',
  '|---|---|---|---|',
  '| 1 | Angka placeholder dikutip sebagai milik dokumen | `TBD` dan `FIXME` saya laporkan **0**; `TODO` **8 pada 5 dokumen** → `TODO` **21 pada 15 baris/6 dokumen**, `TBD` **6**, `FIXME` **5**, `XXX` **1** — dan itu semua **kutipan** (penanda `TODO` di berkas kode nyata, atau kalimat yang sedang melaporkan hitungan), bukan placeholder spesifikasi | `.tools/placeholder-count.mjs`, dicocokkan baris demi baris |',
  '| 2 | Tally registri di baris riwayat | riwayat 1.5 tertulis **11/21/16** → **11/23/14** sesuai tabel final `PRD §5.12` | dihitung ulang dari tabel, bukan dari ingatan |',
  '| 3 | Angka register disalin ke indeks | `INDEX` gelombang-6 menulis `register §2.3 = 118` (basi) → indeks kini **merujuk** dan tidak menyalin angka; versi 144 hanya hidup di `API_SPEC §5.15` | `grep` baris §2.3 yang berawalan kode HTTP: 144 unik, nol lubang |',
  '| 4 | Jumlah sistem integrasi | §6.1 saya klaim **16** adapter → terukur **15** baris sistem; 16 adalah jumlah **baris register §6.7** untuk 21 modul | pemotongan bagian §6.1 dan penghitungan baris tabel |',
  '| 5 | Jumlah baris matriks grid | saya tulis **73** baris peran→kartu; bentuk barisnya campuran (`M-xx` dan satu `APP`) → terukur **72 + 1 = 73** untuk **47** kode modul unik | penghitung per pola baris di §17.2 |',
  '| 6 | Klaim `RD-61` saya sendiri | draf pertama menyebut **78 `academic`** dan menyisakan empat baris ke `hr_bkd` → terukur **82 `academic`, 31 `finance`, 14 `audit`, 3 `settings`**; `hr_bkd` **bukan** nilai `PermissionModule` yang sah | `.tools/measure-451.mjs` atas kolom ketiga baris 162–291 |',
  '',
  '#### 5.39.3 `RD-61`: koreksi saya yang salah, dan itu saya catat',
  '',
  'Empat baris izin SISTER (174–177) saya pindahkannya dari `academic` ke `hr_bkd` karena katalog entitlement melabeli `hr_bkd` sebagai "SDM / BKD / SISTER" ([0004_entitlement_modules.sql:89](file:///c:/SICA/packages/database/migrations/0004_entitlement_modules.sql)). Setelah mengukur `PERMISSION_MODULES` ([authz.ts:93-97](file:///c:/SICA/packages/contracts/src/authz.ts)) — **13** nilai, `hr_bkd` tidak termasuk — jelas bahwa agen yang menulisnya benar dan koreksi saya salah. Keempat baris sudah **kembali ke `academic`**. Yang lahir dari kesalahan itu justru temuan yang lebih besar: kolom `Modul` di §4.5.1 **tidak dapat** dipakai sebagai gerbang entitlement, karena 130 baris gugus baru hanya menempati 4 dari 13 nilai. Beda **kode entitlement** (sumbu jual) dan **kode modul izin** (sumbu katalog) kini ditulis eksplisit di `PRD §5.12` dan `GLOSSARY §10`.',
  '',
  '#### 5.39.4 Verifikasi siklus',
  '',
  '- `node .tools/check-docs.mjs` pada empat berkas yang disentuh siklus ini: `TABEL KONSISTEN`, `cjk=0`, fence genap (mis. `API_SPEC.md baris=4823 fence=262`).',
  '- `node .tools/scan-nonlatin.mjs` repo-wide: `scanned=194 nonLatinHits=0`.',
  '- Pemindaian karakter CJK/Simiril/Thailand di 24 dokumen + `AGENTS.md`: **0**.',
  '- Jumlah berkas: **24** dokumen `.md` di `/docs` + `AGENTS.md`; baris: `DATA_MODEL 8514`, `API_SPEC 4823`, `UI_UX 2708`, `INTEGRATIONS 2650`, `SECURITY 1515`, `RBAC 1486`, `ROADMAP 1098`, `ARCHITECTURE 1849`, `PRD 1873`, `AUDIT_READINESS 680`, `PROGRESS_REPORT` (berkas ini) bertambah tiap siklus.',
  '- **Tidak ada** `git add`, `git commit`, atau `git push` pada siklus ini; dokumentasi masih tahap review dan pemilik belum membuka pintu eksekusi.',
  '',
  '#### 5.39.5 Yang Masih Spesifikasi, bukan kenyataan',
  '',
  'Semua angka di §5.39.1 adalah **spesifikasi**. Berkas migrasi `0051`–`0072` belum ada, 130 izin baru belum dipromosikan ke `PERMISSION_SPECS`, 26 kode error `119`–`144` belum pernah dipancarkan, 42 peristiwa belum punya penerbit, dan `implemented = 0` dari 267 baris rute §7. Baris pertama yang siap dieksekusi setelah dokumentasi dibuka tetap `SEC-0` (`ROADMAP §2.20.3`).',
  '',
].join(NL);

const anchor = '## 11. Riwayat laporan (bagian 3)';
const i = s.indexOf(anchor);
if (i === -1) { console.log('MISS anchor 11'); process.exit(1); }
s = s.slice(0, i) + sec + s.slice(i);

const row = '| 5.39 | 2026-10-20 | Gelombang ketujuh: registri 48 modul bisnis + 14 vonis dedup (`PRD §5.12–§5.14`), skema 21 modul (`DATA_MODEL §22`: 119 tabel, 4 view, 26 enum, `0051`–`0072`), 42 peristiwa + vonis real-time (`ARCH §13`), 267 baris rute + register 144 (`API_SPEC §7`, §4.1.2 MFA `501`), 130 izin 162–291 + 17 empat-mata (`RBAC §4.5.1/§6.7/§7.6`), grid 73 baris peran→kartu + 12 blok layar (`UI_UX §17–§18`), `SC-G4-01…36` + `SEC-26…31` (`SECURITY §13`), 15 sistem/16 baris register (`INTEGRATIONS §6`), `M47-0…M47-8` (`ROADMAP §2.20`). Enam ralat hasil pengukuran dicatat di §5.39.2, termasuk `RD-61` (koreksi saya sendiri saya revert) dan `RD-62` (alat ukur saya yang salah, bukan dokumennya). |' + NL;
if (!s.endsWith(NL)) s += NL;
s += row;

writeFileSync(p, s, 'utf8');
console.log('PROGRESS_REPORT 5.39 written; lines=' + sec.split(NL).length);
