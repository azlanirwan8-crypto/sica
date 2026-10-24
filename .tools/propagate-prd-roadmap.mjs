import { readFileSync, writeFileSync } from 'node:fs';

// 1. PRD §5.16 — sisip tepat sebelum `## 6. Acceptance Criteria (terukur)`
{
  const f = 'docs/PRD.md';
  let t = readFileSync(f, 'utf8');
  if (t.includes('### 5.16 Registri dokumen sepanjang siklus hidup')) { console.log('PRD §5.16 sudah ada — dilewati'); }
  else {
    const anchor = '## 6. Acceptance Criteria (terukur)';
    if (!t.includes(anchor)) console.error('ANCHOR PRD hilang');
    else {
      const frag = readFileSync('.tools/frag-prd516.md', 'utf8');
      t = t.replace(anchor, frag.trimEnd() + '\n\n' + anchor);
      writeFileSync(f, t, 'utf8');
      console.log('PRD §5.16 disisipkan; baris = ' + t.split('\n').length);
    }
  }
}

// 2. ROADMAP §2.22 — judul, dua tiket baru (CRD-5, CRD-6) di akhir daftar, definisi selesai
{
  const f = 'docs/ROADMAP_TASKS.md';
  let t = readFileSync(f, 'utf8');
  const headingFrom = '### 2.22 Penutup kelengkapan CRUD per modul (`CRD-1`…`CRD-4`) — hasil audit matriks 2026-10-21';
  const headingTo = '### 2.22 Penutup kelengkapan CRUD per modul (`CRD-1`…`CRD-6`) — hasil audit matriks 2026-10-21';
  const defFrom = '**Definisi selesai gugus ini.** `crud-matrix` mencetak `lengkap` untuk 47 modul + `APP`';
  const tickets = [
    '- [ ] **`CRD-5` — 250 kode izin yang dikutip API_SPEC belum pernah dinamai RBAC.** *Isi:* setiap kode pada kolom "Izin acuan" §4/§7 yang tidak muncul sebagai nama di `RBAC_MATRIX` mana pun wajib naik menjadi baris `§4.5.x` **dengan peran sasaran yang diputus manusia**, lalu dipromosikan ke `PERMISSION_SPECS` dan disebarkan ke seed. *Cara ukur:* `node .tools/perm-phantom.mjs` (keluaran siklus ini: 364 kandidat · 84 ber-baris · 25 dikenal-tanpa-nomor · 5 bentuk singkat · **250 tanpa nama**) harus mencetak `HANTU = 0`; `rbac-count` tetap tanpa lubang nomor; `gen-rbac-seed.mjs --check` hijau. *Penahan:* penomoran adalah wewenang `RBAC_MATRIX` dan keputusan peran sasaran adalah produk (`P-4`); **dilarang** menutup angka dengan generator — `crud-completer.mjs` sudah terbukti memasang izin pada objek yang salah dan dibuang (`RD-83`). *Dependensi:* `CRD-1`…`CRD-3`, `SEC-0`.',
    '- [ ] **`CRD-6` — 45 nama objek ber-nomor migrasi yang masih tanpa DDL.** *Isi:* menulis DDL `0013`–`0018`, `0022`–`0025`, `0028`, `0029` — jalur keuangan/VA & rekonsiliasi, jadwal & ujian, kehadiran dosen (sumber BKD & akreditasi), jembatan Feeder, notifikasi & `impersonation_grants`. *Cara ukur:* `node .tools/ddl-gap.mjs` mencetak `TANPA DDL = 0`, dan setiap objek baru lolos uji dua-tenant (bocor = 0 baris) + query CI gugusnya. *Sudah dibayar sebagian:* [DATA_MODEL §23](file:///c:/SICA/docs/DATA_MODEL.md) menuliskan `0019`/`0020`/`0021`/`0026`/`0027` + nomor baru `0076`/`0077` pada 2026-10-21, sehingga `.tools/fk-audit.mjs` berbalik dari 6 rujukan menggantung menjadi **0**. *Dependensi:* `MIGRATION_SOP §5`/`§6`, keputusan produk `P-10` untuk `pmb` dan `tracer_iku`.',
  ].join('\n');
  const defTo = tickets + '\n\n' + '**Definisi selesai gugus ini.** `crud-matrix` mencetak `lengkap` untuk 47 modul + `APP`, `perm-phantom` mencetak `HANTU = 0` (`CRD-5`), `ddl-gap` mencetak `TANPA DDL = 0` (`CRD-6`), `fk-audit` HIJAU (tercapai 2026-10-21)';
  for (const [a, b] of [[headingFrom, headingTo], [defFrom, defTo]]) {
    if (!t.includes(a)) { console.error('ANCHOR ROADMAP hilang: ' + a.slice(0, 60)); continue; }
    t = t.replace(a, b);
  }
  writeFileSync(f, t, 'utf8');
  console.log('ROADMAP §2.22 diperbarui');
}
