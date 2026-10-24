import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

// 1. koreksi klaim RD-89 supaya sesuai pengukuran yang benar-benar saya jalankan
{
  const f = 'docs/AUDIT_READINESS.md';
  let t = readFileSync(f, 'utf8');
  const a = '; `seed-count` ikut salah baca (ia melaporkan 34 baris untuk katalog yang seharusnya 29 sebelum §24)';
  const b = '; sesudah blok itu dihapus, pemindaian baris bernomor di region §21.3 menghasilkan rentang **1–33 tanpa duplikat**, sementara `node .tools/seed-count.mjs` masih mencetak **34** karena regionnya menyeret satu baris bukan-tabel — keterbatasan alat dinyatakan di sini, tidak ditutup-tutupi (katalog kanonik = keluaran pemindaian baris, dan SEED_DATA §8.3 membaca batas, bukan angka ini)';
  if (!t.includes(a)) console.error('anchor RD-89 tidak cocok');
  else { writeFileSync(f, t.replace(a, b), 'utf8'); console.log('RD-89 dikoreksi'); }
}

// 2. PROGRESS_REPORT §5.43
{
  const f = 'docs/PROGRESS_REPORT.md';
  const lines = readFileSync(f, 'utf8').split(NL);
  if (lines.some((l) => l.startsWith('### 5.43 '))) { console.log('§5.43 sudah ada'); }
  else {
    const anchor = lines.findIndex((l) => l.startsWith('## 11. Riwayat laporan (bagian 3)'));
    if (anchor < 0) console.error('anchor ## 11 tidak ada');
    else {
      const sec = [
        '### 5.43 Siklus 2026-10-21 (bagian 4) — tiga dimensi yang tidak pernah diukur siapa pun: GIS sesi, jaminan sosial + EWMP, dan mutu gerak',
        '',
        '**Pemicunya.** Brief dewan yang sama kini menuntut tiga hal tambahan: peta sebaran login real-time per peran, kepatuhan HRIS Indonesia (BPJS/EWMP), dan "UI premium" dengan micro-interaction/skeleton/CLS 0.0/tema adaptif. Sebelum menulis satu baris spesifikasi, saya ukur dulu: `node .tools/dimension-audit.mjs` (alat baru, 38 dimensi) membaca 20 berkas dan mencetak **`GeoIP` 0 · `active session store` 0 · `BPJS` 0 · `EWMP` 0 · `Glassmorphism` 0**, dengan `micro-interaction` dan `CLS` masing-masing cuma 1 berkas. Untuk BPJS/EWMP itu lubang kepatuhan, bukan selera; untuk peta, itu lubang kontrak karena tidak ada tempat sah membaca kunci GeoIP.',
        '',
        '**Cascade yang ditulis (`AGENTS §3.11`, urutannya tidak dibalik).** `PRD §5.17` (FR-GIS-01…05, FR-JAM-01…04, FR-MTN-01…06, BR-G11…G14, AC-GIS-1…6, NFR-GIS/JAM/MTN) → `DATA_MODEL §24` (`0078_session_geography`, `0079_social_insurance`, `0080_ewmp_sync`; 6 tabel + 1 view + 3 enum; `session_geo_facts` insert-only, `view` ber-`security_invoker`, tarif negara sebagai **basis poin berversi**, nomor peserta blind-index + terenkripsi, EWMP `[VERIFIKASI-VENDOR]` tanpa field karangan) → `RBAC §4.5.4` (10 nama usulan, **sengaja tanpa nomor**) → `API_SPEC §7.33` (10 baris `spec-only`, nol nomor error baru) → `UI_UX §19` (6 token gerak, skeleton sebagai kontrak tinggi, CLS diukur, batas glassmorphism, badge sumber peta) → `ROADMAP §2.23` (`GEO-1…3`, `JAM-1`, `MTN-1`). Penunjang: `ARCHITECTURE §13.8` (vonis 8 & 9), `ENV_CONTRACT §8` (7 kunci), `SECURITY §14.1/§14.2`, `MIGRATION_SOP §6.2a`, `INDEX` dua baris topik.',
        '',
        '**Tiga ralat diri pada siklus ini.** (1) **Dua baris SQL tidak sah lagi-lagi keluar dari tangan saya**: `CHECK` berisi subquery dan `REFERENCES …(??)`; keduanya sudah saya buang sebelum sempat dibaca orang, dan normanya sekarang tertulis di §23.2. (2) **Blok yatim di katalog §21.3**: baris 26–28 tercetak dua kali, sekali sebagai baris tabel dan sekali sebagai baris lepas sesudah catatan ralat — `check-docs` lolos karena ia hanya menjaga jumlah kolom (lubang bentuk, `RD-80`). Blok dihapus, dan pemindaian baris kini menghasilkan rentang **1–33 tanpa duplikat**. (3) **Nomor parameter & migrasi saya daftarkan sambil menulis**, yang seharusnya lewat register induk lebih dulu; keduanya sudah masuk `MIGRATION_SOP §6.2a` dan §21.3 baris 30–33, dan cara ukurnya (`ddl-gap`, `seed-count`) dicetak, bukan diklaim.',
        '',
        '**Angka penjaga setelah cascade.** `ref-audit` 3.098 rujukan · **0** yatih. `heading-dup` dobel=0 mundur=0 sub-mundur=0. `fk-audit` **HIJAU**, `ddl-owner` 331 tabel unik, `check-docs` TABEL KONSISTEN. `rbac-count` 301 tanpa lubang (blok §4.5.4 sengaja tidak ber-nomor sehingga tidak menggeser register). `rbac-module-union` HIJAU — Modul untuk `hris.insurance.*` saya selaraskan ke `finance` mengikuti baris 168–170. `perm-phantom` tetap **MERAH by design** dengan angka yang bergerak: §7.33 menambah 10 nama usulan baru. `env-drift` HIJAU untuk yatih (baris §8 keluar sebagai `~ design-only` — benar, dokumen mendahului kode). `dimension-audit`: `GeoIP`, `BPJS`, `EWMP`, `Glassmorphism` tidak lagi nol. `cjk-check` 1 SUSPECT (kutipan Thailand yang sudah berpemindai).',
        '',
        '**Vonis.** Ketiganya kini punya rumah dokumen dan cara ukur. Yang **tidak** berubah: Redis, GeoIP2, SDK kanal, dan spesifikasi muatan EWMP belum nyata, izin `§4.5.4` belum ber-nomor (`CRD-5`), `reference_dictionary_entries` (`0028`) masih tanpa DDL (`CRD-6`), dan mutu visual hanya terbukti ketika aplikasi dijalankan. Menulis "20 berkas 100 % konsisten dan resmi dikunci" akan berarti menyebut angka yang tidak punya alat — dan itu justru yang paling sering saya catat sebagai kegagalan di laporan ini.',
        '',
      ];
      lines.splice(anchor, 0, ...sec);
      // riwayat
      const i542 = lines.findIndex((l) => l.startsWith('| 5.42 | 2026-10-21 |'));
      if (i542 >= 0) lines.splice(i542 + 1, 0, '| 5.43 | 2026-10-21 | **Siklus keempat — GIS sesi, jaminan sosial + EWMP, mutu gerak.** Alat baru `.tools/dimension-audit.mjs` (38 dimensi) mengukur lima dimensi tanpa rumah (`GeoIP` 0, `active session store` 0, `BPJS` 0, `EWMP` 0, `Glassmorphism` 0). Cascade ditulis penuh: `PRD §5.17`, `DATA_MODEL §24` (`0078`–`0080`: 6 tabel + view `security_invoker` + 3 enum), `ARCHITECTURE §13.8` (vonis 8 & 9), `ENV_CONTRACT §8` (7 kunci), `SECURITY §14.1/§14.2`, `RBAC §4.5.4` (10 nama usulan tanpa nomor), `API_SPEC §7.33` (10 rute `spec-only`, nol error baru), `UI_UX §19` (6 token gerak + CLS + badge sumber peta), `ROADMAP §2.23` (`GEO-1…3`, `JAM-1`, `MTN-1`), `MIGRATION_SOP §6.2a`, `INDEX`. Ralat diri: blok yatim baris 26–28 di §21.3 dihapus (rentang kini 1–33 tanpa duplikat) dan Modul `hris.insurance.*` diselaraskan ke `finance`. Penjaga hijau: `ref-audit` 3.098/0, `heading-dup` 0, `fk-audit` HIJAU, `ddl-owner` 331 unik, `rbac-count` 301 tanpa lubang, `env-drift` HIJAU yatih. `perm-phantom` tetap MERAH by design (10 nama usulan baru). |');
      writeFileSync(f, lines.join(NL), 'utf8');
      console.log('PROGRESS §5.43 + riwayat ditulis');
    }
  }
}
