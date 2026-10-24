import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const rep = [];
const D = 'C:/SICA/docs/';
const edit = (file, jobs) => {
  const p = D + file;
  let s = readFileSync(p, 'utf8');
  for (const j of jobs) {
    const ok = s.includes(j.a);
    if (ok) s = s.replace(j.a, j.b);
    rep.push(file + ' ' + j.n + ': ' + (ok ? 'OK' : 'MISS'));
  }
  writeFileSync(p, s, 'utf8');
};

const row24 = "| 24 | Kebijakan rekonsiliasi dua sumber | `master_system_parameters` + `enum_kind` | `attendance.multi_source_policy` = `ONSITE_PRIMARY` (kamus `kebijakan_rekonsiliasi`) | lihat §21.5 | ACADEMIC |";

edit('DATA_MODEL.md', [
  { n: 'ttl-col', a: '-- TTL; default 900 s (lihat aturan TTL di bawah)', b: '-- TTL; default 90 s (VONIS 2026-10-20; lihat aturan TTL di bawah)' },
  {
    n: 'ttl-rule',
    a: "1. **TTL** dibaca dari `tenant_settings.feature_flags->>'krsLeaseSeconds'` (§14.3), default **900 detik**, batas aman **120–1800** dilayani di service.",
    b: '1. **TTL — VONIS 2026-10-20, satu angka untuk tiga dokumen.** Kunci kanonik **`krs.war_lease_ttl_s`** di `master_system_parameters` (§21.2, `0049`), bawaan **90 detik**, rentang aman **30–300**, kelas risiko `TECHNICAL`, dan tetap **dilayani di service**.',
  },
  { n: 'row25', a: row24, b: row24 + '\n| 25 | Masa berlaku pegangan kursi KRS (*lease* TTL) | `master_system_parameters` | `krs.war_lease_ttl_s` = `90` (`SECONDS`) | rentang **30–300**; perpanjangan wajib membawa `version`; tidak pernah melewati tutup jendela OW. **Vonis ini menutup tiga angka yang sebelumnya hidup bersamaan** (900 s di §16.1, 30 s di API_SPEC, dan `PX 90000` di ARCHITECTURE §10.3) | TECHNICAL |' },
  { n: 'jumlah', a: 'Empat dari 24 butir di atas **ditolak menjadi key-value** (nomor 4, 13, 16, 17, 20, 21)', b: 'Enam dari 25 butir di atas **ditolak menjadi key-value** (nomor 4, 13, 16, 17, 20, 21)' },
  {
    n: 'alias-ttl',
    a: '| `master_system_parameters` (parameter operasional) | permintaan pemilik |',
    b: '| `tenant_settings.feature_flags->>\'krsLeaseSeconds\'` dan `tenant_settings.krs_lease_ttl_seconds` | `DATA_MODEL §16.1` lama dan `API_SPEC §4.2` lama | **KALAH** — kunci kanonik `krs.war_lease_ttl_s` di `master_system_parameters` (§21.2, `0049`); kolom lama dibaca satu rilis sebagai compat lalu dilepas | §14.7 & §21.3(25) |\n| `master_system_parameters` (parameter operasional) | permintaan pemilik |',
  },
]);

edit('API_SPEC.md', [
  {
    n: 'ttl-api',
    a: '| Lease TTL | 30 detik default tenant, konfigurabel 15–120 detik lewat `tenant_settings.krs_lease_ttl_seconds` (nama milik `DATA_MODEL.md` §14).',
    b: "| Lease TTL | **90 detik** bawaan (VONIS 2026-10-20), rentang aman **30–300**, kunci kanonik **`krs.war_lease_ttl_s`** (`DATA_MODEL §21.2`, `0049`); `tenant_settings.krs_lease_ttl_seconds` adalah **alias yang kalah** (`§14.8`) dan hanya dibaca sebagai compat satu rilis.",
  },
]);

edit('PRD.md', [
  {
    n: 'ttl-prd',
    a: '**satu angka belum sah dipilih — temuan tulis-tersua:**',
    b: '**DIPUTUSKAN 2026-10-20 (Lead Architect): bawaan 90 detik, rentang 30–300, kunci `krs.war_lease_ttl_s` (`DATA_MODEL §21.2`).** Catatan temuannya sebelum diputus:',
  },
]);

edit('ROADMAP_TASKS.md', [
  { n: 'ui14', a: '`UI_UX §14` belum ada (rujukan hantu)', b: '`UI_UX §14` sudah ditulis pada siklus yang sama (tata kelola parameter & menu) — rujukan tidak lagi hantu' },
]);

// ── AGENTS: perluasan §3.10 dengan tata kelola parameter ─────────────────────
edit('../AGENTS.md', [
  {
    n: 'agents-310',
    a: '- **Gerbang CI (m)(n)(o)(p):** scanner kosakata literal',
    b: '- **Parameter operasional juga wajib dinamis** (DATA_MODEL §21). Skalar tingkat tenant — ambang presensi, umur rotasi QR, radius geofence, ambang akurasi GPS, rasio durasi join daring, timeout & skew webhook, plafon cicilan, TTL lease KRS — disimpan di `master_system_parameters` dengan CRUD penuh, riwayat insert-only beralasan + IP, dampak, dan pengajuan–persetujuan. **Batasnya:** kredensial/rahasia **tidak pernah** menjadi baris parameter (`CHECK (is_secret = false)`, `source_of_truth <> \'ENV\'`), dan **ambang keamanan tidak dapat dilonggarkan melewati rentang `CHECK`** (`min/max_value`) seandainya Admin IT menginginkannya; kelas `SECURITY`/`REGULATORY` menuntut penyetuju kedua + MFA. Aturan struktural (band SKS per IPK, skala nilai, komponen biaya, kanal VA, pola NIM) **tidak** dipindahkan ke key-value karena sudah punya tabel — memindahkannya akan menciptakan dua sumber kebenaran.\n- **Gerbang CI (m)(n)(o)(p):** scanner kosakata literal',
  },
]);

edit('TECH_CONVENTIONS.md', [
  {
    n: 'tc-qr',
    a: '| (p) | scanner nama menolak tabel kamus kembar berbetuk `(code, name)` | DATA_MODEL §14.8, §20.2 |',
    b: '| (p) | scanner nama menolak tabel kamus kembar berbetuk `(code, name)` | DATA_MODEL §14.8, §20.2 |\n| (q) | **ambang tidak boleh menjadi konstanta**: engine/service yang memutuskan berdasarkan ambang wajib membaca nilainya dari `master_system_parameters`/`academic_rules`; nilai literal di kode adalah temuan (contoh terukur: `>= 75` di `dashboard.service.ts:263`) | AGENTS §3.10, DATA_MODEL §21.1–§21.3, SECURITY §12.7 |\n| (r) | **golden vector deret** untuk generator berurutan (NIM ALG-18, nomor surat, nomor kwitansi): pola + urutan permintaan yang sama wajib menghasilkan deret yang sama; `MAX()+1` dilarang, `sequence` per prefix wajib | ARCHITECTURE §12.17, §12.20 |',
  },
]);

console.log(rep.join('\n'));
