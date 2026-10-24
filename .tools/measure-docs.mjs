import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

const docs = readdirSync('C:/SICA/docs').filter((f) => f.endsWith('.md'));
console.log('=== dokumen .md di /docs:', docs.length);

const run = (args) => {
  try {
    return execFileSync('C:/SICA/.tools/node/node.exe', args, { cwd: 'C:/SICA', encoding: 'utf8' });
  } catch (e) {
    return `ERROR ${e.message}`;
  }
};

const scanOut = run(['.tools/scan-nonlatin.mjs', ...docs.map((d) => `docs/${d}`), 'AGENTS.md']);
console.log('=== scan-nonlatin (semua docs + AGENTS.md) ===');
console.log(scanOut.split('\n').slice(-4).join('\n'));

console.log('=== validate-md (hanya yang bermasalah) ===');
let bad = 0;
for (const d of docs) {
  const out = run(['.tools/validate-md.mjs', `docs/${d}`]);
  if (!/problems=0/.test(out)) { bad += 1; console.log(out.trim()); }
}
const outAgents = run(['.tools/validate-md.mjs', 'AGENTS.md']);
if (!/problems=0/.test(outAgents)) { bad += 1; console.log(outAgents.trim()); }
console.log('file dengan problems != 0:', bad);

console.log('=== jumlah baris ===');
for (const d of ['ARCHITECTURE.md', 'DATA_MODEL.md', 'API_SPEC.md', 'PRD.md', 'UI_UX_DESIGN.md', 'SECURITY_COMPLIANCE.md', 'INTEGRATIONS.md', 'ROADMAP_TASKS.md', 'RBAC_MATRIX.md', 'TECH_CONVENTIONS.md', 'AUDIT_READINESS.md', 'PROGRESS_REPORT.md', 'INDEX.md', 'GLOSSARY.md']) {
  console.log(`${d}: ${readFileSync(`C:/SICA/docs/${d}`, 'utf8').split('\n').length}`);
}
console.log(`AGENTS.md: ${readFileSync('C:/SICA/AGENTS.md', 'utf8').split('\n').length}`);

console.log('=== rujukan basi yang harus habis ===');
for (const n of ['0013_engine_algorithms', 'room_wifi_allowlist', 'grade_audit_logs', 'INTEGRATION_SPEC', 'apexcharts', 'master_lookup_groups']) {
  let hits = 0;
  for (const d of docs) {
    const lines = readFileSync(`C:/SICA/docs/${d}`, 'utf8').split('\n');
    const c = lines.filter((l) => l.toLowerCase().includes(n.toLowerCase())).length;
    if (c) { hits += c; console.log(`  ${n} :: ${d}:${c}`); }
  }
  if (!hits) console.log(`  ${n} :: 0`);
}

const api = readFileSync('C:/SICA/docs/API_SPEC.md', 'utf8');
console.log('max nomor register API_SPEC:', Math.max(...[...api.matchAll(/^\| (\d+) \|/gm)].map((m) => Number(m[1]))));
const rbac = readFileSync('C:/SICA/docs/RBAC_MATRIX.md', 'utf8');
console.log('max nomor titik aksi RBAC:', Math.max(...[...rbac.matchAll(/^\| (\d+) \| `/gm)].map((m) => Number(m[1]))));

console.log('=== utang zero-hardcoding di kode ===');
const walk = (dir, acc) => {
  let names = [];
  try { names = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const f of names) {
    const q = `${dir}/${f.name}`;
    if (f.isDirectory()) walk(q, acc);
    else if (/\.(ts|tsx|dart)$/.test(f.name)) {
      acc.files += 1;
      const t = readFileSync(q, 'utf8');
      acc.zenum += (t.match(/z\.enum\(/g) || []).length;
      acc.option += (t.match(/<option[\s]/g) || []).length;
      acc.optionsArr += (t.match(/options=\{\[/g) || []).length;
      acc.fontFat += (t.match(/font-(black|extrabold)/g) || []).length;
      acc.blueLit += (t.match(/(?:blue|indigo|sky|violet|purple)-[0-9]00/g) || []).length;
      acc.sicaOld += (t.match(/--sica-color-/g) || []).length;
    }
  }
  return acc;
};
console.log('apps/web/src   :', JSON.stringify(walk('C:/SICA/apps/web/src', { files: 0, zenum: 0, option: 0, optionsArr: 0, fontFat: 0, blueLit: 0, sicaOld: 0 })));
console.log('apps/mobile/lib:', JSON.stringify(walk('C:/SICA/apps/mobile/lib', { files: 0, zenum: 0, option: 0, optionsArr: 0, fontFat: 0, blueLit: 0, sicaOld: 0 })));
console.log('packages/contracts:', JSON.stringify(walk('C:/SICA/packages/contracts/src', { files: 0, zenum: 0, option: 0, optionsArr: 0, fontFat: 0, blueLit: 0, sicaOld: 0 })));
