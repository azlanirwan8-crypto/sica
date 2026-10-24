import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const f = 'docs/PROGRESS_REPORT.md';
const lines = readFileSync(f, 'utf8').split(NL);

if (lines.some((l) => l.startsWith('### 5.42 '))) { console.log('§5.42 sudah ada'); process.exit(0); }
const anchor = lines.findIndex((l) => l.startsWith('## 11. Riwayat laporan (bagian 3)'));
if (anchor < 0) { console.error('anchor ## 11 tidak ada'); process.exit(1); }
const frag = readFileSync('.tools/frag-progress542.md', 'utf8').trimEnd().split(NL);
lines.splice(anchor, 0, ...frag, '');

// riwayat: baris 5.42 setelah baris 5.41
const i541 = lines.findIndex((l) => l.startsWith('| 5.41 | 2026-10-21 |'));
if (i541 < 0) console.error('baris riwayat 5.41 tidak ditemukan');
else lines.splice(i541 + 1, 0, '| 5.42 | 2026-10-21 | **Siklus ketiga — siklus hidup dokumen mendaftar→alumni→lingkup kampus.** `DATA_MODEL §23` menulis 33 tabel untuk `0019`/`0020`/`0021`/`0026`/`0027` + nomor baru `0076` (KTM) dan `0077` (tracer); `PRD §5.16` menerbitkan registri sembilan tahap + `FR-LC-01…12` + `AC-LC-1…9`; `MIGRATION_SOP §5/§6` menghapus `documents` dari `0019`, memvonis `student_activities` KALAH, mendaftarkan `0076`/`0077` (maksimum nomor `0075`→`0077`); `API_SPEC §7.27` diralat `convocations`→`commencements/:batchId`; `ROADMAP §2.22` menambah `CRD-5`/`CRD-6`. Alat baru `.tools/perm-phantom.mjs` mengukur **250** kode izin yang dikutip API_SPEC tetapi tidak pernah dinamai RBAC/authz, `.tools/ddl-gap.mjs` mengukur DDL yang tersisa (**45 nama pada 12 nomor**), `.tools/fk-audit.mjs` berbalik **HIJAU (0)** dan `route-count` diperbaiki agar tidak lagi bergantung posisi blok. Tiga ralat diri: dua baris DDL non-SQL, satu alat kembar (`nonlatin-scan` vs `cjk-check`) yang dihapus, dan tiga cacat skrip sisip. Penjaga lain tetap hijau: `ref-audit` 3.019/0, `rbac-count` 301 tanpa lubang, `error-dup`, `vocab-audit`, `chain-audit`, `env-drift`, `seed-count`, `placeholder-count`, `heading-dup`, `check-docs`, `ddl-owner`, UI (`contrast` FAILS=0, `purge` 0, `css-balance` 0). |');
writeFileSync(f, lines.join(NL), 'utf8');
console.log('PROGRESS_REPORT §5.42 + riwayat ditulis; baris = ' + lines.length);
