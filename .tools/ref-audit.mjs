import { readFileSync, readdirSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';

/* PENILIK RUJUKAN SILANG — dimensi yang TIDAK diukur gerbang mana pun sampai siklus ini.
   Semua alat yang ada memeriksa KANDUNGAN satu register (nomor error, baris izin, nama
   tabel). Tidak ada yang memeriksa bahwa `PRD §5.15` yang dikutip di sebelas berkas itu
   BENAR-BENAR ADA di PRD.md. Kelas cacat yang lolos tanpa alat ini: `INTEGRATION_SPEC.md`,
   `validate-md.mjs`, `packages/config/src/env.ts`, dan `UI_UX §14` — semuanya rujukan
   yang bunyinya meyakinkan dan rumahnya tidak ada (`RD-38`, `RD-55`). */

const ALIAS = {
  PRD: 'PRD.md',
  DATA_MODEL: 'DATA_MODEL.md',
  API_SPEC: 'API_SPEC.md',
  ARCHITECTURE: 'ARCHITECTURE.md',
  RBAC_MATRIX: 'RBAC_MATRIX.md',
  RBAC: 'RBAC_MATRIX.md',
  SECURITY: 'SECURITY_COMPLIANCE.md',
  SECURITY_COMPLIANCE: 'SECURITY_COMPLIANCE.md',
  UI_UX: 'UI_UX_DESIGN.md',
  UI_UX_DESIGN: 'UI_UX_DESIGN.md',
  INTEGRATIONS: 'INTEGRATIONS.md',
  INTEGRATION: 'INTEGRATIONS.md',
  ENV_CONTRACT: 'ENV_CONTRACT.md',
  MIGRATION_SOP: 'MIGRATION_SOP.md',
  DEPLOYMENT_DEVOPS: 'DEPLOYMENT_DEVOPS.md',
  TESTING_STRATEGY: 'TESTING_STRATEGY.md',
  ISSUE_RESOLUTION: 'ISSUE_RESOLUTION.md',
  TECH_CONVENTIONS: 'TECH_CONVENTIONS.md',
  GLOSSARY: 'GLOSSARY.md',
  INDEX: 'INDEX.md',
  ROADMAP: 'ROADMAP_TASKS.md',
  ROADMAP_TASKS: 'ROADMAP_TASKS.md',
  SEED_DATA: 'SEED_DATA.md',
  GIT_WORKFLOW: 'GIT_WORKFLOW.md',
  BENCHMARK_SEVIMA: 'BENCHMARK_SEVIMA.md',
  BLUEPRINT: ['BLUEPRINT_ENTERPRISE.md', 'BLUEPRINT_ROLE_BY_ROLE.md'],
  BLUEPRINT_ENTERPRISE: 'BLUEPRINT_ENTERPRISE.md',
  BLUEPRINT_ROLE_BY_ROLE: 'BLUEPRINT_ROLE_BY_ROLE.md',
  AUDIT_READINESS: 'AUDIT_READINESS.md',
  PROGRESS_REPORT: 'PROGRESS_REPORT.md',
  AGENTS: '../../AGENTS.md',
};

const files = readdirSync(D).filter((f) => f.endsWith('.md'));
const headings = new Map();
const read = new Map();
for (const f of files) {
  const s = readFileSync(D + f, 'utf8');
  read.set(f, s);
  headings.set(f, s.split(NL).filter((l) => /^#{2,6}\s/.test(l)));
}
const agentsS = readFileSync('C:/SICA/AGENTS.md', 'utf8');
read.set('../../AGENTS.md', agentsS);
headings.set('../../AGENTS.md', agentsS.split(NL).filter((l) => /^#{2,6}\s/.test(l)));

const hasSection = (f, num) => {
  const hs = headings.get(f);
  if (!hs) return false;
  const esc = num.replace(/\./g, '\\.');
  const re = new RegExp('^#{2,6}\\s*(?:\\d+\\.)?' + esc + '(?![\\d])|^#{2,6}\\s*[^\\n]*\\b' + esc + '(?![\\d])');
  return hs.some((h) => re.test(h));
};

const REF = /(?:`)?\b([A-Z][A-Z_]{3,})\s*(?:§|Section\s+)\s*([0-9]+(?:\.[0-9]+){0,3})/g;
const missing = new Map();
let checked = 0;
for (const f of files.concat(['../../AGENTS.md'])) {
  const s = read.get(f) || '';
  const lines = s.split(NL);
  lines.forEach((line, i) => {
    /* konvensi penanda yang sama dengan `nonlatin-sampled`/`env-drift-quoted`: baris yang
       MENGUTIP rujukan salah (untuk mendaftarkannya sebagai temuan) bukan MERUJUK-nya. */
    if (line.includes('ref-audit-quoted')) return;
    let m;
    REF.lastIndex = 0;
    while ((m = REF.exec(line))) {
      const alias = m[1];
      const num = m[2];
      const target = ALIAS[alias];
      if (!target) continue;                       /* bukan nama berkas yang kita kenal */
      const targets = Array.isArray(target) ? target : [target];
      checked++;
      if (targets.some((t) => hasSection(t, num))) continue;
      const key = alias + ' §' + num;
      if (!missing.has(key)) missing.set(key, []);
      if (missing.get(key).length < 3) missing.get(key).push(f.replace('../../', '') + ':' + (i + 1));
    }
  });
}

console.log('rujukan silang bernama diperiksa = ' + checked);
console.log('rujukan yang rumuhnya TIDAK ADA = ' + missing.size);
for (const [k, v] of [...missing.entries()].sort()) console.log('  ! ' + k + '   ← ' + v.join(', '));
console.log(missing.size === 0 ? 'ref-audit: HIJAU — setiap `BERKAS §nomor` yang dikutip punya heading sasaran' : 'ref-audit: MERAH — ' + missing.size + ' rujukan yatim');
console.log(NL + 'catatan alat: keandalan temuan dibatasi oleh ALIAS yang dikenal; nama berkas di luar peta itu tidak diperiksa (dinyatakan, bukan disenyapkan).');
