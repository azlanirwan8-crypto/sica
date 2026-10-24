/**
 * Satu-kali (F-1, 2026-10-24): jalankan rantai migrasi `packages/database` memakai env
 * dev yang tinggal di `apps/web/.env` (berkas itu gitignored dan satu-satunya tempat
 * `DATABASE_URL` dev ada). Tidak ada nilai env yang dicetak — hanya nomor yang diterapkan.
 *
 * Pemakaian: `node .tools/migrate-dev.mjs`
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const envText = fs.readFileSync('apps/web/.env', 'utf8');
const env = { ...process.env };
for (const line of envText.split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && m[1] && m[2] !== undefined && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
if (!env.DIRECT_DATABASE_URL && !env.DATABASE_URL) {
  console.error('❌ apps/web/.env tidak memuat DATABASE_URL — periksa berkas env, jangan diisi dari tempat lain.');
  process.exit(1);
}

// `shell: true` dibutuhkan di Windows: `npx` adalah `npx.cmd` dan spawn tanpa shell
// mengirim ENOENT yang tidak tercetak karena stdio di-warisi. Argument di atas literal,
// tidak ada satu pun bagian yang dibangun dari input.
const res = spawnSync('npx tsx src/migrate.ts', { cwd: 'packages/database', env, stdio: 'inherit', shell: true });
process.exit(res.status ?? 1);
