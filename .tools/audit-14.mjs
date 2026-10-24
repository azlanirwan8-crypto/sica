import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/';
const rep = [];
const put = (file, anchor, text, label) => {
  const p = D + file;
  let s = readFileSync(p, 'utf8');
  const i = s.indexOf(anchor);
  if (i === -1) { rep.push(file + ' ' + label + ': MISS'); return; }
  if (s.lastIndexOf(anchor) !== i) { rep.push(file + ' ' + label + ': AMBIG'); return; }
  s = s.slice(0, i) + text + s.slice(i + anchor.length);
  writeFileSync(p, s, 'utf8');
  rep.push(file + ' ' + label + ': OK');
};

const sec14 = [
  '',
  '## 14. Gelombang ketujuh — 47 modul bisnis (2026-10-20): celah yang saya ukur sendiri',
  '',
  'Bagian ini adalah catatan **sebelum** penulisan, supaya siklus berikutnya tidak mengira 47 modul sudah ada. Semua angka berasal dari perintah yang saya jalankan di `C:\\SICA`, bukan dari laporan agen.',
  '',
  '### 14.1 Celah baru',
  '',
  '| ID | Temuan | Kelas | Titik aksi |',
  '|---|---|---|---|',
  '| RD-56 | **Tantangan MFA tidak punya rumah objek.** `auth.service.ts:144-146` mengembalikan `mfaToken: generateOpaqueToken()` yang tidak pernah disimpan dan tidak terikat ke upaya login; `auth/mfa/verify/route.ts` tidak membaca `mfaToken` sama sekali dan meloloskan `totpCode` enam digit apa pun (`=== \x27123456\x27 || length === 6`) lalu mencetak cookie token palsu. Terukur: `grep -rn mfaToken apps/web/src` hanya menyentuh login + klien, tidak ada penyimpanan; `mfa_factors` ada di `packages/database/src/schema/auth.ts` tetapi tidak punya kolom tantangan/consumed/attempt | CRITICAL (keamanan, fail-open) | `API_SPEC §2.3` menamai `501 MFA_NOT_IMPLEMENTED` lebih dulu (baris 119), lalu kode dibuat fail-closed; objek tantangan dinomori `DATA_MODEL`; TOTP dihitung server dengan jendela dari parameter |',
  '| RD-57 | **Nama berkas yang ditagih tidak ada.** Permintaan pemilik menyebut `INTEGRATION_SPEC.md`; yang nyata adalah `docs/INTEGRATIONS.md` (terukur: `test -f docs/INTEGRATION_SPEC.md` → tidak ada). Ini kelas cacat yang sama dengan `RD-37`/`RD-05` (klaim berkas/peran yang tidak ada) — bedanya, sekarang sumbernya di instruksi, bukan di dokumen kami | MINOR (higiene rujukan) | Tidak dibuat berkas kembar; ralat dicatat di sini dan di `PROGRESS_REPORT`, dan `AGENTS §2.1` menunjuk `INTEGRATIONS.md` |',
  '| RD-58 | **Enam belas dari 48 baris registri belum dispesifikasi sama sekali.** Terhitung dari `PRD §5.12.1` (tally dihitung program, bukan ditulis tangan): `PENUH` 11 · `SEBAGIAN` 21 · `NOL` 16. Modul `NOL` belum punya FR, DDL, endpoint, maupun pola layar; sebagian `SEBAGIAN` hanya disebut di dokumen benchmark/glosarium | MAJOR (lingkup) | Gelombang ketujuh: `PRD §5.14` (FR), `DATA_MODEL §22` (objek + nomor migrasi), `API_SPEC §7` (rute), `RBAC_MATRIX` (izin 162+), `UI_UX §17–§18` (grid + layar), `ROADMAP` gugus `M47-*` |',
  '| RD-59 | **Pemindai karakter asing punya lubang.** `scan-nonlatin.mjs` hanya memindai Hiragana–Katakana/Han/Hangul/Cyrillic/CJK-Ext-A, sehingga sisipan **fullwidth** (`ＭＡＨＡＳＩＳＷＡ`), **Thai** (`เ` di komentar CSS yang dulu saya temukan sendiri), Arab, dan Georgia lolos. Setelah pola diperlebar, `scanned=194` menemukan 2 baris — keduanya kutipan yang memang sengaja, bukan injeksi baru | MINOR (perlengkapan verifikasi) | Pola diperlebar (fullwidth U+FF01–FF60, Thai U+0E00–U+0E7F, Georgia U+10A0–U+10FF, Arab U+0600–U+06FF) + penanda baris `nonlatin-sampled` untuk kutipan yang sah; pemindai kedua `.tools/cjk-check.mjs` dipakai di berkas |',
  '| RD-60 | **Nol primitif proyeksi izin.** Kisi sub-detail dan grid kartu per peran membutuhkan daftar aksi yang boleh dirender per objek, tetapi `allowedActions` tidak ada di kontrak mana pun (terukur `grep -r allowedActions apps/web/src packages/contracts/src` = 0). Ini menahan `G-18` dan membuat desain layar berisiko mengarang aturan di klien | MAJOR (kontrak) | `API_SPEC` mendefinisikan proyeksi `allowedActions`, `RBAC_MATRIX §6.6` memetakan 10 aksi ke 6 verba, kode belakangan (`AGENTS §3.11`) |',
  '',
  '### 14.2 Status `SEC-0` setelah inspeksi 2026-10-20 (dokumentasi dulu; kode tidak saya ubah)',
  '',
  'Delapan butir `SEC-0` (`§2.5.14`) saya ukur satu per satu, bukan dibaca dari catatan lama:',
  '',
  '- **sudah lewat (1 butir):** guard L3 terpasang di **7 dari 7** rute tulis yang ada (`requirePrincipal`/`requirePermission`; terukur per berkas), dan subjek dibaca dari token, bukan header.',
  '- **belum (6 butir):** `SEC-01` MFA fail-open (`RD-56`); `SEC-07` middleware tidak menghapus header identitas klien (`grep -c \x27delete(\x27 middleware.ts` = 0); `SEC-03` `qr/generate` belum membuktikan pengampu dan koordinat masih dari body (karena `rooms.longitude/latitude/allowed_radius_m` belum ada di skema — tertahan `0041`); `SEC-06` tanda tangan HMAC dibandingkan `!==`, `accuracyMeters` diparse tetapi tidak dipakai, dan `accuracyVerified: true` dikembalikan tanpa dasar; `SEC-12` `violatesSoD()` terdefinisi di `packages/contracts/src/authz.ts:674` dengan **nol** call site; `SEC-09` `withModule` tidak ditemukan sebagai helper yang dipakai rute.',
  '- **butuh keputusan pemilik (1 butir):** `SEC-13`/`P-5` target DB + peran `sica_app` masih terbuka.',
  '',
  'Butir `SEC-06` dan `SEC-07` tidak menunggu dokumen apa pun; keduanya menunggu **saya berhenti menulis dokumen** dan Anda mengizinkan kembali ke kode. Daftar lengkap urutan itu ada di `ROADMAP §2.17`/`§2.18` dan `PROGRESS_REPORT §5.37`.',
  '',
].join(NL);

