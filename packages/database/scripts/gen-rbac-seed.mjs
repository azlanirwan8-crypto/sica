// Seeder generator untuk migrations/0011_rbac_scoped.sql.
//
// Sumber kebenaran: packages/contracts/src/authz.ts (katalog PERM + grant peran).
// Migrasi SQL tidak boleh menyalin kode izin secara manual — jalankan ulang skrip
// ini setiap kali katalog berubah, lalu commit kedua file pada commit yang sama.
//
//   node packages/database/scripts/gen-rbac-seed.mjs [--check]
//
// --check  : tidak menulis file, hanya verifikasi blok yang ada masih cocok.
import { readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const authzTs = join(repoRoot, 'packages', 'contracts', 'src', 'authz.ts');
const authzTmp = join(repoRoot, 'packages', 'contracts', '.tmp-authz-gen.cjs');
const migration = join(repoRoot, 'packages', 'database', 'migrations', '0011_rbac_scoped.sql');

const checkOnly = process.argv.includes('--check');
if (!existsSync(migration)) {
  console.error(`Migrasi tujuan tidak ada: ${migration}`);
  process.exit(1);
}

// --- muat modul TS kontrak lewat transpile (kontrak dikonsumsi sebagai sumber) ---
const js = ts.transpileModule(readFileSync(authzTs, 'utf-8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
writeFileSync(authzTmp, js);
let authz;
try {
  authz = createRequire(authzTmp)(authzTmp);
} finally {
  rmSync(authzTmp, { force: true });
}

const VERB_LABEL_ID = {
  READ: 'Baca',
  INSERT: 'Tambah',
  UPDATE: 'Ubah',
  DELETE: 'Hapus',
  VALIDATE: 'Setujui',
  OTHER: 'Aksi khusus',
};

const specs = authz.PERMISSION_SPECS;
const grants = authz.SYSTEM_ROLE_GRANTS;
const roleCodes = authz.ROLE_CODES;

// --- verifikasi sebelum menulis apa pun ---
const codes = new Set(specs.map((s) => s.code));
if (codes.size !== specs.length) {
  console.error(`Kode izin duplikat: ${specs.length} baris tapi hanya ${codes.size} unik.`);
  process.exit(1);
}
for (const s of specs) {
  if (!(s.verb in VERB_LABEL_ID)) {
    console.error(`Verb tidak kanonik pada ${s.code}: ${s.verb}`);
    process.exit(1);
  }
  if (s.code.split('.')[0] !== s.module && authz.MODULE_PREFIX_ALIASES[s.code.split('.')[0]] !== s.module) {
    console.error(`Prefiks kode != modul pada ${s.code} (module=${s.module}).`);
    process.exit(1);
  }
}
for (const [role, list] of Object.entries(grants)) {
  if (!roleCodes.includes(role)) {
    console.error(`Grant untuk peran tidak terdaftar: ${role}`);
    process.exit(1);
  }
  for (const code of list) {
    if (!codes.has(code)) {
      console.error(`Peran ${role} mengizinkan kode yang tidak ada di katalog: ${code}`);
      process.exit(1);
    }
  }
}

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;

// --- blok 1: katalog izin global ---
const permissionRows = specs
  .map((s) =>
    `  (${q(s.code)}, ${q(s.module)}, ${q(s.resource)}, ${q(s.verb)}, ` +
    `${q(`${VERB_LABEL_ID[s.verb]} '${s.resource}' [modul ${s.module}]`)})`
  )
  .join(',\n');
const permissionsSql = [
  `-- Diturunkan dari PERMISSION_SPECS (${specs.length} izin atomik).`,
  'INSERT INTO permissions (code, module, resource, verb, description) VALUES',
  `${permissionRows}`,
  'ON CONFLICT (code) DO NOTHING;',
].join('\n');

// --- blok 2: grant peran -> izin ---
const grantBlocks = roleCodes
  .filter((role) => (grants[role] ?? []).length > 0)
  .map((role) => {
    const list = [...new Set(grants[role])].sort();
    const lines = list.map((code) => `    ${q(code)}`).join(',\n');
    return [
      `-- ${role} (${list.length} izin)`,
      'INSERT INTO role_permissions (tenant_id, role_id, permission_id)',
      'SELECT r.tenant_id, r.id, p.id',
      'FROM roles r CROSS JOIN permissions p',
      `WHERE r.code = ${q(role)}`,
      `  AND p.code = ANY(ARRAY[`,
      lines,
      '  ]::text[])',
      'ON CONFLICT (role_id, permission_id) DO NOTHING;',
    ].join('\n');
  })
  .join('\n\n');
const grantsSql = `-- Diturunkan dari SYSTEM_ROLE_GRANTS (${roleCodes.filter((r) => (grants[r] ?? []).length > 0).length} peran, ${specs.length} katalog).\n${grantBlocks}`;

// --- tulis ke penanda blok ---
function inject(text, marker, body) {
  const open = `-- >>> ${marker}`;
  const close = `-- <<< ${marker}`;
  const from = text.indexOf(open);
  const to = text.indexOf(close);
  if (from < 0 || to < 0 || to < from) {
    console.error(`Penanda ${open} / ${close} tidak ditemukan di ${migration}`);
    process.exit(1);
  }
  const head = text.slice(0, from + open.length);
  const tail = text.slice(to);
  return `${head}\n${body}\n${tail}`;
}

const source = readFileSync(migration, 'utf-8');
const generated = inject(inject(source, 'GEN:PERMISSIONS', permissionsSql), 'GEN:GRANTS', grantsSql);

/**
 * Mode `--expand=<berkas>`: menulis migrasi pembesar untuk basis data yang SUDAH
 * menjalankan `0011`. Isi bloknya katalog lengkap dengan `ON CONFLICT DO NOTHING`,
 * sehingga (a) tidak ada pembukuan "kode mana yang baru" yang bisa basi, dan (b)
 * `0011` tetap menjadi satu-satunya sumber untuk replay dari nol.
 */
const expandArg = process.argv.find((a) => a.startsWith('--expand='));
if (expandArg) {
  const target = expandArg.slice('--expand='.length);
  const abs = join(repoRoot, target);
  const body = [
    '-- >>> GEN:EXPAND',
    `-- Diturunkan dari packages/contracts/src/authz.ts oleh ${'gen-rbac-seed.mjs'} — JANGAN sunting manual.`,
    `-- Katalog ${specs.length} izin · ${roleCodes.length} peran. Idempoten: seluruh blok ON CONFLICT DO NOTHING.`,
    '',
    permissionsSql,
    '',
    grantsSql,
    '-- <<< GEN:EXPAND',
    '',
  ].join('\n');
  const preamble = existsSync(abs)
    ? readFileSync(abs, 'utf-8').split('-- >>> GEN:EXPAND')[0]
    : `-- Perluasan katalog RBAC untuk basis data yang sudah menerapkan 0011.\n-- Jalankan: node packages/database/scripts/gen-rbac-seed.mjs --expand=${target}\n\n`;
  writeFileSync(abs, preamble + body);
  console.log(`Ditulis ke ${target}: ${specs.length} izin, ${roleCodes.length} peran (expand-only, idempoten).`);
  process.exit(0);
}

if (checkOnly) {
  const unchanged = generated === source;
  console.log(
    unchanged
      ? `Blok seed sinkron dengan kontrak (${specs.length} izin, ${roleCodes.length} peran).`
      : 'BLOK SEED TIDAK SINKRON dengan packages/contracts/src/authz.ts — jalankan generator tanpa --check.'
  );
  process.exit(unchanged ? 0 : 1);
}

writeFileSync(migration, generated);
console.log(
  `Ditulis ke 0011_rbac_scoped.sql: ${specs.length} izin, ${roleCodes.length} peran, ` +
    `${Object.values(grants).reduce((n, l) => n + new Set(l).size, 0)} pasangan grant.`
);
