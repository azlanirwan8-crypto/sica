// with-dev-env.mjs — memuat apps/web/.env ke dalam proses lalu menjalankan perintah anak.
// Dipakai gerbang yang butuh koneksi PostgreSQL nyata (db:test:rls, db:migrate) tanpa
// kredensial pernah melewati shell: nilai URL di sini tidak pernah dicetak, dan shell
// tidak pernah mengurai `&` di dalam URL (penyebab `source`/`export` memotong nilai).
//
// Pemakaian:  node .tools/with-dev-env.mjs -- pnpm --filter @sica/database db:test:rls
// Petakan nilai lewat: SICA_ENV_MAP="TEST_DATABASE_URL=DIRECT_DATABASE_URL"
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = process.env.SICA_ENV_FILE ?? path.join(root, 'apps/web/.env');

const raw = readFileSync(envFile, 'utf8');
const values = new Map();
for (const line of raw.split(/\r?\n/)) {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
  if (!m) continue;
  values.set(m[1], m[2].replace(/^["']|["']$/g, ''));
}
// Nilai dari shell menang atas berkas, supaya CI tetap bisa menyetel sendiri.
for (const [k, v] of values) if (!(k in process.env)) process.env[k] = v;

for (const pair of (process.env.SICA_ENV_MAP ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
  const [target, source] = pair.split('=');
  const v = values.get(source) ?? process.env[source];
  if (v) process.env[target] = v;
  else {
    console.error(`MERAH — SICA_ENV_MAP meminta ${source} tetapi tidak ada isinya di ${path.basename(envFile)}`);
    process.exit(1);
  }
}

const argv = process.argv.slice(2);
if (argv[0] === '--') argv.shift();
if (!argv.length) {
  console.error('Pemakaian: node .tools/with-dev-env.mjs -- <perintah> [argumen…]');
  process.exit(1);
}
const [cmd, ...rest] = argv;
const child = spawn(cmd, rest, { stdio: 'inherit', shell: true, cwd: process.cwd() });
child.on('exit', (code) => process.exit(code ?? 1));