put('docs/AUDIT_READINESS.md', NL + '## 13. Riwayat tambahan (bagian 2)', NL + sec14 + '## 13. Riwayat tambahan (bagian 2)', 'audit-14');

appendFileSync(D + 'docs/AUDIT_READINESS.md', [
  '| 1.5 | 2026-10-20 | §14: gelombang ketujuh dimulai — registri 48 modul bisnis ditulis di `PRD §5.12` (tally terukur: 11 PENUH / 21 SEBAGIAN / 16 NOL) dan 14 vonis tanggung-jawab-tunggal di `PRD §5.13`; lima celah baru `RD-56`…`RD-60` (MFA fail-open tanpa rumah objek, nama berkas phantom `INTEGRATION_SPEC.md`, 16 modul tanpa spesifikasi, lubang pemindai non-Latin, nol primitif `allowedActions`); status `SEC-0` diukur ulang butiran demi butiran (1 lewat, 6 belum, 1 menunggu keputusan pemilik). |',
  '',
].join(NL), 'utf8');
rep.push('audit-row-15: OK(appended)');

const a = readFileSync(D + 'AGENTS.md', 'utf8');
const anchor = '| **Integrasi & kepatuhan nasional (PDDikti/SISTER/BAN-PT)** |';
if (!a.includes(anchor)) {
  const edit = [
    '',
    '### 2.3 Ralat nama rujukan (terukur 2026-10-20)',
    '',
    'Permintaan produk pernah menyebut `INTEGRATION_SPEC.md`. Berkas itu **tidak ada** dan tidak akan dibuat: yang nyata adalah [`docs/INTEGRATIONS.md`](file:///c:/SICA/docs/INTEGRATIONS.md). Membuat berkas kedua dengan isi serupa adalah persis pola `RD-03`/`RD-32` yang kita perangi. Agen yang diminta "perbarui INTEGRATION_SPEC" wajib membaca dan menulis `INTEGRATIONS.md`.',
    '',
  ].join(NL);
  put('AGENTS.md', NL + '## 3. Guardrails Wajib', edit + NL + '## 3. Guardrails Wajib', 'agents-23');
}

console.log(rep.join(NL));
