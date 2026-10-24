/**
 * gate-run.mjs — SATU titik masuk untuk seluruh penjaga dokumen.
 *
 * Alasan ada (RD-102): sampai siklus ini tidak ada satu pun alat yang bisa dipakai CI untuk
 * MENOLAK sebuah perubahan. Tiga kelas kegagalan yang diukur, bukan diduga:
 *   (a) 25 dari 36 alat yang dijalankan titik masuk ini tidak pernah memanggil `process.exit`
 *       (terukur: yang memanggil hanya rbac-count, ddl-gap, ddl-owner, rbac-module-union,
 *       pedoman-coverage, perm-usulan-audit, i18n-parity, cjk-check, ci-gate-map, crud-bill,
 *       module-provenance) → yang lain mencetak MERAH tetapi keluar dengan kode 0;
 *   (b) `.github/workflows/main-pipeline.yml` berisi lint/typecheck/semgrep/vitest/flutter/deploy
 *       dan TIDAK satu langkah pun atas penjaga dokumen (terukur `grep "run:"` siklus ini);
 *   (c) sebagian angka yang dikutip riwayat berasal dari alat yang butuh argumen (`css-balance`,
 *       dijalankan tanpa argumen → crash) atau yang tidak punya baris vonis sama sekali
 *       (`contrast` mencetak rasio, `contrast-audit` yang punya `FAILS = 0`) → "lulus" yang tidak
 *       bisa diulang perintahnya.
 *
 * Cara alat ini menutup tanpa melemahkan aturan:
 *   · perintah tiap penjaga DISIMPAN di sini (baris `cmd`), jadi angka yang dikutip dokumen punya
 *     satu perintah yang bisa diulang;
 *   · vonis dinilai dari KELUARANNYA, dengan pola yang eksplisit per alat — bukan dari exit code
 *     yang belum dipasang;
 *   · `info: true` = alat penghitung yang backlog-nya memang belum tertutup (mis. 15/48 modul
 *     KURANG CRUD). Backlog tidak membuatnya MERAH, tetapi crash tetap memblokir;
 *   · `when: path` = dilewati (SKIP, bukan lulus) bila sasarannya tidak ada di disk.
 *
 * Penggunaan: node .tools/gate-run.mjs [--list] [--only=id,id]
 * Keluar: 0 bila tidak ada FAIL; 1 bila ada FAIL atau ada alat yang crash.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

const DOC_FILES = readdirSync('docs').filter((f) => f.endsWith('.md')).map((f) => 'docs/' + f);
const CSS_SRC = 'apps/web/src/app/globals.css';
const BUILD_CSS = (() => {
  const d = 'apps/web/.next/static/css';
  if (!existsSync(d)) return null;
  const f = readdirSync(d).filter((x) => x.endsWith('.css'))[0];
  return f ? d + '/' + f : null;
})();

const GATES = [
  { id: 'heading-dup', cmd: ['.tools/heading-dup.mjs'], ok: /HIJAU/ },
  { id: 'validate-md', cmd: ['.tools/validate-md.mjs', ...DOC_FILES], bad: /problems=[1-9]/ },
  { id: 'check-docs', cmd: ['.tools/check-docs.mjs'], ok: /TABEL KONSISTEN/ },
  { id: 'ref-audit', cmd: ['.tools/ref-audit.mjs'], ok: /ref-audit: HIJAU/ },
  { id: 'rbac-count', cmd: ['.tools/rbac-count.mjs'], ok: /HIJAU \(tidak ada lubang nomor\)/ },
  { id: 'ddl-gap', cmd: ['.tools/ddl-gap.mjs'], ok: /^HIJAU/m },
  { id: 'fk-audit', cmd: ['.tools/fk-audit.mjs'], ok: /fk-audit: HIJAU/ },
  { id: 'ddl-owner', cmd: ['.tools/ddl-owner.mjs'], ok: /HIJAU/ },
  { id: 'rbac-module-union', cmd: ['.tools/rbac-module-union.mjs'], ok: /HIJAU/ },
  { id: 'env-drift', cmd: ['.tools/env-drift.mjs'], ok: /HIJAU/ },
  { id: 'error-dup', cmd: ['.tools/error-dup.mjs'], ok: /HIJAU/ },
  { id: 'vocab-audit', cmd: ['.tools/vocab-audit.mjs'], ok: /HIJAU/ },
  { id: 'chain-audit', cmd: ['.tools/chain-audit.mjs'], ok: /HIJAU/ },
  { id: 'pedoman-coverage', cmd: ['.tools/pedoman-coverage.mjs'], ok: /^HIJAU/m },
  { id: 'perm-usulan-audit', cmd: ['.tools/perm-usulan-audit.mjs'], ok: /HIJAU/ },
  { id: 'perm-normalize', cmd: ['.tools/perm-normalize.mjs'], ok: /perm-normalize:bersih/ },
  { id: 'perm-phantom', cmd: ['.tools/perm-phantom.mjs'], ok: /perm-phantom: (HIJAU|KUNING)/ },
  { id: 'guard-order', cmd: ['.tools/guard-order.mjs'], ok: /guard-order: HIJAU/ },
  { id: 'palette-drift', cmd: ['.tools/palette-drift.mjs'], ok: /PASS — konfigurasi/ },
  { id: 'placeholder-count', cmd: ['.tools/placeholder-count.mjs'], ok: /placeholder-count: HIJAU/ },
  { id: 'event-cite-audit', cmd: ['.tools/event-cite-audit.mjs'], ok: /tidak ada di katalog & bukan izin = 0/ },
  { id: 'route-count', cmd: ['.tools/route-count.mjs'], ok: /unclassified=0/ },
  { id: 'roles-audit', cmd: ['.tools/roles-audit.mjs'], ok: /peran tidak sinkron = 0/ },
  { id: 'dimension-audit', cmd: ['.tools/dimension-audit.mjs'], ok: /dimensi TANPA rumah dokumen = 0/ },
  { id: 'i18n-parity', cmd: ['.tools/i18n-parity.mjs'], ok: /HIJAU/ },
  { id: 'css-balance-src', cmd: ['.tools/css-balance.mjs', CSS_SRC], ok: /problems=0/, when: CSS_SRC },
  { id: 'css-balance-build', cmd: ['.tools/css-balance.mjs', BUILD_CSS || ''], ok: /problems=0/, when: BUILD_CSS || '__tanpa_build_css__' },
  { id: 'purge-check', cmd: ['.tools/purge-check.mjs'], ok: /HILANG di-purge \(0\)/, when: BUILD_CSS || '__tanpa_build_css__' },
  { id: 'contrast-audit', cmd: ['.tools/contrast-audit.mjs'], ok: /FAILS = 0/ },
  { id: 'icon-check', cmd: ['.tools/icon-check.mjs'], ok: /OK — seluruh nama ikon Remix ada/, when: 'node_modules/.pnpm/remixicon@4.5.0' },
  { id: 'nonlatin', cmd: ['.tools/scan-nonlatin.mjs', 'docs', 'AGENTS.md', 'apps', 'packages', '.tools'], ok: /nonlatin: HIJAU/ },
  { id: 'ci-gate-map', cmd: ['.tools/ci-gate-map.mjs'], ok: /ci-gate-map: HIJAU/ },
  { id: 'egress-scan', cmd: ['.tools/egress-scan.mjs'], ok: /egress-scan: HIJAU/ },
  { id: 'helpdesk-ent', cmd: ['.tools/fix-helpdesk-ent.mjs', '--cek'], bad: /MERAH/ },
  { id: 'seed-count', cmd: ['.tools/seed-count.mjs'], bad: /MERAH/, info: true },
  { id: 'crud-matrix', cmd: ['.tools/crud-matrix.mjs'], bad: /MERAH/, info: true },
  { id: 'crud-bill', cmd: ['.tools/crud-bill.mjs'], bad: /ASERSI GAGAL|MERAH/, info: true },
  { id: 'handler-inventory', cmd: ['.tools/handler-inventory.mjs'], bad: /ASERSI GAGAL/, info: true },
  { id: 'bench-tally', cmd: ['.tools/bench-tally.mjs'], bad: /ASERSI GAGAL/, info: true },
  { id: 'roadmap-readiness', cmd: ['.tools/roadmap-readiness.mjs'], bad: /ASERSI GAGAL/, info: true },
  { id: 'ai-params-audit', cmd: ['.tools/ai-params-audit.mjs'], bad: /ASERSI GAGAL/, info: true },
  { id: 'module-provenance', cmd: ['.tools/module-provenance.mjs'], bad: /ASERSI GAGAL/, info: true },
  { id: 'module-readiness', cmd: ['.tools/module-readiness.mjs', '--summary'], bad: /MERAH —/, info: true },
  { id: 'fr-ac-gap', cmd: ['.tools/fr-ac-gap.mjs'], bad: /MERAH —/, info: true },
  { id: 'bench-admin-delta', cmd: ['.tools/bench-admin-delta.mjs', '--cek'], bad: /MERAH —/, info: true },
];

const argv = process.argv.slice(2);
const only = (argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const listOnly = argv.includes('--list');
const selected = only ? GATES.filter((g) => only.split(',').includes(g.id)) : GATES;
if (only && !selected.length) { console.error('--only tidak cocok dengan satu pun penjaga'); process.exit(2); }

if (listOnly) {
  console.log('Titik masuk CI yang disarankan:  node .tools/gate-run.mjs');
  for (const g of selected) console.log((g.when ? 'SKIP-jika-tidak-ada  ' : '') + (g.info ? 'INFO  ' : 'GATE  ') + g.cmd.filter(Boolean).join(' '));
  process.exit(0);
}

const verdictLine = (out, re) => {
  const hit = out.split('\n').find((l) => re.test(l));
  return (hit || '').trim();
};

const rows = [];
let blocked = 0;
for (const g of selected) {
  if (g.when && !existsSync(g.when)) { rows.push({ id: g.id, st: 'SKIP', why: 'sasaran tidak ada: ' + g.when, cmd: g.cmd.filter(Boolean).join(' ') }); continue; }
  const r = spawnSync(process.execPath, g.cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: process.env });
  const out = (r.stdout || '') + (r.stderr || '');
  const cmd = g.cmd.filter(Boolean).join(' ');
  if (r.status !== 0) { blocked++; rows.push({ id: g.id, st: 'FAIL', why: 'keluar dengan kode ' + r.status + ' (crash/penolak) — ' + verdictLine(out, /(MERAH|ASERSI GAGAL|Error|error)/), cmd }); continue; }
  const bad = g.bad && g.bad.test(out);
  const ok = !g.ok || g.ok.test(out);
  if (bad || !ok) {
    blocked++;
    rows.push({ id: g.id, st: 'FAIL', why: bad ? 'pola MERAH/penolak terlihat: ' + verdictLine(out, g.bad) : 'vonis HIJAU tidak tercetak; baris terakhir: ' + out.trim().split('\n').pop(), cmd });
  } else {
    const line = verdictLine(out, g.ok || g.bad || /./) || out.trim().split('\n').pop();
    rows.push({ id: g.id, st: g.info ? 'INFO' : 'PASS', why: line.slice(0, 96), cmd });
  }
}

const w = Math.max(...rows.map((x) => x.id.length));
for (const x of rows) console.log(x.st.padEnd(4) + ' ' + x.id.padEnd(w) + ' :: ' + x.why);
console.log('\ngate-run: GATE=' + GATES.filter((g) => !g.info).length + ' · INFO=' + GATES.filter((g) => g.info).length +
  ' · dijalankan=' + rows.length + ' · SKIP=' + rows.filter((x) => x.st === 'SKIP').length + ' · FAIL=' + rows.filter((x) => x.st === 'FAIL').length);
console.log(blocked
  ? 'gate-run: MERAH — ' + blocked + ' penjaga menolak (rinciannya di atas; perintah tersimpan pada kolom --list)'
  : 'gate-run: HIJAU — ' + rows.filter((x) => x.st === 'PASS').length + ' penjaga wajib lulus dan ' + rows.filter((x) => x.st === 'INFO').length + ' penghitung backlog keluar tanpa penolak');
process.exit(blocked ? 1 : 0);
