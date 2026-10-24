import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const rep = [];

/* A — 10 sel Modul tidak sah di §4.5 (terukur .tools/rbac-count.mjs): thesis(6) + tenant_modules(4) */
{
  const p = D + 'RBAC_MATRIX.md';
  const L = readFileSync(p, 'utf8').split(NL);
  const LEGAL = new Set(['identity', 'academic', 'teaching', 'enrollment', 'attendance', 'assessment',
    'finance', 'feeder_pddikti', 'audit', 'entitlement', 'platform', 'settings', 'document']);
  const MAP = { thesis: 'academic', tenant_modules: 'entitlement' };
  const s = L.findIndex((l) => /^### 4\.5 /.test(l));
  const e = L.findIndex((l) => /^### 4\.6 /.test(l));
  let fixed = 0;
  for (let i = s; i < e; i++) {
    const m = L[i].match(/^(\|\s*\d+\s*\|\s*`[a-z_.0-9]+`\s*\|\s*`)([a-z_]+)(`.*)$/);
    if (!m) continue;
    const val = m[2];
    if (LEGAL.has(val)) continue;
    const to = MAP[val];
    if (!to) { console.log('BARIS ' + (i + 1) + ' nilai asing: ' + val); continue; }
    L[i] = m[1] + to + m[3] + '  <!-- Modul diralat 2026-10-21 (RD-73): `' + val + '` bukan `PermissionModule` sah -->';
    fixed++;
  }
  writeFileSync(p, L.join(NL), 'utf8');
  rep.push('modul-legal: OK (dibetulkan ' + fixed + ' sel)');
}

/* B — G-29 diperbarui: sebagian sudah ditutup di dokumen */
{
  const p = D + 'RBAC_MATRIX.md';
  let t = readFileSync(p, 'utf8');
  const a = 'rapikan baris 115–120 yang hari ini menulis `thesis` di kolom Modul.';
  if (t.indexOf(a) !== -1 && t.lastIndexOf(a) === t.indexOf(a)) {
    t = t.replace(a, 'baris 115–120 **sudah diralat di dokumen** 2026-10-21: `thesis` → `academic` dan `tenant_modules` → `entitlement` (10 sel, terukur `.tools/rbac-count.mjs`); yang masih terbuka adalah **register alias prefiks** di `authz.ts` — pekerjaan kode, bukan dokumen.');
    writeFileSync(p, t, 'utf8');
    rep.push('G-29: OK');
  } else rep.push('G-29: MISS');
}

/* C — ARCHITECTURE: peristiwa yang belum terbit untuk rantai pemilik (RD-74) */
{
  const p = D + 'ARCHITECTURE.md';
  let t = readFileSync(p, 'utf8');
  const anchor = NL + '### 13.2 Vonis jalur real-time';
  if (t.indexOf(anchor) === -1) { rep.push('events: MISS'); }
  else {
    const add = [
      '',
      '#### 13.1.1 perluasan 2026-10-21 — hop rantai pemilik yang belum punya penerbit (`RD-74`)',
      '',
      'Gerbang `node .tools/chain-audit.mjs` memisahkan **seperti apa** rantai pemilik terjejak dari katalog 42 peristiwa di atas. Hasil ukur: **7 dari 10** rantai punya minimal satu hop tanpa peristiwa, dan **22 dari 48** modul registri tidak pernah menerbitkan apa pun (sebagian di antaranya memang read-model dan karena itu sah diam). Yang di bawah ini adalah **peristiwa yang masih kurang**, bukan peristiwa yang sudah ada dengan nama lain. Baris-baris ini **menyusul** katalog induk: ia belum punya nomor baris di §13.1 sebelum DDL penghasilnya ada di `DATA_MODEL §22`.',
      '',
      '| Peristiwa yang diminta | Penerbit | Konsumen | Hop rantai pemilik | Prasyarat objek | Status |',
      '|---|---|---|---|---|---|',
      '| `fieldwork.logbook.logged` | M-25 | M-19, M-38, M-07 | rantai 2 (logbook DPL) | `0066` | **belum ada** |',
      '| `fieldwork.mentor_grade.received` | M-25 | M-19 | rantai 2 (form nilai mitra) | `0066` | **belum ada** |',
      '| `mbkm.conversion.proposed` | M-38 | M-19, M-13 | rantai 2 (konversi kredit ke KHS) | objek konversi MBKM **belum ternomor** di `DATA_MODEL` (rute `/mbkm/conversions` sudah dispesifikasi di `API_SPEC`) | **belum ada** |',
      '| `thesis.defense.approved` | M-20 | M-19, M-30, M-39 | rantai 3 (approval sidang) | `thesis_records` (`0027`); penjadwalan sidang **belum ternomor** | **belum ada** |',
      '| `thesis.grade.finalized` | M-19 | M-30, M-26 | rantai 3 (nilai sidang → clearance) | `grades` (`0002`) | **belum ada** |',
      '| `hr.bkd.recap.approved` | M-07 | M-08, M-32 | rantai 4 (BKD → SISTER) | `admin.bkd` + item BKD (`0055` wilayah transport) | **belum ada** — padahal `RBAC_MATRIX` baris 173 sudah menyebutnya |',
      '| `publication.sinda.verified` | M-21 | M-44, M-07, M-32 | rantai 4 (luaran terverifikasi) | §22.5 (`0061`) | **belum ada** |',
      '| `ipr.filing.submitted` | M-22 | M-44, M-32 | rantai 4 (HAKI) | `0062` | **belum ada** |',
      '| `graduation.convocation.registered` | M-23 | M-40, M-43 | rantai seremonial (wisuda) | `graduation_records` (`0019`/`0027`) | **belum ada** |',
      '| `residence.wallet.settled` | M-42 | M-10, M-32 | rantai fasilitas (e-wallet → tagihan) | `0070` | **belum ada** |',
      '| `clinic.counseling.booked` | M-41 | M-36 (rujukan kasus), APP | rantai kesejahteraan mahasiswa | `0071` | **belum ada** |',
      '| `career.match.suggested` | M-28 | M-27, M-32 | rantai alumni-karier (IKU 1–2) | `0059` | **belum ada** |',
      '| `mobility.credit.recognized` | M-29 | M-19, M-38 | rantai KUI (konversi ECTS) | `0060` | **belum ada** |',
      '| `curriculum.cpl.attainment_updated` | M-12 | M-31, M-32, APP | rantai 8 (OBE) | §18.7 `cpl_targets` (`0036`) | **belum ada** |',
      '| `modality.session.mode_changed` | M-15 | M-18, M-34 | rantai 7 (tag Feeder F/O/M ikut modus) | `0041`/§21.5 | **belum ada** |',
      '| `quality.finding.raised` | M-37 | M-31, M-12, M-32 | rantai penjaminan mutu (PPEPP) | mesin state PPEPP ada di `DATA_MODEL` (§18); penerbit peristiwa belum dinomori | **belum ada** |',
      '| `helpdesk.ticket.resolved` | M-04 | M-05, M-32 | rantai layanan internal | `0051` | **belum ada** |',
      '| `hris.payroll.finalized` | M-06 | M-07, M-10 | rantai SDM (gaji → BKD/ledger) | `0054` | **belum ada** |',
      '| `conference.attendance.captured` | M-16 | M-18, M-05 | rantai vicon (§5.15 PRD) | `0073`/`0074` | **belum ada** |',
      '',
      '**Tiga aturan yang mencegah daftar ini menjadi polusi.** (1) Nama peristiwa mengikuti pola `modul.entitas.aksi` kosakata §13.1 dan **satu penerbit** per peristiwa; (2) peristiwa tidak boleh mendahului objeknya — bila `DATA_MODEL §22` belum menamai tabelnya, barisnya ditolak (norma `AGENTS §3.11`); (3) yang read-model dan yang memang tidak boleh menerbitkan **tidak** masuk daftar ini: `M-26`, `M-31`, `M-32`, `M-34` (staging milik M-34 hanya menerima), `M-01`/`M-02`/`M-03` sebagian sudah punya penerbit (`identity.user.provisioned`), `APP` bukan penerbit fakta tetapi konsumen.',
      '',
      '**Angka yang boleh dikutip.** `node .tools/event-cite-audit.mjs` mencetak ukuran hari ini (katalog induk dan jumlah modul tanpa penerbit) sehingga kalimat di atas tidak basi ketika daftarnya bertambah. Catatan: rujukan peristiwa `hr.bkd.recap.approved` di `RBAC_MATRIX` baris 173 **sudah ada sebelum** peristiwa itu tercetak di katalog — itulah temuan `RD-74`, dan itulah yang ditutup oleh tabel ini.',
      '',
    ].join(NL);
    t = t.replace(anchor, NL + add + anchor.replace(NL, ''));
    writeFileSync(p, t, 'utf8');
    rep.push('events-13.1.1: OK');
  }
}

console.log(rep.join(NL));
